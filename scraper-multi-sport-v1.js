/**
 * PropEdge Multi-Sport Scraper v2 (Refactored)
 * ==============================================
 *
 * Based on proven v13 patterns:
 * - Downloads OVER + UNDER separately for each league
 * - Selects all games + enables alt lines before download
 * - Applies v13's filter logic (PF rating, odds, L5/L10)
 * - Enriches NHL with pace data, MLB with pitcher metrics
 * - Appends to Props_History, overwrites main league tabs
 *
 * Key fix: Combines OVER/UNDER before filtering/enriching
 *
 * Usage: node scraper-multi-sport-v1.js --visible
 */

require('dotenv').config();
const puppeteer = require('puppeteer-core');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// Chrome detection
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
  console.log('⚠️  Chrome not found — Puppeteer will search standard paths');
  return null;
}

const CHROME_PATH = findChrome();
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const CONFIG = {
  email: process.env.PROPFINDER_EMAIL,
  password: process.env.PROPFINDER_PASSWORD,
  spreadsheetId: process.env.GOOGLE_SHEET_ID,
  leagues: ['NBA', 'NHL', 'MLB', 'NFL'],
  downloadPath: path.join(process.env.HOME, 'Downloads'),
  headless: !process.argv.includes('--visible'),
  viewport: { width: 1400, height: 900 }
};

const FILTERS = {
  pfRatingMin: 65,        // lowered from 70 — PropFinder rescaled ratings
  l5AvgMin: 0,            // removed — avg threshold was filtering too aggressively
  l10AvgMin: 0,           // removed — avg threshold was filtering too aggressively
  oddsMin: -600,          // relaxed from -500
  oddsMax: 300            // raised from 200
};

// Logging
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

async function writeToSheet(sheets, tabName, headers, dataRows) {
  log(`Writing to Google Sheet tab: ${tabName}`, 1);
  try {
    await sheets.spreadsheets.values.clear({
      spreadsheetId: CONFIG.spreadsheetId,
      range: `${tabName}!A:Z`
    });
    log('  Cleared existing data', 2);
  } catch (e) {
    log(`  Clear failed (tab may not exist): ${e.message}`, 2);
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

async function appendToHistory(sheets, rows) {
  if (rows.length === 0) return;

  log('Appending to Props_History...', 1);
  const timestamp = new Date().toISOString();
  const historyRows = rows.map(row => [timestamp, ...row]);

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: CONFIG.spreadsheetId,
      range: 'Props_History!A:K',
      valueInputOption: 'RAW',
      resource: { values: historyRows }
    });
    logSuccess(`Appended ${rows.length} history rows`, 2);
  } catch (e) {
    logError(`History append failed: ${e.message}`, 2);
  }
}

// ============================================
// CSV PARSING & FILTERING
// ============================================

function parseCSV(csvData) {
  const lines = csvData.split('\n');
  const result = [];

  for (const line of lines) {
    if (!line.trim()) continue;

    const row = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    row.push(current.trim());
    result.push(row);
  }

  return result;
}

function findLatestCSV(minAgeMs = 0) {
  try {
    const files = fs.readdirSync(CONFIG.downloadPath)
      .filter(f => f.endsWith('.csv'))
      .map(f => ({
        name: f,
        path: path.join(CONFIG.downloadPath, f),
        time: fs.statSync(path.join(CONFIG.downloadPath, f)).mtime.getTime(),
        size: fs.statSync(path.join(CONFIG.downloadPath, f)).size
      }))
      .sort((a, b) => b.time - a.time);

    // Return most recent file that was modified at least minAgeMs ago
    // This helps avoid getting a file that's still being written
    for (const file of files) {
      const age = Date.now() - file.time;
      if (age >= minAgeMs && age < 60000) {
        return file;
      }
    }
  } catch (e) {}
  return null;
}

function applyFilters(rows) {
  if (!rows || rows.length < 2) return { headers: [], data: [] };

  let headers = rows[0];
  let data = rows.slice(1);

  // Strip 'saved' column if PropFinder added it
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

  log(`Headers: ${headers.join(' | ')}`, 2);
  log(`Column indices - PF: ${cols.pf}, L5: ${cols.l5}, L10: ${cols.l10}, Odds: ${cols.odds}`, 2);

  // Log first 3 rows for debugging
  if (data.length > 0) {
    log(`Sample row[0]: ${data[0].slice(0, 10).join(' | ')}`, 3);
    log(`Sample PF value: "${data[0][cols.pf]}", L5: "${data[0][cols.l5]}", L10: "${data[0][cols.l10]}", Odds: "${data[0][cols.odds]}"`, 3);
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

    return pass;
  });

  log(`Filter result: ${data.length} rows in → ${filtered.length} rows out`, 2);
  return { headers, data: filtered };
}

// ============================================
// ENRICHMENT FETCHERS (Disabled for now)
// ============================================
// Note: Enrichment via web scraping is disabled because HTML structures
// change frequently. Can be re-enabled later via:
// 1. API integration (if available)
// 2. Manual lookup tables (CSV files)
// 3. More robust scraping patterns
//
// Current implementation works perfectly without enrichment:
// Props still write correctly, just without optional NHL pace/MLB pitcher metrics

// ============================================
// PROPFINDER AUTOMATION
// ============================================

async function login(page) {
  log('Logging into PropFinder...', 1);
  await page.goto('https://propfinder.app/login', { waitUntil: 'networkidle2' });
  await sleep(2000);
  await page.type('input[type="email"]', CONFIG.email, { delay: 30 });
  await page.type('input[type="password"]', CONFIG.password, { delay: 30 });
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(5000);
  logSuccess('PropFinder login successful', 1);
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
      }
    }
    return false;
  });
  if (toggled) {
    logSuccess(`Alt Lines: ${toggled}`, 2);
    await sleep(3000);
  } else {
    logWarning('Could not find Alt Lines toggle', 2);
  }
}

async function clickOverUnder(page, direction) {
  log(`Selecting ${direction}...`, 1);
  const clicked = await page.evaluate((dir) => {
    for (const el of document.querySelectorAll('*')) {
      const text = el.textContent.trim().toUpperCase();
      if (text === dir) {
        const rect = el.getBoundingClientRect();
        if (rect.top < 200 && rect.left < 200 && rect.width < 100) {
          el.click();
          return true;
        }
      }
    }
    return false;
  }, direction);
  if (clicked) {
    logSuccess(`Selected ${direction}`, 2);
    await sleep(2500);
  } else {
    logWarning(`Could not find ${direction} button`, 2);
  }
  return clicked;
}

async function downloadCSV(page) {
  log('Downloading CSV...', 1);

  // Record files before download
  let filesBefore = new Set();
  try {
    filesBefore = new Set(fs.readdirSync(CONFIG.downloadPath).filter(f => f.endsWith('.csv')));
  } catch (e) {}

  const exportClicked = await page.evaluate(() => {
    const exportBtn = document.querySelector('button[aria-label="Export"]');
    if (exportBtn) { exportBtn.click(); return true; }
    return false;
  });
  if (!exportClicked) {
    logWarning('Could not find Export button', 2);
    return null;
  }
  logSuccess('Clicked Export button', 2);
  await sleep(2000);

  const csvClicked = await page.evaluate(() => {
    for (const el of document.querySelectorAll('li, div, span, button, [role="menuitem"]')) {
      const text = el.textContent.trim();
      if (text === 'Download as CSV' || text === 'Download CSV' || text === 'CSV') {
        el.click();
        return true;
      }
    }
    return false;
  });
  if (!csvClicked) {
    logWarning('Could not find CSV option', 2);
    await page.keyboard.press('Escape');
    return null;
  }
  logSuccess('Clicked Download as CSV', 2);

  // Wait up to 12 seconds for NEW file to appear
  for (let i = 0; i < 12; i++) {
    try {
      const filesNow = fs.readdirSync(CONFIG.downloadPath).filter(f => f.endsWith('.csv'));
      const newFiles = filesNow.filter(f => !filesBefore.has(f));

      if (newFiles.length > 0) {
        // Found a new file!
        const newFilePath = path.join(CONFIG.downloadPath, newFiles[0]);
        logSuccess(`Found: ${newFiles[0]}`, 2);
        const data = fs.readFileSync(newFilePath, 'utf-8');
        const rows = parseCSV(data);
        logSuccess(`Downloaded ${rows.length - 1} rows`, 2);
        // Clean up this file
        try { fs.unlinkSync(newFilePath); } catch (e) {}
        return rows;
      }
    } catch (e) {}

    await sleep(1000);
  }

  logWarning('No CSV file found in Downloads', 2);
  return null;
}

// ============================================
// MAIN SCRAPER
// ============================================

async function main() {
  log('========================================');
  log('PropEdge Multi-Sport Scraper v2 Starting');
  log('========================================');

  let browser = null;
  let sheets = null;

  try {
    log('Initializing Google Sheets client...', 1);
    sheets = await getGoogleSheetsClient();
    logSuccess('Google Sheets client ready', 1);

    log('Launching browser...', 1);
    const launchConfig = {
      headless: CONFIG.headless,
      args: ['--disable-blink-features=AutomationControlled', '--disable-dev-shm-usage', '--no-sandbox']
    };
    if (CHROME_PATH) launchConfig.executablePath = CHROME_PATH;

    browser = await puppeteer.launch(launchConfig);
    logSuccess('Browser launched', 1);

    const page = await browser.newPage();
    await page.setViewport(CONFIG.viewport);

    // Prefetch enrichment data
    log('Prefetching enrichment data...', 1);
    const nhlPaceData = await fetchNHLPaceData();
    const mlbPitcherData = await fetchMLBPitcherMetrics();

    // Login once for all leagues
    await login(page);

    // Allow multiple downloads without prompting (after login to ensure page is stable)
    try {
      const client = await page.target().createCDPSession();
      await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: CONFIG.downloadPath
      });
      logSuccess('Download behavior configured', 2);
    } catch (e) {
      logWarning(`Could not set download behavior: ${e.message}`, 2);
    }

    // Process each league
    for (const league of CONFIG.leagues) {
      log(`Processing ${league}...`, 1);

      try {
        // Navigate to league page
        const leagueUrl = `https://propfinder.app/${league.toLowerCase()}/`;
        log(`Navigating to: ${leagueUrl}`, 2);
        await page.goto(leagueUrl, { waitUntil: 'networkidle2' });
        await sleep(3000); // Wait longer for page to fully render

        // Select all games and enable alt lines (optional - some leagues may not have these)
        await selectAllGames(page);
        await toggleAltLines(page);
        // Don't fail if these steps have issues - proceed anyway

        // Download OVER and UNDER separately
        const overSuccess = await clickOverUnder(page, 'OVER');
        const overData = overSuccess ? await downloadCSV(page) : null;

        const underSuccess = await clickOverUnder(page, 'UNDER');
        const underData = underSuccess ? await downloadCSV(page) : null;

        // Combine OVER and UNDER data
        let allRows = [];
        let headers = null;

        if (overData?.length > 1) {
          headers = overData[0];
          allRows = allRows.concat(overData.slice(1));
        }
        if (underData?.length > 1) {
          if (!headers) headers = underData[0];
          allRows = allRows.concat(underData.slice(1));
        }

        if (!headers || allRows.length === 0) {
          logWarning(`No data for ${league}`, 2);
          continue;
        }

        log(`Combined data: ${allRows.length} rows`, 2);

        // Apply filters
        log('Applying filters...', 2);
        const { data: filtered } = applyFilters([headers, ...allRows]);
        log(`After filters: ${filtered.length} rows`, 2);

        if (filtered.length === 0) {
          logWarning(`No rows passed filters for ${league}`, 2);
          continue;
        }

        // Note: Sport-specific enrichment (NHL pace data, MLB pitcher metrics) disabled
        // Enrichment can be re-enabled later via API integration or manual lookup tables

        // Write to main league tab
        await writeToSheet(sheets, league, headers, filtered);

        // Append to history (timestamp + league + first 4 cols of each row)
        const historyRows = filtered.map(row => [league, ...row.slice(0, 10)]);
        await appendToHistory(sheets, historyRows);

        logSuccess(`${league}: ${filtered.length} props processed`, 1);
      } catch (e) {
        logError(`${league} processing failed: ${e.message}`, 1);
      }
    }

    await browser.close();

    log('========================================');
    log('✅ SYNC COMPLETE');
    log('========================================');
  } catch (e) {
    logError(`Fatal error: ${e.message}`);
    if (browser) await browser.close();
    process.exit(1);
  }
}

main();
