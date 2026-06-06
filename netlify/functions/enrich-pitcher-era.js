/**
 * Netlify Scheduled Function: Enrich Pitcher ERA Data
 *
 * Schedule: Daily at 8 AM ET (configured in netlify.toml)
 *
 * Sources: ESPN (games + pitchers + ERA/WHIP) + Baseball Savant (xERA)
 * No MLB StatsAPI calls — those are blocked on Netlify/AWS IP ranges.
 *
 * Environment Variables Required:
 * - PROPEDGE_SHEET_ID: Google Sheet ID
 * - GOOGLE_SERVICE_ACCOUNT: JSON string with service account credentials
 */

const https = require('https');

// ─────────────────────────────────────────────────────────────────────────────
// HTTP util
// ─────────────────────────────────────────────────────────────────────────────

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const opts = { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } };
    https.get(url, opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', reject).on('timeout', function() { this.destroy(); reject(new Error('timeout')); });
  });
}

async function fetchJSON(url) {
  const text = await fetchText(url);
  return JSON.parse(text);
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1: Today's games from ESPN scoreboard
// ─────────────────────────────────────────────────────────────────────────────

async function fetchESPNGames(date) {
  const data = await fetchJSON('https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?limit=500');
  const games = (data.events || []).filter(e => e.date.startsWith(date));

  return games.map(e => {
    const competitors = e.competitions?.[0]?.competitors || [];
    const home = competitors.find(c => c.homeAway === 'home') || competitors[0];
    const away = competitors.find(c => c.homeAway === 'away') || competitors[1];
    return {
      eventId: e.id,
      homeTeam: home?.team?.abbreviation,
      awayTeam: away?.team?.abbreviation,
      homeTeamName: home?.team?.displayName,
      awayTeamName: away?.team?.displayName,
      status: e.status?.type?.name
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2: Starting pitchers from ESPN game summary boxscore
// ─────────────────────────────────────────────────────────────────────────────

async function fetchStartingPitchers(game) {
  const summary = await fetchJSON(
    `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event=${game.eventId}`
  );

  const result = [];
  for (const team of summary.boxscore?.players || []) {
    const pitching = team.statistics?.find(s => s.type === 'pitching' || s.name === 'pitching');
    if (!pitching) continue;

    // First pitcher listed in boxscore = starting pitcher
    const starter = pitching.athletes?.[0];
    if (!starter?.athlete?.id) continue;

    const isHome = team.team?.abbreviation === game.homeTeam;
    result.push({
      espnId: starter.athlete.id,
      name: starter.athlete.displayName,
      team: isHome ? game.homeTeam : game.awayTeam,
      teamName: isHome ? game.homeTeamName : game.awayTeamName,
      opponent: isHome ? game.awayTeam : game.homeTeam,
      isHome
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3: Season ERA/WHIP from ESPN player stats
// ─────────────────────────────────────────────────────────────────────────────

async function fetchESPNStats(espnId, name) {
  try {
    const stats = await fetchJSON(
      `https://site.web.api.espn.com/apis/common/v3/sports/baseball/mlb/athletes/${espnId}/stats?season=2026`
    );
    const pitching = stats.categories?.find(c => c.name === 'pitching');
    if (!pitching) return null;

    const labels = pitching.labels || [];
    const totals = pitching.totals || [];
    const get = (label) => totals[labels.indexOf(label)] ?? null;

    return {
      era: parseFloat(get('ERA')) || null,
      whip: parseFloat(get('WHIP')) || null,
      ip: get('IP'),
      wins: parseInt(get('W')) || 0,
      losses: parseInt(get('L')) || 0,
      strikeouts: parseInt(get('K')) || 0,
    };
  } catch (err) {
    console.warn(`  ⚠️ ESPN stats failed for ${name}: ${err.message}`);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 4: xERA from Baseball Savant (one fetch, name-based lookup)
// ─────────────────────────────────────────────────────────────────────────────

async function fetchStatcastLeaderboard() {
  const csv = await fetchText(
    'https://baseballsavant.mlb.com/leaderboard/custom?year=2026&type=pitcher&filter=&sort=4&sortDir=asc&min=0&selections=p_era,p_whip,xera&csv=true'
  );
  const lines = csv.trim().split('\n');
  // Header: "last_name, first_name","player_id","year","p_era","p_whip","xera"
  // After stripping quotes and splitting by comma, the name field occupies indices 0 and 1
  // because it contains a comma: "Smith, John" → ['Smith', ' John', ...]
  const headers = lines[0].replace(/"/g, '').split(',');
  const xeraIdx = headers.indexOf('xera');   // e.g. 6

  const lookup = {};
  for (const line of lines.slice(1)) {
    const cols = line.replace(/"/g, '').split(',');
    const last = cols[0]?.trim();
    const first = cols[1]?.trim();
    if (!last || !first) continue;
    const key = `${first} ${last}`.toLowerCase();
    lookup[key] = { xera: parseFloat(cols[xeraIdx]) || null };
  }
  return lookup;
}

// ─────────────────────────────────────────────────────────────────────────────
// Google Sheets placeholder
// ─────────────────────────────────────────────────────────────────────────────

async function updateGoogleSheet(pitcherData) {
  const sheetId = process.env.PROPEDGE_SHEET_ID;
  if (!sheetId) {
    console.warn('⚠️ PROPEDGE_SHEET_ID not configured — skipping sheet update');
    return false;
  }
  console.log('📝 Sheet update placeholder:', { count: pitcherData.length, sample: pitcherData[0] });
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  const startTime = Date.now();
  const now = new Date();
  const date = new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString().split('T')[0]; // ET date

  console.log(`\n🔄 Pitcher ERA Enrichment — ${date} (trigger: ${event.httpMethod || 'scheduled'})\n`);

  try {
    // Step 1: Games
    console.log('📍 Step 1: Fetching ESPN games...');
    const games = await fetchESPNGames(date);
    console.log(`  Found ${games.length} games for ${date}`);

    if (games.length === 0) {
      return { statusCode: 200, body: JSON.stringify({ message: 'No games today', date }) };
    }

    // Step 2: Starters
    console.log('📍 Step 2: Fetching starting pitchers from ESPN boxscores...');
    const allPitchers = [];
    for (const game of games) {
      try {
        const starters = await fetchStartingPitchers(game);
        console.log(`  ${game.awayTeam} @ ${game.homeTeam}: ${starters.map(p => p.name).join(', ') || 'none found'}`);
        allPitchers.push(...starters);
      } catch (err) {
        console.warn(`  ⚠️ Failed for ${game.awayTeam} @ ${game.homeTeam}: ${err.message}`);
      }
    }

    if (allPitchers.length === 0) {
      return { statusCode: 200, body: JSON.stringify({ message: 'No pitcher data available', date }) };
    }

    // Step 3: ERA/WHIP from ESPN + xERA from Statcast
    console.log(`📍 Step 3: Fetching stats for ${allPitchers.length} pitchers...`);

    let statcastLookup = {};
    try {
      statcastLookup = await fetchStatcastLeaderboard();
      console.log(`  Statcast leaderboard loaded: ${Object.keys(statcastLookup).length} pitchers`);
    } catch (err) {
      console.warn(`  ⚠️ Statcast fetch failed: ${err.message}`);
    }

    const enriched = [];
    for (const pitcher of allPitchers) {
      const espnStats = await fetchESPNStats(pitcher.espnId, pitcher.name);
      const xeraData = statcastLookup[pitcher.name.toLowerCase()] || null;

      const entry = {
        name: pitcher.name,
        team: pitcher.team,
        opponent: pitcher.opponent,
        isHome: pitcher.isHome,
        espnId: pitcher.espnId,
        era: espnStats?.era ?? null,
        whip: espnStats?.whip ?? null,
        ip: espnStats?.ip ?? null,
        wins: espnStats?.wins ?? 0,
        losses: espnStats?.losses ?? 0,
        strikeouts: espnStats?.strikeouts ?? 0,
        xera: xeraData?.xera ?? null,
      };

      if (entry.era !== null) {
        console.log(`  ✅ ${pitcher.name} (${pitcher.team}): ERA ${entry.era} | WHIP ${entry.whip} | xERA ${entry.xera}`);
      } else {
        console.warn(`  ⚠️ ${pitcher.name}: no ERA data`);
      }

      enriched.push(entry);
      await new Promise(r => setTimeout(r, 150)); // rate limit
    }

    // Step 4: Sheet update
    console.log('📍 Step 4: Updating Google Sheet...');
    await updateGoogleSheet(enriched);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const result = {
      success: true,
      message: `✅ Enriched ${enriched.filter(p => p.era).length}/${enriched.length} pitchers in ${duration}s`,
      stats: {
        gamesScraped: games.length,
        pitchersFound: allPitchers.length,
        pitchersWithERA: enriched.filter(p => p.era).length,
        durationSeconds: parseFloat(duration)
      },
      data: enriched,
      date,
    };

    console.log('\n✨ Complete:', result.message);
    return { statusCode: 200, body: JSON.stringify(result) };

  } catch (err) {
    console.error('❌ Fatal error:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
