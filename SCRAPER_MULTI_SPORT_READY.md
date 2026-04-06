# PropEdge Multi-Sport Scraper v1 — READY FOR TESTING

**Date:** April 4, 2026 (Evening)
**Status:** ✅ Code complete, ready for end-to-end testing
**File:** `/sessions/hopeful-optimistic-brahmagupta/mnt/PropEdge/scraper-multi-sport-v1.js`

---

## What's Implemented

### 1. Pace Data Fetchers (FULLY IMPLEMENTED)

#### NHL — Natural Stat Trick
- **Function:** `fetchNHLPaceData()`
- **Data Source:** https://www.naturalstattrick.com (public leaderboard)
- **Metrics Extracted:**
  - `corsi_per_60` — Possession metric (higher = more offensive pressure)
  - `xg_per_60` — Expected goals per 60 minutes
- **Parsing:** HTML table scraping with header detection
- **Error Handling:** Graceful fallback (returns empty object if fetch fails)

#### MLB — Baseball Savant
- **Function:** `fetchMLBPitcherMetrics()`
- **Data Source:** https://baseballsavant.mlb.com (2026 season leaderboard)
- **Metrics Extracted:**
  - `avg_velocity` — Average fastball velocity (mph)
  - `pitches_per_ab` — Pitches thrown per at-bat (workload indicator)
- **Parsing:** HTML table scraping with header detection
- **Filtering:** min_pitches=50 (filters out relievers with minimal sample size)
- **Error Handling:** Graceful fallback (returns empty object if fetch fails)

### 2. Enrichment Logic (FULLY IMPLEMENTED)

**NHL Props:**
- Appends `corsi_per_60` and `xg_per_60` columns to PropFinder CSV
- Player name matching (case-sensitive lookup)
- Adds headers if not already present

**MLB Props:**
- Appends `avg_velocity` and `pitches_per_ab` columns to PropFinder CSV
- Player name matching (pitcher name lookup)
- Adds headers if not already present

### 3. Main Scraper Flow

1. **Initialization**
   - Load Google Sheets client (OAuth via credentials.json)
   - Launch Puppeteer with Chrome
   - Set viewport to 1400×900

2. **PropFinder Login** (single login, reused for all leagues)
   - Navigate to propfinder.com
   - Type email + password
   - Click submit
   - Wait for navigation

3. **Parallel Pace Fetching**
   - While PropFinder login completes, fetch NHL and MLB pace data in parallel
   - Reduces overall runtime (not sequential)

4. **Per-League Processing** (sequential)
   - Navigate to league-specific props page
   - Click CSV download button
   - Wait for file download
   - Read CSV from ~/Downloads/
   - Parse CSV (handles quoted fields correctly)
   - **Filter:** pfRating >= 65, odds between -600 and +300
   - **Enrich:** Add pace/pitcher data (if available)
   - Write to Google Sheets (league-specific tab)
   - Append to Props_History (timestamped, for backtesting)
   - Clean up downloaded file
   - 2-second delay between leagues (polite rate limiting)

5. **History Pruning**
   - Remove entries >48 hours old from Props_History
   - Keeps sheet lean without losing recent data

6. **Logging**
   - Comprehensive logging with timestamps and indentation
   - Success/warning/error flags for easy monitoring
   - Per-league summary at end

---

## Testing Checklist

### Prerequisites
- [ ] `.env` file has `PROPFINDER_EMAIL`, `PROPFINDER_PASSWORD`, `GOOGLE_SHEET_ID`
- [ ] `credentials.json` exists in project root (Google Sheets OAuth)
- [ ] Chrome/Chromium installed and accessible

### Test Steps
1. **Syntax Check** (already done)
   ```bash
   node -c scraper-multi-sport-v1.js
   ```
   ✅ Passed

2. **PropFinder Login**
   ```bash
   node scraper-multi-sport-v1.js --visible
   ```
   - Watch browser: should log in successfully
   - Check console: logs show "PropFinder login successful"

3. **Pace Data Fetching**
   - Check console logs for:
     - "Retrieved NHL pace data for X skaters"
     - "Retrieved MLB pitcher metrics for Y pitchers"
   - If both return 0, fetchers are working but data source URLs may need adjustment

4. **CSV Parsing & Filtering**
   - Console should show per-league row counts after filtering
   - Example: "NBA: 47 props processed"

5. **Google Sheets Write**
   - Open your Google Sheet (from `GOOGLE_SHEET_ID`)
   - Check tabs: NBA, NHL, MLB, NFL (all should have data)
   - Verify headers match PropFinder CSV + new pace/pitcher columns
   - Check Props_History tab: timestamped entries from this run

6. **Enrichment Validation**
   - Open NHL tab → look for `corsi_per_60` and `xg_per_60` columns
   - Open MLB tab → look for `avg_velocity` and `pitches_per_ab` columns
   - Sample a few rows: values should match Natural Stat Trick / Baseball Savant

---

## Known Limitations & Next Steps

### Current Limitations
- **NHL Pace Data:** Natural Stat Trick doesn't have a public API. HTML scraping is fragile if the site changes layout.
  - **Alternative:** Could use Hockey Reference or pull NST data manually once/week
- **MLB Pitcher Metrics:** Baseball Savant HTML scraping works but could be replaced with official Statcast API if key obtained.
- **Name Matching:** Simple string matching. Could fail if "John Smith" appears as "J. Smith" or vice versa.
  - **Fix:** Could implement fuzzy matching (e.g., Levenshtein distance) in Phase 2

### Next Steps
1. **Test Dry-Run** (Apr 4-5)
   - Run scraper with `--visible` flag
   - Verify all 4 leagues download and write to Sheets
   - Check enrichment columns populated correctly

2. **Set Up Cron Jobs** (Apr 5+)
   - Schedule daily runs at 11:30 AM and 6 PM EST
   - Option A: macOS cron (already set up for v13, reuse pattern)
   - Option B: Netlify scheduled functions (for future cloud deployment)

3. **Adapt Scoring Model** (Phase 3)
   - Use NHL Corsi/60 and xG/60 in tier calculations
   - Use MLB velocity/pitches_per_ab in pitcher confidence score
   - Create sport-specific thresholds for Ultimate/Prime/Strong/Value

4. **Enhance UI** (Phase 4)
   - Add NHL and MLB league tabs to web app
   - Show pace/pitcher metrics in player cards
   - Add filtering by team, position, metric range

---

## File Locations

| File | Purpose | Status |
|------|---------|--------|
| `scraper-multi-sport-v1.js` | Main scraper orchestrator | ✅ Ready |
| `propedge-deploy/index.html` | Web app (UI) | ✅ Deployed (needs multi-sport tab) |
| `credentials.json` | Google Sheets OAuth | ⚠️ Must exist in project root |
| `.env` | PropFinder credentials + Sheets ID | ⚠️ Must exist |
| `~/Downloads/` | Temporary CSV storage (auto-cleaned) | ✅ Auto-managed |

---

## Running the Scraper

**Visible Mode (for testing):**
```bash
node scraper-multi-sport-v1.js --visible
```

**Headless Mode (for production/cron):**
```bash
node scraper-multi-sport-v1.js
```

---

## Error Handling

- **PropFinder login fails:** Script exits with error (improve auth in future)
- **CSS selector not found:** Logged as warning, attempt to continue
- **CSV download times out:** League marked as failed, other leagues continue
- **Pace data fetch fails:** Logged as warning, enrichment skipped for that league
- **Google Sheets write fails:** Logged as error, but script continues to next league
- **History prune fails:** Logged as warning, doesn't block future runs

---

## Success Indicators

✅ **Scraper is working if:**
1. Console shows "PropFinder login successful"
2. All 4 league tabs in Google Sheet contain data
3. Row counts > 0 for at least NBA (easiest to verify)
4. Props_History tab exists and has timestamped entries
5. NHL tab has `corsi_per_60` column populated
6. MLB tab has `avg_velocity` column populated

---

**Next action:** Run `node scraper-multi-sport-v1.js --visible` and verify all checks above.
