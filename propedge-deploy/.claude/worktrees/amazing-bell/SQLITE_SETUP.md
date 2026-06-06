# PropEdge SQLite Setup Guide

## Overview
This document covers the SQLite-based pace data pipeline for PropEdge. It's a lightweight alternative to Firebase with zero server overhead.

**Architecture:**
- **SQLite Database** (`propedge.db`) — Stores player pace data, historical trends, and predictions
- **Sync Script** (`sync-espn-pace.js`) — Fetches ESPN API data, calculates trends, updates SQLite
- **Netlify Function** (`netlify/functions/pace-data.js`) — Serves pace data to PropEdge UI
- **Scheduled Task** — Runs sync script at 11:30 AM & 6 PM EST via Netlify cron

---

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

This installs:
- `better-sqlite3` — Blazing fast SQLite driver
- `node-fetch` — Fetch ESPN API data
- `netlify-cli` — Deploy Netlify Functions

### 2. Initialize Database
```bash
node init-db.js
```

This creates:
- `propedge.db` — Main database file
- **players** table — Player metadata (ESPN ID, name, team, position)
- **pace_data** table — Daily pace stats (date, pace, possessions, minutes)
- **predictions** table — Trend analysis (moving averages, volatility, trend direction)

### 3. Test the Sync Script Locally
```bash
node sync-espn-pace.js
```

Expected output:
```
🏀 Starting PropEdge pace data sync...
✅ Stephen Curry: pace=95.23
✅ LeBron James: pace=92.15
...
📊 Sync complete: 5 players synced, 0 errors
```

### 4. Deploy Netlify Function
```bash
netlify deploy --prod
```

This deploys `netlify/functions/pace-data.js` to your Netlify site.

### 5. Test the Endpoint
```bash
curl "https://propedgemasters.netlify.app/.netlify/functions/pace-data?action=all"
```

Expected response:
```json
{
  "timestamp": "2026-04-02T22:30:00.000Z",
  "count": 5,
  "players": [
    {
      "id": 1,
      "name": "Stephen Curry",
      "team": "GSW",
      "pace": 95.23,
      "trend": "UP",
      "moving_avg_7d": 94.50,
      "volatility": 1.23,
      "confidence": 0.95
    },
    ...
  ]
}
```

---

## API Endpoints

### Get All Players with Latest Pace
```
GET /.netlify/functions/pace-data?action=all
```

Returns all players with their latest pace data and trends.

### Get Player Pace History
```
GET /.netlify/functions/pace-data?action=player&playerId=1&days=30
```

Returns last 30 days of pace data for a specific player.

### Get All Player Trends
```
GET /.netlify/functions/pace-data?action=trends
```

Returns latest prediction trends for all players.

### Get Player Trends
```
GET /.netlify/functions/pace-data?action=player-trends&playerId=1
```

Returns trend predictions for a specific player.

---

## Scheduled Sync

The sync script runs automatically via Netlify's scheduled functions.

**Current Schedule:**
- 11:30 AM EST — Morning sync
- 6:00 PM EST — Evening sync

The cron configuration is in `netlify.toml`:
```toml
[[functions]]
  name = "sync-espn-pace"
  schedule = "30 11 * * *"  # 11:30 AM EST

[[functions]]
  name = "sync-espn-pace"
  schedule = "0 18 * * *"   # 6:00 PM EST
```

---

## Database Schema

### players
```sql
CREATE TABLE players (
  id INTEGER PRIMARY KEY,
  espn_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  team TEXT NOT NULL,
  position TEXT,
  created_at DATETIME,
  updated_at DATETIME
);
```

### pace_data
```sql
CREATE TABLE pace_data (
  id INTEGER PRIMARY KEY,
  player_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  pace REAL NOT NULL,
  possessions INTEGER,
  minutes REAL,
  source TEXT,
  created_at DATETIME,
  UNIQUE(player_id, date)
);
```

### predictions
```sql
CREATE TABLE predictions (
  id INTEGER PRIMARY KEY,
  player_id INTEGER NOT NULL,
  prediction_date TEXT NOT NULL,
  predicted_pace REAL NOT NULL,
  confidence REAL,
  trend TEXT,
  volatility REAL,
  moving_avg_7d REAL,
  moving_avg_14d REAL,
  created_at DATETIME
);
```

---

## Updating the UI

To display pace data in PropEdge, add this to your `index.html`:

```javascript
// Fetch pace data
async function loadPaceData() {
  const response = await fetch('/.netlify/functions/pace-data?action=trends');
  const data = await response.json();

  // Update UI with data.trends
  data.trends.forEach(player => {
    console.log(`${player.name}: pace=${player.predicted_pace}, trend=${player.trend}`);
  });
}

// Call on page load
loadPaceData();
```

---

## Troubleshooting

### Database file not found
Make sure you ran `node init-db.js` first. The file should be at the project root.

### Sync script errors
- Check that ESPN API is reachable: `curl https://site.api.espn.com/apis/site/v2/sports/basketball/nba/statistics`
- Check that `better-sqlite3` is installed: `npm ls better-sqlite3`

### Netlify Function returns 404
- Deploy the function: `netlify deploy --prod`
- Check deployment logs: `netlify functions:list`

### No data in database
- Run the sync script manually: `node sync-espn-pace.js`
- Check the database directly:
  ```bash
  sqlite3 propedge.db "SELECT COUNT(*) FROM pace_data"
  ```

---

## Next Steps

1. **Customize players list** — Update `PLAYERS_TO_TRACK` in `sync-espn-pace.js` with real ESPN IDs
2. **Integrate ESPN+ API** — For more detailed pace data (requires API key)
3. **Build ML predictions** — Use pace history to forecast future pace with Prophet or TensorFlow
4. **Add more metrics** — Track additional stats (efficiency, usage, etc.)
5. **Real-time updates** — Use WebSockets or Server-Sent Events (SSE) for live updates

---

## Cost & Performance

- **Database size:** ~500 KB per year of daily data for 5 players
- **Query speed:** <10ms for most queries
- **Netlify Function cost:** Free tier (125,000 invocations/month)
- **Deployment time:** <5 seconds

This is production-ready and scales easily to 100+ players with zero infrastructure overhead.
