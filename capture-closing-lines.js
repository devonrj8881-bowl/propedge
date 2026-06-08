#!/usr/bin/env node

/**
 * PropEdge - Closing Line Value (CLV) Snapshot Tool
 * Run this at 7:00 PM ET (or before tip-offs) to capture the final odds.
 * It reads the current lines from Google Sheets and saves them locally, 
 * so outcomes-sync.js can compare opening odds vs closing odds to calculate CLV.
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  spreadsheetId: process.env.GOOGLE_SHEET_ID,
  snapshotFile: path.join(__dirname, 'closing-lines-snapshot.json')
};

async function captureClosingLines() {
  console.log('📸 Capturing closing lines for CLV tracking...');
  
  if (!CONFIG.spreadsheetId) {
      console.error('❌ Missing GOOGLE_SHEET_ID in .env');
      return;
  }

  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: path.join(__dirname, 'credentials.json'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    
    const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });
    const leagues = ['NBA', 'MLB', 'NHL', 'WNBA'];
    
    let snapshot = {};
    if (fs.existsSync(CONFIG.snapshotFile)) {
        snapshot = JSON.parse(fs.readFileSync(CONFIG.snapshotFile, 'utf8'));
    }

    for (const league of leagues) {
      try {
        const res = await sheets.spreadsheets.values.get({
          spreadsheetId: CONFIG.spreadsheetId,
          range: `${league}!A:Z`
        });
        
        const rows = res.data.values || [];
        if (rows.length < 2) continue;

        const headers = rows[0].map(h => h.toLowerCase().trim());
        const playerIdx = headers.findIndex(h => h.includes('player') || h === 'name');
        const propIdx = headers.findIndex(h => h.includes('prop') && !h.includes('score'));
        const oddsIdx = headers.findIndex(h => h === 'odds');
        const dkIdx = headers.findIndex(h => h.includes('dk_line') || h.includes('draftkings'));
        const fdIdx = headers.findIndex(h => h.includes('fd_line') || h.includes('fanduel'));

        if (playerIdx < 0 || propIdx < 0) continue;

        let count = 0;
        const today = new Date().toISOString().split('T')[0];

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const player = row[playerIdx];
          const prop = row[propIdx];
          if (!player || !prop) continue;

          // Key format: LEAGUE|PLAYER|PROP|DATE
          const key = `${league}|${player}|${prop}|${today}`;
          
          snapshot[key] = {
            odds: oddsIdx >= 0 ? row[oddsIdx] : null,
            dk_line: dkIdx >= 0 ? row[dkIdx] : null,
            fd_line: fdIdx >= 0 ? row[fdIdx] : null,
            timestamp: new Date().toISOString()
          };
          count++;
        }
        console.log(`✅ Captured ${count} closing lines for ${league}`);
      } catch (err) {
        console.log(`⚠️ Skipped ${league}: ${err.message}`);
      }
    }

    fs.writeFileSync(CONFIG.snapshotFile, JSON.stringify(snapshot, null, 2));
    console.log(`\n💾 Saved CLV snapshot to: ${CONFIG.snapshotFile}`);
    console.log(`You can now schedule this to run via cron at ~7PM ET daily.`);
    
  } catch (e) {
    console.error('❌ Failed to capture closing lines:', e);
  }
}

captureClosingLines();
