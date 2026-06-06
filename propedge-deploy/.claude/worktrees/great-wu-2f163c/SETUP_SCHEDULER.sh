#!/bin/bash

# PropEdge Scheduler Setup Script
# ==============================
# Run this on your Mac to install the automatic scraper scheduler
#
# Usage:
#   bash /sessions/jolly-clever-mccarthy/mnt/PropEdge/SETUP_SCHEDULER.sh

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║        PropEdge Scheduler Installation                     ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

PLIST_SOURCE="/sessions/jolly-clever-mccarthy/mnt/PropEdge/com.propedge.scraper.plist"
PLIST_DEST="$HOME/Library/LaunchAgents/com.propedge.scraper.plist"
SCRIPT_PATH="/sessions/jolly-clever-mccarthy/mnt/PropEdge/run-scraper-daemon.sh"

# Check if source files exist
if [ ! -f "$PLIST_SOURCE" ]; then
    echo "❌ ERROR: Plist file not found at $PLIST_SOURCE"
    exit 1
fi

if [ ! -f "$SCRIPT_PATH" ]; then
    echo "❌ ERROR: Daemon script not found at $SCRIPT_PATH"
    exit 1
fi

echo "Step 1: Creating LaunchAgents directory..."
mkdir -p "$HOME/Library/LaunchAgents"
echo "✅ Directory ready"
echo ""

echo "Step 2: Copying plist file..."
cp "$PLIST_SOURCE" "$PLIST_DEST"
echo "✅ Plist copied to $PLIST_DEST"
echo ""

echo "Step 3: Setting permissions..."
chmod 644 "$PLIST_DEST"
chmod +x "$SCRIPT_PATH"
echo "✅ Permissions set"
echo ""

echo "Step 4: Validating plist syntax..."
if plutil -lint "$PLIST_DEST" > /dev/null 2>&1; then
    echo "✅ Plist is valid XML"
else
    echo "⚠️  Plist validation warning (may still work)"
fi
echo ""

echo "Step 5: Loading LaunchAgent..."
if launchctl load "$PLIST_DEST" 2>&1; then
    echo "✅ LaunchAgent loaded successfully"
else
    echo "⚠️  Standard load failed, trying bootstrap method..."
    launchctl bootstrap "gui/$(id -u)" "$PLIST_DEST" 2>&1 || {
        echo "❌ Both load methods failed"
        exit 1
    }
fi
echo ""

echo "Step 6: Verifying installation..."
if launchctl list | grep -q "com.propedge.scraper"; then
    echo "✅ Scheduler is registered and active"
    echo ""
    echo "════════════════════════════════════════════════════════════"
    echo "✅ SUCCESS! PropEdge Scheduler is installed"
    echo "════════════════════════════════════════════════════════════"
    echo ""
    echo "Your scraper will run automatically at:"
    echo "  • 11:30 AM EST (every day)"
    echo "  • 6:00 PM EST (every day)"
    echo ""
    echo "Logs will be saved to:"
    echo "  /sessions/jolly-clever-mccarthy/mnt/PropEdge/logs/"
    echo ""
    echo "To verify it's working:"
    echo "  1. Wait until tomorrow at 11:35 AM"
    echo "  2. Check the log file:"
    echo "     tail -f /sessions/jolly-clever-mccarthy/mnt/PropEdge/logs/scraper-daemon.log"
    echo ""
    echo "To uninstall:"
    echo "  launchctl unload ~/Library/LaunchAgents/com.propedge.scraper.plist"
    echo ""
else
    echo "❌ LaunchAgent not found in system"
    exit 1
fi
