---
name: PropEdge GitHub + Netlify Deployment Pipeline
description: Automated deployment workflow via GitHub Actions (replaced SSH approach)
type: project
---

## Setup Complete: March 28, 2026

**Status:** ✅ Fully automated GitHub → Netlify deployment pipeline

### Infrastructure
- **GitHub Repo:** https://github.com/devonrj8881-bowl/propedge
- **Live Site:** https://propedgemasters.netlify.app
- **Deployment Method:** GitHub Actions → Netlify API
- **Auto-Deploy Frequency:** Every 15 minutes (scheduled task)

### How It Works
1. Edit `propedge_v3.html` in workspace
2. Scheduled task runs every 15 minutes:
   - Detects changes
   - Commits with timestamp
   - Pushes to GitHub
3. GitHub Actions workflow runs automatically
4. Netlify deploys changes
5. Live within 10-30 seconds

### Key Files
- `.github/workflows/deploy.yml` - GitHub Actions workflow
- `propedge_v3.html` - Main application (with season matchup color scheme)
- `README.md` - Project documentation
- `.gitignore` - Ignore temporary files

### GitHub Secrets (Required)
- `NETLIFY_TOKEN` - Stored in GitHub repo settings
- `NETLIFY_SITE_ID` - `838cca00-a711-4175-b00e-95203cda9900`

### Why This Approach
- ✅ Sandbox network isolation can't SSH to Mac
- ✅ Sandbox can't reach Netlify API directly
- ✅ GitHub Actions runs on GitHub servers (no sandbox limits)
- ✅ No manual deployment steps needed

### Scheduled Task
- **ID:** `propedge-auto-deploy`
- **Schedule:** Every 15 minutes (`*/15 * * * *`)
- **Status:** Enabled and active
- **Next run:** Check at https://github.com/devonrj8881-bowl/propedge/actions

### Important Notes
- Don't need to manually push from Mac anymore
- All commits include timestamp (e.g., "Auto-deploy: 2026-03-28 14:30:00")
- GitHub Actions logs visible at repo Actions tab
- Netlify deployment visible at app within seconds

**Why:** Fully automated removes friction from deployment process
