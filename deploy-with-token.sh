#!/bin/bash
# Deploy PropEdge to Netlify with auth token
# Run this from your Mac

set -e

echo "🚀 Deploying PropEdge with Netlify auth token..."
echo ""

# Navigate to PropEdge directory
cd "$(dirname "$0")" || exit 1

# Set auth token (from .env or directly)
export NETLIFY_AUTH_TOKEN="nfp_VediMBiQFFgRzFvYZqubcJw6kESnygEK8e4b"
export NETLIFY_SITE_ID="838cca00-a711-4175-b00e-95203cda9900"

echo "📤 Uploading propedge-deploy to Netlify..."
npx netlify deploy --prod --dir=propedge-deploy

echo ""
echo "✅ Deployment complete!"
echo "🌐 Live URL: https://propedgemasters.netlify.app"
echo "🔄 Hard refresh (Cmd+Shift+R) to see props with fresh data!"
