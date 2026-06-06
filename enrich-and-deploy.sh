#!/bin/bash

# PropEdge Full Enrichment Pipeline
# Executes: Generate enrichment → Merge into Sheets → Deploy to production
# Usage: ./enrich-and-deploy.sh [LEAGUE] [DATE]
# Example: ./enrich-and-deploy.sh NBA 2026-04-30
# Default: NBA today

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LEAGUE="${1:-NBA}"
DATE="${2:-$(date '+%Y-%m-%d')}"
LOG_DIR="$PROJECT_DIR/logs"

# Create logs directory if it doesn't exist
mkdir -p "$LOG_DIR"

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
LOG_FILE="$LOG_DIR/enrich-deploy-$(date '+%Y%m%d-%H%M%S').log"

echo "[$TIMESTAMP] Starting PropEdge Enrichment Pipeline" | tee -a "$LOG_FILE"
echo "[$TIMESTAMP] League: $LEAGUE | Date: $DATE" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# ===== STAGE 1: Generate Enrichment Data =====
echo "[$TIMESTAMP] STAGE 1/3: Generating enrichment data..." | tee -a "$LOG_FILE"
cd "$PROJECT_DIR"

if ! node run-enrichment.js "$LEAGUE" "$DATE" >> "$LOG_FILE" 2>&1; then
    echo "[$TIMESTAMP] ❌ Stage 1 failed: Enrichment generation error" | tee -a "$LOG_FILE"
    exit 1
fi

echo "[$TIMESTAMP] ✅ Stage 1 complete: Enrichment CSV generated" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# ===== STAGE 2: Merge into Google Sheets =====
echo "[$TIMESTAMP] STAGE 2/3: Merging enrichment into Google Sheets..." | tee -a "$LOG_FILE"

if ! node scraper-v15-integrated.js "$LEAGUE" >> "$LOG_FILE" 2>&1; then
    echo "[$TIMESTAMP] ❌ Stage 2 failed: Scraper merge error" | tee -a "$LOG_FILE"
    exit 1
fi

echo "[$TIMESTAMP] ✅ Stage 2 complete: Enrichment merged into Sheets" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# ===== STAGE 3: Deploy to Production =====
echo "[$TIMESTAMP] STAGE 3/3: Deploying to Netlify..." | tee -a "$LOG_FILE"

if ! ./deploy-prod.sh >> "$LOG_FILE" 2>&1; then
    echo "[$TIMESTAMP] ❌ Stage 3 failed: Deployment error" | tee -a "$LOG_FILE"
    exit 1
fi

echo "[$TIMESTAMP] ✅ Stage 3 complete: Deployed to production" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# ===== Success =====
echo "[$TIMESTAMP] ✅ FULL PIPELINE COMPLETE" | tee -a "$LOG_FILE"
echo "[$TIMESTAMP] Site: https://propedgemasters.netlify.app" | tee -a "$LOG_FILE"
echo "[$TIMESTAMP] Log: $LOG_FILE" | tee -a "$LOG_FILE"
