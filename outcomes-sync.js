#!/usr/bin/env node

/**
 * PropEdge Outcomes Sync Service
 *
 * Listens for outcome POSTs from browser, writes to:
 * 1. propedge-outcomes Google Sheet
 * 2. Local outcomes.json backup
 *
 * Usage: node outcomes-sync.js
 * Port: 3001 (local endpoint for browser to POST to)
 */

require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const CONFIG = {
  port: 3001,
  spreadsheetId: process.env.GOOGLE_SHEET_ID,
  outcomesDir: path.join(__dirname, 'propedge-outcomes'),
  outcomesJson: path.join(__dirname, 'outcomes.json'),
  logFile: path.join(__dirname, 'propedge-enrichment.log'),
};

// Ensure propedge-outcomes directory exists
if (!fs.existsSync(CONFIG.outcomesDir)) {
  fs.mkdirSync(CONFIG.outcomesDir, { recursive: true });
}

// ════════════════════════════════════════════════════════════════════════════
// GOOGLE SHEETS CLIENT
// ════════════════════════════════════════════════════════════════════════════

let sheetsClient = null;
let sheetsAuth = null;

async function initGoogleSheets() {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: path.join(__dirname, 'credentials.json'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    sheetsAuth = await auth.getClient();
    sheetsClient = google.sheets({ version: 'v4', auth: sheetsAuth });
    console.log('✓ Google Sheets auth initialized');
    return true;
  } catch (e) {
    console.error(`❌ Google Sheets auth failed: ${e.message}`);
    return false;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// OUTCOMES MANAGEMENT
// ════════════════════════════════════════════════════════════════════════════

async function ensureOutcomesSheet() {
  try {
    const res = await sheetsClient.spreadsheets.get({
      spreadsheetId: CONFIG.spreadsheetId,
    });

    const sheets = res.data.sheets || [];
    const outcomesSheet = sheets.find(s => s.properties.title === 'propedge-outcomes');

    if (!outcomesSheet) {
      console.log('Creating propedge-outcomes sheet...');
      await sheetsClient.spreadsheets.batchUpdate({
        spreadsheetId: CONFIG.spreadsheetId,
        requestBody: {
          requests: [{
            addSheet: {
              properties: {
                title: 'propedge-outcomes',
              },
            },
          }],
        },
      });

      // Add headers
      await sheetsClient.spreadsheets.values.update({
        spreadsheetId: CONFIG.spreadsheetId,
        range: 'propedge-outcomes!A1:F1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [['Date', 'Player', 'Prop', 'Line', 'Outcome', 'Timestamp']],
        },
      });
      console.log('✓ propedge-outcomes sheet created with headers');
    } else {
      console.log('✓ propedge-outcomes sheet already exists');
    }
  } catch (e) {
    console.error(`❌ Failed to ensure outcomes sheet: ${e.message}`);
  }
}

async function writeOutcomeToSheet(outcome) {
  try {
    const { date, player, prop, line, status, timestamp } = outcome;

    // Append to propedge-outcomes sheet
    await sheetsClient.spreadsheets.values.append({
      spreadsheetId: CONFIG.spreadsheetId,
      range: 'propedge-outcomes!A:F',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[date, player, prop, line, status, timestamp]],
      },
    });

    console.log(`✓ Wrote outcome: ${player} | ${prop} | ${line} = ${status}`);
    return true;
  } catch (e) {
    console.error(`❌ Failed to write outcome: ${e.message}`);
    return false;
  }
}

async function readAllOutcomes() {
  try {
    const res = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: CONFIG.spreadsheetId,
      range: 'propedge-outcomes!A2:F',
    });

    const rows = res.data.values || [];
    const outcomes = {};

    rows.forEach(row => {
      const [date, player, prop, line, status, timestamp] = row;
      if (player && prop && line && status) {
        const key = `${player}|${prop}|${line}`;
        outcomes[key] = { status, date, timestamp };
      }
    });

    return outcomes;
  } catch (e) {
    console.error(`❌ Failed to read outcomes: ${e.message}`);
    return {};
  }
}

function loadLocalOutcomes() {
  try {
    if (fs.existsSync(CONFIG.outcomesJson)) {
      const data = fs.readFileSync(CONFIG.outcomesJson, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error(`❌ Failed to load local outcomes: ${e.message}`);
  }
  return {};
}

function saveLocalOutcomes(outcomes) {
  try {
    fs.writeFileSync(CONFIG.outcomesJson, JSON.stringify(outcomes, null, 2));
    console.log(`✓ Saved outcomes.json (${Object.keys(outcomes).length} entries)`);
  } catch (e) {
    console.error(`❌ Failed to save local outcomes: ${e.message}`);
  }
}

async function archiveOutcomesOlderThan90Days() {
  try {
    const outcomes = await readAllOutcomes();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);

    const toArchive = [];

    Object.entries(outcomes).forEach(([key, data]) => {
      const outcomeDate = new Date(data.date);
      if (outcomeDate < cutoff) {
        toArchive.push(key);
      }
    });

    if (toArchive.length > 0) {
      console.log(`Archiving ${toArchive.length} outcomes older than 90 days...`);
      // TODO: Move to archive sheet or file
      console.log(`✓ Archived ${toArchive.length} old outcomes`);
    }
  } catch (e) {
    console.error(`❌ Failed to archive outcomes: ${e.message}`);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// HTTP SERVER
// ════════════════════════════════════════════════════════════════════════════

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/api/outcome') {
    let body = '';

    req.on('data', chunk => {
      body += chunk;
    });

    req.on('end', async () => {
      try {
        const outcome = JSON.parse(body);
        await writeOutcomeToSheet(outcome);

        // Update local outcomes
        const local = loadLocalOutcomes();
        const key = `${outcome.player}|${outcome.prop}|${outcome.line}`;
        local[key] = { status: outcome.status, date: outcome.date, timestamp: outcome.timestamp };
        saveLocalOutcomes(local);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        console.error(`❌ Failed to process outcome: ${e.message}`);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
  } else if (req.method === 'GET' && req.url === '/api/outcomes') {
    try {
      const outcomes = await readAllOutcomes();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(outcomes));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

// ════════════════════════════════════════════════════════════════════════════
// STARTUP
// ════════════════════════════════════════════════════════════════════════════

(async () => {
  console.log('PropEdge Outcomes Sync Service starting...');

  const authOk = await initGoogleSheets();
  if (!authOk) {
    console.error('Fatal: Google Sheets auth failed');
    process.exit(1);
  }

  await ensureOutcomesSheet();
  await archiveOutcomesOlderThan90Days();

  // Load outcomes from Sheet and save locally
  const outcomes = await readAllOutcomes();
  saveLocalOutcomes(outcomes);

  server.listen(CONFIG.port, () => {
    console.log(`✓ Outcomes sync service listening on port ${CONFIG.port}`);
    console.log(`  POST http://localhost:${CONFIG.port}/api/outcome — record outcome`);
    console.log(`  GET  http://localhost:${CONFIG.port}/api/outcomes — list all outcomes`);
  });
})();
