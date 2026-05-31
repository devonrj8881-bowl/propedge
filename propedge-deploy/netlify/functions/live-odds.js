const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
};

const API_BASE = "https://api.sportsgameodds.com/v2";
const BOOK_PRIORITY = ["fanduel", "draftkings", "betmgm", "caesars", "espnbet", "pointsbet", "bovada"];
const LEAGUES = new Set(["NBA", "MLB", "NHL", "NFL"]);

// The Odds API fallback
const THE_ODDS_API_BASE = "https://api.the-odds-api.com/v4";
const THE_ODDS_SPORT_KEYS = {
  NBA: "basketball_nba",
  MLB: "baseball_mlb",
  NHL: "icehockey_nhl",
};
const THE_ODDS_MARKETS = {
  NBA: "player_points,player_rebounds,player_assists,player_threes,player_blocks,player_steals",
  MLB: "batter_hits,pitcher_strikeouts,batter_home_runs,batter_rbis,batter_total_bases",
  NHL: "player_shots_on_goal,player_goals",
};

async function fetchFromTheOddsAPI(leagues, apiKey) {
  const lines = {};

  for (const league of leagues) {
    const sportKey = THE_ODDS_SPORT_KEYS[league];
    const markets = THE_ODDS_MARKETS[league];
    if (!sportKey || !markets) continue;

    try {
      // Step 1: get today's event IDs
      const eventsUrl = `${THE_ODDS_API_BASE}/sports/${sportKey}/events?apiKey=${apiKey}`;
      const evRes = await fetch(eventsUrl, { signal: AbortSignal.timeout(6000) });
      if (!evRes.ok) { console.warn(`[TheOddsAPI] ${league} events HTTP ${evRes.status}`); continue; }
      const events = await evRes.json();
      if (!Array.isArray(events) || !events.length) continue;

      // Filter to today only, cap at 8 events to protect quota
      const todayStr = new Date().toISOString().slice(0, 10);
      const todayEvents = events
        .filter(ev => (ev.commence_time || "").startsWith(todayStr))
        .slice(0, 8);

      if (!todayEvents.length) { console.log(`[TheOddsAPI] ${league} no events today`); continue; }
      console.log(`[TheOddsAPI] ${league} fetching props for ${todayEvents.length} events`);

      // Step 2: fetch player props per event
      for (const ev of todayEvents) {
        try {
          // No bookmakers filter — fetch all US books, then pick best by priority
          const oddsUrl = `${THE_ODDS_API_BASE}/sports/${sportKey}/events/${ev.id}/odds?apiKey=${apiKey}&regions=us&markets=${markets}&oddsFormat=american`;
          const r = await fetch(oddsUrl, { signal: AbortSignal.timeout(6000) });
          if (!r.ok) {
            const errText = await r.text().catch(() => '');
            console.warn(`[TheOddsAPI] event ${ev.id} HTTP ${r.status}: ${errText.slice(0, 200)}`);
            continue;
          }
          const data = await r.json();
          console.log(`[TheOddsAPI] event ${ev.id} bookmakers: ${(data.bookmakers||[]).map(b=>b.key).join(',') || 'none'}`);
          // Pick best available book by priority order
          const availableBooks = data.bookmakers || [];
          const bestBook = BOOK_PRIORITY.map(bk => availableBooks.find(b => b.key === bk)).find(Boolean);
          if (!bestBook) continue;
          const bookKey = bestBook.key;

          for (const mkt of bestBook.markets || []) {
            const byPlayer = {};
            for (const o of mkt.outcomes || []) {
              // Player props: description = player name, name = Over/Under
              const player = normalizeName(o.description || "");
              if (!player) continue;
              const side = String(o.name || "").toUpperCase();
              if (side !== "OVER" && side !== "UNDER") continue;
              if (!byPlayer[player]) byPlayer[player] = {};
              byPlayer[player][side] = { line: o.point, odds: o.price };
            }
            for (const [player, sides] of Object.entries(byPlayer)) {
              if (!sides.OVER && !sides.UNDER) continue;
              const key = `${player}|${mkt.key}`;
              if (!lines[key]) lines[key] = { books: {}, source: "the-odds-api" };
              lines[key].books[bookKey] = sides;
            }
          }
        } catch (evErr) {
          console.warn(`[TheOddsAPI] event ${ev.id} error:`, evErr.message);
        }
      }
    } catch (e) {
      console.warn(`[TheOddsAPI] ${league} error:`, e.message);
    }
  }

  console.log(`[TheOddsAPI] Total prop lines fetched: ${Object.keys(lines).length}`);
  return lines;
}

function json(statusCode, body) {
  return { statusCode, headers: CORS_HEADERS, body: JSON.stringify(body) };
}

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s.'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inferAliases(statID, marketName) {
  const stat = String(statID || "").toLowerCase();
  const market = String(marketName || "").toLowerCase();
  const aliases = new Set();

  if (stat.includes("points") || /\bpoints\b/.test(market)) aliases.add("points").add("pts");
  if (stat.includes("rebounds") || /\brebounds?\b/.test(market)) aliases.add("rebounds").add("rebs").add("reb");
  if (stat.includes("assists") || /\bassists?\b/.test(market)) aliases.add("assists").add("ast");
  if (stat.includes("three") || stat.includes("3") || market.includes("3-pointer")) aliases.add("3-pointers").add("threes").add("3pt");
  if (stat.includes("blocks")) aliases.add("blocks").add("blk");
  if (stat.includes("steals")) aliases.add("steals").add("stl");
  if (stat.includes("strikeout") || market.includes("strikeout")) aliases.add("strikeouts").add("ks").add("k");
  if (stat.includes("rbi") || market.includes("runs batted in")) aliases.add("rbis").add("rbi");
  if (stat.includes("hits") || /\bhits?\b/.test(market)) aliases.add("hits");
  if (stat.includes("total_bases") || market.includes("total bases")) aliases.add("total bases").add("tb");
  if (stat.includes("home_runs") || market.includes("home run")) aliases.add("home runs").add("hr").add("hrs");
  if (stat.includes("shots") || market.includes("shots on goal")) aliases.add("shots on goal").add("shots").add("sog");
  if (stat.includes("goals") || /\bgoals?\b/.test(market)) aliases.add("goals");
  if (stat.includes("saves")) aliases.add("saves");

  if (aliases.size === 0) {
    const stripped = market
      .replace(/ over\/under| yes\/no/gi, "")
      .replace(/[a-z.'-]+ [a-z.'-]+/i, "")
      .trim();
    if (stripped) aliases.add(stripped);
  }

  return Array.from(aliases);
}

function pickBook(byBookmaker, preferredBook) {
  if (!byBookmaker || typeof byBookmaker !== "object") return null;
  const books = preferredBook
    ? [preferredBook.toLowerCase(), ...BOOK_PRIORITY.filter((b) => b !== preferredBook.toLowerCase())]
    : BOOK_PRIORITY;

  for (const book of books) {
    const row = byBookmaker[book];
    if (row && row.available !== false) return { book, ...row };
  }

  const fallback = Object.entries(byBookmaker).find(([, row]) => row && row.available !== false);
  return fallback ? { book: fallback[0], ...fallback[1] } : null;
}

function addLine(lines, key, value) {
  if (!key || !value || !value.line) return;
  const existing = lines[key];
  if (!existing || value.fromBook === "fanduel" || (existing.fromBook !== "fanduel" && value.updatedAt > existing.updatedAt)) {
    lines[key] = value;
  }
}

function normalizeEvent(event, preferredBook) {
  const players = event.players || {};
  const lines = {};
  const rows = [];

  for (const odd of Object.values(event.odds || {})) {
    const player = players[odd.statEntityID];
    if (!player || !["over", "under", "yes", "no"].includes(String(odd.sideID || "").toLowerCase())) continue;

    const book = pickBook(odd.byBookmaker, preferredBook);
    const line = book?.overUnder || book?.line || odd.overUnder || "0.5";
    const aliases = inferAliases(odd.statID, odd.marketName);
    const playerName = player.name || `${player.firstName || ""} ${player.lastName || ""}`.trim();
    const playerKey = normalizeName(playerName);
    const side = String(odd.sideID || "").toLowerCase();
    const oddsValue = book?.odds || odd.bookOdds || "";
    const updatedAt = book?.lastUpdatedAt || event.status?.startsAt || event.status?.updatedAt || new Date().toISOString();

    for (const alias of aliases) {
      const key = `${playerKey}|${alias}`;
      const prior = lines[key] || {
        player: playerName,
        propType: alias,
        line: parseFloat(line),
        sport: event.leagueID,
        league: event.leagueID,
        eventID: event.eventID,
        game: `${event.teams?.away?.names?.short || ""}@${event.teams?.home?.names?.short || ""}`,
        fromLive: true,
        fromBook: book?.book || "consensus",
        updatedAt,
        books: {},
        fairOdds: odd.fairOdds || "",
      };

      if (side === "over" || side === "yes") prior.overOdds = parseInt(String(oddsValue).replace("+", ""), 10) || oddsValue;
      if (side === "under" || side === "no") prior.underOdds = parseInt(String(oddsValue).replace("+", ""), 10) || oddsValue;
      if (book?.book) prior.books[book.book] = { odds: oddsValue, line: parseFloat(line), updatedAt, deeplink: book.deeplink || "" };
      addLine(lines, key, prior);
    }

    rows.push({
      player: playerName,
      marketName: odd.marketName,
      statID: odd.statID,
      sideID: side,
      line: parseFloat(line),
      odds: oddsValue,
      fairOdds: odd.fairOdds || "",
      book: book?.book || "consensus",
      updatedAt,
    });
  }

  return {
    eventID: event.eventID,
    league: event.leagueID,
    status: event.status || {},
    startsAt: event.status?.startsAt,
    teams: event.teams || {},
    rows,
    lines,
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });

  const apiKey = process.env.SPORTSGAME_ODDS_API_KEY || process.env.SPORTSGAMEODDS_API_KEY;
  const theOddsApiKey = process.env.THE_ODDS_API_KEY || process.env.ODDS_API_KEY || process.env.THEODDSAPI_KEY || process.env.THE_ODDS_KEY || "";
  // Debug: log which key prefix is in use (safe — first 8 chars only)
  console.log(`[live-odds] TheOddsAPI key: ${theOddsApiKey ? theOddsApiKey.slice(0,8) + '...' : 'NOT SET'} | env vars present: THE_ODDS_API_KEY=${!!process.env.THE_ODDS_API_KEY} ODDS_API_KEY=${!!process.env.ODDS_API_KEY}`);
  if (!apiKey && !theOddsApiKey) return json(500, { success: false, error: "No odds API key configured" });

  const params = event.queryStringParameters || {};
  const league = String(params.league || "NBA,MLB,NHL").toUpperCase();
  const leagues = league
    .split(",")
    .map((l) => l.trim())
    .filter((l) => LEAGUES.has(l));
  const limit = Math.max(1, Math.min(parseInt(params.limit || "25", 10) || 25, 60));
  const book = String(params.book || "fanduel").toLowerCase();

  // If SportsGameOdds key missing, go straight to TheOddsAPI
  if (!apiKey && theOddsApiKey) {
    console.log('[live-odds] No SportsGameOdds key — using TheOddsAPI directly');
    try {
      const fallbackLines = await fetchFromTheOddsAPI(leagues.length ? leagues : ['NBA','MLB','NHL'], theOddsApiKey);
      return json(200, { success: true, provider: 'the-odds-api', lines: fallbackLines, count: Object.keys(fallbackLines).length, events: [] });
    } catch (e) {
      return json(200, { success: false, lines: {}, count: 0, error: e.message });
    }
  }

  const url = new URL(`${API_BASE}/events`);
  url.searchParams.set("leagueID", leagues.length ? leagues.join(",") : "NBA,MLB,NHL");
  url.searchParams.set("oddsAvailable", "true");
  url.searchParams.set("limit", String(limit));

  try {
    const response = await fetch(url, {
      headers: {
        "x-api-key": apiKey,
        "User-Agent": "PropEdgeMasters/1.0",
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.success === false) {
      const isRateLimit = response.status === 429 || /rate limit/i.test(payload.error || '');
      if (isRateLimit && theOddsApiKey) {
        console.warn('[live-odds] SportsGameOdds rate limited — falling back to TheOddsAPI');
        try {
          const fallbackLines = await fetchFromTheOddsAPI(leagues, theOddsApiKey);
          const count = Object.keys(fallbackLines).length;
          console.log(`[TheOddsAPI] Fallback returned ${count} prop lines`);
          return json(200, { success: true, provider: 'the-odds-api', lines: fallbackLines, count, events: [] });
        } catch (fbErr) {
          console.warn('[TheOddsAPI] Fallback also failed:', fbErr.message);
          return json(200, { success: false, rateLimited: true, lines: {}, events: [], count: 0, error: 'Both SportsGameOdds and TheOddsAPI unavailable' });
        }
      }
      return json(200, { success: false, lines: {}, events: [], count: 0, error: payload.error || `SportsGameOdds HTTP ${response.status}` });
    }

    const normalizedEvents = (payload.data || []).map((ev) => normalizeEvent(ev, book));
    const lines = normalizedEvents.reduce((acc, ev) => Object.assign(acc, ev.lines), {});

    return json(200, {
      success: true,
      generatedAt: new Date().toISOString(),
      league: leagues.length ? leagues.join(",") : "NBA,MLB,NHL",
      count: Object.keys(lines).length,
      events: normalizedEvents.map(({ lines: _lines, ...rest }) => rest),
      lines,
    });
  } catch (err) {
    console.warn('[live-odds] fetch error:', err.message);
    return json(200, { success: false, lines: {}, events: [], count: 0, error: err.message || "SportsGameOdds request failed" });
  }
};
