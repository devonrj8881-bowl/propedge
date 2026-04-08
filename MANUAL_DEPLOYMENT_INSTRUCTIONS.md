# PropEdge Manual Deployment Instructions

**Updated:** April 1, 2026
**Target:** https://propedgemasters.netlify.app
**File to Deploy:** `/Users/devonjohnson/Documents/Claude/Projects/PropEdge/propedge-deploy/index.html`

---

## Quick Deployment (2 minutes)

### Method 1: Drag & Drop (Easiest)

1. **Open Netlify Dashboard**
   - Go to: https://app.netlify.com/sites/propedgemasters
   - Sign in if needed

2. **Locate the Publish Section**
   - Look for "Deploys" tab at the top
   - Find the deploy area (usually shows "Drag files here to deploy")

3. **Drag index.html**
   - Open Finder on your Mac
   - Navigate to: `/Users/devonjohnson/Documents/Claude/Projects/PropEdge/propedge-deploy/`
   - Drag `index.html` to the Netlify deploy area
   - Wait for upload to complete (~10 seconds)

4. **Verify Deployment**
   - You should see a green checkmark and "Published" status
   - The deploy will show a timestamp (should be current)

5. **Test Live Site**
   - Go to: https://propedgemasters.netlify.app
   - Hard refresh your browser: `Cmd + Shift + R`
   - Check that the ⚡ Pace tab appears in navigation

---

### Method 2: Netlify CLI (If npm works)

```bash
# Navigate to PropEdge directory
cd /Users/devonjohnson/Documents/Claude/Projects/PropEdge

# Set your auth token
export NETLIFY_AUTH_TOKEN='nfp_VediMBiQFFgRzFvYZqubcJw6kESnygEK8e4b'

# Deploy
netlify deploy --prod --dir=propedge-deploy

# Output should show:
# ✅ Deploy is live at https://propedgemasters.netlify.app
```

---

### Method 3: Git Push (If GitHub Actions configured)

```bash
# From PropEdge directory
cd /Users/devonjohnson/Documents/Claude/Projects/PropEdge

# Stage and commit changes
git add propedge-deploy/index.html
git commit -m "Add Pace Matchup tab and fix API errors (April 1)"

# Push to GitHub
git push origin main

# GitHub Actions should auto-deploy to Netlify
# Check: https://github.com/devonrj8881-bowl/propedge/actions
```

---

## Verification After Deployment

### Step 1: Clear Browser Cache
```
Chrome/Safari: Cmd + Shift + R
Firefox: Ctrl + Shift + R
```

### Step 2: Check Live Site
Open https://propedgemasters.netlify.app and verify:

✅ **Navigation Tabs**
- [ ] Props tab visible
- [ ] Games tab visible
- [ ] Injuries tab visible
- [ ] Strategy tab visible
- [ ] ⚡ **Pace tab visible** (NEW!)

✅ **Click the Pace Tab**
- [ ] View switches to Pace Matchup
- [ ] Header shows "⚡ Pace Matchups"
- [ ] League pills appear (ALL, NBA, NHL, MLB)
- [ ] Search bar works
- [ ] Sort dropdown works
- [ ] 5 sample player cards visible

✅ **Pace Cards Display**
- [ ] Shows player name with league tag (🏀/🏒/⚾)
- [ ] Shows matchup info (Team @ Opponent • Date)
- [ ] Shows 3 pace metrics (Your Pace, Team Pace, Opp Pace)
- [ ] Color-coded favorability banner (green/yellow/red)
- [ ] Projection range shown
- [ ] Cards responsive on mobile

✅ **No Console Errors**
- Open DevTools: `Cmd + Option + J`
- Check Console tab
- Should NOT see:
  - ❌ `favicon.ico 404`
  - ❌ `MultiBook API error 404`
  - ❌ Any red error messages

✅ **Props Still Load**
- [ ] Props tab shows 2958 props
- [ ] Games display correctly
- [ ] All existing functionality works

---

## Troubleshooting

### Issue: Pace Tab Doesn't Appear

**Check 1: Hard Refresh**
- Press `Cmd + Shift + R` to clear cache
- Wait 5 seconds, refresh again

**Check 2: Verify Deployment**
- Go to https://app.netlify.com/sites/propedgemasters
- Check "Deploys" tab
- Make sure the latest deploy shows green status
- Click on it to see deployment details

**Check 3: Check Deployed File Size**
- In Netlify, click the latest deploy
- Look for index.html file size
- Should be ~147 KB (not 133 KB)
- If it's smaller, the file wasn't deployed correctly

**Check 4: Try Different Browser**
- Try a different browser (Firefox, Safari, Edge)
- Sometimes Chrome cache is stubborn

---

### Issue: Console Shows "favicon.ico 404"

**Status:** This is OK - already fixed in deployed file
- [ ] Hard refresh the page
- If still appears after refresh, favicon fix hasn't deployed yet

---

### Issue: "No Props Found" in Props Tab

**Status:** Props should load from Google Sheet
- [ ] Check if props were in Google Sheet during scraper run
- [ ] Try clicking "Model Score" dropdown to trigger reload
- [ ] Wait 15 seconds for props to auto-load
- [ ] Check console for detailed loading messages

---

### Issue: Pace Tab Shows Empty Cards

**Status:** Should show 5 sample players
- This means the JavaScript loaded but data didn't initialize
- Try:
  - [ ] Hard refresh page
  - [ ] Open DevTools Console tab
  - [ ] Type: `state.paceData` and check if array has 5 items
  - [ ] If undefined, reload page again

---

## Files Deployed

### index.html
- **Location:** `propedge-deploy/index.html`
- **Size:** 147 KB (4,390 lines)
- **Changes:**
  - Added ⚡ Pace tab navigation
  - Added Pace HTML container
  - Added 42 Pace CSS classes
  - Added 4 Pace JavaScript functions
  - Fixed API error handling
  - Fixed Google Sheets error handling

### favicon.ico
- **Location:** `propedge-deploy/favicon.ico`
- **Size:** 317 bytes
- **Type:** SVG
- **Content:** Green "PE" logo

---

## Rollback Instructions

If something goes wrong after deployment:

### Quick Rollback
1. Go to https://app.netlify.com/sites/propedgemasters
2. Click "Deploys" tab
3. Find the previous green deploy (before the current one)
4. Click on it
5. Click "Publish deploy" button

The previous version will be live immediately.

### Or Redeploy Backup
```bash
# Backup exists at:
/Users/devonjohnson/Documents/Claude/Projects/PropEdge/propedge-deploy/index-backup-april1.html

# To revert:
cp propedge-deploy/index-backup-april1.html propedge-deploy/index.html
# Then deploy again using Method 1, 2, or 3 above
```

---

## Netlify Credentials Reference

If you need to redeploy later:

```
Site ID: 838cca00-a711-4175-b00e-95203cda9900
Auth Token: nfp_VediMBiQFFgRzFvYZqubcJw6kESnygEK8e4b
Site URL: https://propedgemasters.netlify.app
Git Repo: https://github.com/devonrj8881-bowl/propedge
```

---

## Post-Deployment Next Steps

### Immediate (After Deployment)
1. ✅ Verify Pace tab appears and works
2. ✅ Test all league filters
3. ✅ Test search functionality
4. ✅ Verify mobile responsiveness

### Short-term (This Week)
- [ ] Connect Pace data to Google Sheet scraper
- [ ] Update scraper to fetch pace metrics from ESPN
- [ ] Replace mock data with real pace data

### Medium-term (2 Weeks)
- [ ] Add sub-tabs (This Week / Season / H2H)
- [ ] Implement head-to-head historical lookup
- [ ] Add advanced projections

---

## Support

If deployment fails or you have questions:

1. Check the "Troubleshooting" section above
2. Verify file size in Netlify matches expected (~147 KB)
3. Check DevTools Console for specific error messages
4. Use rollback procedure if needed

---

**Ready to Deploy?**
Choose Method 1 (Drag & Drop) - it's the fastest and most reliable!

**Expected Result:**
Within 30 seconds, the ⚡ Pace tab will be live on https://propedgemasters.netlify.app

---

**Created:** April 1, 2026, 10:47 PM ET
**Status:** Ready for manual deployment
