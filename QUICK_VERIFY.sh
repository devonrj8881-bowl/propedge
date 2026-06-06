#!/bin/bash

# Quick 30-second verification of all critical components
# Run this anytime to verify system health

cd /Users/devonjohnson/Documents/Claude/Projects/PropEdge

echo "PropEdge Quick Verification"
echo "==========================="
echo ""

FAIL=0

# 1. HTML patches
echo -n "HTML Patches....... "
if grep -q "PropIQ™ v6.0" propedge-deploy/index.html && \
   grep -q "const perMinAvg = parseFloat(getValue(cols.per_min_avg))" propedge-deploy/index.html && \
   grep -q "const meetsUltimate = (confidenceScore >= 75)" propedge-deploy/index.html; then
  echo "✓"
else
  echo "✗"
  FAIL=$((FAIL+1))
fi

# 2. Enrichment script
echo -n "Enrichment script.. "
if [ -x run-enrichment.js ] && grep -q "async function fetchInjuries\|function calculateMetrics" run-enrichment.js; then
  echo "✓"
else
  echo "✗"
  FAIL=$((FAIL+1))
fi

# 3. Cron agents
echo -n "Cron agents....... "
if launchctl list 2>/dev/null | grep -q "com.propedge.enrichment.nba"; then
  echo "✓"
else
  echo "✗"
  FAIL=$((FAIL+1))
fi

# 4. Enriched data exists
echo -n "Enriched data...... "
if [ -d propedge-enriched ] && ls propedge-enriched/*.csv &>/dev/null; then
  echo "✓"
else
  echo "✗"
  FAIL=$((FAIL+1))
fi

echo ""

if [ $FAIL -eq 0 ]; then
  echo "✓ All critical components working"
  exit 0
else
  echo "✗ $FAIL component(s) need attention"
  echo ""
  echo "Full verification: ./verify-installation.sh"
  exit 1
fi
