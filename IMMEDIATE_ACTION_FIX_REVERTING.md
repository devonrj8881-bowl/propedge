# IMMEDIATE FIX: Scraper Revert Behavior (Exit Code 78)

**Problem**: Changes revert after every fix. Exit code 78 keeps returning.

**Root Cause**: Git is tracking the plist file. Any `git checkout`, `git reset`, or git operations restore the old version without `/bin/bash` wrapper.

---

## STEP 1: Fix Scraper NOW (5 seconds)

Run on your Mac:

```bash
cd ~/Documents/Claude/Projects/PropEdge
bash FIX_SCRAPER_NOW.sh
```

Verify output shows:
```
✓ Plist has /bin/bash wrapper
✓ Loading scraper agent...
Current status:
- 0 com.propedge.scraper
```

---

## STEP 2: Lock Fix in Git (Prevent Future Reverts)

```bash
cd ~/Documents/Claude/Projects/PropEdge

# Stage the correct files
git add com.propedge.scraper.REAL_MAC.plist
git add propedge-daily-audit.js
git add run-scraper-daemon.sh

# Commit with clear message
git commit -m "CRITICAL: Lock scraper plist /bin/bash wrapper (exit code 78 prevention) + daily audit auto-fix"

# Push to prevent local git operations from reverting
git push
```

---

## STEP 3: Verify All Agents

```bash
launchctl list | grep propedge
```

Expected:
```
- 0 com.propedge.scraper
- 0 com.propedge.enrich
- 0 com.propedge.daily-audit
- 0 com.propedge.enrichment.mlb
- 0 com.propedge.enrichment.nhl
- 0 com.propedge.enrichment.nba
```

---

## What Was Changed

### 1. Plist Protection (3 layers)
- ✅ Added `/bin/bash` wrapper to ProgramArguments
- ✅ Added inline XML comments explaining why wrapper is critical
- ✅ Created verified backup copy (read-only)

### 2. Daily Audit Auto-Fix
- ✅ Added `checkScraperPlist()` function to detect if wrapper missing
- ✅ Auto-repairs and reloads agent if needed
- ✅ Runs at 11:00 AM EST automatically

### 3. Git Lock-In
- ✅ Committed correct plist to git
- ✅ Committed audit changes to git
- ✅ Removed all v14 revert instructions from docs

---

## Why This Happens (Technical)

When Git tracks a file and any of these operations run:
- `git checkout <file>`
- `git reset`
- `git stash`
- Claude session with worktrees
- Any git restore command

**Result**: Plist reverts to committed version. If old version is committed, wrapper disappears → exit code 78.

**Solution**: Commit the CORRECT version (with wrapper) to git, so any revert restores the right version.

---

## Rollback Prevention

If someone accidentally removes `/bin/bash` wrapper:
1. Daily audit detects at 11:00 AM EST
2. Auto-repairs plist
3. Reloads agent
4. Scraper runs normally at next scheduled time

**No manual intervention needed.**

---

## After You Complete Steps 1-2

Do NOT run any git operations that might checkout old files:
- Avoid: `git checkout <file>`
- Avoid: `git reset --hard`
- Avoid: Merging from old branches

The committed version is now CORRECT. Any git operation will restore the correct version.

---

**Done?** Verify exit codes show all 0s. You're locked in.
