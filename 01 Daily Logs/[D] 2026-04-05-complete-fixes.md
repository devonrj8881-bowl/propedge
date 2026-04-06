---
date: 2026-04-05
type: bug-fixes
status: deployed
---

# PropEdge Tab Navigation & Data Persistence Fixes

## Bugs Fixed

### 1. **CRITICAL: Missing renderProps() on Props Tab Navigation**
**Problem**: When clicking away from Props tab to other tabs and returning, the props list disappeared because `renderProps()` was never called on navigation back.

**Root Cause**: Tab click handler at line 16495 was missing the conditional for props view:
```javascript
// BEFORE (broken)
if (state.view === 'games') renderGames();
if (state.view === 'injuries') fetchAllInjuries();
// ... props check was missing
```

**Fix**: Added explicit call to renderProps() when props tab is selected (line 16495):
```javascript
// AFTER (fixed)
if (state.view === 'props') renderProps();
if (state.view === 'games') renderGames();
if (state.view === 'injuries') fetchAllInjuries();
```

**Impact**: Props now stay visible when switching between tabs.

---

### 2. **Portfolio Index Mapping Bug (Previous Fix)**
**Problem**: When removing or changing status on portfolio items, the wrong prop was modified because onclick handlers used reversed array indices.

**Fix**: Changed from `roi.indexOf(bet)` to proper index matching:
```javascript
const originalIndex = roi.findIndex(b =>
  b.player === bet.player &&
  b.timestamp === bet.timestamp &&
  b.prop === bet.prop
);
// Pass originalIndex to onclick handlers instead of filtered index
```

**Impact**: Remove/Status change now targets correct props.

---

### 3. **Parlay Wager Input Disappears on Tab Switch**
**Problem**: When you enter a wager amount in the Parlay tab, switch to Portfolio, and return to Parlay, the wager input resets to default (10).

**Root Cause**: Wager value was only in DOM (input element), not persisted to state/localStorage.

**Fix - Three Part Solution**:

**Part A**: Save wager to localStorage when user types/changes value (line 15201):
```javascript
function updateParlayCalcs() {
  const wager = parseFloat(document.getElementById('wagerAmount')?.value) || 10;
  // NEW: Persist wager amount
  localStorage.setItem('propEdgeParlaywager', wager.toString());
  // ... rest of calculation
}
```

**Part B**: Restore wager from localStorage when parlay view renders (line 15135):
```javascript
function renderParlay() {
  // NEW: Restore saved wager
  const savedWager = localStorage.getItem('propEdgeParlaywager');
  const wagerInput = document.getElementById('wagerAmount');
  if (wagerInput && savedWager) {
    wagerInput.value = parseFloat(savedWager);
  }
  // ... rest of render
}
```

**Part C**: Clear wager from localStorage after parlay is logged (line 15491):
```javascript
showToast(`✅ ${state.parlay.length}-leg parlay logged - $${wager.toFixed(2)}`);
state.parlay = [];
saveParlay();
// NEW: Clear wager storage after logging
localStorage.removeItem('propEdgeParlaywager');
```

**Impact**: Wager amount persists across all tab switches until parlay is logged.

---

## Testing Checklist

- [ ] Add 2-3 individual props to Portfolio
- [ ] Add a parlay in Parlay tab
- [ ] Enter a wager amount (e.g., $25) in Parlay
- [ ] Switch to Games tab → wager should persist
- [ ] Switch to Props tab → wager should persist
- [ ] Return to Parlay tab → wager amount should still be $25
- [ ] Log the parlay → wager should clear and return to default (10)
- [ ] Add new parlay and enter different wager → should work with new value
- [ ] Click Remove on Portfolio props → should remove correct prop
- [ ] Change status on Portfolio props → should update correct prop
- [ ] On mobile: repeat all tests

---

## Files Modified

- `/sessions/magical-keen-babbage/mnt/PropEdge/propedge-deploy/index.html`
  - Line 15135: renderParlay() - restore wager from localStorage
  - Line 15201: updateParlayCalcs() - save wager to localStorage
  - Line 15491: logParlay() - clear wager localStorage after logging
  - Line 16495: initTabs() - add missing renderProps() call
  - Lines 18150-18265: renderPortfolio() - fix index mapping for onclick handlers

---

## Expected Behavior

1. **Props Tab**: Full props list displays and stays when navigating away/back
2. **Parlay Tab**: Wager amount persists across tab switches, clears after logging
3. **Portfolio Tab**: Remove/Status buttons work on correct entries
4. **All Tabs**: Smooth navigation without data loss or display glitches

---

## Syntax Verification

✅ All JavaScript syntax validated (no parsing errors)
✅ All template literals properly closed
✅ All DOM elements exist and referenced correctly
