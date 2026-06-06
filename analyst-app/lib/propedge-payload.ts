import type { BoardProp, PropEdgeLlmPayload } from "./types";
import {
  calculateEdge,
  calculateImpliedProbability,
  isPropEdgePayloadSanityValid,
  kellyFromAmerican,
  parseAmericanOdds,
} from "./betting-math";
import { computePortablePropIq } from "./scoring";

function parseCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function parsePct(value: unknown): number | null {
  if (value == null || value === "") return null;
  const raw = String(value).replace("%", "").trim();
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return null;
  return n <= 1 ? n * 100 : n;
}

function clampNumber(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

const IMPLIED_DEVIG_FACTOR = 0.952;

function trueProbabilityFromProp(prop: BoardProp): number {
  const confRaw = parseFloat(String(prop.confidence ?? ""));
  const conf = Number.isFinite(confRaw) ? (confRaw <= 1 ? confRaw : confRaw / 100) : 0.5;
  const l5 = (parsePct(prop.l5Pct) || 50) / 100;
  const l10 = (parsePct(prop.l10Pct) || 50) / 100;
  const rawEdge = parseFloat(String(prop.edge ?? "")) || 0;
  const edgeSignal = clampNumber(Math.abs(rawEdge) <= 1 ? rawEdge : rawEdge / 100, -0.12, 0.18);
  const matchupScalar = Number.isFinite(parseFloat(String(prop.matchup_scalar ?? "")))
    ? parseFloat(String(prop.matchup_scalar))
    : 1;
  const matchupSignal = clampNumber((matchupScalar - 1) * 0.12, -0.04, 0.04);
  return clampNumber(
    conf * 0.36 + l5 * 0.28 + l10 * 0.2 + (0.5 + edgeSignal) * 0.12 + matchupSignal,
    0.05,
    0.95
  );
}

function estDateString(): string {
  try {
    return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export function parsePropFeedCsv(csv: string): BoardProp[] {
  const lines = csv.split("\n");
  if (lines.length < 2) return [];

  let headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim());
  const savedIdx = headers.indexOf("saved");
  if (savedIdx !== -1) headers = headers.filter((_, i) => i !== savedIdx);

  const col = (names: string[]) => headers.findIndex((h) => names.some((n) => h === n || h.includes(n)));

  const cols = {
    league: col(["league", "sport"]),
    team: col(["team"]),
    opponent: col(["opponent", "opp"]),
    pos: col(["pos", "position"]),
    player: col(["player", "name"]),
    prop: col(["prop", "market"]),
    l10Avg: headers.findIndex((h) => h === "l10 avg"),
    l5Avg: headers.findIndex((h) => h === "l5 avg"),
    odds: col(["odds"]),
    opening: headers.findIndex((h) => h.includes("opening") || h.includes("open")),
    l5: col(["l5"]),
    l10: col(["l10"]),
    l20: headers.findIndex((h) => h === "l20" || h === "l20%"),
    l30: headers.findIndex((h) => h === "l30" || h === "l30%"),
    season: headers.findIndex((h) => h.includes("25") || h.includes("2026") || h.includes("season")),
    h2h: col(["h2h"]),
    sznMatchup: headers.findIndex((h) => h.includes("szn") && h.includes("matchup")),
    confidence: headers.findIndex((h) => h.includes("confidence")),
    edge: headers.findIndex((h) => h === "edge"),
    modelScore: headers.findIndex((h) => h.includes("model") || h.includes("propiq") || h.includes("bet score")),
    matchup_scalar: headers.findIndex((h) => h.includes("matchup scalar")),
    pitcherEra: headers.findIndex((h) => h.includes("pitcher_era") || h.includes("pitcher era")),
    pitcherXera: headers.findIndex((h) => h.includes("pitcher_xera") || h.includes("xera")),
    daysRest: headers.findIndex((h) => h.includes("days_rest") || h.includes("days rest")),
    b2b: headers.findIndex((h) => h.includes("b2b") || h.includes("back_to_back")),
    streak: headers.findIndex((h) => h === "streak"),
    impliedProb: headers.findIndex((h) => h.includes("implied_prob") || h.includes("implied prob")),
    lastSeason: headers.findIndex((h) => h.includes("last_season") || h.includes("last season")),
  };

  const props: BoardProp[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length < 5) continue;
    const get = (idx: number) => (idx >= 0 && values[idx] ? values[idx].replace(/"/g, "").trim() : "");
    const player = get(cols.player);
    const propStr = get(cols.prop);
    if (!player || !propStr) continue;

    const lineMatch = propStr.match(/[ou]?([\d.]+)/i);
    const line = lineMatch ? parseFloat(lineMatch[1]) : 0;
    const propType = propStr.replace(/^[ou]?[\d.]+\s*/i, "").trim();
    const direction = propStr.toLowerCase().startsWith("u") ? "UNDER" : "OVER";

    props.push({
      league: get(cols.league).toUpperCase() || undefined,
      player,
      team: get(cols.team) || undefined,
      opponent: get(cols.opponent) || undefined,
      pos: get(cols.pos) || undefined,
      prop: propType,
      stat: propType,
      line,
      odds: get(cols.odds) || undefined,
      direction,
      l5Avg: parseFloat(get(cols.l5Avg)) || undefined,
      l10Avg: parseFloat(get(cols.l10Avg)) || undefined,
      l5Pct: get(cols.l5) || undefined,
      l10Pct: get(cols.l10) || undefined,
      l20Pct: get(cols.l20) || undefined,
      l30Pct: get(cols.l30) || undefined,
      seasonPct: get(cols.season) || undefined,
      pitcherERA: parseFloat(get(cols.pitcherEra)) || undefined,
      pitcherXERA: parseFloat(get(cols.pitcherXera)) || undefined,
      daysRest: parseFloat(get(cols.daysRest)) || undefined,
      isB2b: get(cols.b2b) === '1' || get(cols.b2b).toLowerCase() === 'true' || undefined,
      streak: parseFloat(get(cols.streak)) || undefined,
      impliedProb: parseFloat(get(cols.impliedProb)) || undefined,
      lastSeasonPct: get(cols.lastSeason) || undefined,
      opening: parseFloat(get(cols.opening)) || undefined,
      confidence: parseFloat(get(cols.confidence)) || undefined,
      edge: parseFloat(get(cols.edge)) || undefined,
      modelScore: parseFloat(get(cols.modelScore)) || undefined,
      sznMatchup: get(cols.sznMatchup) || undefined,
      h2h: get(cols.h2h) || undefined,
      matchup_scalar: parseFloat(get(cols.matchup_scalar)) || undefined,
    });
  }

  return props;
}

export function buildPropEdgeLlmPayload(prop: BoardProp): PropEdgeLlmPayload | null {
  if (!prop?.player) return null;

  const american = parseAmericanOdds(prop.odds ?? prop.over_odds);
  const impliedRaw = american != null ? calculateImpliedProbability(american) : null;
  const impliedDevig = impliedRaw != null ? impliedRaw * IMPLIED_DEVIG_FACTOR : null;
  const trueProb = trueProbabilityFromProp(prop);
  const evPct = trueProb != null && american != null ? calculateEdge(trueProb, american) : null;
  const kelly = trueProb != null && american != null ? kellyFromAmerican(trueProb, american) : null;
  const l10 = parsePct(prop.l10Pct);
  const iq = computePortablePropIq(prop);

  const payload: PropEdgeLlmPayload = {
    event: { date: estDateString(), home_team: null, away_team: prop.opponent || null },
    player: { name: prop.player, team: prop.team || null, position: prop.pos || prop.position || null },
    market: {
      prop_type: prop.prop || prop.stat || "Prop",
      line: prop.line ?? null,
      odds: american,
      implied_probability: impliedRaw != null ? Math.round(impliedRaw * 10000) / 10000 : null,
      implied_probability_devigged: impliedDevig != null ? Math.round(impliedDevig * 10000) / 10000 : null,
    },
    analytics: {
      hit_rate_last_5: parsePct(prop.l5Pct) != null ? Math.round(parsePct(prop.l5Pct)!) / 100 : null,
      hit_rate_last_10: l10 != null ? Math.round(l10) / 100 : null,
      hit_rate_last_20: parsePct(prop.l20Pct) != null ? Math.round(parsePct(prop.l20Pct)!) / 100 : null,
      hit_rate_last_30: parsePct(prop.l30Pct) != null ? Math.round(parsePct(prop.l30Pct)!) / 100 : null,
      season_hit_rate: parsePct(prop.seasonPct),
      ev_percentage: evPct,
      projected_value: prop.l10Avg ?? prop.l5Avg ?? null,
      kelly_units: kelly != null && kelly > 0 ? kelly : null,
      propiq_score: iq.score,
      propiq_for_factors: iq.forFactors.slice(0, 4),
      propiq_against_factors: iq.againstFactors.slice(0, 3),
      confidence: prop.confidence ?? null,
      board_edge_pct: prop.edge ?? null,
      pitcher_era: prop.pitcherERA ?? null,
      pitcher_xera: prop.pitcherXERA ?? null,
      back_to_back: prop.isB2b ?? null,
      days_rest: prop.daysRest ?? null,
    },
    matchup_context: {
      defensive_rank: prop.sznMatchup ?? null,
      h2h_history: prop.h2h ?? null,
    },
    league: prop.league,
  };

  if (Number.isFinite(prop.opening) && Number.isFinite(prop.line)) {
    payload.market.opening_line = prop.opening;
    payload.market.book_delta = Math.round((prop.line! - prop.opening!) * 100) / 100;
  }

  const propTypeLower = String(payload.market.prop_type).toLowerCase();
  if (/strikeout|strike out|\bk\b|\bks\b|pitcher strikeouts/.test(propTypeLower)) {
    const proj = parseFloat(String(prop.l10Avg ?? prop.l5Avg ?? prop.projected_ks ?? ""));
    if (Number.isFinite(proj)) payload.analytics.projected_ks = Math.round(proj * 10) / 10;
  }

  if (!isPropEdgePayloadSanityValid(payload)) return null;

  return payload;
}

export function sortPayloadsByEv(payloads: PropEdgeLlmPayload[]): PropEdgeLlmPayload[] {
  return [...payloads].sort(
    (a, b) => (b.analytics?.ev_percentage ?? -999) - (a.analytics?.ev_percentage ?? -999)
  );
}

export function buildPayloadsFromProps(props: BoardProp[], limit = 8): PropEdgeLlmPayload[] {
  return sortPayloadsByEv(
    props.map((p) => buildPropEdgeLlmPayload(p)).filter(Boolean) as PropEdgeLlmPayload[]
  ).slice(0, limit);
}
