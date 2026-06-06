# PropEdge Scraper — Execution Guide (April 5, 2026)

## ✅ Status: Ready for Testing

The multi-sport scraper has been updated with correct PropFinder selectors and is ready for end-to-end testing on your macOS machine.

---

## What Changed

### 1. Fixed CSV Download Mechanism
- **Old:** Used broken `[data-csv-download]` selector + multi-selector fallbacks
- **New:** Uses correct pattern from scraper-v13.js:
  - Clicks `button[aria-label="Export"]` (Export button)
  - Finds and clicks "Download as CSV" option from menu items
  - Properly waits for file download (5 sec wait)
  - Cleans up downloaded CSV after processing

### 2. Updated League URLs
- Changed from: `https://www.propfinder.app/props?league=${league}`
- Changed to: `https://propfinder.app/${league.toLowerCase()}/`
- Matches v13's proven working format

### 3. Improved Error Handling
- Better diagnostics if Export button isn't found
- Fallback to Escape key if menu selection fails
- File cleanup after processing
- Graceful continuation if one league fails

---

## How to Test (On Your macOS Machine)

### Prerequisites
- Node.js 16+ installed
- npm dependencies installed (`npm list`)
- `.env` file with credentials (PROPFINDER_EMAIL, PROPFINDER_PASSWORD, GOOGLE_SHEET_ID)
- `credentials.json` for Google Sheets OAuth
- Google Chrome or Chromium installed

### Step 1: Pre-Flight Checks (5 min)
```bash
cd ~/Documents/Claude/Projects/PropEdge
./test-scraper.sh
```

Expected output:
```
✅ Syntax check PASSED
✅ Env vars loaded
✅ credentials.json exists
✅ Chrome detected
✅ All Pre-Checks PASSED
```

**If any check fails:** Review the error message and fix the issue before proceeding.

### Step 2: Visible Dry-Run (15-20 min)
Watch the browser execute the full scraper:
```bash
node scraper-multi-sport-v1.js --visible
```

**Expected Console Output:**
```
[HH:MM:SS] ========================================
[HH:MM:SS] PropEdge Multi-Sport Scraper v1 Starting
[HH:MM:SS] Initializing Google Sheets client...
[HH:MM:SS] ✅ Google Sheets client ready
[HH:MM:SS] Launching browser...
[HH:MM:SS] ✅ Browser launched
[HH:MM:SS] Logging into PropFinder...
[HH:MM:SS] ✅ PropFinder login successful
[HH:MM:SS] Processing NBA...
[HH:MM:SS]   ✅ NBA: X props processed
[HH:MM:SS] Processing NHL...
[HH:MM:SS]   ✅ NHL: Y props processed + enriched with pace data
[HH:MM:SS] Processing MLB...
[HH:MM:SS]   ✅ MLB: Z props processed + enriched with pitcher metrics
[HH:MM:SS] Processing NFL...
[HH:MM:SS]   ✅ NFL: W props processed
[HH:MM:SS] ========================================
[HH:MM:SS] SYNC COMPLETE
```

**Browser Behavior:**
- Chrome window opens
- Navigates to PropFinder login
- Enters email/password (watch it happen)
- Logs in and navigates to NBA page
- Clicks Export button
- Selects "Download as CSV" from menu
- Repeats for NHL, MLB, NFL
- Window closes when done

**Success Indicators:**
- ✅ All 4 leagues log "✅ X props processed"
- ✅ No red ❌ error messages
- ✅ Console shows completion message
- ✅ Each league takes 10-30 seconds

**If Download Fails:**
- Check if PropFinder UI changed
- Manual test: Log into PropFinder, find Export button, check menu options
- Verify selectors match: `button[aria-label="Export"]` and menu items with "Download as CSV"
- Contact PropFinder support if their API changed

### Step 3: Google Sheets Verification (5 min)

Open your PropEdge Google Sheet and verify:

| Tab | Expected | Status |
|-----|----------|--------|
| **NBA** | ≥5 rows with prop data | ✅ or ❌ |
| **NHL** | Base columns + `corsi_per_60`, `xg_per_60` | ✅ or ❌ |
| **MLB** | Base columns + `avg_velocity`, `pitches_per_ab` | ✅ or ❌ |
| **NFL** | ≥5 rows with prop data | ✅ or ❌ |
| **Props_History** | Timestamped entries from this run | ✅ or ❌ |

**Enrichment Check:**
- NHL should have Corsi/xG values for players found in Natural Stat Trick data
- MLB should have velocity/pitch counts for pitchers found in Baseball Savant data
- Some cells may be empty if player wasn't in the source data (OK)

**History Check:**
- Should see timestamped rows with structure: timestamp | league | player | prop_type | line | direction | odds | pf_rating | l10_avg | l5_avg

### Step 4: Data Integrity Test (5 min)

Run the scraper twice in succession:
```bash
node scraper-multi-sport-v1.js --visible && sleep 5 && node scraper-multi-sport-v1.js --visible
```

**Check in Google Sheet:**
- Each league tab has latest data (can verify by most recent prop line)
- Props_History has entries from BOTH runs (different timestamps)
- No duplicate rows or corrupted data
- All rows have same number of columns

**Success:** Second run's data overwrites league tabs (expected), but Props_History preserves both runs' data.

### Step 5: Headless Mode Test (5 min)

Test without visible browser (required for cron):
```bash
node scraper-multi-sport-v1.js
```

(No `--visible` flag)

**Expected:**
- No browser window opens
- Console output identical to visible run
- Same data writes to Google Sheet
- Completes in 15-20 seconds

**If headless fails but visible passed:**
- Rare issue with Puppeteer headless mode
- Check Chrome process: `ps aux | grep chrome`
- May need additional flags in scraper

---

## Success Criteria (All Must Pass)

✅ **Pre-flight checks:** 5/5 pass
✅ **Visible dry-run:** All 4 leagues logged with "✅" marks
✅ **Google Sheet:** All 4 league tabs have data + enrichment columns visible
✅ **Props_History:** Has timestamped entries from run
✅ **Integrity test:** Second run creates new History entries, no data corruption
✅ **Headless mode:** Works identically to visible run

---

## If Testing Fails

### CSV Download Not Working
1. Check PropFinder web UI manually
2. Verify Export button exists at `button[aria-label="Export"]`
3. Check menu options for "Download as CSV" text
4. May need to update selectors if PropFinder UI changed
5. Contact PropFinder support if their API changed

### Google Sheets Write Failed
1. Check credentials.json hasn't expired
2. Verify GOOGLE_SHEET_ID in .env is correct
3. Test Google Sheets API manually: `node -e "const {google} = require('googleapis'); ..."`
4. May need to regenerate OAuth token

### Enrichment Columns Missing
1. Check console for warnings about pace data fetchers
2. Natural Stat Trick or Baseball Savant may be down
3. Script logs "Enriching NHL props..." — if you don't see it, pace fetch failed
4. **OK to proceed even without enrichment** — props still write correctly

### Headless Mode Fails
1. First ensure visible mode works
2. Check for headless-specific Chrome issues
3. Try disabling sandbox: Already included in launch args
4. May need `--disable-dev-shm-usage` (already included)

---

## Next Steps (After Testing Passes)

### Tomorrow Morning (Apr 6, ~11:30 AM)
1. Monitor the automated cron run
2. Check Google Sheet for new data
3. Verify no errors in system log

### Once Confident
1. Enable daily cron jobs (11:30 AM & 6 PM EST)
2. Set up monitoring for failed runs
3. Archive daily Google Sheet snapshots if desired

---

## Important Notes

- **Chrome Required:** Scraper uses Puppeteer to automate PropFinder login
- **Network Access:** Fetches NHL pace data from Natural Stat Trick (stable)
- **Network Access:** Fetches MLB pitcher data from Baseball Savant (stable)
- **Google Sheets:** Requires valid credentials.json with read/write permissions
- **Cron Setup:** After passing all tests, copy scraper to `/usr/local/bin/` and add cron entries

---

## Questions?

If testing fails:
1. Check SCRAPER_TEST_PLAN.md for detailed troubleshooting matrix
2. Review TEST_STRATEGY_SUMMARY.md for quick reference
3. Check console output for specific error messages
4. Verify all dependencies: `npm list puppeteer-core googleapis dotenv`

---

**Confidence Level:** HIGH — Scraper uses proven selectors from v13 + enrichment pipeline tested
**Time to Deploy:** Once tests pass, ready for automated cron within 5 minutes
**Risk:** LOW — Full dry-run validates all functionality before automation
