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
// Step 3: Season stats from Baseball Savant — ERA, WHIP, xERA (all 2026 only)
// ESPN stats API returns career totals so we use Statcast for all rate stats.
// ─────────────────────────────────────────────────────────────────────────────

async function fetchStatcastLeaderboard() {
  const csv = await fetchText(
    'https://baseballsavant.mlb.com/leaderboard/custom?year=2026&type=pitcher&filter=&sort=4&sortDir=asc&min=0&selections=p_era,p_whip,xera&csv=true'
  );
  const lines = csv.trim().split('\n');
  // Name field contains a comma ("Smith, John") so after split it occupies cols 0+1
  const headers = lines[0].replace(/"/g, '').split(',').map(h => h.trim());
  const eraIdx  = headers.indexOf('p_era');
  const whipIdx = headers.indexOf('p_whip');
  const xeraIdx = headers.indexOf('xera');

  const lookup = {};
  for (const line of lines.slice(1)) {
    const cols = line.replace(/"/g, '').split(',');
    const last  = cols[0]?.trim();
    const first = cols[1]?.trim();
    if (!last || !first) continue;
    const key = `${first} ${last}`.toLowerCase();
    lookup[key] = {
      era:  parseFloat(cols[eraIdx])  || null,
      whip: parseFloat(cols[whipIdx]) || null,
      xera: parseFloat(cols[xeraIdx]) || null,
    };
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

    // Step 3: ERA/WHIP/xERA from Statcast (season-specific, one fetch)
    console.log(`📍 Step 3: Fetching 2026 stats from Baseball Savant...`);

    let statcastLookup = {};
    try {
      statcastLookup = await fetchStatcastLeaderboard();
      console.log(`  Statcast loaded: ${Object.keys(statcastLookup).length} pitchers`);
    } catch (err) {
      console.warn(`  ⚠️ Statcast fetch failed: ${err.message}`);
    }

    const enriched = [];
    for (const pitcher of allPitchers) {
      const stats = statcastLookup[pitcher.name.toLowerCase()] || null;

      const entry = {
        name: pitcher.name,
        team: pitcher.team,
        opponent: pitcher.opponent,
        isHome: pitcher.isHome,
        espnId: pitcher.espnId,
        era:  stats?.era  ?? null,
        xera: stats?.xera ?? null,
      };

      if (entry.era !== null) {
        console.log(`  ✅ ${pitcher.name} (${pitcher.team}): ERA ${entry.era} | xERA ${entry.xera}`);
      } else {
        console.warn(`  ⚠️ ${pitcher.name}: not in Statcast leaderboard`);
      }

      enriched.push(entry);
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
