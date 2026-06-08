# PropEdge Data Engine Integration Guide

## Overview

The new data enrichment pipeline feeds 4 critical signals into PropEdge:

1. **Per-Minute Efficiency** (replaces raw L10 hit rate)
2. **Confidence Scores** (filters noise based on variance + sample size)
3. **Matchup Defensive Ranks** (opponent-specific difficulty)
4. **Injury Impact Multipliers** (real-time team composition)

---

## Data Flow

```
ESPN API + Game Logs
    ↓
run-enrichment.js (calculates metrics)
    ↓
Google Sheets (enriched columns)
    ↓
PropEdge CSV import
    ↓
index.html parseLeagueCSV() (new columns)
    ↓
computeBetScore() (updated formula)
    ↓
PropIQ Score (now calibrated)
```

---

## CSV Column Additions

When `run-enrichment.js` outputs enriched data, it adds these columns:

```csv
Player,Sport,PropType,Line,Direction,
Per_Min_Avg,Per_Min_L5,Per_Min_L10,      ← NEW: efficiency metrics
Variance,Confidence%,Samples,             ← NEW: confidence signals
Matchup_Rank,Matchup_Scalar,             ← NEW: defensive difficulty
Expected_Minutes,Injury_Status,          ← NEW: availability context
Injury_Impact,Home_Away,Rest_Days,       ← NEW: game context
Back_to_Back_Flag
```

---

## PropEdge index.html Integration

### Step 1: Update CSV Parsing (Line ~7030)

Replace the `parseLeagueCSV()` function's input mapping to include:

```javascript
// OLD (current):
const l5Pct = parseHitRate(getValue(cols.l5));
const l10Pct = parseHitRate(getValue(cols.l10));

// NEW (add these):
const perMinAvg = parseFloat(getValue(cols.perMinAvg)) || 0;
const perMinL5 = parseFloat(getValue(cols.perMinL5)) || 0;
const perMinL10 = parseFloat(getValue(cols.perMinL10)) || 0;
const variance = parseFloat(getValue(cols.variance)) || 0;
const confidenceScore = parseFloat(getValue(cols.confidenceScore)) || 50;
const matchupRank = parseInt(getValue(cols.matchupRank)) || 15;
const matchupScalar = parseFloat(getValue(cols.matchupScalar)) || 0.5;
const expectedMinutes = parseInt(getValue(cols.expectedMinutes)) || 28;
const injuryStatus = getValue(cols.injuryStatus) || 'Available';
const injuryMultiplier = parseFloat(getValue(cols.injuryMultiplier)) || 1.0;
```

### Step 2: Update Bayesian Shrinkage (Line ~7356)

Replace the raw L5/L10 with per-minute efficiency:

```javascript
// OLD:
let trueProb = (_sampleN * weightedHitRate + _kPrior * _leaguePrior) / (_sampleN + _kPrior);

// NEW:
// Use per-minute efficiency scaled to expected minutes
const minuteBasedPrediction = perMinAvg * expectedMinutes / 40; // 40 min baseline
const confidenceAdjustment = confidenceScore / 100; // 0.0-1.0
let trueProb = minuteBasedPrediction * confidenceAdjustment;

// Still apply Bayesian shrinkage, but gentler now that we have real data
const shrunkProb = (confidenceScore * minuteBasedPrediction + (100 - confidenceScore) * _leaguePrior) / 100;
trueProb = Math.max(0.12, Math.min(0.88, shrunkProb));
```

### Step 3: Update Matchup Scalar (Line ~7290)

Add matchup difficulty adjustment:

```javascript
// After edge calculation:
const baseEdge = (trueProb - impliedProb) * 100;

// NEW: Apply matchup difficulty scalar
const matchupMultiplier = 0.8 + (matchupScalar * 0.4); // 0.8-1.2 range
const matchupAdjustedEdge = baseEdge * matchupMultiplier;

const edge = matchupAdjustedEdge;
```

### Step 4: Update Confidence Gate (Line ~7407)

Add confidence-based PropIQ dampening:

```javascript
// NEW: Before storing prop, apply confidence ceiling
let finalTrueProb = trueProb;

if (confidenceScore < 40) {
  // Very low confidence — cap PropIQ at 55
  finalTrueProb = Math.min(finalTrueProb, impliedProb + 0.03);
} else if (confidenceScore < 60) {
  // Low confidence — reduce edge by 30%
  const reducedEdge = (finalTrueProb - impliedProb) * 0.70;
  finalTrueProb = impliedProb + reducedEdge;
} else if (confidenceScore < 80) {
  // Medium confidence — reduce edge by 15%
  const reducedEdge = (finalTrueProb - impliedProb) * 0.85;
  finalTrueProb = impliedProb + reducedEdge;
}

// If injury flag, apply multiplier
if (injuryMultiplier < 0.95) {
  finalTrueProb *= injuryMultiplier;
}

// Update prop object
prop.trueProb = finalTrueProb;
prop.confidence = confidenceScore;
```

### Step 5: Update Tier Classification (Line ~7410)

Adjust ultimate/prime thresholds based on confidence:

```javascript
// NEW: Require higher confidence for elite tiers
const meetsUltimate = league === 'MLB'
  ? pfRating >= 80 && perMinL10 > 0 && confidenceScore >= 75 && l10Pct >= 65
  : pfRating >= 84 && perMinL10 > 0 && confidenceScore >= 75 && l5Pct >= 70;

const meetsPrime = meetsUltimate || (
  league === 'MLB'
    ? pfRating >= 72 && perMinL10 > 0 && confidenceScore >= 65 && l10Pct >= 60
    : pfRating >= 75 && perMinL10 > 0 && confidenceScore >= 65 && l5Pct >= 62
);
```

---

## Data Integration Workflow

### Daily Automated (via Cron)

```bash
# 11:30 AM EST
node run-enrichment.js NBA

# 3:00 PM EST
node run-enrichment.js NHL

# 5:30 PM EST
node run-enrichment.js MLB
```

This generates enriched CSVs with real game-log metrics.

### Manual Update to PropEdge

1. **Download enriched CSV** from `propedge-enriched/`
2. **Import into Google Sheets** (or append to existing sheet)
3. **PropEdge refreshes** on next app load (CSV parse triggers automatically)
4. **PropIQ scores recalculate** with new confidence signals

---

## Expected Improvements

### Before (Current Model)
- L10 hit rate: raw 70% (10 games)
- Bayesian shrink: 64% (too aggressive)
- PropIQ: 78+
- **Actual hit rate: 22%** ❌

### After (Enhanced Model)
- Per-min efficiency: 1.85 pts/min (real game logs)
- Expected minutes: 32
- Predicted: 59.2 pts / line 60.5 → -1.3% edge
- Confidence: 72% (20 games, low variance)
- PropIQ: 52 (honest assessment)
- **Expected hit rate: 52%** ✓

---

## Testing Checklist

- [ ] Run `./setup-enrichment.sh` (installs deps, sets cron)
- [ ] Test enrichment: `node run-enrichment.js NBA`
- [ ] Verify CSV output in `propedge-enriched/`
- [ ] Import enriched data into PropEdge
- [ ] PropIQ scores should be lower but more honest
- [ ] Hit rate tracking should improve over 30 days
- [ ] Check logs: `tail -f ./logs/enrichment-nba.log`

---

## Troubleshooting

**Q: Enrichment hangs?**
A: Check network connectivity. ESPN APIs sometimes timeout. Logs in `./logs/`

**Q: Google Sheets not updating?**
A: Verify `PROPEDGE_SHEET_ID` is set. Run: `echo $PROPEDGE_SHEET_ID`

**Q: PropIQ scores not changing?**
A: Ensure enriched CSV columns are imported. Check column names match exactly.

**Q: Low confidence scores everywhere?**
A: Normal if it's early season or player has DNPs. Confidence rises with data.

---

## Performance Targets (After 30 Days)

| Metric | Current | Target |
|--------|---------|--------|
| Hit Rate | 22% | 55%+ |
| PropIQ Calibration | 80=22% hits | 80=75%+ hits |
| False Positives | High | <20% |
| Avg Confidence | N/A | 70%+ |

---

## Advanced Configuration

### Adjust Confidence Dampening

In `run-enrichment.js`, modify:

```javascript
const sampleConfidence = Math.min(validGames.length / 20, 1.0); // raise to 25 for stricter
const varianceConfidence = Math.max(1 - (variance / (allAvg || 1)), 0.3); // raise floor to 0.5
```

### Customize Matchup Scalar

In `index.html`, adjust multiplier range:

```javascript
const matchupMultiplier = 0.9 + (matchupScalar * 0.2); // 0.9-1.1 (less aggressive)
```

### Injury Impact Levels

In `run-enrichment.js`:

```javascript
multiplier: status === 'Out' ? 0.7 : // was 0.8
           status === 'Probable' ? 0.92 : // was 0.95
           1.0,
```

---

## Maintenance

- **Weekly:** Review confidence distribution. If 70%+ props <50% confidence, data is stale.
- **Monthly:** Run `node generate-weekly-report.js` to audit hit-rate drift.
- **Quarterly:** Revalidate matchup scalars against actual outcomes.
