#!/bin/bash

echo "🚀 PropEdge SQLite Pace Data Pipeline — Deployment"
echo "====================================================="
echo ""

# Check if we're in the right directory
if [ ! -f "propedge-data.json" ] || [ ! -f "sync-espn-pace.js" ]; then
  echo "❌ Error: Required files not found. Make sure you're in the PropEdge directory."
  exit 1
fi

echo "✅ All required files found"
echo ""

# Check git status
echo "📋 Git Status:"
git status --short | head -10

echo ""
echo "🔄 Adding files to git..."
git add propedge-data.json init-db.js sync-espn-pace.js netlify/functions/pace-data.js test-pace-api.js QUICK_REFERENCE.md PROPEDGE_SQLITE_DEPLOYMENT.md SQLITE_SETUP.md COMPLETION_SUMMARY.txt

echo ""
echo "💾 Committing to git..."
git commit -m "Add SQLite-based pace data pipeline with Netlify Function and scheduled tasks"

echo ""
echo "📤 Pushing to origin..."
git push origin main

echo ""
echo "🌐 Deploying to Netlify..."
./deploy-prod.sh

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🧪 Test the API:"
echo "curl 'https://propedgemasters.netlify.app/.netlify/functions/pace-data?action=all'"
echo ""
echo "📅 Scheduled syncs:"
echo "  • 11:30 AM EST (morning)"
echo "  • 6:00 PM EST (evening)"
echo ""
echo "Manage tasks in Cowork sidebar → Scheduled section"
