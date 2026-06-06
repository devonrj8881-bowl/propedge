/**
 * Portable PropIQ scoring kernel.
 * Mirrors computeBetScore() sections that only need CSV-available fields.
 * Omitted: pace engine, Omega fatigue/vacancy/venue, blowout guard,
 *   usage cannibalization, weather, SGP correlation, process layers,
 *   sauce layer — all require game-state data not in the prop feed CSV.
 */

import type { BoardProp } from "./types";

function pct(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = parseFloat(String(value).replace("%", "").trim());
  if (!Number.isFinite(n)) return null;
  return n <= 1 ? n * 100 : n;
}

export interface PropIqResult {
  score: number;
  forFactors: string[];
  againstFactors: string[];
}

export function computePortablePropIq(p: BoardProp): PropIqResult {
  const forFactors: string[] = [];
  const againstFactors: string[] = [];
  let score = 50;

  const propTypeLower = (p.prop || p.stat || "").toLowerCase();

  // ── 1. EDGE SIGNAL (±28 pts) ──────────────────────────────────────
  const edge = parseFloat(String(p.edge ?? ""));
  if (Number.isFinite(edge)) {
    if      (edge >= 15) { score += 28; forFactors.push(`+${edge.toFixed(1)}% Elite Edge (Model Overmarket)`); }
    else if (edge >= 10) { score += 20; forFactors.push(`+${edge.toFixed(1)}% Strong Advantage`); }
    else if (edge >=  5) { score += 12; forFactors.push(`+${edge.toFixed(1)}% Core Profit Edge`); }
    else if (edge >=  2) { score +=  5; forFactors.push(`+${edge.toFixed(1)}% Thin Value`); }
    else if (edge >= -3) { score -=  5; againstFactors.push(`Flat Market (${edge.toFixed(1)}%) — efficient pricing`); }
    else if (edge >= -8) { score -= 15; againstFactors.push(`Negative Edge — book holds baseline`); }
    else                 { score -= 28; againstFactors.push(`⚠️ Avoid: Strong Book Advantage (${edge.toFixed(1)}%)`); }
  }

  // ── 2. TREND & MOMENTUM (±15 pts) ────────────────────────────────
  const l10 = pct(p.l10Pct), l20 = pct(p.l20Pct), l30 = pct(p.l30Pct);
  if (l10 != null && l20 != null && l30 != null) {
    if      (l10 > l20 && l20 >= l30)       { score += 15; forFactors.push(`🚀 Upward Momentum: ${l10.toFixed(0)}% (L10) vs ${l30.toFixed(0)}% (L30)`); }
    else if (l10 >= l20 && l10 >= 62)       { score +=  8; forFactors.push(`📈 Elite Stability: Consistent ${l10.toFixed(0)}% hit rate`); }
    else if (l10 < l20 && l20 < l30)        { score -= 15; againstFactors.push(`📉 Fatigue Cycle: Hit rate dropping (${l30.toFixed(0)}%→${l10.toFixed(0)}%)`); }
    else if (l10 < 50)                      { score -=  8; againstFactors.push(`Below 50% hit rate cycle`); }
  }

  // ── 3. MATCHUP QUALITY (±12 pts) ─────────────────────────────────
  const mu = parseInt(String(p.sznMatchup ?? ""));
  if (Number.isFinite(mu) && mu > 0) {
    const favorable = (p.direction === "OVER" && mu <= 8)  || (p.direction === "UNDER" && mu >= 23);
    const tough     = (p.direction === "OVER" && mu >= 23) || (p.direction === "UNDER" && mu <= 8);
    if      (favorable) { score += 12; forFactors.push(`🎯 Top 10 Matchup Favorability (#${mu} rank)`); }
    else if (tough)     { score -= 10; againstFactors.push(`🛡️ Tough Defensive Alignment (#${mu} rank)`); }
  }

  // ── 4. LINE VELOCITY / SHARP SIGNAL (±15 pts) ────────────────────
  const opening = parseFloat(String(p.opening ?? ""));
  const currentLine = parseFloat(String(p.line ?? ""));
  if (Number.isFinite(opening) && opening > 0 && Number.isFinite(currentLine) && currentLine > 0) {
    const move = p.direction === "OVER" ? (currentLine - opening) : (opening - currentLine);
    if      (move >= 1.5)  { score += 15; forFactors.push(`🐋 MASSIVE SHARP VELOCITY (+${move.toFixed(1)} pts)`); }
    else if (move >= 0.5)  { score +=  5; forFactors.push(`📈 Active Line Movement (+${move.toFixed(1)} pts)`); }
    else if (move <= -0.5) { score -=  8; againstFactors.push(`📉 Anti-Movement: Line drifting away from bet`); }
  }

  // ── 5. JUICE RESISTANCE (±10 pts) ────────────────────────────────
  const cardOdds = parseFloat(String(p.odds ?? p.over_odds ?? ""));
  if (Number.isFinite(cardOdds)) {
    if      (cardOdds >= -115) { score +=  8; forFactors.push(`Low Juice / Fair Odds baseline`); }
    else if (cardOdds <= -200) { score -= 10; againstFactors.push(`Heavy Juice (${cardOdds}) — poor ROI profile`); }
  }

  // ── 6. CUSHION SCORE (±12 pts) ───────────────────────────────────
  const l5Avg = parseFloat(String(p.l5Avg ?? ""));
  const line = parseFloat(String(p.line ?? ""));
  if (Number.isFinite(l5Avg) && l5Avg > 0 && Number.isFinite(line) && line > 0) {
    const cushion = p.direction === "OVER"
      ? (l5Avg - line) / line
      : (line - l5Avg) / line;
    if      (cushion >= 0.12) { score += 12; forFactors.push(`🎯 Wide Cushion — L5 avg ${l5Avg} clears line ${line} by ${(cushion * 100).toFixed(0)}%`); }
    else if (cushion >= 0.05) { score +=  6; forFactors.push(`📐 Solid Cushion (+${(cushion * 100).toFixed(0)}%)`); }
    else if (cushion < -0.05) { score -= 10; againstFactors.push(`⚠️ Negative Cushion — L5 avg misses line by ${(Math.abs(cushion) * 100).toFixed(0)}%`); }
    else if (cushion < -0.02) { score -=  5; againstFactors.push(`⚠️ Razor Thin — L5 barely clears line`); }
  }

  // ── 7. ADAPTIVE VARIANCE GATE (−8 pts) ───────────────────────────
  if (["stl", "blk", "hr", "td", "goals"].some(t => propTypeLower.includes(t))) {
    score -= 8;
    againstFactors.push('🎲 High-Variance "Low Event" Market');
  }

  // ── 8. PITCHER ERA & XERA — MLB only (±12 pts) ───────────────────
  if (p.league === "MLB") {
    const isTBProp = /total bases|\btb\b/i.test(propTypeLower);
    const era = p.pitcherERA ?? null;
    const xera = p.pitcherXERA ?? null;
    if (era != null && era > 0) {
      if      (era < 3.0)  { score += isTBProp ? -12 : -8; forFactors.push(`🔒 Elite Starter (ERA ${era.toFixed(2)}) — suppress`); }
      else if (era < 3.75) { score += isTBProp ?  -7 : -5; forFactors.push(`🧊 Strong Starter (ERA ${era.toFixed(2)})`); }
      else if (era > 5.0)  { score += isTBProp ?  10 :  6; forFactors.push(`🔥 Weak Starter (ERA ${era.toFixed(2)}) — upside`); }
      else if (era > 4.25) { score += isTBProp ?   6 :  3; forFactors.push(`📈 Hittable Pitcher (ERA ${era.toFixed(2)})`); }
    }
    if (xera != null && era != null) {
      const diff = xera - era;
      if      (diff >  1.5) { score += isTBProp ? 5 : 3;  forFactors.push(`📊 Pitcher Regression Risk (xERA ${xera.toFixed(2)} vs ERA ${era.toFixed(2)})`); }
      else if (diff < -1.5) { score += isTBProp ? -5 : -3; againstFactors.push(`🛡️ Pitcher Outperforming xERA (xERA ${xera.toFixed(2)} vs ERA ${era.toFixed(2)})`); }
    }
  }

  // ── 9. NHL GOALIE CONTEXT (±5 pts) ───────────────────────────────
  if (p.league === "NHL" && /goal|shot|point/i.test(propTypeLower)) {
    const matchupRank = parseInt(String(p.sznMatchup ?? "")) || 15;
    if      (matchupRank <= 5)  { score -= 5; againstFactors.push("🧤 Elite Netminder Alert (top-5 goalie SV%)"); }
    else if (matchupRank >= 27) { score -= 4; againstFactors.push("⚠️ Leaky Goalie Matchup (bottom-5 SV%)"); }
  }

  // ── 10. B2B FATIGUE — NBA (±8 pts) ───────────────────────────────
  if (p.league === "NBA") {
    const daysRest = parseInt(String(p.daysRest ?? "")) || 0;
    if (p.isB2b) {
      score -= 8;
      againstFactors.push("🔋 Back-to-Back Fatigue (volume suppression expected)");
    } else if (daysRest >= 3 && p.direction === "OVER") {
      score += 3;
      forFactors.push(`💪 Well-Rested (${daysRest}d rest) — volume bounce`);
    }
  }

  // ── 11. TRIPLE ALIGNMENT BONUS (+8 pts) ──────────────────────────
  if (
    Number.isFinite(edge) && edge >= 6 &&
    l10 != null && l10 >= 65 &&
    Number.isFinite(opening) && Number.isFinite(currentLine) &&
    currentLine >= opening && p.direction === "OVER"
  ) {
    score += 8;
    forFactors.push("🎯 Triple-Alignment: Vegas, Model & Momentum converged");
  }

  // ── 12. PROPIQ REALISM GATES ──────────────────────────────────────
  const l5Gate = pct(p.l5Pct);
  const l10Gate = pct(p.l10Pct);
  const l20Gate = pct(p.l20Pct);
  const confGate = pct(p.confidence);

  const capScore = (cap: number, reason: string) => {
    if (score > cap) { score = cap; againstFactors.push(reason); }
  };

  if (confGate != null && confGate < 40) {
    capScore(55, `⚠️ PropIQ Gate: low confidence (${confGate.toFixed(0)}%) blocks premium grade`);
  }
  if (l5Gate != null && l10Gate != null && l5Gate <= 60 && l10Gate <= 40) {
    capScore(58, `📉 Hit-Rate Gate: L5 ${l5Gate.toFixed(0)}% / L10 ${l10Gate.toFixed(0)}% not premium form`);
  }
  if (confGate != null && confGate < 45) {
    const weakForm = (l5Gate != null && l5Gate < 65) || (l10Gate != null && l10Gate < 55);
    if (weakForm) capScore(62, `🧪 Confidence + Form Gate: ${confGate.toFixed(0)}% conf + weak hit rates`);
  }

  const hasUltimateEvidence =
    (confGate == null || confGate >= 60) &&
    (
      (l5Gate != null && l5Gate >= 70 && l10Gate != null && l10Gate >= 70) ||
      (l10Gate != null && l10Gate >= 75 && l20Gate != null && l20Gate >= 65)
    );
  if (score >= 83 && !hasUltimateEvidence) {
    capScore(74, "🔒 Ultimate Gate: requires strong confidence + multi-window hit-rate support");
  }

  // ── 13. KEY NUMBER PROXIMITY (−6 pts) — Section 18 ───────────────
  const kLine = parseFloat(String(p.line ?? "")) || 0;
  if (kLine > 0) {
    let nearKey = false;
    if (p.league === "NBA" && /point|pts/.test(propTypeLower)) {
      nearKey = [14.5, 19.5, 24.5, 29.5, 34.5, 39.5].some(k => Math.abs(kLine - k) <= 0.3);
    } else if (p.league === "MLB" && /\bhit\b|rbi|\bhr\b|home.?run|stolen.?base/.test(propTypeLower)) {
      nearKey = [0.5, 1.5].some(k => Math.abs(kLine - k) <= 0.3);
    } else if (p.league === "NHL" && /goal|puck/.test(propTypeLower)) {
      nearKey = [0.5, 1.5].some(k => Math.abs(kLine - k) <= 0.3);
    }
    if (nearKey) {
      score -= 6;
      againstFactors.push(`🔢 Key Number Line (${kLine}): sharp boundary pricing, edge narrower`);
    }
  }

  // ── 14. REGRESSION PROTECTION (±12 pts) — Section 19 ─────────────
  {
    const rL5 = pct(p.l5Pct) ?? 0;
    const rL20 = pct(p.l20Pct) ?? 0;
    const rL30 = pct(p.l30Pct) ?? 0;
    const rSzn = pct(p.seasonPct) ?? 0;
    const rBase = rSzn > 0 ? rSzn : rL30;
    if (rL5 > 0 && rL20 > 0) {
      const hotDelta = rL5 - rL20;
      const coldDelta = rL20 - rL5;
      if      (hotDelta >= 30 && rBase < 58) { score -= 8; againstFactors.push(`🎢 Streak Inflation Risk: L5 ${rL5.toFixed(0)}% >> L20 ${rL20.toFixed(0)}% on cold baseline`); }
      else if (hotDelta >= 20 && rBase < 53) { score -= 4; againstFactors.push(`⚠️ Regression Caution: hot streak on below-average baseline`); }
      else if (coldDelta >= 25 && rL20 >= 60 && rBase >= 55) { score += 7; forFactors.push(`🔄 Bounce-Back Setup: ${rL5.toFixed(0)}% L5 vs ${rL20.toFixed(0)}% proven baseline`); }
      else if (coldDelta >= 15 && rL20 >= 62 && rBase >= 58) { score += 4; forFactors.push(`📈 Mean Reversion Opportunity: strong baseline, cold recent`); }
    }
    if (rL20 >= 62 && rL30 >= 60 && rSzn >= 56) {
      score += 5;
      forFactors.push(`📊 Proven Consistency: L20/L30/Season all ≥60%`);
    }
  }

  // ── 15. MULTI-LEAGUE REST DIFFERENTIAL (±6 pts) — Section 20 ──────
  if (p.league !== "NBA") {
    const rdDays = parseInt(String(p.daysRest ?? "")) || 0;
    const rdIsB2b = p.isB2b || rdDays === 1;
    if (rdIsB2b) {
      score -= 6;
      againstFactors.push(`🔋 B2B Fatigue (${p.league}): volume suppression`);
    } else if (p.league === "NFL" && rdDays >= 10 && p.direction === "OVER") {
      score += 6;
      forFactors.push(`🏈 Bye-Week Freshness: ${rdDays}d rest, peak readiness`);
    } else if (rdDays >= 4 && /point|goal|strikeout|hit|yard/.test(propTypeLower) && p.direction === "OVER") {
      score += 3;
      forFactors.push(`💪 Extended Rest (${rdDays}d): volume-prop upside`);
    }
  }

  // ── 16. MARKET EFFICIENCY (+4 pts) — Section 21 ───────────────────
  if (/\brebound\b|assist|\bsteal\b|\bblock\b|\b3pm\b|three.?point.?made|turnover/.test(propTypeLower)) {
    score += 4;
    forFactors.push(`📈 Soft Market: ${p.prop || p.stat || "prop"} pricing less efficient`);
  }

  // ── 17. HISTORICAL BASELINE (±5 pts) — Section 22 ─────────────────
  const lastSznPct = parseFloat(String((p as unknown as Record<string, unknown>).lastSeasonPct ?? (p as unknown as Record<string, unknown>).last_season_pct ?? 0)) || 0;
  const currSznPct = pct(p.seasonPct) ?? 0;
  if (lastSznPct > 0 && currSznPct > 0) {
    const crossDelta = Math.abs(lastSznPct - currSznPct);
    if      (crossDelta <= 10 && lastSznPct >= 58 && currSznPct >= 55) { score += 5; forFactors.push(`📅 Cross-Season Reliability: ${lastSznPct}% last vs ${currSznPct.toFixed(0)}% current`); }
    else if (lastSznPct < 40 && currSznPct < 45) { score -= 5; againstFactors.push(`📉 Historical Pattern: poor performance both seasons`); }
  }

  return {
    score: Math.max(1, Math.min(99, Math.round(score))),
    forFactors,
    againstFactors,
  };
}
