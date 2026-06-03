#!/bin/bash

# PropEdge Scheduler Setup Script
# ==============================
# Run this on your Mac to install the automatic scraper scheduler
#
# Usage:
#   bash /Users/devonjohnson/Documents/Claude/Projects/PropEdge/SETUP_SCHEDULER.sh

set -e

PROJECT_DIR="/Users/devonjohnson/Documents/Claude/Projects/PropEdge"
PLIST_SOURCE="$PROJECT_DIR/com.propedge.scraper.plist"
PLIST_DEST="$HOME/Library/LaunchAgents/com.propedge.scraper.plist"
SCRIPT_PATH="$PROJECT_DIR/scraper-launcher.sh"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║        PropEdge Scheduler Installation                     ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check if source files exist
if [ ! -f "$PLIST_SOURCE" ]; then
    echo "❌ ERROR: Plist file not found at $PLIST_SOURCE"
    exit 1
fi

if [ ! -f "$SCRIPT_PATH" ]; then
    echo "❌ ERROR: Launcher script not found at $SCRIPT_PATH"
    exit 1
fi

echo "Step 1: Creating LaunchAgents directory..."
mkdir -p "$HOME/Library/LaunchAgents"
echo "✅ Directory ready"
echo ""

echo "Step 2: Unloading any existing job..."
launchctl bootout "gui/$(id -u)" "$PLIST_DEST" 2>/dev/null || true
echo "✅ Previous job removed (if any)"
echo ""

echo "Step 3: Copying plist file..."
cp "$PLIST_SOURCE" "$PLIST_DEST"
chmod 644 "$PLIST_DEST"
chmod +x "$SCRIPT_PATH"
echo "✅ Plist copied and permissions set"
echo ""

echo "Step 4: Validating plist syntax..."
if plutil -lint "$PLIST_DEST" > /dev/null 2>&1; then
    echo "✅ Plist is valid XML"
else
    echo "⚠️  Plist validation warning (may still work)"
fi
echo ""

echo "Step 5: Loading LaunchAgent..."
launchctl bootstrap "gui/$(id -u)" "$PLIST_DEST" || {
    echo "❌ Bootstrap failed"
    exit 1
}
echo ""

echo "Step 6: Verifying installation..."
if launchctl list | grep -q "com.propedge.scraper"; then
    echo "✅ Scheduler is registered and active"
    echo ""
    echo "════════════════════════════════════════════════════════════"
    echo "✅ SUCCESS! PropEdge Scheduler is installed"
    echo "════════════════════════════════════════════════════════════"
    echo ""
    echo "Your scraper will run automatically:"
    echo "  • Every 15 minutes"
    echo ""
    echo "Logs will be saved to:"
    echo "  $PROJECT_DIR/logs/"
    echo ""
    echo "To check status:"
    echo "  launchctl list | grep propedge"
    echo ""
    echo "To view logs:"
    echo "  tail -f $PROJECT_DIR/logs/scraper-daemon.log"
    echo ""
    echo "To uninstall:"
    echo "  launchctl bootout gui/\$(id -u) ~/Library/LaunchAgents/com.propedge.scraper.plist"
    echo ""
else
    echo "❌ LaunchAgent not found in system"
    exit 1
fi
