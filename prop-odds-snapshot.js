#!/usr/bin/env node
/**
 * PropEdge — player prop line snapshots (multi-book + Pinnacle when available).
 * Writes Google Sheet tab: Prop_Line_History
 *
 * CREDIT WARNING: player props cost per-event API calls. Default MAX_EVENTS=2/sport.
 *
 * Usage:
 *   node prop-odds-snapshot.js
 *   node prop-odds-snapshot.js --check-credits
 *   node prop-odds-snapshot.js --dry-run
 */
require('dotenv').config();
const https = require('https');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const ODDS_API_KEY = process.env.ODDS_API_KEY || process.env.THE_ODDS_API_KEY;
const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const HISTORY_TAB = 'Prop_Line_History';
const MAX_EVENTS_PER_SPORT = parseInt(process.env.PROP_ODDS_MAX_EVENTS || '2', 10);
const HISTORY_HOURS = 48;

const SPORTS = [
  { key: 'basketball_nba', label: 'NBA' },
  { key: 'icehockey_nhl', label: 'NHL' },
  { key: 'baseball_mlb', label: 'MLB' }
];

const PROP_MARKETS = {
  basketball_nba: 'player_points,player_rebounds,player_assists',
  icehockey_nhl: 'player_shots_on_goal,player_goals,player_points',
  baseball_mlb: 'pitcher_strikeouts,batter_hits,batter_total_bases'
};

const BOOKMAKERS = 'pinnacle,fanduel,draftkings,betmgm,caesars';
const REGIONS = 'us,eu';

const HEADERS = [
  'timestamp', 'sport', 'player', 'market', 'side', 'bookmaker',
  'line', 'odds', 'open_line', 'current_line', 'event_id'
];

const CHECK_CREDITS_ONLY = process.argv.includes('--check-credits');
const DRY_RUN = process.argv.includes('--dry-run');

function log(msg) { console.log(`[prop-odds] ${msg}`); }

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: {
              creditsRemaining: res.headers['x-requests-remaining'],
              creditsUsed: res.headers['x-requests-used']
            },
            body: JSON.parse(data)
          });
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function checkCredits() {
  const url = `https://api.the-odds-api.com/v4/sports/?apiKey=${ODDS_API_KEY}`;
  const r = await httpsGet(url);
  return {
    remaining: parseInt(r.headers.creditsRemaining, 10) || 0,
    used: parseInt(r.headers.creditsUsed, 10) || 0
  };
}

async function fetchEvents(sportKey) {
  const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/events?apiKey=${encodeURIComponent(ODDS_API_KEY)}`;
  const r = await httpsGet(url);
  if (r.status !== 200) throw new Error(`events HTTP ${r.status}`);
  return Array.isArray(r.body) ? r.body.slice(0, MAX_EVENTS_PER_SPORT) : [];
}

async function fetchEventProps(sportKey, eventId, markets) {
  const url = [
    `https://api.the-odds-api.com/v4/sports/${sportKey}/events/${encodeURIComponent(eventId)}/odds`,
    `?apiKey=${encodeURIComponent(ODDS_API_KEY)}`,
    `&regions=${REGIONS}`,
    `&markets=${encodeURIComponent(markets)}`,
    `&bookmakers=${BOOKMAKERS}`,
    `&oddsFormat=american`
  ].join('');
  const r = await httpsGet(url);
  if (r.status !== 200) throw new Error(`odds HTTP ${r.status}`);
  return r.body;
}

function flattenPropRows(sportLabel, event, timestamp) {
  const rows = [];
  for (const book of event.bookmakers || []) {
    for (const market of book.markets || []) {
      for (const outcome of market.outcomes || []) {
        const player = (outcome.description || '').trim();
        const side = /^under$/i.test(outcome.name) ? 'UNDER' : 'OVER';
        const line = outcome.point;
        const odds = outcome.price;
        if (!player || !Number.isFinite(line) || !Number.isFinite(odds)) continue;
        const marketName = (market.key || '').replace(/^player_|^batter_|^pitcher_/, '').replace(/_/g, ' ');
        rows.push([
          timestamp,
          sportLabel,
          player,
          marketName,
          side,
          book.key,
          line,
          odds,
          line,
          line,
          event.id || ''
        ]);
      }
    }
  }
  return rows;
}

async function getSheets() {
  const auth = new google.auth.GoogleAuth({
    keyFile: './credentials.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  return google.sheets({ version: 'v4', auth: await auth.getClient() });
}

async function ensureTab(sheets) {
  try {
    await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${HISTORY_TAB}!A1` });
  } catch (_) {
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SHEET_ID,
        resource: { requests: [{ addSheet: { properties: { title: HISTORY_TAB } } }] }
      });
    } catch (e) {
      log(`Tab create skipped: ${e.message}`);
    }
  }
  const check = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${HISTORY_TAB}!A1:L1`
  });
  if (!(check.data.values?.[0]?.length)) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${HISTORY_TAB}!A1`,
      valueInputOption: 'RAW',
      resource: { values: [HEADERS] }
    });
  }
}

async function appendRows(sheets, rows) {
  if (!rows.length) return;
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${HISTORY_TAB}!A:L`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    resource: { values: rows }
  });
}

async function main() {
  if (!ODDS_API_KEY) {
    console.error('ODDS_API_KEY required');
    process.exit(1);
  }

  if (CHECK_CREDITS_ONLY) {
    const c = await checkCredits();
    console.log(`Credits used: ${c.used}, remaining: ${c.remaining}`);
    return;
  }

  const timestamp = new Date().toISOString();
  const allRows = [];

  for (const sport of SPORTS) {
    const markets = PROP_MARKETS[sport.key];
    if (!markets) continue;
    try {
      const events = await fetchEvents(sport.key);
      log(`${sport.label}: ${events.length} events (cap ${MAX_EVENTS_PER_SPORT})`);
      for (const ev of events) {
        const odds = await fetchEventProps(sport.key, ev.id, markets);
        const rows = flattenPropRows(sport.label, odds, timestamp);
        allRows.push(...rows);
        await new Promise((r) => setTimeout(r, 1500));
      }
    } catch (e) {
      log(`${sport.label} failed: ${e.message}`);
    }
  }

  log(`Total rows: ${allRows.length}`);

  if (DRY_RUN) {
    allRows.slice(0, 5).forEach((r) => console.log(r.join(' | ')));
    return;
  }

  if (!allRows.length) {
    log('No rows — check API key / credits / slate');
    return;
  }

  if (!SHEET_ID || !fs.existsSync('./credentials.json')) {
    const fallback = path.join(__dirname, 'propedge-deploy/data/prop-line-history-sample.json');
    fs.mkdirSync(path.dirname(fallback), { recursive: true });
    fs.writeFileSync(fallback, JSON.stringify({ rows: allRows.slice(0, 500) }, null, 2));
    log(`No Sheets creds — wrote sample ${fallback}`);
    return;
  }

  const sheets = await getSheets();
  await ensureTab(sheets);
  await appendRows(sheets, allRows);
  log(`Appended ${allRows.length} rows to ${HISTORY_TAB}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
