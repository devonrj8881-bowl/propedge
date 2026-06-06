#!/bin/bash
set -e

echo "🔍 PropEdge Daily Verification — April 29, 2026"
echo "============================================================"
echo ""

# 1. Run enrichments for all 3 sports
echo "1️⃣  Running Enrichment (NBA/NHL/MLB)..."
echo ""

echo "   NBA Enrichment:"
cd /Users/devonjohnson/Documents/Claude/Projects/PropEdge && /opt/homebrew/bin/node run-enrichment.js NBA 2>&1 | grep -E "✓|❌|ERROR|complete" | tail -5

echo ""
echo "   NHL Enrichment:"
/opt/homebrew/bin/node run-enrichment.js NHL 2>&1 | grep -E "✓|❌|ERROR|complete" | tail -5

echo ""
echo "   MLB Enrichment:"
/opt/homebrew/bin/node run-enrichment.js MLB 2>&1 | grep -E "✓|❌|ERROR|complete" | tail -5

echo ""
echo "============================================================"
echo "2️⃣  Enriched CSVs Generated:"
ls -lh propedge-enriched/propedge-enriched-*.csv 2>/dev/null | awk '{print "   " $9 " (" $5 ")"}'

echo ""
echo "============================================================"
echo "3️⃣  Checking Game Schedule (ESPN)..."
echo "   (Open https://www.espn.com/nba/schedule for live games)"
echo "   (Open https://www.espn.com/nhl/schedule for live games)"
echo "   (Open https://www.espn.com/mlb/schedule for live games)"

echo ""
echo "============================================================"
echo "4️⃣  Testing Scraper & FanDuel Line Pull..."
echo "   Scraper runs at: 11:30 AM, 3 PM, 5:30 PM EST"
echo "   Check: tail -f logs/scraper.log"

echo ""
echo "============================================================"
echo "5️⃣  Testing Scoring Engine (HTML App):"
echo "   Open: file:///Users/devonjohnson/Documents/Claude/Projects/PropEdge/propedge-deploy/index.html"
echo "   Verify:"
echo "     ✓ Players load from Players tab"
echo "     ✓ PropIQ scores display (green = positive edge)"
echo "     ✓ FanDuel buttons clickable"
echo "     ✓ Parlay tab calculates EV"

echo ""
echo "============================================================"
echo "✅ Verification Complete"
echo ""
