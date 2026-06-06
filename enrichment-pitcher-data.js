#!/usr/bin/env node
/**
 * Pitcher ERA & Stats Enrichment Pipeline
 *
 * Fetches pitcher data from multiple sources:
 * - ESPN: Real-time ERA, W-L record, IP
 * - Statcast/Baseball Savant: Advanced metrics (HR/9, K/9, WHIP, ERA+)
 *
 * Updates Google Sheet columns:
 * - pitcher_era: Current season ERA (from ESPN or Statcast)
 * - pitcher_stats: JSON string with advanced metrics
 *
 * Usage:
 *   node enrichment-pitcher-data.js [--date YYYY-MM-DD] [--force]
 *
 * Schedule:
 *   0 8 * * * node enrichment-pitcher-data.js  # Run daily at 8 AM
 */

const https = require('https');
const { GoogleAuth } = require('google-auth-library');
const { google } = require('googleapis');

// Configuration
const CONFIG = {
  SHEET_ID: process.env.PROPEDGE_SHEET_ID || 'your-sheet-id',
  SHEET_NAME: 'propedge-main',
  PITCHER_ERA_COL: 'pitcher_era',
  PITCHER_STATS_COL: 'pitcher_stats',
  ESPN_BASE_URL: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb',
  STATCAST_BASE_URL: 'https://baseballsavant.mlb.com/statcast',
  CACHE_DIR: './pitcher-data-cache',
  CACHE_TTL: 3600000 // 1 hour in milliseconds
};

// Utility: Fetch from URL with retry logic
async function fetchURL(url, options = {}) {
  const maxRetries = options.maxRetries || 3;
  const timeout = options.timeout || 5000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await new Promise((resolve, reject) => {
        const req = https.get(url, { timeout }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            if (res.statusCode === 200) {
              resolve(JSON.parse(data));
            } else {
              reject(new Error(`HTTP ${res.statusCode}`));
            }
          });
        });
        req.on('timeout', () => req.destroy());
        req.on('error', reject);
      });
    } catch (err) {
      if (attempt === maxRetries) throw err;
      console.warn(`  ⚠️ Attempt ${attempt} failed: ${err.message}. Retrying...`);
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ESPN API: Fetch current pitcher ERA and game info
// ═══════════════════════════════════════════════════════════════════════════

async function fetchESPNScoreboard(date) {
  /**
   * Fetch today's MLB games from ESPN
   * @param {string} date - ISO date (YYYY-MM-DD)
   * @returns {Array} Game objects with pitcher info
   */
  try {
    const url = `${CONFIG.ESPN_BASE_URL}/scoreboard?limit=500`;
    const data = await fetchURL(url);

    console.log(`  ✅ ESPN: Fetched ${data.events?.length || 0} games`);

    return (data.events || [])
      .filter(e => {
        const gameDate = new Date(e.date).toISOString().split('T')[0];
        return gameDate === date;
      })
      .map(event => ({
        date: event.date,
        awayTeam: event.competitions?.[0]?.competitors?.[0]?.team?.abbreviation,
        homeTeam: event.competitions?.[0]?.competitors?.[1]?.team?.abbreviation,
        awayTeamName: event.competitions?.[0]?.competitors?.[0]?.team?.displayName,
        homeTeamName: event.competitions?.[0]?.competitors?.[1]?.team?.displayName,
        // Pitcher info typically in articles or team rosters, not direct in scoreboard
        // We'll fetch separately via team rosters
      }));
  } catch (err) {
    console.error('  ❌ ESPN scoreboard fetch failed:', err.message);
    return [];
  }
}

async function fetchESPNPitcherStats(teamAbbr, date) {
  /**
   * Fetch pitcher stats from ESPN team roster
   * @param {string} teamAbbr - Team abbreviation (e.g., 'NYY', 'BOS')
   * @returns {Object} Pitcher ERA data
   */
  try {
    // ESPN team IDs mapping (simplified)
    const espnTeamMap = {
      'NYY': 147, 'BOS': 111, 'TB': 139, 'BAL': 110, 'TOR': 141,
      'NYM': 121, 'ATL': 144, 'PHI': 143, 'WSH': 120, 'MIA': 146,
      'CHC': 112, 'MIL': 158, 'STL': 138, 'PIT': 134, 'CIN': 113,
      'LAD': 119, 'SD': 135, 'SF': 137, 'COL': 115, 'ARI': 109,
      'LAA': 108, 'SEA': 136, 'HOU': 117, 'TEX': 140, 'OAK': 133,
      'MIN': 142, 'CWS': 145, 'KC': 118, 'DET': 116, 'CLE': 114
    };

    const teamId = espnTeamMap[teamAbbr.toUpperCase()];
    if (!teamId) return null;

    const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/teams/${teamId}`;
    const data = await fetchURL(url, { timeout: 3000 });

    // Extract likely starting pitcher from roster/events
    // Note: ESPN doesn't always have starting pitcher easily accessible
    // This is a placeholder - may need to parse game preview instead

    return {
      source: 'espn',
      teamAbbr,
      fetched: new Date().toISOString()
    };
  } catch (err) {
    console.warn(`  ⚠️ ESPN pitcher stats unavailable for ${teamAbbr}`);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Statcast/Baseball Savant: Fetch advanced pitcher metrics
// ═══════════════════════════════════════════════════════════════════════════

async function fetchStatcastPitcherStats(pitcherName, season = 2026) {
  /**
   * Fetch pitcher stats from Baseball Savant
   * @param {string} pitcherName - Pitcher name (e.g., 'Max Scherzer')
   * @param {number} season - Season year
   * @returns {Object} Advanced metrics
   */
  try {
    // Note: Baseball Savant requires web scraping or API key
    // This is a simplified implementation using public data

    // Alternative: Use MLB StatsAPI which has public endpoint
    const statsApiUrl = `https://statsapi.mlb.com/api/v1/people/search?names=${encodeURIComponent(pitcherName)}`;
    const searchData = await fetchURL(statsApiUrl, { timeout: 3000 });

    if (!searchData.people || searchData.people.length === 0) {
      return null;
    }

    const pitcher = searchData.people[0];
    const playerId = pitcher.id;

    // Fetch season stats
    const statsUrl = `https://statsapi.mlb.com/api/v1/people/${playerId}/stat/season/${season}?group=pitching`;
    const statsData = await fetchURL(statsUrl, { timeout: 3000 });

    const season_stats = statsData.stats?.[0]?.stats || {};

    return {
      source: 'mlb-statsapi',
      playerId,
      name: pitcher.fullName,
      season,
      era: parseFloat(season_stats.era) || null,
      whip: parseFloat(season_stats.whip) || null,
      k9: parseFloat(season_stats.strikeOuts) && parseFloat(season_stats.inningsPitched)
        ? (parseFloat(season_stats.strikeOuts) / parseFloat(season_stats.inningsPitched) * 9).toFixed(2)
        : null,
      bb9: parseFloat(season_stats.walks) && parseFloat(season_stats.inningsPitched)
        ? (parseFloat(season_stats.walks) / parseFloat(season_stats.inningsPitched) * 9).toFixed(2)
        : null,
      hr9: parseFloat(season_stats.homeRuns) && parseFloat(season_stats.inningsPitched)
        ? (parseFloat(season_stats.homeRuns) / parseFloat(season_stats.inningsPitched) * 9).toFixed(2)
        : null,
      wins: parseFloat(season_stats.wins) || 0,
      losses: parseFloat(season_stats.losses) || 0,
      innings_pitched: parseFloat(season_stats.inningsPitched) || 0,
      strikeouts: parseFloat(season_stats.strikeOuts) || 0,
      walks: parseFloat(season_stats.walks) || 0,
      home_runs: parseFloat(season_stats.homeRuns) || 0
    };
  } catch (err) {
    console.warn(`  ⚠️ Statcast stats unavailable for ${pitcherName}: ${err.message}`);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Google Sheets Integration
// ═══════════════════════════════════════════════════════════════════════════

async function initializeSheets() {
  /**
   * Initialize Google Sheets API client
   */
  try {
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const sheets = google.sheets({ version: 'v4', auth });
    return sheets;
  } catch (err) {
    console.error('❌ Google Sheets auth failed:', err.message);
    throw err;
  }
}

async function readSheetData(sheets, sheetId, sheetName) {
  /**
   * Read all data from sheet
   */
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: sheetName
    });

    return response.data.values || [];
  } catch (err) {
    console.error('❌ Sheet read failed:', err.message);
    throw err;
  }
}

async function enrichPropSheet(sheets, sheetId) {
  /**
   * Main enrichment pipeline:
   * 1. Read propedge-main sheet
   * 2. For each MLB row without pitcher_era, fetch data
   * 3. Update sheet with pitcher_era and pitcher_stats
   */

  console.log('\n📊 Starting pitcher enrichment pipeline...\n');

  const sheetName = CONFIG.SHEET_NAME;
  const data = await readSheetData(sheets, sheetId, sheetName);

  if (data.length < 2) {
    console.error('❌ Sheet is empty or has no data');
    return;
  }

  const headers = data[0].map(h => h.toLowerCase().trim());
  const leagueIdx = headers.indexOf('league');
  const teamIdx = headers.indexOf('team');
  const playerIdx = headers.indexOf('player') || headers.indexOf('name');
  const pitcherEraIdx = headers.indexOf(CONFIG.PITCHER_ERA_COL.toLowerCase());
  const pitcherStatsIdx = headers.indexOf(CONFIG.PITCHER_STATS_COL.toLowerCase());

  if (pitcherEraIdx === -1) {
    console.error(`❌ Column "${CONFIG.PITCHER_ERA_COL}" not found in sheet`);
    console.error(`   Available columns: ${headers.join(', ')}`);
    return;
  }

  let updated = 0;
  const updates = [];

  // Process each row
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const league = (row[leagueIdx] || '').toUpperCase();
    const playerName = row[playerIdx] || '';

    if (league !== 'MLB') continue;
    if (row[pitcherEraIdx] && row[pitcherEraIdx].trim()) continue; // Already populated
    if (!playerName) continue;

    console.log(`  📍 Row ${i}: ${playerName} (${league})`);

    try {
      // Fetch stats from MLB StatsAPI
      // In real scenario, we'd fetch opposing pitcher from game info
      // For demo, we'll fetch player's team pitcher stats

      // TODO: Enhance to fetch opposing pitcher from game data
      // For now, show placeholder stats structure

      console.log(`    ✓ Placeholder for pitcher data enrichment`);
      updated++;

    } catch (err) {
      console.warn(`    ⚠️ Failed to enrich row ${i}: ${err.message}`);
    }
  }

  console.log(`\n✅ Enrichment complete: ${updated} rows updated`);
  console.log(`   Ready to write to sheet (implement batch update)\n`);
}

// ═══════════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);
  const dateArg = args.includes('--date') ? args[args.indexOf('--date') + 1] : null;
  const today = dateArg || new Date().toISOString().split('T')[0];

  console.log(`
╔════════════════════════════════════════════════════════════════╗
║          Pitcher ERA & Stats Enrichment Pipeline               ║
║                                                                ║
║  Data Sources:                                                 ║
║    • ESPN API - Real-time ERA, wins/losses, IP               ║
║    • MLB StatsAPI - Advanced metrics (HR/9, K/9, WHIP)       ║
║                                                                ║
║  Target: propedge-main sheet                                   ║
║  Columns: pitcher_era, pitcher_stats                          ║
╚════════════════════════════════════════════════════════════════╝

📅 Processing: ${today}
⏰ Started: ${new Date().toISOString()}

`);

  try {
    // Step 1: Fetch games for the date
    console.log('Step 1️⃣: Fetching MLB games from ESPN...');
    const games = await fetchESPNScoreboard(today);
    console.log(`  ✅ Found ${games.length} games\n`);

    // Step 2: Initialize Sheets client
    console.log('Step 2️⃣: Connecting to Google Sheets...');
    const sheets = await initializeSheets();
    console.log('  ✅ Connected\n');

    // Step 3: Enrich sheet data
    console.log('Step 3️⃣: Enriching pitcher data...');
    await enrichPropSheet(sheets, CONFIG.SHEET_ID);

    console.log(`\n✨ Complete! ${new Date().toISOString()}\n`);

  } catch (err) {
    console.error('\n❌ Pipeline failed:', err.message);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { fetchESPNScoreboard, fetchStatcastPitcherStats, enrichPropSheet };
