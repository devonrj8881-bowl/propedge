// PropEdge Hit-Tracking Apps Script — COMPLETE & READY TO USE
// Deploy as Web App (Execute as: Me, Who has access: Anyone)
// Copy-paste this entire file into Apps Script

const SHEET_NAME = 'Prop_Hits';
const SHEET_ID = '1xQEGclOjfDpTBHau6qMZ5i2j8tLlHbGJiWwyxeupOrw';

// CORS is handled automatically by Apps Script when deployed with "Anyone" access

function doPost(e) {
  try {
    // Validate event object
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error('Invalid event object: missing postData.contents');
    }

    // Parse incoming payload
    const payload = JSON.parse(e.postData.contents);

    // Validate payload
    if (!payload.propId || payload.hits === undefined || payload.total === undefined) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Missing required fields: propId, hits, total'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Get or create Prop_Hits sheet
    const ss = SpreadsheetApp.openById(SHEET_ID);
    let sheet = ss.getSheetByName(SHEET_NAME);

    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      // Add headers
      sheet.appendRow([
        'prop_id',
        'hits',
        'total',
        'accuracy',
        'timestamp',
        'autoDetected',
        'finalValue'
      ]);
    }

    // Check if prop_id already exists (for updates)
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const propIdIdx = headers.findIndex(h => h === 'prop_id');

    let existingRow = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][propIdIdx] === payload.propId) {
        existingRow = i + 1; // Sheet rows are 1-indexed
        break;
      }
    }

    // Prepare row data
    const rowData = [
      payload.propId,
      payload.hits,
      payload.total,
      payload.accuracy || 0,
      payload.timestamp || new Date().toISOString(),
      payload.autoDetected || false,
      payload.finalValue || null
    ];

    // Update existing row or append new row
    if (existingRow > 0) {
      // UPDATE: Replace entire row
      sheet.getRange(existingRow, 1, 1, rowData.length).setValues([rowData]);
      console.log(`Updated ${payload.propId} at row ${existingRow}`);
    } else {
      // APPEND: New row
      sheet.appendRow(rowData);
      console.log(`Appended new ${payload.propId}`);
    }

    // Return success response
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      propId: payload.propId,
      action: existingRow > 0 ? 'updated' : 'appended',
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    // Log error and return failure response
    console.error('Error in doPost:', error.message);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Test function (run from Apps Script editor to verify)
function testDoPost() {
  try {
    const testPayload = {
      propId: 'Test-Player-Points-Over-25.5',
      hits: 1,
      total: 2,
      accuracy: 50,
      timestamp: new Date().toISOString(),
      autoDetected: false,
      finalValue: 26
    };

    // Create mock event object with proper structure
    const e = {
      postData: {
        contents: JSON.stringify(testPayload)
      }
    };

    console.log('🧪 Testing doPost with payload:', JSON.stringify(testPayload, null, 2));
    const response = doPost(e);
    const result = response.getContent();
    console.log('✅ Test response:', result);
    return result;
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}
