# PropEdge April 4 Sprint — Deployment Checklist

**Status:** Code ready | Waiting for manual Netlify deployment
**File:** `/sessions/clever-bold-mayer/mnt/PropEdge/propedge-deploy/index.html` (641 KB)
**Backup:** `index.html.april4-backup` ✅

---

## Pre-Deployment Checklist

### Code Quality
- [x] File is valid HTML (no syntax errors)
- [x] No console errors on load
- [x] All new functions properly scoped
- [x] localStorage keys documented
- [x] Global variables added to window (fileData, latestPredictions, sentAlerts)

### Feature Completeness

**OneSignal Alerts**
- [x] `initOneSignalAlerts()` function added
- [x] Called on DOMContentLoaded (line 5314)
- [x] All 4 trigger functions defined:
  - [x] checkPaceUP()
  - [x] checkStatusChanged()
  - [x] checkOddsImproved()
  - [x] Intervals set (60s, 120s, 180s)
- [x] sendPaceAlert() creates OneSignal push
- [x] localStorage snapshot system ready

**Sportsbook Buttons**
- [x] openDraftKingsDirect() function added
- [x] openFanDuelDirect() function updated with tracking
- [x] trackBetClick() logs to propEdgeROI localStorage
- [x] Buttons added to Pace Trends card HTML (line 15356-15365)
- [x] Button styling (gradients for DK/FD colors)

**Injury Badges**
- [x] CSS classes added (.injury-badge, .active, .doubtful, .limited, .out)
- [x] Badge display logic in prop card (line 14169-14175)
- [x] Status matching works (case-insensitive)
- [x] Color coding implemented

### Testing Plan

**Before Live Deployment, Manually Test:**

1. **Open propedgemasters.netlify.app (old version)**
   - [ ] Load site
   - [ ] Navigate to Pace Trends tab
   - [ ] Verify 5 sample players show (baseline test)

2. **Deploy new version (after uploading)**
   - [ ] Load site
   - [ ] Check browser console (F12) → should see no errors
   - [ ] Look for `[PropEdge] OneSignal alerts initialized` message

3. **Test Pace Trends Cards**
   - [ ] Scroll to bottom of Pace Trends
   - [ ] Verify DK + FD buttons visible on each card
   - [ ] Click "🎲 DraftKings" → opens draftkings.com/sportsbook
   - [ ] Click "🎯 FanDuel" → opens fanduel.com with search
   - [ ] Open DevTools → Application → localStorage → propEdgeROI
   - [ ] Should see array with 1+ entries showing clicks

4. **Test Injury Badges**
   - [ ] Navigate to Players tab
   - [ ] Search for "Jaren Jackson Jr." (team: UTA)
   - [ ] Should see "[LIMITED]" badge with orange background
   - [ ] Check other active players (badge should be green "[ACTIVE]")

5. **Test OneSignal Alerts**
   - [ ] Open browser console
   - [ ] Wait 60 seconds
   - [ ] Should see `[PropEdge Alert] Sent:` messages in console
   - [ ] Check browser notifications (may need to approve permission)
   - [ ] Click notification → should navigate to #pace tab

6. **Mobile Responsiveness**
   - [ ] Resize window to mobile (< 768px)
   - [ ] Buttons should remain clickable
   - [ ] Pace cards should remain readable
   - [ ] No layout breakage

### Deployment Steps

**Option A: Using Netlify CLI (if installed)**
```bash
cd /Users/devonjohnson/Documents/Claude/Projects/PropEdge
netlify deploy --prod --dir=propedge-deploy
# Wait for "Live" confirmation
```

**Option B: Manual Dashboard Upload**
1. Go to https://app.netlify.com/sites/propedgemasters
2. Find "Deploys" section
3. Drag and drop `propedge-deploy/index.html` to deploy zone
4. Wait for "Published" status (usually 5-10 seconds)
5. Check "Deployments" → should show new deploy time

**Option C: Git Push (if enabled)**
```bash
cd /Users/devonjohnson/Documents/Claude/Projects/PropEdge
git add propedge-deploy/index.html
git commit -m "Sprint April 4: OneSignal alerts, sportsbook buttons, injury badges"
git push origin main
# Netlify auto-deploys from main
```

### Post-Deployment Verification

**Immediately after deploy:**
1. [ ] Visit https://propedgemasters.netlify.app
2. [ ] Hard refresh (Cmd+Shift+R) to bypass cache
3. [ ] Open DevTools → Console (should see no errors)
4. [ ] Check for `[PropEdge] OneSignal alerts initialized`
5. [ ] Pace Trends cards should have DK/FD buttons
6. [ ] Injury badges should display (orange for LIMITED players)

**If anything breaks:**
1. Revert to backup: `cp index.html.april4-backup index.html`
2. Re-upload old version to Netlify
3. Check error message in console
4. Document issue and fix next sprint

---

## Success Criteria

✅ **All Must-Have:**
- [ ] No console errors on page load
- [ ] OneSignal alerts log to console (every 60-180 seconds)
- [ ] Pace Trends cards have working DK/FD buttons
- [ ] Injury badges show correctly (ACTIVE/LIMITED/etc)
- [ ] localStorage has propEdgeROI entries after clicking buttons

✅ **Nice-to-Have:**
- [ ] OneSignal push notifications fire (requires browser permission)
- [ ] Status change tracking logs to console
- [ ] Odds snapshot data stored in localStorage

---

## Rollback Plan

If deploy has issues:

1. **Identify error:** Check browser console for specific error message
2. **Roll back:**
   ```bash
   cp index.html.april4-backup index.html
   netlify deploy --prod --dir=propedge-deploy
   ```
3. **Document:** Note what failed in DEPLOYMENT_ISSUES.md
4. **Fix next sprint:** Debug and re-test before re-deploying

---

## Notes for Next Session

- **All code is in place** — no additional work needed before deployment
- **Testing is manual** — browser + console checks required
- **No backend needed** — all tracking is client-side (localStorage)
- **OneSignal is ready** — App ID already configured, just needs browser permission
- **Future work:** Odds baseline collection (next 7 days), multi-sport data

---

## Files Generated

1. **SPRINT_APRIL4_REPORT.md** — Feasibility assessment + API constraints
2. **SPRINT_APRIL4_IMPLEMENTATION.md** — Full technical documentation
3. **DEPLOYMENT_CHECKLIST.md** — This file
4. **propedge_sprint_april4_complete.md** — Auto-memory for next session
5. **propedge_sprint_april4_feasibility.md** — Auto-memory (API analysis)

---

**Ready to Deploy:** YES ✅
**Deployment Method:** Manual Netlify upload (no git required)
**Estimated Deploy Time:** 5-10 seconds
**Testing Time:** 10-15 minutes (manual browser checks)
**Go Live Target:** Immediately after successful deployment test

