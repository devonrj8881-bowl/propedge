#!/usr/bin/env node

/**
 * PropEdge Data Enrichment Orchestrator
 *
 * Workflow:
 * 1. Read player data from Google Sheets
 * 2. Fetch real game logs (NBA.com, NHL.com, MLB.com)
 * 3. Calculate per-minute efficiency + confidence
 * 4. Fetch opponent matchup defensive ranks
 * 5. Calculate injury impact
 * 6. Write enriched metrics back to Google Sheets
 *
 * Usage: node run-enrichment.js [league] [date]
 * Example: node run-enrichment.js NBA 2026-04-27
 *
 * Requires:
 * - npm install googleapis google-auth-library
 * - GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 * - PROPEDGE_SHEET_ID=your_sheet_id
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Google Sheets API
let sheetsClient = null;
async function getGoogleSheetsClient() {
  if (sheetsClient) return sheetsClient;
  try {
    const { google } = require('googleapis');
    const auth = new google.auth.GoogleAuth({
      keyFile: path.join(__dirname, 'credentials.json'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });
    sheetsClient = google.sheets({ version: 'v4', auth: await auth.getClient() });
    return sheetsClient;
  } catch (e) {
    Logger.error(`Google Sheets auth failed: ${e.message}`);
    return null;
  }
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  outputDir: path.join(__dirname, 'propedge-enriched'),
  logFile: path.join(__dirname, 'propedge-enrichment.log'),
  spreadsheetId: process.env.GOOGLE_SHEET_ID,
  outcomesFile: path.join(__dirname, 'outcomes.json'),  // Absolute path to outcomes.json
};

// Load outcomes from local file (synced from browser)
let OUTCOMES_DATA = {};
function loadOutcomes() {
  try {
    const fullPath = path.resolve(CONFIG.outcomesFile);
    Logger.log(`[DEBUG] Attempting to load outcomes from: ${fullPath}`);

    if (fs.existsSync(fullPath)) {
      const data = fs.readFileSync(fullPath, 'utf8');
      OUTCOMES_DATA = JSON.parse(data);
      const keys = Object.keys(OUTCOMES_DATA);
      Logger.log(`✓ Loaded ${keys.length} outcomes from ${CONFIG.outcomesFile}`);
      Logger.log(`[DEBUG] Outcomes keys: ${keys.join(', ')}`);
    } else {
      Logger.log(`⚠️  outcomes.json not found at ${fullPath} — using baseline 5% confidence`);
    }
  } catch (e) {
    Logger.error(`Failed to load outcomes: ${e.message}`);
  }
}

const LEAGUE_CONFIG = {
  NBA: {
    statTypes: ['points', 'rebounds', 'assists', 'threePointers'],
    minutesKey: 'minutes',
    roleMultipliers: { starter: 1.0, 'sixth-man': 0.85, bench: 0.65 },
  },
  NHL: {
    statTypes: ['goals', 'assists', 'shots'],
    minutesKey: 'timeOnIce',
    roleMultipliers: { starter: 1.0, 'third-line': 0.75, 'fourth-line': 0.55 },
  },
  MLB: {
    statTypes: ['hits', 'strikeouts', 'rbis'],
    minutesKey: 'atBats',
    roleMultipliers: { starter: 1.0, 'platoon': 0.65, bench: 0.4 },
  },
};

// ============================================================================
// LOGGER
// ============================================================================

class Logger {
  static log(msg) {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${msg}`;
    console.log(line);
    if (CONFIG.logFile) {
      fs.appendFileSync(CONFIG.logFile, line + '\n');
    }
  }

  static error(msg) {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ❌ ERROR: ${msg}`;
    console.error(line);
    if (CONFIG.logFile) {
      fs.appendFileSync(CONFIG.logFile, line + '\n');
    }
  }

  static success(msg) {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ✓ ${msg}`;
    console.log(line);
    if (CONFIG.logFile) {
      fs.appendFileSync(CONFIG.logFile, line + '\n');
    }
  }
}

// ============================================================================
// BAYESIAN CONFIDENCE CALCULATOR
// ============================================================================

function calculateBayesianConfidence(player, propType) {
  // propType: 'points', 'rebounds', 'assists', etc.
  // Returns: confidence % (5-95%)
  // STEP 2: Per-prop-type accuracy tracking — separate HIT/MISS by stat type

  // Find all outcomes for this player AND propType
  // Outcomes key format: "Player|StatType|Line" (e.g., "Tyrese Maxey|Points|19.5")
  const searchPattern = (player + '|' + propType + '|').toLowerCase();
  const playerOutcomes = Object.entries(OUTCOMES_DATA)
    .filter(([key]) => key.toLowerCase().startsWith(searchPattern))
    .map(([, data]) => data.status);

  // Debug logging (only for players with outcomes)
  if (playerOutcomes.length > 0) {
    Logger.log(`[DEBUG] Bayesian calc for ${player}/${propType}: found ${playerOutcomes.length} outcomes (${playerOutcomes.join(', ')})`);
  }

  if (playerOutcomes.length === 0) {
    return 5.0; // No outcomes yet, use baseline
  }

  // Bayesian update
  const hits = playerOutcomes.filter(s => s === 'HIT').length;
  const misses = playerOutcomes.filter(s => s === 'MISS').length;
  const total = hits + misses;

  let confidence;
  if (total < 3) {
    // Insufficient data: blend with baseline (5%) heavily
    const empirical = (hits / total) * 100;
    confidence = (empirical * 0.3) + (5 * 0.7);
  } else if (total < 10) {
    // Moderate data: blend empirical with baseline (5%)
    const empirical = (hits / total) * 100;
    confidence = (empirical * 0.6) + (5 * 0.4);
  } else {
    // Sufficient data: mostly trust empirical rate, cap at 95% max
    const empirical = (hits / total) * 100;
    confidence = Math.min(95, empirical);
  }

  Logger.log(`[DEBUG] ${player} confidence: ${confidence.toFixed(1)}% (${hits}H/${misses}M)`);
  return confidence;
}

// ============================================================================
// HTTP UTILITY
// ============================================================================

// Endpoint health tracker — logs all failures explicitly
const endpointHealth = {
  espn_nba: { attempts: 0, successes: 0, failures: [] },
  espn_nhl: { attempts: 0, successes: 0, failures: [] },
  espn_mlb: { attempts: 0, successes: 0, failures: [] },
  stats_nba: { attempts: 0, successes: 0, failures: [] },
  baseball_savant: { attempts: 0, successes: 0, failures: [] },
  espn_matchup: { attempts: 0, successes: 0, failures: [] },
};

async function httpGet(url, timeout = 15000, retries = 3) {
  let lastError;
  const urlHost = new URL(url).hostname;
  const startTime = Date.now();

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await new Promise((resolve, reject) => {
        const options = {
          timeout,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json',
            'Referer': 'https://www.nba.com/',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache'
          }
        };

        const req = https.get(url, options, (res) => {
          let data = '';
          res.on('data', chunk => (data += chunk));
          res.on('end', () => {
            try {
              const result = JSON.parse(data);
              // Track success
              const key = Object.keys(endpointHealth).find(k => urlHost.includes(k.split('_')[0]));
              if (key) endpointHealth[key].successes++;
              resolve(result);
            } catch (e) {
              reject(new Error(`JSON parse error: ${e.message}`));
            }
          });
        });

        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error(`Timeout: ${url}`));
        });
      });
    } catch (e) {
      lastError = e;
      const responseTime = Date.now() - startTime;

      if (attempt < retries) {
        Logger.log(`  ⚠️  Attempt ${attempt}/${retries} failed (${responseTime}ms): ${e.message.split('\n')[0]}`);
        // Exponential backoff: 1s, 2s, 4s
        await new Promise(r => setTimeout(r, 1000 * attempt));
      } else {
        // Track final failure
        const key = Object.keys(endpointHealth).find(k => urlHost.includes(k.split('_')[0]));
        if (key) {
          endpointHealth[key].attempts++;
          endpointHealth[key].failures.push({
            timestamp: new Date().toISOString(),
            error: e.message,
            responseTime,
          });
        }
      }
    }
  }

  throw lastError;
}

// ============================================================================
// INJURIES FETCHER
// ============================================================================

async function fetchInjuries(league) {
  try {
    let url;
    if (league === 'NBA') {
      url = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries';
    } else if (league === 'NHL') {
      url = 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/injuries';
    } else if (league === 'MLB') {
      url = 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/injuries';
    }

    const data = await httpGet(url);
    const injuries = {};

    if (data.teams) {
      data.teams.forEach(team => {
        team.athletes?.forEach(athlete => {
          if (athlete.injuries && athlete.injuries.length > 0) {
            const status = athlete.injuries[0].status || 'OUT';
            injuries[athlete.displayName] = {
              status,
              detail: athlete.injuries[0].detail || '',
              team: team.displayName,
              multiplier: status === 'Out' ? 0.8 : status === 'Probable' ? 0.95 : 1.0,
            };
          }
        });
      });
    }

    Logger.success(`Fetched ${Object.keys(injuries).length} injuries for ${league}`);
    return injuries;
  } catch (err) {
    Logger.error(`Injuries fetch failed: ${err.message}`);
    return {};
  }
}

// ============================================================================
// GAME SCHEDULE FETCHER (ESPN)
// ============================================================================

async function fetchGameSchedule(league, dateStr) {
  const schedule = {};
  const baseDate = new Date(dateStr);

  // Fetch games for ±3 days (completed + upcoming)
  for (let offset = -3; offset <= 3; offset++) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + offset);
    const dateFormatted = date.toISOString().split('T')[0].replace(/-/g, '');

    try {
      let url;
      if (league === 'NBA') {
        url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${dateFormatted}`;
      } else if (league === 'NHL') {
        url = `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard?dates=${dateFormatted}`;
      } else if (league === 'MLB') {
        url = `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${dateFormatted}`;
      }

      const data = await httpGet(url, 10000, 2);
      if (data.events && Array.isArray(data.events)) {
        data.events.forEach(event => {
          const home = event.competitions?.[0]?.competitors?.find(c => c.homeAway === 'home');
          const away = event.competitions?.[0]?.competitors?.find(c => c.homeAway === 'away');

          if (home && away) {
            const homeAbbr = home.team?.abbreviation || home.team?.id;
            const awayAbbr = away.team?.abbreviation || away.team?.id;

            if (homeAbbr && awayAbbr && !schedule[homeAbbr]) {
              schedule[homeAbbr] = awayAbbr;
              schedule[awayAbbr] = homeAbbr;
            }
          }
        });
      }
    } catch (e) {
      // Silent fail for other dates
    }
  }

  Logger.log(`  Loaded schedule: ${Object.keys(schedule).length} teams (±3 days)`);
  return schedule;
}

// ============================================================================
// GAME LOG FETCHER (balldontlie.io + nba_api fallback)
// ============================================================================

// NOTE: Public game-log APIs (balldontlie, nba_api, stats.nba.com) timeout or require auth.
// Using ESPN season stats as baseline. Real per-game confidence comes from outcome tracking.
// See propedge-outcomes.csv for user-marked hits/misses that build real sample size.

async function fetchGameLog(league, playerName, depth = 20) {
  try {
    let games = [];

    // OUTCOME-TRACKING-ONLY MODEL (May 2, 2026)
    // External APIs are unreliable (ESPN broken, stats.nba.com timeouts, alternatives 401/404)
    // Strategy: Use hardcoded baseline values. Real data comes from user marking props HIT/MISS.
    // Confidence: Always 5% (transparent baseline, calibrates from outcome tracking over 2-3 weeks)

    if (league === 'NBA') {
      // Hardcoded baseline: Generic NBA averages
      games = [{
        date: new Date().toISOString().split('T')[0],
        minutes: 25,
        points: 16,
        rebounds: 5,
        assists: 4,
        threePointers: 1.5,
        source: 'baseline', // Mark as baseline for transparency
      }];
    } else if (league === 'NHL') {
      // Hardcoded baseline: Generic NHL averages
      games = [{
        date: new Date().toISOString().split('T')[0],
        minutes: 900,
        goals: 0.3,
        assists: 0.4,
        shots: 2,
        source: 'baseline',
      }];
    } else if (league === 'MLB') {
      // Hardcoded baseline: Generic MLB averages
      games = [{
        date: new Date().toISOString().split('T')[0],
        atBats: 4,
        hits: 1,
        strikeouts: 1,
        rbis: 1,
        source: 'baseline',
      }];
    }

    return games;
  } catch (err) {
    Logger.error(`Game log fetch failed for ${playerName}: ${err.message}`);
    return [];
  }
}

// ============================================================================
// METRICS CALCULATION
// ============================================================================

function calculateMetrics(games, statKey, minutesKey = 'minutes', playerName = null, propType = null) {
  if (!games || games.length === 0) {
    return {
      perMinAvg: 0,
      perMinL5: 0,
      perMinL10: 0,
      variance: 0,
      confidence: 0,
      samples: 0,
    };
  }

  const validGames = games.filter(g => g[minutesKey] > 0);
  if (validGames.length === 0) {
    return { perMinAvg: 0, perMinL5: 0, perMinL10: 0, variance: 0, confidence: 0, samples: 0 };
  }

  // Per-minute rates
  const rates = validGames.map(g => g[minutesKey] > 0 ? (g[statKey] / g[minutesKey]) : 0);

  const allAvg = rates.reduce((a, b) => a + b, 0) / rates.length;
  const l5Avg = validGames.length >= 5
    ? rates.slice(0, 5).reduce((a, b) => a + b, 0) / 5
    : allAvg;
  const l10Avg = validGames.length >= 10
    ? rates.slice(0, 10).reduce((a, b) => a + b, 0) / 10
    : allAvg;

  // HOME/AWAY SPLITS
  const homeGames = validGames.filter(g => g.isHome);
  const awayGames = validGames.filter(g => !g.isHome);
  
  const homeRates = homeGames.map(g => g[minutesKey] > 0 ? (g[statKey] / g[minutesKey]) : 0);
  const awayRates = awayGames.map(g => g[minutesKey] > 0 ? (g[statKey] / g[minutesKey]) : 0);
  
  const perMinHome = homeRates.length > 0 ? homeRates.reduce((a, b) => a + b, 0) / homeRates.length : allAvg;
  const perMinAway = awayRates.length > 0 ? awayRates.reduce((a, b) => a + b, 0) / awayRates.length : allAvg;

  const variance = Math.sqrt(
    rates.reduce((sum, r) => sum + Math.pow(r - allAvg, 2), 0) / rates.length
  );

  // BAYESIAN CONFIDENCE (updated May 4, 2026)
  // If outcomes exist for this player, calculate Bayesian confidence
  // Otherwise default to 5% baseline
  const confidence = (playerName && propType)
    ? calculateBayesianConfidence(playerName, propType)
    : 5.0;

  return {
    perMinAvg: parseFloat(allAvg.toFixed(4)),
    perMinL5: parseFloat(l5Avg.toFixed(4)),
    perMinL10: parseFloat(l10Avg.toFixed(4)),
    perMinHome: parseFloat(perMinHome.toFixed(4)),
    perMinAway: parseFloat(perMinAway.toFixed(4)),
    variance: parseFloat(variance.toFixed(4)),
    confidence,
    samples: validGames.length,
  };
}

// ============================================================================
// MATCHUP INDEX FETCHER
// ============================================================================

async function fetchMatchupRanks(league, statType = 'points') {
  try {
    let ranks = {};
    const defensiveRanks = {
      'BOS': 1, 'DEN': 2, 'OKC': 3, 'LAL': 4, 'MIA': 5,
      'CLE': 6, 'NYK': 7, 'GSW': 8, 'SAC': 9, 'LAC': 10,
      'PHO': 11, 'MIL': 12, 'DAL': 13, 'CHI': 14, 'TOR': 15,
      'BRK': 16, 'NOP': 17, 'MEM': 18, 'POR': 19, 'ATL': 20,
      'WSH': 21, 'ORL': 22, 'IND': 23, 'UTA': 24, 'HOU': 25,
      'MIN': 26, 'PHI': 27, 'DET': 28, 'CHA': 29, 'SAS': 30
    };

    if (league === 'NBA') {
      // Try ESPN, but always use hardcoded defensive ranks as fallback
      try {
        const espnUrl = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams`;
        const data = await httpGet(espnUrl);
        if (data.teams && Array.isArray(data.teams) && data.teams.length > 0) {
          data.teams.forEach(team => {
            const abbr = team.abbreviation;
            const rank = defensiveRanks[abbr] || 15;
            ranks[abbr] = {
              rank,
              allowed: 110 - (rank * 1.5),
              scalar: ((30 - rank) / 30),
            };
          });
        }
      } catch (e) {
        // Silent fail, use hardcoded
      }

      // If ESPN failed, use hardcoded defensive ranks
      if (Object.keys(ranks).length === 0) {
        Object.entries(defensiveRanks).forEach(([abbr, rank]) => {
          ranks[abbr] = {
            rank,
            allowed: 110 - (rank * 1.5),
            scalar: ((30 - rank) / 30),
          };
        });
      }
    } else if (league === 'NHL') {
      // NHL: use hardcoded ranks (32 teams)
      const nhlRanks = {
        'BOS': 1, 'CAR': 2, 'TOR': 3, 'DAL': 4, 'COL': 5,
        'NYR': 6, 'EDM': 7, 'VAN': 8, 'LAK': 9, 'MIN': 10,
        'STL': 11, 'OTT': 12, 'CGY': 13, 'NJ': 14, 'PHI': 15,
        'WSH': 16, 'MTL': 17, 'ARI': 18, 'FLA': 19, 'BUF': 20,
        'TB': 21, 'NYI': 22, 'PIT': 23, 'CHI': 24, 'VGK': 25,
        'ANA': 26, 'SJ': 27, 'SEA': 28, 'UTA': 29, 'WPG': 30,
        'DET': 31, 'CBJ': 32
      };
      Object.entries(nhlRanks).forEach(([abbr, rank]) => {
        ranks[abbr] = {
          rank,
          allowed: 3 - (rank * 0.06),
          scalar: ((32 - rank) / 32),
        };
      });
    } else if (league === 'MLB') {
      // MLB: use hardcoded ranks (30 teams)
      const mlbRanks = {
        'HOU': 1, 'LAD': 2, 'NYY': 3, 'SD': 4, 'ARI': 5,
        'ATL': 6, 'PHI': 7, 'MIL': 8, 'SF': 9, 'CLE': 10,
        'BAL': 11, 'TB': 12, 'MIN': 13, 'CHW': 14, 'BOS': 15,
        'SEA': 16, 'COL': 17, 'STL': 18, 'LAA': 19, 'MIA': 20,
        'TOR': 21, 'NYM': 22, 'CIN': 23, 'TEX': 24, 'OAK': 25,
        'DET': 26, 'CHC': 27, 'KC': 28, 'WSH': 29, 'PIT': 30
      };
      Object.entries(mlbRanks).forEach(([abbr, rank]) => {
        ranks[abbr] = {
          rank,
          allowed: 4.5 - (rank * 0.1),
          scalar: ((30 - rank) / 30),
        };
      });
    }

    Logger.success(`Fetched matchup ranks for ${league} (${Object.keys(ranks).length} teams)`);
    return ranks;
  } catch (err) {
    Logger.error(`Matchup fetch failed: ${err.message}`);
    return {};
  }
}

// ============================================================================
// MAIN ENRICHMENT ENGINE
// ============================================================================

async function runEnrichment(league = 'NBA', date = new Date().toISOString().split('T')[0]) {
  Logger.log(`\n${'='.repeat(70)}`);
  Logger.log(`Starting PropEdge Enrichment: ${league} ${date}`);
  Logger.log(`${'='.repeat(70)}`);
  Logger.log(`Strategy: OUTCOME-TRACKING WITH BAYESIAN UPDATES (May 4, 2026)`);
  Logger.log(`• Base confidence: 5% (transparent baseline)`);
  Logger.log(`• Dynamic confidence: Bayesian update from user HIT/MISS marks`);
  Logger.log(`• <3 outcomes: blend 30% empirical + 70% baseline`);
  Logger.log(`• 3-9 outcomes: blend 60% empirical + 40% baseline`);
  Logger.log(`• 10+ outcomes: mostly empirical (capped at 95%)`);
  Logger.log(`${'='.repeat(70)}\n`);

  // Load outcomes from sync service
  loadOutcomes();

  try {
    // Step 1: Fetch injuries
    Logger.log('Step 1/5: Fetching injuries...');
    const injuries = await fetchInjuries(league);

    // Step 1b: Fetch game schedule for opponent lookup
    Logger.log('Step 1b/5: Fetching game schedule...');
    const schedule = await fetchGameSchedule(league, date);

    // Step 2: Fetch matchup data
    Logger.log('Step 2/5: Fetching matchup ranks...');
    const matchups = {};
    for (const stat of LEAGUE_CONFIG[league].statTypes) {
      matchups[stat] = await fetchMatchupRanks(league, stat);
    }

    // Step 3: Load all players from Google Sheets
    Logger.log('Step 3/5: Loading players from Google Sheets...');
    let players = [];

    try {
      const sheets = await getGoogleSheetsClient();
      if (sheets && CONFIG.spreadsheetId) {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: CONFIG.spreadsheetId,
          range: `${league}!A:Z`
        });

        const rows = response.data.values || [];
        if (rows.length > 1) {
          const headers = rows[0].map(h => h.toLowerCase().trim());
          const playerIdx = headers.findIndex(h => h.includes('player'));
          const propIdx = headers.findIndex(h => h.includes('prop') && !h.includes('score'));
          const lineIdx = headers.findIndex(h => h === 'line');
          const teamIdx = headers.findIndex(h => h === 'team');
          const opponentIdx = headers.findIndex(h => h.includes('opponent'));

          if (playerIdx >= 0 && propIdx >= 0) {
            // Load all rows from sheet
            for (let i = 1; i < Math.min(rows.length, 1000); i++) {
              const row = rows[i];
              if (row[playerIdx] && row[propIdx]) {
                players.push({
                  name: row[playerIdx].trim(),
                  prop: row[propIdx].trim(),
                  line: lineIdx >= 0 ? parseFloat(row[lineIdx]) || 0 : 0,
                  team: teamIdx >= 0 ? (row[teamIdx] || '').trim() : '',
                  opponent: opponentIdx >= 0 ? (row[opponentIdx] || '').trim() : '',
                });
              }
            }
            Logger.log(`  Loaded ${players.length} players from ${league} sheet`);
          }
        }
      }
    } catch (e) {
      Logger.error(`Google Sheets load failed: ${e.message}. Falling back to empty list.`);
    }

    // Fallback: if no players loaded, use empty and just fetch enrichment for any scraped props
    if (players.length === 0) {
      Logger.warning(`No players found in ${league} sheet — enrichment will be incomplete`);
    }

    const enrichedPlayers = [];
    for (const p of players) {
      Logger.log(`  Enriching: ${p.name} (${p.prop})`);

      const games = await fetchGameLog(league, p.name, 20);

      // Normalize stat key: "Points Over 28.5" -> "points", "o19.5 Points" -> "points", "Rebounds" -> "rebounds"
      let statKey = p.prop.toLowerCase()
        .replace(/^[ou]\d+\.?\d*\s+/i, '') // Remove "o9.5 " or "u8.5 " prefix at start
        .replace(/\s+over\s+[\d.]+/i, '') // Remove "over X"
        .replace(/\s+under\s+[\d.]+/i, '') // Remove "under X"
        .trim();

      // Map common stat abbreviations to game object keys
      const statMap = {
        'point': 'points',
        'rebound': 'rebounds',
        'assist': 'assists',
        'three': 'threePointers',
        '3pt': 'threePointers',
        'goal': 'goals',
        'shot': 'shots',
        'hit': 'hits',
        'strikeout': 'strikeouts',
        'rbi': 'rbis',
      };

      // Find matching stat key in game object
      let gameStatKey = statKey;
      for (const [pattern, gameKey] of Object.entries(statMap)) {
        if (statKey.includes(pattern)) {
          gameStatKey = gameKey;
          break;
        }
      }

      // DEBUG: Show what's being passed to calculateMetrics
      Logger.log(`[DEBUG] calculateMetrics call: playerName="${p.name}", propType="${statKey}", gameStatKey="${gameStatKey}"`);

      const metrics = calculateMetrics(games, gameStatKey, 'minutes', p.name, statKey);
      const injuryData = injuries[p.name] || { status: 'Available', multiplier: 1.0 };

      // Use opponent from game schedule (auto-fetched from ESPN), fallback to sheet
      const opponent = schedule[p.team] || p.opponent;
      const matchupRank = matchups[gameStatKey]?.[opponent] || { rank: 15, scalar: 0.5 };

      enrichedPlayers.push({
        ...p,
        opponent,  // Use fetched opponent from schedule
        ...metrics,
        injuryStatus: injuryData.status,
        injuryMultiplier: injuryData.multiplier,
        matchupRank: matchupRank.rank,
        matchupScalar: matchupRank.scalar,
        expectedMinutes: Math.round(metrics.perMinL5 > 0 ? 32 / (metrics.perMinL5 * 1.0) : 32),
      });
    }

    Logger.success(`Enriched ${enrichedPlayers.length} players`);

    // Step 4: Output enriched CSV
    Logger.log('Step 4/5: Writing enriched data...');
    if (!fs.existsSync(CONFIG.outputDir)) {
      fs.mkdirSync(CONFIG.outputDir, { recursive: true });
    }

    const filename = path.join(CONFIG.outputDir, `propedge-enriched-${league}-${date}.csv`);
    const headers = [
      'Name', 'Prop', 'Line', 'Team', 'Opponent',
      'Per_Min_Avg', 'Per_Min_L5', 'Per_Min_L10',
      'Per_Min_Home', 'Per_Min_Away',
      'Variance', 'Confidence%', 'Samples',
      'Injury_Status', 'Injury_Multiplier',
      'Matchup_Rank', 'Matchup_Scalar', 'Expected_Minutes',
    ];

    const csv = [headers.join(',')];
    enrichedPlayers.forEach(p => {
      const row = [
        p.name, p.prop, p.line, p.team, p.opponent,
        p.perMinAvg, p.perMinL5, p.perMinL10,
        p.perMinHome, p.perMinAway,
        p.variance, p.confidence, p.samples,
        p.injuryStatus, p.injuryMultiplier,
        p.matchupRank, p.matchupScalar, p.expectedMinutes,
      ];
      csv.push(row.join(','));
    });

    fs.writeFileSync(filename, csv.join('\n'), 'utf-8');
    Logger.success(`Wrote enriched data: ${filename}`);

    Logger.log(`\n${'='.repeat(70)}`);
    Logger.success(`Enrichment complete. Ready for PropEdge ingestion.`);
    Logger.log(`${'='.repeat(70)}\n`);

    return { filename, enrichedPlayers };
  } catch (err) {
    Logger.error(`Enrichment failed: ${err.message}`);
    process.exit(1);
  }
}

// ============================================================================
// ENTRY POINT
// ============================================================================

if (require.main === module) {
  const league = process.argv[2] || 'NBA';
  const date = process.argv[3] || new Date().toISOString().split('T')[0];

  // Start outcomes-sync service in background if not already running
  try {
    const http = require('http');
    http.get('http://localhost:3001/api/outcomes', (res) => {
      // Service already running
      console.log('✓ Outcomes sync service already running');
      runEnrichment(league, date); // FIX: Run enrichment immediately if service is up
    }).on('error', () => {
      // Service not running, start it
      console.log('Starting outcomes sync service...');
      const { spawn } = require('child_process');
      const syncProcess = spawn('node', ['outcomes-sync.js'], {
        cwd: __dirname,
        detached: true,
        stdio: 'ignore',
      });
      syncProcess.unref();
      setTimeout(() => runEnrichment(league, date), 2000); // Wait for service to start
    });
  } catch (e) {
    runEnrichment(league, date);
  }
}

module.exports = { runEnrichment };
