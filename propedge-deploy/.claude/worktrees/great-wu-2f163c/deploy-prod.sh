#!/bin/bash
# PropEdge Production Deploy Script
# Simple one-command deploy to Netlify

set -e

echo "🚀 Deploying PropEdge to production..."
echo ""

# Make sure we're in the right directory
cd "$(dirname "$0")"

# Check if netlify CLI is installed
if ! command -v netlify &> /dev/null; then
    echo "📦 Installing Netlify CLI..."
    npm install -g netlify-cli
fi

# Deploy to Netlify — propedge-deploy is the source of truth
echo "📤 Uploading to Netlify..."
netlify deploy --prod --dir=propedge-deploy

echo ""
echo "✅ Deployment complete!"
echo "🌐 Live URL: https://propedgemasters.netlify.app"
