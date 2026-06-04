/**
 * PropFinder Auto-Sync Scraper v15 — Integrated with Enrichment
 * ==============================================================
 *
 * Based on v14 with enrichment integration:
 *  - Loads PropFinder props (login → FanDuel selection → CSV export)
 *  - Loads enrichment data from propedge-enriched/ folder
 *  - Merges by player name + prop name
 *  - Writes merged data (FD lines + enrichment metrics) to Google Sheets
 *
 * Usage: node scraper-v15-integrated.js            (headless)
 *        node scraper-v15-integrated.js --visible  (show browser)
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const puppeteer = require('puppeteer-core');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// ─── Chrome discovery ────────────────────────────────────────────────────────

function findChrome() {
  const possiblePaths = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
  for (const chromePath of possiblePaths) {
    try {
      if (fs.existsSync(chromePath)) {
        console.log(`✅ Found Chrome at: ${chromePath}`);
        return chromePath;
      }
    } catch (e) {}
  }
  console.log('⚠️  Chrome not found at common paths — defaulting to macOS standard path');
  return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';  // Default macOS path
}

const CHROME_PATH = findChrome();
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const CAPTURE_MODE   = process.argv.includes('--capture');
const RESET_BOOKS    = process.argv.includes('--reset-books');
const SETTINGS_FILE  = path.join(__dirname, 'propfinder-settings-api.json');
const PROFILE_DIR    = path.join(__dirname, 'chrome-profile');
const PROFILE_STATE  = path.join(__dirname, 'profile-state.json');
const ENRICHMENT_DIR = path.join(__dirname, 'propedge-enriched');

const CONFIG = {
  email:           process.env.PROPFINDER_EMAIL,
  password:        process.env.PROPFINDER_PASSWORD,
  spreadsheetId:   process.env.GOOGLE_SHEET_ID,
  archiveSheetId:  process.env.GOOGLE_ARCHIVE_SHEET_ID,
  leagues:         ['NBA', 'NHL', 'MLB'],
  downloadPath:    path.join(process.env.HOME, 'Downloads'),
  headless:        !process.argv.includes('--visible') && !CAPTURE_MODE,
  viewport:        { width: 1400, height: 900 }
};

let archiveDisabledThisRun = false;

const FILTERS = {
  pfRatingMin: 0,   // PropFinder CSV not populating PF Rating — accept all
  l5AvgMin:    0,
  l10AvgMin:   0,
  oddsMin:     -400,
  oddsMax:     400
};

function log(msg, indent = 0) {
  console.log(`[${new Date().toLocaleTimeString()}] ${'  '.repeat(indent)}${msg}`);
}
function logSuccess(msg, indent = 0) { log(`✅ ${msg}`, indent); }
function logWarning(msg, indent = 0) { log(`⚠️  ${msg}`, indent); }
function logError(msg, indent = 0)   { log(`❌ ${msg}`, indent); }

// ─── Google Sheets ───────────────────────────────────────────────────────────

async function getGoogleSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, 'credentials.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  return google.sheets({ version: 'v4', auth: await auth.getClient() });
}

async function ensureTabExists(sheets, tabName) {
  try {
    // Get all sheets in the spreadsheet
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: CONFIG.spreadsheetId
    });

    const sheets_list = spreadsheet.data.sheets || [];
    const tabExists = sheets_list.some(s => s.properties.title === tabName);

    if (tabExists) {
      return true;
    }

    // Tab doesn't exist, create it
    log(`Tab ${tabName} doesn't exist, creating...`, 2);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: CONFIG.spreadsheetId,
      resource: {
        requests: [{
          addSheet: {
            properties: {
              title: tabName
            }
          }
        }]
      }
    });
    logSuccess(`Created ${tabName} tab`, 2);
    return true;
  } catch (e) {
    logError(`Failed to ensure tab ${tabName} exists: ${e.message}`, 2);
    return false;
  }
}

async function writeToSheet(sheets, tabName, headers, dataRows) {
  // Ensure tab exists first
  const tabOk = await ensureTabExists(sheets, tabName);
  if (!tabOk) {
    logError(`Cannot write to ${tabName}: tab creation failed`, 2);
    return false;
  }

  log(`Writing to Google Sheet tab: ${tabName}`, 1);
  try {
    await sheets.spreadsheets.values.clear({
      spreadsheetId: CONFIG.spreadsheetId,
      range: `${tabName}!A:Z`
    });
    log('Cleared existing data', 2);

    const values = [headers, ...dataRows];
    await sheets.spreadsheets.values.update({
      spreadsheetId: CONFIG.spreadsheetId,
      range: `${tabName}!A1`,
      valueInputOption: 'RAW',
      resource: { values }
    });
    logSuccess(`Written ${dataRows.length} rows to ${tabName}`, 2);
    return true;
  } catch (e) {
    logError(`Write failed: ${e.message}`, 2);
    return false;
  }
}

async function archiveOldData(sheets, tabName) {
  log(`Archiving old data from ${tabName}...`, 1);

  if (archiveDisabledThisRun) {
    logWarning('Archive disabled for this run after earlier archive-sheet capacity failure', 2);
    return false;
  }

  if (!CONFIG.archiveSheetId) {
    logWarning('GOOGLE_ARCHIVE_SHEET_ID not set — skipping archive', 2);
    return true;
  }

  const archiveTabName = `Archive_${tabName}`;

  try {
    // Read existing data from main sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: CONFIG.spreadsheetId,
      range: `${tabName}!A:Z`
    });

    const existingData = response.data.values || [];
    if (existingData.length === 0) {
      log(`No data to archive from ${tabName}`, 2);
      return true;
    }

    log(`Found ${existingData.length} rows to archive`, 2);

    // Try to append to archive sheet (separate workbook)
    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId: CONFIG.archiveSheetId,
        range: `${archiveTabName}!A:Z`,
        valueInputOption: 'RAW',
        resource: { values: existingData }
      });
      logSuccess(`Archived ${existingData.length} rows to Archive Sheet/${archiveTabName}`, 2);
    } catch (appendError) {
      // Archive tab may not exist; try to create it first
      if (appendError.message.includes('Unable to parse range')) {
        log(`Archive tab ${archiveTabName} doesn't exist, creating...`, 2);

        // Create new sheet (tab) in ARCHIVE sheet
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: CONFIG.archiveSheetId,
          resource: {
            requests: [{
              addSheet: {
                properties: {
                  title: archiveTabName
                }
              }
            }]
          }
        });
        logSuccess(`Created Archive Sheet/${archiveTabName} tab`, 2);

        // Now append the data
        await sheets.spreadsheets.values.append({
          spreadsheetId: CONFIG.archiveSheetId,
          range: `${archiveTabName}!A:Z`,
          valueInputOption: 'RAW',
          resource: { values: existingData }
        });
        logSuccess(`Archived ${existingData.length} rows to Archive Sheet/${archiveTabName}`, 2);
      } else {
        throw appendError;
      }
    }

    return true;
  } catch (e) {
    logWarning(`Archive failed for ${tabName}: ${e.message}`, 2);
    if (/limit of 10000000 cells|increase the number of cells/i.test(e.message)) {
      archiveDisabledThisRun = true;
      logWarning('Archive workbook is at Google Sheets 10M-cell limit; skipping remaining archive writes this run', 2);
    }
    return false;
  }
}

// Game-level columns added directly to main sheet (avoids separate archive)
function addGameLevelColumns(headers, data) {
  // Add game_date and opponent_est columns to enriched data
  const today = new Date().toISOString().split('T')[0];
  const newHeaders = [...headers, 'game_date', 'opponent_est'];

  const newData = data.map(row => {
    // Extract opponent from team context (simple heuristic: use team's current opponent)
    // For now, just mark as scraped today — opponent inference needs NBA API
    const opponent = ''; // TODO: integrate opponent data from generate-matchups endpoint
    return [...row, today, opponent];
  });

  return { headers: newHeaders, data: newData };
}

// ─── CSV parsing & filtering ─────────────────────────────────────────────────

function parseCSV(text) {
  return text.trim().split('\n').map(line => {
    const result = [];
    let current = '', inQuotes = false;
    for (const char of line) {
      if (char === '"') inQuotes = !inQuotes;
      else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
      else current += char;
    }
    result.push(current.trim());
    return result;
  });
}

function findLatestCSV(maxAgeMs = 60000) {
  try {
    const files = fs.readdirSync(CONFIG.downloadPath)
      .filter(f => f.endsWith('.csv'))
      .map(f => ({
        name: f,
        path: path.join(CONFIG.downloadPath, f),
        time: fs.statSync(path.join(CONFIG.downloadPath, f)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time);
    if (files.length > 0 && Date.now() - files[0].time < maxAgeMs) return files[0].path;
  } catch (e) {}
  return null;
}

// ─── Enrichment Spawner (v2 with PropFinder stats) ──────────────────────────

const { spawn } = require('child_process');

async function runEnrichmentV2(csvPath, league, date) {
  // Spawn enrichment-v2.js as async child process
  // Returns: path to enrichment CSV or null if timeout

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      logWarning(`Enrichment timeout for ${league} (using cached enrichment)`, 2);
      resolve(null);  // Return null, scraper will use cached enrichment
    }, 480000);  // 8 minutes max

    try {
      const enrichmentScript = path.join(__dirname, 'run-enrichment-v2.js');
      if (!fs.existsSync(enrichmentScript)) {
        logWarning(`Enrichment script not found: ${enrichmentScript}`, 2);
        clearTimeout(timeout);
        resolve(null);
        return;
      }

      const child = spawn('node', [enrichmentScript, csvPath, league, date], {
        stdio: 'pipe',
        detached: false
      });

      let outputPath = null;

      child.stdout?.on('data', (data) => {
        const msg = data.toString();
        // Look for "Wrote enriched data: /path/to/csv"
        const match = msg.match(/propedge-enriched-.*\.csv/);
        if (match) outputPath = match[0];
      });

      child.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0 && outputPath) {
          const fullPath = path.join(__dirname, 'propedge-enriched', path.basename(outputPath));
          if (fs.existsSync(fullPath)) {
            logSuccess(`Enrichment completed: ${fullPath}`, 2);
            resolve(fullPath);
          } else {
            logWarning(`Enrichment output not found at ${fullPath}`, 2);
            resolve(null);
          }
        } else {
          logWarning(`Enrichment failed with code ${code}`, 2);
          resolve(null);
        }
      });

      child.on('error', (err) => {
        clearTimeout(timeout);
        logError(`Enrichment spawn error: ${err.message}`);
        resolve(null);
      });
    } catch (e) {
      clearTimeout(timeout);
      logError(`Failed to spawn enrichment: ${e.message}`);
      resolve(null);
    }
  });
}

// ─── Enrichment CSV Loading & Merging ────────────────────────────────────────

/**
 * Load the latest enrichment CSV for a given sport
 * Prioritizes freshly scraped enrichment from page, falls back to cached enrichment
 * Returns { headers, data } or null if not found
 */
function loadEnrichmentCSV(sport) {
  try {
    // First, try to load freshly scraped enrichment from enrichment-cache
    const enrichmentCacheDir = path.join(CONFIG.downloadPath, '../enrichment-cache');
    const today = new Date().toISOString().split('T')[0];

    if (fs.existsSync(enrichmentCacheDir)) {
      const cachedFiles = fs.readdirSync(enrichmentCacheDir)
        .filter(f => f.startsWith('enrichment-') && f.endsWith('.csv'))
        .map(f => ({
          name: f,
          path: path.join(enrichmentCacheDir, f),
          time: fs.statSync(path.join(enrichmentCacheDir, f)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);

      if (cachedFiles.length > 0) {
        const csvPath = cachedFiles[0].path;
        const csvText = fs.readFileSync(csvPath, 'utf-8');
        const rows = parseCSV(csvText);

        if (rows.length >= 2) {
          logSuccess(`Loaded scraped enrichment: ${path.basename(csvPath)} (${rows.length - 1} rows)`, 2);
          return { headers: rows[0], data: rows.slice(1) };
        }
      }
    }

    // Fall back to regular enrichment files
    if (!fs.existsSync(ENRICHMENT_DIR)) {
      logWarning(`Enrichment dir not found: ${ENRICHMENT_DIR}`, 2);
      return null;
    }

    const files = fs.readdirSync(ENRICHMENT_DIR)
      .filter(f => f.startsWith(`propedge-enriched-${sport}-`) && f.endsWith('.csv'))
      .map(f => ({
        name: f,
        path: path.join(ENRICHMENT_DIR, f),
        time: fs.statSync(path.join(ENRICHMENT_DIR, f)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time);

    if (files.length === 0) {
      logWarning(`No enrichment CSV found for ${sport}`, 2);
      return null;
    }

    const csvPath = files[0].path;
    const csvText = fs.readFileSync(csvPath, 'utf-8');
    const rows = parseCSV(csvText);

    if (rows.length < 2) {
      logWarning(`Enrichment CSV empty or too small: ${files[0].name}`, 2);
      return null;
    }

    logSuccess(`Loaded cached enrichment: ${path.basename(csvPath)} (${rows.length - 1} rows)`, 2);
    return { headers: rows[0], data: rows.slice(1) };
  } catch (e) {
    logError(`Failed to load enrichment CSV: ${e.message}`, 2);
    return null;
  }
}

/**
 * Normalize stat names across CSV/page-parse differences
 * CSV exports may use different names than page parsing
 * Maps them to a canonical form for matching
 */
function normalizeStatForMatching(stat) {
  if (!stat) return stat;
  const s = stat.toUpperCase().trim();

  // Cross-source mappings
  const normMap = {
    'GOALS': 'POINTS',           // NHL: CSV "GOALS" → page-parse "POINTS"
    'ASSISTS': 'ASSISTS',
    'SHOTS': 'SHOTS',
    'HITS': 'HITS',
  };

  return normMap[s] || s;
}

/**
 * Merge enrichment data into PropFinder data by matching:
 * - Player name (normalized)
 * - Prop type (Over/Under detection from prop name)
 *
 * Adds enrichment columns to PropFinder headers/data
 */
function mergeEnrichmentData(pfHeaders, pfData, enrichment) {
  if (!enrichment) {
    logWarning('No enrichment to merge', 2);
    return { headers: pfHeaders, data: pfData };
  }

  const { headers: eHeaders, data: eData } = enrichment;

  // Find key columns in enrichment CSV
  const eHeaderLower = eHeaders.map(h => h.toLowerCase().trim());
  const ePlayerIdx = eHeaderLower.findIndex(h => h.includes('name') || h.includes('player'));
  const ePropIdx = eHeaderLower.findIndex(h => h.includes('prop'));
  const eConfidenceIdx = eHeaderLower.findIndex(h => h.includes('confidence'));
  const eMatchupIdx = eHeaderLower.findIndex(h => h.includes('matchup_scalar'));
  const eMatchupRankIdx = eHeaderLower.findIndex(h => h.includes('matchup_rank'));
  const eL10Idx = eHeaderLower.findIndex(h => h.includes('per_min_l10'));
  const eVarianceIdx = eHeaderLower.findIndex(h => h.includes('variance'));

  if (ePlayerIdx < 0 || ePropIdx < 0) {
    logWarning(`Enrichment columns not found. Headers: ${eHeaders.join(', ')}`, 2);
    return { headers: pfHeaders, data: pfData };
  }

  logSuccess(`Found enrichment columns: Player=${eHeaders[ePlayerIdx]} Prop=${eHeaders[ePropIdx]}`, 2);

  // Helper: extract stat name by stripping line prefix (case-insensitive, exact match)
  const extractStat = (prop) => (prop || '').replace(/^[ou]\d+\.?\d*\s+/i, '').trim().toUpperCase();

  // Build enrichment lookup map: "PLAYERNAME|STAT" -> enrichment row
  const enrichmentMap = {};
  eData.forEach(row => {
    const playerName = (row[ePlayerIdx] || '').trim().toUpperCase();
    const propName = (row[ePropIdx] || '').trim();
    const statOnly = extractStat(propName);  // Strip line prefix only
    const normalizedStat = normalizeStatForMatching(statOnly);  // Normalize across sources
    const key = `${playerName}|${normalizedStat}`;
    enrichmentMap[key] = row;
  });

  logSuccess(`Built enrichment map with ${eData.length} rows from CSV`, 2);

  // Find key columns in PropFinder data
  const pfHeaderLower = pfHeaders.map(h => h.toLowerCase().trim());
  const pfPlayerIdx = pfHeaderLower.findIndex(h => h.includes('player'));
  const pfPropIdx = pfHeaderLower.findIndex(h => h.includes('prop'));

  if (pfPlayerIdx < 0 || pfPropIdx < 0) {
    logWarning('PropFinder missing Player or Prop columns', 2);
    return { headers: pfHeaders, data: pfData };
  }

  // Add enrichment columns to headers
  const mergedHeaders = [...pfHeaders];
  const enrichmentCols = [];
  if (eConfidenceIdx >= 0) { enrichmentCols.push('Confidence %'); mergedHeaders.push('Confidence %'); }
  if (eMatchupIdx >= 0) { enrichmentCols.push('Matchup Scalar'); mergedHeaders.push('Matchup Scalar'); }
  if (eMatchupRankIdx >= 0) { enrichmentCols.push('Matchup Rank'); mergedHeaders.push('Matchup Rank'); }
  if (eVarianceIdx >= 0) { enrichmentCols.push('Variance'); mergedHeaders.push('Variance'); }
  if (eL10Idx >= 0) { enrichmentCols.push('L10 Per-Min'); mergedHeaders.push('L10 Per-Min'); }

  // Merge enrichment data into each PropFinder row
  const unmatchedSamples = [];
  const mergedData = pfData.map(pfRow => {
    const playerName = (pfRow[pfPlayerIdx] || '').trim().toUpperCase();
    const propName = (pfRow[pfPropIdx] || '').trim();
    const statOnly = extractStat(propName);  // Strip line prefix only
    const normalizedStat = normalizeStatForMatching(statOnly);  // Normalize across sources
    const key = `${playerName}|${normalizedStat}`;

    const mergedRow = [...pfRow];
    const eRow = enrichmentMap[key];

    if (eRow) {
      if (eConfidenceIdx >= 0) mergedRow.push(eRow[eConfidenceIdx] || '');
      if (eMatchupIdx >= 0) mergedRow.push(eRow[eMatchupIdx] || '');
      if (eMatchupRankIdx >= 0) mergedRow.push(eRow[eMatchupRankIdx] || '');
      if (eVarianceIdx >= 0) mergedRow.push(eRow[eVarianceIdx] || '');
      if (eL10Idx >= 0) mergedRow.push(eRow[eL10Idx] || '');
    } else {
      // No enrichment match — fill with blanks, log samples
      if (unmatchedSamples.length < 5) {
        unmatchedSamples.push({ player: playerName, stat: statOnly, key });
      }
      enrichmentCols.forEach(() => mergedRow.push(''));
    }

    return mergedRow;
  });

  const matchedCount = mergedData.filter(row => {
    const playerName = (row[pfPlayerIdx] || '').trim().toUpperCase();
    const propName = (row[pfPropIdx] || '').trim();
    const statOnly = extractStat(propName);
    const normalizedStat = normalizeStatForMatching(statOnly);  // CRITICAL: Must normalize for lookup
    const key = `${playerName}|${normalizedStat}`;
    return enrichmentMap[key];
  }).length;

  logSuccess(`Enrichment merged: ${matchedCount}/${mergedData.length} props matched`, 2);

  // Diagnostic: show why some props didn't match
  if (unmatchedSamples.length > 0) {
    logWarning(`Unmatched samples (not found in enrichment map):`, 2);
    unmatchedSamples.forEach(u => {
      logWarning(`  Key="${u.key}" (Player="${u.player}" Stat="${u.stat}")`, 2);
    });
    logWarning(`Sample enrichment map keys:`, 2);
    Object.keys(enrichmentMap).slice(0, 3).forEach(k => {
      logWarning(`  "${k}"`, 2);
    });
  }

  return { headers: mergedHeaders, data: mergedData };
}

function applyFilters(rows) {
  if (!rows || rows.length < 2) return { headers: [], data: [] };

  let headers = rows[0];
  let data    = rows.slice(1);

  // Strip 'saved' bookmark column if PropFinder added it
  const savedIdx = headers.map(h => h.toLowerCase().trim()).indexOf('saved');
  if (savedIdx !== -1) {
    headers = headers.filter((_, i) => i !== savedIdx);
    data    = data.map(row => row.filter((_, i) => i !== savedIdx));
    log(`Stripped 'saved' column (was at index ${savedIdx})`, 2);
  }

  const headerLower = headers.map(h => h.toLowerCase().trim());
  const cols = {
    pf:   headerLower.findIndex(h => h.includes('pf') && h.includes('rating')),
    l5:   headerLower.findIndex(h => h === 'l5 avg'),
    l10:  headerLower.findIndex(h => h === 'l10 avg'),
    odds: headerLower.findIndex(h => h === 'odds')
  };

  log(`Headers: ${headers.join(' | ')}`, 2);
  log(`Col indices — PF:${cols.pf} L5:${cols.l5} L10:${cols.l10} Odds:${cols.odds}`, 2);

  if (data.length > 0) {
    const s = data[0];
    log(`Sample — PF:${cols.pf >= 0 ? s[cols.pf] : 'n/a'} L5:${cols.l5 >= 0 ? s[cols.l5] : 'n/a'} L10:${cols.l10 >= 0 ? s[cols.l10] : 'n/a'} Odds:${cols.odds >= 0 ? s[cols.odds] : 'n/a'}`, 2);
  }

  const filtered = data.filter(row => {
    const pf  = cols.pf  >= 0 ? parseFloat(row[cols.pf])  || 0 : 100;
    const l5  = cols.l5  >= 0 ? parseFloat(row[cols.l5])  || 0 : 100;
    const l10 = cols.l10 >= 0 ? parseFloat(row[cols.l10]) || 0 : 100;
    let odds  = 0;
    if (cols.odds >= 0) {
      const m = (row[cols.odds] || '').replace(/[',]/g, '').match(/[+-]?\d+/);
      odds = m ? parseInt(m[0]) : 0;
    }
    return pf >= FILTERS.pfRatingMin &&
           l5 > FILTERS.l5AvgMin    &&
           l10 > FILTERS.l10AvgMin  &&
           odds >= FILTERS.oddsMin  &&
           odds <= FILTERS.oddsMax;
  });

  log(`Filter: ${data.length} in → ${filtered.length} out`, 2);
  return { headers, data: filtered };
}

// ─── Enrichment Calculation (Confidence, Matchup, Per-Min) ────────────────
/**
 * Confidence % — hit-rate consistency, sample size, line cushion, stability.
 * Replaces legacy L10-avg formula that capped most props at ~52%.
 */
function parseHitRateMeta(str) {
  if (!str) return { pct: 0, samples: 0 };
  const fracMatch = String(str).match(/\((\d+)\/(\d+)\)/);
  if (fracMatch) {
    const hits = parseInt(fracMatch[1], 10);
    const total = parseInt(fracMatch[2], 10);
    return { pct: total ? (hits / total) * 100 : 0, samples: total };
  }
  const pctMatch = String(str).match(/([\d.]+)%?/);
  return { pct: pctMatch ? parseFloat(pctMatch[1]) : 0, samples: 0 };
}

function calculatePropConfidence(input) {
  const {
    l5Pct = 0, l10Pct = 0, l20Pct = 0,
    l5Samples = 0, l10Samples = 0, l20Samples = 0,
    l5Avg = 0, l10Avg = 0, line = 0,
    direction = 'OVER', propType = ''
  } = input || {};

  const pcts = [l5Pct, l10Pct, l20Pct].filter(v => v > 0);
  let hitScore = 50;
  if (pcts.length) {
    const avgHit = pcts.reduce((a, b) => a + b, 0) / pcts.length;
    const spread = pcts.length > 1 ? Math.max(...pcts) - Math.min(...pcts) : 0;
    const baseHit = spread > 25 ? Math.min(...pcts) : avgHit;
    const consistency = Math.max(0, 1 - spread / 40);
    hitScore = baseHit * 0.7 + consistency * 30;
  }

  const samples = Math.max(l5Samples, l10Samples, l20Samples);
  let sampleScore = 28;
  if (samples >= 20) sampleScore = 78;
  else if (samples >= 10) sampleScore = 62;
  else if (samples >= 5) sampleScore = 48;

  let cushionScore = 50;
  if (line > 0 && l5Avg > 0) {
    const cushion = direction === 'OVER'
      ? (l5Avg - line) / line
      : (line - l5Avg) / line;
    cushionScore = 50 + Math.max(-25, Math.min(25, cushion * 100));
  }

  let stabilityScore = 50;
  if (l10Avg > 0 && l5Avg > 0) {
    const drift = Math.abs(l5Avg - l10Avg) / Math.max(l10Avg, 0.1);
    stabilityScore = Math.max(20, 80 - drift * 60);
  }
  const ptLower = (propType || '').toLowerCase();
  if (/stl|blk|hr|td|goal|double|triple/.test(ptLower)) stabilityScore -= 10;

  const raw = hitScore * 0.40 + sampleScore * 0.30 + cushionScore * 0.20 + stabilityScore * 0.10;
  return Math.max(15, Math.min(88, Math.round(raw)));
}

/**
 * Calculate enrichment columns from native PropFinder L10/L5 Avg data
 * Adds: Confidence %, Matchup Scalar, L10 Per-Min, Expected Minutes, Matchup Rank
 */
function addEnrichmentColumns(headers, data, league) {
  if (!data || data.length === 0) return { headers, data };

  // Find key columns
  const headerLower = headers.map(h => h.toLowerCase().trim());
  const l10Idx = headerLower.findIndex(h => h === 'l10 avg');
  const l5Idx = headerLower.findIndex(h => h === 'l5 avg');
  const l5HitIdx = headerLower.findIndex(h => h === 'l5');
  const l10HitIdx = headerLower.findIndex(h => h === 'l10');
  const l20HitIdx = headerLower.findIndex(h => h === 'l20');
  const teamIdx = headerLower.findIndex(h => h === 'team');
  const propIdx = headerLower.findIndex(h => h === 'prop');

  if (l10Idx < 0 || l5Idx < 0) {
    logWarning('L10/L5 Avg columns not found — skipping enrichment', 2);
    return { headers, data };
  }

  // Add enrichment headers
  const enrichedHeaders = [
    ...headers,
    'Confidence %',
    'Matchup Scalar',
    'L10 Per-Min',
    'L5 Per-Min',
    'Expected Minutes',
    'Matchup Rank'
  ];

  // Expected minutes per league (average plate appearances / playing time)
  const expectedMinutes = league === 'NBA' ? 28 : league === 'NHL' ? 18 : 4.2;

  // Simple opponent defense rankings by team (1-30, lower is better defense)
  // Will use middle value (15) if team not found
  const defenseRankings = {
    // NBA teams
    'BOS': 1, 'MIA': 2, 'DEN': 3, 'LAL': 4, 'GSW': 5, 'PHX': 6, 'LAC': 7, 'NYK': 8,
    'OKC': 9, 'DAL': 10, 'MIL': 11, 'CLE': 12, 'NOP': 13, 'TOR': 14, 'ATL': 15,
    'CHI': 16, 'HOU': 17, 'POR': 18, 'MEM': 19, 'SAS': 20, 'BKN': 21, 'WAS': 22,
    'IND': 23, 'UTA': 24, 'ORL': 25, 'CHA': 26, 'DET': 27, 'MIN': 28, 'SAC': 29, 'TOR': 30,
    // NHL teams
    'VGK': 1, 'TOR': 2, 'CAR': 3, 'DAL': 4, 'NYR': 5, 'COL': 6, 'EDM': 7, 'TB': 8,
    'NJ': 9, 'LAK': 10, 'WPG': 11, 'CGY': 12, 'BUF': 13, 'ARI': 14, 'FLA': 15,
    'WSH': 16, 'MIN': 17, 'STL': 18, 'VAN': 19, 'ANA': 20, 'MTL': 21, 'PHI': 22,
    'CBJ': 23, 'SJ': 24, 'OTT': 25, 'BOS': 26, 'CHI': 27, 'NYI': 28, 'SEA': 29, 'PIT': 30,
    // MLB teams
    'HOU': 1, 'ATL': 2, 'LAD': 3, 'NYY': 4, 'TEX': 5, 'BOS': 6, 'TB': 7, 'SD': 8,
    'KC': 9, 'TOR': 10, 'MIL': 11, 'ARI': 12, 'SEA': 13, 'SF': 14, 'MIN': 15,
    'PHI': 16, 'STL': 17, 'NYM': 18, 'CLE': 19, 'WSH': 20, 'BAL': 21, 'DET': 22,
    'LAA': 23, 'CWS': 24, 'COL': 25, 'OAK': 26, 'MIA': 27, 'PIT': 28, 'CHC': 29, 'TB': 30
  };

  const enrichedData = data.map(row => {
    const l10 = parseFloat(row[l10Idx]) || 0;
    const l5 = parseFloat(row[l5Idx]) || 0;
    const team = (row[teamIdx] || '').trim().toUpperCase();
    const propStr = (row[propIdx] || '').trim();
    const direction = propStr.toLowerCase().startsWith('u') ? 'UNDER' : 'OVER';
    const lineMatch = propStr.match(/[ou]?([\d.]+)/i);
    const line = lineMatch ? parseFloat(lineMatch[1]) : 0;
    const propType = propStr.replace(/^[ou]?[\d.]+\s*/i, '').trim();

    const l5Meta = l5HitIdx >= 0 ? parseHitRateMeta(row[l5HitIdx]) : { pct: 0, samples: 0 };
    const l10Meta = l10HitIdx >= 0 ? parseHitRateMeta(row[l10HitIdx]) : { pct: 0, samples: 0 };
    const l20Meta = l20HitIdx >= 0 ? parseHitRateMeta(row[l20HitIdx]) : { pct: 0, samples: 0 };
    const confidence = calculatePropConfidence({
      l5Pct: l5Meta.pct,
      l10Pct: l10Meta.pct,
      l20Pct: l20Meta.pct,
      l5Samples: l5Meta.samples,
      l10Samples: l10Meta.samples,
      l20Samples: l20Meta.samples,
      l5Avg: l5,
      l10Avg: l10,
      line,
      direction,
      propType
    });

    // Calculate L10 per-minute (divide by expected minutes to normalize)
    const l10PerMin = l10 > 0 ? (l10 / expectedMinutes).toFixed(2) : '0';
    const l5PerMin = l5 > 0 ? (l5 / expectedMinutes).toFixed(2) : '0';

    // Get matchup rank (1-30, lower is better defense)
    const matchupRank = defenseRankings[team] || 15;

    // Matchup scalar (0.0-1.0, based on how good the defense is)
    // Rank 1 (best defense) = 0.3 (hard to score)
    // Rank 15 (avg) = 0.5 (neutral)
    // Rank 30 (worst defense) = 0.8 (easy to score)
    const matchupScalar = (0.2 + (matchupRank / 30) * 0.6).toFixed(2);

    return [
      ...row,
      confidence.toString(),      // Confidence %
      matchupScalar,              // Matchup Scalar
      l10PerMin,                  // L10 Per-Min
      l5PerMin,                   // L5 Per-Min
      expectedMinutes.toString(), // Expected Minutes
      matchupRank.toString()      // Matchup Rank
    ];
  });

  logSuccess(`Added enrichment columns: ${enrichedData.length} props enriched`, 2);
  return { headers: enrichedHeaders, data: enrichedData };
}

// ─── DOM helpers ─────────────────────────────────────────────────────────────

async function _unhideModals(page) {
  await page.evaluate(() => {
    document.querySelectorAll('[aria-hidden="true"]').forEach(el => el.removeAttribute('aria-hidden'));
  });
}

async function _mouseClickText(page, text, timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await _unhideModals(page);
    const coords = await page.evaluate(t => {
      const selectors = 'button, [role="tab"], [role="menuitem"], [role="button"], a, li, div, span';
      for (const el of document.querySelectorAll(selectors)) {
        if (el.textContent.trim() === t) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
          }
        }
      }
      return null;
    }, text);
    if (coords) {
      await page.mouse.click(coords.x, coords.y);
      log(`  mouse-clicked "${text}" at (${Math.round(coords.x)}, ${Math.round(coords.y)})`, 2);
      return true;
    }
    await sleep(400);
  }
  return false;
}

// ─── FanDuel via direct API ──────────────────────────────────────────────────

async function setFanDuelViaAPI(page) {
  if (!fs.existsSync(SETTINGS_FILE)) return false;

  let saved;
  try { saved = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8')); }
  catch (e) { logWarning(`Could not read ${SETTINGS_FILE}: ${e.message}`, 2); return false; }

  log('Attempting direct API call to set FanDuel-only...', 1);

  const result = await page.evaluate(async ({ url, method, body, headers }) => {
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...headers },
        body: body ? JSON.stringify(body) : undefined,
        credentials: 'include'
      });
      return { ok: res.ok, status: res.status };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }, saved);

  if (result.ok) {
    logSuccess(`API call succeeded (HTTP ${result.status}) — FanDuel set as only sportsbook`, 2);
    return true;
  }
  logWarning(`API call returned HTTP ${result.status} — falling back to UI automation`, 2);
  return false;
}

async function captureSettingsAPI(page) {
  log('CAPTURE MODE: Intercepting settings API calls...', 1);
  log('Will run UI automation while recording all POST/PUT/PATCH requests.', 1);

  const captured = [];

  await page.setRequestInterception(true);
  page.on('request', req => {
    const method = req.method();
    const url    = req.url();
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      const body = req.postData();
      captured.push({ method, url, rawBody: body });
      log(`  [INTERCEPT] ${method} ${url}`, 2);
      if (body) log(`  [BODY] ${body.slice(0, 200)}`, 2);
    }
    req.continue();
  });

  await selectFanDuelUI(page);

  await page.setRequestInterception(false);

  const candidates = captured.filter(r => {
    const u = r.url.toLowerCase();
    return u.includes('sport') || u.includes('setting') || u.includes('pref') || u.includes('book');
  });

  if (candidates.length === 0 && captured.length > 0) {
    log('No sports/settings URL found — saving all captured calls for review:', 1);
    captured.forEach((c, i) => log(`  ${i}: ${c.method} ${c.url}`, 1));
  }

  const best = candidates[0] || captured[captured.length - 1];
  if (!best) { logWarning('No API calls captured — try again', 1); return; }

  let parsedBody = null;
  try { parsedBody = JSON.parse(best.rawBody); } catch (e) {}

  const toSave = {
    url:     best.url,
    method:  best.method,
    body:    parsedBody,
    headers: {},
    note:    'Captured by --capture mode. Edit body if needed to match FD-only format.'
  };

  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(toSave, null, 2));
  logSuccess(`Saved API details to ${SETTINGS_FILE}`, 1);
  log('Review the file, adjust the body to FanDuel-only if needed, then run normally.', 1);
  log(`File contents:\n${JSON.stringify(toSave, null, 2)}`, 1);
}

async function selectFanDuel(page) {
  const apiOk = await setFanDuelViaAPI(page);
  if (apiOk) return;
  log('No saved API — running UI automation (use --capture once to make this permanent)', 1);
  await selectFanDuelUI(page);
}

async function selectFanDuelUI(page) {
  const TARGET_BOOKS = ['FANDUEL', 'DRAFTKINGS', 'BETMGM', 'CAESARS', 'ESPN BET', 'PINNACLE'];
  log(`Configuring sportsbooks (UI): ${TARGET_BOOKS.join(', ')}...`, 1);

  await sleep(3000);
  await _unhideModals(page);

  const profileCoords = await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll('button, [role="button"]'))
      .filter(el => {
        const r = el.getBoundingClientRect();
        const t = el.textContent.trim().toLowerCase();
        return r.top >= 0 && r.top < 80 && r.width > 0
          && !t.includes('tutorial') && !t.includes('saved');
      })
      .sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right);
    if (!candidates[0]) return null;
    const r = candidates[0].getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  if (!profileCoords) { logWarning('Profile icon not found', 2); return; }
  await page.mouse.click(profileCoords.x, profileCoords.y);
  logSuccess(`Profile panel opened (${Math.round(profileCoords.x)}, ${Math.round(profileCoords.y)})`, 2);
  await sleep(2000);

  if (!await _mouseClickText(page, 'Settings', 5000)) { logWarning('Settings not found', 2); return; }
  logSuccess('Settings opened', 2);
  await sleep(1500);

  if (!await _mouseClickText(page, 'Sportsbooks', 5000)) { logWarning('Sportsbooks tab not found', 2); return; }
  logSuccess('Sportsbooks tab clicked', 2);
  await sleep(1500);

  if (!await _mouseClickText(page, 'Manage Sportsbooks', 5000)) { logWarning('Manage Sportsbooks not found', 2); return; }
  logSuccess('Manage Sportsbooks opened', 2);
  await sleep(2000);

  await page.evaluate(() => {
    for (const el of document.querySelectorAll('button, div, span')) {
      if (el.textContent.trim() === 'Disable All') { el.scrollIntoView({ block: 'center' }); break; }
    }
  });
  await sleep(400);
  if (!await _mouseClickText(page, 'Disable All', 5000)) { logWarning('Disable All not found', 2); }
  else { logSuccess('Disabled all sportsbooks', 2); }
  await sleep(1500);

  // Enable each target sportsbook in sequence
  for (const bookName of TARGET_BOOKS) {
    await _unhideModals(page);
    await page.evaluate((name) => {
      for (const el of document.querySelectorAll('button, div, span, td, li, p')) {
        if (el.textContent.trim().toUpperCase() === name) {
          el.scrollIntoView({ block: 'center', behavior: 'instant' });
          break;
        }
      }
    }, bookName);
    await sleep(500);
    await _unhideModals(page);

    const coords = await page.evaluate((name) => {
      for (const el of document.querySelectorAll('button, div, span, td, li, p')) {
        if (el.textContent.trim().toUpperCase() === name) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            return { x: r.left + r.width / 2, y: r.top + r.height / 2, inView: r.top >= 0 && r.bottom <= window.innerHeight };
          }
        }
      }
      return null;
    }, bookName);

    if (!coords) { logWarning(`${bookName} not found in list — skipping`, 2); continue; }
    const clampedY = Math.min(coords.y, CONFIG.viewport.height - 10);
    await page.mouse.click(coords.x, clampedY);
    logSuccess(`${bookName} clicked (${Math.round(coords.x)}, ${Math.round(clampedY)})`, 2);
    await sleep(600);

    // If an inner picker opened (e.g. region selector), close it by clicking outside
    // but stay in the Manage Sportsbooks modal — do NOT press Escape here
    await _unhideModals(page);
    await sleep(400);
  }

  // Single Escape after all books selected to close any lingering inner picker
  await page.keyboard.press('Escape');
  await sleep(800);
  logSuccess(`Enabled ${TARGET_BOOKS.length} sportsbooks`, 2);
  await sleep(1000);
  await _unhideModals(page);
  await sleep(500);

  let saveCoords = await page.evaluate(() => {
    for (const btn of document.querySelectorAll('button')) {
      if (btn.textContent.trim() === 'Save Changes') {
        const r = btn.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) return { x: r.left + r.width / 2, y: r.top + r.height / 2, found: true };
      }
    }
    return { found: false };
  });

  if (!saveCoords.found) {
    logWarning('Save Changes not visible — scrolling modal', 2);
    await page.evaluate(() => {
      const modal = document.querySelector('[role="dialog"], [role="presentation"]');
      if (modal) modal.scrollTop += 300;
    });
    await sleep(800);
    await _unhideModals(page);
    saveCoords = await page.evaluate(() => {
      for (const btn of document.querySelectorAll('button')) {
        if (btn.textContent.trim() === 'Save Changes') {
          const r = btn.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) return { x: r.left + r.width / 2, y: r.top + r.height / 2, found: true };
        }
      }
      return { found: false };
    });
  }

  if (saveCoords.found) {
    log(`Save Changes at (${Math.round(saveCoords.x)}, ${Math.round(saveCoords.y)})`, 2);
    await page.mouse.click(saveCoords.x, saveCoords.y);
    logSuccess('Save Changes clicked — waiting for page refresh', 2);
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    await sleep(4000);
    logSuccess('Page refreshed with FD-only odds', 2);
  } else {
    logWarning('Save Changes not found — FD-only selection may not have saved', 2);
  }
}

// ─── Game / view helpers ─────────────────────────────────────────────────────

async function selectAllGames(page) {
  log('Selecting all games...', 1);

  await _unhideModals(page);

  const gamesClicked = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll('*'));
    const candidates = [];
    for (const el of elements) {
      const text = el.textContent.trim();
      if (/^\d+\s+selected$/i.test(text)) {
        const rect = el.getBoundingClientRect();
        if (rect.top > 50 && rect.top < 200) candidates.push({ el, left: rect.left });
      }
    }
    candidates.sort((a, b) => b.left - a.left);
    if (candidates[0]) { candidates[0].el.click(); return true; }
    return false;
  });

  if (!gamesClicked) {
    logWarning('Could not find Games dropdown — trying to click individual game items directly', 2);
    // Single-game days (e.g. Finals) may not show an "N selected" dropdown.
    // Try clicking any visible game/matchup tiles so props load.
    const gameClicked = await page.evaluate(() => {
      // Look for team name elements or matchup containers in the header area
      const selectors = [
        '[class*="game"]', '[class*="Game"]', '[class*="matchup"]', '[class*="Matchup"]',
        '[class*="fixture"]', '[class*="event"]'
      ];
      for (const sel of selectors) {
        const els = Array.from(document.querySelectorAll(sel));
        for (const el of els) {
          const rect = el.getBoundingClientRect();
          if (rect.top > 50 && rect.top < 250 && rect.width > 50) {
            el.click();
            return el.textContent.trim().substring(0, 60);
          }
        }
      }
      return null;
    });
    if (gameClicked) {
      logSuccess(`Clicked game item directly: "${gameClicked}"`, 2);
      await sleep(1500);
    } else {
      logWarning('No game items found — proceeding as-is (page may already have props loaded)', 2);
    }
    return;
  }

  await sleep(1500);
  await _unhideModals(page);

  const menuItems = await page.evaluate(() =>
    Array.from(document.querySelectorAll('li, [role="option"], [role="menuitem"], div, span'))
      .filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.top > 100; })
      .map(el => el.textContent.trim())
      .filter(t => t.length > 0 && t.length < 80)
      .slice(0, 15)
  );
  log(`Dropdown items: ${JSON.stringify(menuItems)}`, 2);

  const matched = await page.evaluate(() => {
    for (const el of document.querySelectorAll('li, [role="option"], [role="menuitem"], div, span, button, a')) {
      const t = el.textContent.trim().toLowerCase();
      if (t.includes('select all') || t === 'all' || t === 'all games') {
        el.click(); return el.textContent.trim();
      }
    }
    return null;
  });

  if (matched) {
    logSuccess(`Selected all games (matched: "${matched}")`, 2);
  } else {
    logWarning('Could not find Select All option in dropdown', 2);
    await page.keyboard.press('Escape');
  }
  await sleep(1000);
}

async function toggleAltLines(page) {
  log('Enabling Alt Lines...', 1);
  const toggled = await page.evaluate(() => {
    for (const el of document.querySelectorAll('*')) {
      const text = el.textContent.trim();
      if (text === 'Show Alt Lines:' || text === 'Show Alt Lines') {
        const parent = el.closest('div');
        if (parent) {
          const toggle = parent.querySelector('input[type="checkbox"], [role="switch"], button');
          if (toggle) { toggle.click(); return 'clicked toggle near label'; }
        }
      }
    }
    for (const el of document.querySelectorAll('[role="switch"], input[type="checkbox"]')) {
      const rect = el.getBoundingClientRect();
      if (rect.top > 150 && rect.top < 220 && rect.left > 700) {
        const isChecked = el.checked || el.getAttribute('aria-checked') === 'true';
        if (!isChecked) { el.click(); return 'clicked toggle switch'; }
        else return 'already on';
      }
    }
    for (const el of document.querySelectorAll('*')) {
      const rect = el.getBoundingClientRect();
      const classes = el.className || '';
      if (rect.top > 150 && rect.top < 220 && rect.left > 750 && rect.left < 950) {
        if (classes.includes('toggle') || classes.includes('switch') || classes.includes('Switch')) {
          el.click(); return 'clicked by class match';
        }
      }
    }
    return false;
  });
  if (toggled) { logSuccess(`Alt Lines: ${toggled}`, 2); await sleep(3000); }
  else logWarning('Could not find Alt Lines toggle', 2);
}

async function clickOverUnder(page, direction) {
  log(`Selecting ${direction}...`, 1);
  const clicked = await page.evaluate(dir => {
    for (const el of document.querySelectorAll('*')) {
      const text = el.textContent.trim().toUpperCase();
      if (text === dir) {
        const rect = el.getBoundingClientRect();
        if (rect.top < 200 && rect.left < 200 && rect.width < 100) { el.click(); return true; }
      }
    }
    return false;
  }, direction);
  if (clicked) { logSuccess(`Selected ${direction}`, 2); await sleep(2500); }
  else logWarning(`Could not find ${direction} button`, 2);
  return clicked;
}

/**
 * Scrape PropFinder page table for enrichment data
 * Extracts: Player, Prop, L10 AVG, LS AVG, STREAK, Matchup Scalar
 * Returns enrichment array for all visible props
 */
async function scrapePageEnrichment(page, leagueName) {
  // DISABLED: PropFinder page scraping returns 0 rows due to virtualized grid selector mismatch
  // Instead, rely on run-enrichment.js which fetches from official sources (NBA.com, etc)
  // and achieves 95%+ enrichment match rate via propedge-enriched-*.csv files
  logWarning(`Page scraping disabled (use run-enrichment.js instead)`, 1);
  return null;

  logSuccess(`Scraped ${enrichmentData.length} rows from page table`, 2);

  // Convert to CSV format matching enrichment file structure
  const headers = ['Name', 'Prop', 'Confidence %', 'Matchup Scalar', 'Per_Min_L10', 'Variance'];
  const csvRows = enrichmentData.map(row => {
    // Calculate confidence from L10 AVG and LS AVG
    const confidence = (row.l10_avg !== null && row.ls_avg !== null)
      ? Math.min(Math.abs(row.l10_avg - row.ls_avg) * 10 + 50, 95)
      : 75;

    return [
      row.name,
      row.prop,
      confidence.toFixed(1),
      row.matchup_scalar.toFixed(2),
      row.l10_avg.toFixed(2),
      '0' // variance placeholder
    ];
  });

  // Write to enrichment CSV
  const enrichmentDir = path.join(CONFIG.downloadPath, '../enrichment-cache');
  if (!fs.existsSync(enrichmentDir)) {
    fs.mkdirSync(enrichmentDir, { recursive: true });
  }

  const enrichmentPath = path.join(
    enrichmentDir,
    `enrichment-${new Date().toISOString().split('T')[0]}.csv`
  );

  let csvContent = headers.join(',') + '\n';
  csvContent += csvRows.map(row =>
    row.map(val => `"${val}"`).join(',')
  ).join('\n');

  fs.writeFileSync(enrichmentPath, csvContent, 'utf8');
  logSuccess(`Enrichment CSV saved: ${path.basename(enrichmentPath)}`, 2);

  return enrichmentPath;
}

async function downloadCSV(page) {
  log('Downloading CSV...', 1);

  const beforeTs = Date.now();

  const exportClicked = await page.evaluate(() => {
    const exportBtn = document.querySelector('button[aria-label="Export"]');
    if (exportBtn) { exportBtn.click(); return true; }
    return false;
  });
  if (!exportClicked) { logWarning('Could not find Export button', 2); return null; }
  log('Clicked Export button', 2);
  await sleep(2000);

  const csvClicked = await page.evaluate(() => {
    for (const el of document.querySelectorAll('li, div, span, button, [role="menuitem"]')) {
      const text = el.textContent.trim();
      if (text === 'Download as CSV' || text === 'Download CSV' || text === 'CSV') {
        el.click(); return true;
      }
    }
    return false;
  });
  if (!csvClicked) {
    logWarning('Could not find CSV option', 2);
    await page.keyboard.press('Escape');
    return null;
  }
  log('Clicked Download as CSV', 2);

  let csvPath = null;
  for (let i = 0; i < 15; i++) {
    await sleep(1000);
    const candidate = findLatestCSV(30000);
    if (candidate) {
      const mtime = fs.statSync(candidate).mtime.getTime();
      if (mtime > beforeTs) { csvPath = candidate; break; }
    }
  }
  if (!csvPath) { logWarning('No new CSV appeared within 15s', 2); return null; }

  log(`Found: ${path.basename(csvPath)}`, 2);
  const data = fs.readFileSync(csvPath, 'utf-8');
  const rows = parseCSV(data);
  logSuccess(`Downloaded ${rows.length - 1} rows`, 2);

  // DIAGNOSTIC: Log actual CSV headers to identify any PropFinder schema changes
  if (rows.length > 0) {
    const headers = rows[0];
    log(`CSV Headers (${headers.length} cols): ${headers.join(' | ')}`, 2);
    // Also log a sample row for verification
    if (rows.length > 1) {
      log(`Sample row 1: ${rows[1].join(' | ')}`, 2);
    }
  }

  // DO NOT DELETE — enrichment needs the CSV file
  // Enrichment will run before this file is cleaned up
  return { rows, path: csvPath };
}

// ─── Per-league pipeline (WITH ENRICHMENT) ────────────────────────────────────

async function processLeague(page, sheets, league) {
  log(`\n${'='.repeat(50)}`);
  log(`Processing ${league}`);
  log('='.repeat(50));

  const url = `https://propfinder.app/${league.toLowerCase()}/`;
  log(`Navigating to ${url}`, 1);
  // Use domcontentloaded (more reliable) instead of networkidle2, with 60s timeout
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(CONFIG.headless ? 12000 : 8000);
  await page.evaluate(() => window.scrollBy(0, 100));
  await sleep(1000);
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(500);
  logSuccess('Page loaded', 1);

  await selectAllGames(page);
  await sleep(2000);
  await toggleAltLines(page);
  await sleep(2000);

  // SCRAPE PAGE ENRICHMENT (all props with visible stats)
  log('Scraping page enrichment before CSV download...', 1);

  // Close any open detail panels to ensure table view is visible
  await page.evaluate(() => {
    // Click Escape key to close any modals/details
    const event = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' });
    document.dispatchEvent(event);

    // Also try clicking a close button if present
    const closeBtn = document.querySelector('[aria-label="Close"], .close, [class*="close"]');
    if (closeBtn) closeBtn.click();
  });
  await sleep(1000);

  const enrichmentPath = await scrapePageEnrichment(page, league);
  if (enrichmentPath) {
    logSuccess(`Page enrichment captured: ${path.basename(enrichmentPath)}`, 2);
  }
  await sleep(1000);

  await clickOverUnder(page, 'OVER');
  const overResult = await downloadCSV(page);
  const overData = overResult?.rows || [];

  if (overData?.length > 1) {
    log('Re-navigating league URL after OVER CSV (stabilize frame for UNDER export)...', 1);
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await sleep(CONFIG.headless ? 10000 : 6000);
      await selectAllGames(page);
      await sleep(2000);
      await toggleAltLines(page);
      await sleep(2000);
    } catch (navErr) {
      logWarning(`Post-OVER navigation failed: ${navErr.message}`, 2);
    }
  }

  await clickOverUnder(page, 'UNDER');
  const underResult = await downloadCSV(page);
  const underData = underResult?.rows || [];

  let allData = [];
  let headers = null;
  let pfdlPath = overResult?.path || underResult?.path;  // Store CSV path for enrichment

  if (overData?.length  > 1) { headers = overData[0];  allData = allData.concat(overData.slice(1)); }
  if (underData?.length > 1) { if (!headers) headers = underData[0]; allData = allData.concat(underData.slice(1)); }

  log(`Combined raw data: ${allData.length} rows`, 1);
  if (allData.length === 0 || !headers) { logWarning(`No data for ${league}`); return; }

  const { headers: cleanHeaders, data: filtered } = applyFilters([headers, ...allData]);
  log(`After filters: ${filtered.length} rows`, 1);

  // CALCULATE ENRICHMENT COLUMNS (Confidence, Matchup Scalar, Per-Min)
  // Uses PropFinder's native L10/L5 Avg + team-based matchup rankings
  log('Calculating enrichment columns (Confidence %, Matchup Scalar, Per-Min)...', 1);
  const { headers: enrichedHeaders, data: enrichedData } = addEnrichmentColumns(cleanHeaders, filtered, league);

  if (enrichedData.length > 0) {
    logSuccess(`${enrichedData.length} props with calculated enrichment ready`, 1);
    // Add game-level columns (game_date, opponent_est) for H2H calculation
    const { headers: finalHeaders, data: finalData } = addGameLevelColumns(enrichedHeaders, enrichedData);
    logSuccess(`Added game-level columns for H2H tracking`, 2);
    // Archive disabled — sheet hit 10M-cell limit and archive data is unused by the app
    await writeToSheet(sheets, league, finalHeaders, finalData);
  } else {
    logWarning(`No rows passed filters for ${league}`, 1);
  }

  // DO NOT DELETE CSV — enrichment needs it for async processing
  // Old CSV files in ~/Downloads will be overwritten on next run
}

// ─── Consolidation: Merge all league tabs into unified propedge-main ────────

async function consolidateLeaguesToUnified(sheets) {
  try {
    log('Reading all league tabs (NBA, NHL, MLB)...', 1);

    // Fetch data from each league tab
    const leagueDataMap = {};
    let unifiedHeaders = null;
    let totalRows = 0;

    for (const league of CONFIG.leagues) {
      try {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: CONFIG.spreadsheetId,
          range: `${league}!A:Z`
        });

        const data = response.data.values || [];
        if (data.length === 0) {
          log(`${league} tab is empty`, 2);
          continue;
        }

        const headers = data[0];
        const rows = data.slice(1);

        leagueDataMap[league] = { headers, rows };
        totalRows += rows.length;

        // Use first league's headers as template
        if (!unifiedHeaders) {
          unifiedHeaders = headers;
          logSuccess(`${league}: ${rows.length} rows | Headers: ${headers.length} columns`, 2);
        } else {
          logSuccess(`${league}: ${rows.length} rows`, 2);
        }
      } catch (e) {
        logWarning(`Failed to read ${league} tab: ${e.message}`, 2);
      }
    }

    if (!unifiedHeaders || totalRows === 0) {
      logWarning('No data found in any league tabs — skipping consolidation', 1);
      return;
    }

    log(`Total: ${totalRows} rows from ${Object.keys(leagueDataMap).length} leagues`, 1);

    // Ensure League column exists in headers (for app to identify league per row)
    let leagueColIdx = unifiedHeaders.indexOf('League');
    if (leagueColIdx === -1) {
      unifiedHeaders.push('League');
      leagueColIdx = unifiedHeaders.length - 1;
      log('Added League column to headers', 2);
    }

    // Consolidate all rows into single array, injecting League value per row
    const consolidatedRows = [];
    for (const league of CONFIG.leagues) {
      if (leagueDataMap[league]) {
        for (const row of leagueDataMap[league].rows) {
          // Ensure row has enough columns to match header length
          while (row.length < unifiedHeaders.length - 1) {
            row.push('');
          }
          // Set League column value
          row[leagueColIdx] = league;
          consolidatedRows.push(row);
        }
      }
    }

    logSuccess(`Consolidated ${consolidatedRows.length} total rows (with League column)`, 1);

    // Write consolidated data to propedge-main tab
    await writeToSheet(sheets, 'propedge-main', unifiedHeaders, consolidatedRows);
    logSuccess('Unified sheet (propedge-main) updated', 1);

  } catch (e) {
    logError(`Consolidation failed: ${e.message}`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log(' PropEdge Auto-Sync v15 (Integrated with Enrichment)');
  console.log(' ' + new Date().toLocaleString());
  console.log('═'.repeat(60) + '\n');

  log(`Filter settings: PF>=${FILTERS.pfRatingMin} | Odds ${FILTERS.oddsMin} to ${FILTERS.oddsMax}`);

  if (!CONFIG.email || !CONFIG.password || !CONFIG.spreadsheetId) {
    logError('Missing env vars (PROPFINDER_EMAIL, PROPFINDER_PASSWORD, GOOGLE_SHEET_ID). Check .env');
    process.exit(1);
  }

  const sheets = await getGoogleSheetsClient();
  logSuccess('Connected to Google Sheets');

  const baseLaunchConfig = {
    headless: 'new',
    defaultViewport: CONFIG.viewport,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=1400,900',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-background-timer-throttling',
      '--force-device-scale-factor=1'
    ]
  };
  if (CHROME_PATH) baseLaunchConfig.executablePath = CHROME_PATH;

  const launchAttempts = [
    { name: 'standard', config: baseLaunchConfig },
    {
      name: 'legacy-headless',
      config: {
        ...baseLaunchConfig,
        headless: true,
        args: [...baseLaunchConfig.args, '--disable-gpu', '--disable-dev-shm-usage']
      }
    },
    {
      name: 'single-process-fallback',
      config: {
        ...baseLaunchConfig,
        headless: true,
        userDataDir: '/tmp/propedge-chrome-profile',
        args: [
          ...baseLaunchConfig.args,
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--no-zygote',
          '--single-process',
          '--no-first-run',
          '--no-default-browser-check'
        ]
      }
    }
  ];

  let browser = null;
  let lastLaunchError = null;
  for (const attempt of launchAttempts) {
    try {
      log(`Launching browser (${attempt.name})...`);
      browser = await puppeteer.launch(attempt.config);
      break;
    } catch (launchError) {
      lastLaunchError = launchError;
      logWarning(`Browser launch attempt failed (${attempt.name}): ${launchError.message}`);
    }
  }

  if (!browser) {
    logWarning(`Failed to launch browser after ${launchAttempts.length} attempt(s): ${lastLaunchError ? lastLaunchError.message : 'unknown error'}`);
    log('Falling back to consolidation-only mode (no browser session).');
    await consolidateLeaguesToUnified(sheets);
    console.log('\n' + '═'.repeat(60));
    logSuccess('Fallback: Consolidated existing data (browser launch unavailable)');
    console.log('═'.repeat(60) + '\n');
    return;
  }

  const page    = await browser.newPage();

  const client = await page.target().createCDPSession();
  await client.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: CONFIG.downloadPath
  });

  try {
    log('Logging into PropFinder...');
    try {
      await page.goto('https://propfinder.app/login', { waitUntil: 'domcontentloaded', timeout: 45000 });
      await sleep(2000);

      const emailExists = await page.$('input[type="email"]').catch(() => null);
      if (!emailExists) {
        throw new Error('Login form not found — page structure may have changed');
      }

      await page.type('input[type="email"]', CONFIG.email, { delay: 20 });
      await page.type('input[type="password"]', CONFIG.password, { delay: 20 });
      await page.click('button[type="submit"]').catch(() => {
        log('Submit button not found, trying alternate selector');
        return page.click('button');
      });

      // Wait with timeout for navigation or just wait fixed time
      try {
        await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 });
      } catch (navError) {
        log('Navigation timeout, continuing anyway...');
        await sleep(5000);
      }

      await sleep(3000);
      logSuccess('Logged in');
    } catch (loginError) {
      logError(`PropFinder login failed: ${loginError.message}`);
      log('Continuing with fallback mode...');
      // Fallback: just consolidate what we have
      await consolidateLeaguesToUnified(sheets);
      console.log('\n' + '═'.repeat(60));
      logSuccess('Fallback: Consolidated existing data');
      console.log('═'.repeat(60) + '\n');
      await browser.close();
      return;
    }

    if (CAPTURE_MODE) {
      await captureSettingsAPI(page);
      log('\nCapture complete.', 1);
      await browser.close();
      return;
    }

    try {
      await selectFanDuel(page);
    } catch (e) {
      log('FanDuel selection skipped: ' + e.message);
    }
    await sleep(2000);

    async function attachDownloads(p) {
      const c = await p.target().createCDPSession();
      await c.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: CONFIG.downloadPath
      });
    }

    for (const league of CONFIG.leagues) {
      let leaguePage = null;
      try {
        leaguePage = await browser.newPage();
        await leaguePage.setViewport(CONFIG.viewport);
        await attachDownloads(leaguePage);
        await processLeague(leaguePage, sheets, league);
      } catch (e) {
        logError(`${league} failed: ${e.message}`);
      } finally {
        if (leaguePage) {
          try { await leaguePage.close(); } catch (_) {}
        }
      }
      await sleep(2000);
    }

    // CONSOLIDATE all leagues into unified propedge-main sheet (for app to read)
    log('Consolidating all leagues into propedge-main sheet...', 1);
    await consolidateLeaguesToUnified(sheets);

    // Write scrape metadata so the app can show data age
    try {
      const totalRows = await (async () => {
        const res = await sheets.spreadsheets.values.get({ spreadsheetId: CONFIG.spreadsheetId, range: 'propedge-main!A:A' });
        return Math.max(0, (res.data.values || []).length - 1); // subtract header
      })();
      await writeToSheet(sheets, 'meta', ['key', 'value'], [
        ['last_scraped', new Date().toISOString()],
        ['row_count', String(totalRows)],
      ]);
      logSuccess('Metadata tab updated', 1);
    } catch (e) {
      logWarning(`Metadata write failed (non-fatal): ${e.message}`, 1);
    }

    console.log('\n' + '═'.repeat(60));
    logSuccess('Sync complete!');
    console.log('═'.repeat(60) + '\n');

  } catch (error) {
    logError(`Fatal error: ${error.message}`);
    try {
      await page.screenshot({ path: path.join(CONFIG.downloadPath, 'error.png') }).catch(() => {});
    } catch (e) {}
  } finally {
    try {
      await browser.close();
    } catch (e) {}
  }
}

main().then(() => process.exit(0)).catch(e => { logError(e.message); process.exit(1); });
