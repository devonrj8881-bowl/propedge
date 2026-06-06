#!/bin/bash
# Copy PropEdge out of iCloud Drive to a normal local project path.
# This avoids npm/node_modules hangs caused by iCloud file hydration/sync.

set -e

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="${1:-$HOME/Documents/Claude/Projects/PropEdge}"

echo "PropEdge local migration"
echo "Source:      $SRC"
echo "Destination: $DEST"
echo ""

mkdir -p "$(dirname "$DEST")"
mkdir -p "$DEST"

echo "Starting copy. This can take a few minutes if iCloud has to hydrate files."
echo "Large generated folders are skipped and will be rebuilt locally."
echo ""

rsync -ah --progress --itemize-changes --delete \
  --exclude 'node_modules/' \
  --exclude 'node_modules.bak-*/' \
  --exclude '.npm-cache/' \
  --exclude '.netlify/' \
  --exclude '.netlify-home/' \
  --exclude '.netlify-cli-runner/node_modules/' \
  --exclude '.git/' \
  --exclude 'chrome-profile/' \
  --exclude 'logs/' \
  --exclude '.netlify/functions/*.zip' \
  --exclude 'propedge-deploy/.netlify/' \
  --exclude 'propedge-deploy/.netlify/functions/*.zip' \
  --exclude 'propedge-deploy/propedge-manual.zip' \
  --exclude 'propedge-deploy/node_modules/' \
  --exclude 'propedge-deploy/netlify/functions/node_modules/' \
  --exclude '*.zip' \
  "$SRC/" "$DEST/"

mkdir -p "$DEST/logs"

echo ""
echo "Copied project files without node_modules or bulky zip artifacts."
echo ""
echo "Next:"
echo "  cd \"$DEST\""
echo "  ./recover-local-mac.sh bootstrap"
echo ""
echo "This script does not deploy production."
