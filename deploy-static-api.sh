#!/usr/bin/env bash
set -u

PROJECT_DIR="/Users/devonjohnson/Documents/Claude/Projects/PropEdge"
PUBLISH_DIR="$PROJECT_DIR/propedge-deploy"
LOG_DIR="$PROJECT_DIR/logs"
LOG_FILE="$LOG_DIR/deploy-static-$(date +%Y%m%d-%H%M%S).log"
ZIP_FILE="/tmp/propedge-static-$(date +%Y%m%d-%H%M%S).zip"
RESPONSE_FILE="/tmp/propedge-netlify-response-$(date +%Y%m%d-%H%M%S).json"

mkdir -p "$LOG_DIR"
exec > >(tee -a "$LOG_FILE") 2>&1

echo "⚡ PropEdge static API deploy starting..."
echo "📁 Project: $PROJECT_DIR"
echo "📦 Publish dir: $PUBLISH_DIR"
echo "📝 Log: $LOG_FILE"
echo
echo "⚠️ This is a static-file fallback. Use deploy-with-token.sh when functions need to be bundled."
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

if [[ ! -f "$PUBLISH_DIR/index.html" ]]; then
  echo "❌ Publish index missing: $PUBLISH_DIR/index.html"
  exit 1
fi

echo "🔎 Preflight markers..."
grep -q "PropEdge May 2026 Fix Pack" "$PUBLISH_DIR/index.html" && echo "  ✅ fix pack marker" || { echo "  ❌ missing fix pack marker"; exit 1; }
grep -q "PROPEDGE_NEWS_PROXY" "$PUBLISH_DIR/index.html" && echo "  ✅ analyst/news marker" || { echo "  ❌ missing analyst/news marker"; exit 1; }
grep -q "/favicon.svg" "$PUBLISH_DIR/index.html" && echo "  ✅ theme/favicon marker" || { echo "  ❌ missing theme/favicon marker"; exit 1; }

echo
STATIC_TMP="$(mktemp -d /tmp/propedge-static-src.XXXXXX)"
cleanup_static_tmp() { rm -rf "$STATIC_TMP"; }
trap cleanup_static_tmp EXIT

echo "🗜️ Staging static files (excluding .claude, manual zip, credentials, function node_modules, logs)..."
rsync -a \
  --exclude '.claude/' \
  --exclude 'propedge-manual.zip' \
  --exclude 'credentials.json' \
  --exclude 'netlify/functions/node_modules/' \
  --exclude '*.log' \
  "$PUBLISH_DIR/" "$STATIC_TMP/"

echo "🗜️ Creating static deploy zip..."
(
  cd "$STATIC_TMP" &&
  /usr/bin/zip -qr "$ZIP_FILE" .
)

if [[ ! -s "$ZIP_FILE" ]]; then
  echo "❌ Failed to create zip: $ZIP_FILE"
  exit 1
fi

echo "📤 Uploading zip to Netlify Deploy API..."
http_code=$(
  /usr/bin/curl \
    --silent \
    --show-error \
    --connect-timeout 20 \
    --max-time 180 \
    --output "$RESPONSE_FILE" \
    --write-out "%{http_code}" \
    --request POST \
    --header "Authorization: Bearer $NETLIFY_AUTH_TOKEN" \
    --header "Content-Type: application/zip" \
    --data-binary "@$ZIP_FILE" \
    "https://api.netlify.com/api/v1/sites/$SITE_ID/deploys?title=PropEdge%20manual%20static%20deploy"
)

echo "HTTP $http_code"

if [[ "$http_code" != "200" && "$http_code" != "201" ]]; then
  echo "❌ Static deploy failed."
  echo "Response:"
  cat "$RESPONSE_FILE"
  exit 1
fi

echo
echo "✅ Static deploy request accepted."
python3 - "$RESPONSE_FILE" <<'PY'
import json, sys
path = sys.argv[1]
with open(path, "r", encoding="utf-8") as f:
    data = json.load(f)
for key in ("id", "state", "deploy_url", "ssl_url", "url"):
    if data.get(key):
        print(f"{key}: {data[key]}")
PY

echo
echo "🌐 https://propedgemasters.netlify.app"
echo "📝 Log: $LOG_FILE"
