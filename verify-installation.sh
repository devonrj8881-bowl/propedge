#!/bin/bash

###############################################################################
# PropEdge Installation Verification Script
#
# Verifies all 7 patches are applied + cron jobs + enrichment working
# Run after patching index.html and setting up cron
#
# Usage: ./verify-installation.sh
###############################################################################

set -e

PROPEDGE_HOME="/Users/devonjohnson/Documents/Claude/Projects/PropEdge"
HTML_FILE="$PROPEDGE_HOME/propedge-deploy/index.html"
ERRORS=0
WARNINGS=0
CHECKS_PASSED=0

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "=========================================="
echo "PropEdge Installation Verification"
echo "=========================================="
echo ""

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

check_pass() {
  echo -e "${GREEN}✓${NC} $1"
  ((CHECKS_PASSED++))
}

check_fail() {
  echo -e "${RED}✗${NC} $1"
  ((ERRORS++))
}

check_warn() {
  echo -e "${YELLOW}⚠${NC} $1"
  ((WARNINGS++))
}

check_info() {
  echo -e "${BLUE}ℹ${NC} $1"
}

# ============================================================================
# SECTION 1: HTML PATCHES VERIFICATION
# ============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "SECTION 1: HTML Patches (7 Total)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Patch 1: CSV column mappings
if grep -q "const perMinAvg = parseFloat(getValue(cols.per_min_avg))" "$HTML_FILE"; then
  check_pass "Patch 1: CSV column mappings (perMinAvg, confidence, matchup, etc.)"
else
  check_fail "Patch 1: CSV column mappings NOT found"
fi

# Patch 2: Per-minute efficiency replacement
if grep -q "if (perMinAvg > 0 && confidenceScore >= 40)" "$HTML_FILE"; then
  check_pass "Patch 2: Per-minute efficiency calculation"
else
  check_fail "Patch 2: Per-minute efficiency calculation NOT found"
fi

# Patch 3: Matchup difficulty multiplier
if grep -q "const matchupDifficultyMultiplier = 0.8 + (matchupScalar \* 0.4)" "$HTML_FILE"; then
  check_pass "Patch 3: Matchup difficulty multiplier"
else
  check_fail "Patch 3: Matchup difficulty multiplier NOT found"
fi

# Patch 4: Confidence dampening
if grep -q "if (confidenceScore < 40)" "$HTML_FILE" && grep -q "finalTrueProb = Math.min(finalTrueProb, impliedProb + 0.03)" "$HTML_FILE"; then
  check_pass "Patch 4: Confidence-based PropIQ dampening"
else
  check_fail "Patch 4: Confidence-based PropIQ dampening NOT found"
fi

# Patch 5: Tier classification with confidence
if grep -q "const meetsUltimate = (confidenceScore >= 75)" "$HTML_FILE"; then
  check_pass "Patch 5: Tier classification requires 75%+ confidence"
else
  check_fail "Patch 5: Tier classification confidence gate NOT found"
fi

# Patch 6: Enriched metrics in prop object
if grep -q "perMinAvg," "$HTML_FILE" && grep -q "confidence: confidenceScore," "$HTML_FILE" && grep -q "matchupRank," "$HTML_FILE"; then
  check_pass "Patch 6: Enriched metrics added to prop object"
else
  check_fail "Patch 6: Enriched metrics NOT added to prop object"
fi

# Patch 7: PropIQ version update
if grep -q "PropIQ™ v6.0 Real-Time Intelligence" "$HTML_FILE"; then
  check_pass "Patch 7: PropIQ tagline updated to v6.0"
else
  check_fail "Patch 7: PropIQ tagline NOT updated to v6.0"
fi

echo ""

# ============================================================================
# SECTION 2: ENRICHMENT SCRIPT VERIFICATION
# ============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "SECTION 2: Enrichment Script"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if run-enrichment.js exists
if [ -f "$PROPEDGE_HOME/run-enrichment.js" ]; then
  check_pass "run-enrichment.js exists"

  # Check if it's executable
  if [ -x "$PROPEDGE_HOME/run-enrichment.js" ]; then
    check_pass "run-enrichment.js is executable"
  else
    check_warn "run-enrichment.js exists but not executable (run: chmod +x run-enrichment.js)"
  fi

  # Check for key functions
  if grep -q "async function fetchInjuries" "$PROPEDGE_HOME/run-enrichment.js"; then
    check_pass "Enrichment: Injury fetcher implemented"
  else
    check_warn "Enrichment: Injury fetcher may be incomplete"
  fi

  if grep -q "function calculateMetrics" "$PROPEDGE_HOME/run-enrichment.js"; then
    check_pass "Enrichment: Metrics calculator implemented"
  else
    check_warn "Enrichment: Metrics calculator may be incomplete"
  fi

  if grep -q "async function fetchMatchupRanks" "$PROPEDGE_HOME/run-enrichment.js"; then
    check_pass "Enrichment: Matchup index fetcher implemented"
  else
    check_warn "Enrichment: Matchup index fetcher may be incomplete"
  fi
else
  check_fail "run-enrichment.js NOT found"
fi

echo ""

# ============================================================================
# SECTION 3: CRON JOB VERIFICATION
# ============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "SECTION 3: Cron Jobs (Launchd Agents)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check launchd agents
NBA_AGENT="$HOME/Library/LaunchAgents/com.propedge.enrichment.nba.plist"
NHL_AGENT="$HOME/Library/LaunchAgents/com.propedge.enrichment.nhl.plist"
MLB_AGENT="$HOME/Library/LaunchAgents/com.propedge.enrichment.mlb.plist"

if [ -f "$NBA_AGENT" ]; then
  check_pass "NBA launchd agent installed"
else
  check_fail "NBA launchd agent NOT installed"
  check_info "  Run: ./setup-cron-jobs.sh launchd"
fi

if [ -f "$NHL_AGENT" ]; then
  check_pass "NHL launchd agent installed"
else
  check_fail "NHL launchd agent NOT installed"
fi

if [ -f "$MLB_AGENT" ]; then
  check_pass "MLB launchd agent installed"
else
  check_fail "MLB launchd agent NOT installed"
fi

# Check if agents are loaded
if launchctl list 2>/dev/null | grep -q "com.propedge.enrichment.nba"; then
  check_pass "NBA agent is LOADED and active"
else
  check_warn "NBA agent is NOT loaded (run: launchctl load $NBA_AGENT)"
fi

if launchctl list 2>/dev/null | grep -q "com.propedge.enrichment.nhl"; then
  check_pass "NHL agent is LOADED and active"
else
  check_warn "NHL agent is NOT loaded"
fi

if launchctl list 2>/dev/null | grep -q "com.propedge.enrichment.mlb"; then
  check_pass "MLB agent is LOADED and active"
else
  check_warn "MLB agent is NOT loaded"
fi

echo ""

# ============================================================================
# SECTION 4: DATA FLOW VERIFICATION
# ============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "SECTION 4: Data Flow"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if enrichment output directory exists
if [ -d "$PROPEDGE_HOME/propedge-enriched" ]; then
  check_pass "Enrichment output directory exists"

  # Check if any enriched files exist
  enriched_count=$(ls "$PROPEDGE_HOME/propedge-enriched/"*.csv 2>/dev/null | wc -l)
  if [ $enriched_count -gt 0 ]; then
    check_pass "Enriched CSV files exist ($enriched_count found)"

    # Show latest file
    latest=$(ls -t "$PROPEDGE_HOME/propedge-enriched/"*.csv 2>/dev/null | head -1)
    check_info "  Latest: $(basename $latest)"
  else
    check_warn "No enriched CSV files found (run: node run-enrichment.js NBA)"
  fi
else
  check_fail "Enrichment output directory does NOT exist"
fi

# Check logs directory
if [ -d "$PROPEDGE_HOME/logs" ]; then
  check_pass "Logs directory exists"

  log_count=$(ls "$PROPEDGE_HOME/logs/" 2>/dev/null | wc -l)
  check_info "  Log files: $log_count"
else
  check_warn "Logs directory does NOT exist (will be created by cron)"
fi

echo ""

# ============================================================================
# SECTION 5: MANUAL TEST
# ============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "SECTION 5: Manual Test (Optional)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

read -p "Run enrichment test now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  check_info "Running: node run-enrichment.js NBA"
  echo ""

  cd "$PROPEDGE_HOME"
  if node run-enrichment.js NBA; then
    check_pass "Enrichment test completed successfully"

    # Check if output was created
    latest=$(ls -t "$PROPEDGE_HOME/propedge-enriched/"*.csv 2>/dev/null | head -1)
    if [ -f "$latest" ]; then
      size=$(du -h "$latest" | cut -f1)
      lines=$(wc -l < "$latest")
      check_pass "CSV output created: $size ($lines lines)"
    fi
  else
    check_fail "Enrichment test FAILED"
  fi
  echo ""
fi

# ============================================================================
# FINAL SUMMARY
# ============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "VERIFICATION SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

total_checks=$((CHECKS_PASSED + ERRORS + WARNINGS))

echo "Results:"
echo -e "  ${GREEN}Passed:${NC}   $CHECKS_PASSED / $total_checks"
echo -e "  ${RED}Failed:${NC}   $ERRORS"
echo -e "  ${YELLOW}Warnings:${NC} $WARNINGS"
echo ""

if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}✓ ALL CHECKS PASSED${NC}"
  echo ""
  echo "Next steps:"
  echo "  1. Open PropEdge in browser (should see PropIQ v6.0)"
  echo "  2. Check browser console for errors"
  echo "  3. Wait for automated enrichment tomorrow (or test manually)"
  echo "  4. Monitor logs: tail -f logs/enrichment-nba.log"
  echo ""
  exit 0
else
  echo -e "${RED}✗ SOME CHECKS FAILED${NC}"
  echo ""
  echo "Issues to resolve:"
  echo "  • Check HTML patches were applied correctly"
  echo "  • Ensure cron setup script ran: ./setup-cron-jobs.sh launchd"
  echo "  • Verify Node.js is installed: node --version"
  echo "  • Check enrichment script runs manually"
  echo ""
  exit 1
fi
