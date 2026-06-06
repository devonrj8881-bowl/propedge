# PropEdge Deploy Workflow — GitHub + Netlify Synchronized

## Quick Command
```bash
./deploy-all.sh "Your commit message here"
```

## What It Does
1. ✅ Syncs `propedge-deploy/index.html` → `index.html` (root)
2. ✅ Stages both files in git
3. ✅ Commits with message
4. ✅ Pushes to GitHub (main branch)
5. ✅ Deploys to Netlify
6. ✅ Confirms live at propedgemasters.netlify.app

---

## Manual Workflow (if script unavailable)

### Step 1: Sync Files
```bash
cp /Users/devonjohnson/Documents/Claude/Projects/PropEdge/propedge-deploy/index.html \
   /Users/devonjohnson/Documents/Claude/Projects/PropEdge/index.html
```

### Step 2: Commit to GitHub
```bash
cd /Users/devonjohnson/Documents/Claude/Projects/PropEdge

# Stage both files
git add index.html propedge-deploy/index.html

# Commit with message
git commit -m "Your message here

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"

# Push to main
git push origin main
```

### Step 3: Deploy to Netlify
```bash
./deploy-prod.sh
```

### Step 4: Verify Live
- Hard refresh: https://propedgemasters.netlify.app
- Check deploy log: `logs/deploy-YYYYMMDD-HHMMSS.log`

---

## Netlify Functions (Mirror Required)

After editing any function in `netlify/functions/`:
```bash
# Copy to deploy folder
cp netlify/functions/[filename].js propedge-deploy/netlify/functions/[filename].js

# Then commit both
git add netlify/functions/[filename].js propedge-deploy/netlify/functions/[filename].js
git commit -m "Update [filename]"
git push origin main
./deploy-prod.sh
```

---

## Never Do This
❌ Deploy without committing to GitHub
❌ Commit without syncing both index.html files
❌ Edit root index.html directly (sync from propedge-deploy only)
❌ Push without deploying (unless intentional pre-stage)

---

## Environment
- **Git Remote:** https://github.com/devonrj8881-bowl/propedge
- **Netlify Site:** propedgemasters (838cca00-a711-4175-b00e-95203cda9900)
- **Live URL:** https://propedgemasters.netlify.app
- **Local Root:** /Users/devonjohnson/Documents/Claude/Projects/PropEdge

