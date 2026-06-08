#!/usr/bin/env bash
set -u

PROJECT_DIR="/Users/devonjohnson/Documents/Claude/Projects/PropEdge"
RUNNER_DIR="$PROJECT_DIR/.netlify-cli-runner"
NPM_CACHE_DIR="$PROJECT_DIR/.npm-cache"
NETLIFY_HOME_DIR="$PROJECT_DIR/.netlify-home"
STAMP="$(date +%Y%m%d-%H%M%S)"

echo "🔧 Repairing PropEdge Netlify deploy tooling..."
echo "📁 $PROJECT_DIR"
echo

cd "$PROJECT_DIR" || {
  echo "❌ Could not cd to $PROJECT_DIR"
  exit 1
}

echo "🧹 Moving broken project-level install out of the way..."
if [[ -d node_modules ]]; then
  mv node_modules "node_modules.bak-$STAMP"
  echo "  ✅ node_modules -> node_modules.bak-$STAMP"
else
  echo "  ℹ️ no node_modules folder to move"
fi

if [[ -f package-lock.json ]]; then
  mv package-lock.json "package-lock.json.bak-$STAMP"
  echo "  ✅ package-lock.json -> package-lock.json.bak-$STAMP"
else
  echo "  ℹ️ no package-lock.json to move"
fi

echo
echo "🧰 Rebuilding isolated Netlify CLI runner..."
rm -rf "$RUNNER_DIR"
mkdir -p "$RUNNER_DIR"
mkdir -p "$NPM_CACHE_DIR"
mkdir -p "$NETLIFY_HOME_DIR"
printf '{"private":true,"devDependencies":{}}\n' > "$RUNNER_DIR/package.json"

(
  cd "$RUNNER_DIR" &&
  npm_config_cache="$NPM_CACHE_DIR" npm cache verify &&
  npm_config_cache="$NPM_CACHE_DIR" npm install --no-audit --no-fund --ignore-scripts --save-dev netlify-cli@latest
)

status=$?
if [[ $status -ne 0 ]]; then
  echo
  echo "❌ Netlify CLI runner repair failed with exit code $status"
  echo "   If npm keeps failing under Node $(node --version), install/use Node 20 LTS and rerun this script."
  echo "   If you want to repair your global npm cache too, run:"
  echo "   sudo chown -R $(id -u):$(id -g) \"$HOME/.npm\""
  exit $status
fi

echo
echo "🔎 Verifying isolated CLI..."
HOME="$NETLIFY_HOME_DIR" "$RUNNER_DIR/node_modules/.bin/netlify" --version
status=$?
if [[ $status -ne 0 ]]; then
  echo "❌ Netlify CLI starts incorrectly even in the isolated runner."
  exit $status
fi

echo
echo "✅ Repair complete."
echo "Next: bash deploy-with-token.sh"
