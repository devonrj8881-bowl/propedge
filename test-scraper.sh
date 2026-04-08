#!/bin/bash

# PropEdge Scraper Test Suite
# Run all validation checks before deploying to cron

set -e  # Exit on first error

PROJECT_DIR="/sessions/hopeful-optimistic-brahmagupta/mnt/PropEdge"
SCRAPER_FILE="$PROJECT_DIR/scraper-multi-sport-v1.js"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║     PropEdge Multi-Sport Scraper — Pre-Flight Tests        ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Test 1: Syntax Check
echo "[1/5] Running syntax check..."
if node -c "$SCRAPER_FILE" 2>/dev/null; then
    echo "✅ Syntax check PASSED"
else
    echo "❌ Syntax check FAILED"
    exit 1
fi
echo ""

# Test 2: Environment Variables
echo "[2/5] Checking environment variables..."
cd "$PROJECT_DIR"
if [ ! -f .env ]; then
    echo "❌ .env file not found"
    exit 1
fi

EMAIL=$(grep PROPFINDER_EMAIL .env | cut -d'=' -f2 | xargs)
SHEET_ID=$(grep GOOGLE_SHEET_ID .env | cut -d'=' -f2 | xargs)

if [ -z "$EMAIL" ] || [ -z "$SHEET_ID" ]; then
    echo "❌ Missing required env vars (PROPFINDER_EMAIL, GOOGLE_SHEET_ID)"
    exit 1
fi

echo "✅ Env vars loaded:"
echo "   Email: ${EMAIL:0:10}***"
echo "   Sheet ID: ${SHEET_ID:0:15}***"
echo ""

# Test 3: Google Sheets Credentials
echo "[3/5] Checking Google Sheets credentials..."
if [ ! -f credentials.json ]; then
    echo "❌ credentials.json not found"
    exit 1
fi
echo "✅ credentials.json exists"
echo ""

# Test 4: Chrome Detection
echo "[4/5] Detecting Chrome..."
if [ -x "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]; then
    echo "✅ Chrome found at standard location"
elif [ -x "/Applications/Chromium.app/Contents/MacOS/Chromium" ]; then
    echo "✅ Chromium found"
else
    echo "⚠️  Chrome not found at standard path (script will attempt auto-detect)"
fi
echo ""

# Test 5: Dry-Run Option
echo "[5/5] Ready for dry-run test"
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║               All Pre-Checks PASSED ✅                     ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Next: Run the scraper in visible mode to verify end-to-end:"
echo ""
echo "  cd $PROJECT_DIR"
echo "  node scraper-multi-sport-v1.js --visible"
echo ""
echo "This will:"
echo "  1. Login to PropFinder (watch browser)"
echo "  2. Download all 4 league CSVs"
echo "  3. Fetch pace data (NHL + MLB)"
echo "  4. Write to Google Sheets"
echo "  5. Verify no errors"
echo ""
echo "Then check Google Sheet for:"
echo "  ✅ All 4 league tabs (NBA, NHL, MLB, NFL) have data"
echo "  ✅ NHL tab has 'corsi_per_60' and 'xg_per_60' columns"
echo "  ✅ MLB tab has 'avg_velocity' and 'pitches_per_ab' columns"
echo "  ✅ Props_History tab has timestamped entries"
echo ""
