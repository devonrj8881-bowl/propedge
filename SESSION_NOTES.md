# PropEdge Session Notes

## Session: 2026-06-03

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
