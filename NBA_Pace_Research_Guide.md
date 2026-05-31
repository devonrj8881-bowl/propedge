# NBA Pace-of-Play & Scoring Analysis: Research Framework

**Date:** April 1, 2026
**Purpose:** Comprehensive framework for analyzing game pace and scoring relationships across NBA seasons

---

## Executive Summary

This framework enables detailed analysis of NBA games through the lens of pace-of-play metrics and scoring dynamics. The relationship between game tempo (pace) and total points scored is a fundamental question in basketball analytics.

By analyzing historical data across multiple seasons and specific matchups, you can identify patterns that inform understanding of game scoring trends and explore the factors that drive variability in scoring.

**Key Question:** How consistently does game pace predict total points scored, and what other factors explain the variance?

---

## Analytical Methodology

### Pace of Play Definition

**Pace Formula:**
```
Pace = (FGA + 0.44*FTA - OREB) / MP * 48
```

- **FGA** = Field Goals Attempted
- **FTA** = Free Throws Attempted
- **OREB** = Offensive Rebounds
- **MP** = Minutes Played
- **×48** = Normalize to a full game

**Interpretation:**
- Possessions per 48 minutes
- Higher pace = faster game tempo with more shot attempts
- Typical NBA pace ranges from ~90-105 possessions per 48 min
- Q1 (slowest): ~85-93 pace | Q4 (fastest): ~100-108+ pace

### Key Metrics to Track

| Metric | Definition | Why It Matters |
|--------|-----------|---------------|
| **Pace** | Possessions per 48 minutes | Game speed indicator |
| **PPG** | Points per game (team's average) | Offensive output |
| **PPA** | Points per game allowed (defense) | Defensive strength |
| **Pace Correlation** | -1 to +1 relationship to scoring | Predictive strength |
| **R² Value** | % of variance explained by pace | Model quality |

---

## Four-Part Analysis Framework

### Part 1: Team Pace Summary (Sheet: Team Pace Summary)

**Goal:** Establish baseline metrics for each NBA team

**What to include:**
- Team abbreviations
- Average pace across the season
- Average PPG (points per game scored)
- Average PPA (points per game allowed)
- Games played
- Rankings for pace and PPG

**Why:** Creates a foundation for understanding which teams play fast/slow and how their scoring compares.

**Formulas:**
- Pace Rank: `=RANK(B2,$B$2:$B$31,0)` (higher pace = lower rank)
- PPG Rank: `=RANK(C2,$C$2:$C$31,0)` (higher scoring = lower rank)

---

### Part 2: Pace-Scoring Relationship (Sheet: Pace Quartile Analysis)

**Goal:** Analyze how scoring patterns vary by game speed

**Structure:**
- **Q1 (Slowest Pace)**: Games with lowest 25% pace
- **Q2 (Slow-Moderate)**: Games 25%-50% pace
- **Q3 (Moderate-Fast)**: Games 50%-75% pace
- **Q4 (Fastest Pace)**: Games with highest 25% pace

**Analysis by quartile:**
- Count of games
- Average PPG in that quartile
- Standard deviation (variability)
- Min/Max scoring

**Key Insight:** If pace-scoring relationship is strong, Q1 should have lowest avg PPG and Q4 should have highest.

**Example Results:**
```
Q1 (Slow):      Avg PPG = 198, StdDev = 8.5
Q2 (Mod-Slow):  Avg PPG = 207, StdDev = 9.2
Q3 (Mod-Fast):  Avg PPG = 215, StdDev = 10.1
Q4 (Fast):      Avg PPG = 224, StdDev = 11.3

Interpretation: Clear upward trend confirms pace-scoring relationship
```

---

### Part 3: Matchup-Specific Analysis (Sheet: Matchup Analysis)

**Goal:** Understand how specific team pairs play against each other

**What to track:**
- Team A name & typical pace
- Team B name & typical pace
- Combined pace = (Pace_A + Pace_B) / 2
- Historical game totals between these teams
- Deviation from expected scoring

**Why:** Teams don't always play at their season average; specific matchups create unique dynamics.

**Example:**
```
Lakers (Pace: 102) vs Celtics (Pace: 96)
Combined Pace: 99
Historical Avg PPG in matchups: 210
League expectation for Pace 99: 212
Deviation: -2 (slightly defensive matchup)
```

**Research Questions:**
- Do fast teams slow down against strong defenses?
- Do specific matchups consistently exceed/fall short of pace-expected scoring?

---

### Part 4: Statistical Correlation (Sheet: Correlation & Stats)

**Goal:** Quantify the pace-scoring relationship with statistical measures

**Calculations per season:**
- Correlation coefficient (CORREL function)
- R² value (correlation squared)
- Average pace, average PPG
- Sample size (games analyzed)

**Formula:**
```excel
=CORREL(Pace_Range, PPG_Range)
=CORRELATION^2
```

**Interpretation Scale:**
- **r = 0.0-0.2**: Negligible relationship
- **r = 0.2-0.4**: Weak relationship
- **r = 0.4-0.6**: Moderate relationship ← Typical for pace-scoring
- **r = 0.6-0.8**: Strong relationship
- **r = 0.8-1.0**: Very strong relationship

**Example:**
```
Season: 2024-25
Games analyzed: 1230
Avg Pace: 98.2
Avg PPG: 212.4
Correlation: 0.52
R²: 0.27

Interpretation:
- Moderate positive relationship (faster games score more)
- 27% of scoring variance explained by pace
- 73% explained by other factors (shooting %, defense, etc.)
```

---

## Research Angles & Questions to Explore

### Angle 1: Defensive Impact on Pace

**Questions:**
- Do teams with strong defenses (lower PPA) pace differently than weak defenses?
- Does defensive strength predict game pace more than offensive pace preference?
- Which defenses can slow down fast teams?

**Analysis Approach:**
- Correlate team PPA with their pace
- Compare how fast teams perform against slow-paced vs. fast-paced defenses

---

### Angle 2: Matchup-Specific Deviations

**Questions:**
- When teams play each other, do they deviate from their typical pace?
- Which defensive schemes effectively slow down fast teams?
- Are there predictable matchup patterns?

**Analysis Approach:**
- Compare team A's pace when playing B vs. A's season average
- Identify defensive systems that create largest deviations

---

### Angle 3: Outlier Analysis

**Questions:**
- Which games had unexpectedly high scoring given slow pace?
- Which games had unexpectedly low scoring given fast pace?
- What explains these deviations?

**Analysis Approach:**
- Identify games 2+ std deviations from expected
- Investigate external factors (back-to-back, rest, injuries)

---

### Angle 4: Season-to-Season Consistency

**Questions:**
- Is pace-scoring relationship stable across seasons?
- How have rule changes affected this relationship?
- Have modern NBA teams changed their approach?

**Analysis Approach:**
- Compare correlation coefficients year-over-year
- Note any discontinuities (trades, rule changes, roster turnover)

---

### Angle 5: Team-Specific Patterns

**Questions:**
- Which teams' scoring is most/least affected by pace?
- Are there "high-efficiency" teams that score well regardless of tempo?
- Which teams slow down naturally vs. forced to slow down?

**Analysis Approach:**
- Calculate pace-sensitivity coefficient per team
- Identify outlier teams that break the trend

---

## Statistical Concepts & Interpretation

### Correlation Coefficient (r)

Ranges from -1 (perfect inverse) to +1 (perfect positive correlation).

- **r = 1.0**: Perfect positive (as pace increases, PPG always increases)
- **r = 0.5**: Moderate positive (faster games tend to have more points)
- **r = 0.0**: No relationship (pace doesn't predict scoring)
- **r = -0.5**: Moderate negative (faster games tend to have fewer points)
- **r = -1.0**: Perfect negative (as pace increases, PPG always decreases)

**For NBA pace-scoring:** Typically r = 0.4-0.6 (moderate positive)

---

### R² (Coefficient of Determination)

Shows the percentage of variance in one variable explained by another.

```
R² = correlation coefficient squared

If r = 0.50, then R² = 0.25 (25% of variance)
```

**Interpretation:**
- R² = 0.25 means pace explains 25% of PPG variation
- The remaining 75% is explained by: shooting efficiency, turnovers, defense, bench scoring, etc.

---

### Standard Deviation

Measures spread around the average. Higher std dev = more unpredictable.

**Example:**
```
Q1 (Slow games):  Avg PPG = 200, StdDev = 5
→ Most games fall between 195-205 (predictable)

Q4 (Fast games):  Avg PPG = 220, StdDev = 15
→ Games range 205-235 (unpredictable)
```

**Interpretation:** Slow games are more predictable; fast games have more variance.

---

### Outliers

Games 2+ standard deviations from their quartile's mean.

**Why they matter:**
- Reveal unexpected circumstances
- Show matchup-specific effects
- Suggest other important factors at play

---

## Data Sources & Collection

### Primary Sources

| Source | Reliability | Data Includes |
|--------|-------------|---------------|
| **NBA Stats API** (stats.nba.com) | Official league | Pace, PPG, all team stats |
| **Basketball Reference** (basketball-reference.com) | Comprehensive | Historical seasons, game logs |
| **Statsbomb / Synergy Sports** | Advanced analytics | Possession-level, defensive metrics |

### How to Access Data

**NBA Stats API:**
```python
# Example: fetch team stats for 2024-25 season
https://stats.nba.com/stats/leaguedashteamstats
?Season=2024-25&PerMode=Per100Possessions
```

**Basketball Reference:**
- Navigate to season page (e.g., 2024-25 Season)
- Export team stats to CSV
- Can manually download or scrape

---

## How to Use This Framework: Step-by-Step

### Step 1: Populate Team Pace Summary
- Gather 2023-24, 2024-25, 2025-26 season stats
- Enter pace, PPG, and PPA for all 30 teams
- Calculate rankings using RANK() function

### Step 2: Analyze Pace Quartiles
- Use Excel to group all games by pace level (create quartile boundaries)
- Calculate mean and std dev PPG for each quartile
- Look for ascending PPG trend from Q1 to Q4

### Step 3: Deep Dive into Matchups
- Select 10-20 team pairings of interest
- Enter their individual pace metrics
- Calculate combined pace
- Pull historical game totals from game logs

### Step 4: Calculate Correlations
- Use `=CORREL()` function in Excel
- Calculate correlation between pace and PPG for each season
- Calculate R² = correlation²

### Step 5: Identify Patterns
- Compare correlations year-over-year
- Look for team-specific effects
- Identify defensive schemes that break the trend

### Step 6: Validate with Domain Knowledge
- Does data confirm known facts about teams?
- Do results align with general basketball principles?
- Are outliers explainable?

---

## Important Limitations

⚠️ **Keep these in mind when analyzing:**

1. **Pace is a macro metric** - doesn't capture individual player injuries or mid-season transactions
2. **Historical correlation ≠ causation** - pace influences scoring, but many other factors matter more
3. **Compositional changes** - trades and free agency change team dynamics within a season
4. **External factors ignored** - rest, travel, back-to-backs, home/away not included in basic analysis
5. **Moderate relationship at best** - pace explains only 25-35% of PPG variance
6. **Matchup analysis requires sample size** - need sufficient historical games between teams

---

## Advanced Extensions

Once you've mastered the basic framework, consider:

- **Regression analysis**: Fit a line to pace vs. PPG data (slope = expected PPG per pace increase)
- **Multiple regression**: Include other factors (shooting %, defensive efficiency, etc.)
- **Time series analysis**: How does pace-scoring relationship change throughout a season?
- **Player-level analysis**: Analyze pace vs. scoring for specific rosters
- **Possession-level data**: Move beyond team-level to possession-by-possession analysis

---

## Summary

This framework provides a structured approach to analyzing NBA pace-of-play and scoring relationships. The Excel spreadsheet and Python script give you the tools to:

✓ Establish baseline pace/scoring metrics
✓ Identify pace-scoring correlation patterns
✓ Analyze specific matchups in depth
✓ Quantify the relationship statistically
✓ Explore research angles that interest you

The key insight: **Pace predicts scoring, but imperfectly.** Understanding the 60-75% of variance NOT explained by pace is where deeper basketball knowledge becomes essential.

Good luck with your analysis!
