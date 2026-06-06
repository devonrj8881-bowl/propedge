#!/bin/bash

echo "🔧 Fixing and deploying PropEdge pace pipeline..."
echo ""

# Step 1: Remove git lock
echo "1️⃣  Removing git lock file..."
rm -f .git/index.lock
echo "✅ Git lock removed"

echo ""
echo "2️⃣  Checking git status..."
git status --short | head -20

echo ""
echo "3️⃣  Adding pace pipeline files..."
git add propedge-data.json init-db.js sync-espn-pace.js netlify/functions/pace-data.js test-pace-api.js netlify.toml DEPLOY_INSTRUCTIONS.txt QUICK_REFERENCE.md COMPLETION_SUMMARY.txt 2>/dev/null || true

echo ""
echo "4️⃣  Committing changes..."
git commit -m "Add SQLite-based pace data pipeline with Netlify Function

- propedge-data.json: JSON database for pace data and predictions
- sync-espn-pace.js: ESPN API sync script (runs at 11:30 AM & 6 PM EST)
- netlify/functions/pace-data.js: REST API endpoint for pace data
- Scheduled tasks for automatic daily syncs
- Zero Firebase complexity - pure JSON-based solution"

echo ""
echo "5️⃣  Pushing to GitHub..."
git push origin main

echo ""
echo "6️⃣  Deploying to Netlify..."
./deploy-prod.sh

echo ""
echo "✅ All done!"
echo ""
echo "🧪 Test the API:"
echo "curl 'https://propedgemasters.netlify.app/.netlify/functions/pace-data?action=all'"
