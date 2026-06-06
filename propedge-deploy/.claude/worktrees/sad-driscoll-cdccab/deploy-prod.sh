#!/bin/bash

# PropEdge Netlify Deployment Script
# Deploys to Netlify production using Netlify CLI

PROJECT_DIR="$HOME/Documents/Claude/Projects/PropEdge"
DEPLOY_DIR="$PROJECT_DIR/propedge-deploy"
LOG_DIR="$PROJECT_DIR/logs"

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

echo "[$TIMESTAMP] Starting Netlify deployment..." >> "$LOG_DIR/deploy.log"

# Check if index.html exists
if [ ! -f "$DEPLOY_DIR/index.html" ]; then
    echo "[$TIMESTAMP] ERROR: index.html not found at $DEPLOY_DIR/index.html" >> "$LOG_DIR/deploy.log"
    exit 1
fi

echo "[$TIMESTAMP] Deploying to Netlify site: 838cca00-a711-4175-b00e-95203cda9900" >> "$LOG_DIR/deploy.log"

cd "$PROJECT_DIR" || exit 1

# Deploy using Netlify CLI
export NETLIFY_SITE_ID=838cca00-a711-4175-b00e-95203cda9900
export NETLIFY_AUTH_TOKEN=nfp_C6xSikdZfRwvoPWuYJ8JACAeGtATKMT52224

DEPLOY_OUTPUT=$(netlify deploy --prod --dir=propedge-deploy 2>&1)
DEPLOY_EXIT_CODE=$?

echo "[$TIMESTAMP] Deployment output: $DEPLOY_OUTPUT" >> "$LOG_DIR/deploy.log"

if [ $DEPLOY_EXIT_CODE -eq 0 ]; then
    echo "[$TIMESTAMP] ✅ Deployment completed successfully" >> "$LOG_DIR/deploy.log"
    echo "[$TIMESTAMP] URL: https://propedgemasters.netlify.app" >> "$LOG_DIR/deploy.log"
    exit 0
else
    echo "[$TIMESTAMP] ❌ Deployment failed with exit code $DEPLOY_EXIT_CODE" >> "$LOG_DIR/deploy.log"
    exit 1
fi
