# PropEdge PropAI UI Implementation Spec

This document is a **single source of truth** for implementing the PropEdge “PropAI” UI so that the live web application matches the provided mock images as closely as possible, while wiring into the existing PropEdge core functions and data flows.

The intended consumer of this document is an AI coding assistant or developer working inside an existing PropEdge React single‑page app.

---

## 1. Goals and Constraints

### 1.1 Visual Goals

- Match the three provided PropEdge **PropAI** mocks:
  - Desktop: PropAI main dashboard (Featured pick, narrative + risk, ladder, upcoming slate).
  - Desktop: PropAI Linemaker Engine (Top picks, best bets, line ladders, risk discipline).
  - Mobile: PropAI featured bet card + breakdown sections + bottom nav.
- Maintain a **dark, high‑contrast, neon-accent** visual style:
  - Background: deep navy/black.
  - Surfaces: slightly lighter dark with subtle gradients.
  - Accents: neon green (primary), plus purple, blue, orange, and red for states.
- Use **rounded cards, pill-shaped chips**, and modern sans-serif typography.
- Use **consistent spacing, radii, and typography** via design tokens.

### 1.2 Technical Constraints

- Frontend framework: **React** (SPA).
- Styling: plain CSS modules or global CSS files (can be adapted to CSS-in-JS or Tailwind later).
- The UI must integrate with existing **PropEdge core functions**, which will provide:
  - Game and slate data (matchups, times, odds).
  - Player props and lines (true probability, fair odds, book odds, edges, CLV, etc.).
  - User state (tracked bets, watchlist, settings).

The UI components defined here should be **presentational** and receive data via props from existing hooks or service functions (e.g. `usePropEdgeData()`, `getFeaturedPick()`, etc.).

---

## 2. Design Tokens (Global Theme)

Create `src/styles/tokens.css` and ensure it is imported once at the root of the app.

```css
/* src/styles/tokens.css */

:root {
  /* Base */
  --color-bg: #020617; /* near-black navy */
  --color-surface: #020617;
  --color-surface-soft: #020617;
  --color-surface-elevated: #020617;

  /* Accents */
  --color-accent: #22c55e;           /* neon green */
  --color-accent-soft: #4ade80;
  --color-accent-purple: #6366f1;
  --color-accent-blue: #38bdf8;
  --color-accent-orange: #fb923c;
  --color-danger: #f97373;

  /* Text */
  --color-text: #f9fafb;
  --color-text-muted: #9ca3af;
  --color-text-soft: #6b7280;

  /* Borders / Dividers */
  --color-border-subtle: rgba(148, 163, 184, 0.35);
  --color-border-strong: rgba(30, 64, 175, 0.9);

  /* Radii */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  --radius-pill: 999px;

  /* Shadows */
  --shadow-soft: 0 18px 45px rgba(15, 23, 42, 0.85);
  --shadow-subtle: 0 4px 12px rgba(15, 23, 42, 0.5);

  /* Typography */
  --font-sans: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text",
    "Inter", -apple-system, BlinkMacSystemFont, sans-serif;

  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-7: 28px;
  --space-8: 32px;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: var(--font-sans);
  background:
    radial-gradient(circle at top left, rgba(56, 189, 248, 0.16), transparent 55%),
    radial-gradient(circle at bottom right, rgba(34, 197, 94, 0.12), transparent 60%),
    var(--color-bg);
  color: var(--color-text);
}

/* App shell */

.propedge-shell {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  min-height: 100vh;
}
```

---

## 3. Layout Shell and Page Structure

### 3.1 High-level Layout

Desktop layout:

- Left: `Sidebar` (fixed 260px).
- Right: `propedge-main` containing:
  - `TopBar` (PropAI header, query bar, filters).
  - `propedge-grid` (3-column content grid for slate context, featured bets, risk + ladders).

Create `src/styles/layout.css`:

```css
/* src/styles/layout.css */

@import "./tokens.css";

.propedge-main {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.propedge-grid {
  display: grid;
  grid-template-columns:
    minmax(0, 1.1fr)
    minmax(0, 1.4fr)
    minmax(0, 1.2fr);
  gap: 20px;
  padding: 20px 24px 32px;
}

/* Generic panel style for dark cards */
.panel {
  background: rgba(15, 23, 42, 0.96);
  border-radius: var(--radius-lg);
  border: 1px solid rgba(30, 64, 175, 0.7);
  box-shadow: var(--shadow-soft);
  padding: var(--space-4);
}
```

### 3.2 Root App Layout

`src/App.tsx`:

```tsx
// src/App.tsx
import React from "react";
import "./styles/tokens.css";
import "./styles/layout.css";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { SlateContext } from "./components/SlateContext";
import { FeaturedBestBets } from "./components/FeaturedBestBets";
import { RiskAndLadders } from "./components/RiskAndLadders";

export const App: React.FC = () => {
  return (
    <div className="propedge-shell">
      <Sidebar />
      <div className="propedge-main">
        <TopBar />
        <main className="propedge-grid">
          <section className="propedge-col">
            <SlateContext />
          </section>
          <section className="propedge-col">
            <FeaturedBestBets />
          </section>
          <section className="propedge-col">
            <RiskAndLadders />
          </section>
        </main>
      </div>
    </div>
  );
};
```

Integration with existing core functions:

- The data rendered inside `SlateContext`, `FeaturedBestBets`, and `RiskAndLadders` should come from existing PropEdge hooks/services (e.g. `usePropEdgeSlate()`, `usePropAIRecommendations()`). Replace hardcoded placeholders with real props wired from those functions.

---

## 4. Sidebar Navigation

### 4.1 Sidebar Component

`src/components/Sidebar.tsx`:

```tsx
// src/components/Sidebar.tsx
import React from "react";
import "../styles/sidebar.css";

export const Sidebar: React.FC = () => {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <span className="sidebar-logo-p">P</span>
        </div>
        <div className="sidebar-logo-text">
          <span className="sidebar-logo-main">PropEdge</span>
          <span className="sidebar-logo-sub">PropAI</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <button className="sidebar-item sidebar-item--active">
          <span className="sidebar-item-icon">🏠</span>
          <span>Dashboard</span>
        </button>
        <button className="sidebar-item">
          <span className="sidebar-item-icon">🎯</span>
          <span>My Props</span>
        </button>
        <button className="sidebar-item">
          <span className="sidebar-item-icon">✨</span>
          <span>PropAI</span>
        </button>
        <button className="sidebar-item">
          <span className="sidebar-item-icon">📈</span>
          <span>Markets</span>
        </button>
        <button className="sidebar-item">
          <span className="sidebar-item-icon">📊</span>
          <span>CLV Tracker</span>
        </button>
        <button className="sidebar-item">
          <span className="sidebar-item-icon">📉</span>
          <span>Trends</span>
        </button>
        <button className="sidebar-item">
          <span className="sidebar-item-icon">🔔</span>
          <span>Alerts</span>
        </button>
        <button className="sidebar-item">
          <span className="sidebar-item-icon">💼</span>
          <span>Portfolio</span>
        </button>
      </nav>

      <div className="sidebar-footer">
        <button className="sidebar-item sidebar-item--sub">
          <span className="sidebar-item-icon">⚙️</span>
          <span>Settings</span>
        </button>
        <button className="sidebar-item sidebar-item--sub">
          <span className="sidebar-item-icon">❓</span>
          <span>Help</span>
        </button>
      </div>

      <div className="sidebar-upsell">
        <div className="sidebar-upsell-icon">👑</div>
        <div className="sidebar-upsell-body">
          <div className="sidebar-upsell-title">PropEdge+</div>
          <div className="sidebar-upsell-sub">
            Unlock premium tools and advanced analytics.
          </div>
        </div>
        <button className="sidebar-upsell-cta">Upgrade Now</button>
      </div>
    </aside>
  );
};
```

### 4.2 Sidebar Styles

`src/styles/sidebar.css`:

```css
/* src/styles/sidebar.css */

@import "./tokens.css";

.sidebar {
  background: linear-gradient(to bottom, #020617, #020617 40%, #030712);
  border-right: 1px solid rgba(15, 23, 42, 0.9);
  padding: var(--space-5) var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.sidebar-logo-icon {
  width: 32px;
  height: 32px;
  border-radius: 12px;
  background:
    radial-gradient(circle at top left, rgba(56, 189, 248, 0.6), transparent 60%),
    radial-gradient(circle at bottom right, rgba(34, 197, 94, 0.7), transparent 60%),
    #020617;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-subtle);
}

.sidebar-logo-p {
  font-weight: 700;
  color: var(--color-text);
  font-size: 18px;
}

.sidebar-logo-text {
  display: flex;
  flex-direction: column;
  line-height: 1.1;
}

.sidebar-logo-main {
  font-size: 16px;
  font-weight: 600;
}

.sidebar-logo-sub {
  font-size: 11px;
  color: var(--color-accent);
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.sidebar-nav {
  margin-top: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sidebar-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 8px 10px;
  border-radius: var(--radius-md);
  color: var(--color-text-soft);
  font-size: 13px;
  cursor: pointer;
  border: none;
  background: transparent;
  text-align: left;
  transition: background 0.18s ease, color 0.18s ease, transform 0.12s ease;
}

.sidebar-item:hover {
  background: rgba(15, 23, 42, 0.9);
  color: var(--color-text);
}

.sidebar-item--active {
  background: linear-gradient(
    90deg,
    rgba(34, 197, 94, 0.22),
    rgba(56, 189, 248, 0.2)
  );
  color: var(--color-text);
}

.sidebar-item-icon {
  width: 18px;
  display: inline-flex;
  justify-content: center;
}

.sidebar-footer {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sidebar-item--sub {
  font-size: 12px;
  color: var(--color-text-muted);
}

.sidebar-upsell {
  margin-top: var(--space-4);
  padding: 12px;
  border-radius: var(--radius-lg);
  background:
    radial-gradient(circle at top left, rgba(168, 85, 247, 0.35), transparent 60%),
    #020617;
  border: 1px solid rgba(129, 140, 248, 0.45);
  box-shadow: var(--shadow-subtle);
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-rows: auto auto;
  column-gap: var(--space-3);
  row-gap: 4px;
  align-items: center;
}

.sidebar-upsell-icon {
  grid-row: 1 / span 2;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: rgba(168, 85, 247, 0.18);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
}

.sidebar-upsell-title {
  font-size: 13px;
  font-weight: 600;
}

.sidebar-upsell-sub {
  font-size: 11px;
  color: var(--color-text-muted);
}

.sidebar-upsell-cta {
  grid-column: 1 / span 2;
  margin-top: 4px;
  border-radius: var(--radius-pill);
  border: none;
  padding: 6px 10px;
  font-size: 12px;
  background: linear-gradient(90deg, #6366f1, #a855f7);
  color: var(--color-text);
  cursor: pointer;
}
```

---

## 5. TopBar (PropAI Linemaker Header + Query + Filters)

### 5.1 TopBar Component

`src/components/TopBar.tsx`:

```tsx
// src/components/TopBar.tsx
import React from "react";
import "../styles/topbar.css";

export const TopBar: React.FC = () => {
  return (
    <header className="topbar">
      <div className="topbar-main">
        <div className="topbar-title-block">
          <h1 className="topbar-title">PropAI Linemaker Engine BETA</h1>
          <p className="topbar-subtitle">
            True probability, fair odds, CLV, and risk logic for tonight&apos;s board.
          </p>
        </div>

        <div className="topbar-status">
          <div className="topbar-status-item">
            <span className="topbar-status-dot topbar-status-dot--green" />
            <span>Model Status: Optimal</span>
          </div>
          <div className="topbar-status-item">
            <span className="topbar-status-refresh">⟳</span>
            <span>Updated 2 min ago</span>
          </div>
        </div>
      </div>

      <div className="topbar-row">
        <div className="topbar-query-wrapper">
          <div className="topbar-query-sparkle">✨</div>
          <input
            className="topbar-query-input"
            placeholder="Ask PropAI anything... (e.g. 'Who has the best edge on PRA?')"
          />
          <button className="topbar-query-send">→</button>
        </div>

        <div className="topbar-meta">
          <div className="topbar-meta-item">
            <span className="topbar-meta-label">League</span>
            <button className="topbar-chip">
              <span role="img" aria-label="NBA">
                🏀
              </span>
              <span>NBA</span>
            </button>
          </div>
          <div className="topbar-meta-item">
            <span className="topbar-meta-label">Scenario</span>
            <button className="topbar-chip">
              <span>Tonight</span>
            </button>
          </div>
          <div className="topbar-meta-item">
            <span className="topbar-meta-label">Risk Mode</span>
            <button className="topbar-chip">
              <span role="img" aria-label="shield">
                🛡️
              </span>
              <span>Balanced</span>
            </button>
          </div>
          <div className="topbar-meta-item">
            <span className="topbar-meta-label">Min Edge</span>
            <button className="topbar-chip topbar-chip--green">
              <span>+2.5%</span>
            </button>
          </div>
        </div>
      </div>

      <div className="topbar-suggestions">
        <span className="topbar-suggestions-label">Try:</span>
        <button className="topbar-suggestion-pill">
          3+ leg SGPs with the highest EV
        </button>
        <button className="topbar-suggestion-pill">
          Fade public overs in late games
        </button>
      </div>
    </header>
  );
};
```

### 5.2 TopBar Styles

`src/styles/topbar.css`:

```css
/* src/styles/topbar.css */

@import "./tokens.css";

.topbar {
  padding: var(--space-5) var(--space-6) var(--space-3) var(--space-6);
  border-bottom: 1px solid rgba(15, 23, 42, 0.9);
  background: linear-gradient(to bottom, rgba(15, 23, 42, 0.6), transparent);
  position: sticky;
  top: 0;
  z-index: 10;
}

.topbar-main {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-3);
}

.topbar-title-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.topbar-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.topbar-subtitle {
  margin: 0;
  font-size: 13px;
  color: var(--color-text-muted);
}

.topbar-status {
  display: flex;
  gap: var(--space-4);
  font-size: 12px;
  color: var(--color-text-soft);
}

.topbar-status-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.topbar-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--color-text-muted);
}

.topbar-status-dot--green {
  background: var(--color-accent);
}

.topbar-status-refresh {
  font-size: 14px;
}

.topbar-row {
  display: grid;
  grid-template-columns: minmax(0, 2.3fr) minmax(0, 1.7fr);
  align-items: center;
  gap: var(--space-4);
  margin-bottom: var(--space-3);
}

.topbar-query-wrapper {
  display: flex;
  align-items: center;
  background: rgba(15, 23, 42, 0.95);
  border-radius: var(--radius-pill);
  padding: 6px 6px 6px 12px;
  border: 1px solid rgba(55, 65, 81, 0.9);
  box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.9);
}

.topbar-query-sparkle {
  font-size: 16px;
  margin-right: 8px;
}

.topbar-query-input {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--color-text);
  font-size: 13px;
  outline: none;
}

.topbar-query-input::placeholder {
  color: var(--color-text-soft);
}

.topbar-query-send {
  border-radius: 999px;
  border: none;
  width: 30px;
  height: 30px;
  background: linear-gradient(135deg, #22c55e, #4ade80);
  color: #020617;
  font-size: 16px;
  cursor: pointer;
}

.topbar-meta {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  align-items: center;
}

.topbar-meta-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.topbar-meta-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--color-text-soft);
}

.topbar-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--color-border-subtle);
  background: rgba(15, 23, 42, 0.9);
  padding: 4px 10px;
  font-size: 12px;
  color: var(--color-text);
  cursor: pointer;
}

.topbar-chip--green {
  border-color: rgba(34, 197, 94, 0.5);
  color: var(--color-accent-soft);
}

.topbar-suggestions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 11px;
  color: var(--color-text-soft);
}

.topbar-suggestions-label {
  text-transform: uppercase;
  letter-spacing: 0.16em;
  font-size: 10px;
  color: var(--color-text-muted);
}

.topbar-suggestion-pill {
  border-radius: var(--radius-pill);
  border: none;
  background: rgba(15, 23, 42, 0.85);
  color: var(--color-text-soft);
  padding: 4px 10px;
  cursor: pointer;
  font-size: 11px;
}
```

---

## 6. Slate Context Panel (Left Column)

### 6.1 Component

`src/components/SlateContext.tsx`:

```tsx
// src/components/SlateContext.tsx
import React from "react";
import "../styles/slateContext.css";

export const SlateContext: React.FC = () => {
  // In production, replace static items with data from your core slate function:
  // const { games } = usePropEdgeSlate();
  return (
    <section className="panel slate">
      <header className="panel-header">
        <div>
          <h2 className="panel-title">Slate Context</h2>
          <p className="panel-subtitle">8 Games • 16 Players monitored</p>
        </div>
        <span className="slate-tag">Tonight</span>
      </header>

      <div className="slate-list">
        {/* Example game 1 */}
        <div className="slate-item">
          <div className="slate-item-time">7:00 PM ET • MSG</div>
          <div className="slate-item-main">
            <div className="slate-team">
              <div className="slate-logo">NYK</div>
              <div className="slate-team-text">
                <div className="slate-team-name">NYK 50–32</div>
              </div>
            </div>
            <span className="slate-vs">@</span>
            <div className="slate-team">
              <div className="slate-logo slate-logo--away">IND</div>
              <div className="slate-team-text">
                <div className="slate-team-name">IND 47–35</div>
              </div>
            </div>
          </div>
          <div className="slate-meta">
            <span className="slate-meta-pill">J. Hart GTD (Knee)</span>
            <span className="slate-meta-note">
              IND 3rd in pace last 5 games
            </span>
          </div>
        </div>

        {/* Example game 2 */}
        <div className="slate-item">
          <div className="slate-item-time">7:30 PM ET • TNT</div>
          <div className="slate-item-main">
            <div className="slate-team">
              <div className="slate-logo">BOS</div>
              <div className="slate-team-text">
                <div className="slate-team-name">BOS 64–18</div>
              </div>
            </div>
            <span className="slate-vs">@</span>
            <div className="slate-team">
              <div className="slate-logo slate-logo--away">MIL</div>
              <div className="slate-team-text">
                <div className="slate-team-name">MIL 49–33</div>
              </div>
            </div>
          </div>
          <div className="slate-meta">
            <span className="slate-meta-pill">K. Middleton OUT</span>
            <span className="slate-meta-note">
              BOS 7–3 in last 10 vs MIL
            </span>
          </div>
        </div>

        {/* Example game 3 */}
        <div className="slate-item">
          <div className="slate-item-time">8:00 PM ET • ESPN</div>
          <div className="slate-item-main">
            <div className="slate-team">
              <div className="slate-logo">DAL</div>
              <div className="slate-team-text">
                <div className="slate-team-name">DAL 38–44</div>
              </div>
            </div>
            <span className="slate-vs">@</span>
            <div className="slate-team">
              <div className="slate-logo slate-logo--away">PHX</div>
              <div className="slate-team-text">
                <div className="slate-team-name">PHX 36–46</div>
              </div>
            </div>
          </div>
          <div className="slate-meta">
            <span className="slate-meta-pill">D. L