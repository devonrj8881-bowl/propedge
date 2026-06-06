# PropEdge Pace Trends v2.0 - Feature Guide

## ✅ 4 New Enhancements Deployed

### 1. **Injury Status Filter** 
- **What it does:** Automatically filters out Limited/Injured players
- **How it works:** Checks player status field - only shows "Active" players
- **Impact:** Injured players won't appear in the Pace Trends cards even if their team is playing
- **Example:** Jaren Jackson Jr. (UTA) marked as "Limited" → hidden from display

### 2. **Team Pace Rankings**
- **What it does:** Shows each team's pace ranking among all 30 NBA teams
- **Rankings:**
  - 🚀 **Fastest (#1-5):** OKC, BOS, NYK, CLE, PHI
  - → **Medium (#6-12):** MIN, LAL, MIA, ATL, DEN, LAC, PHO
  - 🐢 **Slowest (#13-20):** HOU, DET, BRO, SAN, IND, POR, UTA, ORL
- **Where to see it:** Each card shows team pace rank badge
- **How to use:** Higher-ranked (faster) teams = more possessions = higher scoring potential

### 3. **Prediction Tooltips**
Hover over any metric to see detailed explanation:

**Trend Indicators:**
- 📈 UP: Pace increasing - Team using faster tempo, more possessions available
- → STABLE: Pace consistent - Predictable workload, reliable for props
- 📉 DOWN: Pace decreasing - Slower tempo, fewer possessions, lower ceiling

**Volatility Levels:**
- ✅ 0-0.5: Very stable - Predictable pace, reliable for props
- → 0.5-1.5: Stable - Generally consistent, some variance
- ⚡ 1.5-2.5: Volatile - Pace fluctuates, less predictable
- ⚠️ 2.5+: Very volatile - Highly unpredictable pace

**Other Tooltips:**
- Predicted Pace: Player's expected pace for today's game
- Confidence: Prediction confidence level (higher = more reliable)
- 7-day MA / 14-day MA: Moving averages for trend analysis

### 4. **Live Game Integration**
- **What it does:** Automatically pulls today's games and filters players
- **Leagues supported:** NBA, NHL, MLB, NFL
- **Real-time:** Updates as games load from ESPN API
- **Game Slate Filtering:** Only shows players whose teams are playing TODAY
- **Auto-refresh:** Refreshes every 30-60 seconds as games update

---

## How to Use This Data for Betting

### Quick Decision Framework

**High Confidence Bets:**
- Trend = UP + Confidence >80% + Volatility <1.0
- Team Rank = Fast (#1-5) + Player Trend = UP
- Expected outcome: High scoring, more possessions

**Medium Confidence Bets:**
- Trend = STABLE + Confidence 60-80% + Volatility 1.0-1.5
- Team Rank = Medium (#6-12)
- Expected outcome: Consistent performance

**Avoid These:**
- Status = Limited/Injured (automatically filtered now)
- Trend = DOWN (declining pace)
- Volatility >2.0 (too unpredictable)
- Confidence <50% (unreliable prediction)

---

## Pace Data Interpretation

### Example 1: Fast Guard Playing Against Slow Team
- Player: Shai Gilgeous-Alexander (OKC)
- Pace: 101.54 (HIGH)
- Team Rank: ⚡ #1 Fastest  
- Trend: UP (📈)
- Volatility: 2.8 (⚠️ volatile)
- **Interpretation:** OKC plays ultra-fast. SGA will have high possession count. BUT volatility is high, so outcomes vary.

### Example 2: Reliable Mid-Pace Big Man
- Player: Nikola Jokic (DEN)
- Pace: 93.24 (LOWER)
- Team Rank: → #10 Medium
- Trend: UP (📈)
- Volatility: 2.7 (volatile)
- Confidence: 80.3%
- **Interpretation:** DEN plays slower pace. Jokic's volume may be limited by pace, but trend is UP. High confidence.

---

## Real-Time Usage

### When New Games Load:
1. Pace Trends automatically filters to show only players with games TODAY
2. Cards update in real-time as ESPN game data loads
3. Injured status is checked automatically
4. Team pace rankings provide context immediately

### Before Placing Props:
1. Click on player card to see all metrics
2. Hover over metrics for detailed tooltips
3. Check team pace rank - fast teams = more scoring
4. Look at trend and confidence together
5. Avoid high-volatility players unless you understand the risk

---

## Data Source
- **Players & Pace Data:** 2025-26 NBA Season (NBAstuffer)
- **Games:** Real-time from ESPN API
- **Predictions:** ML model trained on historical pace patterns
- **Update Frequency:** Every 30-60 seconds during game slates
- **Last Updated:** 2026-04-03 14:32 UTC

---

## Questions?
- **Why is a player hidden?** They're not playing today OR marked as Limited/Injured
- **What does volatility mean?** Higher = less consistent pace (harder to predict)
- **Can pace change?** Yes! Trends show if pace is UP/DOWN/STABLE
- **Which team plays fastest?** Check team rankings - OKC is #1 (fastest), ORL is #20 (slowest)
