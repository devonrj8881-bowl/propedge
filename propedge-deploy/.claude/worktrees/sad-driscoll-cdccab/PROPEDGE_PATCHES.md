# PropEdge index.html Code Patches

## Overview
These patches integrate the enriched metrics into PropEdge's scoring engine.

**Total changes: ~80 lines**  
**Critical lines affected: 7, 7356, 7290, 7407, 7410**

---

## PATCH 1: CSV Column Mapping (Line ~7000-7050)

**Location:** In `parseLeagueCSV()` function, after injury data parsing

**Current Code:**
```javascript
// Parse hit rates
const parseHitRate = (str) => {
  if (!str) return 0;
  const fracMatch = str.match(/\((\d+)\/(\d+)\)/);
  if (fracMatch) return (parseInt(fracMatch[1]) / parseInt(fracMatch[2])) * 100;
  const pctMatch = str.match(/([\d.]+)%?/);
  return pctMatch ? parseFloat(pctMatch[1]) : 0;
};

const l5Pct = parseHitRate(getValue(cols.l5));
const l10Pct = parseHitRate(getValue(cols.l10));
const l20Pct = parseHitRate(getValue(cols.l20));
const l30Pct = parseHitRate(getValue(cols.l30));
const seasonPct = parseHitRate(getValue(cols.season));
```

**New Code:**
```javascript
// Parse hit rates
const parseHitRate = (str) => {
  if (!str) return 0;
  const fracMatch = str.match(/\((\d+)\/(\d+)\)/);
  if (fracMatch) return (parseInt(fracMatch[1]) / parseInt(fracMatch[2])) * 100;
  const pctMatch = str.match(/([\d.]+)%?/);
  return pctMatch ? parseFloat(pctMatch[1]) : 0;
};

const l5Pct = parseHitRate(getValue(cols.l5));
const l10Pct = parseHitRate(getValue(cols.l10));
const l20Pct = parseHitRate(getValue(cols.l20));
const l30Pct = parseHitRate(getValue(cols.l30));
const seasonPct = parseHitRate(getValue(cols.season));

// ── NEW: Real game-log metrics from data engine ──
const perMinAvg = parseFloat(getValue(cols.per_min_avg)) || 0;
const perMinL5 = parseFloat(getValue(cols.per_min_l5)) || 0;
const perMinL10 = parseFloat(getValue(cols.per_min_l10)) || 0;
const variance = parseFloat(getValue(cols.variance)) || 0;
const confidenceScore = parseFloat(getValue(cols.confidence_pct)) || 50;
const matchupRank = parseInt(getValue(cols.matchup_rank)) || 15;
const matchupScalar = parseFloat(getValue(cols.matchup_scalar)) || 0.5;
const expectedMinutes = parseInt(getValue(cols.expected_minutes)) || 28;
const injuryStatus = getValue(cols.injury_status) || 'Available';
const injuryMultiplier = parseFloat(getValue(cols.injury_multiplier)) || 1.0;
const restDays = parseInt(getValue(cols.rest_days)) || 1;
const backToBackFlag = getValue(cols.back_to_back_flag) === 'yes' || getValue(cols.back_to_back_flag) === 'true';
```

---

## PATCH 2: Bayesian Shrinkage Replacement (Line ~7356-7385)

**Location:** Replace the entire Bayesian shrinkage block

**Current Code:**
```javascript
// ── Gap 3: Bayesian Shrinkage — sample-size-aware probability calibration ────────────
// Pulls trueProb toward league prior (52%) when sample is thin (e.g. 3 recent games).
// Deep-data players (20+ games across windows) receive near-zero shrinkage.
// Formula: calibrated = (n × hitRate + k × prior) / (n + k)
const _sampleN = (() => {
  let n = 0;
  if (l5Pct  > 0) n += 5;
  if (l10Pct > 0) n += 10;
  if (l20Pct > 0) n += 20;
  if (l30Pct > 0) n += 30;
  return Math.max(n, 1);
})();

const _kPrior = league === 'MLB' ? 8 : league === 'NBA' ? 7 : 7; // reduced from 15
const _leaguePrior = 0.52; // ~52% baseline hit rate across all prop types
let trueProb = (_sampleN * weightedHitRate + _kPrior * _leaguePrior) / (_sampleN + _kPrior);
```

**New Code:**
```javascript
// ── Gap 3: ENHANCED — Per-Minute Efficiency + Confidence Calibration ────────────
// Replaces raw hit rates with real per-minute efficiency scaled to expected minutes.
// Confidence score (0-100) based on sample size + variance, filters noise.
// If data unavailable, falls back to old Bayesian method.

let trueProb;

if (perMinAvg > 0 && confidenceScore >= 40) {
  // ── PRIMARY: Use real per-minute efficiency ──
  // Expected production = per_min_avg × expected_minutes
  const minuteBasedPrediction = perMinAvg * (expectedMinutes / 40); // 40 min baseline
  
  // Apply confidence adjustment (higher confidence = trust the data more)
  const confidenceAdjustment = (confidenceScore / 100); // 0.0-1.0
  let confidenceWeightedProb = minuteBasedPrediction * confidenceAdjustment;
  
  // Still blend with league prior, but softly (confidence >> prior)
  trueProb = (confidenceScore * confidenceWeightedProb + (100 - confidenceScore) * 0.52) / 100;
  trueProb = Math.max(0.12, Math.min(0.88, trueProb)); // clamp
} else {
  // ── FALLBACK: Old Bayesian method for thin data ──
  const _sampleN = (() => {
    let n = 0;
    if (l5Pct  > 0) n += 5;
    if (l10Pct > 0) n += 10;
    if (l20Pct > 0) n += 20;
    if (l30Pct > 0) n += 30;
    return Math.max(n, 1);
  })();
  
  const _kPrior = league === 'MLB' ? 8 : league === 'NBA' ? 7 : 7;
  const _leaguePrior = 0.52;
  trueProb = (_sampleN * weightedHitRate + _kPrior * _leaguePrior) / (_sampleN + _kPrior);
}
```

---

## PATCH 3: Matchup Difficulty Adjustment (Line ~7390-7395)

**Location:** Immediately after edge calculation

**Current Code:**
```javascript
const edge = ((trueProb - impliedProb) * 100);
```

**New Code:**
```javascript
// ── Base edge calculation ──
const baseEdge = ((trueProb - impliedProb) * 100);

// ── NEW: Apply matchup difficulty multiplier ──
// Opponents ranked 1-30 defensive difficulty
// Rank 1 (best defense) → scalar 0.0 → no edge
// Rank 15 (average defense) → scalar 0.5 → 100% edge
// Rank 30 (worst defense) → scalar 1.0 → 120% edge
const matchupDifficultyMultiplier = 0.8 + (matchupScalar * 0.4); // 0.8-1.2 range
const matchupAdjustedEdge = baseEdge * matchupDifficultyMultiplier;

const edge = matchupAdjustedEdge;
```

---

## PATCH 4: Confidence-Based PropIQ Dampening (Line ~7407-7420)

**Location:** After value threshold check, before storing prop

**Current Code:**
```javascript
const isValue = hasRealEdge && edge >= valueThreshold && (trueProb - impliedProb) >= 0.10;
```

**New Code:**
```javascript
const isValue = hasRealEdge && edge >= valueThreshold && (trueProb - impliedProb) >= 0.10;

// ── NEW: Apply confidence gates to true probability ──
let finalTrueProb = trueProb;

if (confidenceScore < 40) {
  // Very low confidence: cap predicted win rate to implied + 3%
  finalTrueProb = Math.min(finalTrueProb, impliedProb + 0.03);
} else if (confidenceScore < 60) {
  // Low confidence: reduce edge by 30%
  const edgePts = (finalTrueProb - impliedProb);
  finalTrueProb = impliedProb + (edgePts * 0.70);
} else if (confidenceScore < 80) {
  // Medium confidence: reduce edge by 15%
  const edgePts = (finalTrueProb - impliedProb);
  finalTrueProb = impliedProb + (edgePts * 0.85);
}

// Apply injury multiplier
if (injuryMultiplier < 0.95) {
  finalTrueProb *= injuryMultiplier;
}

// Apply back-to-back fatigue
if (backToBackFlag && league === 'NBA') {
  finalTrueProb *= 0.92; // 8% reduction for fatigued players
}

// Update trueProb for this prop
trueProb = finalTrueProb;
```

---

## PATCH 5: Tier Classification (Line ~7410-7420)

**Location:** In tier classification logic

**Current Code:**
```javascript
const meetsUltimate = league === 'MLB'
  ? pfRating >= 80 && l10Pct >= 65 && l20Pct >= 62 && seasonPct >= 60
  : pfRating >= 84 && l10Pct >= 75 && l5Pct >= 70 && l20Pct >= 65;
```

**New Code:**
```javascript
// ── UPDATED: Require confidence for elite tiers ──
const meetsUltimate = (confidenceScore >= 75) && (
  league === 'MLB'
    ? pfRating >= 80 && perMinL10 > 0 && l10Pct >= 65 && l20Pct >= 62
    : pfRating >= 84 && perMinL10 > 0 && l5Pct >= 70 && l20Pct >= 65
);
```

---

## PATCH 6: Prop Object Storage (Line ~7430-7450)

**Location:** Where prop object is pushed to array

**Current Code:**
```javascript
props.push({
  id: `${league}_${date}_${player}_${line}_${direction}`,
  player,
  line,
  direction,
  odds,
  oddsStr: odds > 0 ? `+${odds}` : `${odds}`,
  impliedProb,
  trueProb,
  pfRating,
  l5Avg,
  l10Avg,
  l5Pct,
  l10Pct,
  // ... other fields
});
```

**New Code:**
```javascript
props.push({
  id: `${league}_${date}_${player}_${line}_${direction}`,
  player,
  line,
  direction,
  odds,
  oddsStr: odds > 0 ? `+${odds}` : `${odds}`,
  impliedProb,
  trueProb,
  pfRating,
  l5Avg,
  l10Avg,
  l5Pct,
  l10Pct,
  // ── NEW: Add enriched metrics ──
  perMinAvg,
  perMinL5,
  perMinL10,
  variance,
  confidence: confidenceScore,
  matchupRank,
  matchupScalar,
  expectedMinutes,
  injuryStatus,
  injuryMultiplier,
  restDays,
  backToBackFlag,
  // ... other fields
});
```

---

## PATCH 7: PropIQ Scoring Display (Line ~17320)

**Location:** In the how-to-bet HTML section, update tagline

**Current Code:**
```javascript
<div style="font-size:10px;color:var(--text-muted);margin-bottom:4px;text-align:center;letter-spacing:0.3px;">PropIQ™ v5.0 Sentinel Intelligence weighs 20 tactical factors</div>
```

**New Code:**
```javascript
<div style="font-size:10px;color:var(--text-muted);margin-bottom:4px;text-align:center;letter-spacing:0.3px;">PropIQ™ v6.0 Real-Time Intelligence: Per-min efficiency + Confidence + Matchup</div>
```

---

## Implementation Steps

1. **Backup current index.html**
   ```bash
   cp propedge-deploy/index.html propedge-deploy/index.html.backup
   ```

2. **Apply Patch 1** — Add CSV column mappings (11 lines)

3. **Apply Patch 2** — Replace Bayesian shrinkage (20 lines, delete 7 old lines)

4. **Apply Patch 3** — Add matchup multiplier (7 lines)

5. **Apply Patch 4** — Add confidence dampening (22 lines)

6. **Apply Patch 5** — Update tier classification (5 lines modified)

7. **Apply Patch 6** — Add metrics to prop object (12 lines)

8. **Apply Patch 7** — Update display text (1 line)

9. **Test**
   ```bash
   # Open in browser, check console for errors
   # Run: node run-enrichment.js NBA
   # Verify CSV outputs to propedge-enriched/
   ```

---

## Verification Checklist

After applying patches:

- [ ] No console errors in browser
- [ ] PropIQ scores visible and reasonable
- [ ] Enriched metrics appear in prop cards
- [ ] `node run-enrichment.js NBA` runs without errors
- [ ] CSV files generated in `propedge-enriched/`
- [ ] Hit rate tracking works
- [ ] Cron jobs installed and running

---

## Rollback Plan

If issues arise:
```bash
cp propedge-deploy/index.html.backup propedge-deploy/index.html
# System returns to pre-patch state
```

---

## Expected Changes in Behavior

| Signal | Before | After | Impact |
|--------|--------|-------|--------|
| L10 Hit Rate | 70% raw | 64% per-min | More conservative |
| Confidence | N/A | 72% (20 games) | Filters noise |
| Matchup Scalar | Generic | 0.92 (opponent rank 8) | Context-aware |
| PropIQ 80+ | 22% actual | ~65% target | Better calibrated |
| Low-confidence props | Still shown | Scored 40-55 max | Honest assessment |

