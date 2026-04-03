---
name: PropEdge Season Matchup Color Scheme
description: SZN MU stat displays green for favorable matchups
type: project
---

## Implementation: March 28, 2026

**Feature:** Season Matchup (SZN MU) color coding based on matchup quality

### What Was Fixed
The SZN MU stat was displaying the matchup number but had no color indication. Added dynamic color logic to show green for favorable matchups.

### Color Logic
```javascript
const isGoodMatch =
  (p.direction === 'OVER' && p.sznMatchup >= 1 && p.sznMatchup <= 10) ||
  (p.direction === 'UNDER' &&
    ((league === 'NFL' || league === 'NHL')
      ? p.sznMatchup >= 23 && p.sznMatchup <= 32
      : p.sznMatchup >= 21 && p.sznMatchup <= 30));
return isGoodMatch ? 'green' : '';
```

### Display Rules
- **OVER Props:** Green if matchup 1-10 (favorable for overs)
- **UNDER Props:** Green if matchup 21-30 (23-32 for NFL/NHL - favorable for unders)
- **Other matchups:** No color (neutral)

### File Location
- `propedge_v3.html` - Line ~2667-2670
- Display element: `.prop-stat-value` with dynamic green class

### CSS Classes Used
- `.prop-stat-value.green` - Applies `color: var(--accent-green)`

### Status
✅ Implemented and deployed via GitHub Actions

### Why This Matters
Season matchup is a key signal for prop quality. Green highlighting helps users quickly identify which direction (OVER/UNDER) is favorable based on historical matchup data.
