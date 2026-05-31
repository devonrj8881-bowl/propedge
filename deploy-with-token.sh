#!/usr/bin/env bash
set -u

PROJECT_DIR="/Users/devonjohnson/Documents/Claude/Projects/PropEdge"
PUBLISH_DIR="$PROJECT_DIR/propedge-deploy"
# Canonical sources live under publish dir (per PropEdge workflow); bundling uses a lean copy here:
SOURCE_FUNCTIONS_DIR="$PUBLISH_DIR/netlify/functions"
BUNDLE_FUNCTIONS_DIR="$PROJECT_DIR/netlify/functions"
RUNNER_DIR="$PROJECT_DIR/.netlify-cli-runner"
NPM_CACHE_DIR="$PROJECT_DIR/.npm-cache"
NETLIFY_HOME_DIR="$PROJECT_DIR/.netlify-home"
LOG_DIR="$PROJECT_DIR/logs"
LOG_FILE="$LOG_DIR/deploy-$(date +%Y%m%d-%H%M%S).log"

mkdir -p "$LOG_DIR"

exec > >(tee -a "$LOG_FILE") 2>&1

echo "🚀 PropEdge deploy starting..."
echo "📁 Project: $PROJECT_DIR"
echo "📦 Publish dir: $PUBLISH_DIR"
echo "🧩 Functions sources: $SOURCE_FUNCTIONS_DIR"
echo "🧩 Functions bundle dir: $BUNDLE_FUNCTIONS_DIR"
echo "🧰 CLI runner: $RUNNER_DIR"
echo "🗄️ npm cache: $NPM_CACHE_DIR"
echo "🏠 Netlify CLI home: $NETLIFY_HOME_DIR"
echo "📝 Log: $LOG_FILE"
echo

cd "$PROJECT_DIR" || {
  echo "❌ Could not cd to $PROJECT_DIR"
  exit 1
}

if [[ -f ".env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source ".env"
  set +a
fi

SITE_ID="${NETLIFY_SITE_ID:-${NETLIFY_SITE:-838cca00-a711-4175-b00e-95203cda9900}}"

if [[ -z "${NETLIFY_AUTH_TOKEN:-}" ]]; then
  echo "❌ NETLIFY_AUTH_TOKEN is missing. Add it to .env or export it before running."
  exit 1
fi

if [[ ! -d "$PUBLISH_DIR" ]]; then
  echo "❌ Publish directory not found: $PUBLISH_DIR"
  exit 1
fi

if [[ ! -f "$PUBLISH_DIR/index.html" ]]; then
  echo "❌ Publish index missing: $PUBLISH_DIR/index.html"
  exit 1
fi

echo "🔎 Preflight markers..."
if grep -q "PropEdge May 2026 Fix Pack" "$PUBLISH_DIR/index.html"; then
  echo "  ✅ fix pack marker"
else
  echo "  ❌ missing fix pack marker"
  exit 1
fi

if grep -q "PROPEDGE_NEWS_PROXY" "$PUBLISH_DIR/index.html"; then
  echo "  ✅ analyst/news marker"
else
  echo "  ❌ missing analyst/news marker"
  exit 1
fi

if grep -q "/favicon.svg" "$PUBLISH_DIR/index.html"; then
  echo "  ✅ theme/favicon marker"
else
  echo "  ❌ missing theme/favicon marker"
  exit 1
fi

if [[ -d "$SOURCE_FUNCTIONS_DIR" ]]; then
  echo "  ✅ functions sources found"
else
  echo "  ⚠️ functions sources not found"
fi

if [[ "${SKIP_FUNCTIONS:-}" == "1" ]] || [[ "${PROPEDGE_DEPLOY_STATIC:-}" == "1" ]]; then
  echo "  ⚡ SKIP_FUNCTIONS / PROPEDGE_DEPLOY_STATIC — will deploy without bundling functions"
fi

echo
echo "🧰 Preparing isolated Netlify CLI runner..."
mkdir -p "$RUNNER_DIR"
mkdir -p "$NPM_CACHE_DIR"
mkdir -p "$NETLIFY_HOME_DIR"

if [[ ! -f "$RUNNER_DIR/package.json" ]]; then
  printf '{"private":true,"devDependencies":{}}\n' > "$RUNNER_DIR/package.json"
fi

if [[ ! -x "$RUNNER_DIR/node_modules/.bin/netlify" ]]; then
  echo "📦 Installing Netlify CLI into isolated runner..."
  (
    cd "$RUNNER_DIR" &&
    npm_config_cache="$NPM_CACHE_DIR" npm install --no-audit --no-fund --ignore-scripts --save-dev netlify-cli@latest
  )
  install_status=$?
  if [[ $install_status -ne 0 ]]; then
    echo "❌ Isolated Netlify CLI install failed with exit code $install_status"
    echo "   Try: bash repair-netlify-cli.sh"
    echo "   Emergency static-only fallback: bash deploy-static-api.sh"
    exit $install_status
  fi
fi

echo "✅ Netlify CLI runner ready"

ensure_linked_site() {
  local netlify_bin="$RUNNER_DIR/node_modules/.bin/netlify"
  if [[ -f "$PROJECT_DIR/.netlify/state.json" ]] && grep -q "$SITE_ID" "$PROJECT_DIR/.netlify/state.json"; then
    return 0
  fi
  if [[ -f "$PROJECT_DIR/netlify/.netlify/state.json" ]] && grep -q "$SITE_ID" "$PROJECT_DIR/netlify/.netlify/state.json"; then
    return 0
  fi
  if HOME="$NETLIFY_HOME_DIR" "$netlify_bin" status --auth "$NETLIFY_AUTH_TOKEN" >/dev/null 2>&1; then
    return 0
  fi
  echo "🔗 Netlify status check failed; repairing link state..."
  if [[ -x "$PROJECT_DIR/repair-netlify-cli.sh" ]]; then
    bash "$PROJECT_DIR/repair-netlify-cli.sh" >/dev/null 2>&1 || true
  fi
  if ! HOME="$NETLIFY_HOME_DIR" "$netlify_bin" link --id "$SITE_ID" --auth "$NETLIFY_AUTH_TOKEN" >/dev/null 2>&1; then
    echo "❌ Unable to auto-link Netlify project."
    echo "   Try: HOME=\"\$PWD/.netlify-home\" ./.netlify-cli-runner/node_modules/.bin/netlify link --id \"$SITE_ID\" --auth \"\$NETLIFY_AUTH_TOKEN\""
    exit 1
  fi
}

ensure_linked_site
echo "✅ Netlify project link verified"
echo
echo "📤 Deploying to Netlify production..."
echo "   Site: $SITE_ID"
echo "   Using staged publish dir (tiny upload) + --no-build (skips @netlify/build orchestrator)."
echo "   Functions bundle only from $BUNDLE_FUNCTIONS_DIR when not SKIP_FUNCTIONS."
echo "   Force cold function bundle: FORCE_FUNCTIONS_REBUILD=1 ./deploy-prod.sh"
echo "   Verbose: DEPLOY_VERBOSE=1 ./deploy-prod.sh"
echo "   Static-only (no lambdas): SKIP_FUNCTIONS=1 ./deploy-prod.sh"
echo

if [[ -f "$PUBLISH_DIR/propedge-manual.zip" ]]; then
  sz=$(ls -lh "$PUBLISH_DIR/propedge-manual.zip" | awk '{print $5}')
  echo "⚠️  propedge-manual.zip present (${sz}) — excluded from staged publish."
fi

STAGE_DIR="$(mktemp -d /tmp/propedge-publish.XXXXXX)"
cleanup_publish_stage() { rm -rf "$STAGE_DIR"; }
trap cleanup_publish_stage EXIT

echo "📁 Staging lean publish → $STAGE_DIR (exclude netlify/, .claude/, zip, scrapers, …)"
rsync -a \
  --exclude '.claude/' \
  --exclude 'propedge-manual.zip' \
  --exclude 'credentials.json' \
  --exclude 'netlify/' \
  --exclude 'node_modules/' \
  --exclude '*.backup' \
  --exclude 'index-BACKUP*' \
  --exclude 'analysis-draft*' \
  --exclude 'index.html.bak' \
  --exclude 'index.html.*backup*' \
  --exclude 'index.html.*preview*' \
  --exclude 'index.html.v2-fixed' \
  --exclude 'scraper*.js' \
  --exclude 'test-*.js' \
  --exclude '*.log' \
  --exclude '*.md' \
  --exclude '*.plist' \
  --exclude '*.service' \
  --exclude 'outcomes-sync.js' \
  --exclude '.env' \
  "$PUBLISH_DIR/" "$STAGE_DIR/"

if [[ ! -f "$STAGE_DIR/index.html" ]]; then
  echo "❌ Staged publish missing index.html"
  exit 1
fi

echo "📊 Staged publish footprint: $(du -sh "$STAGE_DIR" | awk '{print $1}')"
echo

deploy_args=(
  deploy
  --prod
  --no-build
  --dir "$STAGE_DIR"
  --site "$SITE_ID"
  --auth "$NETLIFY_AUTH_TOKEN"
)

if [[ "${FORCE_FUNCTIONS_REBUILD:-}" == "1" ]]; then
  deploy_args+=(--skip-functions-cache)
fi

if [[ "${SKIP_FUNCTIONS:-}" != "1" ]] && [[ "${PROPEDGE_DEPLOY_STATIC:-}" != "1" ]]; then
  if [[ -d "$SOURCE_FUNCTIONS_DIR" ]]; then
    echo "📋 Syncing function sources → $BUNDLE_FUNCTIONS_DIR (excludes node_modules)..."
    mkdir -p "$BUNDLE_FUNCTIONS_DIR"
    rm -rf "$BUNDLE_FUNCTIONS_DIR/node_modules"
    rsync -a \
      --exclude node_modules \
      --exclude '*.backup' \
      "$SOURCE_FUNCTIONS_DIR/" "$BUNDLE_FUNCTIONS_DIR/"
    deploy_args+=(--functions "$BUNDLE_FUNCTIONS_DIR")
  fi
else
  echo "⚡ Omitting --functions (no lambdas bundled this run)."
fi

if [[ "${DEPLOY_VERBOSE:-}" == "1" ]]; then
  deploy_args+=(--debug)
fi

# Reduce silent OOM/hang risk during function bundling
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=8192}"

CI=1 \
HOME="$NETLIFY_HOME_DIR" \
NETLIFY_SITE_ID="$SITE_ID" \
NETLIFY_AUTH_TOKEN="$NETLIFY_AUTH_TOKEN" \
NETLIFY_TELEMETRY_DISABLED=1 \
NETLIFY_CLI_TELEMETRY_DISABLED=1 \
"$RUNNER_DIR/node_modules/.bin/netlify" "${deploy_args[@]}"

deploy_status=$?
if [[ $deploy_status -ne 0 ]]; then
  echo
  echo "❌ Deployment failed with exit code $deploy_status"
  echo "📝 See log: $LOG_FILE"
  echo
  echo "Next steps:"
  echo "  1) Run: bash repair-netlify-cli.sh"
  echo "  2) Then rerun: bash deploy-with-token.sh"
  echo "  3) Static without bundling: SKIP_FUNCTIONS=1 ./deploy-prod.sh"
  echo "  4) Raw zip upload fallback: bash deploy-static-api.sh"
  exit $deploy_status
fi

echo
echo "✅ PropEdge production deploy completed."
echo "🌐 https://propedgemasters.netlify.app"
echo "📝 Log: $LOG_FILE"
