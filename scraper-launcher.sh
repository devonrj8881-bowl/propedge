#!/bin/bash
# ============================================================================
# PropEdge Scraper Launcher — Robust wrapper with retry, healthchecks, logging
# ============================================================================

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

LOGDIR="$SCRIPT_DIR/logs"
mkdir -p "$LOGDIR"

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
LOGFILE="$LOGDIR/scraper-launcher-$TIMESTAMP.log"

# Redirect all output to log. Avoid process substitution here because some
# restricted launch/sandbox contexts block /dev/fd.
exec >> "$LOGFILE" 2>&1

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $@"
}

log "=== PropEdge Scraper Launcher Started ==="
log "Working dir: $SCRIPT_DIR"
log "Log: $LOGFILE"

# ─────────────────────────────────────────────────────────────────────────
# Environment Setup
# ─────────────────────────────────────────────────────────────────────────

export PATH="/usr/local/bin:/opt/homebrew/bin:/Applications/Codex.app/Contents/Resources:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
export HOME="/Users/devonjohnson"
export NODE_ENV="production"

NODE_BIN="$(command -v node || true)"
NPM_BIN="$(command -v npm || true)"

if [ -z "$NODE_BIN" ]; then
  log "ERROR: Node.js not found. Install Node.js 18+ before running the scraper."
  exit 1
fi

log "Node path: $NODE_BIN"
log "Node version: $("$NODE_BIN" --version)"

if [ -n "$NPM_BIN" ]; then
  log "npm path: $NPM_BIN"
  log "npm version: $("$NPM_BIN" --version)"
else
  log "npm not found. Existing node_modules can be used, but dependency reinstall needs npm."
fi

# Check Chrome is accessible
if [ ! -f "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]; then
  log "ERROR: Chrome not found at standard path"
  exit 1
fi
log "✅ Chrome found"

# ─────────────────────────────────────────────────────────────────────────
# Pre-flight Checks
# ─────────────────────────────────────────────────────────────────────────

log "Running pre-flight checks..."

# Check .env
if [ ! -f ".env" ]; then
  log "ERROR: .env not found"
  exit 1
fi
log "✅ .env exists"

# Check credentials.json
if [ ! -f "credentials.json" ]; then
  log "ERROR: credentials.json not found"
  exit 1
fi
log "✅ credentials.json exists"

# Check node_modules
if [ ! -d "node_modules" ]; then
  log "⚠️  node_modules missing, installing..."
  if [ -z "$NPM_BIN" ]; then
    log "ERROR: node_modules missing and npm is not installed."
    exit 1
  fi
  "$NPM_BIN" install --silent 2>&1 | tail -5
fi
log "✅ Dependencies ready"

# ─────────────────────────────────────────────────────────────────────────
# Kill any stuck processes
# ─────────────────────────────────────────────────────────────────────────

log "Cleaning up any stuck processes..."
pkill -f "scraper-v15-integrated.js" || true
sleep 1

# ─────────────────────────────────────────────────────────────────────────
# Run Scraper with Retries
# ─────────────────────────────────────────────────────────────────────────

MAX_RETRIES=3
RETRY_COUNT=0
RETRY_DELAY=5

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  log ""
  log "Attempt $RETRY_COUNT/$MAX_RETRIES..."

  # Run scraper (no timeout on macOS — use 'gtimeout' if available, otherwise run without)
  notify() {
    osascript -e "display notification \"$2\" with title \"PropEdge Scraper\" subtitle \"$1\"" 2>/dev/null || true
  }

  if command -v gtimeout &> /dev/null; then
    if gtimeout 1800 "$NODE_BIN" scraper-v15-integrated.js 2>&1; then
      log "✅ Scraper completed successfully"
      log "=== Scraper Launcher Finished (SUCCESS) ==="
      printf '{"status":"success","last_success_at":"%s","last_run_at":"%s","attempt":%d}' \
        "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$RETRY_COUNT" \
        > "$SCRIPT_DIR/scraper-status.json"
      notify "✅ Sync complete" "Props updated successfully"
      exit 0
    else
      EXIT_CODE=$?
      if [ $EXIT_CODE -eq 124 ]; then
        log "⚠️  Attempt $RETRY_COUNT timed out (30 min max)"
      else
        log "⚠️  Attempt $RETRY_COUNT failed with exit code $EXIT_CODE"
      fi
    fi
  else
    if "$NODE_BIN" scraper-v15-integrated.js 2>&1; then
      log "✅ Scraper completed successfully"
      log "=== Scraper Launcher Finished (SUCCESS) ==="
      printf '{"status":"success","last_success_at":"%s","last_run_at":"%s","attempt":%d}' \
        "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$RETRY_COUNT" \
        > "$SCRIPT_DIR/scraper-status.json"
      notify "✅ Sync complete" "Props updated successfully"
      exit 0
    else
      EXIT_CODE=$?
      log "⚠️  Attempt $RETRY_COUNT failed with exit code $EXIT_CODE"
    fi
  fi

  # Don't retry if we're on the last attempt
  if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
    log "Waiting ${RETRY_DELAY}s before retry..."
    sleep $RETRY_DELAY
  fi
done

log "❌ All $MAX_RETRIES attempts failed"
log "=== Scraper Launcher Finished (FAILED) ==="
printf '{"status":"failed","last_run_at":"%s","error":"All %d attempts failed"}' \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$MAX_RETRIES" \
  > "$SCRIPT_DIR/scraper-status.json"
osascript -e "display notification \"All $MAX_RETRIES attempts failed — check logs\" with title \"PropEdge Scraper\" subtitle \"❌ Scraper failed\"" 2>/dev/null || true
exit 1
