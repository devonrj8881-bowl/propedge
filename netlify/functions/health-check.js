/**
 * PropEdge Health Check Endpoint
 *
 * Returns system health metrics: polling state, sheet sync status,
 * last outcome resolution, cache stats
 *
 * Usage: GET /.netlify/functions/health-check
 */

const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

let sheetsClient = null;
let sheetsAuth = null;

async function initGoogleSheets() {
  if (sheetsClient) return true;
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: path.join(__dirname, '..', '..', 'credentials.json'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    sheetsAuth = await auth.getClient();
    sheetsClient = google.sheets({ version: 'v4', auth: sheetsAuth });
    return true;
  } catch (e) {
    console.error(`❌ Google Sheets auth failed: ${e.message}`);
    return false;
  }
}

async function getSheetStats() {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) return null;

    const outcomes = await sheetsClient.spreadsheets.values.get({
      spreadsheetId,
      range: 'propedge-outcomes!A2:I',
    });

    const outcomeRows = outcomes.data.values || [];
    const lastRow = outcomeRows.length > 0 ? outcomeRows[outcomeRows.length - 1] : null;
    const lastOutcomeTime = lastRow ? lastRow[5] || null : null; // Timestamp column

    return {
      outcomeCount: outcomeRows.length,
      lastOutcomeTime,
      lastUpdated: new Date().toISOString()
    };
  } catch (e) {
    console.error(`Sheet stats error: ${e.message}`);
    return null;
  }
}

exports.handler = async (event) => {
  try {
    const authOk = await initGoogleSheets();

    // Gather metrics
    const sheetStats = authOk ? await getSheetStats() : null;

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        sheets: authOk ? 'connected' : 'disconnected',
        polling: 'active', // Always active in browser
        outcomes: sheetStats ? 'syncing' : 'pending'
      },
      metrics: {
        outcomeCount: sheetStats?.outcomeCount || 0,
        lastOutcomeTime: sheetStats?.lastOutcomeTime || 'none',
        pollingInterval: '4s (live) / 30s (final)',
        newsPolling: '30s',
        feedCacheTTL: '60s'
      },
      endpoints: {
        outcomes: {
          path: '/api/outcome',
          method: 'POST',
          description: 'Record single outcome'
        },
        bulkOutcomes: {
          path: '/api/outcomes/bulk',
          method: 'POST',
          description: 'Record bulk outcomes'
        },
        scraperWebhook: {
          path: '/scraper-props-written',
          method: 'POST',
          description: 'Scraper props context logging'
        },
        autoResolve: {
          path: '/api/auto-resolve-outcomes',
          method: 'POST',
          description: 'Bulk outcome auto-resolution'
        }
      },
      debugPanel: {
        enabled: 'via ?debug=true URL param',
        shows: ['polling intervals', 'ESPN latency', 'cache hit rate', 'event counts']
      }
    };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(health, null, 2)
    };
  } catch (e) {
    console.error('Health check error:', e);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e.message })
    };
  }
};
