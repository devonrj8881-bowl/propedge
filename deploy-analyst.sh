#!/usr/bin/env bash
# Deploy PropEdge Generative UI (Next.js + Vercel AI SDK streamUI)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
APP="$ROOT/analyst-app"
cd "$APP"

if [[ ! -f .env.local ]] && [[ -f "$ROOT/.env" ]]; then
  echo "📋 Seeding analyst-app/.env.local from project .env (keys only)..."
  : > .env.local
  for key in OPENAI_API_KEY GEMINI_API_KEY OPENAI_MODEL GEMINI_MODEL GEMINI_ANALYST_MODEL; do
    val="$(grep -E "^${key}=" "$ROOT/.env" 2>/dev/null | head -1 | cut -d= -f2- || true)"
    [[ -n "$val" ]] && echo "${key}=${val}" >> .env.local
  done
  echo "PROPEDGE_FEED_URL=https://propedgemasters.netlify.app/.netlify/functions/prop-feed?sheet=propedge-main" >> .env.local
fi

echo "🧪 Building analyst-app..."
npm run build

if command -v vercel >/dev/null 2>&1 || [[ -x "$APP/node_modules/.bin/vercel" ]]; then
  VERCEL="${VERCEL:-$APP/node_modules/.bin/vercel}"
  [[ -x "$VERCEL" ]] || VERCEL="npx vercel"
  echo "🚀 Deploying to Vercel (analyst-app)..."
  "$VERCEL" deploy --prod --yes
else
  echo "✅ Build OK. Run: ./configure-vercel-analyst.sh --deploy"
  echo "   Local dev: cd analyst-app && npm run dev"
fi
