#!/bin/bash
# PropEdge Enrichment Verification Script
# Checks if page scraping is working and enrichment is being captured

set -e

PROJECT_DIR=~/Documents/Claude/Projects/PropEdge
LOGS_DIR=$PROJECT_DIR/logs
ENRICHMENT_CACHE_DIR=$PROJECT_DIR/../enrichment-cache

echo "═════════════════════════════════════════════════════════════"
echo "  PropEdge Enrichment Verification"
echo "═════════════════════════════════════════════════════════════"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

pass_count=0
fail_count=0

# Test 1: Check if scraping is finding rows
echo "[1/6] Checking if page scraping is capturing rows..."
scrape_lines=$(grep "Scraped.*rows from page" $LOGS_DIR/scraper-daemon.log 2>/dev/null | tail -1 || echo "")

if [[ $scrape_lines == *"Scraped"* ]]; then
  echo -e "${GREEN}✅ PASS${NC}: $scrape_lines"
  ((pass_count++))
else
  echo -e "${RED}❌ FAIL${NC}: No 'Scraped rows' message found in logs"
  echo "   Expected: 'Scraped XXX rows from page table'"
  ((fail_count++))
fi
echo ""

# Test 2: Check enrichment merge results
echo "[2/6] Checking enrichment merge percentages..."
merge_result=$(grep "Enrichment merged:" $LOGS_DIR/scraper-daemon.log 2>/dev/null | tail -1 || echo "")

if [[ -z "$merge_result" ]]; then
  echo -e "${RED}❌ FAIL${NC}: No enrichment merge result found"
  ((fail_count++))
else
  # Extract percentages
  if echo "$merge_result" | grep -qE "[0-9]+/[0-9]+"; then
    echo -e "${GREEN}✅ PASS${NC}: $merge_result"

    # Check if percentage is high (expecting 90%+)
    matches=$(echo "$merge_result" | sed 's/.*\([0-9]*\)\/\([0-9]*\).*/\1/')
    total=$(echo "$merge_result" | sed 's/.*\/\([0-9]*\).*/\1/')

    if [ ! -z "$matches" ] && [ ! -z "$total" ] && [ "$total" -gt 0 ]; then
      percent=$((matches * 100 / total))
      echo "   Match rate: $percent% ($matches/$total)"

      if [ "$percent" -gt 80 ]; then
        echo -e "   ${GREEN}High match rate ✓${NC}"
      else
        echo -e "   ${YELLOW}Warning: Low match rate${NC}"
      fi
    fi
  else
    echo -e "${RED}❌ FAIL${NC}: Could not parse merge result"
    ((fail_count++))
  fi
fi
echo ""

# Test 3: Check enrichment cache directory
echo "[3/6] Checking enrichment cache files..."
if [ -d "$ENRICHMENT_CACHE_DIR" ]; then
  csv_count=$(ls -1 $ENRICHMENT_CACHE_DIR/enrichment-*.csv 2>/dev/null | wc -l)
  if [ "$csv_count" -gt 0 ]; then
    latest_csv=$(ls -1t $ENRICHMENT_CACHE_DIR/enrichment-*.csv 2>/dev/null | head -1)
    file_size=$(du -h "$latest_csv" | cut -f1)
    line_count=$(wc -l < "$latest_csv")

    echo -e "${GREEN}✅ PASS${NC}: Found enrichment CSV"
    echo "   Latest: $latest_csv"
    echo "   Size: $file_size"
    echo "   Lines: $line_count"

    if [ "$line_count" -gt 100 ]; then
      echo -e "   ${GREEN}Large file (good) ✓${NC}"
      ((pass_count++))
    else
      echo -e "   ${RED}Small file (only $line_count lines)${NC}"
      ((fail_count++))
    fi
  else
    echo -e "${RED}❌ FAIL${NC}: No enrichment CSVs found in cache"
    ((fail_count++))
  fi
else
  echo -e "${RED}❌ FAIL${NC}: Enrichment cache directory not found"
  echo "   Expected: $ENRICHMENT_CACHE_DIR"
  ((fail_count++))
fi
echo ""

# Test 4: Check enrichment CSV content
echo "[4/6] Checking enrichment CSV content..."
if [ ! -z "$latest_csv" ] && [ -f "$latest_csv" ]; then
  # Sample a few lines
  echo "   First data row (after header):"
  head -2 "$latest_csv" | tail -1 | sed 's/,/\n   /g' | head -4

  # Check for realistic L10 values (not all defaults)
  l10_col=$(head -1 "$latest_csv" | tr ',' '\n' | grep -n "Per_Min_L10" | cut -d: -f1)
  if [ ! -z "$l10_col" ]; then
    sample_values=$(cut -d, -f$l10_col "$latest_csv" | tail -5 | grep -v "Per_Min_L10" | head -3)
    if echo "$sample_values" | grep -qvE "^0$|^0\.0+$"; then
      echo -e "   ${GREEN}✅ Has real L10 values ✓${NC}"
      ((pass_count++))
    else
      echo -e "   ${YELLOW}⚠️  L10 values look like defaults${NC}"
    fi
  fi
else
  echo -e "${YELLOW}⚠️  Could not check CSV content${NC}"
fi
echo ""

# Test 5: Compare recent enrichment merge results
echo "[5/6] Comparing recent merge results..."
echo "   Last 5 enrichment merges:"
grep "Enrichment merged:" $LOGS_DIR/scraper-daemon.log 2>/dev/null | tail -5 | nl | sed 's/^/   /'

if grep "Enrichment merged:.*600\|Enrichment merged:.*[5-9][0-9][0-9]/.*/" $LOGS_DIR/scraper-daemon.log &>/dev/null; then
  echo -e "   ${GREEN}✅ High match counts detected ✓${NC}"
  ((pass_count++))
else
  echo -e "   ${YELLOW}⚠️  Match counts seem low${NC}"
fi
echo ""

# Test 6: Check for errors
echo "[6/6] Checking for scraping errors..."
errors=$(grep "No enrichment data scraped\|enrichment data scraped" $LOGS_DIR/scraper-daemon.log 2>/dev/null | grep "No enrichment" | wc -l)

if [ "$errors" -eq 0 ]; then
  echo -e "${GREEN}✅ PASS${NC}: No scraping errors detected"
  ((pass_count++))
else
  echo -e "${RED}❌ FAIL${NC}: $errors instances of scraping failures"
  echo "   Check: tail -20 $LOGS_DIR/scraper-daemon.log"
  ((fail_count++))
fi
echo ""

# Summary
echo "═════════════════════════════════════════════════════════════"
echo "  SUMMARY"
echo "═════════════════════════════════════════════════════════════"
echo -e "  ${GREEN}Passed: $pass_count${NC}"
echo -e "  ${RED}Failed: $fail_count${NC}"
echo ""

if [ "$fail_count" -eq 0 ]; then
  echo -e "${GREEN}✅ ALL CHECKS PASSED - Enrichment is working!${NC}"
  exit 0
else
  echo -e "${RED}❌ Some checks failed - see above for details${NC}"
  exit 1
fi
