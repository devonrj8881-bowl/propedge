---
name: PropEdge File Workflow & Current Status
description: CRITICAL - The ONLY working index file and how to maintain it going forward
type: feedback
---

# 🚨 CRITICAL: PropEdge File Management

## The Single Source of Truth (Updated 2026-03-31)
- **ONLY file to edit:** `/sessions/<session-id>/mnt/propedge-deploy/index.html`
- Host path: `/Users/devonjohnson/Documents/Claude/Projects/PropEdge/propedge-deploy/index.html`
- **Deploy script** (`deploy-prod.sh`) now points to `propedge-deploy/` — this is what Netlify receives
- The parent PropEdge folder no longer has a duplicate index.html — duplicates were removed

## Why Previous Attempts Failed
- Multiple version confusion: index.html in two places, old stale mounts, sandbox copies
- Fixed 2026-03-31: propedge-deploy is now the single deploy target and only copy of index.html

## All Current Fixes Applied
1. **Scroll improvements** - `scroll-snap-type: x mandatory` and `scroll-behavior: smooth`
2. **Utah logo fix** - `utah.png` → `uta.png` (NBA & NHL)
3. **Injury/Lineup sync** - `_syncInjuriesToLineups()` function
4. **Ticker jump fix** - scroll position preserved across 30s re-renders (2026-03-31)

## Going Forward - CRITICAL WORKFLOW
1. **ALWAYS** edit `/sessions/<session-id>/mnt/propedge-deploy/index.html` directly
2. **NEVER** edit or create files anywhere else — no parent PropEdge copies, no sandbox temp files
3. **Deploy:** run `cd /Users/devonjohnson/Documents/Claude/Projects/PropEdge && ./deploy-prod.sh`
   - Script now deploys `--dir=propedge-deploy` (updated 2026-03-31)
4. **ALWAYS** hard refresh (Cmd+Shift+R) after deployment

## Current Features
- ✅ Utah Jazz logo displaying correctly
- ✅ Smooth horizontal scrolling with snap behavior on live games bar
- ✅ Real-time injury/lineup synchronization
- ✅ Mobile optimizations
- ✅ All OneSignal/push notification integration
- ✅ Ticker scroll position preserved on live score refresh
