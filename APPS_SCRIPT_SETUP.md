# PropEdge Apps Script Setup

This document walks through deploying the hit-tracking Apps Script endpoint.

## Step 1: Create a New Apps Script Project

1. Go to **Google Apps Script**: https://script.google.com
2. Click **+ New project**
3. Name it: `PropEdge Hit-Tracking Endpoint`

## Step 2: Add the Code

1. Delete the default `Code.gs` file
2. Create a new file called `PropEdge.gs`
3. Copy the entire contents from `propedge-apps-script-template.gs` into this file
4. **Find this line:**
   ```javascript
   const SHEET_ID = 'YOUR_SHEET_ID'; // Replace with actual Google Sheet ID
   ```
5. **Replace `YOUR_SHEET_ID` with your actual Google Sheet ID**
   - Open your PropEdge Google Sheet
   - The ID is in the URL: `https://docs.google.com/spreadsheets/d/**SHEET_ID_HERE**/edit`
   - Copy it and paste into the code

## Step 3: Test the Function (Optional but Recommended)

1. In Apps Script editor, click the **Run** button (or select `testDoPost` from dropdown and click Run)
2. Click **Review permissions** → **Allow**
3. Check the **Execution log** (View → Logs) — should show:
   ```
   Updated Test-Player-Points-Over-25.5 at row X
   ```

## Step 4: Deploy as Web App

1. Click **Deploy** (top right)
2. Click **+ New deployment**
3. Select **Type**: Choose the gear icon → **Web app**
4. Fill in:
   - **Execute as**: `Your Email Address` (the account owning the sheet)
   - **Who has access**: `Anyone`
5. Click **Deploy**
6. Copy the deployment URL shown in the popup (looks like):
   ```
   https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/usercodeapp
   ```
7. **Save this URL** — you'll need it for PropEdge

## Step 5: Update PropEdge Code

In `propedge-deploy/index.html`, find line ~6485:

**Before:**
```javascript
const scriptUrl = 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/usercodeapp';
```

**After:**
```javascript
const scriptUrl = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/usercodeapp';
```

Replace `YOUR_DEPLOYMENT_ID` with the actual ID from Step 4.

## Step 6: Verify Setup

1. Open PropEdge app
2. Mark a prop as hit/miss
3. Check the browser console (Cmd+Option+J on Mac, F12 on Windows)
4. Look for log message: `✅ Synced [propId] to Sheet`
5. Open your Google Sheet → **Prop_Hits** tab
6. Verify the row was added/updated

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Sync failed" logs | Check endpoint URL is correct (copy from deployment again) |
| "Apps Script not found" | Verify SHEET_ID is correct in the .gs file |
| Permissions denied | Check deployment settings: "Execute as: Your Email" and "Who has access: Anyone" |
| Data not appearing | Check Prop_Hits sheet exists in Google Sheet (Apps Script creates it if missing) |

## What Gets Stored

Each sync creates/updates a row in **Prop_Hits** sheet with:
- `prop_id` — Unique identifier
- `hits` — Total hits
- `total` — Total bets
- `accuracy` — Hit % (e.g., 65)
- `timestamp` — ISO timestamp (for conflict resolution)
- `autoDetected` — Whether hit was auto-detected (currently always false)
- `finalValue` — The actual stat value (e.g., 27 for "Over 25.5 Points")

## How It Works

When a user marks a prop:
1. PropEdge saves to localStorage (instant)
2. PropEdge queues sync to Apps Script (with retry)
3. Apps Script receives POST → Appends/updates row in Prop_Hits sheet
4. Every 30 seconds, PropEdge pulls from Prop_Hits sheet
5. Conflicts resolved: Newest timestamp (by `timestamp` field) wins

## Security Note

- Apps Script endpoint is public (`Anyone` access) but requires valid JSON payload
- No authentication token needed (relies on Google Apps Script deployment security)
- Consider restricting to specific IPs if you want additional security (advanced)
