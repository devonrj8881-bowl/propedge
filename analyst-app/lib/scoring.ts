/**
 * Portable PropIQ scoring kernel.
 * Mirrors computeBetScore() sections that only need CSV-available fields.
 *
 * PORTED: Sections 1-17 (edge, trend, matchup, velocity, juice, cushion,
 *   streak, pitcher ERA/xERA, B2B/rest, sentinel reversion, sharp fade,
 *   process layers, sauce hit-rate nudge, gates), Sections 18-22.
 *
 * NOT PORTED (requires live game-state):
 *   Pace engine (window._teamStats), blowout guard (game spread),
 *   usage cannibalization (state.parlay), Omega vacancy/venue (injury/location data),
 *   weather (game weather API), SGP correlation (state.parlay),
 *   sentinel matchup (window._teamStats), sauce FD vs DK line comparison,
 *   sauce sharp/CLV history (state.propLineHistory/lineMovements).
 */

import type { BoardProp } from "./types";

// ── PROP SAUCE WEIGHTS (mirrors PROP_SAUCE_WEIGHTS in index.html) ──────────
const PROP_SAUCE_WEIGHTS: Record<string, Record<string, { hit: number }>> = {
  NBA: {
    points:   { hit: 1.0  },
    rebounds: { hit: 0.9  },
    assists:  { hit: 0.85 },
    threes:   { hit: 0.8  },
    steals:   { hit: 0.7  },
    blocks:   { hit: 0.7  },
    default:  { hit: 0.85 },
  },
  NHL: {
    goals:   { hit: 1.0  },
    shots:   { hit: 1.05 },
    saves:   { hit: 0.85 },
    default: { hit: 0.9  },
  },
  MLB: {
    strikeouts: { hit: 0.95 },
    hits:       { hit: 0.9  },
    runs:       { hit: 1.0  },
    default:    { hit: 0.9  },
  },
  NFL: {
    default: { hit: 0.95 },
  },
};

function resolveSauceKey(propTypeLower: string): string {
  if (/point|pts\b/.test(propTypeLower))            return "points";
  if (/rebound|reb/.test(propTypeLower))            return "rebounds";
  if (/assist|ast/.test(propTypeLower))             return "assists";
  if (/3-?pt|three|3pm/.test(propTypeLower))        return "threes";
  if (/steal|stl/.test(propTypeLower))              return "steals";
  if (/block|blk/.test(propTypeLower))              return "blocks";
  if (/goal/.test(propTypeLower))                   return "goals";
  if (/shot/.test(propTypeLower))                   return "shots";
  if (/save/.test(propTypeLower))                   return "saves";
  if (/strikeout|\bk\b|ks/.test(propTypeLower))     return "strikeouts";
  if (/hit|tb|total bases/.test(propTypeLower))     return "hits";
  if (/run/.test(propTypeLower))                    return "runs";
  return "default";
}

function getSauceProfile(league: string, propTypeLower: string): { hit: number } {
  const bucket = PROP_SAUCE_WEIGHTS[league] || PROP_SAUCE_WEIGHTS.NBA;
  const key = resolveSauceKey(propTypeLower);
  return bucket[key] || bucket.default || { hit: 0.85 };
}

// ── HELPERS ─────────────────────────────────────────────────────────────────
function pct(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = parseFloat(String(value).replace("%", "").trim());
  if (!Number.isFinite(n)) return null;
  return n <= 1 ? n * 100 : n;
}

function impliedProbFromOdds(odds: number): number {
  return odds < 0 ? Math.abs(odds) / (Math.abs(odds) + 100) : 100 / (odds + 100);
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
  const league = p.league || "NBA";
  const direction = (p.direction || "OVER").toUpperCase();

  // ── 1. EDGE SIGNAL (±28 pts) ──────────────────────────────────────────────
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

  // ── 2. TREND & MOMENTUM (±15 pts) ────────────────────────────────────────
  const l10 = pct(p.l10Pct), l20 = pct(p.l20Pct), l30 = pct(p.l30Pct);
  if (l10 != null && l20 != null && l30 != null) {
    if      (l10 > l20 && l20 >= l30)       { score += 15; forFactors.push(`🚀 Upward Momentum: ${l10.toFixed(0)}% (L10) vs ${l30.toFixed(0)}% (L30)`); }
    else if (l10 >= l20 && l10 >= 62)       { score +=  8; forFactors.push(`📈 Elite Stability: Consistent ${l10.toFixed(0)}% hit rate`); }
    else if (l10 < l20 && l20 < l30)        { score -= 15; againstFactors.push(`📉 Fatigue Cycle: Hit rate dropping (${l30.toFixed(0)}%→${l10.toFixed(0)}%)`); }
    else if (l10 < 50)                      { score -=  8; againstFactors.push(`Below 50% hit rate cycle`); }
  }

  // ── 3. MATCHUP QUALITY (±12 pts) ─────────────────────────────────────────
  const mu = parseInt(String(p.sznMatchup ?? ""));
  if (Number.isFinite(mu) && mu > 0) {
    const favorable = (direction === "OVER" && mu <= 8)  || (direction === "UNDER" && mu >= 23);
    const tough     = (direction === "OVER" && mu >= 23) || (direction === "UNDER" && mu <= 8);
    if      (favorable) { score += 12; forFactors.push(`🎯 Top 10 Matchup Favorability (#${mu} rank)`); }
    else if (tough)     { score -= 10; againstFactors.push(`🛡️ Tough Defensive Alignment (#${mu} rank)`); }
  }

  // ── 4. LINE VELOCITY / SHARP SIGNAL (±15 pts) ────────────────────────────
  const opening = parseFloat(String(p.opening ?? ""));
  const currentLine = parseFloat(String(p.line ?? ""));
  if (Number.isFinite(opening) && opening > 0 && Number.isFinite(currentLine) && currentLine > 0) {
    const move = direction === "OVER" ? (currentLine - opening) : (opening - currentLine);
    if      (move >= 1.5)  { score += 15; forFactors.push(`🐋 MASSIVE SHARP VELOCITY (+${move.toFixed(1)} pts)`); }
    else if (move >= 0.5)  { score +=  5; forFactors.push(`📈 Active Line Movement (+${move.toFixed(1)} pts)`); }
    else if (move <= -0.5) { score -=  8; againstFactors.push(`📉 Anti-Movement: Line drifting away from bet`); }
  }

  // ── 5. JUICE RESISTANCE (±10 pts) ────────────────────────────────────────
  const cardOdds = parseFloat(String(p.odds ?? p.over_odds ?? ""));
  if (Number.isFinite(cardOdds)) {
    if      (cardOdds >= -115) { score +=  8; forFactors.push(`Low Juice / Fair Odds baseline`); }
    else if (cardOdds <= -200) { score -= 10; againstFactors.push(`Heavy Juice (${cardOdds}) — poor ROI profile`); }
  }

  // ── 6. CUSHION SCORE (±12 pts) ───────────────────────────────────────────
  const l5Avg = parseFloat(String(p.l5Avg ?? ""));
  const line = parseFloat(String(p.line ?? ""));
  if (Number.isFinite(l5Avg) && l5Avg > 0 && Number.isFinite(line) && line > 0) {
    const cushion = direction === "OVER" ? (l5Avg - line) / line : (line - l5Avg) / line;
    if      (cushion >= 0.12) { score += 12; forFactors.push(`🎯 Wide Cushion — L5 avg ${l5Avg} clears line ${line} by ${(cushion * 100).toFixed(0)}%`); }
    else if (cushion >= 0.05) { score +=  6; forFactors.push(`📐 Solid Cushion (+${(cushion * 100).toFixed(0)}%)`); }
    else if (cushion < -0.05) { score -= 10; againstFactors.push(`⚠️ Negative Cushion — L5 avg misses line by ${(Math.abs(cushion) * 100).toFixed(0)}%`); }
    else if (cushion < -0.02) { score -=  5; againstFactors.push(`⚠️ Razor Thin — L5 barely clears line`); }
  }

  // ── 7. ADAPTIVE VARIANCE GATE (−8 pts) ───────────────────────────────────
  if (["stl", "blk", "hr", "td", "goals"].some(t => propTypeLower.includes(t))) {
    score -= 8;
    againstFactors.push('🎲 High-Variance "Low Event" Market');
  }

  // ── 8. STREAK INTELLIGENCE (±8 pts) ──────────────────────────────────────
  if (typeof p.streak === "number" && p.streak !== 0) {
    const sk = p.streak;
    if (league === "MLB") {
      if      (sk >= 7)  { score -= 5; againstFactors.push(`⚠️ Streak Regression Risk — ${sk}+ game streak, correction likely`); }
      else if (sk >= 5)  { score += 4; forFactors.push(`🔥 Hot Streak (${sk} games)`); }
      else if (sk >= 3)  { score += 2; forFactors.push(`🔥 Heating Up (${sk} games)`); }
      else if (sk <= -5) { score -= 6; againstFactors.push(`🥶 Extended Cold Streak (${sk} games)`); }
      else if (sk <= -3) { score -= 3; againstFactors.push(`📉 Cooling Streak (${sk} games)`); }
    } else {
      if      (sk >= 6)  { score -= 4; againstFactors.push(`⚠️ Streak Regression Risk — ${sk}+ game streak, mean reversion due`); }
      else if (sk >= 4)  { score += 5; forFactors.push(`🔥 Hot Streak (${sk} games)`); }
      else if (sk >= 3)  { score += 3; forFactors.push(`🔥 Heating Up (${sk} games)`); }
      else if (sk <= -3) { score -= 5; againstFactors.push(`🥶 Cold Streak (${sk} games)`); }
      else if (sk <= -2) { score -= 2; againstFactors.push(`📉 Cooling (${sk} games)`); }
    }
  }

  // ── 9. PITCHER ERA & XERA — MLB only (±12 pts) ───────────────────────────
  if (league === "MLB") {
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

  // ── 10. NHL GOALIE CONTEXT (±5 pts) ──────────────────────────────────────
  if (league === "NHL" && /goal|shot|point/i.test(propTypeLower)) {
    const matchupRank = parseInt(String(p.sznMatchup ?? "")) || 15;
    if      (matchupRank <= 5)  { score -= 5; againstFactors.push("🧤 Elite Netminder Alert (top-5 goalie SV%)"); }
    else if (matchupRank >= 27) { score -= 4; againstFactors.push("⚠️ Leaky Goalie Matchup (bottom-5 SV%)"); }
  }

  // ── 11. B2B FATIGUE — NBA (±8 pts) ───────────────────────────────────────
  if (league === "NBA") {
    const daysRest = parseInt(String(p.daysRest ?? "")) || 0;
    if (p.isB2b) {
      score -= 8;
      againstFactors.push("🔋 Back-to-Back Fatigue (volume suppression expected)");
    } else if (daysRest >= 3 && direction === "OVER") {
      score += 3;
      forFactors.push(`💪 Well-Rested (${daysRest}d rest) — volume bounce`);
    }
  }

  // ── 12. SENTINEL: MEAN REVERSION GUARD (±12 pts) ─────────────────────────
  // Mirrors calculateSentinelReversion(p, edge)
  {
    const srL10 = pct(p.l10Pct) ?? 0;
    const srL20 = pct(p.l20Pct) ?? 0;
    const srSzn = pct(p.seasonPct) ?? 0;
    const srBase = srSzn > 0 ? srSzn : srL20;
    if (srBase > 0 && srL10 > 0) {
      const delta = srL10 - srBase;
      const edgeVal = Number.isFinite(edge) ? edge : 0;
      if (srL10 >= 85 && delta > 25 && edgeVal < 4 && direction === "OVER") {
        score -= 10;
        againstFactors.push(`⚖️ Mean Reversion Alert: Extreme L10 (${srL10.toFixed(0)}%) vs baseline (${srBase.toFixed(0)}%)`);
      } else if (srL10 >= 75 && delta > 15 && edgeVal < 5 && direction === "OVER") {
        score -= 6;
        againstFactors.push(`⚠️ Regression Risk: Hot L10 (${srL10.toFixed(0)}%) well above baseline (${srBase.toFixed(0)}%)`);
      } else if (srL10 >= 65 && delta > 20 && direction === "OVER") {
        score -= 3;
        againstFactors.push(`📊 Trend Gap: L10 (${srL10.toFixed(0)}%) significantly exceeds baseline (${srBase.toFixed(0)}%)`);
      } else if (srL10 <= 35 && (srBase - srL10) > 15 && edgeVal >= 5 && direction === "OVER") {
        score += 6;
        forFactors.push(`💎 Sentinel Buy-Low: Model edge on underperforming player (${srL10.toFixed(0)}% L10 vs ${srBase.toFixed(0)}% baseline)`);
      }
    }
  }

  // ── 13. SHARP FADE / PUBLIC TRAP (±12 pts) ───────────────────────────────
  // Mirrors detectSharpFade(p)
  {
    const sfOdds = parseFloat(String(p.odds ?? p.over_odds ?? ""));
    const sfOpening = Number.isFinite(opening) ? opening : 0;
    const sfCurrent = Number.isFinite(currentLine) ? currentLine : 0;
    if (sfOpening > 0 && sfCurrent > 0 && Number.isFinite(sfOdds)) {
      const sfMove = direction === "OVER" ? (sfCurrent - sfOpening) : (sfOpening - sfCurrent);
      const sfImplied = p.impliedProb != null ? p.impliedProb : impliedProbFromOdds(sfOdds);
      if (sfImplied > 0.60 && sfMove < -0.5) {
        score -= 12;
        againstFactors.push(`📉 Sharp Resistance: Heavy public side but line moving against bet`);
      }
    }
  }

  // ── 14. PROCESS LAYERS (±19 pts) ─────────────────────────────────────────
  // Partial port of computeProcessLayerScores — omits pace (no teamStats),
  // injury multiplier (no live injury data), and per-minute fields (not in CSV).
  {
    const l5PctVal = pct(p.l5Pct);
    const l10PctVal = pct(p.l10Pct);
    const l20PctVal = pct(p.l20Pct);
    const l5AvgVal = parseFloat(String(p.l5Avg ?? ""));
    const l10AvgVal = parseFloat(String(p.l10Avg ?? ""));

    // Volume layer
    let volume = 50;
    if (Number.isFinite(l5AvgVal) && Number.isFinite(l10AvgVal) && l5AvgVal > 0 && l10AvgVal > 0) {
      volume += ((l5AvgVal / l10AvgVal) - 1) * 55;
    }
    volume = Math.max(5, Math.min(95, Math.round(volume)));

    // Quality layer
    let quality = 50;
    const scalar = parseFloat(String(p.matchup_scalar ?? ""));
    if (Number.isFinite(scalar)) quality += (scalar - 0.5) * 70;
    const conf = pct(p.confidence);
    if (conf != null) quality += (conf - 50) * 0.35;
    if (Number.isFinite(mu)) {
      if ((direction === "OVER" && mu <= 10) || (direction === "UNDER" && mu >= 22)) quality += 14;
      if ((direction === "OVER" && mu >= 22) || (direction === "UNDER" && mu <= 10)) quality -= 12;
    }
    if (p.isB2b && (league === "NBA" || league === "NHL")) quality -= 8;
    else {
      const dr = parseInt(String(p.daysRest ?? "")) || 0;
      if (dr >= 2) quality += 5;
    }
    quality = Math.max(5, Math.min(95, Math.round(quality)));

    // Conversion layer
    let conversion = 50;
    const hitParts: [number, number][] = [];
    if (l5PctVal != null)  hitParts.push([l5PctVal,  0.45]);
    if (l10PctVal != null) hitParts.push([l10PctVal, 0.35]);
    if (l20PctVal != null) hitParts.push([l20PctVal, 0.20]);
    if (hitParts.length) {
      const wSum = hitParts.reduce((s, [, w]) => s + w, 0);
      conversion = hitParts.reduce((s, [v, w]) => s + v * (w / wSum), 0);
    }
    if (Number.isFinite(l5AvgVal) && l5AvgVal > 0 && Number.isFinite(line) && line > 0) {
      const cushion2 = direction === "OVER" ? (l5AvgVal - line) / line : (line - l5AvgVal) / line;
      conversion += cushion2 * 35;
    }
    if (typeof p.streak === "number" && p.streak !== 0) {
      if      (p.streak >= 4) conversion += 4;
      else if (p.streak >= 3) conversion += 2;
      else if (p.streak <= -4) conversion -= 5;
      else if (p.streak <= -3) conversion -= 3;
    }
    conversion = Math.max(5, Math.min(95, Math.round(conversion)));

    const processIQ = Math.max(5, Math.min(95, Math.round(0.45 * volume + 0.35 * quality + 0.20 * conversion)));
    const processAdjust = Math.round((processIQ - 50) * 0.42);
    score += processAdjust;

    if (volume >= 72)  forFactors.push(`📊 Strong volume layer (${volume})`);
    else if (volume <= 38) againstFactors.push(`📊 Weak volume layer (${volume})`);
    if (quality >= 72) forFactors.push(`🎯 Strong context layer (${quality})`);
    else if (quality <= 38) againstFactors.push(`🎯 Weak context layer (${quality})`);
  }

  // ── 15. TRIPLE ALIGNMENT BONUS (+8 pts) ──────────────────────────────────
  if (
    Number.isFinite(edge) && edge >= 6 &&
    l10 != null && l10 >= 65 &&
    Number.isFinite(opening) && Number.isFinite(currentLine) &&
    currentLine >= opening && direction === "OVER"
  ) {
    score += 8;
    forFactors.push("🎯 Triple-Alignment: Vegas, Model & Momentum converged");
  }

  // ── 16. SAUCE HIT-RATE NUDGE (portable portion) ──────────────────────────
  // Mirrors the L5 vs L10 per-prop-type weighted nudge from computePropSauceLayer.
  {
    const l5Val = pct(p.l5Pct), l10Val = pct(p.l10Pct);
    if (l5Val != null && l10Val != null) {
      const profile = getSauceProfile(league, propTypeLower);
      const hitEdge = (l5Val - l10Val) / 100;
      const sauceAdd = Math.round(hitEdge * 12 * profile.hit);
      score += sauceAdd;
    }
  }

  // ── 17. PROPIQ REALISM GATES ──────────────────────────────────────────────
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

  // ── 18. KEY NUMBER PROXIMITY (−6 pts) ────────────────────────────────────
  const kLine = parseFloat(String(p.line ?? "")) || 0;
  if (kLine > 0) {
    let nearKey = false;
    if (league === "NBA" && /point|pts/.test(propTypeLower)) {
      nearKey = [14.5, 19.5, 24.5, 29.5, 34.5, 39.5].some(k => Math.abs(kLine - k) <= 0.3);
    } else if (league === "MLB" && /\bhit\b|rbi|\bhr\b|home.?run|stolen.?base/.test(propTypeLower)) {
      nearKey = [0.5, 1.5].some(k => Math.abs(kLine - k) <= 0.3);
    } else if (league === "NHL" && /goal|puck/.test(propTypeLower)) {
      nearKey = [0.5, 1.5].some(k => Math.abs(kLine - k) <= 0.3);
    }
    if (nearKey) {
      score -= 6;
      againstFactors.push(`🔢 Key Number Line (${kLine}): sharp boundary pricing, edge narrower`);
    }
  }

  // ── 19. REGRESSION PROTECTION (±12 pts) ──────────────────────────────────
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

  // ── 20. MULTI-LEAGUE REST DIFFERENTIAL (±6 pts) ──────────────────────────
  if (league !== "NBA") {
    const rdDays = parseInt(String(p.daysRest ?? "")) || 0;
    const rdIsB2b = p.isB2b || rdDays === 1;
    if (rdIsB2b) {
      score -= 6;
      againstFactors.push(`🔋 B2B Fatigue (${league}): volume suppression`);
    } else if (league === "NFL" && rdDays >= 10 && direction === "OVER") {
      score += 6;
      forFactors.push(`🏈 Bye-Week Freshness: ${rdDays}d rest, peak readiness`);
    } else if (rdDays >= 4 && /point|goal|strikeout|hit|yard/.test(propTypeLower) && direction === "OVER") {
      score += 3;
      forFactors.push(`💪 Extended Rest (${rdDays}d): volume-prop upside`);
    }
  }

  // ── 21. MARKET EFFICIENCY (+4 pts) ───────────────────────────────────────
  if (/\brebound\b|assist|\bsteal\b|\bblock\b|\b3pm\b|three.?point.?made|turnover/.test(propTypeLower)) {
    score += 4;
    forFactors.push(`📈 Soft Market: ${p.prop || p.stat || "prop"} pricing less efficient`);
  }

  // ── 22. HISTORICAL BASELINE (±5 pts) ─────────────────────────────────────
  const lastSznPct = parseFloat(String(p.lastSeasonPct ?? 0)) || 0;
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
