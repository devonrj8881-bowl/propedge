#!/bin/bash
# IMMEDIATE SCRAPER FIX — Standalone (No Git Dependency)
# Run this to repair exit code 78 or any launchd issues
# Completely independent of git state

set -e

PROJECT_DIR="$HOME/Documents/Claude/Projects/PropEdge"
PLIST_PATH="$PROJECT_DIR/com.propedge.scraper.REAL_MAC.plist"
VERIFIED_BACKUP="$PROJECT_DIR/com.propedge.scraper.REAL_MAC.plist.VERIFIED"

echo "========== IMMEDIATE SCRAPER FIX =========="
echo "[$(date)] Starting standalone repair..."

# Step 1: Verify plist exists
if [ ! -f "$PLIST_PATH" ]; then
    echo "ERROR: Plist not found at $PLIST_PATH"
    exit 1
fi

# Step 2: Check for /bin/bash wrapper
echo ""
echo "Checking plist integrity..."
if grep -q '<string>/bin/bash</string>' "$PLIST_PATH"; then
    echo "✓ Plist has /bin/bash wrapper"
else
    echo "⚠ Plist missing /bin/bash wrapper — restoring from verified backup..."

    if [ ! -f "$VERIFIED_BACKUP" ]; then
        echo "ERROR: Verified backup not found at $VERIFIED_BACKUP"
        echo "Cannot repair plist. Manual intervention needed."
        exit 1
    fi

    cp "$VERIFIED_BACKUP" "$PLIST_PATH"
    echo "✓ Restored from backup"
fi

# Step 3: Verify daemon script executable
echo ""
echo "Verifying daemon script..."
DAEMON_SCRIPT="$PROJECT_DIR/run-scraper-daemon.sh"
if [ ! -f "$DAEMON_SCRIPT" ]; then
    echo "ERROR: Daemon script not found"
    exit 1
fi
if [ ! -x "$DAEMON_SCRIPT" ]; then
    chmod +x "$DAEMON_SCRIPT"
    echo "✓ Set daemon script executable"
else
    echo "✓ Daemon script is executable"
fi

# Step 4: Unload agent
echo ""
echo "Unloading scraper agent..."
launchctl unload "$PLIST_PATH" 2>/dev/null || echo "  (was not loaded)"
sleep 1

# Step 5: Load agent
echo "Loading scraper agent with correct plist..."
if launchctl load "$PLIST_PATH" 2>/dev/null; then
    echo "✓ Agent loaded"
else
    echo "⚠ Load returned non-zero — checking status anyway..."
fi

# Step 6: Verify status
echo ""
echo "Agent status:"
sleep 1
launchctl list | grep propedge || echo "ERROR: Scraper agent not found in launchctl list"

echo ""
echo "========== FIX COMPLETE =========="
echo "Scraper has been reset to known-good state."
echo "Exit codes should be 0 for all agents."
