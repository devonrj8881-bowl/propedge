#!/bin/bash

# PropEdge Unified Deploy + Commit + Push
# Usage: ./deploy-all.sh "Your commit message"

set -e

COMMIT_MSG="${1:-Update PropEdge}"
REPO_ROOT="/Users/devonjohnson/Documents/Claude/Projects/PropEdge"
DEPLOY_FOLDER="$REPO_ROOT/propedge-deploy"
ROOT_INDEX="$REPO_ROOT/index.html"
DEPLOY_INDEX="$DEPLOY_FOLDER/index.html"

echo "🚀 PropEdge Deploy Workflow"
echo "=================================================="

# Step 1: Sync files
echo "📁 Step 1: Syncing propedge-deploy/index.html → index.html (root)"
cp "$DEPLOY_INDEX" "$ROOT_INDEX"
echo "✅ Files synced"

# Step 2: Git status check
echo ""
echo "📊 Step 2: Git status"
cd "$REPO_ROOT"
git status --short

# Step 3: Stage files
echo ""
echo "📝 Step 3: Staging index.html + propedge-deploy/index.html"
git add index.html propedge-deploy/index.html
echo "✅ Files staged"

# Step 4: Commit
echo ""
echo "💾 Step 4: Committing to GitHub"
git commit -m "$COMMIT_MSG

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
echo "✅ Committed"

# Step 5: Push
echo ""
echo "🔺 Step 5: Pushing to origin/main"
git push origin main
echo "✅ Pushed to GitHub"

# Step 6: Deploy
echo ""
echo "🌐 Step 6: Deploying to Netlify"
./deploy-prod.sh
echo "✅ Deployed"

echo ""
echo "=================================================="
echo "✨ Complete! Live at https://propedgemasters.netlify.app"
echo ""
