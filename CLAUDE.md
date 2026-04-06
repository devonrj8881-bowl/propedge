Claude  
· MD

# 🚀 PROJECT BLUEPRINT & COWORK INSTRUCTIONS
## PropEdge — Daily Sports Prop Model

---

## 🎯 1. Mission & Context

- **Project Name:** PropEdge
- **Core Goal:** This is Devon's sports betting prop model project. PropEdge is a standalone offline single-file HTML app for daily NBA, NHL, and MLB player prop analysis.
- **User:** Devon — advanced user building practical betting tools with a strong preference for efficient, accurate, patch-based updates.
- **Primary Sportsbook:** FanDuel
- **This is my real environment:** Files in this folder are my actual local project files. Changes should be applied directly to these files on my computer, not to a throwaway sandbox or demo copy.

---

## 🛠️ 2. App Architecture & Environment

- **App Type:** Standalone offline single-file HTML app
- **File Structure Preference:** One self-contained `.html` file with inline CSS and JavaScript, no external app dependencies, no separate CSS/JS files
- **Main Tabs:** Players | Parlay | Strategy
- **Critical Layout Rule:** `Parlay` and `Strategy` tabs must remain siblings outside `#main` to avoid the blank tab bug
- **Primary Output:** A single `.html` file ready to open locally in a browser
- **Sports Covered:** NBA, NHL, MLB

---

## 📋 3. Working Rules for Cowork

1. **Real files, not sandbox**
   - When I select this folder in Cowork, work directly on the actual project files in this folder on my computer.
   - Do not create separate demo builds, prototype copies, or sandbox projects unless I explicitly ask.

2. **Patch, don’t rewrite**
   - Do not rewrite the full HTML file unless I explicitly say to rebuild from scratch.
   - Prefer targeted edits to the exact sections that need updating: player cards, data objects, styling tweaks, scoring logic, links, or tab behavior.

3. **Preserve structure**
   - Match the existing card layout, color scheme, spacing, and tab structure from prior PropEdge builds.
   - Preserve the existing DOM architecture unless a structural fix is necessary.
   - Never move `Parlay` or `Strategy` inside `#main`.

4. **Scope transparency**
   - Before making changes, state which file(s) you plan to read and what section(s) you plan to edit.
   - If a requested change could affect layout, scoring, or deep-link generation, explain the intended scope first.

---

## 📊 4. Daily Build Inputs

For each daily PropEdge build or refresh, pull and verify:

- Live schedule
- Confirmed starters and lineups where available
- Injury reports
- Current FanDuel lines for relevant props
- Recent L10 performance per player

If any line, injury, lineup, or starter data cannot be confirmed, clearly flag that inside the app and in your response rather than guessing. Injury and lineup changes can materially affect prop value, so uncertain data should be labeled as unconfirmed. [web:37][web:40]

---

## 🧮 5. Model & Output Expectations

- **Scoring Engine:** Use calibrated tiers, L10 hit rate bars, and defensive matchup ratings
- **Player Cards:** Must show target tiers per player
- **Parlay Tab:** Must include EV calculations
- **FanDuel Integration:** Include FanDuel deep-link buttons per prop and preserve FanDuel-specific linking format when provided in the existing project conventions or prior builds; if a link format cannot be verified from the existing project context, flag it rather than inventing it. [web:28][web:32]
- **Output Format:** One finished `.html` file that opens locally in-browser with no extra setup

---

## ⚡ 6. Token & Context Discipline

- Read the main HTML file and any small reference files first before scanning unrelated files.
- Avoid re-reading the full HTML repeatedly if only one section needs patching.
- For updates, focus only on the specific sport/day/sections involved unless I ask for a full rebuild.
- Keep responses concise and practical: direct answer first, then only the necessary implementation notes.
- Do not paste giant HTML blocks unless I ask; show only the changed section, diff, or exact snippet.

---

## 🧠 7. Memory & Session Practices

- Treat this file as the project contract for all PropEdge sessions.
- Keep a short running summary of what changed today, what data was confirmed, and what still needs review.
- If the session gets long, write a brief handoff summary instead of repeating the entire project context.
- Reuse prior project structure and conventions whenever possible so daily builds stay consistent and token-efficient.

---

## 💬 8. Response Style

- Start with the exact answer, patch, or next action.
- Be concise by default.
- Use small diffs or targeted snippets instead of full rewrites.
- If data is missing, ask one focused question or mark the data as unconfirmed.
- Assume you can read project files directly from the selected folder; I should not need to paste the whole app unless necessary.

---

## 📁 9. Folder Snapshot

```bash
PropEdge/
├── CLAUDE.md                    ← This file
├── PropEdge.html                ← Main single-file offline app
├── SESSION_NOTES.md             ← Optional running handoff notes
├── data-notes.md                ← Optional daily source notes
└── archives/
    ├── PropEdge-2026-04-04.html
    └── PropEdge-2026-04-05.html
