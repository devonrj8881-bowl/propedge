#!/bin/bash

###############################################################################
# PropEdge Cron Job Setup for macOS
#
# Sets up launchd agents for automatic daily enrichment
# Alternative: uses standard cron if launchd not preferred
#
# Usage: ./setup-cron-jobs.sh [launchd|cron]
# Example: ./setup-cron-jobs.sh launchd
###############################################################################

set -e

METHOD=${1:-"launchd"} # Default to macOS launchd (preferred)
PROPEDGE_HOME="/Users/devonjohnson/Documents/Claude/Projects/PropEdge"

echo "=========================================="
echo "PropEdge Cron Job Setup"
echo "=========================================="
echo "Method: $METHOD"
echo ""

# ============================================================================
# OPTION 1: macOS LAUNCHD (Preferred - more reliable than cron)
# ============================================================================

if [ "$METHOD" = "launchd" ]; then
  echo "Setting up macOS launchd agents..."
  echo ""

  # Create logs directory
  mkdir -p "$PROPEDGE_HOME/logs"

  # ──────────────────────────────────────────────────────────────────────
  # LAUNCHD 1: NBA Enrichment (11:30 AM EST)
  # ──────────────────────────────────────────────────────────────────────

  LAUNCHD_NBA_PATH="$HOME/Library/LaunchAgents/com.propedge.enrichment.nba.plist"

  cat > "$LAUNCHD_NBA_PATH" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.propedge.enrichment.nba</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>-c</string>
    <string>cd /Users/devonjohnson/Documents/Claude/Projects/PropEdge && node run-enrichment.js NBA >> ./logs/enrichment-nba.log 2>&1</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>11</integer>
    <key>Minute</key>
    <integer>30</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>/Users/devonjohnson/Documents/Claude/Projects/PropEdge/logs/enrichment-nba-stdout.log</string>
  <key>StandardErrorPath</key>
  <string>/Users/devonjohnson/Documents/Claude/Projects/PropEdge/logs/enrichment-nba-stderr.log</string>
  <key>RunAtLoad</key>
  <false/>
  <key>KeepAlive</key>
  <false/>
</dict>
</plist>
EOF

  chmod 644 "$LAUNCHD_NBA_PATH"
  echo "✓ NBA launchd agent installed: $LAUNCHD_NBA_PATH"

  # ──────────────────────────────────────────────────────────────────────
  # LAUNCHD 2: NHL Enrichment (3:00 PM EST)
  # ──────────────────────────────────────────────────────────────────────

  LAUNCHD_NHL_PATH="$HOME/Library/LaunchAgents/com.propedge.enrichment.nhl.plist"

  cat > "$LAUNCHD_NHL_PATH" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.propedge.enrichment.nhl</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>-c</string>
    <string>cd /Users/devonjohnson/Documents/Claude/Projects/PropEdge && node run-enrichment.js NHL >> ./logs/enrichment-nhl.log 2>&1</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>15</integer>
    <key>Minute</key>
    <integer>0</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>/Users/devonjohnson/Documents/Claude/Projects/PropEdge/logs/enrichment-nhl-stdout.log</string>
  <key>StandardErrorPath</key>
  <string>/Users/devonjohnson/Documents/Claude/Projects/PropEdge/logs/enrichment-nhl-stderr.log</string>
  <key>RunAtLoad</key>
  <false/>
  <key>KeepAlive</key>
  <false/>
</dict>
</plist>
EOF

  chmod 644 "$LAUNCHD_NHL_PATH"
  echo "✓ NHL launchd agent installed: $LAUNCHD_NHL_PATH"

  # ──────────────────────────────────────────────────────────────────────
  # LAUNCHD 3: MLB Enrichment (5:30 PM EST)
  # ──────────────────────────────────────────────────────────────────────

  LAUNCHD_MLB_PATH="$HOME/Library/LaunchAgents/com.propedge.enrichment.mlb.plist"

  cat > "$LAUNCHD_MLB_PATH" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.propedge.enrichment.mlb</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>-c</string>
    <string>cd /Users/devonjohnson/Documents/Claude/Projects/PropEdge && node run-enrichment.js MLB >> ./logs/enrichment-mlb.log 2>&1</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>17</integer>
    <key>Minute</key>
    <integer>30</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>/Users/devonjohnson/Documents/Claude/Projects/PropEdge/logs/enrichment-mlb-stdout.log</string>
  <key>StandardErrorPath</key>
  <string>/Users/devonjohnson/Documents/Claude/Projects/PropEdge/logs/enrichment-mlb-stderr.log</string>
  <key>RunAtLoad</key>
  <false/>
  <key>KeepAlive</key>
  <false/>
</dict>
</plist>
EOF

  chmod 644 "$LAUNCHD_MLB_PATH"
  echo "✓ MLB launchd agent installed: $LAUNCHD_MLB_PATH"

  # Load all agents
  echo ""
  echo "Loading launchd agents..."
  launchctl load "$LAUNCHD_NBA_PATH" 2>/dev/null || echo "  (NBA already loaded)"
  launchctl load "$LAUNCHD_NHL_PATH" 2>/dev/null || echo "  (NHL already loaded)"
  launchctl load "$LAUNCHD_MLB_PATH" 2>/dev/null || echo "  (MLB already loaded)"

  echo ""
  echo "✓ Launchd agents loaded"

  # ============================================================================
  # OPTION 2: STANDARD CRON (Alternative)
  # ============================================================================

elif [ "$METHOD" = "cron" ]; then
  echo "Setting up standard cron jobs..."
  echo ""

  # Create crontab entries
  CRON_FILE="/tmp/propedge-cron.txt"

  # Get existing crontab (exclude our previous entries)
  crontab -l 2>/dev/null | grep -v "PropEdge" > "$CRON_FILE" || true

  # Add new PropEdge entries
  cat >> "$CRON_FILE" << 'EOF'

# PropEdge Data Enrichment (EST times)
# NBA: 11:30 AM EST
30 11 * * * cd /Users/devonjohnson/Documents/Claude/Projects/PropEdge && node run-enrichment.js NBA >> ./logs/enrichment-nba.log 2>&1

# NHL: 3:00 PM EST
0 15 * * * cd /Users/devonjohnson/Documents/Claude/Projects/PropEdge && node run-enrichment.js NHL >> ./logs/enrichment-nhl.log 2>&1

# MLB: 5:30 PM EST
30 17 * * * cd /Users/devonjohnson/Documents/Claude/Projects/PropEdge && node run-enrichment.js MLB >> ./logs/enrichment-mlb.log 2>&1
EOF

  # Install crontab
  crontab "$CRON_FILE"
  echo "✓ Cron jobs installed"

  rm "$CRON_FILE"

else
  echo "❌ Invalid method. Use: ./setup-cron-jobs.sh [launchd|cron]"
  exit 1
fi

# ============================================================================
# VERIFICATION
# ============================================================================

echo ""
echo "=========================================="
echo "✓ Setup Complete!"
echo "=========================================="
echo ""

if [ "$METHOD" = "launchd" ]; then
  echo "Installed launchd agents:"
  echo "  • com.propedge.enrichment.nba (11:30 AM EST)"
  echo "  • com.propedge.enrichment.nhl (3:00 PM EST)"
  echo "  • com.propedge.enrichment.mlb (5:30 PM EST)"
  echo ""
  echo "Manage agents:"
  echo "  launchctl list | grep propedge        # Check status"
  echo "  launchctl unload ~/Library/LaunchAgents/com.propedge.enrichment.*.plist  # Disable"
  echo "  launchctl load ~/Library/LaunchAgents/com.propedge.enrichment.*.plist    # Enable"
  echo ""
  echo "View logs:"
  echo "  tail -f $PROPEDGE_HOME/logs/enrichment-nba.log"
  echo ""

elif [ "$METHOD" = "cron" ]; then
  echo "Installed cron jobs:"
  echo "  • 11:30 AM EST: NBA enrichment"
  echo "  • 3:00 PM EST: NHL enrichment"
  echo "  • 5:30 PM EST: MLB enrichment"
  echo ""
  echo "View crontab:"
  echo "  crontab -l"
  echo ""
  echo "View logs:"
  echo "  tail -f $PROPEDGE_HOME/logs/enrichment-nba.log"
  echo ""
fi

echo "Test enrichment manually:"
echo "  node $PROPEDGE_HOME/run-enrichment.js NBA"
echo ""
