// game-filter.js — Returns active teams playing today from ESPN scoreboard
// Called by the client after props load to filter out stale/eliminated team props

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "public, max-age=300",
};

const SLATE_TIMEZONE = "America/New_York";

const ESPN_ENDPOINTS = {
  NBA:  "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard",
  MLB:  "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard",
  NHL:  "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard",
  NFL:  "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard",
  WNBA: "https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/scoreboard",
};

const ABBR_MAP = {
  WSH: "WAS",
  JAX: "JAC",
  NOS: "NOP",
  KCK: "KC",
  // NBA short abbreviations ESPN returns for some teams
  NY:  "NYK",
  SA:  "SAS",
  GS:  "GSW",
  NO:  "NOP",
  PHX: "PHX",
  // NFL
  LAR: "LAR",
};

function normalizeAbbr(abbr) {
  if (!abbr) return abbr;
  const up = String(abbr).toUpperCase();
  return ABBR_MAP[up] || up;
}

function slateDateParts(timeZone = SLATE_TIMEZONE) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type)?.value || "";
  const yyyy = get("year");
  const mm = get("month");
  const dd = get("day");
  return {
    iso: `${yyyy}-${mm}-${dd}`,
    espn: `${yyyy}${mm}${dd}`,
    display: `${Number(mm)}/${Number(dd)}/${yyyy}`,
    timezone: timeZone,
  };
}

async function fetchLeague(league, url, espnDate) {
  try {
    const scoreboardUrl = `${url}${url.includes("?") ? "&" : "?"}dates=${espnDate}`;
    const res = await fetch(scoreboardUrl, {
      headers: { "User-Agent": "PropEdge/1.0" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { league, teams: [], games: [] };
    const data = await res.json();

    const teams = new Set();
    const games = [];

    for (const event of data.events || []) {
      const comp = event.competitions?.[0];
      if (!comp) continue;

      const status = comp.status?.type?.state || "pre";
      const completed = comp.status?.type?.completed === true;
      const gameId = event.id;
      const gameLabel = event.name || event.shortName || "";
      const gameDate = event.date || "";

      const homeTeam = comp.competitors?.find((c) => c.homeAway === "home");
      const awayTeam = comp.competitors?.find((c) => c.homeAway === "away");
      const homeAbbr = normalizeAbbr(homeTeam?.team?.abbreviation);
      const awayAbbr = normalizeAbbr(awayTeam?.team?.abbreviation);

      const seriesNote = comp.series?.summary || null;
      const isSeries = !!comp.series;

      if (homeAbbr) teams.add(homeAbbr);
      if (awayAbbr) teams.add(awayAbbr);

      games.push({
        id: gameId,
        league,
        home: homeAbbr,
        away: awayAbbr,
        label: gameLabel,
        date: gameDate,
        status,
        completed,
        seriesNote,
        isSeries,
      });
    }

    return { league, teams: Array.from(teams), games };
  } catch (err) {
    console.warn(`[game-filter] ${league} fetch failed:`, err.message);
    return { league, teams: [], games: [], error: err.message };
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }

  const params = event.queryStringParameters || {};
  const slate = slateDateParts(params.tz || SLATE_TIMEZONE);
  const espnDate = String(params.date || slate.espn).replace(/\D/g, "").slice(0, 8);

  const requested = params.leagues;
  const leagues = requested
    ? requested.toUpperCase().split(",").filter((l) => ESPN_ENDPOINTS[l])
    : Object.keys(ESPN_ENDPOINTS);

  const results = await Promise.all(
    leagues.map((league) => fetchLeague(league, ESPN_ENDPOINTS[league], espnDate))
  );

  const activeTeams = {};
  const allGames = [];
  const errors = {};

  for (const r of results) {
    activeTeams[r.league] = r.teams;
    allGames.push(...(r.games || []));
    if (r.error) errors[r.league] = r.error;
  }

  const allActiveTeams = [...new Set(Object.values(activeTeams).flat())];

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({
      ok: true,
      date: slate.iso,
      dateDisplay: slate.display,
      espnDate,
      timezone: slate.timezone,
      activeTeams,
      allActiveTeams,
      games: allGames,
      errors: Object.keys(errors).length ? errors : undefined,
    }),
  };
};
