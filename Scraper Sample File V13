/**
 * PropFinder FanDuel Scraper (Direct DOM Version)
 * ===============================================
 * - NO CSV downloads
 * - Scrapes FanDuel odds directly from UI
 * - Writes clean data to Google Sheets
 * - Appends to Props_History
 */

require('dotenv').config();
const puppeteer = require('puppeteer-core');
const { google } = require('googleapis');
const fs = require('fs');

// ============================================
// CONFIG
// ============================================
const CONFIG = {
  email: process.env.PROPFINDER_EMAIL,
  password: process.env.PROPFINDER_PASSWORD,
  spreadsheetId: process.env.GOOGLE_SHEET_ID,
  leagues: ['NBA', 'NHL', 'MLB', 'NFL'],
  headless: !process.argv.includes('--visible'),
  viewport: { width: 1400, height: 900 }
};

const HISTORY_TAB = 'Props_History';

// ============================================
// HELPERS
// ============================================
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function log(msg, indent = 0) {
  console.log(`[${new Date().toLocaleTimeString()}] ${'  '.repeat(indent)}${msg}`);
}
function logSuccess(msg, indent = 0) { log(`✅ ${msg}`, indent); }
function logWarning(msg, indent = 0) { log(`⚠️ ${msg}`, indent); }
function logError(msg, indent = 0) { log(`❌ ${msg}`, indent); }

// ============================================
// GOOGLE SHEETS
// ============================================
async function getSheets() {
  const auth = new google.auth.GoogleAuth({
    keyFile: './credentials.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  return google.sheets({ version: 'v4', auth: await auth.getClient() });
}

async function writeToSheet(sheets, tab, headers, rows) {
  await sheets.spreadsheets.values.clear({
    spreadsheetId: CONFIG.spreadsheetId,
    range: `${tab}!A:Z`
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: CONFIG.spreadsheetId,
    range: `${tab}!A1`,
    valueInputOption: 'RAW',
    resource: { values: [headers, ...rows] }
  });

  logSuccess(`Saved ${rows.length} rows → ${tab}`, 1);

  if (rows.length > 0) {
    log(`Sample row: ${JSON.stringify(rows[0])}`, 2);
  }
}

async function appendHistory(sheets, league, rows) {
  const timestamp = new Date().toISOString();

  const formatted = rows.map(r => [
    timestamp,
    league,
    r[0], // player
    r[1], // prop_type
    r[2], // line
    r[3], // direction
    r[4]  // odds
  ]);

  await sheets.spreadsheets.values.append({
    spreadsheetId: CONFIG.spreadsheetId,
    range: `${HISTORY_TAB}!A:G`,
    valueInputOption: 'RAW',
    resource: { values: formatted }
  });

  logSuccess(`History appended (${formatted.length})`, 2);
}

// ============================================
// LOGIN
// ============================================
async function login(page) {
  log('Logging in...');

  await page.goto('https://propfinder.app/login', {
    waitUntil: 'networkidle2'
  });

  await sleep(2000);

  await page.type('input[type="email"]', CONFIG.email);
  await page.type('input[type="password"]', CONFIG.password);

  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle2' });

  logSuccess('Logged in');
}

// ============================================
// AUTO SCROLL
// ============================================
async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise(resolve => {
      let total = 0;
      const step = 500;

      const timer = setInterval(() => {
        window.scrollBy(0, step);
        total += step;

        if (total >= document.body.scrollHeight - window.innerHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 250);
    });
  });
}

// ============================================
// SCRAPER (FanDuel ONLY)
// ============================================
async function scrapeFanDuel(page, league) {
  log(`Scraping ${league}...`, 1);

  await page.goto(`https://propfinder.app/${league.toLowerCase()}`, {
    waitUntil: 'networkidle2'
  });

  await sleep(5000);
  await autoScroll(page);

  const data = await page.evaluate(() => {
    const rows = [];

    const cards = document.querySelectorAll('div');

    cards.forEach(card => {
      try {
        const text = card.innerText;
        if (!text) return;

        // ONLY FanDuel rows
        if (!text.toLowerCase().includes('fanduel')) return;

        // Player
        const playerMatch = text.match(/^([A-Za-z.\-'\s]+)\n/);
        const player = playerMatch ? playerMatch[1].trim() : '';

        // Prop
        const propMatch = text.match(/([OU]\d+\.?\d*\s+[A-Za-z]+)/i);
        if (!propMatch) return;

        const propStr = propMatch[1];

        const direction = propStr.startsWith('U') ? 'UNDER' : 'OVER';
        const line = (propStr.match(/[\d.]+/) || [])[0] || '';
        const propType = propStr.replace(/^[OU][\d.]+\s*/, '');

        // FanDuel odds ONLY
        const oddsMatch = text.match(/FanDuel[^+\-]*([+-]\d{2,4})/i);
        const odds = oddsMatch ? oddsMatch[1] : '';

        if (!player || !line || !odds) return;

        rows.push([
          player,
          propType,
          line,
          direction,
          odds
        ]);

      } catch (e) {}
    });

    return rows;
  });

  logSuccess(`${data.length} props scraped (${league})`, 2);

  return {
    headers: ['player', 'prop_type', 'line', 'direction', 'odds'],
    data
  };
}

// ============================================
// MAIN
// ============================================
(async () => {
  const browser = await puppeteer.launch({
    headless: CONFIG.headless,
    defaultViewport: CONFIG.viewport
  });

  const page = await browser.newPage();
  const sheets = await getSheets();

  try {
    await login(page);

    for (const league of CONFIG.leagues) {
      const { headers, data } = await scrapeFanDuel(page, league);

      if (!data.length) {
        logWarning(`No data for ${league}`);
        continue;
      }

      await writeToSheet(sheets, league, headers, data);
      await appendHistory(sheets, league, data);
    }

    logSuccess('DONE');
  } catch (err) {
    logError(err.message);
  } finally {
    await browser.close();
  }
})();