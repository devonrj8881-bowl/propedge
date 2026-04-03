---
name: PropEdge v3.14 Complete Setup
description: Complete file structure, deployment process, and all necessary files for PropEdge production
type: reference
---

## PropEdge v3.14 — Complete Production Setup
**Date:** March 30, 2026 (last verified)
**Status:** ✅ Live and deployed

## Actual File Structure (verified March 30, 2026)

All these files exist in `/Users/devonjohnson/Documents/Claude/Projects/PropEdge/`:

```
PropEdge/
├── index.html                      (Main app — 582K, 15,796 lines, v3.14)
├── icon.svg                        (App icon/logo)
├── icon-192.png                    (PWA icon for push notifications)
├── sw.js                          (Service Worker — 994 bytes, 29 lines)
├── OneSignalSDKWorker.js          (OneSignal push notification worker)
├── OneSignalSDKUpdaterWorker.js   (OneSignal SDK updater worker)
├── deploy-prod.sh                 (Deploy script — 557 bytes, executable)
├── README.md                      (Project readme)
├── .gitignore
├── .netlify/
│   ├── netlify.toml               (Netlify config)
│   └── state.json                 (siteId: 838cca00-a711-4175-b00e-95203cda9900)
└── .github/workflows/deploy.yml   (GitHub Actions — not used for deploys)
```

## Key Features in v3.14

- ✅ **Dark theme** with custom color variables
- ✅ **Ticket Watchlist** for tracking prop selections
- ✅ **OneSignal Push Notifications** for player status alerts
- ✅ **Live Games** with real-time matchup data + animated SVG court
- ✅ **Live Game Modal** — opens from game bar, 1-second clock countdown
- ✅ **Ticker Card Countdowns** — 30s refresh via `_startCountdownRefresh()`
- ✅ **Injury Updates** with player status tracking
- ✅ **Mobile Optimizations** (lineup teams stack vertically on <768px)
- ✅ **Multiple Leagues** (NBA, NHL, MLB, NFL support)
- ✅ **Props Tracking** with model scores and historical data
- ✅ **Service Worker** for offline capability and push notifications

## Deployment Instructions

### Quick Deploy (Recommended)
```bash
cd /Users/devonJohnson/Documents/Claude/Projects/PropEdge
./deploy-prod.sh
```

**What it does:**
- Installs netlify CLI if needed
- Deploys entire directory to Netlify
- Takes ~5 seconds
- Returns live URL

### Browser After Deploy
- Go to: https://propedgemasters.netlify.app
- **Hard refresh:** Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
- Should see dark theme v3.14

## Critical Files

### index.html
- **Size:** 582KB, 15,796 lines (contains all CSS, JavaScript, HTML)
- **Dependencies:** Requires all worker files below
- **Features:** Complete app with all v3.14 features
- **DO NOT:** Use old `propedge_v3.html` — it's outdated
- **Last modified:** March 30, 2026 (countdown fix session)

### Service Worker Files (Required for push notifications)
1. **sw.js** — Main service worker that handles:
   - Push notification registration
   - Background sync
   - Offline caching

2. **OneSignalSDKWorker.js** — OneSignal push handling
3. **OneSignalSDKUpdaterWorker.js** — OneSignal SDK updates

### Supporting Files
- **icon.svg** — App icon displayed in header
- **deploy-prod.sh** — Local deployment script
- **netlify.toml** — Netlify configuration (serves index.html at root)

## OneSignal Configuration

**App ID:** `1f3c8cb5-b8b4-4c1b-8bb1-adc70785db57`
**Safari ID:** `web.onesignal.auto.1f3c8cb5-b8b4-4c1b-8bb1-adc70785db57`
**Service Worker Path:** `/sw.js`

These are configured in index.html lines 21-33.

## Netlify Configuration

**Site:** propedgemasters
**URL:** https://propedgemasters.netlify.app
**Linked:** Yes (local netlify project is linked)
**Config File:** netlify.toml

The netlify.toml ensures:
- index.html is served at root (/)
- Proper cache headers for assets
- 3600s cache for static assets, no-cache for index.html

## Mobile Optimizations (v3.14)

**Responsive Breakpoint:** 768px
- **< 768px (Mobile):** Lineup teams stack vertically
- **768px+ (Desktop):** Lineup teams display 2-column grid
- **1100px+ (Large Desktop):** 3-column injury card grid

CSS is in index.html around lines 3395-3415.

## Deployment Checklist

Before deploying:
- ✅ All 5 files present in `/Users/devonJohnson/Documents/Claude/Projects/PropEdge/`
- ✅ `index.html` is v3.14 (check first line comment)
- ✅ `deploy-prod.sh` has execute permissions (`chmod +x deploy-prod.sh`)
- ✅ Netlify CLI authenticated locally

## Future Deployments

**For any updates:**
1. Edit `index.html` with new features
2. Run `./deploy-prod.sh`
3. Hard refresh browser (Cmd+Shift+R)
4. Live in ~5 seconds

**No git commits needed.** Direct Netlify CLI is faster and simpler.

## Backup File Mapping

All files are now documented and backed up:
- **UUID:** f170a1cd-cfcd-403d-b27b-1936af511f5c (icon.svg)
- **UUID:** 3f7d663e-393e-46d7-8d71-01dc94185883 (index-ed6fafb7.html → index.html)
- **UUID:** 15cb8924-adfe-4721-a3c9-0d489365da88 (OneSignalSDKUpdaterWorker.js)
- **UUID:** c080c0d1-b332-408b-830e-dda2287335ba (OneSignalSDKWorker.js)
- **UUID:** f165e738-5eeb-4ca4-b16e-249be9036102 (sw.js)
