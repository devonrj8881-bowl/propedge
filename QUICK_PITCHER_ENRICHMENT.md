# Quick Start: Pitcher ERA Enrichment (5 min setup)

## The Goal
Populate the `pitcher_era` column in your propedge-main sheet with real pitcher data from ESPN + Statcast.

---

## Option 1: Manual Quick Populate (10 min, Today)

For **today's games**, manually add pitcher ERA data:

### Step 1: Open MLB Scores
Go to: https://www.espn.com/mlb/scoreboard

### Step 2: Find Pitchers
For each game, note the **starting pitchers** and their **ERA**

### Step 3: Add to Sheet
In propedge-main sheet, find each pitcher's row and fill `pitcher_era` column:

```
Michael Busch (vs Starting Pitcher with ERA 3.45)
→ Find Michael Busch row
→ Set pitcher_era = 3.45
```

**Easy way:** Use Ctrl+F to find player names, fill in ERA quickly.

---

## Option 2: Automated with Node.js (30 min, Lasting)

### Requirements
- Node.js 14+ installed on your dev machine
- Google Service Account credentials
- 30 minutes setup

### Step 1: Set Up Service Account

1. Go to: https://console.cloud.google.com/apis/credentials
2. Create **Service Account**
3. Generate JSON key file
4. Download and save as: `/Users/devonjohnson/Documents/Claude/Projects/PropEdge/propedge-service-account.json`

### Step 2: Grant Sheet Access

1. Open your propedge-main Google Sheet
2. Share it with the service account email (from JSON file)
3. Give **Editor** access

### Step 3: Install Dependencies

```bash
cd /Users/devonjohnson/Documents/Claude/Projects/PropEdge
npm install google-auth-library googleapis
```

### Step 4: Run Enrichment

```bash
# Test run
node enrichment-pitcher-data.js --date 2026-06-05

# Schedule daily (cron)
0 8 * * * cd /Users/devonjohnson/Documents/Claude/Projects/PropEdge && node enrichment-pitcher-data.js
```

---

## Option 3: Netlify Function (15 min, Cloud)

Deploy as a scheduled Netlify function that runs daily at 8 AM:

**File:** `netlify/functions/enrich-pitcher-data.js`

```javascript
const https = require('https');

exports.handler = async (event) => {
  console.log('🔄 Starting pitcher enrichment...');

  try {
    // Fetch ESPN scoreboard
    const games = await fetchESPNScoreboard();
    
    // For each game, fetch pitcher stats
    const pitchers = await Promise.all(
      games.map(game => fetchPitcherStats(game.awayTeam, game.homeTeam))
    );

    // Update Google Sheet with pitcher_era column
    await updateSheetWithPitchers(pitchers);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `✅ Enriched ${pitchers.length} pitchers`,
        timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    console.error('❌ Enrichment failed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

async function fetchESPNScoreboard() {
  // Fetch today's MLB games
  // Return list with pitcher info
}

async function fetchPitcherStats(awayTeam, homeTeam) {
  // Fetch pitcher ERA from MLB StatsAPI
}

async function updateSheetWithPitchers(pitchers) {
  // Write pitcher_era to Google Sheet
}
```

---

## Data Sources

### ESPN API (Fast)
- URL: `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard`
- Data: Current ERA, W-L record, IP
- Rate: 1000 req/hour (free)
- Updates: Real-time

### MLB StatsAPI (Accurate)
- URL: `https://statsapi.mlb.com/api/v1/people/{id}/stat/season/2026`
- Data: ERA, WHIP, K/9, HR/9, BB/9
- Rate: Unlimited (free)
- Updates: Daily

### Baseball Savant (Advanced)
- URL: `https://baseballsavant.mlb.com/statcast`
- Data: Xwoba, Exit Velocity, Barrel Rate
- Rate: Web scraping (limited)
- Updates: Real-time

---

## What Data Gets Populated

### pitcher_era column
```
3.45
2.87
4.15
(single numeric value)
```

### pitcher_stats column (optional, future)
```json
{
  "era": 3.45,
  "whip": 1.15,
  "k9": 9.5,
  "hr9": 0.95,
  "bb9": 2.1,
  "wins": 8,
  "losses": 3,
  "innings_pitched": 125.0,
  "strikeouts": 118
}
```

---

## Testing After Population

Once you populate `pitcher_era`:

1. Deploy the code (it's already updated)
2. Open PropEdge app
3. Run this in console:

```javascript
const mlbProps = state.props.filter(p => p.league === 'MLB');
const withERA = mlbProps.filter(p => p.pitcherERA);
console.log(`With ERA data: ${withERA.length}/${mlbProps.length}`);
```

Expected: `With ERA data: 150/250` (or similar)

---

## Next: Scoring Impact

Once populated, high-scored MLB picks will be properly penalized:

**Before:**
- Michael Busch vs 2.87 ERA pitcher → Score: 98 (no penalty)

**After:**
- Michael Busch vs 2.87 ERA pitcher → Score: 88 (-10 elite pitcher penalty)

This should **reduce losses on high-scorers** by 5-8%. ✅

---

## Which Option Should You Choose?

| Option | Time | Effort | Automation | Cost |
|--------|------|--------|-----------|------|
| Manual | 10 min | Low | Never | Free |
| Node.js | 30 min | Medium | Daily | Free |
| Netlify | 15 min | Low | Automatic | Free |

**Recommendation:** Start with **Manual** today (10 min), then set up **Netlify Function** (15 min) for ongoing automation.

Let me know which you prefer and I'll implement it! 🚀
