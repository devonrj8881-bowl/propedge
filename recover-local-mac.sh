#!/bin/bash
# PropEdge one-shot local Mac recovery helper.
#
# Safe by design:
# - Checks and repairs the local Mac setup after a wipe.
# - Installs local dependencies when requested.
# - Starts local services and loads launch agents.
# - Never commits, pushes, or deploys production.
#
# Usage:
#   ./recover-local-mac.sh check
#   ./recover-local-mac.sh bootstrap
#   ./recover-local-mac.sh install-deps
#   ./recover-local-mac.sh repair-puppeteer
#   ./recover-local-mac.sh install-agents
#   ./recover-local-mac.sh start-services
#
# bootstrap performs:
#   1. Command Line Tools install attempt
#   2. Homebrew install attempt, if missing
#   3. Node.js/npm + Chrome install via Homebrew
#   4. npm installs for root and Netlify functions
#   5. shell/plist validation
#   6. outcomes-sync start
#   7. launch agent install/load
#   8. final status check

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$PROJECT_DIR/propedge-deploy"
FUNCTIONS_DIR="$DEPLOY_DIR/netlify/functions"
LAUNCH_AGENTS="$HOME/Library/LaunchAgents"

BREW_BIN=""
NODE_BIN=""
NPM_BIN=""

pass() { echo "PASS  $1"; }
warn() { echo "WARN  $1"; }
fail() { echo "FAIL  $1"; }
info() { echo "INFO  $1"; }
step() { echo ""; echo "==> $1"; }

has_cmd() {
  command -v "$1" >/dev/null 2>&1
}

refresh_bins() {
  export PATH="/opt/homebrew/bin:/usr/local/bin:/Applications/Codex.app/Contents/Resources:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

  if [ -x "/opt/homebrew/bin/brew" ]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [ -x "/usr/local/bin/brew" ]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi

  BREW_BIN="$(command -v brew || true)"
  NODE_BIN="$(command -v node || true)"
  NPM_BIN="$(command -v npm || true)"

  if [ -z "$NPM_BIN" ] && [ -x "/opt/homebrew/bin/npm" ]; then
    NPM_BIN="/opt/homebrew/bin/npm"
  elif [ -z "$NPM_BIN" ] && [ -x "/usr/local/bin/npm" ]; then
    NPM_BIN="/usr/local/bin/npm"
  fi
}

is_clt_installed() {
  xcode-select -p >/dev/null 2>&1
}

check_file() {
  if [ -f "$1" ]; then
    pass "$2"
  else
    fail "$2"
    return 1
  fi
}

check_dir() {
  if [ -d "$1" ]; then
    pass "$2"
  else
    fail "$2"
    return 1
  fi
}

install_clt() {
  step "Apple Command Line Tools"

  if is_clt_installed; then
    pass "Apple Command Line Tools already installed"
    return 0
  fi

  warn "Apple Command Line Tools missing"
  info "Trying softwareupdate-based install first."

  touch /tmp/.com.apple.dt.CommandLineTools.installondemand.in-progress 2>/dev/null || true

  local label
  label="$(softwareupdate -l 2>/dev/null \
    | awk -F'* Label: ' '/Command Line Tools/ { print $2 }' \
    | tail -n 1)"

  if [ -n "$label" ]; then
    info "Installing: $label"
    softwareupdate -i "$label" --verbose || true
  fi

  rm -f /tmp/.com.apple.dt.CommandLineTools.installondemand.in-progress 2>/dev/null || true

  if is_clt_installed; then
    pass "Apple Command Line Tools installed"
    return 0
  fi

  warn "Automatic Command Line Tools install did not complete."
  info "A macOS dialog may appear with: xcode-select --install"
  xcode-select --install 2>/dev/null || true

  if is_clt_installed; then
    pass "Apple Command Line Tools installed"
    return 0
  fi

  fail "Install Apple Command Line Tools manually, then rerun bootstrap."
  return 1
}

install_homebrew() {
  step "Homebrew"
  refresh_bins

  if [ -n "$BREW_BIN" ]; then
    pass "Homebrew already installed: $BREW_BIN"
    return 0
  fi

  warn "Homebrew missing"
  info "Installing Homebrew from the official installer."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

  if [ -d "/opt/homebrew/bin" ]; then
    export PATH="/opt/homebrew/bin:$PATH"
  fi
  if [ -d "/usr/local/bin" ]; then
    export PATH="/usr/local/bin:$PATH"
  fi

  refresh_bins

  if [ -n "$BREW_BIN" ]; then
    pass "Homebrew installed: $BREW_BIN"
    return 0
  fi

  fail "Homebrew install did not finish. Install Homebrew manually, then rerun."
  return 1
}

install_node_and_chrome() {
  step "Node.js, npm, and Chrome"
  refresh_bins

  if [ -z "$BREW_BIN" ]; then
    fail "Homebrew is required for bootstrap installs."
    return 1
  fi

  if [ -z "$NPM_BIN" ]; then
    info "Installing Node.js via Homebrew."
    "$BREW_BIN" install node
  else
    pass "npm already available: $NPM_BIN"
  fi

  if [ ! -f "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]; then
    info "Installing Google Chrome via Homebrew cask."
    "$BREW_BIN" install --cask google-chrome
  else
    pass "Google Chrome already installed"
  fi

  refresh_bins

  if [ -z "$NODE_BIN" ] || [ -z "$NPM_BIN" ]; then
    fail "Node.js/npm still missing after install attempt."
    return 1
  fi

  pass "node available: $NODE_BIN ($("$NODE_BIN" --version))"
  pass "npm available: $NPM_BIN ($("$NPM_BIN" --version))"

  if [ -f "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]; then
    pass "Google Chrome installed"
  else
    fail "Google Chrome still missing after install attempt."
    return 1
  fi
}

install_project_dependencies() {
  step "Project Dependencies"
  refresh_bins

  if [ -z "$NPM_BIN" ]; then
    fail "npm missing; cannot install dependencies."
    return 1
  fi

  export PUPPETEER_SKIP_DOWNLOAD=true
  export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
  export npm_config_fund=false
  export npm_config_audit=false

  if [ -d "$PROJECT_DIR/node_modules" ]; then
    pass "root node_modules already present; skipping root reinstall"
  else
    info "Installing root dependencies. Puppeteer browser download is skipped because system Chrome is installed."
    (cd "$PROJECT_DIR" && "$NPM_BIN" install --ignore-scripts --no-audit --no-fund --progress=true)
  fi

  if [ -f "$FUNCTIONS_DIR/package.json" ]; then
    info "Installing deployed Netlify function dependencies."
    if [ -d "$FUNCTIONS_DIR/node_modules" ]; then
      pass "deployed Netlify function node_modules already present"
    else
      (cd "$FUNCTIONS_DIR" && "$NPM_BIN" install --ignore-scripts --no-audit --no-fund --progress=true)
    fi
  else
    warn "No package.json found in deployed functions dir: $FUNCTIONS_DIR"
  fi

  if [ -f "$PROJECT_DIR/netlify/functions/package.json" ]; then
    info "Installing root Netlify function dependencies."
    if [ -d "$PROJECT_DIR/netlify/functions/node_modules" ]; then
      pass "root Netlify function node_modules already present"
    else
      (cd "$PROJECT_DIR/netlify/functions" && "$NPM_BIN" install --ignore-scripts --no-audit --no-fund --progress=true)
    fi
  else
    warn "No package.json found in root functions dir."
  fi

  pass "Dependencies installed"
}

repair_puppeteer() {
  step "Puppeteer Repair"
  refresh_bins

  if [ -z "$NPM_BIN" ]; then
    fail "npm missing; cannot repair Puppeteer."
    return 1
  fi

  export PUPPETEER_SKIP_DOWNLOAD=true
  export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
  export npm_config_fund=false
  export npm_config_audit=false

  local stamp
  stamp="$(date +%Y%m%d-%H%M%S)"

  info "Moving incomplete Puppeteer folders aside when present."
  [ -d "$PROJECT_DIR/node_modules/puppeteer" ] && mv "$PROJECT_DIR/node_modules/puppeteer" "$PROJECT_DIR/node_modules/puppeteer.bad-$stamp" 2>/dev/null || true
  [ -d "$PROJECT_DIR/node_modules/puppeteer-core" ] && mv "$PROJECT_DIR/node_modules/puppeteer-core" "$PROJECT_DIR/node_modules/puppeteer-core.bad-$stamp" 2>/dev/null || true
  [ -d "$PROJECT_DIR/node_modules/@puppeteer" ] && mv "$PROJECT_DIR/node_modules/@puppeteer" "$PROJECT_DIR/node_modules/@puppeteer.bad-$stamp" 2>/dev/null || true

  info "Reinstalling Puppeteer packages without browser download."
  (cd "$PROJECT_DIR" && "$NPM_BIN" install puppeteer-core@24.40.0 @puppeteer/browsers@2.6.0 puppeteer@24.42.0 --ignore-scripts --no-audit --no-fund --prefer-online --progress=true)

  info "Verifying puppeteer-core can be loaded."
  (cd "$PROJECT_DIR" && "$NODE_BIN" -e "require('puppeteer-core'); console.log('puppeteer-core ok')")

  pass "Puppeteer repair complete"
}

validate_scripts() {
  step "Script and Plist Validation"

  chmod +x "$PROJECT_DIR/recover-local-mac.sh" \
    "$PROJECT_DIR/scraper-launcher.sh" \
    "$PROJECT_DIR/run-scraper-daemon.sh" \
    "$DEPLOY_DIR/start-outcomes-sync.sh"

  bash -n "$PROJECT_DIR/recover-local-mac.sh"
  bash -n "$PROJECT_DIR/scraper-launcher.sh"
  bash -n "$PROJECT_DIR/run-scraper-daemon.sh"
  bash -n "$DEPLOY_DIR/start-outcomes-sync.sh"

  plutil -lint \
    "$PROJECT_DIR/com.propedge.daily-audit.plist" \
    "$PROJECT_DIR/com.propedge.scraper.REAL_MAC.plist" \
    "$DEPLOY_DIR/com.propedge.outcomes-sync.plist"

  pass "Shell scripts and plist files validated"
}

install_agents() {
  step "Launch Agents"

  mkdir -p "$LAUNCH_AGENTS"

  sed \
    -e "s#/Users/devonjohnson/Library/Mobile Documents/com~apple~CloudDocs/Documents/Claude/Projects/PropEdge#$PROJECT_DIR#g" \
    -e "s#/Users/devonjohnson/Documents/Claude/Projects/PropEdge#$PROJECT_DIR#g" \
    "$PROJECT_DIR/com.propedge.scraper.REAL_MAC.plist" > "$LAUNCH_AGENTS/com.propedge.scraper.REAL_MAC.plist"

  sed \
    -e "s#/Users/devonjohnson/Library/Mobile Documents/com~apple~CloudDocs/Documents/Claude/Projects/PropEdge#$PROJECT_DIR#g" \
    -e "s#/Users/devonjohnson/Documents/Claude/Projects/PropEdge#$PROJECT_DIR#g" \
    "$PROJECT_DIR/com.propedge.daily-audit.plist" > "$LAUNCH_AGENTS/com.propedge.daily-audit.plist"

  sed \
    -e "s#/Users/devonjohnson/Library/Mobile Documents/com~apple~CloudDocs/Documents/Claude/Projects/PropEdge#$PROJECT_DIR#g" \
    -e "s#/Users/devonjohnson/Documents/Claude/Projects/PropEdge#$PROJECT_DIR#g" \
    "$DEPLOY_DIR/com.propedge.outcomes-sync.plist" > "$LAUNCH_AGENTS/com.propedge.outcomes-sync.plist"

  launchctl unload "$LAUNCH_AGENTS/com.propedge.scraper.REAL_MAC.plist" >/dev/null 2>&1 || true
  launchctl unload "$LAUNCH_AGENTS/com.propedge.daily-audit.plist" >/dev/null 2>&1 || true
  launchctl unload "$LAUNCH_AGENTS/com.propedge.outcomes-sync.plist" >/dev/null 2>&1 || true

  launchctl load "$LAUNCH_AGENTS/com.propedge.scraper.REAL_MAC.plist"
  launchctl load "$LAUNCH_AGENTS/com.propedge.daily-audit.plist"
  launchctl load "$LAUNCH_AGENTS/com.propedge.outcomes-sync.plist"

  pass "Launch agents copied and loaded"
  info "Check with: launchctl list | grep propedge"
}

start_services() {
  step "Local Services"

  (cd "$DEPLOY_DIR" && ./start-outcomes-sync.sh daemon || true)
  sleep 2

  if "$DEPLOY_DIR/start-outcomes-sync.sh" status >/dev/null 2>&1; then
    pass "outcomes-sync running"
  else
    warn "outcomes-sync did not report running. Check $DEPLOY_DIR/outcomes-sync.log"
  fi
}

smoke_scraper_launcher() {
  step "Scraper Launcher Smoke Check"

  if "$PROJECT_DIR/scraper-launcher.sh"; then
    pass "Scraper launcher completed"
  else
    warn "Scraper launcher did not complete. Check the newest logs/scraper-launcher-*.log"
    return 0
  fi
}

check_all() {
  refresh_bins
  local failures=0

  echo "PropEdge Local Mac Recovery Check"
  echo "Project: $PROJECT_DIR"
  echo ""

  if is_clt_installed; then
    pass "Apple Command Line Tools installed"
  else
    fail "Apple Command Line Tools missing"
    info "Run: xcode-select --install"
    failures=$((failures + 1))
  fi

  if has_cmd git; then
    pass "git available"
  else
    fail "git unavailable"
    failures=$((failures + 1))
  fi

  if [ -n "$NODE_BIN" ]; then
    pass "node available: $NODE_BIN ($("$NODE_BIN" --version))"
  else
    fail "node missing"
    failures=$((failures + 1))
  fi

  if [ -n "$NPM_BIN" ]; then
    pass "npm available: $NPM_BIN ($("$NPM_BIN" --version))"
  else
    fail "npm missing"
    failures=$((failures + 1))
  fi

  if [ -f "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]; then
    pass "Google Chrome installed"
  else
    fail "Google Chrome missing"
    failures=$((failures + 1))
  fi

  check_file "$PROJECT_DIR/.env" "root .env present" || failures=$((failures + 1))
  check_file "$PROJECT_DIR/credentials.json" "root credentials.json present" || failures=$((failures + 1))
  check_file "$DEPLOY_DIR/.env" "deploy .env present" || failures=$((failures + 1))
  check_file "$DEPLOY_DIR/credentials.json" "deploy credentials.json present" || failures=$((failures + 1))

  check_file "$PROJECT_DIR/scraper-v15-integrated.js" "root scraper v15 present" || failures=$((failures + 1))
  check_file "$DEPLOY_DIR/scraper-v15-integrated.js" "deploy scraper v15 present" || failures=$((failures + 1))
  check_file "$DEPLOY_DIR/outcomes-sync.js" "outcomes-sync service present" || failures=$((failures + 1))

  check_dir "$PROJECT_DIR/node_modules" "root node_modules present" || failures=$((failures + 1))

  if [ -d "$FUNCTIONS_DIR/node_modules" ]; then
    pass "deploy function node_modules present"
  else
    warn "deploy function node_modules missing"
  fi

  if [ -f "$LAUNCH_AGENTS/com.propedge.scraper.REAL_MAC.plist" ]; then
    pass "scraper launch agent installed"
  else
    warn "scraper launch agent not installed"
  fi

  if [ -f "$LAUNCH_AGENTS/com.propedge.outcomes-sync.plist" ]; then
    pass "outcomes-sync launch agent installed"
  else
    warn "outcomes-sync launch agent not installed"
  fi

  if "$DEPLOY_DIR/start-outcomes-sync.sh" status >/dev/null 2>&1; then
    pass "outcomes-sync currently running"
  else
    warn "outcomes-sync not currently running"
  fi

  echo ""
  if [ "$failures" -eq 0 ]; then
    pass "Recovery check passed"
    return 0
  fi

  fail "Recovery check found $failures blocker(s)"
  return 1
}

bootstrap() {
  step "PropEdge Bootstrap Started"
  info "This script will not deploy production."

  install_clt
  install_homebrew
  install_node_and_chrome
  install_project_dependencies
  validate_scripts
  start_services
  install_agents
  check_all

  step "Bootstrap Complete"
  info "Production deploy remains gated by explicit APPROVED / GO."
  info "Optional smoke test: ./recover-local-mac.sh smoke-scraper"
}

case "${1:-check}" in
  check)
    check_all
    ;;
  bootstrap)
    bootstrap
    ;;
  install-agents|--install-agents)
    validate_scripts
    install_agents
    ;;
  install-deps|--install-deps)
    install_project_dependencies
    ;;
  repair-puppeteer|--repair-puppeteer)
    repair_puppeteer
    ;;
  start-services|--start-services)
    start_services
    ;;
  smoke-scraper|--smoke-scraper)
    smoke_scraper_launcher
    ;;
  *)
    echo "Usage: $0 {check|bootstrap|install-deps|repair-puppeteer|install-agents|start-services|smoke-scraper}"
    exit 2
    ;;
esac
