---
name: PropEdge Editing Workflow - Critical Process
description: MANDATORY - How to edit index.html so changes actually work
type: feedback
---

# 🚨 CRITICAL: PropEdge File Editing Workflow

## The Key Understanding (Updated 2026-03-31)
- The workspace mount is now `propedge-deploy` — VM path: `/sessions/<session-id>/mnt/propedge-deploy/index.html`
- `/Users/devonjohnson/Documents/Claude/Projects/PropEdge/propedge-deploy/index.html` = your actual file on your Mac
- When I edit the workspace mount, it edits your actual file at the `/Users/...` path
- This is a mounted link - when I edit there, your real file is updated
- **You cannot access `/sessions/...` from Finder** - it only exists in the Claude workspace

## Your Actual Folder Path
- **Use this in Finder:** `/Users/devonjohnson/Documents/Claude/Projects/PropEdge/propedge-deploy/`
- **Via Go to Folder:** Cmd+Shift+G, then paste that path
- This is where your index.html and all memory files now live on your computer

## Why Previous Edits Failed
- I sometimes edited other files or workspace copies
- I didn't always verify edits were in the mounted folder
- The workspace and actual computer files got confused
- User had to manually copy/deploy, creating sync issues

## THE CORRECT PROCESS (Going Forward)

### Step 1: Edit
- I edit the `propedge-deploy` mount directly — find current VM path at start of each session
- I verify edits are in place by reading/grepping

### Step 2: Verify
- Verify edits are saved by reading/grepping the mount file
- File size and content should reflect the change

### Step 3: You Deploy
- You run: `cd /Users/devonjohnson/Documents/Claude/Projects/PropEdge && ./deploy-prod.sh`
- Deploys your ACTUAL file (now with latest edits)
- Netlify receives the updated file

### Step 4: Go Live
- Hard refresh (Cmd+Shift+R)
- Changes appear immediately

## What I Will NEVER Do Again
- ❌ Create alternate versions (index-fresh.html, index_v3_14.html, etc.)
- ❌ Edit files outside of the `propedge-deploy` mount
- ❌ Assume edits are saved without verifying
- ❌ Forget to confirm edits before saying "ready to deploy"

## Verification Pattern I Will Always Use
After any edit, grep the mount file to confirm the change is present. The session ID changes each session — always check the current mount path at the start of a session.

## Why This Matters
The mounted folder is the critical link. As long as I edit there and verify, your actual file is updated. When you deploy, Netlify gets the latest version. No more version confusion or sync issues.
