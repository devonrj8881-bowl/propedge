# PropEdge Scraper Diagnostic — April 2, 2026

## Problem Summary
The scraper is not pulling from PropFinder and adding props to Google Sheets.

## Root Causes Identified

### Issue 1: Chrome Path (FIXED ✅)
- **Problem:** Scraper was hardcoded to look for Chrome at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
- **Status:** ✅ FIXED — Updated scraper to dynamically find Chrome
- **File:** `scraper-v13.js` (lines 16-29)

### Issue 2: Google Sheets Network Access (CRITICAL)
- **Problem:** When running in sandbox, Google Sheets API token refresh is blocked by network allowlist
- **Error Message:** "Could not refresh access token: Connection blocked by network allowlist"
- **Root Cause:** Sandboxed environments (like the Cowork Linux sandbox) have restricted network access
- **Status:** ❌ CANNOT FIX IN SANDBOX — Requires running on your actual Mac

## Why This Scraper Must Run on Your Mac (Not Sandbox)

1. **Chrome Installation** — Your Mac has Google Chrome; the Linux sandbox doesn't
2. **PropFinder Access** — Your Mac can log into propfinder.app with your credentials
3. **Google Sheets Tokens** — Your Mac's network can refresh Google Sheets API tokens
4. **Scheduled Tasks** — Cowork scheduled tasks actually execute on your Mac, not in this sandbox

## How to Test & Fix

### Step 1: Navigate to the Correct Directory
Open Terminal on your Mac and run:
```bash
cd /Users/devonjohnson/Documents/Claude/Projects/PropEdge/propedge-deploy
```

### Step 2: Install/Verify Dependencies
```bash
npm install
```

### Step 3: Run the Scraper Manually
```bash
node scraper-v13.js
```

You should see:
- ✅ "Logged in" (PropFinder login successful)
- ✅ "Processing NBA/NHL/MLB/NFL" (data being downloaded)
- ✅ "Written X rows to NBA/NHL/MLB/NFL" (data written to Google Sheets)
- ✅ "Sync completed!" (finished successfully)

## What the Updated Scraper Does

The updated `scraper-v13.js` now:
1. Automatically finds Chrome on your system (checks multiple paths)
2. Falls back to Puppeteer's default Chrome discovery if hardcoded paths fail
3. Logs where Chrome was found for diagnostic purposes
4. Better error handling for missing Chrome

## Scheduled Tasks Status

Your Cowork scheduled tasks are set to run at:
- **Morning:** 11:30 AM EST
- **Evening:** 6:00 PM EST

These will work correctly once the scraper runs successfully on your Mac at least once.

## Next Steps

1. **Test manually on your Mac** (follow Step 1-3 above)
2. **Check the output** — look for errors related to:
   - PropFinder login failures
   - Chrome/Puppeteer issues
   - Google Sheets write failures
3. **Report any new errors** — if the manual run fails, share the output and we can debug further

## Files Modified Today

- ✅ `scraper-v13.js` — Dynamic Chrome discovery added
- ✅ `RUN_SCRAPER.sh` — Simple runner script
- 📋 This diagnostic file

---

**Last Updated:** April 2, 2026 @ 1:21 PM EST
**Status:** Ready for manual testing on Mac
