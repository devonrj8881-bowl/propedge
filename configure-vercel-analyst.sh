#!/usr/bin/env bash
# Link + env sync + optional prod deploy for analyst-app on Vercel.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
APP="$ROOT/analyst-app"
ENV_FILE="$ROOT/.env"
cd "$APP"

VERCEL="npx vercel"
PROJECT_NAME="${VERCEL_ANALYST_PROJECT:-propedge-generative-analyst}"

echo "== PropEdge analyst-app → Vercel =="

if ! $VERCEL whoami >/dev/null 2>&1; then
  echo "Login required:"
  $VERCEL login
fi

if [[ ! -f .vercel/project.json ]]; then
  echo "Linking project: $PROJECT_NAME"
  $VERCEL link --yes --project "$PROJECT_NAME"
fi

push_env() {
  local key="$1"
  local value="$2"
  [[ -z "$value" ]] && return 0
  # Production (required for prod deploy)
  $VERCEL env add "$key" production --value "$value" --yes --force --sensitive 2>/dev/null \
    || $VERCEL env add "$key" production --value "$value" --yes --force 2>/dev/null \
    || true
  # Preview — all branches
  $VERCEL env add "$key" preview --value "$value" --yes --force --sensitive 2>/dev/null \
    || $VERCEL env add "$key" preview --value "$value" --yes --force 2>/dev/null \
    || true
  echo "  ✓ $key"
}

netlify_val() {
  local key="$1"
  python3 - "$ENV_FILE" "$key" <<'PY'
import json, os, sys, urllib.request
env_path, want = sys.argv[1], sys.argv[2]
token = site = None
with open(env_path) as f:
    for line in f:
        if line.startswith("NETLIFY_AUTH_TOKEN="):
            token = line.split("=", 1)[1].strip()
        if line.startswith("NETLIFY_SITE_ID="):
            site = line.split("=", 1)[1].strip()
if not token or not site:
    sys.exit(0)
req = urllib.request.Request(
    f"https://api.netlify.com/api/v1/sites/{site}/env",
    headers={"Authorization": f"Bearer {token}"},
)
with urllib.request.urlopen(req, timeout=20) as resp:
    data = json.load(resp)
for item in data:
    if item.get("key") == want:
        vals = item.get("values") or []
        for v in vals:
            if v.get("value"):
                print(v["value"], end="")
                sys.exit(0)
        if item.get("value"):
            print(item["value"], end="")
PY
}

local_val() {
  local key="$1"
  local file="$APP/.env.local"
  [[ -f "$file" ]] || return 0
  grep -E "^${key}=" "$file" 2>/dev/null | head -1 | cut -d= -f2- || true
}
if [[ "${1:-}" != "--deploy-only" ]]; then
for key in OPENAI_API_KEY OPENAI_MODEL GEMINI_API_KEY GEMINI_MODEL; do
  val="$(netlify_val "$key" || true)"
  push_env "$key" "$val"
done

GEMINI_ANALYST="$(netlify_val GEMINI_ANALYST_MODEL || true)"
[[ -z "$GEMINI_ANALYST" ]] && GEMINI_ANALYST="$(netlify_val GEMINI_MODEL || true)"
push_env "GEMINI_ANALYST_MODEL" "$GEMINI_ANALYST"

# Kimi / OpenRouter + Gemini (prefer analyst-app/.env.local — not stored on Netlify)
for key in OPENROUTER_API_KEY KIMI_MODEL KIMI_MAX_OUTPUT_TOKENS KIMI_TIMEOUT_MS KIMI_API_URL \
           MOONSHOT_API_KEY GOOGLE_GENERATIVE_AI_API_KEY GEMINI_MODEL PROPEDGE_FEED_URL; do
  val="$(local_val "$key" || true)"
  push_env "$key" "$val"
done
# Mirror GEMINI_API_KEY → GOOGLE_GENERATIVE_AI_API_KEY if only one is set
GEMINI_DIRECT="$(local_val GOOGLE_GENERATIVE_AI_API_KEY || true)"
[[ -z "$GEMINI_DIRECT" ]] && GEMINI_DIRECT="$(local_val GEMINI_API_KEY || true)"
[[ -z "$GEMINI_DIRECT" ]] && GEMINI_DIRECT="$(netlify_val GEMINI_API_KEY || true)"
push_env "GOOGLE_GENERATIVE_AI_API_KEY" "$GEMINI_DIRECT"

push_env "PROPEDGE_FEED_URL" "https://propedgemasters.netlify.app/.netlify/functions/prop-feed?sheet=propedge-main"
fi

echo ""
echo "Vercel env:"
$VERCEL env ls 2>/dev/null | head -20

if [[ "${1:-}" == "--deploy" ]] || [[ "${1:-}" == "--deploy-only" ]]; then
  echo ""
  echo "Deploying production..."
  DEPLOY_URL="$($VERCEL deploy --prod --yes 2>&1 | tail -1)"
  echo ""
  echo "Production URL: $DEPLOY_URL"
  echo ""
  echo "Update propedge-deploy/index.html:"
  echo "  <meta name=\"analyst-app-url\" content=\"$DEPLOY_URL\">"
fi

echo ""
echo "Done. Redeploy: ./configure-vercel-analyst.sh --deploy-only"
