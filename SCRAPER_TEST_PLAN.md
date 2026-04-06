# PropEdge Multi-Sport Scraper — Test Plan

**Date:** April 5, 2026
**Objective:** Validate scraper before first automated run tomorrow
**Risk Level:** Medium (touches Google Sheets + PropFinder login)

---

## Pre-Flight Checklist

### Environment Setup
- [ ] `.env` file exists in project root with:
  - `PROPFINDER_EMAIL` (valid account)
  - `PROPFINDER_PASSWORD` (valid credentials)
  - `GOOGLE_SHEET_ID` (your PropEdge sheet ID)
- [ ] `credentials.json` exists in project root (Google OAuth token)
- [ ] Chrome/Chromium installed and accessible at standard path
- [ ] Node.js 16+ installed
- [ ] All npm dependencies installed:
  ```bash
  npm list puppeteer-core googleapis dotenv
  ```

### File Integrity
- [ ] `scraper-multi-sport-v1.js` exists (628 lines)
- [ ] No syntax errors:
  ```bash
  node -c scraper-multi-sport-v1.js
  ```
- [ ] All functions defined (14 total):
  - findChrome(), log(), logSuccess(), logWarning(), logError()
  - getGoogleSheetsClient(), writeToSheet(), appendToHistory()
  - ensureHistoryTabExists(), pruneHistory(), parseCSV()
  - fetchNHLPaceData(), fetchMLBPitcherMetrics(), main()

---

## Test Phase 1: Syntax & Dependencies (5 min)

**Command:**
```bash
cd ~/Documents/Claude/Projects/PropEdge
node -c scraper-multi-sport-v1.js
```

**Expected Output:**
```
✅ Syntax check passed
```

**What It Verifies:**
- No JavaScript syntax errors
- All imports can be resolved
- No undefined variables

**If It Fails:**
- Error message will show line number
- Check import paths (puppeteer-core, googleapis, dotenv)
- Verify npm packages are installed

---

## Test Phase 2: Environment Variables (2 min)

**Command:**
```bash
node -e "require('dotenv').config(); console.log('Email:', process.env.PROPFINDER_EMAIL?.substring(0,5) + '***'); console.log('Sheet ID:', process.env.GOOGLE_SHEET_ID?.substring(0,10) + '***'); console.log('Home:', process.env.HOME);"
```

**Expected Output:**
```
Email: your_***
Sheet ID: 1ABC2D***
Home: /Users/devonjohnson
```

**What It Verifies:**
- .env file is loaded
- All required env vars exist
- Paths are correct

**If It Fails:**
- Check .env file exists in project root
- Check quotes/formatting in .env
- Verify no trailing whitespace

---

## Test Phase 3: Google Sheets Connection (3 min)

**Command:**
```bash
node -e "
const {google} = require('googleapis');
const auth = new google.auth.GoogleAuth({
  keyFile: './credentials.json',
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});
auth.getClient().then(() => console.log('✅ Google Sheets auth OK')).catch(e => console.log('❌ Auth failed:', e.message));
"
```

**Expected Output:**
```
✅ Google Sheets auth OK
```

**What It Verifies:**
- credentials.json is valid
- Google API can authenticate

**If It Fails:**
- Check credentials.json exists
- Regenerate OAuth token if expired:
  ```bash
  rm credentials.json
  # Then manually run scraper and grant permission when prompted
  ```

---

## Test Phase 4: Chrome Detection (1 min)

**Command:**
```bash
node -e "
const fs = require('fs');
const paths = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium'
];
paths.forEach(p => {
  if (fs.existsSync(p)) console.log('✅ Found Chrome:', p);
  else console.log('❌ Not found:', p);
});
"
```

**Expected Output:**
```
✅ Found Chrome: /Applications/Google Chrome.app/Contents/MacOS/Google Chrome
```

**What It Verifies:**
- Chrome is installed at expected location

**If It Fails:**
- Chrome may be at non-standard location
- Run: `which google-chrome` or `which chromium`
- Script will auto-detect, but good to verify

---

## Test Phase 5: Full Dry-Run (15-30 min)

### 5A: Visible Run (With Browser Window)

**Command:**
```bash
node scraper-multi-sport-v1.js --visible
```

**Expected Output (Console):**
```
[HH:MM:SS] ========================================
[HH:MM:SS] PropEdge Multi-Sport Scraper v1 Starting
[HH:MM:SS] ========================================
[HH:MM:SS] Initializing Google Sheets client...
[HH:MM:SS] ✅ Google Sheets client ready
[HH:MM:SS] Launching browser...
[HH:MM:SS] ✅ Browser launched
[HH:MM:SS] Logging into PropFinder...
[HH:MM:SS] ✅ PropFinder login successful
[HH:MM:SS] Prefetching pace data for all sports...
[HH:MM:SS]   Fetching NHL pace data from Natural Stat Trick...
[HH:MM:SS]   ✅ Retrieved NHL pace data for N skaters
[HH:MM:SS]   Fetching MLB pitcher metrics from Baseball Savant...
[HH:MM:SS]   ✅ Retrieved MLB pitcher metrics for M pitchers
[HH:MM:SS] Processing NBA...
[HH:MM:SS]   ✅ NBA: X props processed
[HH:MM:SS] Processing NHL...
[HH:MM:SS]   ✅ NHL: Y props processed
[HH:MM:SS] Processing MLB...
[HH:MM:SS]   ✅ MLB: Z props processed
[HH:MM:SS] Processing NFL...
[HH:MM:SS]   ✅ NFL: W props processed
[HH:MM:SS] ========================================
[HH:MM:SS] SYNC COMPLETE
[HH:MM:SS] ========================================
[HH:MM:SS] ✅ NBA: X props
[HH:MM:SS] ✅ NHL: Y props
[HH:MM:SS] ✅ MLB: Z props
[HH:MM:SS] ✅ NFL: W props
```

**Browser Behavior:**
- Chrome window opens
- Navigates to propfinder.com
- Enters credentials automatically
- Clicks submit
- Waits for page load
- Navigates to each league page
- Clicks download button (may see "Download" notification)

**What It Verifies:**
- PropFinder login works
- CSV download mechanism works
- Pace data fetchers work
- All 4 leagues process successfully

**If It Fails (Common Issues):**

| Error | Cause | Fix |
|-------|-------|-----|
| "PropFinder login failed" | Wrong credentials or 2FA | Update .env, disable 2FA temporarily |
| "No CSV found for NBA" | CSS selector changed | Update selector in scraper or contact PropFinder |
| "Retrieved NHL pace data for 0 skaters" | NST website changed | Normal during transition, will retry next run |
| "Cannot find Chrome" | Non-standard install path | Check which chrome-like browser is available |
| "Google Sheets auth failed" | Invalid credentials.json | Regenerate OAuth token |

---

## Test Phase 6: Google Sheets Verification (5 min)

**After successful dry-run, check your Google Sheet:**

### Verify Tab Structure
- [ ] Open Google Sheet (from GOOGLE_SHEET_ID)
- [ ] Verify tabs exist:
  - NBA
  - NHL
  - MLB
  - NFL
  - Props_History

### Verify Data in NBA Tab (Easiest to Check)
- [ ] Click NBA tab
- [ ] Row 1 should have headers (e.g., Player, Prop Type, Line, Odds, PF Rating, etc.)
- [ ] Rows 2+ should have actual prop data
- [ ] Check at least 5 rows have data
- [ ] Verify all columns populated

### Verify NHL Enrichment (Critical Test)
- [ ] Click NHL tab
- [ ] Should have all base PropFinder columns
- [ ] **Should have new columns at end:** `corsi_per_60`, `xg_per_60`
- [ ] Sample a few rows — some should have Corsi/xG values, some may be empty (if player not in NST data)
- [ ] No errors or N/A values

### Verify MLB Enrichment (Critical Test)
- [ ] Click MLB tab
- [ ] Should have all base PropFinder columns
- [ ] **Should have new columns at end:** `avg_velocity`, `pitches_per_ab`
- [ ] Sample a few rows — some should have velocity/pitch count, some may be empty (if pitcher not in Savant data)
- [ ] No errors or N/A values

### Verify Props_History Tab
- [ ] Click Props_History tab
- [ ] Should have header row: `timestamp, league, player, prop_type, line, direction, odds, pf_rating, l10_avg, l5_avg`
- [ ] Should have multiple rows of timestamped data from the dry-run
- [ ] Timestamps should be from a few minutes ago (when you ran the scraper)

### Check for Data Loss
- [ ] Run scraper twice in a row
- [ ] Check Props_History has entries from both runs (different timestamps)
- [ ] Verify second run didn't overwrite first run (both sets of rows should exist)

---

## Test Phase 7: Safety Checks (5 min)

**Before Automated Run, Verify:**

- [ ] **No data was deleted:** Props_History grows, never shrinks (until 48h pruning)
- [ ] **No corrupted data:** All rows have same number of columns
- [ ] **Headers preserved:** Column names didn't change
- [ ] **Enrichment is optional:** If pace data fetch fails, props still write (with empty enrichment columns)
- [ ] **No sensitive data leaked:** No credentials in sheet or logs

---

## Test Phase 8: Headless Run (5 min)

**After visible run succeeds, test headless mode:**

**Command:**
```bash
node scraper-multi-sport-v1.js
```

(Note: No `--visible` flag = runs without browser window visible)

**Expected Output:**
Same as Phase 5A, but no browser window opens.

**What It Verifies:**
- Scraper works without UI (needed for cron automation)

---

## Test Phase 9: Rapid Succession (5 min)

**Test resilience to multiple runs:**

**Command:**
```bash
node scraper-multi-sport-v1.js --visible && echo "✅ Run 1 OK" && sleep 2 && node scraper-multi-sport-v1.js --visible && echo "✅ Run 2 OK"
```

**Expected:**
- Both runs complete successfully
- No conflicts
- Props_History has entries from both runs

**What It Verifies:**
- Script can handle back-to-back execution
- No file locks or port conflicts

---

## Test Phase 10: Error Recovery (Optional)

**Test that script continues if one league fails:**

**To Simulate:**
1. Temporarily rename one league's CSV selector
2. Run scraper
3. Verify other 3 leagues still process
4. Undo change

**What It Verifies:**
- One league failure doesn't cascade
- Script logs errors but continues
- Other data is safe

---

## Success Criteria

✅ **All tests pass if:**

| Metric | Target |
|--------|--------|
| Syntax check | PASS |
| Env vars loaded | All 3 present |
| Google Sheets auth | SUCCESS |
| Chrome detected | Found at standard path |
| Dry-run completes | All 4 leagues logged |
| Pace data fetched | ≥1 NHL + MLB records |
| NHL enrichment | corsi_per_60 column visible |
| MLB enrichment | avg_velocity column visible |
| Props_History grows | New timestamped rows added |
| Headless run | Same output as visible run |
| Data integrity | No corruption or loss |

---

## Go/No-Go Decision

**GO to automated run IF:**
- ✅ All 10 test phases pass
- ✅ No data corruption detected
- ✅ Google Sheets writes work
- ✅ Both pace fetchers return data
- ✅ Enrichment columns visible in sheets

**NO-GO IF:**
- ❌ Any test phase fails
- ❌ Login fails (credentials issue)
- ❌ CSV not downloading (selector changed)
- ❌ Google Sheets auth fails
- ❌ Data corruption detected

---

## Troubleshooting Matrix

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| "No CSV found" | PropFinder UI changed | Check if download button selector is still correct |
| "0 pace records" | Website down or changed | Normal, will auto-recover next run |
| "Google Sheets write failed" | Rate limit hit | Wait 1min, retry |
| "Login failed" | Wrong credentials | Update .env, test manually |
| "Browser timeout" | Slow internet | Increase timeout in scraper (line 502) |
| "Duplicate rows in history" | Script ran twice | Normal, timestamps differ |

---

## Next Steps

1. **Today (Apr 5):** Run all 10 test phases above
2. **Verify:** All checks pass, no data corruption
3. **Setup Cron:** After passing tests, schedule daily 11:30 AM & 6 PM EST runs
4. **Monitor:** Check Google Sheet tomorrow morning for first automated run
5. **Iterate:** If issues found, fix and re-test before next scheduled run

---

**Estimated Total Test Time:** 30-45 minutes
**Risk Mitigation:** Full dry-run before automation
**Success Metrics:** All phases pass, data integrity confirmed
