# PropEdge Sprint April 4, 2026 — Execution Report

**Date:** April 4, 2026 (Saturday 12:30 PM EST)
**Status:** ⚠️ FEASIBILITY ASSESSMENT COMPLETE — EXECUTION CONSTRAINTS IDENTIFIED

---

## 🎯 Sprint Objectives (4 Priorities)

### ✅ PRIORITY #1: Sportsbook Integration (DraftKings/FanDuel) — FEASIBLE (70%)
**Status:** BLOCKED on Auth / Partially Implementable via Deep Links

**Current State:**
- ✅ FanDuel button framework exists (`openFanDuelDirect()` at line 14589)
- ✅ Pace Trends cards exist with player data
- ❌ DraftKings API requires OAuth (no public unauthenticated API)
- ⚠️ FanDuel lacks public API for bet slip pre-fill (must use deep links)

**What CAN be done today (2-3 hours):**
- Add "Bet on DK" button to each Pace card (opens DraftKings sportsbook homepage only)
- Add "Bet on FD" button leveraging existing FanDuel integration
- Create tracking layer: log clicked player props to localStorage for ROI tracking
- Track: player name, league, sport, timestamp, prop type (pace-based)

**What CANNOT be done:**
- Pre-filled bet slips on DraftKings (would require OAuth with live DK credentials)
- Pre-filled odds from live DK/FD API (DK API is not public; FD requires auth)
- Auto-population of player name/sport to bet slip (DK doesn't expose this endpoint)

**Recommendation:** Implement "1-click navigation" (user clicks → goes to sportsbook) + passive ROI tracker. **Not** true bet-slip pre-fill without OAuth.

---

### ⚠️ PRIORITY #2: Live Injury Updates + Odd Movements — PARTIAL (40%)
**Status:** BLOCKED on Real-Time Data Source

**Current State:**
- ✅ ESPN API integration exists for game schedules
- ✅ Player injury status embedded in pace data (30 players)
- ❌ Real-time odds API unavailable (DraftKings not public, FanDuel requires auth)
- ❌ No live injury webhook/API (ESPN injury data is stale, 1-2 hr delay)

**What CAN be done today (1-2 hours):**
- Display static injury status on each card (ACTIVE | DOUBTFUL | RULED OUT) from embedded data
- Add visual badge alert if status differs from game slate refresh
- Store odds snapshots hourly → compare to yesterday's snapshot
- Calculate +/- EV manually from stored data (no live API call)
- Refresh UI every 30-60 seconds (client-side only)

**What CANNOT be done:**
- Real-time odds from DraftKings/FanDuel APIs
- Live injury updates (ESPN data has 1-2 hr lag)
- Current odds comparison (need historical snapshot baseline first)

**Recommendation:** Build static injury badge + historical odds delta. Deploy snapshot scheduler tomorrow to capture baseline.

---

### ✅ PRIORITY #3: Push Notifications via OneSignal — FULLY FEASIBLE (95%)
**Status:** READY TO IMPLEMENT

**Current State:**
- ✅ OneSignal SDK already integrated (line 21-34)
- ✅ OneSignal App ID already configured: `1f3c8cb5-b8b4-4c1b-8bb1-adc70785db57`
- ✅ Service Worker registered for push support
- ✅ Account created + free tier active

**What CAN be done today (2-3 hours):**
- Create 4 alert trigger rules:
  1. Pace trending UP (confidence >75%)
  2. Player status changed (Active→Doubtful or vice versa)
  3. Odds improved >5% since yesterday
  4. Team's next game added to slate
- Add user alert frequency controls: Realtime | Hourly Digest | Daily Summary
- Test with personal user ID first before production
- Wire UI bell icon to notification preferences modal
- Deploy to production site

**OneSignal Setup:**
- App ID: `1f3c8cb5-b8b4-4c1b-8bb1-adc70785db57` (already active)
- Free tier: 30,000 subscribers (MVP-ready)
- SDK: Already loaded in <head>

**Recommendation:** **IMPLEMENT TODAY.** This is highest ROI for engagement. Can go live by 6 PM.

---

### 📋 PRIORITY #4: Multi-Sport Pace Data — RESEARCH ONLY (100%)
**Status:** PLANNING PHASE — NO CODE

**Research Findings:**

| Sport | Pace Metric | Best Source | API Auth | Feasibility |
|-------|------------|-------------|----------|------------|
| **NBA** | Poss/100 | NBA.com / StatsBomb | Free | ✅ Already live |
| **NHL** | Shots/60min (Corsi) | Natural Stat Trick / Evolving Hockey | Free | ✅ High |
| **MLB** | Pitches/AB (pace) | Baseball Savant / Statcast | Free | ✅ High |
| **NFL** | Plays/Game + Drive Duration | NFL.com / Pro Football Reference | Free | ✅ Medium (no per-game API) |

**Key Findings:**
- **NHL:** Corsi rate (shots for/60min) is proxy for pace. Data available on NST, Evolving Hockey.
- **MLB:** Pitcher pace (pitches/at-bat) correlates with game length. Statcast has live data.
- **NFL:** No single "pace" metric (running clock, not action-based). Best option: plays/game or avg drive length.

**UI Sport Selector Design:**
```
[NBA ▼ | NHL | MLB | NFL]
Dropdown toggles between pace tables
Embedded JSON per sport (same structure as NBA)
Filter by team rank, status, confidence
```

**Data Storage:**
- Embed pace JSON for each sport in <script> tag
- Reuse existing card layout (minimal CSS changes)
- Sport selector resets search/filters

**Next Steps (Future Sprint):**
1. Scrape 20-30 top players per sport
2. Calculate pace metrics per sport definition
3. Merge into single embedded fileData object
4. Add sport filter dropdown
5. Deploy to Pace Trends tab

**Recommendation:** Complete research, start NHL scraper next sprint.

---

## 📊 Execution Plan

### **TODAY (April 4) — Realistic Scope**

| Priority | Task | Hours | Status | Notes |
|----------|------|-------|--------|-------|
| #3 | Implement OneSignal alerts (4 triggers) | 2-3 | ✅ GO | Highest ROI, fully feasible |
| #1 | Add sportsbook buttons + tracking | 1-2 | ✅ GO | Limited by API access, but buttons work |
| #2 | Static injury badges + snapshot tracking | 1-2 | ✅ GO | Real-time limited; static is viable |
| #4 | Multi-sport research document | 0.5 | ✅ GO | Planning only |
| **TOTAL** | | **5-7 hrs** | | |

### **DEPLOYMENT**
- Manual Netlify upload (no git) via desktop
- Test on `propedgemasters.netlify.app` before final push
- Verify OneSignal push works on iOS/Android

---

## 🚨 Critical Constraints

### API Access Limitations
1. **DraftKings:** No public API. OAuth required for authenticated bet slips.
2. **FanDuel:** Has `fanduel.com/sports/...` deep links but no pre-fill API.
3. **ESPN:** Injury data has 1-2 hour lag (not real-time).
4. **Live Odds:** No free public API for real-time odds (requires sportsbook credentials).

### Workaround Strategy
- **Sportsbook buttons:** Deep-link navigation only. Users land on homepage/sportsbook.
- **Odds tracking:** Build historical snapshot system (start collecting today, analyze tomorrow).
- **Injuries:** Display static status from embedded data + refresh on game slate.
- **Real-time:** Refresh client-side UI every 30-60s (no new API calls needed).

---

## 📝 Recommended Implementation Order

1. **Hour 1-2:** Implement OneSignal alert triggers (START HERE — easiest win)
2. **Hour 2-3:** Add sportsbook buttons + ROI tracking
3. **Hour 3-4:** Build injury status badges + odds snapshot logger
4. **Hour 4-5:** Test all 3 features on production site
5. **Hour 5-7:** Research document + deployment

---

## ✅ Success Criteria for Today

- [ ] OneSignal push notification fires when pace UP (confidence >75%)
- [ ] "Bet on DK" and "Bet on FD" buttons visible on each Pace card
- [ ] Clicking buttons opens sportsbook (users land on correct page)
- [ ] Injury status badge shows (ACTIVE | DOUBTFUL | RULED OUT) per player
- [ ] ROI tracker logs clicks to localStorage (for future analysis)
- [ ] Research doc complete for multi-sport phase
- [ ] All changes deployed to propedgemasters.netlify.app

---

## 📋 Files to Modify

**Single File:**
- `/sessions/clever-bold-mayer/mnt/PropEdge/propedge-deploy/index.html` (16,761 lines)

**Sections to Patch:**
1. Pace card HTML template (line ~15000-15050) — add button markup
2. CSS for buttons (line ~37-400) — add styles
3. OneSignal trigger logic (new function)
4. ROI tracking localStorage (new function)
5. Injury status filter + badge (new logic)

---

## 🎯 Next Sprint (April 5-6)

- Deploy odds snapshot scheduler (hourly capture)
- Start NHL pace data scraper
- Build multi-sport UI selector
- Implement notification preferences modal

---

**Report Generated:** April 4, 2026, 12:30 PM EST
**Prepared by:** Claude (Sprint Executor)
**Status:** Ready for implementation
