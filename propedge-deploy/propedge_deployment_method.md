---
name: PropEdge Deployment Method
description: Direct Netlify CLI deploys instead of GitHub Actions — faster, simpler, instant feedback
type: reference
---

## Deploy Command

**Use this for all PropEdge production deployments:**

```bash
cd /Users/devonJohnson/Documents/Claude/Projects/PropEdge
./deploy-prod.sh
```

## Why This Method

- ✅ **Fast:** ~5 seconds deployment vs waiting for GitHub Actions
- ✅ **Simple:** One command, instant feedback
- ✅ **No git needed:** No commit/push friction
- ✅ **Direct control:** You see exactly what's deploying

## Netlify Project

- **Site:** https://propedgemasters.netlify.app
- **Project:** propedgemasters
- **Linked:** Yes (project is authenticated and linked locally)

## Script Location

- `/Users/devonJohnson/Documents/Claude/Projects/PropEdge/deploy-prod.sh`
- Script automatically checks for netlify CLI and installs if needed
- No GitHub Actions workflow is used for deployment
