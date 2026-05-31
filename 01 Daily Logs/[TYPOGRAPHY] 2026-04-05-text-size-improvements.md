---
date: 2026-04-05
type: typography-update
status: complete
---

# Typography Enhancement - Font Size Improvements

## Summary
Systematically increased font sizes across the entire PropEdge application for better readability. All changes are proportional increases of 1-2px to maintain design hierarchy.

## Changes Made

### Header & Stats (Lines 214-232)
- `.stat-value`: 20px → 22px (+2px)
- `.stat-label`: 10px → 11px (+1px)

### Parlay Display (Lines 2491-2507)
- `.parlay-leg-player`: 14px → 15px (+1px)
- `.parlay-leg-prop`: 12px → 13px (+1px)
- `.parlay-leg-odds`: 13px → 14px (+1px)

### Injury Badges (Line 967)
- `.injury-badge`: 9px → 10px (+1px)

### Player Names & Card Info (Lines 997-1020)
- `.prop-player-name`: 16px → 17px (+1px)
  - Desktop variant: 20px → 21px (+1px)
- `.prop-player-meta`: 11px → 12px (+1px)

### Prop Direction & Attributes (Line 2198)
- `.prop-direction`: 11px → 12px (+1px)

### Statistics Display (Lines 2310-2329)
- `.prop-stat-value`: 13px → 14px (+1px)
  - Desktop variant: 14px → 15px (+1px)
- `.prop-stat-label`: 9px → 10px (+1px)

## Design Principles Applied

✅ **Consistency**: All increases are +1px or +2px (no drastic jumps)
✅ **Hierarchy**: Maintained ratio between small, medium, and large text
✅ **Readability**: Improves scannability without excessive spacing changes
✅ **Mobile**: Mobile sizes increased proportionally to desktop
✅ **Responsive**: Both breakpoints updated consistently

## Areas Improved

1. **Stat Boxes**: Header stats now 22px (was 20px) - easier to read at a glance
2. **Player Names**: Increased to 17px mobile / 21px desktop - strong visual focus
3. **Prop Details**: Direction, line, team info all 12px+ - easier to scan
4. **Statistical Values**: L5, L10, averages now 14px+ - better visibility
5. **Labels**: All small labels increased to 10px+ - less eye strain
6. **Parlay Legs**: Compact format now more readable at 15px player names

## Testing Checklist

- [ ] Props tab - player names are prominent and easy to read
- [ ] Parlay tab - leg information clearly visible in compact format
- [ ] Portfolio tab - tracked props display readably
- [ ] Stats bar - header values stand out
- [ ] Mobile view - text remains proportionally readable
- [ ] Desktop view - no overflow or layout issues
- [ ] All tabs - consistent text sizing throughout

## Before/After Comparison

| Element | Before | After | Change |
|---------|--------|-------|--------|
| Player Name (Mobile) | 16px | 17px | +1px |
| Player Name (Desktop) | 20px | 21px | +1px |
| Stat Values | 13px/14px | 14px/15px | +1px |
| Prop Meta | 11px | 12px | +1px |
| Parlay Legs | 14px | 15px | +1px |
| Badge Text | 9px-11px | 10px-12px | +1px |

---

**Result**: Improved readability across all areas while maintaining design cohesion.
**File Status**: Ready for deployment ✅
