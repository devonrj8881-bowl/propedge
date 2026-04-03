---
name: Mobile Optimization - March 30, 2026
description: Lineup teams stack vertically on mobile screens for better readability
type: project
---

## Mobile Optimization Applied

**Date:** March 30, 2026
**Status:** ✅ Live in production (https://propedgemasters.netlify.app)

## What Changed

Added responsive CSS media query for mobile devices (<768px):

- **Lineup team columns** now stack vertically (was 2-column grid on all sizes)
- **Reduced padding** on lineup cards for tighter mobile layout
- **Smaller fonts** on mobile for better fit
- **Improved spacing** between player rows

## CSS Changes

Location: `index_v3_14.html` lines ~3395-3415

```css
@media (max-width: 767px) {
  .lineup-teams-grid { grid-template-columns: 1fr; }
  .lineup-game-card { margin-bottom: 10px; }
  .lineup-game-header { padding: 8px 11px; }
  .lineup-body { padding: 10px 11px; }
  .lineup-player-row { padding: 4px 0; font-size: 11px; }
  .lineup-team-col h4 { font-size: 10px; margin-bottom: 6px; }
}
```

## Testing

Users should see improved mobile layout on the **Lineups tab** when:
1. Viewing on phone/tablet
2. Using Chrome DevTools mobile emulation (< 768px width)
3. Desktop view still uses 2-column layout at 768px+

## Deployment

Deployed via `./deploy-prod.sh` netlify CLI command (March 30, 2026, 1:08 PM)
- No git commits needed
- Live within ~5 seconds
