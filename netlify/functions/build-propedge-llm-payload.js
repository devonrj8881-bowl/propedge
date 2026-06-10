const {
  calculateImpliedProbability,
  calculateEdge,
  kellyFromAmerican,
  parseAmericanOdds,
  isPropEdgePayloadSanityValid,
} = require("./betting-math");

const IMPLIED_DEVIG_FACTOR = 0.952;

function clampNumber(n, min, max) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function parsePct(value) {
  if (value == null || value === "") return null;
  const raw = String(value).replace("%", "").trim();
  const n = parseFloat(raw);
  return Number.isFinite(n) ? (n <= 1 ? n * 100 : n) : null;
}

function trueProbabilityFromProp(prop) {
  const raw = parseFloat(prop?.trueProb ?? prop?.modelProb ?? prop?.model_prob);
  if (Number.isFinite(raw)) return raw <= 1 ? raw : raw / 100;

  const confRaw = parseFloat(prop?.confidence);
  const conf = Number.isFinite(confRaw) ? (confRaw <= 1 ? confRaw : confRaw / 100) : 0.5;
  const l5 = (parsePct(prop?.l5_hit_rate ?? prop?.l5Pct) || 50) / 100;
  const l10 = (parsePct(prop?.l10_hit_rate ?? prop?.l10Pct) || 50) / 100;
  const rawEdge = parseFloat(prop?.edge ?? prop?.model_edge) || 0;
  const edgeSignal = clampNumber(typeof rawEdge === "number" && Math.abs(rawEdge) <= 1 ? rawEdge : rawEdge / 100, -0.12, 0.18);
  const matchupScalar = Number.isFinite(parseFloat(prop?.matchup_scalar ?? prop?.matchupScalar))
    ? parseFloat(prop.matchup_scalar ?? prop.matchupScalar)
    : 1;
  const matchupSignal = clampNumber((matchupScalar - 1) * 0.12, -0.04, 0.04);
  return clampNumber(
    conf * 0.36 + l5 * 0.28 + l10 * 0.2 + (0.5 + edgeSignal) * 0.12 + matchupSignal,
    0.05,
    0.95
  );
}

function pickMarketOdds(prop) {
  const line = parseFloat(prop?.line ?? prop?.market?.line);
  const over = parseAmericanOdds(prop?.over_odds ?? prop?.odds ?? prop?.live_odds?.odds ?? prop?.market?.odds);
  const under = parseAmericanOdds(prop?.under_odds);
  if (over == null && under == null) return null;
  const dir = String(prop?.direction || prop?.action || "").toLowerCase();
  const useUnder = dir.includes("under") || dir === "u";
  const primary = useUnder && under != null ? under : over ?? under;
  return { overOdds: over ?? primary, underOdds: under ?? primary, line: Number.isFinite(line) ? line : null };
}

function normalizePropType(prop) {
  return (
    prop?.market?.prop_type ||
    prop?.market ||
    prop?.statType ||
    prop?.stat_type ||
    prop?.prop ||
    prop?.stat ||
    "Prop"
  );
}

function estDateString() {
  try {
    return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function buildPropEdgeLlmPayload(prop, ctx = {}) {
  if (!prop || typeof prop !== "object") return null;

  const marketOdds = pickMarketOdds(prop);
  const american = marketOdds
    ? (String(prop?.direction || "").toLowerCase().includes("under") && marketOdds.underOdds != null
        ? marketOdds.underOdds
        : marketOdds.overOdds)
    : null;

  const impliedRaw = american != null ? calculateImpliedProbability(american) : null;
  const impliedDevig = impliedRaw != null ? impliedRaw * IMPLIED_DEVIG_FACTOR : null;
  const trueProb = trueProbabilityFromProp(prop);
  const evPct = trueProb != null && american != null ? calculateEdge(trueProb, american) : null;
  const kelly = trueProb != null && american != null ? kellyFromAmerican(trueProb, american) : null;

  const l10 = parsePct(prop?.l10_hit_rate ?? prop?.l10Pct);
  const hitRateL10 = l10 != null ? Math.round(l10) / 100 : null;

  const game = ctx.game || {};
  const event = {
    date: game.date || prop.game_date || estDateString(),
    home_team: game.home_team || game.homeTeam || prop.home_team || null,
    away_team: game.away_team || game.awayTeam || prop.away_team || null,
  };

  const payload = {
    event,
    player: {
      name: prop.player || prop.playerName || "Unknown",
      team: prop.team || null,
      position: prop.pos || prop.position || null,
    },
    market: {
      prop_type: normalizePropType(prop),
      line: marketOdds?.line ?? parseFloat(prop?.line) ?? null,
      odds: american,
      implied_probability: impliedRaw != null ? Math.round(impliedRaw * 10000) / 10000 : null,
      implied_probability_devigged:
        impliedDevig != null ? Math.round(impliedDevig * 10000) / 10000 : null,
    },
    analytics: {
      hit_rate_last_10: hitRateL10,
      ev_percentage: evPct,
      projected_value: prop.l10Avg ?? prop.l5Avg ?? prop.recent_avg ?? prop.trends?.recent_avg ?? null,
      kelly_units: kelly > 0 ? kelly : null,
      propiq_score: prop.prop_iq_score ?? prop.modelScore ?? prop.betScore ?? null,
      confidence: prop.confidence ?? null,
      board_edge_pct: prop.edge ?? prop.model_edge ?? null,
      l5_hit_rate: parsePct(prop?.l5_hit_rate ?? prop?.l5Pct),
      season_hit_rate: parsePct(prop?.season_hit_rate ?? prop?.seasonPct),
    },
    matchup_context: {
      defensive_rank: prop.defensive_rank ?? prop.sznMatchup ?? prop.matchup?.defensive_rank ?? null,
      matchup_rank: prop.matchup_rank ?? prop.matchup?.matchup_rank ?? null,
      h2h_history: prop.h2h_history ?? prop.h2h ?? prop.matchup?.h2h_history ?? null,
      vs_opponent_hit_rate: prop.vs_opponent_hit_rate ?? prop.matchup?.vs_opponent_hit_rate ?? null,
    },
  };

  const opening = parseFloat(prop.opening ?? prop.opening_line);
  const currentLine = parseFloat(prop.line ?? marketOdds?.line);
  if (Number.isFinite(opening) && Number.isFinite(currentLine)) {
    payload.market.opening_line = opening;
    payload.market.book_delta = Math.round((currentLine - opening) * 100) / 100;
  }
  if (prop.live_odds?.book || prop.live_book) {
    payload.market.live_book = prop.live_odds?.book || prop.live_book;
  }

  const propTypeLower = String(payload.market.prop_type || "").toLowerCase();
  if (/strikeout|strike out|\bk\b|\bks\b|pitcher strikeouts/.test(propTypeLower)) {
    const proj = parseFloat(prop.l10Avg ?? prop.l5Avg ?? prop.projected_ks ?? prop.analytics?.projected_value);
    if (Number.isFinite(proj)) payload.analytics.projected_ks = Math.round(proj * 10) / 10;
  }

  if (!isPropEdgePayloadSanityValid(payload)) return null;

  return payload;
}

function gameFromSlate(prop, slateGames) {
  const team = String(prop?.team || "").toUpperCase();
  const league = prop?.league;
  const games = Array.isArray(slateGames) ? slateGames : [];
  const match = games.find((g) => {
    if (league && g.league && g.league !== league) return false;
    const home = String(g.home || g.homeTeam || "").toUpperCase();
    const away = String(g.away || g.awayTeam || "").toUpperCase();
    return home === team || away === team;
  });
  if (!match) return {};
  return {
    date: estDateString(),
    home_team: match.home || match.homeTeam,
    away_team: match.away || match.awayTeam,
  };
}

function buildPayloadsFromAnalystBody(body, limit = 8) {
  const slate = body?.slate_games || [];
  if (Array.isArray(body?.propedge_payloads) && body.propedge_payloads.length) {
    return body.propedge_payloads.slice(0, limit);
  }

  let picks = [];
  const bundlePicks = body?.intelligence_bundle?.picks;
  if (Array.isArray(bundlePicks) && bundlePicks.length) {
    picks = bundlePicks;
  } else if (Array.isArray(body?.props) && body.props.length) {
    picks = body.props;
  }

  return picks
    .slice(0, limit)
    .map((p) => buildPropEdgeLlmPayload(p, { game: gameFromSlate(p, slate) }))
    .filter(Boolean);
}

function sortPayloadsByEv(payloads) {
  return [...payloads].sort((a, b) => {
    const evA = a?.analytics?.ev_percentage ?? -999;
    const evB = b?.analytics?.ev_percentage ?? -999;
    return evB - evA;
  });
}

module.exports = {
  buildPropEdgeLlmPayload,
  buildPayloadsFromAnalystBody,
  sortPayloadsByEv,
  trueProbabilityFromProp,
};
