#!/bin/bash

# PropEdge Scraper Runner
# ======================
# Run this script from Terminal to manually run the scraper:
#
#   cd /Users/devonjohnson/Documents/Claude/Projects/PropEdge
#   bash RUN_SCRAPER.sh

cd "$(dirname "$0")"

echo "================================"
echo "PropEdge Scraper v15"
echo "================================"
echo ""
echo "Starting scraper with retry logic..."
echo ""

bash scraper-launcher.sh

echo ""
echo "Scraper complete!"
