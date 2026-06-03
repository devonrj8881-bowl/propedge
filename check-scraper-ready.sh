#!/bin/bash
# Verify PropEdge scraper is ready to run automatically

echo "🔍 Checking PropEdge Scraper Prerequisites..."
echo "=============================================="
echo ""

# 1. Check Chrome
echo "1️⃣  Chrome Browser..."
if [ -f "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]; then
    echo "   ✅ Chrome found at standard location"
elif command -v google-chrome &> /dev/null; then
    echo "   ⚠️  Chrome found at: $(which google-chrome)"
    echo "   Note: Scraper uses hardcoded path. May need update."
elif command -v chromium &> /dev/null; then
    echo "   ⚠️  Chromium found at: $(which chromium)"
    echo "   Note: Scraper uses hardcoded path. May need update."
else
    echo "   ❌ Chrome not found! Scraper will fail."
    exit 1
fi
echo ""

# 2. Check .env file
echo "2️⃣  Environment Variables (.env)..."
if [ -f "$(pwd)/.env" ]; then
    if grep -q "PROPFINDER_EMAIL" "$(pwd)/.env"; then
        echo "   ✅ PROPFINDER_EMAIL set"
    else
        echo "   ❌ PROPFINDER_EMAIL missing"
        exit 1
    fi

    if grep -q "PROPFINDER_PASSWORD" "$(pwd)/.env"; then
        echo "   ✅ PROPFINDER_PASSWORD set"
    else
        echo "   ❌ PROPFINDER_PASSWORD missing"
        exit 1
    fi

    if grep -q "GOOGLE_SHEET_ID" "$(pwd)/.env"; then
        echo "   ✅ GOOGLE_SHEET_ID set"
    else
        echo "   ❌ GOOGLE_SHEET_ID missing"
        exit 1
    fi
else
    echo "   ❌ .env file not found!"
    exit 1
fi
echo ""

# 3. Check credentials.json
echo "3️⃣  Google Sheets Credentials..."
if [ -f "$(pwd)/credentials.json" ]; then
    echo "   ✅ credentials.json exists"
else
    echo "   ❌ credentials.json not found!"
    exit 1
fi
echo ""

# 4. Check npm dependencies
echo "4️⃣  NPM Dependencies..."
if [ -d "$(pwd)/node_modules" ]; then
    if [ -d "$(pwd)/node_modules/puppeteer-core" ]; then
        echo "   ✅ puppeteer-core installed"
    else
        echo "   ❌ puppeteer-core missing"
        exit 1
    fi

    if [ -d "$(pwd)/node_modules/googleapis" ]; then
        echo "   ✅ googleapis installed"
    else
        echo "   ❌ googleapis missing"
        exit 1
    fi

    if [ -d "$(pwd)/node_modules/dotenv" ]; then
        echo "   ✅ dotenv installed"
    else
        echo "   ❌ dotenv missing"
        exit 1
    fi
else
    echo "   ❌ node_modules not found! Run: npm install"
    exit 1
fi
echo ""

# 5. Check scraper file
echo "5️⃣  Scraper Script..."
if [ -f "$(pwd)/scraper-v15-integrated.js" ]; then
    echo "   ✅ scraper-v15-integrated.js found"
else
    echo "   ❌ scraper-v15-integrated.js not found!"
    exit 1
fi
echo ""

echo "=============================================="
echo "✅ All checks passed! Scraper is ready."
echo ""
echo "Scraper will run automatically every 15 minutes."
echo ""
echo "Manual run: bash scraper-launcher.sh"
