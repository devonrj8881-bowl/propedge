/**
 * game-odds.js — Fetches game-level betting lines from The Odds API
 *
 * Markets: h2h (ML), spreads, totals, alternate_totals,
 *          alternate_spreads, totals_h1 (1H), totals_q1 (1Q)
 * Bookmaker: DraftKings preferred, fallback to any US book
 *
 * GET /.netlify/functions/game-odds?leagues=NBA,WNBA,MLB
 * GET /.netlify/functions/game-odds?leagues=NBA&alt=true
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "public, max-age=300",
};

const SPORT_KEYS = {
  NBA:  "basketball_nba",
  WNBA: "basketball_wnba",
  MLB:  "baseball_mlb",
  NHL:  "icehockey_nhl",
  NFL:  "americanfootball_nfl",
};

// Full team name → PropFinder abbreviation
const TEAM_ABBR = {
  // NBA
  "Atlanta Hawks": "ATL", "Boston Celtics": "BOS", "Brooklyn Nets": "BKN",
  "Charlotte Hornets": "CHA", "Chicago Bulls": "CHI", "Cleveland Cavaliers": "CLE",
  "Dallas Mavericks": "DAL", "Denver Nuggets": "DEN", "Detroit Pistons": "DET",
  "Golden State Warriors": "GSW", "Houston Rockets": "HOU", "Indiana Pacers": "IND",
  "LA Clippers": "LAC", "Los Angeles Clippers": "LAC", "Los Angeles Lakers": "LAL",
  "Memphis Grizzlies": "MEM", "Miami Heat": "MIA", "Milwaukee Bucks": "MIL",
  "Minnesota Timberwolves": "MIN", "New Orleans Pelicans": "NOP",
  "New York Knicks": "NYK", "Oklahoma City Thunder": "OKC", "Orlando Magic": "ORL",
  "Philadelphia 76ers": "PHI", "Phoenix Suns": "PHX", "Portland Trail Blazers": "POR",
  "Sacramento Kings": "SAC", "San Antonio Spurs": "SAS", "Toronto Raptors": "TOR",
  "Utah Jazz": "UTA", "Washington Wizards": "WAS",
  // WNBA
  "Atlanta Dream": "ATL", "Chicago Sky": "CHI", "Connecticut Sun": "CON",
  "Dallas Wings": "DAL", "Golden State Valkyries": "GSV", "Indiana Fever": "IND",
  "Las Vegas Aces": "LV", "Los Angeles Sparks": "LAS", "Minnesota Lynx": "MIN",
  "New York Liberty": "NY", "Portland Fire": "PDX", "Phoenix Mercury": "PHX",
  "Seattle Storm": "SEA", "Toronto Tempo": "TOR", "Washington Mystics": "WAS",
  // MLB
  "Arizona Diamondbacks": "ARI", "Atlanta Braves": "ATL", "Baltimore Orioles": "BAL",
  "Boston Red Sox": "BOS", "Chicago Cubs": "CHC", "Chicago White Sox": "CWS",
  "Cincinnati Reds": "CIN", "Cleveland Guardians": "CLE", "Colorado Rockies": "COL",
  "Detroit Tigers": "DET", "Houston Astros": "HOU", "Kansas City Royals": "KC",
  "Los Angeles Angels": "LAA", "Los Angeles Dodgers": "LAD", "Miami Marlins": "MIA",
  "Milwaukee Brewers": "MIL", "Minnesota Twins": "MIN", "New York Mets": "NYM",
  "New York Yankees": "NYY", "Oakland Athletics": "OAK", "Athletics": "OAK",
  "Philadelphia Phillies": "PHI", "Pittsburgh Pirates": "PIT", "San Diego Padres": "SD",
  "San Francisco Giants": "SF", "Seattle Mariners": "SEA", "St. Louis Cardinals": "STL",
  "Tampa Bay Rays": "TB", "Texas Rangers": "TEX", "Toronto Blue Jays": "TOR",
  "Washington Nationals": "WSH",
  // NHL
  "Anaheim Ducks": "ANA", "Boston Bruins": "BOS", "Buffalo Sabres": "BUF",
  "Calgary Flames": "CGY", "Carolina Hurricanes": "CAR", "Chicago Blackhawks": "CHI",
  "Colorado Avalanche": "COL", "Columbus Blue Jackets": "CBJ", "Dallas Stars": "DAL",
  "Detroit Red Wings": "DET", "Edmonton Oilers": "EDM", "Florida Panthers": "FLA",
  "Los Angeles Kings": "LAK", "Minnesota Wild": "MIN", "Montreal Canadiens": "MTL",
  "Nashville Predators": "NSH", "New Jersey Devils": "NJD", "New York Islanders": "NYI",
  "New York Rangers": "NYR", "Ottawa Senators": "OTT", "Philadelphia Flyers": "PHI",
  "Pittsburgh Penguins": "PIT", "San Jose Sharks": "SJS", "Seattle Kraken": "SEA",
  "St. Louis Blues": "STL", "Tampa Bay Lightning": "TBL", "Toronto Maple Leafs": "TOR",
  "Vancouver Canucks": "VAN", "Vegas Golden Knights": "VGK", "Washington Capitals": "WSH",
  "Winnipeg Jets": "WPG",
  // NFL
  "Arizona Cardinals": "ARI", "Atlanta Falcons": "ATL", "Baltimore Ravens": "BAL",
  "Buffalo Bills": "BUF", "Carolina Panthers": "CAR", "Chicago Bears": "CHI",
  "Cincinnati Bengals": "CIN", "Cleveland Browns": "CLE", "Dallas Cowboys": "DAL",
  "Denver Broncos": "DEN", "Detroit Lions": "DET", "Green Bay Packers": "GB",
  "Houston Texans": "HOU", "Indianapolis Colts": "IND", "Jacksonville Jaguars": "JAC",
  "Kansas City Chiefs": "KC", "Las Vegas Raiders": "LV", "Los Angeles Chargers": "LAC",
  "Los Angeles Rams": "LAR", "Miami Dolphins": "MIA", "Minnesota Vikings": "MIN",
  "New England Patriots": "NE", "New Orleans Saints": "NOP", "New York Giants": "NYG",
  "New York Jets": "NYJ", "Philadelphia Eagles": "PHI", "Pittsburgh Steelers": "PIT",
  "San Francisco 49ers": "SF", "Seattle Seahawks": "SEA", "Tampa Bay Buccaneers": "TB",
  "Tennessee Titans": "TEN", "Washington Commanders": "WAS",
};

function toAbbr(fullName) {
  if (!fullName) return "";
  if (TEAM_ABBR[fullName]) return TEAM_ABBR[fullName];
  // Fallback: last word, uppercase, max 3 chars
  return fullName.trim().split(" ").pop().toUpperCase().slice(0, 3);
}

function labelForMarket(key) {
  if (key === "h2h")              return "Moneyline";
  if (key === "spreads")          return "Spread";
  if (key === "totals")           return "Total";
  if (key === "alternate_spreads") return "Alt Spread";
  if (key === "alternate_totals") return "Alt Total";
  if (key === "h2h_h1"   || key === "h2h_1st_half")   return "1H ML";
  if (key === "spreads_h1" || key === "spreads_1st_half") return "1H Spread";
  if (key === "totals_h1" || key === "totals_1st_half") return "1H Total";
  if (key === "h2h_q1"   || key === "h2h_1st_quarter") return "1Q ML";
  if (key === "spreads_q1" || key === "spreads_1st_quarter") return "1Q Spread";
  if (key === "totals_q1" || key === "totals_1st_quarter") return "1Q Total";
  return null; // skip unknown markets
}

// Module-level cache: { [leagueCombo]: { ts, data } }
const _cache = {};
const CACHE_MS = 15 * 60 * 1000; // 15 minutes — 1 call/league/15min keeps usage low

async function fetchOddsApi(sportKey, markets, apiKey) {
  const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds` +
    `?apiKey=${encodeURIComponent(apiKey)}` +
    `&regions=us&markets=${markets}&bookmakers=draftkings` +
    `&oddsFormat=american&dateFormat=iso`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) {
    if (res.status === 422) return []; // no events for this sport right now
    const body = await res.text();
    throw new Error(`Odds API ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

// Per-event endpoint for alternate/period markets not available in bulk
// Returns a single event object (not array) with bookmakers
async function fetchEventOdds(sportKey, eventId, markets, apiKey) {
  const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/events/${encodeURIComponent(eventId)}/odds` +
    `?apiKey=${encodeURIComponent(apiKey)}` +
    `&regions=us&markets=${markets}&bookmakers=draftkings` +
    `&oddsFormat=american&dateFormat=iso`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null; // silently skip — alt markets may not exist for this event
  return res.json(); // single event object
}

function normEvents(events, league, altEventMap) {
  const props = [];
  for (const ev of events || []) {
    const homeAbbr = toAbbr(ev.home_team);
    const awayAbbr = toAbbr(ev.away_team);
    const gameLabel = `${awayAbbr} @ ${homeAbbr}`;

    // Merge alt bookmaker markets into the main event's bookmakers
    const altBks = altEventMap[ev.id] || [];

    for (const bk of [...(ev.bookmakers || []), ...altBks]) {
      for (const mkt of bk.markets || []) {
        const marketLabel = labelForMarket(mkt.key);
        if (!marketLabel) continue;

        for (const out of mkt.outcomes || []) {
          const outName = out.name || "";
          const price   = out.price;
          const point   = out.point;

          let team, opponent, direction, line;

          if (mkt.key === "h2h" || mkt.key.startsWith("h2h_")) {
            // Moneyline / period ML: one row per side
            const isHome = outName === ev.home_team;
            team      = isHome ? homeAbbr : awayAbbr;
            opponent  = isHome ? awayAbbr : homeAbbr;
            direction = isHome ? "HOME" : "AWAY";
            line      = null;
          } else if (mkt.key === "spreads" || mkt.key.includes("spread")) {
            // Spread: one row per side
            const isHome = outName === ev.home_team;
            team      = isHome ? homeAbbr : awayAbbr;
            opponent  = isHome ? awayAbbr : homeAbbr;
            direction = "COVER";
            line      = typeof point === "number" ? point : null;
          } else {
            // Totals (O/U): one row per side
            const isOver = outName === "Over";
            team      = homeAbbr;
            opponent  = awayAbbr;
            direction = isOver ? "OVER" : "UNDER";
            line      = typeof point === "number" ? point : null;
          }

          props.push({
            // id must be unique per prop row so toggleParlay / state.parlay can find it
            id:         `gameBet|${ev.id}|${mkt.key}|${outName}`.replace(/[^a-zA-Z0-9|_.-]/g, "_").slice(0, 80),
            league,
            player:     "",
            team,
            opponent,
            prop:       marketLabel,
            line:       line !== null ? line : undefined,
            direction,
            odds:       price,
            isGameBet:  true,
            gameLabel,
            gameId:     ev.id,
            gameTime:   ev.commence_time,
            betLabel:   outName,           // "Over", "Chicago Bulls", etc.
            bookSource: bk.title || bk.key || "DraftKings",
          });
        }
      }
    }
  }
  return props;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 503,
      headers: CORS,
      body: JSON.stringify({ ok: false, error: "ODDS_API_KEY not set" }),
    };
  }

  const params = event.queryStringParameters || {};
  // alt=false → bulk-only (ML/spread/total). alt=true → also fetch per-event alt/period markets.
  // Client defaults to alt=false on page load; switches to alt=true only when user selects
  // Alt Total / 1Q / 1H chips — saves ~50% of API credits on normal browsing.
  const wantAlt = params.alt === "true";

  const requestedLeagues = params.leagues
    ? params.leagues.toUpperCase().split(",").filter((l) => SPORT_KEYS[l])
    : Object.keys(SPORT_KEYS);

  // Bulk endpoint: ML, spread, game total (1 call per league)
  const MAIN_MARKETS = "h2h,spreads,totals";
  // Per-event endpoint: alternate totals, 1H total, 1Q total (1 call per event)
  const ALT_MARKETS  = "alternate_totals,totals_h1,totals_q1";

  const cacheKey = requestedLeagues.sort().join(",") + "|alt=" + wantAlt;
  const now = Date.now();
  if (_cache[cacheKey] && now - _cache[cacheKey].ts < CACHE_MS) {
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ ok: true, cached: true, ..._cache[cacheKey].data }),
    };
  }

  const allProps = [];
  const errors   = {};

  await Promise.all(
    requestedLeagues.map(async (league) => {
      const sportKey = SPORT_KEYS[league];
      try {
        // Step 1: bulk fetch for main markets + event list
        const events = await fetchOddsApi(sportKey, MAIN_MARKETS, apiKey);

        // Step 2: per-event alt/period markets — only when explicitly requested
        const altEventMap = {};
        if (wantAlt) {
          const altResults = await Promise.all(
            events.map((ev) =>
              fetchEventOdds(sportKey, ev.id, ALT_MARKETS, apiKey).catch(() => null)
            )
          );
          for (const altEv of altResults) {
            if (altEv?.id) altEventMap[altEv.id] = altEv.bookmakers || [];
          }
        }

        const leagueProps = normEvents(events, league, altEventMap);
        allProps.push(...leagueProps);
      } catch (err) {
        errors[league] = err.message;
      }
    })
  );

  const result = {
    ok:     true,
    count:  allProps.length,
    props:  allProps,
    ...(Object.keys(errors).length ? { errors } : {}),
  };

  _cache[cacheKey] = { ts: now, data: result };

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify(result),
  };
};
