#!/bin/bash
# Install / reload PropEdge slate-data launchd agent (com.propedge.slate-data)

set -e

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LABEL="com.propedge.slate-data"
PLIST_SRC="$PROJECT_DIR/com.propedge.slate-data.plist"
PLIST_DEST="$HOME/Library/LaunchAgents/${LABEL}.plist"
RUN_SCRIPT="$PROJECT_DIR/refresh-slate-data.sh"

if [ ! -f "$PLIST_SRC" ]; then
  echo "Missing $PLIST_SRC"
  exit 1
fi

chmod +x "$RUN_SCRIPT" 2>/dev/null || true
mkdir -p "$PROJECT_DIR/logs"

# Patch project path in plist if repo moved
sed "s|/Users/devonjohnson/Documents/Claude/Projects/PropEdge|$PROJECT_DIR|g" "$PLIST_SRC" > "$PLIST_DEST"

launchctl bootout "gui/$(id -u)" "$PLIST_DEST" 2>/dev/null \
  || launchctl unload "$PLIST_DEST" 2>/dev/null \
  || true

launchctl bootstrap "gui/$(id -u)" "$PLIST_DEST" 2>/dev/null \
  || launchctl load "$PLIST_DEST"

echo "Installed: $PLIST_DEST"
echo "Schedule: 11:15 AM America/New_York daily"
echo "Manual run: bash $RUN_SCRIPT"
echo "Logs: $PROJECT_DIR/logs/slate-data-*.log"
launchctl list 2>/dev/null | grep "$LABEL" || launchctl print "gui/$(id -u)/$LABEL" 2>/dev/null | head -5 || true
