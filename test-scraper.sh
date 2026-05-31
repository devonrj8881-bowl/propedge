#!/bin/bash
# Manual scraper test — run the launcher directly without launchd scheduling

set -e

PROJECT_DIR="/Users/devonjohnson/Documents/Claude/Projects/PropEdge"
cd "$PROJECT_DIR"

echo "PropEdge Scraper Manual Test"
echo "=============================="
echo "Working directory: $PROJECT_DIR"
echo ""
echo "Running scraper launcher with retry logic..."
echo ""

bash scraper-launcher.sh

echo ""
echo "✅ Test complete — check logs/scraper-launcher-*.log for details"
