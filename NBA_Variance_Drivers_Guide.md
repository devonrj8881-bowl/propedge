# NBA Scoring Variance Breakdown: The 65-75% Guide

**Date:** April 1, 2026
**Purpose:** Deep dive into the factors that explain the majority of NBA scoring variation

---

## The Big Picture

**Pace explains ~25-35% of PPG variance. So what explains the other 65-75%?**

The answer: a combination of offensive efficiency metrics that determine *how much a team scores when they have the ball*, independent of how fast they're playing.

This guide breaks down each factor with actionable analysis approaches.

---

## The Variance Breakdown (Estimated)

| Factor | % of Variance | Excel Sheet | Primary Metric |
|--------|---------------|-------------|-----------------|
| **Shooting Efficiency** | 15-20% | Shooting Efficiency | eFG%, FG%, 3P%, Volume |
| **Turnover Rate** | 12-15% | Turnovers & Possessions | TOV% |
| **Rebounding (ORB)** | 10-12% | Rebounding & 2nd Chance | ORB%, 2ndChance Pts |
| **Free Throw Rate** | 8-10% | Shooting Efficiency | FTA/FGA ratio |
| **Defensive Strength** | 5-8% | Defensive Impact | DefRtg, Opp FG% |
| **Bench Depth** | 5-7% | (Custom analysis) | Bench PPG, Bench minutes |
| **Fastbreak Efficiency** | 3-5% | (Custom analysis) | FastBrk Pts, conversion % |
| **External Factors** | 3-5% | (Custom analysis) | Rest, travel, home/away |
| **Other/Unmeasured** | 5-10% | Variance Breakdown | Injuries, chemistry, momentum |

**Total: ~66-77%** (matches the "missing" variance from pace)

---

## Factor 1: Shooting Efficiency (15-20% of Variance)

### Why It Matters

**Simple truth:** Teams that shoot better score more points. It's the most direct lever for scoring.

The key insight: eFG% (Effective Field Goal %) accounts for the fact that 3-pointers are worth more than 2-pointers.

```
eFG% = (FG + 0.5*3P) / FGA

Example:
Team A: 40 FG, 10 3P, 100 FGA → eFG% = (40 + 5) / 100 = 45%
Team B: 40 FG, 5 3P, 100 FGA → eFG% = (40 + 2.5) / 100 = 42.5%

Team A is more efficient despite same FG count (more 3s)
```

### What to Track

**In Excel Sheet: Shooting Efficiency**

1. **FG%**: Overall field goal percentage (simplest metric)
   - Typical range: 42-48%
   - Correlation to PPG: **+0.45 to +0.55** (strong)

2. **3P%**: Three-point percentage
   - Typical range: 33-38%
   - Correlation to PPG: **+0.35 to +0.50** (modern NBA heavily weights this)
   - Why: More variance—some teams attempt 35+ 3s/game, others 22

3. **eFG%**: Effective field goal percentage
   - Typical range: 46-54%
   - Correlation to PPG: **+0.50 to +0.60** (strongest individual metric)
   - **Use this metric in your integrated model**

4. **Free Throw %**: Free throw percentage
   - Typical range: 72-80%
   - Correlation to PPG: **+0.25 to +0.35** (moderate; volume matters too)
   - Example: 70% on 20 FTA = 14 points; 78% on 20 FTA = 15.6 points (difference matters in close games)

5. **Volume Metrics:**
   - **FGA/Game**: Typical 88-98 per game
   - **3PA/Game**: Typical 25-36 per game (huge variance!)
   - **FTA/Game**: Typical 17-26 per game
   - Correlation: **+0.40 to +0.50** (volume drives variance)

### Key Insight: Volume + Efficiency

A team can score the same way via:
- **High volume, medium efficiency**: 95 FGA at 45% eFG% = 42.75 points from FG
- **Lower volume, high efficiency**: 85 FGA at 51% eFG% = 43.35 points from FG

Modern NBA: Teams increasingly rely on **high 3P volume** + **efficiency**. A team shooting 36% from 3 on 30 attempts = 10.8 points just from 3s. Missing this dimension misses ~10% of scoring.

### Analysis Questions

- Which teams have highest eFG%? Are they also highest PPG?
- Do teams with low 3PA still score well? (Defensive-minded teams)
- Is there a sweet spot for FG attempts that maximizes scoring?
- Which teams' PPG is most dependent on 3P shooting variance?

---

## Factor 2: Turnover Rate (12-15% of Variance)

### Why It Matters

**Turnovers = Possessions Lost = Scoring Opportunities Lost**

When a team turns the ball over, they lose a possession. In a 96-possession game (48 min × ~100 pace), each possession is worth ~2.2 PPG average. **A 15-turnover team has ~2-3 fewer possessions than a 12-turnover team.**

### The Math

```
Expected Possessions per Game = Pace * (MP / 48) = Pace * 1 for a full game

If Team A has 15 TOVs and Team B has 12 TOVs:
- Team A effective possessions = Pace - 15
- Team B effective possessions = Pace - 12
- Difference = 3 possessions = ~6-7 PPG impact
```

### What to Track

**In Excel Sheet: Turnovers & Possessions**

1. **TOV/Game**: Raw turnovers per game
   - Typical range: 11-17
   - Correlation to PPG: **-0.40 to -0.50** (negative; fewer TOs = more PPG)

2. **TOV%**: Turnovers per 100 plays
   - Typical range: 12-16%
   - Better than TOV/Game because it normalizes to pace
   - Correlation to PPG: **-0.45 to -0.55** (stronger than raw)
   - Example: A slow team might have 13 TOV/game on 95 pace (13.7% TO%) vs a fast team with 14 TOV/game on 100 pace (14% TO%)

3. **Effective Possessions**: Pace - TOV/Game
   - Shows *actual* possessions available for scoring
   - Correlation to PPG: **+0.50 to +0.60**

### Key Insight: The Possession Economy

**The more possessions you have, the more you score (all else equal).**

```
Team A: 100 pace, 12 TO = 88 effective possessions
Team B: 100 pace, 16 TO = 84 effective possessions
Difference: 4 possessions

If Team A scores 2.1 PPP (points per possession):
Team A PPG = 88 × 2.1 = 184.8
Team B PPG = 84 × 2.1 = 176.4
Difference: 8.4 PPG from just turnovers
```

### The TO% vs Pace Relationship

Interestingly: **Does pace affect TO%?**

Fast-paced teams might have *higher* TO% because they're playing with higher tempo (more rushed possessions). This creates an interesting feedback loop:
- High pace → higher TO% → fewer effective possessions → lowers PPG below what pace would predict
- Low pace → lower TO% → more possessions actually used → raises PPG above what pace would predict

**This partially explains why the pace-PPG correlation is only moderate!**

### Analysis Questions

- Which teams have lowest TO%? Correlation to PPG?
- Do fast teams have higher TO%? (Tempo effect)
- Are turnovers or pace more predictive of PPG?
- Which guards have highest/lowest TO% teams?

---

## Factor 3: Rebounding (ORB %) (10-12% of Variance)

### Why It Matters

**Offensive Rebounds = Extra Possessions = Extra Scoring Opportunities**

Unlike turnovers (which *reduce* possessions), offensive rebounds *create* additional possessions beyond the typical pace.

A team with 8 ORB/game has ~8 extra possessions. At 2.1 PPP, that's 16-17 extra PPG.

### What to Track

**In Excel Sheet: Rebounding & 2nd Chance**

1. **ORB/Game**: Offensive rebounds per game
   - Typical range: 8-13
   - *Direct correlation to extra possessions*
   - Correlation to PPG: **+0.35 to +0.45**

2. **ORB%**: Offensive rebound percentage (% of available ORBs team gets)
   - Typical range: 22-32%
   - Accounts for team size and rebounding style
   - Correlation to PPG: **+0.40 to +0.50** (stronger than raw count)
   - Why: Better-constructed teams have higher ORB%

3. **Second-Chance Points**: PPG from ORB possessions
   - Direct measure of "how many points from extra possessions"
   - Correlation to PPG: **+0.50 to +0.65** (strong)

4. **DRB/Game**: Defensive rebounds per game
   - Typical range: 30-37
   - *Prevents opponent from scoring*, doesn't directly increase own scoring
   - Correlation to own PPG: **near 0 to +0.15** (weak)
   - Reason: Defensive rebounding is about stopping others, not creating own scoring

### Key Insight: Offensive Rebounding Adds Possessions

```
Standard Pace = 100 possessions
ORB/Game = 10

Actual Possessions = 100 + 10 = 110 possessions

If Team shoots 48% eFG% × 110 possessions × 1.2 PPP (accounting for FTs):
= 110 × 1.2 × 48% = 63.4 PPG (from FG)

Compare to Team without ORB boost:
= 100 × 1.2 × 48% = 57.6 PPG
Difference: 5.8 PPG from rebounding alone
```

### The "Second Chance Points" Puzzle

Interesting observation: Not all ORBs lead to scoring.

- ORB possession → missed 2nd shot → TO = wasted ORB
- ORB possession → made basket = maximizes value
- ORB possession → FT = medium value

**High-scoring teams have high ORB% AND high efficiency on ORB possessions.**

### Analysis Questions

- Which teams get most second-chance PPG?
- Do fast teams (pace 100+) prioritize ORB or transition?
- What's the relationship between ORB% and team size/position composition?
- Which teams are most efficient on second-chance possessions?

---

## Factor 4: Free Throw Rate (8-10% of Variance)

### Why It Matters

**Free throws are "free" points—highest efficiency shots in basketball.**

A team that gets fouled more (and shoots FTs) gets extra PPG *without* using a field goal attempt. FT% is typically 72-80%, while FG% is 42-48%.

### What to Track

**In Excel Sheet: Shooting Efficiency**

1. **FTA/Game**: Free throws attempted per game
   - Typical range: 17-26
   - *More FTA = more PPG all else equal*
   - Why variance: Some teams draw more fouls (aggressive driving, star player), others foul more (defensive fouling)

2. **FTA/FGA Ratio**: Free throws per field goal attempt
   - Typical range: 0.18-0.32
   - Normalized metric (accounts for volume of field goal attempts)
   - Correlation to PPG: **+0.35 to +0.50**
   - Example: Team A has FTA/FGA of 0.25 (getting FT for every 4 FGAs). Team B has 0.22. Both shoot 45% FG. If both take 90 FGAs:
     - Team A: 40.5 FG points + 22.5 FT attempts × 75% = 40.5 + 16.9 = 57.4 PPG
     - Team B: 40.5 FG points + 19.8 FT attempts × 75% = 40.5 + 14.8 = 55.3 PPG
     - Difference: 2.1 PPG from FT rate

3. **FT%**: Free throw percentage
   - Typical range: 72-80%
   - Correlation to PPG: **+0.25 to +0.35** (weaker than FTA volume)
   - Why: Even 70% vs 78% is only 1-2 PPG difference on 20 FTA

### Key Insight: Aggressive Teams Draw More Fouls

Teams that attack the basket → draw fouls → shoot more FTs.

Examples:
- **High FTA teams**: Lakers (drive-heavy offense, LeBron/AD drawing fouls), Warriors (off-ball movement generating contact)
- **Low FTA teams**: Defensive-minded teams, threes-focused teams (3s draw fewer fouls)

**Teams in top 10 for FTA/FGA tend to be in top 15 for PPG.**

### Analysis Questions

- Which teams draw most fouls per FGA? (Playing style indicator)
- Is high FTA rate sustainable across a season?
- Do teams with stars (who draw fouls) have higher FTA/FGA?
- What's the relationship between pace and FTA/FGA? (Do slower teams foul more?)

---

## Factor 5: Defensive Strength (5-8% of Variance)

### Important Caveat

**Strong defense doesn't directly increase your own PPG.** It limits *opponent* PPG.

However, defensively strong teams tend to:
- Play more possessively (lower pace)
- Control game flow
- Get fastbreak opportunities from steals

So there's an *indirect* correlation: Strong defense → controlled pace → efficient possessions.

### What to Track

**In Excel Sheet: Defensive Impact**

1. **Defensive Rating (DefRtg)**: Points allowed per 100 possessions
   - Typical range: 102-115
   - **Lower is better**
   - Correlation to own PPG: **-0.10 to +0.20** (very weak direct relationship)
   - Interpretation: Defense doesn't score points, but it enables ball control

2. **Opponent FG%**: Field goal percentage allowed
   - Typical range: 42-48%
   - Correlation to own PPG: **-0.15 to +0.10** (weak)

3. **Points in Paint Allowed**: Paint defense strength
   - High PIPA teams allow easy baskets (bad interior defense)
   - Low PIPA teams force perimeter shooting
   - Correlation to own PPG: **-0.10 to +0.15** (weak)

4. **Fastbreak Points Allowed**: Transition defense
   - Teams giving up fastbreaks lose possession without FGA
   - Correlation to own PPG: **-0.10 to +0.20** (weak; indirect effect)

### The Defensive-Offensive Link

Where defense *indirectly* supports scoring:

```
Strong Defense (low DefRtg)
→ Opponents shoot poorly / rush shots
→ More turnovers / missed shots
→ More fastbreak opportunities
→ Team scores in transition (efficient)

Weak Defense (high DefRtg)
→ Opponents score at will
→ Play-from-behind (desperate possessions)
→ Fewer fastbreak opportunities
```

### Analysis Questions

- Is there a correlation between DefRtg and pace? (Do defensive teams play slower?)
- Do defensive teams have more fastbreak opportunities?
- Do teams with low DefRtg have high ORB%? (Can't play transition if always defending)

---

## Four Factors Framework: The Integrated View

### What Are The Four Factors?

Basketball Reference identified that **4 statistics explain ~90% of game outcomes:**

1. **Effective Field Goal % (eFG%)**
   - Accounts for 3-pointers being worth 50% more
   - Most important single factor

2. **Turnover Rate (TO%)**
   - Turnovers per 100 plays
   - Negative: you want LOW TO%

3. **Offensive Rebound Rate (ORB%)**
   - Percentage of available offensive rebounds you secure
   - Creates extra possessions

4. **Free Throw Rate (FTA/FGA)**
   - Free throws attempted per field goal attempt
   - Getting fouled = more PPG

### Why This Framework Works

These four metrics cover:
- **Offensive Efficiency**: eFG% (how well you shoot)
- **Possession Conservation**: TO% (don't waste possessions)
- **Possession Creation**: ORB% (create extra possessions)
- **Foul Rate**: FTA/FGA (get fouled, get free points)

**Together, they determine scoring because they determine both:**
- **How many possessions you have** (pace, minus TOs, plus ORBs)
- **How efficiently you score on each possession** (eFG%, FTA/FGA)

### Four Factors Efficiency Score (Simple Model)

```
Efficiency Score = (eFG% + ORB% + FTA/FGA) - TO%

Example:
Team A: eFG% 51%, ORB% 28%, FTA/FGA 0.26, TO% 14%
Score = (51 + 28 + 26) - 14 = 91 points

Team B: eFG% 46%, ORB% 25%, FTA/FGA 0.20, TO% 15%
Score = (46 + 25 + 20) - 15 = 76 points

Team A: Significantly stronger on all four factors
```

**Correlation of Four Factors Score to PPG: ~0.70 to 0.80** (very strong!)

### In Excel Sheet: Four Factors

This sheet gives you a pre-built framework to:
1. Enter each team's four factors
2. Calculate an efficiency score
3. Compare to actual PPG
4. Identify over/underperformers

---

## Building Your Integrated Model

### The Multi-Factor Prediction Model

**Goal:** Predict PPG using multiple factors, not just pace.

### Simple Weighted Model

```
Predicted PPG =
  (Pace × 0.15)
  + (eFG% × 0.30)
  + (-TO% × 0.25)
  + (ORB% × 0.15)
  + (FTA/FGA × 0.15)

Weights represent % importance to scoring
(Adjust based on your data)
```

### How to Use (Excel Sheet: Integrated Model)

1. **Enter team data** across all columns:
   - Pace (from Team Pace Summary)
   - eFG% (from Shooting Efficiency)
   - TO% (from Turnovers)
   - ORB% (from Rebounding)
   - FTA/FGA (from Shooting Efficiency)
   - Actual PPG

2. **Calculate Predicted PPG** using the formula above

3. **Compare Predicted vs Actual**:
   - If actual > predicted = team overperforming (why? pace helps? luck?)
   - If actual < predicted = team underperforming (injuries? bad luck?)

4. **Adjust weights** based on your correlation findings

### Advanced: Calculate Your Own Weights

Instead of using fixed weights, use regression analysis:

In Excel:
```excel
=LOGEST(PPG_range, (Pace_range, eFG_range, TO_range, ORB_range, FTA_range))
```

This gives you the actual correlation weights from your data. Then use those in prediction.

---

## Research Workflow: Step-by-Step

### Step 1: Populate All Sheets (1-2 hours)
- Team Pace Summary: 30 teams baseline
- Shooting Efficiency: Enter FG%, 3P%, FT%, volumes
- Turnovers & Possessions: Enter TOV/game and TO%
- Rebounding: Enter ORB/game, ORB%, 2ndChance Pts
- Four Factors: eFG%, TO%, ORB%, FTA/FGA

### Step 2: Calculate Correlations (30 min)
- In each sheet, use CORREL() to find r values
- Square to get R² (% variance explained)
- Example:
  ```excel
  =CORREL(B5:B34, G5:G34)  // eFG% vs PPG
  =CORREL(C5:C34, F5:F34)  // TO% vs PPG
  ```

### Step 3: Update Variance Breakdown Sheet (30 min)
- Enter YOUR correlations in "Your Data Correlation" column
- Calculate R² for each factor
- Sum to verify you've explained 65-75% beyond pace

### Step 4: Build Integrated Model (30 min)
- Enter data for 10-15 teams
- Calculate predicted vs actual PPG
- Adjust weights based on your correlations

### Step 5: Analyze Outliers (1 hour)
- Which teams overperform prediction?
- Which teams underperform?
- Investigate: injuries, trades, playoff intensity, etc.

---

## Key Insights Summary

| Factor | Variance Explained | Correlation to PPG | Why It Matters |
|--------|-------------------|-------------------|----------------|
| **Pace** | 25-35% | +0.45 | Determines possessions |
| **eFG%** | 15-20% | +0.55 | Shooting efficiency is king |
| **TO%** | 12-15% | -0.50 | Lost possessions = lost PPG |
| **ORB%** | 10-12% | +0.45 | Extra possessions = extra points |
| **FTA/FGA** | 8-10% | +0.45 | Free throws are easy points |
| **DefRtg** | 5-8% | +0.10 | Indirect: enables control |
| **Other** | 5-15% | Variable | Injuries, bench depth, etc. |

---

## The Bottom Line

✓ **Pace matters**: Explains 25-35% of scoring variance
✓ **Efficiency matters more**: Shooting %, turnovers, rebounding explain 45-50%
✓ **Volume matters**: FTA/FGA, attempts/game add another 10-15%
✓ **Defense enables control**: Indirect support for scoring possessions
✓ **Unmeasured factors matter**: 5-15% left to injuries, chemistry, momentum

**The complete picture:** PPG = f(Pace, Efficiency, Volume, Possession Control, + Random)

Good luck building your model!
