# PROPEDGE-DEPLOY — PUBLISH FOLDER CONTRACT
_Last refreshed: 2026-05-10. Authoritative project rules live in `../CLAUDE.md`. This file = publish-folder specifics._

## Mounted paths
- **Repo root:** `/Users/devonjohnson/Documents/Claude/Projects/PropEdge`
- **This folder:** `/Users/devonjohnson/Documents/Claude/Projects/PropEdge/propedge-deploy`
- **Live file (the one that actually ships):** `propedge-deploy/index.html`
- **Functions deployed:** `propedge-deploy/netlify/functions/`
- **Session handoff:** `propedge-deploy/SESSION_NOTES.md`

## Single-source-of-truth files
| File | Purpose |
|------|---------|
| `index.html` | Live app. ~1.2 MB. ALL UI edits land here. |
| `netlify/functions/ask-analyst.js` | Ollama Gemma analyst + deterministic `matchup-summary-v2` fallback. Mirror with root `netlify/functions/ask-analyst.js`. |
| `netlify/functions/news-context.js` | Lightweight news fetcher (ESPN/CBS/RotoWire/Covers). Mirror with root. |
| `netlify/functions/news.js` | News tab feed. Mirror with root. |
| `netlify/functions/league-news.js` | League-scoped news (deployed from root copy). |
| `netlify/functions/ai-recommendations.js` | AI parlay recommendations (Ollama via Tailscale). |
| `netlify/functions/pace-data.js` | Pace trends data endpoint. |
| `netlify/functions/ai-feedback.js` | HIT/MISS outcome capture from UI. |
| `SESSION_NOTES.md` | Append-only handoff log. |

## Backup files in this folder (DO NOT EDIT)
- `index-BACKUP-april16-stable.html` — April 16 stable snapshot.
- `index.html.bak` — pre-restoration backup.
- `index.html.v2-fixed` — May 5 v2 baseline.
- `index.html.propedge-fix-preview` — May 10 fix-pack preview.
- `index.html.april4-backup` — April 4 baseline.

## App build markers (preflight checks)
`deploy-with-token.sh` verifies these markers in `index.html` before pushing:
- `PropEdge May 2026 Fix Pack`
- `PROPEDGE_NEWS_PROXY`
- `/favicon.svg`

After any patch, also update:
- Line 2: `<!-- PropEdge vX.X — <description> — YYYY-MM-DD LIVE DEPLOY -->`
- Line ~42: `<meta name="app-version" content="vX.X-...">`

## Deploy command (run from repo root)
```bash
cd /Users/devonjohnson/Documents/Claude/Projects/PropEdge
./deploy-prod.sh                 # → wraps deploy-with-token.sh
# fallback (CLI broken):
bash repair-netlify-cli.sh && ./deploy-prod.sh
# static-only emergency (skips functions):
bash deploy-static-api.sh
```
- Site ID: `838cca00-a711-4175-b00e-95203cda9900` (propedgemasters)
- Auth: `NETLIFY_AUTH_TOKEN` from `../.env`
- Live URL: https://propedgemasters.netlify.app
- Logs: `../logs/deploy-YYYYMMDD-HHMMSS.log`

## Current app state (v7.8)
- **Theme:** DK/FanDuel dark (`--bg-primary: #1a1d2e`). Logo `/logo.png`, favicons `/favicon.svg|-32|-180`.
- **Tabs:** Games / Props / PropAI / News / Parlay / Strategy / Portfolio.
- **PropAI:** Ollama `gemma4:e4b` over Tailscale. Fast Mode toggle persisted as `propedge_aiFastMode`.
- **Analyst output:** Linemaker-style sections (MATCHUP ANALYSIS, NARRATIVE, KEY MATCHUP BATTLES, PROP MARKET READ, BEST BETS, RISK NOTES, SOURCES USED). Team-only queries → deterministic `matchup-summary-v2` with `ARTICLE TEXT CONTEXT`.
- **Scoring:** PropIQ + Bayesian shrinkage (k=7) + juice gate (≥5.5%) + reversion guard + cushion + 1/3 Kelly.
- **Outcomes loop:** `outcomes.json` HIT/MISS → per-prop-type calibration, 5% → 100% over 2-3 weeks.
- **Filters:** Ultimate ≥83 / Prime 70-83 / Strong 55-70 / Value <70 — mutually exclusive, recalc at filter time.
- **Animations:** `cardSpringLift`, `filterGlow`, `badgeBounce`, `underlineSlide`, `spin3d`, live-pulse ring.
- **Performance:** `runAfterPaint()` defers heavy tab renders; mobile nav single-row scroll, `touch-action: manipulation`.

## Editing rules (delta from parent CLAUDE.md)
1. Patch, don't rewrite. Preserve DOM, comments, ordering.
2. Mirror every function edit to root `netlify/functions/` AND `propedge-deploy/netlify/functions/`.
3. `Parlay` and `Strategy` tabs must remain siblings outside `#main` (blank-tab regression guard).
4. Do not touch backup snapshots (`index-BACKUP-*`, `*.bak`, `*-preview`, `.v2-fixed`).
5. Do not commit `node_modules/`, `package-lock.json`, or `propedge-manual.zip` (~500 MB).
6. After patch: update version string, run preflight markers locally (`grep -q "PropEdge May 2026 Fix Pack" index.html` etc.) before requesting deploy approval.
7. **Local browser verify required before every deploy** — open `propedge-deploy/index.html` in browser, navigate to the changed tab/feature, confirm it renders and behaves correctly.

## Local verification checklist (run before EVERY deploy)
```bash
# 1. Preflight markers
grep -q "PropEdge May 2026 Fix Pack" propedge-deploy/index.html && echo "marker OK"
grep -q "PROPEDGE_NEWS_PROXY" propedge-deploy/index.html && echo "proxy OK"
grep -q "/favicon.svg" propedge-deploy/index.html && echo "favicon OK"

# 2. For analyst-app changes only:
cd analyst-app && npx tsc --noEmit && echo "tsc OK"
npm run build && echo "build OK"
# Then open http://localhost:3000 and test the changed feature

# 3. Open propedge-deploy/index.html in browser
#    → navigate to changed section → verify visually
```
Report: "verified locally: [what was tested]" before triggering deploy.

## Session start checklist (from this folder)
1. `pwd` → confirm `…/PropEdge/propedge-deploy`.
2. Read `SESSION_NOTES.md` (latest entry).
3. Read only the target section of `index.html`.
4. State file + section + risk level before editing.
5. Patch.
6. Confirm write landed; report version-string bump if applied.
7. **Run local verification checklist above.**
8. If deploy: trigger Deployment Handshake → wait for GO.
