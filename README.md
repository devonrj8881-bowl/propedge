# PropEdge 🏆

**The best publicly available sports betting app for everyone—from casual bettors to seasoned pros**

## Live App
🎯 **https://propedgemasters.netlify.app**

## About
PropEdge helps you make smarter, data-driven sports betting decisions with:
- ✅ Real-time prop analysis
- 📊 Hit rate tracking (L5, L10, Season)
- 🎯 Season matchup ratings
- 💰 Edge calculations
- 🔥 Streak detection
- ⭐ Prime & Ultimate tier props

## How It Works
1. Data pulled from live Google Sheets
2. Props filtered by league thresholds (STRONG, VALUE)
3. Ranked by model score
4. Live at propedgemasters.netlify.app

## Deployment
Every push to `main` or `master` automatically deploys to Netlify via GitHub Actions. No manual steps needed!

### To Update:
1. Edit `propedge_v3.html`
2. Commit & push to GitHub
3. ✅ Live in ~10-30 seconds automatically

## Configuration
League thresholds are stored in Google Sheets (Config tab). Hard refresh the app (`Cmd+Shift+R`) to pick up new config.

## Files
- `propedge_v3.html` - Main application
- `.github/workflows/deploy.yml` - Auto-deployment workflow
- `README.md` - This file

---

**Built with ❤️ for smarter betting**
