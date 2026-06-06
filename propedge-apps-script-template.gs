// PropEdge Hit-Tracking Apps Script Template
// Deploy as Web App (Execute as: Me, Who has access: Anyone)
// This endpoint receives hit-tracking data from PropEdge and appends to Prop_Hits sheet

const SHEET_NAME = 'Prop_Hits';
const SHEET_ID = 'YOUR_SHEET_ID'; // Replace with actual Google Sheet ID

// Handle CORS preflight requests
function doOptions(e) {
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.TEXT);
  output.addHeader('Access-Control-Allow-Origin', '*');
  output.addHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  output.addHeader('Access-Control-Allow-Headers', 'Content-Type');
  return output;
}

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
      const response = ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Missing required fields: propId, hits, total'
      }));
      response.setMimeType(ContentService.MimeType.JSON);
      response.addHeader('Access-Control-Allow-Origin', '*');
      return response;
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

    // Return success response with CORS headers
    const response = ContentService.createTextOutput(JSON.stringify({
      success: true,
      propId: payload.propId,
      action: existingRow > 0 ? 'updated' : 'appended',
      timestamp: new Date().toISOString()
    }));
    response.setMimeType(ContentService.MimeType.JSON);
    response.addHeader('Access-Control-Allow-Origin', '*');
    response.addHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    response.addHeader('Access-Control-Allow-Headers', 'Content-Type');
    return response;

  } catch (error) {
    // Log error and return failure response
    console.error('Error in doPost:', error.message);
    const response = ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.message
    }));
    response.setMimeType(ContentService.MimeType.JSON);
    response.addHeader('Access-Control-Allow-Origin', '*');
    response.addHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    response.addHeader('Access-Control-Allow-Headers', 'Content-Type');
    return response;
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
