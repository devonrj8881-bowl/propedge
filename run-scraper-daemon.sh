#!/bin/bash

# PropEdge Scraper Daemon Launcher
# ================================
# This script is called by launchd (macOS scheduler)
# It handles proper environment setup and ensures Chrome can launch

set -e

PROJECT_DIR="/Users/devonjohnson/Documents/Claude/Projects/PropEdge"
LOG_DIR="$PROJECT_DIR/logs"
TIMESTAMP=$(date '+%Y-%m-%d_%H-%M-%S')
RUN_LOG="$LOG_DIR/scraper-run-$TIMESTAMP.log"

# Ensure logs directory exists
mkdir -p "$LOG_DIR"

{
  echo "════════════════════════════════════════════════════"
  echo "PropEdge Scraper Daemon Start"
  echo "Time: $(date)"
  echo "════════════════════════════════════════════════════"
  echo ""

  # Set proper PATH for launchd (which doesn't inherit user shell environment)
  export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin"
  export HOME="/Users/devonjohnson"

  # Load .env
  cd "$PROJECT_DIR"
  if [ ! -f .env ]; then
    echo "ERROR: .env file not found at $PROJECT_DIR/.env"
    exit 1
  fi

  # Source environment
  set -a
  source .env
  set +a

  echo "✅ Environment loaded"
  echo "   Email: ${PROPFINDER_EMAIL:0:20}***"
  echo "   Sheet ID: ${GOOGLE_SHEET_ID:0:20}***"
  echo ""

  # Check Node.js
  if ! command -v node &> /dev/null; then
    echo "ERROR: node not found in PATH"
    echo "PATH: $PATH"
    exit 1
  fi
  echo "✅ Node found: $(node --version)"
  echo ""

  # Find Chrome
  CHROME_PATH=""
  if [ -x "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]; then
    CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    echo "✅ Chrome found at standard location"
  elif [ -x "/Applications/Chromium.app/Contents/MacOS/Chromium" ]; then
    CHROME_PATH="/Applications/Chromium.app/Contents/MacOS/Chromium"
    echo "✅ Chromium found"
  else
    echo "⚠️  Chrome not found — Puppeteer will auto-detect (may fail)"
  fi
  echo ""

  # Run scraper
  echo "Starting scraper: scraper-v13.js"
  echo "────────────────────────────────────────────────"
  echo ""

  node "$PROJECT_DIR/scraper-v13.js" 2>&1

  EXIT_CODE=$?
  echo ""
  echo "────────────────────────────────────────────────"
  if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Scraper completed successfully"
  else
    echo "❌ Scraper failed with exit code: $EXIT_CODE"
  fi
  echo "Time: $(date)"
  echo "════════════════════════════════════════════════════"

  exit $EXIT_CODE

} | tee "$RUN_LOG"
