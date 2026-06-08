#!/usr/bin/env node

/**
 * PropEdge Enrichment v3 - Direct CSV + RapidAPI Fallback
 *
 * New workflow:
 * 1. Accept PropFinder CSV export as input
 * 2. Extract stats directly from PropFinder CSV (L5 Avg, L10 Avg columns)
 * 3. For MLB without PropFinder data, fetch from RapidAPI Baseball Data
 * 4. Calculate per-minute efficiency from extracted data
 * 5. Apply Bayesian confidence from outcomes.json (user HIT/MISS marks)
 * 6. Use baseline values where all sources unavailable
 * 7. Output enrichment CSV with all players — 100% coverage
 *
 * Usage: node run-enrichment-v2.js [propfinder-csv-path] [league] [date]
 * Example: node run-enrichment-v2.js /tmp/propfinder-nba.csv NBA 2026-05-04
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
require('dotenv').config();

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  outputDir: path.join(__dirname, 'propedge-enriched'),
  logFile: path.join(__dirname, 'propedge-enrichment.log'),
  outcomesFile: path.join(__dirname, 'outcomes.json'),
  parallelWorkers: 15,  // Fetch player stats concurrently
  playerFetchTimeout: 5000,  // 5s per player page
  statsParseRetries: 2,
};

// League baseline values (position/season averages for missing data)
const BASELINE_STATS = {
  NBA: {
    points: { avg: 15.2, l5: 15.0, variance: 4.2 },
    rebounds: { avg: 5.8, l5: 5.9, variance: 2.1 },
    assists: { avg: 4.3, l5: 4.2, variance: 1.9 },
    threepointers: { avg: 2.1, l5: 2.0, variance: 1.3 },
  },
  NHL: {
    goals: { avg: 0.5, l5: 0.48, variance: 0.35 },
    assists: { avg: 0.8, l5: 0.82, variance: 0.45 },
    shots: { avg: 2.9, l5: 2.95, variance: 1.2 },
  },
  MLB: {
    hits: { avg: 1.2, l5: 1.25, variance: 0.6 },
    strikeouts: { avg: 0.8, l5: 0.75, variance: 0.45 },
    rbis: { avg: 0.7, l5: 0.72, variance: 0.4 },
  },
};

// ============================================================================
// LOGGER
// ============================================================================

class Logger {
  static log(msg) {
    const ts = new Date().toISOString();
    const line = `[${ts}] ${msg}`;
    console.log(line);
    try { fs.appendFileSync(CONFIG.logFile, line + '\n'); } catch (e) {}
  }

  static error(msg) {
    const ts = new Date().toISOString();
    const line = `[${ts}] ❌ ${msg}`;
    console.error(line);
    try { fs.appendFileSync(CONFIG.logFile, line + '\n'); } catch (e) {}
  }

  static success(msg) {
    const ts = new Date().toISOString();
    const line = `[${ts}] ✅ ${msg}`;
    console.log(line);
    try { fs.appendFileSync(CONFIG.logFile, line + '\n'); } catch (e) {}
  }
}

// ============================================================================
// OUTCOMES & BAYESIAN CONFIDENCE
// ============================================================================

let OUTCOMES_DATA = {};

function loadOutcomes() {
  try {
    if (fs.existsSync(CONFIG.outcomesFile)) {
      OUTCOMES_DATA = JSON.parse(fs.readFileSync(CONFIG.outcomesFile, 'utf8'));
      Logger.log(`✓ Loaded ${Object.keys(OUTCOMES_DATA).length} outcomes`);
    } else {
      Logger.log(`⚠️  outcomes.json not found — using baseline 5% confidence`);
    }
  } catch (e) {
    Logger.error(`Failed to load outcomes: ${e.message}`);
  }
}

function calculateBayesianConfidence(playerName, statType) {
  // Match: "Player|Stat|Line" keys
  const searchPrefix = (playerName + '|' + statType + '|').toLowerCase();
  const outcomes = Object.entries(OUTCOMES_DATA)
    .filter(([key]) => key.toLowerCase().startsWith(searchPrefix))
    .map(([, data]) => data.status);

  if (outcomes.length === 0) return 5.0;

  const hits = outcomes.filter(s => s === 'HIT').length;
  const total = outcomes.length;
  const empirical = (hits / total) * 100;

  // Blend empirical with 5% baseline based on sample size
  if (total < 3) {
    return (empirical * 0.3) + (5 * 0.7);
  } else if (total < 10) {
    return (empirical * 0.6) + (5 * 0.4);
  } else {
    return Math.min(95, empirical);
  }
}

// ============================================================================
// CSV PARSING
// ============================================================================

function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return { headers: [], data: [] };

  // Improved CSV parsing: handle quoted fields and trim whitespace
  const parseRow = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') inQuotes = !inQuotes;
      else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
      else current += char;
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseRow(lines[0]);
  const data = lines.slice(1).map(parseRow);

  return { headers, data };
}

function extractPlayersFromCSV(csvPath) {
  try {
    const csvText = fs.readFileSync(csvPath, 'utf8');
    const { headers, data } = parseCSV(csvText);

    Logger.log(`CSV has ${headers.length} headers: ${headers.join(', ')}`);
    Logger.log(`CSV has ${data.length} data rows`);

    const playerIdx = headers.findIndex(h => h.toLowerCase().includes('player'));
    const propIdx = headers.findIndex(h => h.toLowerCase().includes('prop'));

    if (playerIdx < 0 || propIdx < 0) {
      Logger.error(`CSV missing Player or Prop columns — Headers: ${headers.join(' | ')}`);
      return [];
    }

    Logger.log(`Found Player column at index ${playerIdx}, Prop column at index ${propIdx}`);

    // Extract unique players
    const players = new Set();
    let validRows = 0;
    data.forEach((row, idx) => {
      if (row[playerIdx] && row[propIdx]) {
        players.add(row[playerIdx].trim());
        validRows++;
      }
    });

    Logger.log(`Extracted ${players.size} unique players from ${validRows}/${data.length} valid rows`);
    return Array.from(players);
  } catch (e) {
    Logger.error(`Failed to parse CSV: ${e.message}`);
    return [];
  }
}

// ============================================================================
// STATS EXTRACTION (Direct CSV + RapidAPI Fallback)
// ============================================================================

function extractStatsFromCSV(csvPath, league) {
  // Extract L5 Avg, L10 Avg, and season averages directly from PropFinder CSV
  // Returns: { playerName: { l5Avg, l10Avg, seasonAvg, variance } }
  // Uses FUZZY matching for column names to handle PropFinder schema drift

  try {
    const csvText = fs.readFileSync(csvPath, 'utf8');
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return {};

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const playerIdx = headers.findIndex(h => h.includes('player'));

    // FUZZY MATCH for L5/L10 columns (case-insensitive, handle variations)
    const l5Idx = headers.findIndex(h =>
      h === 'l5 avg' || h === 'l5avg' || h.match(/l5\s*avg/i)
    );
    const l10Idx = headers.findIndex(h =>
      h === 'l10 avg' || h === 'l10avg' || h.match(/l10\s*avg/i)
    );
    const propIdx = headers.findIndex(h => h.includes('prop'));

    if (playerIdx < 0 || (l5Idx < 0 && l10Idx < 0)) {
      Logger.log(`⚠️  PropFinder CSV headers: ${headers.join(' | ')}`);
      Logger.log(`⚠️  PropFinder CSV missing L5/L10 columns — using baselines only`);
      return {};
    }

    Logger.log(`✓ Found columns: Player(${playerIdx}), L5(${l5Idx}), L10(${l10Idx}), Prop(${propIdx})`);

    const stats = {};
    lines.slice(1).forEach(line => {
      const row = line.split(',').map(v => v.trim());
      const player = row[playerIdx];
      if (!player) return;

      const l5 = l5Idx >= 0 ? parseFloat(row[l5Idx]) : null;
      const l10 = l10Idx >= 0 ? parseFloat(row[l10Idx]) : null;

      if (!stats[player]) {
        stats[player] = {
          l5Avg: !isNaN(l5) && l5 > 0 ? l5 : null,
          l10Avg: !isNaN(l10) && l10 > 0 ? l10 : null,
          seasonAvg: !isNaN(l10) && l10 > 0 ? l10 : null,  // Use L10 as season proxy
          variance: null,
          source: 'propfinder-csv'
        };
      }
    });

    const found = Object.keys(stats).filter(p => stats[p].l5Avg || stats[p].l10Avg).length;
    Logger.success(`Extracted stats from PropFinder CSV: ${found}/${Object.keys(stats).length} players with data`);
    return stats;
  } catch (e) {
    Logger.error(`Failed to extract stats from CSV: ${e.message}`);
    return {};
  }
}

async function fetchMLBStatsFromRapidAPI(playerName, sport = 'MLB') {
  // Fetch MLB player stats from RapidAPI Baseball Data API
  // Returns: { l5Avg, seasonAvg, variance } or null

  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    Logger.log(`⚠️  RAPIDAPI_KEY not set — using baselines for ${playerName}`);
    return null;
  }

  return new Promise((resolve) => {
    const options = {
      hostname: 'baseball-data1.p.rapidapi.com',
      path: `/player?name=${encodeURIComponent(playerName)}&season=2025`,
      method: 'GET',
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': 'baseball-data1.p.rapidapi.com'
      },
      timeout: 3000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json && json.stats) {
            const s = json.stats;
            resolve({
              l5Avg: s.last5Games ? (s.last5Games.avg || s.avg) : null,
              seasonAvg: s.avg || null,
              variance: Math.abs((s.last5Games?.avg || s.avg) - s.avg) || null,
              source: 'rapidapi-mlb'
            });
            return;
          }
          resolve(null);
        } catch (_) { resolve(null); }
      });
    });

    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });
}

async function enrichPlayerStatsWithFallback(playerName, league, csvStats) {
  // If CSV has stats, use them. Otherwise, try RapidAPI for MLB
  if (csvStats[playerName]) {
    return csvStats[playerName];
  }

  if (league === 'MLB') {
    const rapidStats = await fetchMLBStatsFromRapidAPI(playerName);
    if (rapidStats) {
      return rapidStats;
    }
  }

  return null;  // Will use baseline
}

// ============================================================================
// ENRICHMENT GENERATION
// ============================================================================

function getBaseline(league, statType) {
  const config = BASELINE_STATS[league] || BASELINE_STATS.NBA;
  return config[statType.toLowerCase()] || { avg: 5, l5: 5, variance: 2 };
}

function normalizeStatType(propName) {
  // "Points Over 28.5" -> "points"
  // "o19.5 Rebounds" -> "rebounds"
  return propName
    .toLowerCase()
    .replace(/^[ou]\d+\.?\d*\s+/i, '')
    .replace(/\s+over\s+[\d.]+/i, '')
    .replace(/\s+under\s+[\d.]+/i, '')
    .trim();
}

function calculateMatchupScalar(perMinL5, perMinAvg, variance) {
  // Standardized matchup scalar calculation across NBA/NHL/MLB
  // Formula: Normalize recent (L5) vs season average, scaled 0.5–1.5
  //
  // Logic:
  // - If L5 > season avg: player is hot, scalar increases to 1.5 max
  // - If L5 = season avg: neutral, scalar = 1.0
  // - If L5 < season avg: player is cold, scalar decreases to 0.5 min
  //
  // Variance smoothing: Higher variance = less confident in trend, dampen magnitude

  if (!perMinL5 || !perMinAvg || perMinAvg === 0) {
    return 1.0;  // Neutral: no data or missing
  }

  const ratio = perMinL5 / perMinAvg;  // < 1 = cold, > 1 = hot
  const varianceDamp = Math.min(1, variance / (perMinAvg * 2));  // 0–1 damping factor

  // Linear interpolation: 0.5 (cold) ← 1.0 (neutral) → 1.5 (hot)
  let scalar = 1.0 + ((ratio - 1.0) * 0.5);  // Dampen magnitude to ±0.5 range

  // Apply variance dampening: high variance = weaker signal
  scalar = 1.0 + ((scalar - 1.0) * (1 - varianceDamp));

  // Clamp: 0.5 min, 1.5 max
  return Math.max(0.5, Math.min(1.5, scalar));
}

function enrichPlayer(playerName, propType, playerStats, league) {
  const baseline = getBaseline(league, propType);
  const stats = playerStats[playerName] || {};

  // Use real data if available, fall back to baseline
  const perMinL5 = stats.l5Avg || baseline.l5;
  const perMinAvg = stats.seasonAvg || baseline.avg;
  const variance = stats.variance || baseline.variance;

  // Calculate samples (proxy for confidence stability)
  const samples = stats.l5Avg ? 5 : 1;  // 5 games if we have data, else 1 (baseline)

  const confidence = calculateBayesianConfidence(playerName, propType);

  // Calculate standardized matchup scalar
  const matchupScalar = calculateMatchupScalar(perMinL5, perMinAvg, variance);

  return {
    perMinL5: perMinL5.toFixed(2),
    perMinAvg: perMinAvg.toFixed(2),
    variance: variance.toFixed(2),
    confidence: confidence.toFixed(1),
    matchupScalar: matchupScalar.toFixed(2),
    samples: samples,
  };
}

// ============================================================================
// MAIN ENRICHMENT FUNCTION
// ============================================================================

async function enrichCSV(csvPath, league, date) {
  Logger.log(`\n${'='.repeat(70)}`);
  Logger.log(`PropEdge Enrichment v3 — Direct CSV + RapidAPI Fallback`);
  Logger.log(`CSV: ${csvPath} | League: ${league} | Date: ${date}`);
  Logger.log(`${'='.repeat(70)}\n`);

  // Step 1: Load outcomes (Bayesian confidence)
  loadOutcomes();

  // Step 2: Extract players from CSV
  const players = extractPlayersFromCSV(csvPath);
  if (players.length === 0) {
    Logger.error(`No players found in CSV`);
    process.exit(1);
  }

  // Step 3: Extract stats directly from PropFinder CSV (no scraping)
  Logger.log(`Extracting stats directly from PropFinder CSV columns...`);
  const csvStats = extractStatsFromCSV(csvPath, league);

  // Step 4: Read CSV and enrich each row with fallback to RapidAPI for MLB
  const csvText = fs.readFileSync(csvPath, 'utf8');
  const { headers, data } = parseCSV(csvText);

  const playerIdx = headers.findIndex(h => h.toLowerCase().includes('player'));
  const propIdx = headers.findIndex(h => h.toLowerCase().includes('prop'));
  const lineIdx = headers.findIndex(h => h.toLowerCase().includes('line'));
  const teamIdx = headers.findIndex(h => h.toLowerCase().includes('team'));
  const opponentIdx = headers.findIndex(h => h.toLowerCase().includes('opponent'));

  const enrichedHeaders = [
    'Name', 'Prop', 'Line', 'Team', 'Opponent',
    'Per_Min_L5', 'Per_Min_Avg', 'Variance',
    'Confidence%', 'Matchup Scalar', 'Samples',
  ];

  const enrichedData = [];
  let statsUsed = 0;

  for (const row of data) {
    const playerName = row[playerIdx]?.trim() || '';
    const propName = row[propIdx]?.trim() || '';
    const statType = normalizeStatType(propName);

    if (!playerName || !propName) continue;

    // Try CSV stats first, then RapidAPI for MLB, then fallback
    let playerStats = await enrichPlayerStatsWithFallback(playerName, league, csvStats);
    if (playerStats) statsUsed++;

    const enrichment = enrichPlayer(playerName, statType, playerStats ? { [playerName]: playerStats } : {}, league);

    enrichedData.push([
      playerName,
      propName,
      lineIdx >= 0 ? (row[lineIdx] || '') : '',
      teamIdx >= 0 ? (row[teamIdx] || '') : '',
      opponentIdx >= 0 ? (row[opponentIdx] || '') : '',
      enrichment.perMinL5,
      enrichment.perMinAvg,
      enrichment.variance,
      enrichment.confidence,
      enrichment.matchupScalar,
      enrichment.samples,
    ]);
  }

  // Step 5: Write output CSV
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }

  const outputPath = path.join(CONFIG.outputDir, `propedge-enriched-${league}-${date}.csv`);
  const csvOutput = [enrichedHeaders.join(','), ...enrichedData.map(row => row.join(','))].join('\n');
  fs.writeFileSync(outputPath, csvOutput, 'utf8');

  const coverage = enrichedData.length > 0 ? ((statsUsed / enrichedData.length) * 100).toFixed(1) : '0';
  Logger.success(`Enriched ${enrichedData.length} props with stats coverage ${coverage}%`);
  Logger.success(`Output: ${outputPath}`);
  Logger.log(`Enrichment Summary: ${statsUsed}/${enrichedData.length} props with real stats, ${enrichedData.length - statsUsed} on baselines`);

  return {
    outputPath,
    enrichedCount: enrichedData.length,
    statsFound: statsUsed,
    coverage: coverage + '%'
  };
}

// ============================================================================
// ENTRY POINT
// ============================================================================

if (require.main === module) {
  const csvPath = process.argv[2];
  const league = process.argv[3] || 'NBA';
  const date = process.argv[4] || new Date().toISOString().split('T')[0];

  if (!csvPath || !fs.existsSync(csvPath)) {
    Logger.error(`Usage: node run-enrichment-v2.js <csv-path> [league] [date]`);
    Logger.error(`CSV file not found: ${csvPath}`);
    process.exit(1);
  }

  enrichCSV(csvPath, league, date)
    .then(result => {
      Logger.success(`\nEnrichment complete!`);
      Logger.success(`  Output: ${result.outputPath}`);
      Logger.success(`  Props enriched: ${result.enrichedCount}`);
      Logger.success(`  Real stats found: ${result.statsFound} players (${result.coverage} coverage)`);
      process.exit(0);
    })
    .catch(err => {
      Logger.error(`Fatal error: ${err.message}`);
      process.exit(1);
    });
}

module.exports = { enrichCSV, extractPlayersFromCSV };
