#!/bin/bash

# PropEdge Outcomes Sync Service Startup Script
#
# Usage:
#   ./start-outcomes-sync.sh              # Start in foreground (for testing)
#   ./start-outcomes-sync.sh daemon       # Start as background daemon
#   ./start-outcomes-sync.sh stop         # Stop the daemon
#   ./start-outcomes-sync.sh status       # Check daemon status
#
# Environment:
#   PORT=3001 (default, override with PORT=XXXX ./start-outcomes-sync.sh)
#   .env file required with GOOGLE_SHEET_ID, GOOGLE_ARCHIVE_SHEET_ID

set -e

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="/tmp/outcomes-sync.pid"
LOG_FILE="${SCRIPT_DIR}/outcomes-sync.log"
PORT="${PORT:-3001}"

service_responds() {
  curl -fsS --max-time 2 "http://localhost:${PORT}/api/outcomes" >/dev/null 2>&1
}

# Check .env exists
if [ ! -f "$SCRIPT_DIR/.env" ]; then
  echo "❌ .env file not found in $SCRIPT_DIR"
  echo "   Copy from root: cp ../.env .env"
  exit 1
fi

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "❌ Node.js not found. Install Node.js 18+ first."
  exit 1
fi

start_service() {
  if service_responds; then
    echo "✓ Service already responding on port $PORT"
    echo "  Logs: $LOG_FILE"
    return 0
  fi

  if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE")
    if ps -p "$OLD_PID" > /dev/null 2>&1; then
      echo "⚠️  Service already running (PID $OLD_PID)"
      return 0
    fi
  fi

  echo "Starting Outcomes Sync Service (port $PORT)..."

  cd "$SCRIPT_DIR"
  export PORT

  # Start in background and capture PID
  node outcomes-sync.js >> "$LOG_FILE" 2>&1 &
  PID=$!
  echo $PID > "$PID_FILE"

  sleep 2
  if ps -p $PID > /dev/null 2>&1; then
    echo "✓ Service started (PID $PID)"
    echo "  Port: $PORT"
    echo "  Logs: $LOG_FILE"
    return 0
  elif service_responds; then
    echo "✓ Service responding on port $PORT"
    echo "  Logs: $LOG_FILE"
    return 0
  else
    echo "❌ Failed to start service"
    tail -10 "$LOG_FILE"
    rm -f "$PID_FILE"
    return 1
  fi
}

stop_service() {
  if [ ! -f "$PID_FILE" ]; then
    echo "⚠️  Service not running (no PID file)"
    return 0
  fi

  PID=$(cat "$PID_FILE")
  if ps -p "$PID" > /dev/null 2>&1; then
    echo "Stopping service (PID $PID)..."
    kill "$PID"
    sleep 1

    if ps -p "$PID" > /dev/null 2>&1; then
      echo "Force killing..."
      kill -9 "$PID"
    fi

    rm -f "$PID_FILE"
    echo "✓ Service stopped"
  else
    echo "⚠️  PID $PID not running"
    rm -f "$PID_FILE"
  fi
}

status_service() {
  if service_responds; then
    if [ -f "$PID_FILE" ]; then
      PID=$(cat "$PID_FILE")
      echo "✓ Service responding on port $PORT (PID file: $PID)"
    else
      echo "✓ Service responding on port $PORT (no PID file; likely launchd-owned)"
    fi
    echo "  Logs: tail $LOG_FILE"
    return 0
  fi

  if [ ! -f "$PID_FILE" ]; then
    echo "❌ Service not running (no PID file)"
    return 1
  fi

  PID=$(cat "$PID_FILE")
  if ps -p "$PID" > /dev/null 2>&1; then
    echo "✓ Service running (PID $PID)"
    echo "  Port: $PORT"
    echo "  Logs: tail $LOG_FILE"
    return 0
  else
    echo "❌ Service not running (stale PID: $PID)"
    rm -f "$PID_FILE"
    return 1
  fi
}

# Main
case "${1:-start}" in
  start|foreground)
    if [ "$1" = "foreground" ]; then
      echo "Starting in foreground (Ctrl+C to stop)..."
      cd "$SCRIPT_DIR"
      exec node outcomes-sync.js
    else
      start_service
    fi
    ;;
  daemon)
    start_service
    ;;
  stop)
    stop_service
    ;;
  restart)
    stop_service
    sleep 1
    start_service
    ;;
  status)
    status_service
    ;;
  *)
    echo "Usage: $0 {start|foreground|daemon|stop|restart|status}"
    exit 1
    ;;
esac
