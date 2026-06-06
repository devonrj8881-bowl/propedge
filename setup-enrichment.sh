#!/bin/bash

###############################################################################
# PropEdge Data Enrichment Setup
#
# Installs dependencies and sets up daily cron jobs for data enrichment
# Run this once to bootstrap the system
#
# Usage: ./setup-enrichment.sh
###############################################################################

set -e

echo "=========================================="
echo "PropEdge Data Enrichment Setup"
echo "=========================================="
echo ""

# ============================================================================
# 1. CHECK DEPENDENCIES
# ============================================================================

echo "[1/5] Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Install from https://nodejs.org"
    exit 1
fi
echo "✓ Node.js $(node -v) found"

echo ""
echo "[2/5] Installing npm dependencies..."
npm install googleapis google-auth-library
echo "✓ Dependencies installed"

# ============================================================================
# 2. SET UP GOOGLE CREDENTIALS
# ============================================================================

echo ""
echo "[3/5] Google Credentials Setup"
echo "=========================================="
echo ""
echo "You need to:"
echo "1. Go to https://console.cloud.google.com/apis/credentials"
echo "2. Create a Service Account (JSON key)"
echo "3. Save it as: /Users/devonjohnson/propedge-service-account.json"
echo "4. Enable Sheets API"
echo ""

read -p "Have you created the service account? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ -f "/Users/devonjohnson/propedge-service-account.json" ]; then
        echo "✓ Service account found"
    else
        echo "❌ Service account not found at expected path"
        echo "   Please create and place at: /Users/devonjohnson/propedge-service-account.json"
        exit 1
    fi
fi

# ============================================================================
# 3. SET ENVIRONMENT VARIABLES
# ============================================================================

echo ""
echo "[4/5] Setting up environment variables..."

BASHRC_PATH="$HOME/.bash_profile"
if [ ! -f "$BASHRC_PATH" ]; then
    BASHRC_PATH="$HOME/.zprofile"
fi

# Check if already set
if grep -q "GOOGLE_APPLICATION_CREDENTIALS" "$BASHRC_PATH"; then
    echo "✓ Environment variables already set"
else
    echo "Adding environment variables to $BASHRC_PATH..."
    cat >> "$BASHRC_PATH" << 'EOF'

# PropEdge Data Enrichment
export GOOGLE_APPLICATION_CREDENTIALS="/Users/devonjohnson/propedge-service-account.json"
export PROPEDGE_SHEET_ID="YOUR_SHEET_ID_HERE"
export PROPEDGE_HOME="/Users/devonjohnson/Documents/Claude/Projects/PropEdge"
EOF
    source "$BASHRC_PATH"
    echo "✓ Environment variables set"
fi

# ============================================================================
# 4. CREATE CRON JOBS
# ============================================================================

echo ""
echo "[5/5] Setting up cron jobs..."

CRON_FILE="/tmp/propedge-cron.txt"

# NBA enrichment at 11:30 AM EST (shift 5 hours to avoid race conditions)
# NHL enrichment at 3:00 PM EST
# MLB enrichment at 5:30 PM EST

cat > "$CRON_FILE" << 'EOF'
# PropEdge Data Enrichment Schedule (EST)

# NBA: Daily at 11:30 AM
30 11 * * * cd /Users/devonjohnson/Documents/Claude/Projects/PropEdge && node run-enrichment.js NBA >> ./logs/enrichment-nba.log 2>&1

# NHL: Daily at 3:00 PM
0 15 * * * cd /Users/devonjohnson/Documents/Claude/Projects/PropEdge && node run-enrichment.js NHL >> ./logs/enrichment-nhl.log 2>&1

# MLB: Daily at 5:30 PM
30 17 * * * cd /Users/devonjohnson/Documents/Claude/Projects/PropEdge && node run-enrichment.js MLB >> ./logs/enrichment-mlb.log 2>&1

# Weekly summary: Every Sunday at 8 PM
0 20 * * 0 cd /Users/devonjohnson/Documents/Claude/Projects/PropEdge && node generate-weekly-report.js >> ./logs/weekly-report.log 2>&1
EOF

# Create logs directory
mkdir -p "/Users/devonjohnson/Documents/Claude/Projects/PropEdge/logs"

# Install cron jobs
crontab -l 2>/dev/null | grep -v "PropEdge" > /tmp/existing-cron.txt || true
cat /tmp/existing-cron.txt "$CRON_FILE" | crontab -
echo "✓ Cron jobs installed"

echo ""
echo "=========================================="
echo "✓ Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Set PROPEDGE_SHEET_ID in ~/.bash_profile (or ~/.zprofile)"
echo "   Your sheet ID: https://docs.google.com/spreadsheets/d/YOUR_ID_HERE"
echo ""
echo "2. Test the enrichment:"
echo "   node run-enrichment.js NBA"
echo ""
echo "3. Cron jobs are scheduled:"
echo "   - NBA: 11:30 AM EST"
echo "   - NHL: 3:00 PM EST"
echo "   - MLB: 5:30 PM EST"
echo ""
echo "4. View cron logs:"
echo "   tail -f ./logs/enrichment-nba.log"
echo ""
echo "=========================================="
