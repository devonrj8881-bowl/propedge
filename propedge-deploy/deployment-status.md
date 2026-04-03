---
name: PropEdge Deployment Status
description: Tracks the last deployment attempt and status
type: reference
---

# PropEdge Auto-Deploy Status

**Last Check:** 2026-03-28 (automated scheduled task)
**Source File:** `/sessions/wonderful-fervent-keller/mnt/propfinder-sync/propedge_v2.html`
**Last Modified:** 2026-03-27 11:33:18
**Deployment Status:** ⚠️ CHANGES DETECTED - DEPLOYMENT BLOCKED

## Summary
Changes detected in source HTML file (modified Mar 27 11:33), but deployment cannot proceed due to network constraints in the sandbox environment.

**Issue:** SSH/SCP commands fail with "Could not resolve hostname macbook-air.local" - this is expected in the sandboxed execution environment where external network access is restricted.

## Manual Deployment Required
To deploy the changes, run manually from your computer:
```bash
scp /sessions/wonderful-fervent-keller/mnt/propfinder-sync/propedge_v2.html devonjohnson@MacBook-Air.local:"/Users/devonjohnson/Documents/Claude\ Workspace\ Devon/02\ Projects/PropEdge/[C]\ propedge_v3.html"
ssh devonjohnson@MacBook-Air.local "bash '/Users/devonjohnson/Documents/Claude\ Workspace\ Devon/02\ Projects/PropEdge/[C]\ deploy.sh'"
```

Or use the Bash tool to run: `bash "[C] deploy.sh"`

**Live Site:** https://propedgemasters.netlify.app
