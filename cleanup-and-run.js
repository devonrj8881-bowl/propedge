#!/usr/bin/env node
/**
 * Clear MLB tab from main Google Sheet, then run scraper
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { google } = require('googleapis');
const path = require('path');
const { execSync } = require('child_process');

const CONFIG = {
  spreadsheetId: process.env.GOOGLE_SHEET_ID
};

async function clearMLBTab() {
  console.log('[Cleanup] Clearing MLB tab from main Google Sheet...');

  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: path.join(__dirname, 'credentials.json'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });

    // Clear MLB tab (all columns)
    await sheets.spreadsheets.values.clear({
      spreadsheetId: CONFIG.spreadsheetId,
      range: 'MLB!A:Z'
    });

    console.log('✅ MLB tab cleared successfully\n');
    return true;
  } catch (e) {
    if (e.message.includes('Unable to parse range')) {
      console.log('ℹ️  MLB tab doesn\'t exist yet (new sheet) — skipping clear\n');
      return true;
    }
    console.error('❌ Error clearing MLB tab:', e.message);
    return false;
  }
}

async function runScraper() {
  console.log('[Cleanup] Running scraper...\n');
  try {
    execSync('/opt/homebrew/bin/node scraper-v15-integrated.js', {
      cwd: __dirname,
      stdio: 'inherit'
    });
  } catch (e) {
    console.error('Error running scraper:', e.message);
    process.exit(1);
  }
}

(async () => {
  const cleared = await clearMLBTab();
  if (cleared) {
    await runScraper();
  }
})();
