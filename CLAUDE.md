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

### Practical quality signal
- These rules are working when diffs are smaller, fewer rewrites are needed, and clarifying questions happen before implementation mistakes.
