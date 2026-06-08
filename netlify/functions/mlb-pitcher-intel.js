/**
 * MLB probable starters + season pitching stats (ESPN) for PropAI ev_detail.
 * GET /.netlify/functions/mlb-pitcher-intel?date=2026-05-31
 * POST body optional: { games: [{ away, home }] } to filter
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

const ESPN_SCOREBOARD = "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard";
const ESPN_ATHLETE_STATS = "https://site.web.api.espn.com/apis/common/v3/sports/baseball/mlb/athletes";
const TIMEOUT_MS = Number(process.env.MLB_PITCHER_INTEL_TIMEOUT_MS || 8000);
const CACHE_TTL_MS = 4 * 60 * 60 * 1000;

let cache = { day: "", games: [], fetchedAt: 0 };

function json(statusCode, body) {
  return { statusCode, headers: CORS_HEADERS, body: JSON.stringify(body) };
}

function estDateString() {
  try {
    return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function espnDateParam(isoDate) {
  return String(isoDate || estDateString()).replace(/-/g, "");
}

function normAbbr(v) {
  return String(v || "").trim().toUpperCase();
}

async function fetchJson(url, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "PropEdgeMasters/1.0 mlb-pitcher-intel" },
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return JSON.parse(text);
  } finally {
    clearTimeout(timer);
  }
}

function pickStatValue(statsBlock, names) {
  const list = statsBlock?.splits?.[0]?.stats || statsBlock?.statistics || statsBlock || [];
  const arr = Array.isArray(list) ? list : [];
  for (const name of names) {
    const hit = arr.find((s) => {
      const n = String(s?.name || s?.abbreviation || s?.displayName || "").toLowerCase();
      return n === name.toLowerCase() || n.includes(name.toLowerCase());
    });
    if (hit != null) {
      const v = hit.value ?? hit.displayValue;
      const num = parseFloat(String(v).replace(/[^\d.-]/g, ""));
      if (Number.isFinite(num)) return num;
      return v;
    }
  }
  return null;
}

async function fetchPitcherProfile(athleteId, athleteName) {
  if (!athleteId) return { name: athleteName || null };
  try {
    const data = await fetchJson(
      `${ESPN_ATHLETE_STATS}/${athleteId}/stats?region=us&lang=en&contentorigin=espn`,
      5000
    );
    const season = (data?.statistics || []).find((s) => /season|202\d/i.test(String(s?.displayName || s?.name || "")))
      || data?.statistics?.[0];
    const block = season?.splits?.find((sp) => /season|total/i.test(String(sp?.displayName || sp?.type || "")))
      || season?.splits?.[0];
    const stats = block?.stats || season?.stats || [];
    const get = (keys) => {
      for (const k of keys) {
        const row = stats.find((s) => String(s?.name || s?.abbreviation || "").toLowerCase().includes(k));
        if (row) {
          const raw = row.value ?? row.displayValue;
          const n = parseFloat(String(raw).replace(/[^\d.-]/g, ""));
          return Number.isFinite(n) ? n : raw;
        }
      }
      return null;
    };
    return {
      name: data?.athlete?.displayName || athleteName || null,
      era: get(["era"]),
      fip: get(["fip"]),
      whip: get(["whip"]),
      k9: get(["k/9", "k9", "strikeoutsper9"]),
      hr9: get(["hr/9", "hr9"]),
      ip: get(["innings", "ip"]),
      strikeouts: get(["strikeouts", "so"]),
      walks: get(["walks", "bb"]),
    };
  } catch (err) {
    return { name: athleteName || null, _error: err.message };
  }
}

function extractProbable(competitor) {
  const probables = competitor?.probables || competitor?.probablePitchers || [];
  if (Array.isArray(probables) && probables.length) {
    const p = probables.find((x) => /starter|sp/i.test(String(x?.abbreviation || x?.position || ""))) || probables[0];
    const athlete = p?.athlete || p?.player || p;
    return {
      id: athlete?.id,
      name: athlete?.displayName || athlete?.shortName || athlete?.fullName || null,
    };
  }
  const athlete = competitor?.starter?.athlete || competitor?.starter;
  if (athlete?.id || athlete?.displayName) {
    return { id: athlete.id, name: athlete.displayName || athlete.shortName };
  }
  return null;
}

async function buildGameIntel(event) {
  const comp = event?.competitions?.[0];
  if (!comp) return null;
  const home = comp.competitors?.find((c) => c.homeAway === "home");
  const away = comp.competitors?.find((c) => c.homeAway === "away");
  if (!home || !away) return null;
  const awayAbbr = normAbbr(away.team?.abbreviation);
  const homeAbbr = normAbbr(home.team?.abbreviation);
  const awayProb = extractProbable(away);
  const homeProb = extractProbable(home);
  const [awayPitcher, homePitcher] = await Promise.all([
    fetchPitcherProfile(awayProb?.id, awayProb?.name),
    fetchPitcherProfile(homeProb?.id, homeProb?.name),
  ]);
  return {
    event_id: event.id,
    away: normAbbr(away.team?.abbreviation),
    home: homeAbbr,
    away_name: away.team?.displayName || awayAbbr,
    home_name: home.team?.displayName || homeAbbr,
    game_time: event.date || comp.date || null,
    status: event.status?.type?.description || event.status?.type?.name || "scheduled",
    away_pitcher: awayPitcher,
    home_pitcher: homePitcher,
  };
}

function matchGameFilter(game, filterSet) {
  if (!filterSet || !filterSet.size) return true;
  const key = `${normAbbr(game.away)}@${normAbbr(game.home)}`;
  return filterSet.has(key);
}

exports.handler = async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  let body = {};
  try {
    if (event.body) body = JSON.parse(event.body);
  } catch (_) {}

  const qs = event.queryStringParameters || {};
  const day = qs.date || body.date || estDateString();
  const refresh = String(qs.refresh || "0") === "1";

  let filterSet = null;
  const gamesIn = Array.isArray(body.games) ? body.games : [];
  if (gamesIn.length) {
    filterSet = new Set(
      gamesIn.map((g) => `${normAbbr(g.away || g.awayTeam)}@${normAbbr(g.home || g.homeTeam)}`)
    );
  }

  if (!refresh && cache.day === day && cache.games.length && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    const filtered = filterSet
      ? cache.games.filter((g) => matchGameFilter(g, filterSet))
      : cache.games;
    return json(200, { ok: true, cache: "hit", day, games: filtered });
  }

  try {
    const url = `${ESPN_SCOREBOARD}?dates=${espnDateParam(day)}&limit=50`;
    const data = await fetchJson(url);
    const events = (data?.events || []).slice(0, 16);
    const built = [];
    for (const ev of events) {
      const row = await buildGameIntel(ev);
      if (row && matchGameFilter(row, filterSet)) built.push(row);
    }
    cache = { day, games: built, fetchedAt: Date.now() };
    return json(200, { ok: true, cache: "miss", day, games: built });
  } catch (err) {
    if (cache.games.length) {
      return json(200, { ok: true, cache: "stale", day, games: cache.games, warning: err.message });
    }
    return json(200, { ok: false, error: err.message, games: [] });
  }
};
