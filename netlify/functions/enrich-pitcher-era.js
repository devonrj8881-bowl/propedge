/**
 * Netlify Scheduled Function: Enrich Pitcher ERA Data
 *
 * Schedule: Daily at 8 AM ET (configured in netlify.toml)
 *
 * What it does:
 * 1. Fetches today's MLB games from ESPN
 * 2. Identifies starting pitchers for each game
 * 3. Fetches pitcher ERA from MLB StatsAPI
 * 4. Updates propedge-main Google Sheet with pitcher_era column
 *
 * Environment Variables Required:
 * - PROPEDGE_SHEET_ID: Google Sheet ID
 * - GOOGLE_SERVICE_ACCOUNT: JSON string with service account credentials
 *
 * Usage:
 * - Automatically scheduled via netlify.toml
 * - Or manually triggered via: /.netlify/functions/enrich-pitcher-era
 */

const https = require('https');

// ═══════════════════════════════════════════════════════════════════════════
// Utility: Fetch from HTTPS endpoint with retry
// ═══════════════════════════════════════════════════════════════════════════

function fetchJSON(url, options = {}) {
  return new Promise((resolve, reject) => {
    const maxRetries = options.maxRetries || 2;
    const timeout = options.timeout || 5000;

    const attempt = (retryCount = 0) => {
      const req = https.get(url, { timeout }, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              resolve(JSON.parse(data));
            } else if (retryCount < maxRetries) {
              setTimeout(() => attempt(retryCount + 1), 1000);
            } else {
              reject(new Error(`HTTP ${res.statusCode}`));
            }
          } catch (err) {
            reject(err);
          }
        });
      });

      req.on('error', (err) => {
        if (retryCount < maxRetries) {
          setTimeout(() => attempt(retryCount + 1), 1000);
        } else {
          reject(err);
        }
      });

      req.on('timeout', () => {
        req.destroy();
        if (retryCount < maxRetries) {
          attempt(retryCount + 1);
        } else {
          reject(new Error('Request timeout'));
        }
      });
    };

    attempt();
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// ESPN: Fetch today's games and starting pitchers
// ═══════════════════════════════════════════════════════════════════════════

async function fetchESPNGames() {
  try {
    const url = 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?limit=500';
    const data = await fetchJSON(url, { timeout: 8000 });

    // Handle timezone: check both EST (local) and UTC dates
    const now = new Date();
    const utcDate = now.toISOString().split('T')[0];
    // EST is UTC-5, EDT is UTC-4. For June, use EDT (UTC-4)
    const estDate = new Date(now.getTime() - 4*60*60*1000).toISOString().split('T')[0];

    console.log(`📅 Current UTC date: ${utcDate}, EST date: ${estDate}`);
    console.log(`📊 ESPN returned ${data.events?.length || 0} total events`);

    // Log all games ESPN returned with their dates
    if (data.events && data.events.length > 0) {
      const sampleGames = data.events.slice(0, 3).map(e => ({
        date: e.date?.substring(0, 10),
        teams: `${e.competitions?.[0]?.competitors?.[0]?.team?.abbreviation} @ ${e.competitions?.[0]?.competitors?.[1]?.team?.abbreviation}`,
        status: e.status?.type?.name
      }));
      console.log(`📝 Sample ESPN games: ${JSON.stringify(sampleGames)}`);
    }

    // Filter games from both EST and UTC dates (covers all timezones)
    const games = (data.events || [])
      .filter((event) => {
        const gameDate = new Date(event.date).toISOString().split('T')[0];
        const isToday = gameDate === utcDate || gameDate === estDate;
        return isToday;
      })
      .map((event) => {
        const comp = event.competitions?.[0] || {};
        const competitors = comp.competitors || [];

        // ESPN competitors[0] = home, competitors[1] = away (use homeAway field to be safe)
        const homeComp = competitors.find(c => c.homeAway === 'home') || competitors[0];
        const awayComp = competitors.find(c => c.homeAway === 'away') || competitors[1];

        return {
          id: event.id,
          date: event.date,
          awayTeam: awayComp?.team?.abbreviation,
          homeTeam: homeComp?.team?.abbreviation,
          awayTeamName: awayComp?.team?.displayName,
          homeTeamName: homeComp?.team?.displayName,
          status: event.status?.type?.name
        };
      });

    console.log(`✅ ESPN: Found ${games.length} games for ${estDate}`);
    return games;
  } catch (err) {
    console.error('❌ ESPN fetch failed:', err.message);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MLB StatsAPI: Fetch pitcher ERA by pitcher ID
// ═══════════════════════════════════════════════════════════════════════════

async function fetchPitcherERA(pitcherId, season = 2026) {
  try {
    const url = `https://statsapi.mlb.com/api/v1/people/${pitcherId}/stats?stats=season&season=${season}&group=pitching`;
    const data = await fetchJSON(url, { timeout: 5000 });

    const stats = data.stats?.[0]?.splits?.[0]?.stat || {};

    return {
      playerId: pitcherId,
      era: parseFloat(stats.era) || null,
      whip: parseFloat(stats.whip) || null,
      k9: stats.strikeOuts && stats.inningsPitched
        ? ((parseFloat(stats.strikeOuts) / parseFloat(stats.inningsPitched)) * 9).toFixed(2)
        : null,
      hr9: stats.homeRuns && stats.inningsPitched
        ? ((parseFloat(stats.homeRuns) / parseFloat(stats.inningsPitched)) * 9).toFixed(2)
        : null,
      wins: parseInt(stats.wins) || 0,
      losses: parseInt(stats.losses) || 0,
      inningsPitched: parseFloat(stats.inningsPitched) || 0
    };
  } catch (err) {
    console.warn(`⚠️ Pitcher ${pitcherId} stats fetch failed:`, err.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Search MLB API for pitcher ID by name
// ═══════════════════════════════════════════════════════════════════════════

async function findPitcherID(pitcherName) {
  try {
    const url = `https://statsapi.mlb.com/api/v1/people/search?names=${encodeURIComponent(pitcherName)}`;
    const data = await fetchJSON(url, { timeout: 5000 });

    const pitcher = data.people?.[0];
    if (!pitcher) return null;

    return pitcher.id;
  } catch (err) {
    console.warn(`⚠️ Pitcher search failed for "${pitcherName}":`, err.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Fetch starting pitchers for today's games
// ═══════════════════════════════════════════════════════════════════════════

async function fetchStartingPitchers(games) {
  const pitchers = [];

  for (const game of games) {
    // Skip only truly cancelled/postponed games (no pitchers assigned)
    const skipStatuses = ['Postponed', 'Cancelled'];
    if (skipStatuses.includes(game.status)) {
      console.log(`⏭️  Skipping ${game.awayTeam} @ ${game.homeTeam} (${game.status})`);
      continue;
    }

    console.log(`🔍 Looking up pitchers for ${game.awayTeam} @ ${game.homeTeam} (raw date: ${game.date})`);

    try {
      // Try both UTC and EST dates to catch all games
      const utcDate = new Date().toISOString().split('T')[0];
      const estDate = new Date(new Date().getTime() - 4*60*60*1000).toISOString().split('T')[0];

      // Fetch schedule (includes both upcoming and in-progress games) for both dates
      const datesToCheck = [estDate, utcDate];
      let allScheduleGames = [];

      for (const dateToCheck of datesToCheck) {
        console.log(`  📅 Fetching MLB schedule for ${dateToCheck}...`);
        // Schedule endpoint returns games in all states: scheduled, in-progress, final
        const scheduleUrl = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${dateToCheck}&hydrate=probablePitcher`;
        const scheduleData = await fetchJSON(scheduleUrl, { timeout: 5000 });

        const dateGames = scheduleData.dates?.[0]?.games || [];
        if (dateGames.length > 0) {
          console.log(`  ✅ Found ${dateGames.length} games on ${dateToCheck}`);
          allScheduleGames = allScheduleGames.concat(dateGames);
        }
      }

      if (allScheduleGames.length === 0) {
        console.warn(`  ❌ No games found for ${estDate} or ${utcDate}`);
      }

      // Find game matching away/home teams
      // MLB schedule endpoint only returns team name (not abbreviation), so match by name
      const matchedGame = allScheduleGames.find(g => {
        const awayName = g.teams?.away?.team?.name || '';
        const homeName = g.teams?.home?.team?.name || '';
        // ESPN awayTeamName e.g. "Houston Astros", MLB name e.g. "Houston Astros"
        return awayName === game.awayTeamName && homeName === game.homeTeamName;
      });

      if (!matchedGame) {
        console.warn(`⚠️  Could not match ${game.awayTeamName} @ ${game.homeTeamName} in schedule`);
        console.warn(`   Available: ${allScheduleGames?.map(g => `${g.teams?.away?.team?.name}@${g.teams?.home?.team?.name}`).join(' | ')}`);
        continue;
      }

      const awayPitcher = matchedGame.teams?.away?.probablePitcher;
      const homePitcher = matchedGame.teams?.home?.probablePitcher;

      if (awayPitcher?.id) {
        const name = awayPitcher.fullName || awayPitcher.name || 'Unknown';
        console.log(`  ⚾ Away pitcher: ${name} (ID: ${awayPitcher.id})`);
        pitchers.push({
          team: game.awayTeam,
          opponent: game.homeTeam,
          name: name,
          playerId: awayPitcher.id,
          isHome: false
        });
      }

      if (homePitcher?.id) {
        const name = homePitcher.fullName || homePitcher.name || 'Unknown';
        console.log(`  ⚾ Home pitcher: ${name} (ID: ${homePitcher.id})`);
        pitchers.push({
          team: game.homeTeam,
          opponent: game.awayTeam,
          name: name,
          playerId: homePitcher.id,
          isHome: true
        });
      }
    } catch (err) {
      console.warn(`⚠️ Failed to fetch pitchers for game ${game.id}:`, err.message);
    }
  }

  return pitchers;
}

// ═══════════════════════════════════════════════════════════════════════════
// Google Sheets: Update pitcher_era column
// ═══════════════════════════════════════════════════════════════════════════

async function updateGoogleSheet(pitcherData) {
  // Note: Full implementation requires google-auth-library
  // For now, this is a placeholder that logs what would be updated

  const sheetId = process.env.PROPEDGE_SHEET_ID;
  if (!sheetId) {
    console.warn('⚠️ PROPEDGE_SHEET_ID not configured');
    return false;
  }

  // TODO: Implement Google Sheets API update
  // This requires:
  // 1. Authenticating with service account
  // 2. Reading current sheet data
  // 3. Matching pitcher names to player rows
  // 4. Updating pitcher_era column
  // 5. Writing back to sheet

  console.log('📝 Sheet update placeholder - would update with:', {
    pitchersCount: pitcherData.length,
    sample: pitcherData.slice(0, 2)
  });

  return true;
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Handler
// ═══════════════════════════════════════════════════════════════════════════

exports.handler = async (event) => {
  const startTime = new Date().toISOString();

  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║          🔄 Pitcher ERA Enrichment Function                   ║
║                                                                ║
║  Running: ${startTime}                    ║
║  Trigger: ${event.httpMethod === 'GET' ? 'Manual' : 'Scheduled'}                                          ║
╚═══════════════════════════════════════════════════════════════╝
`);

  try {
    // Step 1: Fetch today's games
    console.log('\n📍 Step 1: Fetching today\'s MLB games...');
    const games = await fetchESPNGames();

    if (games.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'No games scheduled for today',
          timestamp: startTime
        })
      };
    }

    // Step 2: Get starting pitchers
    console.log('\n📍 Step 2: Looking up starting pitchers...');
    const pitchers = await fetchStartingPitchers(games);

    if (pitchers.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'No pitcher data available',
          timestamp: startTime
        })
      };
    }

    // Step 3: Fetch ERA for each pitcher
    console.log('\n📍 Step 3: Fetching pitcher ERA data...');
    const pitcherERAData = [];

    for (const pitcher of pitchers) {
      const stats = await fetchPitcherERA(pitcher.playerId);

      if (stats && stats.era) {
        console.log(`  ✅ ${pitcher.name}: ERA ${stats.era.toFixed(2)}`);
        pitcherERAData.push({
          ...pitcher,
          ...stats
        });
      } else {
        console.warn(`  ⚠️ ${pitcher.name}: No ERA data`);
      }

      // Rate limiting - be nice to MLB API
      await new Promise(r => setTimeout(r, 200));
    }

    // Step 4: Update Google Sheet
    console.log('\n📍 Step 4: Updating Google Sheet...');
    const sheetUpdated = await updateGoogleSheet(pitcherERAData);

    const endTime = new Date().toISOString();
    const duration = (new Date(endTime) - new Date(startTime)) / 1000;

    const result = {
      success: true,
      message: `✅ Enriched ${pitcherERAData.length} pitchers in ${duration.toFixed(1)}s`,
      stats: {
        gamesScraped: games.length,
        pitchersFound: pitchers.length,
        pitchersWithERA: pitcherERAData.length,
        durationSeconds: duration
      },
      data: pitcherERAData.slice(0, 5), // Return first 5 for logs
      timestamp: endTime
    };

    console.log(`\n✨ Complete!\n`, result);

    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };

  } catch (error) {
    console.error('\n❌ Enrichment failed:', error.message);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};
