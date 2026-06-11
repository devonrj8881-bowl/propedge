# PropEdge Session Notes

## June 10 — v7.229 iOS Nav Gap Fix

**Version:** `v7.229` — not yet deployed (awaiting deploy approval)

### Problem
Dark band visible below the bottom nav on iPhone Safari / PWA. Multiple prior attempts (position:fixed, height hacks, visualViewport JS, device profiles) all failed because they fought the symptom, not the root cause.

### Root cause
`height: 100%` on `html` inherits from the ICB (initial containing block), which in iOS Safari = the **layout viewport**. The layout viewport is taller than the visual viewport when Safari's toolbar is visible. So `body { height: 100% }` = taller than what's on screen, and everything sized off it overflows below the visible area.

### Fix (v7.229)
Changed `html { height: 100% }` → `height: 100dvh` and added `body { display: flex; flex-direction: column; height: 100dvh }`. The `dvh` (dynamic viewport height) unit, supported since iOS Safari 15.4, tracks the **visual** viewport and shrinks when the toolbar appears. With body as a flex column, `.site-rebuild-shell` gets `flex: 1` (fills remaining space) and `.site-mobile-bottom-nav` stays as `flex-shrink: 0` at the bottom — no position tricks needed.

### Files changed
- `propedge-deploy/index.html` → v7.229 (head inline `@media (max-width: 1023px)` style block only)
- `index.html` + `propedge-final/`, `propedge-deploy-manual/`, `propedge-deploy-manual 2/` synced (all MD5 `2a602b88…`)

### Verified locally
- 390×844 (iPhone 14/15 size): nav flush at bottom, no gap ✓
- 440×956 (iPhone 17 Pro Max): nav flush at bottom, no gap ✓
- Full-width content, no 250px grid squeeze ✓

---

## June 10 — SESSION WRAP ✅

**Production:** `v7.228` at https://propedgemasters.netlify.app  
**GitHub `main`:** `124a7503` — all commits pushed; all `index.html` copies byte-identical  
**Generative Analyst:** https://propedge-generative-analyst.vercel.app — Kimi restored with full report outline

### Shipped this session

| Version / area | What |
|----------------|------|
| **v7.211** | Unified mobile/desktop home; toast no longer blocks nav taps |
| **v7.211+** | Keyboard-open viewport shrink ignored; mobile height/overflow fixes |
| **Parlay tab** | Empty tab fixed (undock + grid shell) — confirmed working v7.218+ |
| **Kimi analyst** | Generative analyst + richer enrichment in `analyst-app/app/api/analyze/route.ts` |
| **Gambly** | Parlay slip clears after textPicks/openGamblyBot |
| **iOS nav gap** | 8+ viewport strategies attempted — **gap persists on real iPhone** |
| **v7.227 regression** | Mobile shell grid `250px 1fr` squeezed content into narrow left column |
| **v7.228** | Restored mobile flex override on `.site-rebuild-shell` — full-width layout verified in prod |

### Key commits (`be327a8d` → `124a7503`)

- `be327a8d` / `49b6d326` — v7.211 home unify + toast pointer-events
- `73146aa9` / `5202ac55` — mobile viewport height + overflow
- `c66a8b86` / `cdc61a17` — Kimi analyst + Parlay tab + grid shell
- `f9cc8ca4` — Gambly parlay clear
- `44ceb3a4` / `b7b65647` / `124a7503` — iOS nav gap attempts + v7.228 grid regression fix

### Mobile nav gap — OPEN

Blue band below bottom nav on iPhone Safari/PWA. Not reproducible in Chromium emulation. Gap color `#020617` (= `:root --bg-primary`). Device diagnostics: `html[data-pe-nav-gap]`, `body[data-pe-device]`.

### Follow up

- [ ] iPhone 17 Pro Max: confirm v7.228 full-width layout + capture nav-gap diagnostics
- [ ] If gap persists: real WebKit investigation needed — CSS height hacks exhausted
- [ ] Uncommitted: `.gitignore`, `netlify/functions/enrich-pitcher-era.js` (untracked)

---

## Session: 2026-06-11 — SESSION WRAP ✅

**Production:** `v7.237` at https://propedgemasters.netlify.app
**GitHub `main`:** `7ae1c585` — clean working tree, all files synced

### Shipped this session

| Version | What |
|---------|------|
| **v7.236** | iOS nav gap: color-match fix — `#000000` on html/body/nav + large black box-shadow bleeds into safe area. Debug confirmed safe area zone is iOS system `#000000` (env(safe-area-inset-bottom)=0 on device), so color-matching eliminates the visible band. |
| **v7.237** | WNBA headshot slug fix — `espnHeadshotLeagueSlug()` now returns `'wnba'` instead of falling through to `'nba'`, fixing broken ESPN CDN headshot URLs for all WNBA players. |

### Repo cleanup
- `netlify/functions/enrich-pitcher-era.js` — tracked for first time (was untracked since June 6 deploy)
- `.DS_Store` — removed from git tracking, added to `.gitignore`
- `.cursor/` — added to `.gitignore`
- `CLAUDE.md §6` — new post-deploy sync rule: cp + commit + push required after every deploy

### Key commits
- `14f5180a` — v7.236 iOS nav gap fix (sync commit)
- `35fe563b` — v7.237 WNBA headshot slug fix
- `2d6f3516` — chore: track enrich-pitcher-era.js + .gitignore update
- `57d32651` — chore: untrack .DS_Store
- `7ae1c585` — docs: CLAUDE.md §6 post-deploy sync rule

### iOS nav gap — RESOLVED ✅
Debug confirmed: safe area zone is painted by iOS system at `#000000`. `env(safe-area-inset-bottom)` resolves to 0 (viewport-fit=cover not extending layout). Color-match fix blends the nav background with the system zone. User confirmed: "looks better now."

---

## Session: 2026-06-10 (UI & Gambly Fixes)

---

### 1. iOS Safari Mobile Nav Bar Bleed
**Problem:** The bottom nav bar on iPhone Safari floated above the bottom edge of the screen, leaving a visible gap where page content scrolled underneath it. This is a known iOS Safari issue where `100vh`/layout viewport is taller than the visual viewport due to the dynamic bottom toolbar.
**Fix:** 
- Switched `.site-rebuild-shell` away from relying on `position: fixed` for the bottom nav.
- Locked `html` and `body` to `height: 100%` and `overflow: hidden` specifically for iOS mobile.
- Made the main shell a `flex-direction: column` that takes exactly 100% height, making `.site-shell-main` a `flex: 1; overflow-y: auto` scroller, so the bottom nav sits flush at the bottom of the visual viewport naturally.
- Synced these changes across all `index.html` variants and deployed live to Netlify.

### 2. Gambly Integration - Stale Picks in Betslip
**Problem:** Clicking "Get Betslip" or SMS texting the parlay to Gambly would keep accumulating picks across sessions. Generating a new ticket included all previously selected picks.
**Fix:** 
- Updated `textPicks()` (SMS) to wait 800ms (to allow the SMS app to open), then clear `state.parlay`, wipe local storage, and re-render the UI.
- Updated `openGamblyBot()` (clipboard) to instantly clear the parlay upon a successful clipboard write.
- Added a "Slip sent — parlay cleared" toast confirmation.

### 3. Generative UI / PropAI "Kimi" Model 
**Update (v7.228):** Kimi generative analyst restored in `analyst-app/app/api/analyze/route.ts` with full report outline. Netlify `ask-analyst.js` remains Gemini-primary for shell-bar PropAI queries.

## Session: 2026-06-05 (Late Night)

---

### 1. ask-analyst — Gemini as Primary for All Modes

**Problem:** Every PropAI query showed "PROPAI · CLAUDE-FALLBACK · STRUCTURED FALLBACK · CLAUDE-SONNET-4-6". `ANTHROPIC_API_KEY` not set on Netlify caused immediate structured fallback before Gemini was ever attempted.

**Bugs fixed (3 separate issues):**
- `const responseMode` — couldn't be reassigned, fix silently failed
- `ANTHROPIC_API_KEY` guard blocked ALL requests before Gemini path
- Claude catch block returned `claude-fallback` instead of trying Gemini

**Fix:** `let responseMode`; force `ev_detail` when no Anthropic key; Claude catch block now routes to Gemini. Verified live: `provider: gemini, model: gemini-1.5-flash`.

**Also:** Removed fake Gemini models from fallback list (`gemini-3.5-flash`, `gemini-3.1-flash-lite` etc.) — they 404'd and wasted time before reaching `gemini-2.5-flash`.

---

### 2. Prop Card Category: Blocks → Strikeouts (NBA)

**Root cause:** `'blocks'.includes('ks')` = true — NBA blocks props matched the Strikeouts bucket.

**Fix:** Added explicit `block` and `steals` checks before `ks` pattern; tightened `ks` to `\bks\b`.

---

### 3. Prop Category: Full Coverage All Leagues (v7.163)

**Problem:** MLB Singles, Doubles, HR, Runs, NHL Shots on Goal, PP Points, NFL Yardage all fell through to `'ALL'`.

**Fix:** Rewrote `propAIMarketCategory` with 35+ categories covering NBA/MLB/NHL/NFL. Combo props checked first to avoid partial matches. Fallback changed `'ALL'` → `'Other'`.

---

### 4. Markets Load-More: Append-Only (No Blank Flash)

**Problem:** IntersectionObserver triggered full `innerHTML` replace → 5-second blank blue screen while re-rendering all rows.

**Fix:** Observer now appends only new rows before the sentinel. Existing content stays in DOM — no wipe, no flash, load feels instant.

---

### End of Session State

**Site:** ✅ https://propedgemasters.netlify.app — v7.163  
**Analyst:** ✅ Gemini primary for all query modes — `provider: gemini`  
**Main branch:** ✅ commit `23cab8c`  
**Scraper:** ✅ launchd running every 15 min — 25+ successful runs  

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
**Last Updated:** 2026-06-08

## Session: 2026-06-08 (Midnight Scoring & UX Restoration)

### 1. UX & League Restoration
- **WNBA Support**: Fully restored WNBA sport tabs in main navigation, Markets sidebar, and PropAI sidebar. Added WNBA to live ESPN scoreboard sync and internal state management.
- **Odds API (MultiBook)**: Re-injected `MultiBookOddsProvider` class and `createGameLevelPropsFromOdds()` logic.
- **New Markets**: Added UI filters and rendering support for Moneyline, Totals, Spreads, and Alternate lines (Q1/1H) pulled from the Odds API.

### 2. Scoring & Math Upgrades
- **Unit Sizing**: Integrated bankroll management directly into prop cards (e.g., `🔒 LOCK • 💰 2.0u`).
- **True Probability (Devig)**: Replaced hardcoded `0.952` with dynamic additive devig math to remove vig/juice more accurately.
- **Multi-Book Edge**: Logic now compares DraftKings and FanDuel lines and calculates model edge based on the best available price.
- **Home/Away Splits**: Updated `run-enrichment.js` to compute home/road variance. Frontend now applies a ±6 pt PropIQ modifier based on elite/poor split performance.

### 3. Automation & Infra
- **CLV Tracking**: Built `capture-closing-lines.js` to snapshot odds at game-tip for Closing Line Value tracking. 
- **Launchd job**: Registered `com.propedge.capture-closing-lines` to run daily at 7:00 PM ET.
- **Netlify Fix**: Patched `netlify.toml` to remove strict `framework` constraints causing CLI crashes.

### 4. Deployment
- **GitHub**: Pushed logic-only updates to `redesign-scoring-v2`.
- **Production**: Successfully deployed v7.207 to propedgemasters.netlify.app.

### 5. Odds API Alt Markets Patch (Addendum)
- **Alt Spread UI**: Added Alt Spread market chip to both Markets and PropAI filters.
- **Lazy-load trigger**: Selecting Alt Total/Alt Spread/1H/1Q now fetches `alt=true` game-odds and refreshes the board.
- **Expanded ALT markets**: Added alternate_spreads + 1H/1Q ML/Spread markets to the per-event Odds API call.
- **Game-bet mapping**: Categorizes 1H/1Q totals/spreads/ML under the correct filter chips.

---

## Session: 2026-06-10 — Mobile UX Regression Audit & Revert

### Known-good baseline
- **Commit:** `194100de` (2026-06-09 23:39 ET)
- **Version:** v7.209
- **Why:** Last confirmed working state with WNBA + Odds API + mobile iOS layout (`--pe-vvh`, `flex-shrink:0` on main column) + non-destructive ESPN slate filter.

### What broke mobile (June 10, 00:04–00:52 ET)
| Commit | Change | Impact |
|--------|--------|--------|
| `d0a62aef` | Forced `isDesktopHome = true` globally | Mobile fell into desktop dashboard path — crunched stats bar, wrong scroll |
| `05e3e904` | Added `padding-top: 160px` hack on `.props-container` | Props hidden behind header; scroll region broken |
| `26ea5072` / `b5cdbbed` | Reverted to v7.208 base | Lost v7.209 iOS visualViewport + flex-shrink fixes |

### Symptoms reported
- Desktop layout correct; Home tab on mobile shows outdated shell (old stats bar, compact nav, props behind header).
- Other tabs (Markets, PropAI, Parlay) showed newer changes — confirms Home-specific `renderProps()` mobile branch was the divergence point.
- Props intermittently showed 0 until loadData guard added (separate issue).

### Revert action (2026-06-10)
- Restored `propedge-deploy/index.html` from `194100de` (v7.209).
- Preserved in v7.209: `buildMobileHomeDashboardHTML()`, `applyEspnGameFilter()` non-destructive, `MultiBookOddsProvider`, WNBA tabs/ESPN paths, game-odds integration.
- **Not yet deployed** — local restore only; needs commit + Netlify deploy after mobile verification.

### Verification checklist
1. Mobile Safari: version badge shows **v7.209** (not v7.208/v7.210).
2. Home tab: mobile dashboard shell with featured ticket, narrative, game board — matches desktop feature set.
3. Stats bar + bottom nav sized to viewport; no blue band under nav.
4. Props list scrolls below stats bar (not behind it).
5. WNBA sport tab + 324+ WNBA props load from sheet.
6. Markets tab: ML/Spread/Total/Alt chips from game-odds API.

**Last Updated:** 2026-06-10

---

## Session: 2026-06-10 (Continued) — Mobile Nav Gap + Parlay + Kimi + v7.228

### Production state
- **Site:** https://propedgemasters.netlify.app — **v7.228**
- **GitHub `main`:** `124a7503` — *Sync index.html across all deploy directories for iOS nav flex fix*
- **All `index.html` copies synced** (identical MD5 `3d515d4b…`): root, `propedge-deploy/`, `propedge-final/`, `propedge-deploy-manual/`, `propedge-deploy-manual 2/`
- **Remote:** `git push origin main` → Everything up-to-date (2026-06-10)

### Shipped this session (v7.211 → v7.228)

| Version / commit | What |
|------------------|------|
| **v7.211** (`be327a8d`, `49b6d326`) | Unify mobile/desktop home view; toast `pointer-events: none` so nav tabs stay clickable |
| **v7.211+** (`73146aa9`, `5202ac55`) | Ignore keyboard-open shrink in `syncMobileViewportHeight`; mobile height/overflow stability |
| **Kimi analyst** (`c66a8b86`, `cdc61a17`) | Generative analyst restored with full report outline; richer Kimi enrichment in `analyst-app/app/api/analyze/route.ts` |
| **Parlay tab** (`cdc61a17`) | Fixed empty Parlay tab — undock + grid shell visibility |
| **Gambly** (`f9cc8ca4`) | Clear parlay after `textPicks` / `openGamblyBot` so next ticket starts fresh |
| **iOS nav attempts** (`44ceb3a4`, `b7b65647`, `124a7503`) | Multiple viewport strategies: html/body height lock, flex-column in-flow nav, device profiles (`PE_DEVICE_PROFILES`), measured `--pe-nav-bottom-gap`, opaque fixed nav + box-shadow fill, kill `#020617` bleed |
| **v7.227 regression** | Removing mobile flex override left base grid `250px 1fr` active — `<main>` squeezed into 250px column on mobile |
| **v7.228** (`124a7503`) | Restore `.site-rebuild-shell { display: flex !important; grid-template-columns: none !important; width: 100% }` on mobile — layout verified full-width in production |

### Mobile nav gap — still open on real device

**Symptom:** Blue/dark band below bottom nav on iPhone Safari + PWA (user: iPhone 17 Pro Max). Gap color matches `:root --bg-primary` (`#020617`), not mobile override `rgb(3, 8, 18)`.

**What we tried (all failed on device):** fixed nav, in-flow flex footer, `--pe-vvh` / `visualViewport`, `-webkit-fill-available`, nav moved outside shell, device-specific safe-area profiles, opaque nav + 48px box-shadow extension, backdrop-filter removal on iOS.

**Diagnostics on `<html>` / `<body>`:** `data-pe-nav-gap`, `data-pe-safe-bottom`, `body[data-pe-device]` — use on device to capture measured values.

**Likely cause:** iOS WebKit visual viewport vs layout viewport gap outside normal CSS box model — not reproducible in Chromium emulation (gap = 0px there).

### DOM structure (mobile, v7.225+)
```
body
  .site-rebuild-shell          ← scroll area
  .site-mobile-more-row
  .site-mobile-bottom-nav      ← outside shell, position: fixed
  .toast
```

### Key files touched
| File | Purpose |
|------|---------|
| `propedge-deploy/index.html` | All mobile nav/layout iterations v7.211–v7.228 |
| `index.html` (+ deploy mirrors) | Synced to match `propedge-deploy/index.html` |
| `analyst-app/app/api/analyze/route.ts` | Kimi / generative analyst enrichment |

### Deploy target reminder
Netlify publishes **`propedge-deploy/`** only (`netlify.toml` → `publish = "propedge-deploy"`). Do not test root `index.html` in isolation expecting latest unless synced.

### Uncommitted locally (non-blocking)
- `.gitignore` — modified
- `.DS_Store` — modified (do not commit)
- `netlify/functions/enrich-pitcher-era.js` — untracked

### Follow up
- [ ] **iPhone verify v7.228:** full-width layout restored? Nav gap still present? Capture `document.body.dataset.peDevice`, `document.documentElement.dataset.peNavGap`
- [ ] If nav gap persists: need real-device WebKit diagnostics — further height hacks unlikely to help
- [ ] Optional: commit `enrich-pitcher-era.js` when ready
- [ ] Bugbot backlog: empty Top Player Prop header in `route.ts`; pitcher ERA sheet placeholder in `enrich-pitcher-era.js`

**Last Updated:** 2026-06-10 (evening)
