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

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
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
  console.log('⚠️  Chrome not found at common paths — letting Puppeteer find it...');
  return null;
}

const CHROME_PATH = findChrome();
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const CAPTURE_MODE   = process.argv.includes('--capture');
const RESET_BOOKS    = process.argv.includes('--reset-books');
const SETTINGS_FILE  = path.join(__dirname, '..', 'propfinder-settings-api.json');
const PROFILE_DIR    = path.join(__dirname, '..', 'chrome-profile');
const PROFILE_STATE  = path.join(__dirname, '..', 'profile-state.json');
const ENRICHMENT_DIR = path.join(__dirname, '..', 'propedge-enriched');

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

const FILTERS = {
  pfRatingMin: 60,
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
    keyFile: path.join(__dirname, '..', 'credentials.json'),
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
  } catch (e) {
    log(`Clear failed: ${e.message}`, 2);
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

async function archiveOldData(sheets, tabName) {
  log(`Archiving old data from ${tabName}...`, 1);

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
    return false;
  }
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

// ─── Enrichment CSV Loading & Merging ────────────────────────────────────────

/**
 * Load the latest enrichment CSV for a given sport
 * Returns { headers, data } or null if not found
 */
function loadEnrichmentCSV(sport) {
  try {
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

    logSuccess(`Loaded enrichment: ${path.basename(csvPath)} (${rows.length - 1} rows)`, 2);
    return { headers: rows[0], data: rows.slice(1) };
  } catch (e) {
    logError(`Failed to load enrichment CSV: ${e.message}`, 2);
    return null;
  }
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

  // Build enrichment lookup map: "PLAYERNAME|PROPNAME" -> enrichment row
  const enrichmentMap = {};
  eData.forEach(row => {
    const playerName = (row[ePlayerIdx] || '').trim().toUpperCase();
    const propName = (row[ePropIdx] || '').trim().toUpperCase();
    const key = `${playerName}|${propName}`;
    enrichmentMap[key] = row;
  });

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
  const mergedData = pfData.map(pfRow => {
    const playerName = (pfRow[pfPlayerIdx] || '').trim().toUpperCase();
    const propName = (pfRow[pfPropIdx] || '').trim().toUpperCase();
    const key = `${playerName}|${propName}`;

    const mergedRow = [...pfRow];
    const eRow = enrichmentMap[key];

    if (eRow) {
      if (eConfidenceIdx >= 0) mergedRow.push(eRow[eConfidenceIdx] || '');
      if (eMatchupIdx >= 0) mergedRow.push(eRow[eMatchupIdx] || '');
      if (eMatchupRankIdx >= 0) mergedRow.push(eRow[eMatchupRankIdx] || '');
      if (eVarianceIdx >= 0) mergedRow.push(eRow[eVarianceIdx] || '');
      if (eL10Idx >= 0) mergedRow.push(eRow[eL10Idx] || '');
    } else {
      // No enrichment match — fill with blanks
      enrichmentCols.forEach(() => mergedRow.push(''));
    }

    return mergedRow;
  });

  const matchedCount = mergedData.filter(row => {
    const playerName = (row[pfPlayerIdx] || '').trim().toUpperCase();
    const propName = (row[pfPropIdx] || '').trim().toUpperCase();
    const key = `${playerName}|${propName}`;
    return enrichmentMap[key];
  }).length;

  logSuccess(`Enrichment merged: ${matchedCount}/${mergedData.length} props matched`, 2);

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
  log('Configuring FanDuel as only sportsbook (UI)...', 1);

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

  await _unhideModals(page);
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('button, div, span, td, li, p')) {
      if (el.textContent.trim().toUpperCase() === 'FANDUEL') {
        el.scrollIntoView({ block: 'center', behavior: 'instant' });
        break;
      }
    }
  });
  await sleep(600);
  await _unhideModals(page);

  const fdCoords = await page.evaluate(() => {
    for (const el of document.querySelectorAll('button, div, span, td, li, p')) {
      if (el.textContent.trim().toUpperCase() === 'FANDUEL') {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= window.innerHeight) {
          return { x: r.left + r.width / 2, y: r.top + r.height / 2, inView: true };
        }
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, inView: false };
      }
    }
    return null;
  });
  if (!fdCoords) { logWarning('FANDUEL not found in list', 2); return; }
  if (!fdCoords.inView) {
    logWarning(`FANDUEL still outside viewport after scroll (y=${Math.round(fdCoords.y)}) — clamping`, 2);
  }
  const clampedY = Math.min(fdCoords.y, CONFIG.viewport.height - 10);
  await page.mouse.click(fdCoords.x, clampedY);
  logSuccess(`FanDuel clicked (${Math.round(fdCoords.x)}, ${Math.round(clampedY)}) inView=${fdCoords.inView}`, 2);
  await sleep(1200);

  await page.keyboard.press('Escape');
  logSuccess('Escaped inner sportsbook picker', 2);
  await sleep(1500);
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
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
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
    logWarning('Could not find Games dropdown', 2);
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
  try { fs.unlinkSync(csvPath); } catch (e) {}
  return rows;
}

// ─── Per-league pipeline (WITH ENRICHMENT) ────────────────────────────────────

async function processLeague(page, sheets, league) {
  log(`\n${'='.repeat(50)}`);
  log(`Processing ${league}`);
  log('='.repeat(50));

  const url = `https://propfinder.app/${league.toLowerCase()}/`;
  log(`Navigating to ${url}`, 1);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
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

  await clickOverUnder(page, 'OVER');
  const overData = await downloadCSV(page);

  await clickOverUnder(page, 'UNDER');
  const underData = await downloadCSV(page);

  let allData = [];
  let headers = null;

  if (overData?.length  > 1) { headers = overData[0];  allData = allData.concat(overData.slice(1)); }
  if (underData?.length > 1) { if (!headers) headers = underData[0]; allData = allData.concat(underData.slice(1)); }

  log(`Combined raw data: ${allData.length} rows`, 1);
  if (allData.length === 0 || !headers) { logWarning(`No data for ${league}`); return; }

  const { headers: cleanHeaders, data: filtered } = applyFilters([headers, ...allData]);
  log(`After filters: ${filtered.length} rows`, 1);

  // LOAD AND MERGE ENRICHMENT
  log('Attempting enrichment merge...', 1);
  const enrichment = loadEnrichmentCSV(league);
  const { headers: mergedHeaders, data: mergedData } = mergeEnrichmentData(cleanHeaders, filtered, enrichment);

  if (mergedData.length > 0) {
    // Archive old data before writing new data
    await archiveOldData(sheets, league);
    await writeToSheet(sheets, league, mergedHeaders, mergedData);
  } else {
    logWarning(`No rows passed filters for ${league}`, 1);
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

  const launchConfig = {
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
  if (CHROME_PATH) launchConfig.executablePath = CHROME_PATH;

  const browser = await puppeteer.launch(launchConfig);
  const page    = await browser.newPage();

  const client = await page.target().createCDPSession();
  await client.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: CONFIG.downloadPath
  });

  try {
    log('Logging into PropFinder...');
    await page.goto('https://propfinder.app/login', { waitUntil: 'networkidle2' });
    await sleep(2000);
    await page.type('input[type="email"]', CONFIG.email, { delay: 30 });
    await page.type('input[type="password"]', CONFIG.password, { delay: 30 });
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(5000);
    logSuccess('Logged in');

    if (CAPTURE_MODE) {
      await captureSettingsAPI(page);
      log('\nCapture complete.', 1);
      await browser.close();
      return;
    }
    await selectFanDuel(page);
    await sleep(2000);

    for (const league of CONFIG.leagues) {
      try {
        await processLeague(page, sheets, league);
      } catch (e) {
        logError(`${league} failed: ${e.message}`);
      }
      await sleep(2000);
    }

    console.log('\n' + '═'.repeat(60));
    logSuccess('Sync complete!');
    console.log('═'.repeat(60) + '\n');

  } catch (error) {
    logError(`Fatal error: ${error.message}`);
    await page.screenshot({ path: path.join(CONFIG.downloadPath, 'error.png') }).catch(() => {});
  } finally {
    await browser.close();
  }
}

main().catch(e => { logError(e.message); process.exit(1); });
