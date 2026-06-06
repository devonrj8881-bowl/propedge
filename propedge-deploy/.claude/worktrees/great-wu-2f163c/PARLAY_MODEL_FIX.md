# PropEdge Parlay Model & Structure Fixes
**Date:** April 5, 2026 | **Status:** ✅ Complete

---

## Problem Statement
You were getting **player overperformance blowing tickets** due to:
1. **Model calibration issue**: Edge thresholds too aggressive → selecting props that don't hit
2. **Parlay construction issue**: No systematic structure → weak leg combinations → correlated losses

---

## Solution Overview

### **1. Enhanced Prop Filtering (Injury + Context)**

**New injury check function:**
- Excludes players flagged as "Out", "Doubtful", or "Questionable"
- Configurable threshold: `state.injuryExcludeThreshold`
- Warns when adding injured player to parlay

**Context filters ready to add:**
- Back-to-back game detection (fatigue risk)
- Travel distance exclusions (road games)
- Line movement detection (sharp money)
- Recent variance bands (avoid outliers)

**Current exclusions:**
```javascript
function isPlayerInjured(playerName, league)
  // Returns true if player has injury concern
  // Prevents selecting props from injured players
```

---

### **2. Parlay Structure Validation Rules**

**Automatic parlay validation checks:**

| Rule | Requirement | Default |
|------|-------------|---------|
| **Max Legs** | Limit parlay size | 3 legs max |
| **Different Games** | No same-game stacking | All legs from different games |
| **Combined Edge** | Minimum EV threshold | 12%+ edge required |
| **Position Diversity** (NBA) | Mix positions to reduce correlation | PG/SG + C/PF |
| **Team Diversity** | Different teams | No repeated teams |

**Validation output:**
- Real-time warnings in parlay summary
- Shows issues: "Max 3 legs per parlay", "Combined edge 8% below 12% minimum"
- Suggests removal of lowest-edge leg to improve EV

---

### **3. Parlay-Only Mode**

**New toggle in settings:**
- "Parlay-Only Mode" checkbox
- When ON:
  - Plus icon adds to parlay (no individual logging)
  - Portfolio shows ONLY parlay bets
  - Individual prop history hidden
  - Wager amounts tracked on parlay level only

**When OFF:**
- Original behavior (both individual + parlay tracking)

---

## Configuration Values

Edit in `state` initialization:

```javascript
state.parlayOnlyMode = false;        // Toggle on/off
state.minParlayEdge = 12;            // Min combined edge %
state.maxParlayLegs = 3;             // Max legs per parlay
state.injuryExcludeThreshold = 'questionable'; // out|doubtful|questionable|active
```

---

## Usage Flow: Parlay-Only Mode

### Step 1: Enable Parlay-Only Mode
- Toggle "Parlay-Only Mode" in settings
- Plus buttons hidden from prop cards

### Step 2: Build Parlay
1. Click **"Add to Parlay"** on each prop (no individual logging)
2. System checks injury status automatically
3. Set wager amount in Parlay tab
4. View live validation warnings:
   - ⚠️ "Combined edge 8% below 12% minimum"
   - ⚠️ "Max 3 legs per parlay (you have 4)"
   - ⚠️ "NBA legs: use different teams"

### Step 3: Log Parlay
1. Click **"📌 Log Parlay Bet"**
2. Parlay saved to Portfolio with all legs + wager

### Step 4: Track Results
- Portfolio shows parlay (not individual props)
- Status: Pending → Hit/Miss/Void
- P&L calculated on entire parlay

---

## Model Improvements To Consider

**Tier adjustment (to fix overperformance):**

Current: `THRESHOLDS = { prime: 85, strong: 72, solid: 62, spec: 52 }`

Recommended: `{ prime: 88, strong: 75, solid: 65, spec: 55 }` (tighter)

**Why:** Raises minimum threshold → fewer props → higher hit rate

---

## What Gets Deployed

✅ Injury filtering active
✅ Parlay structure validation active
✅ Parlay-only mode toggle added
✅ Wager tracking for parlays
✅ Portfolio P&L calculations updated
✅ Real-time validation warnings in parlay UI

---

## Next Steps (Optional)

1. **Test Parlay-Only Mode** for 1-2 days
2. **Monitor hit rates** on new stricter validation
3. **Adjust `minParlayEdge`** based on results (maybe 10% or 15%)
4. **Add back-to-back detection** if injury filtering alone improves results
5. **Create "Tier System"** for better prop selection (prime-only parlays vs. strong legs)

---

## Deploy Command

```bash
cd ~/Documents/Claude/Projects/PropEdge
bash deploy-prod.sh
```

---

## File Modified
- `/sessions/magical-keen-babbage/mnt/PropEdge/propedge-deploy/index.html`
  - Added: Injury filtering functions
  - Added: Parlay validation functions
  - Added: Parlay-only mode toggle
  - Updated: Parlay calculations with warnings
  - Updated: Portfolio P&L display

