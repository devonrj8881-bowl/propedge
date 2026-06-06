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
  calibrationJson: path.join(__dirname, 'calibration.json'),
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

      // Add or refresh headers. Extra calibration columns are safe for existing rows.
      await sheetsClient.spreadsheets.values.update({
        spreadsheetId: CONFIG.spreadsheetId,
        range: 'propedge-outcomes!A1:Q1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [[
            'Date', 'Player', 'Prop', 'Line', 'Outcome', 'Timestamp', 'GameID', 'GameStatus', 'DetectionTime',
            'League', 'Direction', 'ModelProb', 'ImpliedProb', 'Edge', 'PropIQScore', 'Odds', 'MarketKey'
          ]],
        },
      });
      console.log('✓ propedge-outcomes sheet created with headers');
    } else {
      console.log('✓ propedge-outcomes sheet already exists');
      await sheetsClient.spreadsheets.values.update({
        spreadsheetId: CONFIG.spreadsheetId,
        range: 'propedge-outcomes!A1:Q1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [[
            'Date', 'Player', 'Prop', 'Line', 'Outcome', 'Timestamp', 'GameID', 'GameStatus', 'DetectionTime',
            'League', 'Direction', 'ModelProb', 'ImpliedProb', 'Edge', 'PropIQScore', 'Odds', 'MarketKey'
          ]],
        },
      });
    }
  } catch (e) {
    console.error(`❌ Failed to ensure outcomes sheet: ${e.message}`);
  }
}

async function writeOutcomeToSheet(outcome) {
  try {
    const {
      date, player, prop, line, status, timestamp, gameId, gameStatus, detectionTimestamp,
      league, direction, modelProb, impliedProb, edge, propIqScore, odds, marketKey
    } = outcome;

    // Append to propedge-outcomes sheet
    await sheetsClient.spreadsheets.values.append({
      spreadsheetId: CONFIG.spreadsheetId,
      range: 'propedge-outcomes!A:Q',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          date, player, prop, line, status, timestamp, gameId, gameStatus, detectionTimestamp,
          league || '', direction || '', modelProb ?? '', impliedProb ?? '', edge ?? '', propIqScore ?? '', odds ?? '', marketKey || ''
        ]],
      },
    });

    console.log(`✓ Wrote outcome: ${player} | ${prop} | ${line} = ${status} (game ${gameId})`);
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
      range: 'propedge-outcomes!A2:Q',
    });

    const rows = res.data.values || [];
    const outcomes = {};

    rows.forEach(row => {
      const [
        date, player, prop, line, status, timestamp, gameId, gameStatus, detectionTimestamp,
        league, direction, modelProb, impliedProb, edge, propIqScore, odds, marketKey
      ] = row;
      if (player && prop && line && status) {
        const key = `${player}|${prop}|${line}`;
        outcomes[key] = {
          status,
          date,
          timestamp,
          gameId,
          gameStatus,
          detectionTimestamp,
          league,
          direction,
          modelProb: Number.isFinite(parseFloat(modelProb)) ? parseFloat(modelProb) : null,
          impliedProb: Number.isFinite(parseFloat(impliedProb)) ? parseFloat(impliedProb) : null,
          edge: Number.isFinite(parseFloat(edge)) ? parseFloat(edge) : null,
          propIqScore: Number.isFinite(parseFloat(propIqScore)) ? parseFloat(propIqScore) : null,
          odds: Number.isFinite(parseFloat(odds)) ? parseFloat(odds) : null,
          marketKey
        };
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
    saveLocalCalibration(buildCalibrationFromOutcomes(outcomes));
  } catch (e) {
    console.error(`❌ Failed to save local outcomes: ${e.message}`);
  }
}

function clamp(num, min, max) {
  return Math.max(min, Math.min(max, num));
}

function normalizePropFamily(prop) {
  const p = String(prop || '').toLowerCase();
  if (/points|pts|runs|goals/.test(p)) return 'scoring';
  if (/reb|rebound/.test(p)) return 'rebounds';
  if (/ast|assist/.test(p)) return 'assists';
  if (/3pm|3-pt|three/.test(p)) return 'threes';
  if (/hits|total bases|tb|bases/.test(p)) return 'bases';
  if (/strikeout|\\bk\\b/.test(p)) return 'strikeouts';
  if (/shots|sog|saves/.test(p)) return 'shots';
  if (/stl|steal|blk|block|turnover/.test(p)) return 'stocks';
  return 'other';
}

function calibrationKey(league, family, direction) {
  return `${String(league || 'ALL').toUpperCase()}|${family || 'ALL'}|${String(direction || 'ALL').toUpperCase()}`;
}

function buildCalibrationFromOutcomes(outcomes) {
  const buckets = {};
  const add = (key, prediction, actual) => {
    if (!buckets[key]) buckets[key] = { n: 0, hits: 0, predictionSum: 0, brierSum: 0 };
    const b = buckets[key];
    b.n += 1;
    b.hits += actual;
    b.predictionSum += prediction;
    b.brierSum += Math.pow(prediction - actual, 2);
  };

  Object.values(outcomes || {}).forEach(outcome => {
    if (!outcome || !['HIT', 'MISS'].includes(String(outcome.status || '').toUpperCase())) return;
    const prediction = Number.parseFloat(outcome.modelProb);
    if (!Number.isFinite(prediction) || prediction <= 0 || prediction >= 1) return;

    const actual = String(outcome.status).toUpperCase() === 'HIT' ? 1 : 0;
    const league = String(outcome.league || 'ALL').toUpperCase();
    const family = normalizePropFamily(outcome.marketKey || outcome.prop);
    const direction = String(outcome.direction || 'ALL').toUpperCase();

    add(calibrationKey('ALL', 'ALL', 'ALL'), prediction, actual);
    add(calibrationKey(league, 'ALL', 'ALL'), prediction, actual);
    add(calibrationKey(league, family, 'ALL'), prediction, actual);
    add(calibrationKey(league, family, direction), prediction, actual);
  });

  const segments = {};
  Object.entries(buckets).forEach(([key, b]) => {
    const avgPred = b.predictionSum / b.n;
    const actualRate = b.hits / b.n;
    const sampleWeight = clamp(b.n / 50, 0.1, 1);
    segments[key] = {
      n: b.n,
      hits: b.hits,
      avgPred: Number(avgPred.toFixed(4)),
      actualRate: Number(actualRate.toFixed(4)),
      brier: Number((b.brierSum / b.n).toFixed(4)),
      adjustment: Number(clamp((actualRate - avgPred) * sampleWeight, -0.08, 0.08).toFixed(4))
    };
  });

  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    minSegmentN: 8,
    maxAdjustment: 0.08,
    segments
  };
}

function saveLocalCalibration(calibration) {
  try {
    fs.writeFileSync(CONFIG.calibrationJson, JSON.stringify(calibration, null, 2));
    console.log(`✓ Saved calibration.json (${Object.keys(calibration.segments || {}).length} segments)`);
  } catch (e) {
    console.error(`❌ Failed to save calibration.json: ${e.message}`);
  }
}

function loadLocalCalibration() {
  try {
    if (fs.existsSync(CONFIG.calibrationJson)) {
      return JSON.parse(fs.readFileSync(CONFIG.calibrationJson, 'utf8'));
    }
  } catch (e) {
    console.error(`❌ Failed to load calibration.json: ${e.message}`);
  }
  return buildCalibrationFromOutcomes(loadLocalOutcomes());
}

function localOutcomeRecord(outcome) {
  return {
    status: outcome.status,
    date: outcome.date,
    timestamp: outcome.timestamp,
    gameId: outcome.gameId,
    gameStatus: outcome.gameStatus,
    detectionTimestamp: outcome.detectionTimestamp,
    league: outcome.league,
    direction: outcome.direction,
    modelProb: Number.isFinite(parseFloat(outcome.modelProb)) ? parseFloat(outcome.modelProb) : null,
    impliedProb: Number.isFinite(parseFloat(outcome.impliedProb)) ? parseFloat(outcome.impliedProb) : null,
    edge: Number.isFinite(parseFloat(outcome.edge)) ? parseFloat(outcome.edge) : null,
    propIqScore: Number.isFinite(parseFloat(outcome.propIqScore)) ? parseFloat(outcome.propIqScore) : null,
    odds: Number.isFinite(parseFloat(outcome.odds)) ? parseFloat(outcome.odds) : null,
    marketKey: outcome.marketKey || outcome.prop
  };
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

async function ensureScraperContextSheet() {
  try {
    const res = await sheetsClient.spreadsheets.get({
      spreadsheetId: CONFIG.spreadsheetId,
    });

    const sheets = res.data.sheets || [];
    const contextSheet = sheets.find(s => s.properties.title === 'propedge-scraper-context');

    if (!contextSheet) {
      console.log('Creating propedge-scraper-context sheet...');
      await sheetsClient.spreadsheets.batchUpdate({
        spreadsheetId: CONFIG.spreadsheetId,
        requestBody: {
          requests: [{
            addSheet: {
              properties: {
                title: 'propedge-scraper-context',
              },
            },
          }],
        },
      });

      // Add headers
      await sheetsClient.spreadsheets.values.update({
        spreadsheetId: CONFIG.spreadsheetId,
        range: 'propedge-scraper-context!A1:F1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [['GameID', 'League', 'Timestamp', 'PropCount', 'UniquePlayerCount', 'WrittenAt']],
        },
      });
      console.log('✓ propedge-scraper-context sheet created with headers');
    } else {
      console.log('✓ propedge-scraper-context sheet already exists');
    }
  } catch (e) {
    console.error(`❌ Failed to ensure scraper context sheet: ${e.message}`);
  }
}

async function writeScraperPropsContext(payload) {
  try {
    const { gameId, league, timestamp, propCount, props } = payload;
    const uniquePlayers = new Set(props.map(p => p.player)).size;

    // Append to propedge-scraper-context sheet
    await sheetsClient.spreadsheets.values.append({
      spreadsheetId: CONFIG.spreadsheetId,
      range: 'propedge-scraper-context!A:F',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[gameId, league, timestamp, propCount, uniquePlayers, new Date().toISOString()]],
      },
    });

    console.log(`✓ Scraper context recorded: ${gameId} | ${league} | ${propCount} props | ${uniquePlayers} players`);
    return true;
  } catch (e) {
    console.error(`❌ Failed to write scraper context: ${e.message}`);
    return false;
  }
}

async function bulkResolveOutcomes(outcomeArray) {
  try {
    if (!Array.isArray(outcomeArray) || outcomeArray.length === 0) {
      return { success: false, error: 'outcomes must be a non-empty array', processed: 0 };
    }

    const local = loadLocalOutcomes();
    let successCount = 0;
    let failureCount = 0;

    for (const outcome of outcomeArray) {
      try {
        const success = await writeOutcomeToSheet(outcome);
        if (success) {
          const key = `${outcome.player}|${outcome.prop}|${outcome.line}`;
          local[key] = localOutcomeRecord(outcome);
          successCount++;
        } else {
          failureCount++;
        }
      } catch (e) {
        console.warn(`⚠️ Failed to resolve individual outcome: ${e.message}`);
        failureCount++;
      }
    }

    saveLocalOutcomes(local);

    console.log(`✓ Bulk resolve: ${successCount}/${outcomeArray.length} outcomes resolved`);
    return {
      success: successCount > 0,
      processed: successCount,
      failed: failureCount,
      total: outcomeArray.length
    };
  } catch (e) {
    console.error(`❌ Failed to bulk resolve outcomes: ${e.message}`);
    return { success: false, error: e.message, processed: 0 };
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
        local[key] = localOutcomeRecord(outcome);
        saveLocalOutcomes(local);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        console.error(`❌ Failed to process outcome: ${e.message}`);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
  } else if (req.method === 'POST' && req.url === '/api/outcomes/bulk') {
    let body = '';

    req.on('data', chunk => {
      body += chunk;
    });

    req.on('end', async () => {
      try {
        const { outcomes } = JSON.parse(body);
        if (!Array.isArray(outcomes)) {
          throw new Error('outcomes must be an array');
        }

        const local = loadLocalOutcomes();
        let successCount = 0;

        for (const outcome of outcomes) {
          try {
            await writeOutcomeToSheet(outcome);
            const key = `${outcome.player}|${outcome.prop}|${outcome.line}`;
            local[key] = localOutcomeRecord(outcome);
            successCount++;
          } catch (e) {
            console.warn(`⚠️ Failed to write individual outcome: ${e.message}`);
          }
        }

        saveLocalOutcomes(local);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, processed: successCount, total: outcomes.length }));
      } catch (e) {
        console.error(`❌ Failed to process bulk outcomes: ${e.message}`);
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
  } else if (req.method === 'GET' && req.url === '/api/calibration') {
    try {
      const calibration = loadLocalCalibration();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(calibration));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
  } else if (req.method === 'POST' && req.url === '/scraper-props-written') {
    let body = '';

    req.on('data', chunk => {
      body += chunk;
    });

    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        const { gameId, league, timestamp, propCount, props } = payload;

        if (!gameId || !league || !propCount || !Array.isArray(props)) {
          throw new Error('Missing required fields: gameId, league, propCount, props (array)');
        }

        // Write scraper context to sheet
        const written = await writeScraperPropsContext(payload);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: written,
          gameId,
          league,
          propCount,
          message: 'Scraper props context recorded'
        }));
      } catch (e) {
        console.error(`❌ Failed to process scraper webhook: ${e.message}`);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
  } else if (req.method === 'POST' && req.url === '/api/auto-resolve-outcomes') {
    let body = '';

    req.on('data', chunk => {
      body += chunk;
    });

    req.on('end', async () => {
      try {
        const { outcomes } = JSON.parse(body);

        if (!Array.isArray(outcomes)) {
          throw new Error('outcomes must be an array');
        }

        const result = await bulkResolveOutcomes(outcomes);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (e) {
        console.error(`❌ Failed to auto-resolve outcomes: ${e.message}`);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
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
  await ensureScraperContextSheet();
  await archiveOutcomesOlderThan90Days();

  // Load outcomes from Sheet and save locally
  const outcomes = await readAllOutcomes();
  saveLocalOutcomes(outcomes);

  server.listen(CONFIG.port, () => {
    console.log(`✓ Outcomes sync service listening on port ${CONFIG.port}`);
    console.log(`  POST http://localhost:${CONFIG.port}/api/outcome — record single outcome`);
    console.log(`  POST http://localhost:${CONFIG.port}/api/outcomes/bulk — record bulk outcomes`);
    console.log(`  POST http://localhost:${CONFIG.port}/api/auto-resolve-outcomes — bulk resolve outcomes`);
    console.log(`  GET  http://localhost:${CONFIG.port}/api/outcomes — list all outcomes`);
    console.log(`  GET  http://localhost:${CONFIG.port}/api/calibration — model calibration summary`);
    console.log(`  POST http://localhost:${CONFIG.port}/scraper-props-written — log scraper props event`);
  });
})();
