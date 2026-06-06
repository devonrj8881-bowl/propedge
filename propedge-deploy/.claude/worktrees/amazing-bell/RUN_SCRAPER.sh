#!/bin/bash

# PropEdge Scraper Runner
# ======================
# Run this script from Terminal to test the scraper:
#
#   cd /Users/devonjohnson/Documents/Claude/Projects/PropEdge/propedge-deploy
#   bash RUN_SCRAPER.sh

cd "$(dirname "$0")"

echo "================================"
echo "PropEdge Scraper v13"
echo "================================"
echo ""
echo "Starting scraper..."
echo ""

node scraper-v13.js

echo ""
echo "Scraper complete!"
