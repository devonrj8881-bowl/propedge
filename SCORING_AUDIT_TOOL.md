# PropEdge Scoring Audit Tool

## How to Use

### Step 1: Export Your Hit/Miss Data
1. Open your PropEdge app in browser
2. Open **Developer Tools** (F12 or Cmd+Option+I)
3. Go to **Console** tab
4. Paste this command:

```javascript
// Export all tracked props with their hit/miss data
const tracked = {};
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i);
  if (key.startsWith('propedge_hits_')) {
    tracked[key] = JSON.parse(localStorage.getItem(key));
  }
}
console.log(JSON.stringify(tracked, null, 2));
```

5. Copy the entire JSON output
6. Paste it into a file on your computer

### Step 2: Analyze by Score Tier
Once you have the JSON, paste it here and I'll run an analysis to show:

- **Hit rate by PropIQ score tier** (90+, 80-89, 70-79, etc.)
- **Which score ranges are overperforming vs underperforming**
- **Specific prop types or leagues driving the losses**
- **Recommendations for score adjustments**

### Example Analysis Output

```
Score Tier Analysis
════════════════════════════════════════════════════════════════

Tier 90+    | Picks: 12  | Hits: 8   | Hit Rate: 67% | Expected: 75% | ⚠️ UNDERPERFORMING
Tier 80-89  | Picks: 28  | Hits: 19  | Hit Rate: 68% | Expected: 68% | ✅ ALIGNED
Tier 70-79  | Picks: 45  | Hits: 28  | Hit Rate: 62% | Expected: 62% | ✅ ALIGNED
Tier 60-69  | Picks: 31  | Hits: 15  | Hit Rate: 48% | Expected: 55% | ⚠️ UNDERPERFORMING
```

### What's Likely Happening with Michael Busch (Rank 98)

High-scored picks losing suggests one of these issues:

1. **Overweighting recent form** — L5 hot streak without enough Bayesian shrinkage
2. **Not enough pitcher/matchup penalty** — ERA parsing might be missing or weak
3. **Line movement false signals** — FanDuel line moved for reasons other than sharp money
4. **Rest patterns not captured** — Days rest data missing for day games
5. **Stat-type variance underestimated** — Hits are ~3x more volatile than points

---

## Next Steps

Once you export your data, share it and I'll:
1. Identify exact which score tiers are problematic
2. Show which factors are overweighting
3. Suggest specific adjustments to the scoring logic
4. Create a patch to fix the miscalibrated factors
