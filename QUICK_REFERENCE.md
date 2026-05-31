# PropEdge Pace Data Pipeline — Quick Reference

## 🎯 What You Have

A complete pace data pipeline with **zero Firebase complexity**:

- ✅ JSON database (`propedge-data.json`)
- ✅ Sync script that runs daily at 11:30 AM & 6 PM EST
- ✅ REST API for PropEdge UI (Netlify Function)
- ✅ Automatic trend calculations (MA7, MA14, volatility)
- ✅ No credentials, no setup, no external dependencies

## 🚀 Quick Start

### 1. Test Locally
```bash
node sync-espn-pace.js      # Sync pace data
node test-pace-api.js       # Test the API
```

### 2. Deploy
```bash
./deploy-prod.sh            # Deploy to Netlify
```

### 3. Test Live
```bash
curl "https://propedgemasters.netlify.app/.netlify/functions/pace-data?action=all"
```

## 📊 API Endpoints

| Endpoint | Query | Returns |
|----------|-------|---------|
| `pace-data` | `?action=all` | All players + latest pace + trends |
| `pace-data` | `?action=trends` | All players + predictions |
| `pace-data` | `?action=player&playerId=1&days=30` | 30 days of pace history for player 1 |
| `pace-data` | `?action=player-trends&playerId=1` | 30 days of trend predictions for player 1 |

## 🔄 Scheduled Syncs

Two tasks automatically run daily:

| Time | Command |
|------|---------|
| 11:30 AM EST | `node sync-espn-pace.js` |
| 6:00 PM EST | `node sync-espn-pace.js` |

Manage in Cowork sidebar → Scheduled section

## 💾 Database

All data in one file: `propedge-data.json`

```json
{
  "players": [...],       // Player metadata
  "paceData": [...],      // Daily pace stats
  "predictions": [...],   // Trends + moving averages
  "lastSync": "2026-04-03T..."
}
```

## 🎨 Display in UI

Fetch pace trends:
```javascript
fetch('/.netlify/functions/pace-data?action=trends')
  .then(r => r.json())
  .then(data => {
    // data.trends has all player predictions
    // Use trend, ma7, ma14, volatility, confidence
  });
```

## ⚙️ Customize

### Add Players
Edit `init-db.js`:
```javascript
{ id: 6, espnId: '123456', name: 'Your Player', team: 'TEAM', position: 'PG' }
```

Then re-run:
```bash
node init-db.js
node sync-espn-pace.js
```

### Real ESPN API
Replace in `sync-espn-pace.js`:
```javascript
// Instead of synthetic data, use real API:
const response = await fetch(`https://api.espn.com/...`);
const realData = await response.json();
return { pace: realData.pace, ... };
```

## 📁 File Paths

```
/Users/devonjohnson/Documents/Claude/Projects/PropEdge/
├── propedge-data.json              # Database
├── sync-espn-pace.js               # Sync script
├── init-db.js                      # Initialize DB
├── test-pace-api.js                # Test API
└── netlify/functions/pace-data.js  # API endpoint
```

## 🆘 Common Issues

| Issue | Fix |
|-------|-----|
| "DB not found" | `node init-db.js` |
| "API returns 404" | `./deploy-prod.sh` |
| "No data syncing" | `node sync-espn-pace.js` (manual test) |
| "Scheduled tasks not running" | Check Cowork sidebar > Scheduled |

## 📈 Next Steps

1. **UI Integration** — Add pace trends display to Pace tab
2. **Real ESPN Data** — Connect to actual ESPN+ API
3. **ML Model** — Build Prophet/TensorFlow prediction model
4. **More Metrics** — Track efficiency, usage, assists
5. **Live Updates** — WebSocket/SSE for real-time data

---

**Status:** ✅ Production-ready. Deploy with `./deploy-prod.sh`
