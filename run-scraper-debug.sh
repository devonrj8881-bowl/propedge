#!/bin/bash
# Debug wrapper — logs environment and startup info

{
  echo "=== LAUNCHD DEBUG START ==="
  echo "Date: $(date)"
  echo "User: $(whoami)"
  echo "Home: $HOME"
  echo "Shell: $SHELL"
  echo "PATH: $PATH"
  echo "PWD: $(pwd)"
  echo ""
  echo "=== Checking Chrome ==="
  ls -la "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" 2>&1
  echo ""
  echo "=== Node Version ==="
  node --version 2>&1
  echo ""
  echo "=== NPM Version ==="
  npm --version 2>&1
  echo ""
  echo "=== Checking dotenv ==="
  node -e "console.log(require('dotenv'))" 2>&1
  echo ""
  echo "=== Running scraper launcher ==="
  bash /Users/devonjohnson/Documents/Claude/Projects/PropEdge/scraper-launcher.sh 2>&1
  echo "=== LAUNCHD DEBUG END ==="
} >> /Users/devonjohnson/Documents/Claude/Projects/PropEdge/logs/scraper-debug.log 2>&1
