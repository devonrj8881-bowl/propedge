#!/usr/bin/env node

/**
 * Google Sheets Connector for PropEdge
 *
 * Reads player prop data from Google Sheets
 * Enriches with real game log metrics
 * Writes back enriched columns
 *
 * Requires: npm install googleapis google-auth-library
 *
 * Set GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const SPREADSHEET_ID = process.env.PROPEDGE_SHEET_ID || 'YOUR_SHEET_ID_HERE';
const RANGE = 'Players!A1:Z500';

class GoogleSheetsConnector {
  constructor(credentialsPath = null) {
    this.credentialsPath = credentialsPath || process.env.GOOGLE_APPLICATION_CREDENTIALS;
    this.auth = null;
    this.sheets = null;
  }

  async authenticate() {
    try {
      if (!this.credentialsPath) {
        throw new Error('GOOGLE_APPLICATION_CREDENTIALS not set. Provide path to service account JSON.');
      }

      const credentials = JSON.parse(fs.readFileSync(this.credentialsPath, 'utf-8'));

      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      this.auth = await auth.getClient();
      this.sheets = google.sheets({ version: 'v4', auth: this.auth });
      console.log('[GoogleSheetsConnector] ✓ Authenticated');
    } catch (err) {
      throw new Error(`Auth failed: ${err.message}`);
    }
  }

  async readAllData() {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: RANGE,
      });

      const rows = response.data.values || [];
      if (rows.length === 0) {
        throw new Error('No data found in sheet.');
      }

      const headers = rows[0];
      const data = rows.slice(1).map(row => {
        const obj = {};
        headers.forEach((h, i) => {
          obj[h] = row[i] || '';
        });
        return obj;
      });

      console.log(`[GoogleSheetsConnector] ✓ Read ${data.length} rows`);
      return { headers, data };
    } catch (err) {
      throw new Error(`Read failed: ${err.message}`);
    }
  }

  async writeEnrichedData(headers, enrichedRows) {
    try {
      const values = [headers, ...enrichedRows];

      await this.sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: RANGE,
        valueInputOption: 'RAW',
        resource: { values },
      });

      console.log(`[GoogleSheetsConnector] ✓ Wrote ${enrichedRows.length} enriched rows`);
    } catch (err) {
      throw new Error(`Write failed: ${err.message}`);
    }
  }

  async addColumn(columnName, columnData) {
    try {
      // Get current headers
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Players!1:1',
      });

      const headers = response.data.values[0] || [];
      const colIndex = headers.length;

      // Write column header
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `Players!${String.fromCharCode(65 + colIndex)}1`,
        valueInputOption: 'RAW',
        resource: { values: [[columnName]] },
      });

      // Write column data
      const colLetter = String.fromCharCode(65 + colIndex);
      const dataRange = `Players!${colLetter}2:${colLetter}${columnData.length + 1}`;
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: dataRange,
        valueInputOption: 'RAW',
        resource: { values: columnData.map(v => [v]) },
      });

      console.log(`[GoogleSheetsConnector] ✓ Added column: ${columnName}`);
    } catch (err) {
      throw new Error(`Add column failed: ${err.message}`);
    }
  }
}

// ============================================================================
// EXPORT FOR USE IN DATA ENGINE
// ============================================================================

module.exports = GoogleSheetsConnector;

// ============================================================================
// CLI USAGE
// ============================================================================

if (require.main === module) {
  (async () => {
    try {
      const connector = new GoogleSheetsConnector();
      await connector.authenticate();

      const { headers, data } = await connector.readAllData();
      console.log('Headers:', headers);
      console.log('First row:', data[0]);

      // Example: Add a new column
      const newColumn = data.map((_, i) => Math.random().toFixed(2));
      await connector.addColumn('Sample_Column', newColumn);
    } catch (err) {
      console.error('Error:', err.message);
    }
  })();
}
