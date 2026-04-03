---
name: PropEdge Countdown System
description: How the two countdown systems work in PropEdge — ticker cards (30s) and live modal 1-second clock
type: project
---

## PropEdge Countdown Systems (v3.14)

There are **two separate countdown mechanisms** in PropEdge:

---

### 1. Ticker Card Countdowns (upcoming games on home page)
- Elements: `.game-countdown[data-gametime]` divs
- Refresh rate: every **30 seconds** via `_startCountdownRefresh()`
- Shows "⏱ Xh Ym" or "⏱ Xm" or "⏱ Starting soon"
- `soon` CSS class applied when ≤30 mins away
- `data-gametime` attribute holds Unix timestamp (ms)

### 2. Live Game Modal Clock (1-second countdown)
- Elements: `#modalClock` and `#svgCourtClock` (SVG court graphic)
- Refresh rate: every **1 second** via `_startCountdown()`
- Only fires for **live games** (`game.status === 'live'`)
- Seeded by `_startModalPoll()` when modal opens
- Re-seeded every 10s when `_refreshModalData()` gets fresh ESPN clock data
- Parses "M:SS" format via `_clockToSecs()` / `_secsToClockStr()`

---

## Fixed (March 30, 2026)

### Modal countdown not ticking
**Root cause:** `rerenderAllVisibleUI()` was calling `openGameModal(freshGame)` on every background resume (tab switch, iOS PWA), completely rebuilding the modal DOM and killing the countdown timer. If `displayClock` was empty at rebuild time (between quarters, API lag), countdown never restarted.

**Fix applied:**
- `rerenderAllVisibleUI` now only calls `openGameModal` when game STATUS changes (upcoming→live, live→final). Same-status refreshes just update `_modalState.game` in-place.
- If countdown stopped (0:00 end of period) and no timer is running, re-seeds from fresh `displayClock`.
- Initial poll delay reduced 800ms → 100ms for faster first clock sync.
- `_refreshModalData` no longer kills countdown when `displayClock` is temporarily empty (between periods).

### Ticker card scores static (not updating)
**Root cause:** `fetchGames()` only ran every 15 minutes. Ticker cards showed stale scores.

**Fix applied:** Added `_startLiveTickerPoll()` — fetches ESPN data every 30s when live games are present, re-renders ticker with fresh scores. Stops automatically when no live games remain.

### Ticker card clocks static between refreshes
**Root cause:** Clock labels (e.g. "8:27 · 4TH") were static strings, only updated on 30s ESPN fetch.

**Fix applied:** Added `.tck-clock` spans with `data-secs`/`data-period`/`data-league` attributes. `_startTickerClockCountdown()` ticks every 1 second, decrementing `data-secs` and updating the label in real time. Resyncs to real ESPN value every 30s.

---

## Key Functions
- `_formatCountdown(gameTime)` — formats ms timestamp to "Xh Ym" string
- `_startCountdownRefresh()` — 30s ticker for card countdowns
- `_startCountdown(clockStr, period, league, isLive)` — 1s modal clock
- `_startModalPoll(game, cfg)` — seeds modal countdown + polls ESPN every 10s
- `_clockToSecs(str)` — parses "M:SS" → total seconds (returns null if invalid)
- `_secsToClockStr(secs)` — converts seconds → "M:SS" display string
- `_modalState` — object holding `{countdownTimer, countdownSecs, countdownPeriod, pollTimer, game, cfg}`
