#!/bin/bash
set -e

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
export HOME="/Users/devonjohnson"
export NODE_ENV="production"

PROJECT_DIR="/Users/devonjohnson/Documents/Claude/Projects/PropEdge"
LOG_DIR="$PROJECT_DIR/logs"
TIMESTAMP="$(date '+%Y-%m-%d %H:%M:%S')"

mkdir -p "$LOG_DIR"

{
  echo "[$TIMESTAMP] ===== SCRAPER LAUNCHD STARTED ====="
  cd "$PROJECT_DIR"

  if [ -f "$PROJECT_DIR/.env" ]; then
    set -a
    . "$PROJECT_DIR/.env"
    set +a
  fi

  if /bin/bash "$PROJECT_DIR/scraper-launcher.sh"; then
    echo "[$TIMESTAMP] Scraper completed successfully"
  else
    echo "[$TIMESTAMP] Scraper launcher failed"
  fi

  echo "[$TIMESTAMP] Deployment skipped: explicit approval required."
  echo "[$TIMESTAMP] ===== SCRAPER LAUNCHD FINISHED ====="
} >> "$LOG_DIR/scraper-daemon.log" 2>> "$LOG_DIR/scraper-daemon-error.log"

exit 0
