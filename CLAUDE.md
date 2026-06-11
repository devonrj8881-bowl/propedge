# PropEdge — Project Instruction Framework
_Global source-of-truth for repository-wide working behavior._

## Scope
- Applies to the full project at `/Users/devonjohnson/Documents/Claude/Projects/PropEdge`.
- `propedge-deploy/CLAUDE.md` remains publish-folder specific and should stay aligned with this file.

## Core principles
- Keep changes minimal, direct, and traceable to the active request.
- Prefer stability and correctness over broad refactors.
- Preserve existing patterns unless a change is explicitly requested.

## Behavioral Guardrails (Caution-First)
Tradeoff: these rules bias toward caution over speed. For trivial tasks, apply judgment.

### 1) Think Before Coding
- State assumptions explicitly before implementation.
- If multiple interpretations exist, present them; do not pick silently.
- If uncertainty blocks correctness, stop and ask.
- If a simpler viable approach exists, call it out.

### 2) Simplicity First
- Write the minimum code needed to solve the requested problem.
- Do not add unrequested features, abstraction layers, or configurability.
- Do not add handling for impossible scenarios.
- If the implementation feels overbuilt, simplify before finalizing.

### 3) Surgical Changes
- Touch only lines directly required by the request.
- Match existing local style and patterns.
- Do not refactor adjacent code that is not part of the task.
- Clean up only artifacts created by your own change (unused imports/vars/functions).
- If unrelated dead code is noticed, mention it; do not remove it unless requested.

### 4) Goal-Driven Execution
- Convert requests into verifiable outcomes (bug repro -> fix -> verify).
- Define concrete success checks before coding.
- For multi-step work, keep a short plan with step-level verification.
- Loop until the requested behavior is confirmed, not just "looks correct."

### 5) Verify Locally Before Deploying
**REQUIRED before every commit/push/deploy — no exceptions.**

#### analyst-app (Vercel) changes
```bash
cd analyst-app && npx tsc --noEmit   # must pass with 0 errors
npm run build                         # must complete successfully
```
Open `http://localhost:3000` and exercise the changed feature before pushing.

#### index.html (Netlify) changes
```bash
# Preflight marker check
grep -q "PropEdge May 2026 Fix Pack" propedge-deploy/index.html && echo "OK"
grep -q "PROPEDGE_NEWS_PROXY" propedge-deploy/index.html && echo "OK"
grep -q "/favicon.svg" propedge-deploy/index.html && echo "OK"
# Open propedge-deploy/index.html in browser — navigate to changed tab/feature
```

#### Rule
- No `git push` or `./deploy-prod.sh` until local verification passes.
- If a local dev server is not running, start it (`cd analyst-app && npm run dev` or open index.html directly).
- Report verification result ("tsc clean, tested locally on mobile sim") before requesting deploy approval.

### 6) Post-Deploy Sync (after every `./deploy-prod.sh`)
**REQUIRED after every successful Netlify deploy — no exceptions.**

```bash
# 1. Sync deploy copy to root
cp propedge-deploy/index.html index.html

# 2. Stage both + any changed Netlify functions
git add propedge-deploy/index.html index.html
git add netlify/functions/   # if any functions changed

# 3. Commit with version bump message
git commit -m "deploy: vX.XXX — <description>"

# 4. Push to GitHub
git push
```

#### Rule
- GitHub must always reflect exactly what is live on Netlify.
- Do not consider a deploy "done" until the commit is pushed.
- If the user says "sync" or "commit and push" after a deploy, run all four steps above.

### Practical quality signal
- These rules are working when diffs are smaller, fewer rewrites are needed, and clarifying questions happen before implementation mistakes.
