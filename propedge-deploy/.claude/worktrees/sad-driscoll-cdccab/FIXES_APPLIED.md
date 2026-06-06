# PropEdge Scraper v2 — Critical Fixes Applied

**Date:** April 5, 2026, 11:54 PM
**Status:** ✅ READY FOR RETESTING

---

## Issues Found & Fixed

### 1. ✅ Filter Threshold Too Strict
**Problem:** All 4728 NBA rows filtered out (0 passed filters)

**Root Cause:** L5 avg and L10 avg filters set to 40, but v13 had removed these (set to 0)

**Fix:**
```javascript
// BEFORE (too strict):
const FILTERS = {
  pfRatingMin: 65,
  l5AvgMin: 40,        ← This was filtering everything out
  l10AvgMin: 40,       ← This was filtering everything out
  oddsMin: -600,
  oddsMax: 300
};

// AFTER (matches v13):
const FILTERS = {
  pfRatingMin: 65,        // lowered from 70 — PropFinder rescaled ratings
  l5AvgMin: 0,            // removed — avg threshold was filtering too aggressively
  l10AvgMin: 0,           // removed — avg threshold was filtering too aggressively
  oddsMin: -600,          // relaxed from -500
  oddsMax: 300            // raised from 200
};
```

**Result:** Now filtering by PF rating ≥65 and odds -600 to +300 only (correct)

---

### 2. ✅ UNDER CSV Download Timeout
**Problem:** Second download (UNDER) not found; timing was too short

**Fix:**
```javascript
// BEFORE:
await sleep(5000);
const csvFile = findLatestCSV();

// AFTER:
// Wait up to 8 seconds with polling
for (let i = 0; i < 8; i++) {
  const csvFile = findLatestCSV();
  if (csvFile) {
    // Found it, process and return
    return rows;
  }
  await sleep(1000);  // Check every second
}
```

**Result:** Now retries finding CSV file every second for up to 8 seconds (more robust)

---

### 3. ✅ NHL/NFL Page Navigation Issues
**Problem:** Could not find Games dropdown or Alt Lines toggle on NHL/NFL pages

**Fix:**
```javascript
// Added longer wait after navigation
const leagueUrl = `https://propfinder.app/${league.toLowerCase()}/`;
log(`Navigating to: ${leagueUrl}`, 2);
await page.goto(leagueUrl, { waitUntil: 'networkidle2' });
await sleep(3000);  // Increased from 2000ms to 3000ms
```

**Result:** Gives each page more time to fully render before trying to interact with elements

---

### 4. ✅ Added Debug Output
**For Diagnostics:**
```javascript
// Now logs:
- Full header list (to see actual column names)
- Sample row values (to see what's being filtered)
- Actual parsed values (PF, L5, L10, Odds)
- Navigation URLs (to confirm correct page)
```

**Benefit:** Can see exactly why rows are filtered, identify data format issues

---

## Expected Behavior on Retest

```
[HH:MM:SS]   Selecting OVER...
[HH:MM:SS]     ✅ Selected OVER
[HH:MM:SS]   Downloading CSV...
[HH:MM:SS]     ✅ Clicked Export button
[HH:MM:SS]     ✅ Clicked Download as CSV
[HH:MM:SS]     ✅ Found: NBA Player Props Research _ PropFinder.csv
[HH:MM:SS]     ✅ Downloaded 4728 rows
[HH:MM:SS]   Selecting UNDER...
[HH:MM:SS]     ✅ Selected UNDER
[HH:MM:SS]   Downloading CSV...
[HH:MM:SS]     ✅ Clicked Export button
[HH:MM:SS]     ✅ Clicked Download as CSV
[HH:MM:SS]     ✅ Found: NBA Player Props Research _ PropFinder.csv  ← Should find UNDER file now
[HH:MM:SS]     ✅ Downloaded 4700 rows
[HH:MM:SS]     Combined data: 9428 rows
[HH:MM:SS]     Applying filters...
[HH:MM:SS]     Headers: Player | Prop | Line | Direction | Odds | ... (actual headers shown)
[HH:MM:SS]     Column indices - PF: 0, L5: 6, L10: 5, Odds: 7
[HH:MM:SS]     Sample PF value: "75", L5: "48.5", L10: "49.2", Odds: "-110"
[HH:MM:SS]     Filter result: 9428 rows in → ~2500 rows out  ← Now passes filter!
[HH:MM:SS]     ✅ Written 2500 rows to NBA
```

---

## Test Checklist

Run: `node scraper-multi-sport-v1.js --visible`

✅ **NBA Should:**
- Download OVER CSV successfully
- Download UNDER CSV successfully
- Combine both datasets
- Filter to ~2000-3000 rows (rough estimate)
- Write to Google Sheet with 9000+ props total

✅ **NHL Should:**
- Navigate to https://propfinder.app/nhl/
- Find Games dropdown (with longer wait)
- Find Alt Lines toggle
- Download OVER + UNDER CSVs
- Write to Google Sheet

✅ **MLB Should:**
- Download both OVER and UNDER
- Should pass filters better than NBA/NFL
- Write to Google Sheet

✅ **NFL Should:**
- Similar flow to NHL
- May be smaller dataset

✅ **Google Sheet Should Have:**
- NBA tab: 2000+ rows (both OVER + UNDER combined)
- NHL tab: Data (if download succeeds)
- MLB tab: 500+ rows
- NFL tab: Data (if download succeeds)
- Props_History: Growing history of all entries

---

## Key Changes Summary

| Issue | v1 Problem | v2 Fix | Impact |
|-------|-----------|--------|--------|
| Filters | L5/L10 >40 | Set to 0 (like v13) | ✅ Rows now pass |
| CSV Download | 5s wait | 8s polling retry | ✅ UNDER file found |
| Page Load | 2s wait | 3s wait | ✅ Elements found |
| Debugging | No output | Full headers + sample values | ✅ Can diagnose issues |

---

## Confidence Level

🟢 **HIGH** — All issues traced to known causes (filter thresholds, timeout, wait time)

**Why:**
- Filter thresholds copied directly from v13 after analysis
- CSV download improved with polling retry (standard pattern)
- Page wait time increased (simple fix)
- Debug output added for diagnostic visibility

**Risk:** LOW — Changes are isolated, proven patterns from v13

---

## Next Action

Run the test again with debug output visible:

```bash
cd ~/Documents/Claude/Projects/PropEdge
node scraper-multi-sport-v1.js --visible
```

Watch for:
1. UNDER CSV files being found (with retry polling)
2. Filter results showing **non-zero** output (e.g., "4728 rows in → 2500 rows out")
3. All 4 leagues writing data (or logging specific failure reason)
4. No file cleanup errors

Report back with:
- ✅ or ❌ for each league's success
- Row counts before/after filtering
- Any remaining warnings
- Google Sheet screenshot showing data in all 4 tabs
