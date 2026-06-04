# PropEdge Session Notes

## Session: 2026-06-03

---

### 7. Generative Analyst — googleapis Bundle Fix

**Problem:** Vercel analyst showing "Invalid prop feed response" — prop-feed Netlify function crashing with `Cannot find module 'googleapis'` before returning any data.

**Root cause:** `netlify.toml` had `external_node_modules = ["googleapis", "@anthropic-ai/sdk"]` telling esbuild to skip bundling them. With `--no-build` deploys, Netlify's Lambda runtime doesn't have these packages pre-installed — function crashed on import.

**Fix:** Removed `external_node_modules` from `netlify.toml` — esbuild now bundles both packages inline. Verified: `prop-feed?sheet=propedge-main` returns proper CSV headers. Analyst working.

---

### End of Session State

**Scraper:** ✅ launchd firing every 15 min — 25 successful runs today, last exit 0 at 11:12 PM  
**Daily audit:** ✅ launchd firing at 9am/12pm/3pm/6pm/9pm  
**Site:** ✅ https://propedgemasters.netlify.app — v7.160  
**Analyst:** ✅ https://propedge-generative-analyst.vercel.app — working  
**Main branch:** ✅ commit `5c7deaf` — all changes pushed

---

### 5. NBA Props Not Showing on Site — ESPN Abbreviation Mismatch

**Problem:** Clicking NBA game in ticker showed zero props despite 1,273 NBA rows in sheet.

**Root cause:** `applyLocalGameStatusFilter` built the active-teams set using raw ESPN abbreviations (`SA`, `NY`). Props from PropFinder use full abbreviations (`SAS`, `NYK`). No alias lookup → every NBA prop silently removed from `state.props` before any other filter ran.

**Fix:** `propedge-deploy/index.html` — `applyLocalGameStatusFilter`: swapped `normalizeT` → `normalizeTeam` in both the set-building step and the prop-check step. `normalizeTeam` uses the alias table so `SA`→`SAS`, `NY`→`NYK` resolve correctly.

**Version:** v7.157 → v7.158  
**Deployed:** ✅ https://propedgemasters.netlify.app

---

### 6. prop-feed.js — API Key Fallback + meta Tab Rename

**Changes (user-authored):**
- Added `fetchViaApiKey` as fallback between Sheets API and gviz
- Added `GOOGLE_CREDENTIALS_JSON` env var support for Netlify-hosted credentials
- Renamed `_meta` → `meta` in `ALLOWED_SHEETS` and `API_SHEETS`
- `meta` sheet now falls through API key → gviz instead of only authenticated API

---

### 4. Scraper Scheduler — launchd TCC Fix (Permanent)

**Problem:** Scraper never ran automatically via launchd — always required manual execution.

**Root cause:** macOS TCC (Privacy & Security) blocks launchd-spawned processes from accessing `~/Documents/`. The project lives in `~/Documents/Claude/Projects/PropEdge/`, so launchd silently failed with exit code 78 (EX_CONFIG) before bash could read a single line of the script. The `StandardOutPath` was also inside `~/Documents/logs/` which launchd couldn't open either.

**Secondary bug:** The old plist used `-lc` (login shell) + `exec bash scraper-launcher.sh` which caused additional failures in launchd's restricted environment.

**Fix applied:**

| Change | Before | After |
|--------|--------|-------|
| `ProgramArguments` | `/bin/bash -lc "cd ... && exec bash scraper-launcher.sh"` | `/bin/bash /absolute/path/scraper-launcher.sh` |
| `WorkingDirectory` | missing | `/Users/devonjohnson/Documents/Claude/Projects/PropEdge` |
| `StandardOutPath` | `~/Documents/.../logs/scraper-daemon.log` | `~/Library/Logs/PropEdge/scraper-out.log` |
| `StandardErrorPath` | `~/Documents/.../logs/scraper-daemon-error.log` | `~/Library/Logs/PropEdge/scraper-error.log` |
| `PATH` env var | missing | `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin` |

**Manual step required (one-time):**
System Settings → Privacy & Security → Full Disk Access → `+` → `/bin/bash`
This grants launchd-spawned bash processes access to `~/Documents/`.

**Verified:** `last exit code = 0`, `state = not running` (completed cleanly). First ever successful launchd run.

**Log locations:**
- Run-level logs: `~/Documents/Claude/Projects/PropEdge/logs/scraper-launcher-TIMESTAMP.log`
- launchd stdout: `~/Library/Logs/PropEdge/scraper-out.log`
- launchd stderr: `~/Library/Logs/PropEdge/scraper-error.log`

---

### 1. iPad Mini Layout Fix
**Problem:** PropRI and Confidence score circles stacking vertically on iPad mini.
**Fix:** Added `@media (min-width: 600px)` forcing `display: flex; flex-direction: row; flex-wrap: nowrap`.
**File:** `propedge-deploy/index.html`

---

### 2. Stale Data Banner
**Problem:** Banner never showed when scraper hadn't run or meta was missing.
**Fix:**
- Show banner when `meta` or `last_scraped` is null
- Show banner when `fetchScrapeMeta` fetch fails entirely
- Updated messages to user-friendly language (no "scraper" references)
- Banner messages:
  - No data: "Props have not been updated yet — updates run every 15 minutes."
  - Stale: "Props were last updated Xh ago — data may be outdated. Refresh to try again."

---

### 3. Scraper Scheduler — Full Overhaul
**Problem:** Scraper not running automatically. Multiple broken files with old session paths.

**Root causes found and fixed:**

| File | Problem | Fix |
|------|---------|-----|
| `com.propedge.scraper.plist` | Old session path, missing `/opt/homebrew/bin`, `RunAtLoad: true`, ran only 2x/day | Correct paths, full PATH, `RunAtLoad: false`, `StartInterval: 900` (every 15 min), points to `scraper-launcher.sh` |
| `run-scraper-daemon.sh` | Pointing to `scraper-v13.js` | Updated to `scraper-v15-integrated.js` |
| `SETUP_SCHEDULER.sh` | All paths pointed to old session dir, used `load` instead of `bootstrap` | All paths fixed, uses `bootstrap` |
| `check-scraper-ready.sh` | Checked for `scraper-v13.js` | Updated to `scraper-v15-integrated.js` |
| `RUN_SCRAPER.sh` | Ran `scraper-v13.js` directly | Now runs `scraper-launcher.sh` (with retries) |
| `scraper-launcher.sh` | `scraper-status.json` only written in non-gtimeout path | Fixed to write status file in both paths |

**Orphaned jobs removed:**
- `com.propedge.outcomes-sync` — referenced a script that didn't exist anywhere, removed from LaunchAgents

---

### 4. Final Scheduler State
```
com.propedge.scraper      → 0  ✅  Runs every 15 minutes
com.propedge.daily-audit  → 0  ✅  Watchdog checks at 9am/12pm/3pm/6pm/9pm
com.propedge.outcomes-sync       ✅  Removed (orphaned)
```

---

### Deployment
- ✅ All changes committed and pushed to `main`
- ✅ GitHub Actions → Netlify auto-deployed
- ✅ Live at `https://propedgemasters.netlify.app`

---
**Last Updated:** 2026-06-03
