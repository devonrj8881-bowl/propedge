#!/bin/bash
# PropEdge Health Check Script
# Updated to use correct project path: /Users/devonjohnson/Documents/Claude/Projects/PropEdge

PROJECT_DIR="/Users/devonjohnson/Documents/Claude/Projects/PropEdge"
LOG_DIR="$PROJECT_DIR/logs"
DEPLOY_DIR="$PROJECT_DIR/propedge-deploy"

echo "=== PropEdge Health Check ==="
echo "Time: $(date)"
echo "Project Dir: $PROJECT_DIR"
echo ""

# Check scraper last run
if [ -f "$LOG_DIR/scraper-daemon.log" ]; then
    LAST_RUN=$(grep "SCRAPER DAEMON FINISHED" "$LOG_DIR/scraper-daemon.log" | tail -1)
    if [ -n "$LAST_RUN" ]; then
        echo "Last scraper run: $LAST_RUN"
    else
        echo "Last scraper run: ❌ No finished runs found in log"
    fi
else
    echo "Last scraper run: ❌ Log file not found at $LOG_DIR/scraper-daemon.log"
fi

# Check Netlify deployment (if CLI installed)
if command -v netlify &> /dev/null; then
    echo ""
    echo "Netlify Status:"
    cd "$DEPLOY_DIR" && netlify status 2>/dev/null | head -5
else
    echo ""
    echo "Netlify CLI: ❌ Not installed"
    echo "   Install with: npm install -g netlify-cli"
fi

# Check site availability
echo ""
echo "Site Check:"
HTTP_CODE=$(curl -o /dev/null -s -w "%{http_code}\n" https://propedgemasters.netlify.app)
if [ "$HTTP_CODE" -eq 200 ]; then
    echo "Site status: ✅ OK (HTTP 200)"
    # Check for props
    PROP_COUNT=$(curl -s https://propedgemasters.netlify.app | grep -o "prop-count" | wc -l)
    if [ "$PROP_COUNT" -gt 0 ]; then
        echo "Props found: ✅ Yes ($PROP_COUNT prop-count elements)"
    else
        echo "Props found: ❌ No prop-count elements detected"
    fi
else
    echo "Site status: ❌ Failed (HTTP $HTTP_CODE)"
fi

echo ""
echo "=== Check Complete ==="
