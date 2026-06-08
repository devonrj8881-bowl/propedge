#!/bin/bash
# PropEdge — daily slate data refresh (situational + matchup matrix + prop odds snapshot)
# Runs: build-situational-context.js, build-matchup-matrix.js, prop-odds-snapshot.js (optional)
# Scheduled via com.propedge.slate-data.plist @ 11:15 AM America/New_York

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
export HOME="${HOME:-/Users/devonjohnson}"

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$PROJECT_DIR/logs"
STAMP="$(date '+%Y%m%d-%H%M%S')"
LOG_FILE="$LOG_DIR/slate-data-${STAMP}.log"
LATEST_LOG="$LOG_DIR/slate-data-latest.log"

mkdir -p "$LOG_DIR"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

run_node() {
  local script="$1"
  local label="$2"
  if [ ! -f "$PROJECT_DIR/$script" ]; then
    log "SKIP $label — missing $script"
    return 0
  fi
  log "START $label ($script)"
  if "$NODE_BIN" "$PROJECT_DIR/$script" >> "$LOG_FILE" 2>&1; then
    log "OK $label"
    return 0
  fi
  log "WARN $label exited non-zero (see $LOG_FILE)"
  return 0
}

{
  log "===== SLATE DATA REFRESH START ====="
  log "Project: $PROJECT_DIR"

  if [ -f "$PROJECT_DIR/.env" ]; then
    set -a
    # shellcheck disable=SC1091
    source "$PROJECT_DIR/.env"
    set +a
    log "Loaded .env"
  else
    log "No .env — prop-odds-snapshot may be skipped"
  fi

  cd "$PROJECT_DIR" || { log "ERROR: cannot cd"; exit 0; }

  NODE_BIN="$(command -v node || true)"
  if [ -z "$NODE_BIN" ]; then
    log "ERROR: node not found on PATH"
    exit 0
  fi
  log "Node: $NODE_BIN ($("$NODE_BIN" -v 2>/dev/null || echo unknown))"

  run_node "build-situational-context.js" "situational-context"
  run_node "build-matchup-matrix.js" "matchup-matrix"

  SKIP_PROP="${SKIP_PROP_ODDS_SNAPSHOT:-}"
  HAS_KEY="${ODDS_API_KEY:-${THE_ODDS_API_KEY:-}}"
  HAS_CREDS="0"
  [ -f "$PROJECT_DIR/credentials.json" ] && HAS_CREDS="1"

  if [ "$SKIP_PROP" = "1" ]; then
    log "SKIP prop-odds-snapshot (SKIP_PROP_ODDS_SNAPSHOT=1)"
  elif [ -z "$HAS_KEY" ]; then
    log "SKIP prop-odds-snapshot — no ODDS_API_KEY in .env"
  else
    if [ "$HAS_CREDS" != "1" ]; then
      log "prop-odds-snapshot: no credentials.json — will write local sample only if API succeeds"
    fi
    run_node "prop-odds-snapshot.js" "prop-odds-snapshot"
  fi

  if [ -f "$PROJECT_DIR/propedge-deploy/data/situational-context.json" ]; then
    log "situational-context.json present"
  fi
  if [ -f "$PROJECT_DIR/propedge-deploy/data/matchup-matrix.json" ]; then
    log "matchup-matrix.json present"
  fi

  log "Deploy reminder: run ./deploy-prod.sh after GO to ship data/*.json to Netlify"
  log "===== SLATE DATA REFRESH DONE ====="
} 2>&1 | tee -a "$LOG_FILE" | tee "$LATEST_LOG"

exit 0
