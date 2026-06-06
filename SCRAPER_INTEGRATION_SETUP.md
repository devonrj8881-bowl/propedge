# PropEdge v15-Integrated Scraper Setup

**Date**: April 29, 2026  
**Status**: ✅ Ready for deployment

## What Changed

### Scraper v15-Integrated
- **File**: `scraper-v15-integrated.js` (both root + propedge-deploy/)
- **Flow**: PropFinder API → Enrichment CSV → Merged Sheets upload
- **Key Functions**:
  - `loadEnrichmentCSV(sport)` — loads latest enriched data
  - `mergeEnrichmentData()` — matches by player+prop name
  - `processLeague()` — calls merge before Sheets write

### Daemon Script Updated
- **File**: `run-scraper-daemon.sh`
- **Changed**: Calls `scraper-v15-integrated.js` instead of v14
- **Uses**: Full path `/opt/homebrew/bin/node`

### Launchd Agent Updated
- **File**: `com.propedge.scraper.plist`
- **Schedule**: 11:30 AM, 3 PM, 5:30 PM EST (3 runs/day)
- **Paths**: Updated from stale session paths to real paths
- **PATH**: Includes `/opt/homebrew/bin` for Homebrew node

---

## Setup Instructions (Run Once on Your Mac)

### Step 1: Install/Reload LaunchD Agent

```bash
# Unload old agent if loaded
launchctl unload ~/Library/LaunchAgents/com.propedge.scraper.plist 2>/dev/null || true

# Copy plist to LaunchAgents
cp ~/Documents/Claude/Projects/PropEdge/com.propedge.scraper.plist ~/Library/LaunchAgents/

# Load the agent
launchctl load ~/Library/LaunchAgents/com.propedge.scraper.plist

# Verify it loaded
launchctl list | grep propedge
```

**Expected output**: Job label `com.propedge.scraper` should appear in the list.

### Step 2: Test Manual Run

```bash
cd ~/Documents/Claude/Projects/PropEdge
/opt/homebrew/bin/node scraper-v15-integrated.js
```

This will:
1. Login to PropFinder
2. Set FanDuel as only sportsbook
3. Download NBA/NHL/MLB OVER/UNDER CSVs
4. **Load enrichment data** from `propedge-enriched/` folder
5. **Merge by player + prop name**
6. Write merged data to Google Sheets

### Step 3: Verify Logs

Scraper logs location:
```bash
tail -f ~/Documents/Claude/Projects/PropEdge/logs/scraper-daemon.log
tail -f ~/Documents/Claude/Projects/PropEdge/logs/scraper-daemon-error.log
```

---

## Schedule

| Time | Sport | Action |
|------|-------|--------|
| **11:30 AM EST** | All (NBA/NHL/MLB) | Enrichment runs first, then scraper |
| **3:00 PM EST** | All | Enrichment run only |
| **5:30 PM EST** | All | Enrichment run, then scraper |

**Note**: Enrichment agents (if running separately) feed the CSVs that scraper v15 loads and merges.

---

## Monitoring

### Check if agent is running
```bash
launchctl list com.propedge.scraper
```

### Check next run time
```bash
ls -la ~/Documents/Claude/Projects/PropEdge/logs/
```

### Force an immediate test run
```bash
launchctl start com.propedge.scraper
```

Then check logs after ~30 seconds.

---

## Files Modified

1. ✅ `scraper-v15-integrated.js` — Created (root + propedge-deploy/)
2. ✅ `run-scraper-daemon.sh` — Updated to use v15
3. ✅ `com.propedge.scraper.plist` — Updated paths + schedule

---

## Note: v14 Deprecated

⚠️ **DO NOT use scraper-v14.js** — only `scraper-v15-integrated.js` is supported.
v14 is archived for reference only. All production runs must use v15.

---

## Next Steps

1. Run the setup step 1 commands above (copy plist + load agent)
2. Watch logs at the next scheduled time (11:30 AM or later today)
3. Verify Google Sheets has merged data (FD lines + enrichment columns)
4. If issues, check logs for player/prop matching problems

---

**Contact**: Ready to debug enrichment merge rates or FanDuel line access.
