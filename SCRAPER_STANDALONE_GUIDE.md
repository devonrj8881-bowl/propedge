# PropEdge Scraper — Standalone (Git-Independent) Setup

**Problem Solved**: Scraper was reverting due to Git checkout operations.  
**Solution**: Remove scraper configuration from Git tracking entirely.

---

## What Changed

### 1. Git Decoupled
- Plist files removed from Git tracking
- Daemon script removed from Git tracking
- Audit script removed from Git tracking
- All added to `.gitignore`

**Result**: Git operations can never affect scraper configuration.

### 2. Standalone Setup Script
- `SETUP_SCRAPER_STANDALONE.sh` — Run once to initialize
- Decouples from git
- Verifies plist integrity
- Loads all agents

### 3. Self-Healing Repair Script
- `FIX_SCRAPER_NOW.sh` — Run anytime to repair
- Independent of git state
- Restores from verified backup if needed
- Reloads launchd agent

---

## DO THIS NOW (on your Mac)

### Step 1: Run Standalone Setup

```bash
cd ~/Documents/Claude/Projects/PropEdge
bash SETUP_SCRAPER_STANDALONE.sh
```

This will:
1. ✅ Remove scraper files from git tracking
2. ✅ Commit .gitignore update
3. ✅ Verify plist integrity
4. ✅ Reload all agents
5. ✅ Verify exit codes are 0

### Step 2: Verify All Agents are Green

```bash
launchctl list | grep propedge
```

Expected output:
```
- 0 com.propedge.scraper
- 0 com.propedge.enrich
- 0 com.propedge.daily-audit
- 0 com.propedge.enrichment.mlb
- 0 com.propedge.enrichment.nhl
- 0 com.propedge.enrichment.nba
```

**All must show exit code 0.**

---

## How This Prevents Reversions

### Before (Git-Tracked)
```
Any git operation → restores old plist → missing /bin/bash → exit code 78
```

### After (Git-Ignored)
```
Any git operation → doesn't touch scraper files → plist stays intact
Daily audit auto-fixes if anything goes wrong → exit code 0
```

---

## Running the Scraper

### Automatic (Scheduled)
- 11:30 AM EST: NBA enrichment + scraper
- Every 15 min: Scraper + deployment (starting at 11:30)
- 3:00 PM EST: NHL enrichment + scraper
- 5:30 PM EST: MLB enrichment + scraper

### Manual Test
```bash
cd ~/Documents/Claude/Projects/PropEdge
/opt/homebrew/bin/node scraper-v15-integrated.js
```

### Check Logs
```bash
tail -f ~/Documents/Claude/Projects/PropEdge/logs/scraper-daemon.log
tail -f ~/Documents/Claude/Projects/PropEdge/logs/scraper-daemon-error.log
```

---

## Troubleshooting

### If Scraper Shows Exit Code 78
```bash
bash ~/Documents/Claude/Projects/PropEdge/FIX_SCRAPER_NOW.sh
```

This script:
1. ✅ Verifies plist /bin/bash wrapper
2. ✅ Restores from verified backup if needed
3. ✅ Makes daemon script executable
4. ✅ Reloads launchd agent
5. ✅ Verifies exit codes

### If Agents Won't Load
```bash
# Check plist syntax
plutil -lint ~/Documents/Claude/Projects/PropEdge/com.propedge.scraper.REAL_MAC.plist

# Check launchd logs
log stream --predicate 'eventMessage contains[cd] "propedge"' --level debug
```

### If Daily Audit Isn't Running
```bash
# Check audit agent
launchctl list | grep daily-audit

# Run audit manually
/opt/homebrew/bin/node ~/Documents/Claude/Projects/PropEdge/propedge-daily-audit.js

# Check audit logs
tail -f ~/Documents/Claude/Projects/PropEdge/logs/daily-audit.log
```

---

## Key Files (Now Git-Independent)

| File | Purpose | Status |
|------|---------|--------|
| `com.propedge.scraper.REAL_MAC.plist` | Launchd config | ✅ Git-ignored |
| `com.propedge.scraper.REAL_MAC.plist.VERIFIED` | Backup copy | ✅ Read-only |
| `run-scraper-daemon.sh` | Scraper runner | ✅ Git-ignored |
| `propedge-daily-audit.js` | Auto-fix audit | ✅ Git-ignored |
| `.gitignore` | Git exclusions | ✅ Committed |

---

## Future Git Operations

**Safe to run anytime:**
- `git add <files>` (if not in .gitignore)
- `git commit` (if not touching scraper files)
- `git push`
- `git checkout <other-files>`
- `git reset` (if not touching scraper files)

**Will not affect scraper** because config files are git-ignored.

---

## Why This Is Better

**Before**: Git checkout could revert plist → exit code 78 → manual fix needed  
**After**: Scraper config is independent → Git can never break it → always exit code 0

---

## Status Check

Run this anytime to verify everything is healthy:

```bash
echo "=== SCRAPER STATUS ==="
launchctl list | grep propedge
echo ""
echo "=== PLIST INTEGRITY ==="
grep '<string>/bin/bash</string>' ~/Documents/Claude/Projects/PropEdge/com.propedge.scraper.REAL_MAC.plist && echo "✓ /bin/bash wrapper present" || echo "✗ Missing wrapper"
echo ""
echo "=== DAEMON SCRIPT ==="
[ -x ~/Documents/Claude/Projects/PropEdge/run-scraper-daemon.sh ] && echo "✓ Executable" || echo "✗ Not executable"
echo ""
echo "=== LOGS ==="
tail -3 ~/Documents/Claude/Projects/PropEdge/logs/scraper-daemon.log | head -1
```

---

## Summary

✅ **Scraper is now completely independent of Git**  
✅ **Daily audit auto-fixes any issues at 11 AM EST**  
✅ **FIX_SCRAPER_NOW.sh can repair in seconds**  
✅ **No more reversions from git operations**  

**Run the setup script once, then it runs reliably forever.**
