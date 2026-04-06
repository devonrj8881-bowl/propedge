/**
 * PropEdge Odds Snapshot — The Odds API Integration
 * ===================================================
 *
 * Pulls game-level spreads + moneylines from The Odds API and stores
 * timestamped snapshots in Google Sheets for sharp money / line movement detection.
 *
 * CREDIT BUDGET:
 *   Each call costs: markets × regions = 2 markets (h2h, spreads) × 1 region (us) = 2 credits
 *   4 sports × 2 credits = 8 credits per run
 *   Run 1x/day → 8 × 31 = ~248 credits/month (safe under 500 free tier)
 *   Run 2x/day → 8 × 2 × 31 = ~496/month (cutting it close — not recommended)
 *
 * Google Sheets tab: Line_History
 *   timestamp | sport | home_team | away_team | commence_time | bookmaker | market | home_price | away_price | home_point | away_point
 *
 * Why game lines (not player props)?
 *   - Game lines cost 2 credits per sport vs 1+ credits per event for props
 *   - Pinnacle + sharp books set game lines first — props follow
 *   - Movement on game spreads is the clearest sharp money signal
 *
 * Usage:
 *   node odds-snapshot.js
 *   node odds-snapshot.js --check-credits   (just show remaining credits, no write)
 *   node odds-snapshot.js --dry-run         (fetch and log, don't write to Sheets)
 *
 * Setup:
 *   1. Add ODDS_API_KEY to your .env file
 *   2. Make sure credentials.json and GOOGLE_SHEET_ID are already configured (same as scraper)
 */

require('dotenv').config();
const https = require('https');
const { google } = require('googleapis');

// ============================================
// CONFIG
// ============================================
const ODDS_API_KEY  = process.env.ODDS_API_KEY;
const SHEET_ID      = process.env.GOOGLE_SHEET_ID;
const HISTORY_TAB   = 'Line_History';
const HISTORY_HOURS = 72; // Keep 3 days of game line history

// The bookmakers to track — Pinnacle is the sharp reference
// DraftKings/FanDuel are the square books — divergence between them = signal
const BOOKMAKERS = [
  'pinnacle',       // Sharp book — the reference line
  'draftkings',
  'fanduel',
  'betmgm',
  'caesars',
].join(',');

// Sports to track and their Odds API sport keys
const SPORTS = [
  { key: 'basketball_nba',  label: 'NBA' },
  { key: 'icehockey_nhl',   label: 'NHL' },
  { key: 'baseball_mlb',    label: 'MLB' },
  { key: 'americanfootball_nfl', label: 'NFL' },
];

// Markets: h2h = moneyline, spreads = point spread
// DO NOT add 'totals' or 'player_props' — it costs more credits
const MARKETS = 'h2h,spreads';
const REGIONS = 'us';

const HISTORY_HEADERS = [
  'timestamp', 'sport', 'home_team', 'away_team', 'commence_time',
  'bookmaker', 'market', 'home_price', 'away_price', 'home_point', 'away_point'
];

const CHECK_CREDITS_ONLY = process.argv.includes('--check-credits');
const DRY_RUN = process.argv.includes('--dry-run');

function log(msg)    { console.log(`[${new Date().toLocaleTimeString()}] ${msg}`); }
function ok(msg)     { console.log(`[${new Date().toLocaleTimeString()}] ✅ ${msg}`); }
function warn(msg)   { console.log(`[${new Date().toLocaleTimeString()}] ⚠️  ${msg}`); }
function error(msg)  { console.log(`[${new Date().toLocaleTimeString()}] ❌ ${msg}`); }

// ============================================
// HTTP HELPER
// ============================================
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      // Capture remaining credits from headers before reading body
      const creditsRemaining = res.headers['x-requests-remaining'];
      const creditsUsed      = res.headers['x-requests-used'];

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: { creditsRemaining, creditsUsed },
            body: JSON.parse(data)
          });
        } catch (e) {
          reject(new Error(`JSON parse error: ${e.message} — body: ${data.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Request timed out')); });
  });
}

// ============================================
// ODDS API
// ============================================
async function checkCredits() {
  // Use a lightweight endpoint to check credit balance without fetching full odds
  const url = `https://api.the-odds-api.com/v4/sports/?apiKey=${ODDS_API_KEY}`;
  const result = await httpsGet(url);

  if (result.status !== 200) {
    error(`Credit check failed: HTTP ${result.status}`);
    return null;
  }

  const remaining = parseInt(result.headers.creditsRemaining) || 0;
  const used      = parseInt(result.headers.creditsUsed)      || 0;
  return { remaining, used };
}

async function fetchOddsForSport(sportKey, sportLabel) {
  const url = [
    `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/`,
    `?apiKey=${ODDS_API_KEY}`,
    `&regions=${REGIONS}`,
    `&markets=${MARKETS}`,
    `&bookmakers=${BOOKMAKERS}`,
    `&oddsFormat=american`
  ].join('');

  log(`Fetching ${sportLabel} odds...`);
  const result = await httpsGet(url);

  if (result.status === 401) throw new Error('Invalid API key — check ODDS_API_KEY in .env');
  if (result.status === 422) throw new Error('Invalid parameters');
  if (result.status === 429) throw new Error('Rate limit hit — too many requests');
  if (result.status !== 200) throw new Error(`HTTP ${result.status}`);

  const remaining = result.headers.creditsRemaining;
  const used      = result.headers.creditsUsed;
  ok(`${sportLabel}: fetched ${result.body.length} games | Credits used: ${used} | Remaining: ${remaining}`);

  // Credit safety check — warn if running low
  if (parseInt(remaining) < 50) {
    warn(`⚠️  Only ${remaining} credits left this month! Consider pausing snapshots.`);
  }

  return result.body;
}

// ============================================
// FLATTEN ODDS INTO ROWS
// ============================================
function flattenOdds(games, sportLabel, timestamp) {
  const rows = [];

  for (const game of games) {
    const homeTeam = game.home_team;
    const awayTeam = game.away_team;
    const commenceTime = game.commence_time;

    for (const bookmaker of (game.bookmakers || [])) {
      for (const market of (bookmaker.markets || [])) {
        const outcomes = market.outcomes || [];

        // Find home and away outcomes
        const homeOutcome = outcomes.find(o => o.name === homeTeam) || outcomes[0];
        const awayOutcome = outcomes.find(o => o.name === awayTeam) || outcomes[1];

        if (!homeOutcome || !awayOutcome) continue;

        rows.push([
          timestamp,
          sportLabel,
          homeTeam,
          awayTeam,
          commenceTime,
          bookmaker.key,
          market.key,                          // 'h2h' or 'spreads'
          homeOutcome.price  ?? '',             // American odds
          awayOutcome.price  ?? '',
          homeOutcome.point  ?? '',             // Spread point (null for moneyline)
          awayOutcome.point  ?? '',
        ]);
      }
    }
  }

  return rows;
}

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

async function ensureHistoryTabExists(sheets) {
  try {
    const check = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${HISTORY_TAB}!A1:K1`
    });
    if (!(check.data.values?.[0]?.length > 0)) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${HISTORY_TAB}!A1`,
        valueInputOption: 'RAW',
        resource: { values: [HISTORY_HEADERS] }
      });
      log(`Wrote headers to ${HISTORY_TAB}`);
    }
  } catch (e) {
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SHEET_ID,
        resource: { requests: [{ addSheet: { properties: { title: HISTORY_TAB } } }] }
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${HISTORY_TAB}!A1`,
        valueInputOption: 'RAW',
        resource: { values: [HISTORY_HEADERS] }
      });
      ok(`Created ${HISTORY_TAB} tab`);
    } catch (createErr) {
      warn(`Could not create ${HISTORY_TAB}: ${createErr.message}`);
    }
  }
}

async function appendRows(sheets, rows) {
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${HISTORY_TAB}!A:K`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    resource: { values: rows }
  });
}

async function pruneHistory(sheets) {
  log(`Pruning ${HISTORY_TAB} (keeping last ${HISTORY_HOURS}h)...`);

  try {
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${HISTORY_TAB}!A:K`
    });

    const rows = result.data.values || [];
    if (rows.length < 2) { log('Nothing to prune'); return; }

    const headers  = rows[0];
    const dataRows = rows.slice(1);
    const cutoff   = new Date(Date.now() - HISTORY_HOURS * 60 * 60 * 1000);
    const kept     = dataRows.filter(r => { try { return new Date(r[0]) >= cutoff; } catch { return true; } });
    const pruned   = dataRows.length - kept.length;

    if (pruned === 0) { log(`Nothing to prune (${dataRows.length} rows within ${HISTORY_HOURS}h)`); return; }

    await sheets.spreadsheets.values.clear({ spreadsheetId: SHEET_ID, range: `${HISTORY_TAB}!A:K` });
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${HISTORY_TAB}!A1`,
      valueInputOption: 'RAW',
      resource: { values: [headers, ...kept] }
    });

    ok(`Pruned ${pruned} rows. ${kept.length} rows remaining.`);
  } catch (e) {
    warn(`Prune failed: ${e.message}`);
  }
}

// ============================================
// MAIN
// ============================================
async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log(' PropEdge Odds Snapshot');
  console.log(' ' + new Date().toLocaleString());
  console.log('═'.repeat(60) + '\n');

  if (!ODDS_API_KEY) {
    error('ODDS_API_KEY not set in .env — add it and retry');
    process.exit(1);
  }

  if (!SHEET_ID) {
    error('GOOGLE_SHEET_ID not set in .env');
    process.exit(1);
  }

  // --check-credits: just show balance and exit
  if (CHECK_CREDITS_ONLY) {
    log('Checking credit balance...');
    const credits = await checkCredits();
    if (credits) {
      console.log(`\n  Credits used this month : ${credits.used}`);
      console.log(`  Credits remaining       : ${credits.remaining}`);
      console.log(`  Estimated runs left     : ${Math.floor(credits.remaining / 8)} (at 8 credits/run)\n`);
    }
    return;
  }

  if (DRY_RUN) log('DRY RUN — fetching odds but not writing to Sheets');

  const timestamp = new Date().toISOString();
  const allRows   = [];

  // Fetch odds for each sport, 2-second gap between calls
  for (let i = 0; i < SPORTS.length; i++) {
    const sport = SPORTS[i];
    try {
      const games = await fetchOddsForSport(sport.key, sport.label);
      const rows  = flattenOdds(games, sport.label, timestamp);
      allRows.push(...rows);
      log(`  → ${rows.length} rows from ${games.length} ${sport.label} games`);
    } catch (e) {
      error(`${sport.label} failed: ${e.message}`);
    }

    // Small delay between requests — not required by the API but polite
    if (i < SPORTS.length - 1) await new Promise(r => setTimeout(r, 2000));
  }

  log(`\nTotal rows to store: ${allRows.length}`);

  if (DRY_RUN) {
    log('DRY RUN complete — sample rows:');
    allRows.slice(0, 5).forEach(r => console.log(' ', r.join(' | ')));
    return;
  }

  if (allRows.length === 0) {
    warn('No data fetched — nothing written to Sheets');
    return;
  }

  // Write to Google Sheets
  log('Connecting to Google Sheets...');
  const sheets = await getGoogleSheetsClient();
  ok('Connected');

  await ensureHistoryTabExists(sheets);
  await pruneHistory(sheets);
  await appendRows(sheets, allRows);

  ok(`Done — ${allRows.length} rows written to ${HISTORY_TAB}`);
  console.log('\n' + '═'.repeat(60) + '\n');
}

main().catch(e => { error(e.message); process.exit(1); });
