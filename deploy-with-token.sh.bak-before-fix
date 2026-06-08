#!/bin/bash
# Deploy PropEdge to Netlify with auth token
# Run this from your Mac

set -e

echo "🚀 Deploying PropEdge with Netlify auth token..."
echo ""

# Navigate to PropEdge directory
cd "$(dirname "$0")" || exit 1

# Load credentials from .env
if [ -f ".env" ]; then
  set -a
  source ".env"
  set +a
fi

# Ensure credentials are set
if [ -z "$NETLIFY_AUTH_TOKEN" ] || [ -z "$NETLIFY_SITE_ID" ]; then
  echo "❌ Error: NETLIFY_AUTH_TOKEN or NETLIFY_SITE_ID not set in .env"
  exit 1
fi

echo "📤 Uploading propedge-deploy to Netlify..."
npx netlify deploy --prod --dir=propedge-deploy

echo ""
echo "✅ Deployment complete!"
echo "🌐 Live URL: https://propedgemasters.netlify.app"
echo "🔄 Hard refresh (Cmd+Shift+R) to see props with fresh data!"
