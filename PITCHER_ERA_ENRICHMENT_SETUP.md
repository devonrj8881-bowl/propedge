# Pitcher ERA Enrichment Setup

## Overview

The scoring system now expects pitcher ERA in a dedicated **`pitcher_era`** column instead of trying to parse it from the h2h column (which contains head-to-head records).

This guide walks you through:
1. Adding the `pitcher_era` column to your Google Sheet
2. Setting up the enrichment pipeline to populate it
3. Testing the new scoring with real pitcher data

---

## Step 1: Add `pitcher_era` Column to Google Sheet

### In your propedge-main sheet:

1. **Add a new column** after the existing data columns
2. **Column header:** `pitcher_era` (exact match)
3. Leave it empty for now — we'll populate it in Step 2

**Expected format in cells:**
```
3.45
2.87
4.15
(single numeric value, not "ERA: 3.45")
```

---

## Step 2: Set Up Enrichment Pipeline

You have three options for data sources:

### Option A: ESPN API (Recommended for real-time)
Uses ESPN's live game data to fetch current pitcher ERA

### Option B: Statcast/Baseball-Reference (Most accurate)
Uses historical Statcast data for more precise metrics
- HR/9 (home runs per 9 innings)
- K/9 (strikeouts per 9 innings)
- WHIP (walks + hits per IP)

### Option C: Your Existing Scraper
If your scraper already fetches game data, add pitcher ERA extraction

---

## Quick Implementation: ESPN API

Here's a simple Node.js function to fetch pitcher ERA:

```javascript
async function enrichPitcherERA() {
  // Pseudo-code for enriching pitcher_era column
  // Run this daily or before each game slate
  
  const sheet = await getGoogleSheet('propedge-main');
  const data = await sheet.getValues();
  const headers = data[0];
  const pitcherEraIdx = headers.indexOf('pitcher_era');
  
  if (pitcherEraIdx === -1) {
    console.error('pitcher_era column not found');
    return;
  }
  
  // For each row with MLB props
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const league = row[headers.indexOf('league')];
    const team = row[headers.indexOf('team')];
    const date = row[headers.indexOf('date')];
    
    if (league !== 'MLB') continue;
    if (row[pitcherEraIdx]) continue; // Already populated
    
    // Fetch game info for this team/date from ESPN
    const game = await fetchESPNGameForTeam(team, date);
    if (!game) continue;
    
    // Get pitcher for this team in the game
    const pitcher = game.awayTeam === team 
      ? game.awayPitcher 
      : game.homePitcher;
    
    if (!pitcher) continue;
    
    // Fetch pitcher ERA from ESPN
    const era = await fetchPitcherERA(pitcher.name);
    
    // Update sheet
    if (era) {
      row[pitcherEraIdx] = era.toString();
    }
  }
  
  // Batch update Google Sheet
  await sheet.appendValues(data);
  console.log('✅ Pitcher ERA enrichment complete');
}
```

---

## What to Do Now

### Immediate (Today):
1. ✅ Add `pitcher_era` column to propedge-main sheet
2. Re-deploy the updated index.html

### Short-term (This Week):
3. Choose data source (ESPN, Statcast, or Scraper)
4. Set up function to fetch pitcher ERA
5. Populate `pitcher_era` for today's games

### Long-term (Ongoing):
6. Automate enrichment to run daily/before game slates
7. Add HR/9, K/9, WHIP to `pitcher_stats` column for advanced scoring

---

## Testing

Once you have `pitcher_era` populated:

1. Open PropEdge app
2. Open browser console
3. Paste this:

```javascript
// Check pitcher ERA is being read
const mlbProps = state.props.filter(p => p.league === 'MLB');
const withERA = mlbProps.filter(p => p.pitcherERA);
console.log(`MLB Props with ERA: ${withERA.length} / ${mlbProps.length}`);
console.log('Sample props with ERA:', withERA.slice(0, 3).map(p => ({
  player: p.playerName,
  pitcher_era: p.pitcherERA,
  score: p.modelScore
})));
```

Expected output:
```
MLB Props with ERA: 150 / 250
Sample props with ERA: [
  { player: 'Brent Rooker', pitcher_era: 3.45, score: 72 },
  { player: 'Kyle Schwarber', pitcher_era: 2.87, score: 65 },
  { player: 'Mitch Garver', pitcher_era: 4.15, score: 81 }
]
```

---

## Scoring Impact

With pitcher ERA populated, high-scored picks will now be **properly penalized** for facing elite pitchers:

**Example: Michael Busch vs Elite Starter**
- Before: Score 98 (no pitcher penalty)
- After: Score 88 (98 - 10 for facing elite pitcher)

**This should reduce your losing picks on high-scorers** ✅

---

## Next Steps

Once you populate `pitcher_era`:
1. Deploy to Netlify
2. Test a few high-scored picks from today
3. Watch hit rate improve as scoring becomes more accurate

Do you want me to:
- Write a specific enrichment script for ESPN?
- Help integrate with your existing scraper?
- Create a manual upload template for pitcher data?
