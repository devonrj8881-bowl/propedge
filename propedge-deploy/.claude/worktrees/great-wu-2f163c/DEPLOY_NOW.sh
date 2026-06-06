#!/bin/bash
# Quick deploy script for PropEdge
# Run this from your Mac to deploy the latest changes

echo "🚀 Deploying PropEdge to Netlify..."

# Navigate to PropEdge directory
cd "$(dirname "$0")" || exit 1

# Option 1: Drag-and-drop via Netlify UI (easiest)
echo ""
echo "📋 Two ways to deploy:"
echo ""
echo "OPTION A (Easiest - Drag & Drop):"
echo "  1. Go to: https://app.netlify.com/"
echo "  2. Find 'propedgemasters' site"
echo "  3. Drag this folder onto the deploy area:"
echo "     $(pwd)/propedge-deploy"
echo ""
echo "OPTION B (CLI with Auth Token):"
echo "  1. Get your Netlify Personal Access Token"
echo "  2. Run:"
echo "     export NETLIFY_AUTH_TOKEN='your-token-here'"
echo "     npx netlify deploy --prod --dir=propedge-deploy"
echo ""
echo "✅ After deploy, hard refresh the site: Cmd+Shift+R"
echo "✅ Props should now appear with data from your scraper!"
