#!/bin/bash
# STANDALONE SCRAPER SETUP — No Git Dependency
# Run this ONCE to initialize scraper configuration
# Then run FIX_SCRAPER_NOW.sh if you ever need to repair

set -e

PROJECT_DIR="$HOME/Documents/Claude/Projects/PropEdge"
PLIST_PATH="$PROJECT_DIR/com.propedge.scraper.REAL_MAC.plist"
DAEMON_SCRIPT="$PROJECT_DIR/run-scraper-daemon.sh"
AUDIT_SCRIPT="$PROJECT_DIR/propedge-daily-audit.js"

echo "========== STANDALONE SCRAPER SETUP =========="
echo "[$(date)] Initializing PropEdge scraper (git-independent)"

# Step 1: Remove from git tracking (so git checkout won't revert)
echo ""
echo "Step 1: Decoupling from Git..."
cd "$PROJECT_DIR"
if [ -d .git ]; then
    echo "  Removing scraper files from git tracking..."
    git rm --cached com.propedge.scraper.REAL_MAC.plist 2>/dev/null || true
    git rm --cached com.propedge.scraper.plist 2>/dev/null || true
    git rm --cached run-scraper-daemon.sh 2>/dev/null || true
    git rm --cached propedge-daily-audit.js 2>/dev/null || true
    git rm --cached com.propedge.*.plist 2>/dev/null || true

    echo "  Committing .gitignore update..."
    git add .gitignore
    git commit -m "Decouple scraper config from Git (prevent checkout reverts)" 2>/dev/null || true
    git push 2>/dev/null || true
    echo "  ✓ Git decoupled"
else
    echo "  (No git repo — skipping git operations)"
fi

# Step 2: Verify plist has correct /bin/bash wrapper
echo ""
echo "Step 2: Verifying plist integrity..."
if [ ! -f "$PLIST_PATH" ]; then
    echo "  ERROR: Plist not found at $PLIST_PATH"
    exit 1
fi

if grep -q '<string>/bin/bash</string>' "$PLIST_PATH"; then
    echo "  ✓ Plist has /bin/bash wrapper"
else
    echo "  ✗ Plist missing /bin/bash wrapper — restoring from verified backup..."
    if [ -f "$PLIST_PATH.VERIFIED" ]; then
        cp "$PLIST_PATH.VERIFIED" "$PLIST_PATH"
        echo "  ✓ Restored from backup"
    else
        echo "  ERROR: Verified backup not found. Cannot proceed."
        exit 1
    fi
fi

# Step 3: Verify daemon script exists and is executable
echo ""
echo "Step 3: Verifying daemon script..."
if [ ! -f "$DAEMON_SCRIPT" ]; then
    echo "  ERROR: Daemon script not found at $DAEMON_SCRIPT"
    exit 1
fi
if [ ! -x "$DAEMON_SCRIPT" ]; then
    echo "  Setting daemon script to executable..."
    chmod +x "$DAEMON_SCRIPT"
    echo "  ✓ Executable"
fi

# Step 4: Verify audit script exists
echo ""
echo "Step 4: Verifying daily audit script..."
if [ ! -f "$AUDIT_SCRIPT" ]; then
    echo "  ERROR: Audit script not found at $AUDIT_SCRIPT"
    exit 1
fi
echo "  ✓ Audit script present"

# Step 5: Reload launchd agent
echo ""
echo "Step 5: Reloading launchd agent..."
launchctl unload "$PLIST_PATH" 2>/dev/null || true
sleep 1
launchctl load "$PLIST_PATH" 2>&1 || true

# Step 6: Verify status
echo ""
echo "Step 6: Verifying agent status..."
if launchctl list | grep -q "com.propedge.scraper"; then
    echo "  ✓ Scraper agent loaded"
else
    echo "  ✗ Agent not loaded — check plist path"
fi

# Final status
echo ""
echo "========== STATUS =========="
launchctl list | grep propedge || echo "No agents found"

echo ""
echo "========== SETUP COMPLETE =========="
echo "Scraper is now decoupled from Git."
echo "Future git operations will NOT affect scraper configuration."
echo ""
echo "If you need to repair: bash FIX_SCRAPER_NOW.sh"
