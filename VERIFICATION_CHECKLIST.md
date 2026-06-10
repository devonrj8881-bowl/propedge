# PropEdge Installation Verification Checklist

## Quick Verification (5 minutes)

```bash
cd /Users/devonjohnson/Documents/Claude/Projects/PropEdge
chmod +x verify-installation.sh
./verify-installation.sh
```

This runs **automated checks** for all components. Expected output: `✓ ALL CHECKS PASSED`

---

## Manual Verification (Detailed Steps)

Run each check in order. All should pass before moving to next.

### ✅ CHECK 1: HTML Patches (Patch Verification)

**What:** Verify all 7 patches are in the HTML file

**Commands:**
```bash
# Patch 1: CSV columns
grep "const perMinAvg = parseFloat(getValue(cols.per_min_avg))" propedge-deploy/index.html && echo "✓ Patch 1" || echo "✗ Patch 1"

# Patch 2: Per-min efficiency
grep "if (perMinAvg > 0 && confidenceScore >= 40)" propedge-deploy/index.html && echo "✓ Patch 2" || echo "✗ Patch 2"

# Patch 3: Matchup multiplier
grep "const matchupDifficultyMultiplier = 0.8 + (matchupScalar" propedge-deploy/index.html && echo "✓ Patch 3" || echo "✗ Patch 3"

# Patch 4: Confidence dampening
grep "if (confidenceScore < 40)" propedge-deploy/index.html && echo "✓ Patch 4" || echo "✗ Patch 4"

# Patch 5: Tier confidence
grep "const meetsUltimate = (confidenceScore >= 75)" propedge-deploy/index.html && echo "✓ Patch 5" || echo "✗ Patch 5"

# Patch 6: Prop object fields
grep "perMinAvg," propedge-deploy/index.html && echo "✓ Patch 6" || echo "✗ Patch 6"

# Patch 7: Version update
grep "PropIQ™ v6.0" propedge-deploy/index.html && echo "✓ Patch 7" || echo "✗ Patch 7"
```

**Expected:** 7 ✓ checks

**If any fail:** Re-apply that specific patch from `PROPEDGE_PATCHES.md`

---

### ✅ CHECK 2: Enrichment Script Exists

**What:** Verify run-enrichment.js is present and executable

**Commands:**
```bash
# File exists
ls -la run-enrichment.js

# Is executable
[ -x run-enrichment.js ] && echo "✓ Executable" || echo "✗ Not executable - run: chmod +x run-enrichment.js"

# Has key functions
grep "async function fetchInjuries\|function calculateMetrics\|async function fetchMatchupRanks" run-enrichment.js | wc -l
# Should output 3
```

**Expected:** File exists, is executable, has 3+ key functions

---

### ✅ CHECK 3: Launchd Agents Installed

**What:** Verify cron jobs are set up

**Commands:**
```bash
# Check if agents exist
ls -la ~/Library/LaunchAgents/com.propedge.enrichment.*.plist

# Check if loaded
launchctl list | grep propedge

# Detailed status
launchctl list com.propedge.enrichment.nba
launchctl list com.propedge.enrichment.nhl
launchctl list com.propedge.enrichment.mlb
```

**Expected Output:**
```
com.propedge.enrichment.nba
com.propedge.enrichment.nhl
com.propedge.enrichment.mlb
```

**If agents not loaded:**
```bash
launchctl load ~/Library/LaunchAgents/com.propedge.enrichment.*.plist
```

---

### ✅ CHECK 4: Test Enrichment Manually

**What:** Run enrichment to verify data pipeline works

**Commands:**
```bash
cd /Users/devonjohnson/Documents/Claude/Projects/PropEdge

# Create logs directory
mkdir -p logs

# Run NBA enrichment
node run-enrichment.js NBA

# Watch the output
# Expected:
#   [timestamp] Step 1/4: Fetching injuries...
#   [timestamp] ✓ Found X injured players
#   [timestamp] Step 2/4: Fetching matchup ranks...
#   [timestamp] ✓ Matchup data loaded
#   ...
#   [timestamp] ✓ Enrichment complete
```

**Expected:** Script completes without errors

**If errors occur:**
- Check Node.js version: `node --version` (need 14+)
- Check network: `ping stats.nba.com`
- Check logs: `cat logs/enrichment-nba.log`

---

### ✅ CHECK 5: Enriched CSV Output

**What:** Verify enrichment created output file with correct structure

**Commands:**
```bash
# List enriched files
ls -lh propedge-enriched/

# Check file has data
head -5 propedge-enriched/propedge-enriched-NBA-*.csv

# Count rows and columns
wc -l propedge-enriched/propedge-enriched-NBA-*.csv
head -1 propedge-enriched/propedge-enriched-NBA-*.csv | tr ',' '\n' | wc -l
```

**Expected Output:**
```
propedge-enriched-NBA-2026-04-27.csv

# File should have:
# - Header row with columns: Player, Sport, PropType, ..., Per_Min_Avg, Per_Min_L5, Per_Min_L10, Confidence%, Matchup_Rank, ...
# - Multiple data rows
# - 15+ columns total
```

**If no output:**
- Check directory created: `mkdir -p propedge-enriched`
- Re-run enrichment with verbose output

---

### ✅ CHECK 6: Browser Console Test

**What:** Verify PropEdge loads patches correctly and handles new columns

**Steps:**

1. **Open PropEdge in browser**
   ```
   file:///Users/devonjohnson/Documents/Claude/Projects/PropEdge/propedge-deploy/index.html
   ```

2. **Open Developer Console**
   ```
   Press: Cmd+Option+I (macOS)
   ```

3. **Check for errors**
   - Should be NO RED errors in console
   - Some warnings OK

4. **Look for success messages**
   ```
   [PropEdge] Version detected
   [PropEdge] CSV parsed successfully
   [PropEdge] Props loaded: X
   ```

5. **Inspect PropIQ display**
   - PropIQ scores visible on prop cards
   - Version should say "v6.0"
   - Check a card's details for "Confidence%" field

6. **Console test (paste in console):**
   ```javascript
   // Check if enriched metrics exist
   console.log(state.props[0].confidence);
   console.log(state.props[0].perMinAvg);
   console.log(state.props[0].matchupRank);
   // Should output values (not undefined)
   ```

**Expected:** No errors, metrics visible, v6.0 displayed

---

### ✅ CHECK 7: Cron Job Execution

**What:** Verify jobs will run at scheduled times

**Commands:**

```bash
# Check next run times
launchctl list com.propedge.enrichment.nba

# Manually trigger to test (optional)
launchctl start com.propedge.enrichment.nba

# Wait 10 seconds, then check logs
sleep 10
tail logs/enrichment-nba.log

# Check if output created
ls -lht propedge-enriched/ | head -1
```

**Expected:** 
- Logs show successful run
- New CSV file created with today's timestamp
- `launchctl list` shows healthy status

---

## Complete Verification Suite (All Checks)

**Run this command for full automated verification:**

```bash
./verify-installation.sh
```

**This checks:**
1. ✓ All 7 HTML patches present
2. ✓ Enrichment script exists and is executable
3. ✓ Launchd agents installed and loaded
4. ✓ Enrichment output directory exists
5. ✓ CSV files created
6. ✓ Optional: Manual enrichment test

**Output should be:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERIFICATION SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Results:
  ✓ Passed:   X / Y
  ✗ Failed:   0
  ⚠ Warnings: 0

✓ ALL CHECKS PASSED
```

---

## Troubleshooting Failed Checks

### Patch Check Failed

**Problem:** `✗ Patch X: [description] NOT found`

**Solution:**
1. Re-read the patch instructions from `PROPEDGE_PATCHES.md`
2. Manually verify the code is in `propedge-deploy/index.html`
3. Re-apply the patch using the Edit tool

**Example:**
```bash
# Search for a patch
grep "const perMinAvg" propedge-deploy/index.html

# If not found, manually apply it again
```

---

### Enrichment Script Failed

**Problem:** `✗ run-enrichment.js NOT found` or not executable

**Solution:**
```bash
# Make executable
chmod +x /Users/devonjohnson/Documents/Claude/Projects/PropEdge/run-enrichment.js

# Test it runs
node run-enrichment.js NBA
```

---

### Launchd Agent Failed

**Problem:** `✗ NBA launchd agent NOT installed`

**Solution:**
```bash
cd /Users/devonjohnson/Documents/Claude/Projects/PropEdge
chmod +x setup-cron-jobs.sh
./setup-cron-jobs.sh launchd
```

---

### Enrichment Test Failed

**Problem:** `✗ Enrichment test FAILED`

**Solution:**
1. Check Node.js: `node --version` (need 14+)
2. Check network: `ping stats.nba.com`
3. Check logs: `cat logs/enrichment-nba-stderr.log`
4. Try manually: `cd propedge && node run-enrichment.js NBA`

---

### Browser Console Errors

**Problem:** Console shows errors or undefined metrics

**Solution:**
1. Clear browser cache: Cmd+Shift+Delete
2. Reload page: Cmd+R
3. Check patches were applied: `grep "const perMinAvg" propedge-deploy/index.html`
4. Verify enriched CSV is in `propedge-enriched/`

---

## Health Check Commands (Daily)

Use these to verify everything is running smoothly:

```bash
# Check agents are loaded
launchctl list | grep propedge

# Check today's enrichment ran
ls -lt /Users/devonjohnson/Documents/Claude/Projects/PropEdge/propedge-enriched/ | head -1

# Check logs for errors
grep -i "error\|failed" /Users/devonjohnson/Documents/Claude/Projects/PropEdge/logs/enrichment-*.log | tail -5

# Quick manual test
node /Users/devonjohnson/Documents/Claude/Projects/PropEdge/run-enrichment.js NBA 2>&1 | tail -5
```

---

## Expected State (Post-Verification)

After all checks pass:

✅ HTML file has 7 patches applied  
✅ Enrichment script is executable  
✅ 3 launchd agents installed and loaded  
✅ Manual enrichment test succeeded  
✅ CSV output files created  
✅ PropEdge browser shows v6.0 with confidence metrics  
✅ Browser console has no errors  
✅ Cron jobs ready to run automatically  

**System is READY for production.**

---

## Timeline to Full Deployment

| Step | Time | Status |
|------|------|--------|
| Patches applied | Now | ✓ |
| Enrichment test passed | 5 min | ✓ |
| Cron agents loaded | 2 min | ✓ |
| Browser verification | 2 min | ✓ |
| **Total time** | **~10 min** | ✓ |

Then: Automatic enrichment runs 3× daily indefinitely.
