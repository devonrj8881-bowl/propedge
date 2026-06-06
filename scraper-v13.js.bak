/**
 * PropFinder Auto-Sync Scraper v13
 * =================================
 *
 * Changes from v12:
 *  - Keeps main league tabs working exactly the same (overwrite latest data)
 *  - NEW: After each sync, appends a timestamped snapshot to Props_History tab
 *  - NEW: pruneHistory() removes rows older than HISTORY_HOURS to keep sheet lean
 *
 * History tab format (Props_History):
 *   timestamp | league | player | prop_type | line | direction | odds | pf_rating | l10_avg | l5_avg
 *
 * Usage: node scraper-v13.js --visible
 */

require('dotenv').config();
const puppeteer = require('puppeteer-core');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Find Chrome dynamically — checks multiple possible locations
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

  // If no hardcoded path works, let Puppeteer find it automatically
  console.log('⚠️  Chrome not found at common paths — letting Puppeteer find it...');
  return null;
}

const CHROME_PATH = findChrome();
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// How many hours of history to keep in Props_History tab
// 48h gives you enough to detect steam moves and day-over-day shifts
const HISTORY_HOURS = 48;
const HISTORY_TAB = 'Props_History';

const CONFIG = {
  email: process.env.PROPFINDER_EMAIL,
  password: process.env.PROPFINDER_PASSWORD,
  spreadsheetId: process.env.GOOGLE_SHEET_ID,
  leagues: ['NBA', 'NHL', 'MLB', 'NFL'],
  downloadPath: path.join(process.env.HOME, 'Downloads'),
  headless: !process.argv.includes('--visible'),
  viewport: { width: 1400, height: 900 }
};

// Local filters (applied after download) — unchanged from v12
const FILTERS = {
  pfRatingMin: 65,   // lowered from 70 — PropFinder rescaled ratings
  l5AvgMin: 0,       // removed — avg threshold was filtering too aggressively
  l10AvgMin: 0,      // removed — avg threshold was filtering too aggressively
  oddsMin: -600,     // relaxed from -500
  oddsMax: 300       // raised from 200
};

// History headers — these must stay stable once the tab is created
const HISTORY_HEADERS = [
  'timestamp', 'league', 'player', 'prop_type', 'line',
  'direction', 'odds', 'pf_rating', 'l10_avg', 'l5_avg'
];

function log(msg, indent = 0) {
  console.log(`[${new Date().toLocaleTimeString()}] ${'  '.repeat(indent)}${msg}`);
}
function logSuccess(msg, indent = 0) { log(`✅ ${msg}`, indent); }
function logWarning(msg, indent = 0) { log(`⚠️  ${msg}`, indent); }
function logError(msg, indent = 0) { log(`❌ ${msg}`, indent); }

// ============================================
// GOOGLE SHEETS
// ============================================
async function getGoogleSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: './credentials.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  return google.sheets({ version: 'v4', auth: await auth.getClient() });
}

// Overwrite main league tabs (same behavior as v12)
async function writeToSheet(sheets, tabName, headers, dataRows) {
  log(`Writing to Google Sheet tab: ${tabName}`, 1);

  try {
    await sheets.spreadsheets.values.clear({
      spreadsheetId: CONFIG.spreadsheetId,
      range: `${tabName}!A:Z`
    });
    log('Cleared existing data', 2);
  } catch (e) {
    log(`Clear failed (tab may not exist): ${e.message}`, 2);
  }

  try {
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

// Append timestamped rows to Props_History — never overwrites
async function appendToHistory(sheets, league, headers, dataRows) {
  if (!dataRows || dataRows.length === 0) return;

  log(`Appending ${dataRows.length} rows to ${HISTORY_TAB}...`, 1);

  const timestamp = new Date().toISOString();

  // Map column positions from the PropFinder headers
  const headerLower = headers.map(h => h.toLowerCase().trim());
  const cols = {
    player: headerLower.findIndex(h => h === 'player' || h === 'name'),
    prop:   headerLower.findIndex(h => h === 'prop' || h === 'market'),
    odds:   headerLower.findIndex(h => h === 'odds'),
    pf:     headerLower.findIndex(h => h.includes('pf') && h.includes('rating')),
    l10:    headerLower.findIndex(h => h === 'l10 avg'),
    l5:     headerLower.findIndex(h => h === 'l5 avg'),
  };

  const historyRows = dataRows.map(row => {
    const propStr  = cols.prop   >= 0 ? (row[cols.prop]  || '').trim() : '';
    const direction = propStr.toLowerCase().startsWith('u') ? 'UNDER' : 'OVER';
    const lineMatch = propStr.match(/[ou]?([\d.]+)/i);
    const line      = lineMatch ? lineMatch[1] : '';
    const propType  = propStr.replace(/^[ou]?[\d.]+\s*/i, '').trim();

    const oddsStr = cols.odds >= 0 ? (row[cols.odds] || '').replace(/[',]/g, '') : '';
    const oddsMatch = oddsStr.match(/[+-]?\d+/);
    const odds = oddsMatch ? oddsMatch[0] : '';

    return [
      timestamp,
      league,
      cols.player >= 0 ? (row[cols.player] || '').trim() : '',
      propType,
      line,
      direction,
      odds,
      cols.pf  >= 0 ? (row[cols.pf]  || '').trim() : '',
      cols.l10 >= 0 ? (row[cols.l10] || '').trim() : '',
      cols.l5  >= 0 ? (row[cols.l5]  || '').trim() : '',
    ];
  });

  try {
    // Ensure the tab and header row exist before appending
    await ensureHistoryTabExists(sheets);

    await sheets.spreadsheets.values.append({
      spreadsheetId: CONFIG.spreadsheetId,
      range: `${HISTORY_TAB}!A:J`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: { values: historyRows }
    });
    logSuccess(`Appended ${historyRows.length} history rows for ${league}`, 2);
  } catch (e) {
    logError(`History append failed: ${e.message}`, 2);
  }
}

// Create Props_History tab and write headers if it doesn't exist yet
async function ensureHistoryTabExists(sheets) {
  try {
    // Try reading row 1 — if it fails, tab doesn't exist
    const check = await sheets.spreadsheets.values.get({
      spreadsheetId: CONFIG.spreadsheetId,
      range: `${HISTORY_TAB}!A1:J1`
    });

    const existingHeaders = check.data.values?.[0] || [];
    if (existingHeaders.length === 0) {
      // Tab exists but is empty — write headers
      await sheets.spreadsheets.values.update({
        spreadsheetId: CONFIG.spreadsheetId,
        range: `${HISTORY_TAB}!A1`,
        valueInputOption: 'RAW',
        resource: { values: [HISTORY_HEADERS] }
      });
      log(`Wrote headers to ${HISTORY_TAB}`, 2);
    }
  } catch (e) {
    // Tab doesn't exist — create it, then write headers
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: CONFIG.spreadsheetId,
        resource: {
          requests: [{
            addSheet: { properties: { title: HISTORY_TAB } }
          }]
        }
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId: CONFIG.spreadsheetId,
        range: `${HISTORY_TAB}!A1`,
        valueInputOption: 'RAW',
        resource: { values: [HISTORY_HEADERS] }
      });
      logSuccess(`Created ${HISTORY_TAB} tab and wrote headers`, 2);
    } catch (createErr) {
      logWarning(`Could not create ${HISTORY_TAB}: ${createErr.message}`, 2);
    }
  }
}

// Remove rows older than HISTORY_HOURS from Props_History
// Reads all rows, filters, rewrites — runs once per full sync cycle
async function pruneHistory(sheets) {
  log(`Pruning ${HISTORY_TAB} (keeping last ${HISTORY_HOURS}h)...`);

  try {
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: CONFIG.spreadsheetId,
      range: `${HISTORY_TAB}!A:J`
    });

    const rows = result.data.values || [];
    if (rows.length < 2) {
      log('History tab empty or headers only — nothing to prune', 1);
      return;
    }

    const headers = rows[0];
    const dataRows = rows.slice(1);
    const cutoff = new Date(Date.now() - HISTORY_HOURS * 60 * 60 * 1000);

    const kept = dataRows.filter(row => {
      try {
        return new Date(row[0]) >= cutoff;
      } catch {
        return true; // Keep rows with unparseable timestamps
      }
    });

    const pruned = dataRows.length - kept.length;

    if (pruned === 0) {
      log(`Nothing to prune (${dataRows.length} rows all within ${HISTORY_HOURS}h)`, 1);
      return;
    }

    // Rewrite the tab with only kept rows
    await sheets.spreadsheets.values.clear({
      spreadsheetId: CONFIG.spreadsheetId,
      range: `${HISTORY_TAB}!A:J`
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId: CONFIG.spreadsheetId,
      range: `${HISTORY_TAB}!A1`,
      valueInputOption: 'RAW',
      resource: { values: [headers, ...kept] }
    });

    logSuccess(`Pruned ${pruned} old rows. ${kept.length} rows remaining.`, 1);
  } catch (e) {
    logWarning(`Prune failed: ${e.message}`, 1);
  }
}

// ============================================
// CSV PARSING (unchanged from v12)
// ============================================
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

    if (files.length > 0 && Date.now() - files[0].time < maxAgeMs) {
      return files[0].path;
    }
  } catch (e) {}
  return null;
}

function applyFilters(rows) {
  if (!rows || rows.length < 2) return { headers: [], data: [] };

  let headers = rows[0];
  let data = rows.slice(1);

  // ── Strip 'saved' column if PropFinder added it ──────────────────────────
  // PropFinder now exports a leading 'saved' bookmark column — remove it
  // so the sheet stays clean and index.html doesn't get confused.
  const savedIdx = headers.map(h => h.toLowerCase().trim()).indexOf('saved');
  if (savedIdx !== -1) {
    headers = headers.filter((_, i) => i !== savedIdx);
    data = data.map(row => row.filter((_, i) => i !== savedIdx));
    log(`Stripped 'saved' column (was at index ${savedIdx})`, 2);
  }

  const headerLower = headers.map(h => h.toLowerCase().trim());

  const cols = {
    pf:   headerLower.findIndex(h => h.includes('pf') && h.includes('rating')),
    l5:   headerLower.findIndex(h => h === 'l5 avg'),
    l10:  headerLower.findIndex(h => h === 'l10 avg'),
    odds: headerLower.findIndex(h => h === 'odds')
  };

  log(`Headers after strip: ${headers.join(' | ')}`, 2);
  log(`Column indices - PF: ${cols.pf}, L5: ${cols.l5}, L10: ${cols.l10}, Odds: ${cols.odds}`, 2);

  // Sample first row values so we can see what's being filtered
  if (data.length > 0) {
    const sample = data[0];
    log(`Sample row[0] - PF: ${cols.pf >= 0 ? sample[cols.pf] : 'n/a'}, L5avg: ${cols.l5 >= 0 ? sample[cols.l5] : 'n/a'}, L10avg: ${cols.l10 >= 0 ? sample[cols.l10] : 'n/a'}, Odds: ${cols.odds >= 0 ? sample[cols.odds] : 'n/a'}`, 2);
  }

  const filtered = data.filter(row => {
    const pf  = cols.pf  >= 0 ? parseFloat(row[cols.pf])  || 0 : 100;
    const l5  = cols.l5  >= 0 ? parseFloat(row[cols.l5])  || 0 : 100;
    const l10 = cols.l10 >= 0 ? parseFloat(row[cols.l10]) || 0 : 100;

    let odds = 0;
    if (cols.odds >= 0) {
      const oddsStr = (row[cols.odds] || '').replace(/[',]/g, '');
      const oddsMatch = oddsStr.match(/[+-]?\d+/);
      odds = oddsMatch ? parseInt(oddsMatch[0]) : 0;
    }

    const pass = pf  >= FILTERS.pfRatingMin &&
                 l5  >  FILTERS.l5AvgMin   &&
                 l10 >  FILTERS.l10AvgMin  &&
                 odds >= FILTERS.oddsMin   &&
                 odds <= FILTERS.oddsMax;

    if (!pass) {
      log(`  FILTERED OUT: pf=${pf} l5=${l5} l10=${l10} odds=${odds}`, 3);
    }
    return pass;
  });

  log(`Filter result: ${data.length} rows in -> ${filtered.length} rows out`, 2);
  return { headers, data: filtered };
}

// ============================================
// PROPFINDER AUTOMATION (unchanged from v12)
// ============================================
async function login(page) {
  log('Logging into PropFinder...');
  await page.goto('https://propfinder.app/login', { waitUntil: 'networkidle2' });
  await sleep(2000);
  await page.type('input[type="email"]', CONFIG.email, { delay: 30 });
  await page.type('input[type="password"]', CONFIG.password, { delay: 30 });
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(5000);
  logSuccess('Logged in');
}

async function selectAllGames(page) {
  log('Selecting all games...', 1);
  const gamesClicked = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll('*'));
    const candidates = [];
    for (const el of elements) {
      const text = el.textContent.trim();
      if (/^\d+\s+selected$/i.test(text)) {
        const rect = el.getBoundingClientRect();
        if (rect.top > 50 && rect.top < 200) {
          candidates.push({ el, left: rect.left });
        }
      }
    }
    candidates.sort((a, b) => b.left - a.left);
    if (candidates[0]) { candidates[0].el.click(); return true; }
    return false;
  });
  if (gamesClicked) {
    await sleep(1500);
    await page.evaluate(() => {
      for (const el of document.querySelectorAll('*')) {
        if (el.textContent.trim().toLowerCase() === 'select all') { el.click(); return; }
      }
    });
    logSuccess('Selected all games', 2);
    await page.keyboard.press('Escape');
    await sleep(1000);
  } else {
    logWarning('Could not find Games dropdown', 2);
  }
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
  const clicked = await page.evaluate((dir) => {
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

async function downloadCSV(page) {
  log('Downloading CSV...', 1);
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
      if (text === 'Download as CSV' || text === 'Download CSV' || text === 'CSV') { el.click(); return true; }
    }
    return false;
  });
  if (!csvClicked) { logWarning('Could not find CSV option', 2); await page.keyboard.press('Escape'); return null; }
  log('Clicked Download as CSV', 2);
  await sleep(5000);
  const csvPath = findLatestCSV();
  if (csvPath) {
    log(`Found: ${path.basename(csvPath)}`, 2);
    const data = fs.readFileSync(csvPath, 'utf-8');
    const rows = parseCSV(data);
    logSuccess(`Downloaded ${rows.length - 1} rows`, 2);
    try { fs.unlinkSync(csvPath); } catch (e) {}
    return rows;
  }
  logWarning('No CSV file found in Downloads', 2);
  return null;
}

// ============================================
// PROCESS LEAGUE — now also appends history
// ============================================
async function processLeague(page, sheets, league) {
  log(`\n${'='.repeat(50)}`);
  log(`Processing ${league}`);
  log('='.repeat(50));

  const url = `https://propfinder.app/${league.toLowerCase()}/`;
  log(`Navigating to ${url}`, 1);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(8000);
  logSuccess('Page loaded', 1);

  await selectAllGames(page);
  await sleep(2000);
  await toggleAltLines(page);
  await sleep(2000);

  await clickOverUnder(page, 'OVER');
  const overData = await downloadCSV(page);

  await clickOverUnder(page, 'UNDER');
  const underData = await downloadCSV(page);

  let allData = [];
  let headers = null;

  if (overData?.length > 1)  { headers = overData[0];  allData = allData.concat(overData.slice(1)); }
  if (underData?.length > 1) { if (!headers) headers = underData[0]; allData = allData.concat(underData.slice(1)); }

  log(`Combined raw data: ${allData.length} rows`, 1);
  if (allData.length === 0 || !headers) { logWarning(`No data for ${league}`); return; }

  log(`Applying filters...`, 1);
  const { data: filtered } = applyFilters([headers, ...allData]);
  log(`After filters: ${filtered.length} rows`, 1);

  // 1. Overwrite main league tab (current behavior)
  if (filtered.length > 0) {
    await writeToSheet(sheets, league, headers, filtered);
  } else {
    logWarning(`No rows passed filters for ${league}`, 1);
  }

  // 2. NEW: Append ALL filtered rows to history with timestamp
  //    We store all data that passed filters — not just the latest snapshot
  if (filtered.length > 0) {
    await appendToHistory(sheets, league, headers, filtered);
  }
}

// ============================================
// MAIN
// ============================================
async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log(' PropFinder Auto-Sync v13 (with history)');
  console.log(' ' + new Date().toLocaleString());
  console.log('═'.repeat(60) + '\n');

  log('Filter settings:');
  log(`  PF Rating >= ${FILTERS.pfRatingMin}`);
  log(`  L5 Avg > ${FILTERS.l5AvgMin}`);
  log(`  L10 Avg > ${FILTERS.l10AvgMin}`);
  log(`  Odds: ${FILTERS.oddsMin} to ${FILTERS.oddsMax}`);
  log(`  History: keeping last ${HISTORY_HOURS}h in ${HISTORY_TAB}`);
  console.log('');

  const sheets = await getGoogleSheetsClient();
  logSuccess('Connected to Google Sheets');

  // Prune stale history rows at the top of each run
  await pruneHistory(sheets);

  const launchConfig = {
    headless: CONFIG.headless,
    defaultViewport: CONFIG.viewport,
    args: ['--no-sandbox']
  };

  // Only set executablePath if we found Chrome; otherwise Puppeteer uses default
  if (CHROME_PATH) {
    launchConfig.executablePath = CHROME_PATH;
  }

  const browser = await puppeteer.launch(launchConfig);

  const page = await browser.newPage();

  const client = await page.target().createCDPSession();
  await client.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: CONFIG.downloadPath
  });

  try {
    await login(page);

    for (const league of CONFIG.leagues) {
      try {
        await processLeague(page, sheets, league);
      } catch (e) {
        logError(`${league} failed: ${e.message}`);
      }
      await sleep(2000);
    }

    console.log('\n' + '═'.repeat(60));
    logSuccess('Sync completed!');
    console.log('═'.repeat(60) + '\n');

  } catch (error) {
    logError(`Fatal error: ${error.message}`);
    await page.screenshot({ path: path.join(CONFIG.downloadPath, 'error.png') });
  } finally {
    await browser.close();
  }
}

main().catch(e => { logError(e.message); process.exit(1); });
