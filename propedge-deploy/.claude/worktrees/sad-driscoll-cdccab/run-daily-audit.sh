#!/bin/bash
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

PROJECT_DIR="$HOME/Documents/Claude/Projects/PropEdge"
LOG_DIR="$PROJECT_DIR/logs"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Load environment variables from .env
if [ -f "$PROJECT_DIR/.env" ]; then
    export $(grep -v '^#' "$PROJECT_DIR/.env" | xargs)
fi

echo "[$TIMESTAMP] ===== DAILY AUDIT STARTED =====" >> "$LOG_DIR/daily-audit.log"

# Navigate to project directory
cd "$PROJECT_DIR" || exit 1

# Run propedge-daily-audit.js
echo "[$TIMESTAMP] Running propedge-daily-audit.js..." >> "$LOG_DIR/daily-audit.log"
/opt/homebrew/bin/node "$PROJECT_DIR/propedge-daily-audit.js" >> "$LOG_DIR/daily-audit.log" 2>> "$LOG_DIR/daily-audit-error.log"
AUDIT_EXIT=$?

if [ $AUDIT_EXIT -eq 0 ]; then
    echo "[$TIMESTAMP] ✅ Audit completed successfully" >> "$LOG_DIR/daily-audit.log"
else
    echo "[$TIMESTAMP] ⚠️  Audit had issues (exit code: $AUDIT_EXIT)" >> "$LOG_DIR/daily-audit.log"
fi

echo "[$TIMESTAMP] ===== DAILY AUDIT FINISHED =====" >> "$LOG_DIR/daily-audit.log"
exit 0
