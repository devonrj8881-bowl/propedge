# PropEdge Pace Matchup Tab - Quick Start Guide

## What's New

A brand new **⚡ Pace** tab has been added to PropEdge alongside Props, Games, Injuries, Parlay, and Strategy.

---

## How to Test

### 1. Deploy the Updated File
The updated `index.html` is at:
```
/sessions/confident-upbeat-einstein/mnt/PropEdge/propedge-deploy/index.html
```

Deploy using one of these methods:
```bash
# CLI method (fastest)
export NETLIFY_AUTH_TOKEN='nfp_VediMBiQFFgRzFvYZqubcJw6kESnygEK8e4b'
npx netlify deploy --prod --dir=propedge-deploy

# OR: Drag-and-drop to https://app.netlify.com/sites/propedgemasters
```

### 2. View the Tab
1. Go to **https://propedgemasters.netlify.app**
2. Hard refresh: **Cmd+Shift+R** (macOS) or **Ctrl+Shift+R** (Windows)
3. Look for the **⚡ Pace** tab in the navigation (appears last)
4. Click it!

---

## What You Should See

### Default View
- 5 sample pace matchups (2 NBA, 2 NHL, 1 MLB)
- League pills at the top (All, 🏀 NBA, 🏒 NHL, ⚾ MLB)
- Search bar to find players
- Sort dropdown (Matchup Edge ↓, Player Pace ↓, Opponent Pace ↓)

### Sample Data in Cards

#### NBA Examples:
- **LeBron James** (LAL @ BOS) — Slower opponent, favorable for slowing pace
- **Luka Doncic** (DAL @ DEN) — Faster opponent, unfavorable

#### NHL Examples:
- **Connor McDavid** vs Points (EDM @ LAK) — Faster pace, favorable
- **Connor McDavid** vs Assists (EDM @ LAK) — Neutral pace

#### MLB Example:
- **Mike Trout** (LAA @ HOU) — Slower pitcher, favorable for more ABs

---

## Testing Checklist

### ✅ Functionality
- [ ] Click the ⚡ Pace tab — view loads without errors
- [ ] Click each league pill (All, NBA, NHL, MLB) — cards filter correctly
- [ ] Type "lebron" in search — only LeBron cards appear
- [ ] Clear search — all matching league cards return
- [ ] Change sort dropdown — cards reorder properly
- [ ] Card titles are readable and match data

### ✅ Design
- [ ] Cards match PropEdge dark theme (blue/gray/black colors)
- [ ] Favorability badges are colored:
  - Green ✅ = Favorable
  - Yellow ⚠️ = Neutral
  - Red ❌ = Unfavorable
- [ ] League tags show correct colors:
  - Orange for NBA
  - Blue for NHL
  - Red for MLB
- [ ] Layout is responsive on mobile (stack vertically)
- [ ] Hover effects work on cards (slightly lighter background)

### ✅ Mobile (Phone/Tablet)
- [ ] League pills scroll horizontally on small screens
- [ ] Cards stack vertically (not 3-column grid)
- [ ] Search bar is full-width and usable
- [ ] Text is readable (not too small)

### ✅ Data Display
Each card should show:
1. Player name + league tag + matchup info
2. Three metric boxes:
   - Your Pace (player's season avg)
   - Team Pace (team's tempo)
   - Opponent Pace (opponent's pace-allowed)
3. Matchup edge banner with:
   - Icon (✅, ⚠️, or ❌)
   - Favorability message
   - Pace delta (numeric difference)
4. Projection box (purple) showing:
   - Stat type (Points, Batting Average, etc.)
   - Range (e.g., "22 - 24")

---

## What's NOT Implemented Yet (Future)

- 🔄 Real pace data from ESPN API
- 🔄 Integration with propedge-deploy scraper
- 🔄 Historical head-to-head pace data
- 🔄 Advanced ML projections
- 🔄 Sub-tabs (This Week / Season / H2H / Trends)
- 🔄 Push notifications for pace-favorable matchups

---

## Code Structure Reference

### File: `propedge-deploy/index.html`

**HTML (lines 5166-5209):**
```html
<div class="view-container" id="paceContainer">
  <!-- Header with title -->
  <!-- League pills -->
  <!-- Search bar -->
  <!-- Sort dropdown -->
  <!-- Cards container (id="paceCards") -->
</div>
```

**CSS (lines 3722-3858):**
- `.pace-*` classes for all styling
- Uses design system colors (--accent-green, --accent-blue, etc.)
- Responsive grid with media queries

**JavaScript (lines 14909-15028):**
- `initPaceData()` — Sets up mock data
- `renderPace()` — Main render function (filtering, sorting, display)
- `renderPaceCard(p)` — Builds individual card HTML
- `setPaceLeague(league)` — Handles league filter clicks
- Integration in `initTabs()` for view switching

---

## Customization Notes

### To Modify Mock Data
Edit the `initPaceData()` function (line 14912):
```javascript
state.paceData = [
  {
    id: 'pace-nba-1',
    league: 'NBA',
    player: 'Your Player',
    team: 'LAL',
    opponent: 'BOS',
    // ... etc
  }
]
```

### To Change Colors
Edit CSS variables in root `:root` or specific `.pace-edge-*` styles:
```css
--accent-green: #00e676;  /* Favorable */
--accent-gold: #f59e0b;   /* Neutral */
--accent-red: #ff5252;    /* Unfavorable */
```

### To Add More Leagues
Search for league-specific code in `renderPaceCard()` and add cases for new leagues.

---

## Next Steps for Production

1. **Connect Real Data:**
   - Replace `initPaceData()` with API call to ESPN
   - Pull player pace from stats
   - Pull opponent pace-allowed from team data

2. **Add Scraper Integration:**
   - Update 11:30 AM & 6 PM EST scraper to collect pace metrics
   - Store in Google Sheet alongside other props
   - Load into `state.paceData` on app startup

3. **Improve Projections:**
   - Calculate pace-adjusted stat projections
   - Factor in league differences (NBA vs NHL pace meaning different things)
   - Test against historical accuracy

4. **Expand Features:**
   - Add sub-tabs for different time periods
   - Build trend charts
   - Add favorability-based filtering to Parlay builder

---

## Questions or Issues?

- Code not loading? Hard refresh: **Cmd+Shift+R**
- Cards blank? Check browser console (F12 > Console tab)
- Data wrong? Check `renderPace()` and `renderPaceCard()` logic
- Styling off? Verify CSS classes match HTML

Enjoy! ⚡
