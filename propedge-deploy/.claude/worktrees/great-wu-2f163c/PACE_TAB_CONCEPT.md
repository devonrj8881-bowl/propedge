# PropEdge: Pace vs Team Opponent Tab Concept

## Overview
Add a new analytics tab (`pace-matchup`) to the main nav that shows **player pace statistics broken down against their specific opponent that week** across NBA, NHL, and MLB.

---

## Current Tab Structure
PropEdge currently has 5 main navigation tabs (with icons):

```
📊 Props       → Player props & betting lines
📅 Games       → Schedule & matchups
🏥 Injuries    → Injury reports & lineups
⭐ Parlay      → Parlay builder
🎯 Strategy    → Betting strategies
```

---

## New Tab: Pace vs Opponent

### Tab Icon & Label
```
⚡ Pace Matchup  (or 🏃 Pace / ⏱️ Tempo / 📈 Matchup)
```

### Primary Data Structure

The tab would display **pace metrics** comparing:
- **Player's season pace** vs
- **Opponent's team defense pace/pace-allowed** for that week

### Layout by Sport

---

## 🏀 NBA Pace Tab Layout

```
┌────────────────────────────────────────────────┐
│  PLAYER: LeBron James        LAL @ BOS (Tue)  │
├────────────────────────────────────────────────┤
│                                                 │
│  📊 PACE MATCHUP vs BOS DEFENSE               │
│  ─────────────────────────────────────────────│
│                                                 │
│  Your Pace (Season):          102.1 poss/48m  │
│  Team Pace:                   103.5 poss/48m  │
│  Opponent Pace Allowed:       98.2 poss/48m   │
│                                                 │
│  ⚠️ MATCHUP EDGE: BOS slows pace -5.3         │
│     [Green highlight: slower is better]       │
│                                                 │
├────────────────────────────────────────────────┤
│ HISTORICAL DATA THIS SEASON:                  │
│                                                 │
│ vs BOS (previous):  95.2 pace | 24 pts        │
│ vs BOS avg:         98.7 pace | 25.1 pts      │
│                                                 │
├────────────────────────────────────────────────┤
│ PACE-BASED PROJECTIONS:                       │
│                                                 │
│ If slower (98.2):   22-24 pts (fewer touches) │
│ If normal (102.1):  27-30 pts (baseline)      │
│ If faster (105):    31-34 pts (more touches)  │
│                                                 │
└────────────────────────────────────────────────┘
```

### Key Metrics to Display:

1. **Player's Season Pace** — average possessions per 48min
2. **Team's Pace** — team's avg tempo
3. **Opponent's Pace Allowed** — how fast/slow opponent plays against players like them
4. **Matchup Edge Indicator** — visual/colored delta showing favorability
5. **H2H Pace History** — vs that opponent specifically
6. **Pace-Adjusted Projection** — how many pts/ast/reb/etc. based on pace delta

---

## 🏒 NHL Pace Tab Layout

```
┌────────────────────────────────────────────────┐
│  PLAYER: Connor McDavid      EDM @ LAK (Wed)  │
├────────────────────────────────────────────────┤
│                                                 │
│  🏃 PACE MATCHUP vs LAK DEFENSE               │
│  ─────────────────────────────────────────────│
│                                                 │
│  Your Pace (Season):          Shifts/60: 18.2 │
│  Team Pace:                   Plays/60: 85.3  │
│  Opponent Pace Allowed:       Shots/60: 28.1 │
│                                                 │
│  ✅ MATCHUP EDGE: LAK allows high-pace teams  │
│     +3.2% faster play                         │
│                                                 │
├────────────────────────────────────────────────┤
│ HISTORICAL DATA THIS SEASON:                  │
│                                                 │
│ vs LAK (previous):  18.5 shifts | 2 pts       │
│ vs LAK avg:         17.8 shifts | 1.9 pts     │
│                                                 │
├────────────────────────────────────────────────┤
│ PACE-BASED PROJECTIONS:                       │
│                                                 │
│ If slower (85):     1.2-1.5 pts               │
│ If normal (87):     1.8-2.2 pts (baseline)    │
│ If faster (89):     2.4-2.8 pts               │
│                                                 │
└────────────────────────────────────────────────┘
```

### Key Metrics for NHL:

- **Shifts per 60 minutes** (offensive pace)
- **Team plays per game**
- **Opponent shots allowed per 60**
- **Zone entry frequency** (touches in offensive zone)
- **Pace-adjusted scoring projections**

---

## ⚾ MLB Pace Tab Layout

```
┌────────────────────────────────────────────────┐
│  PLAYER: Mike Trout          LAA @ HOU (Thu)  │
├────────────────────────────────────────────────┤
│                                                 │
│  ⏱️ PACE MATCHUP vs HOU PITCHING             │
│  ─────────────────────────────────────────────│
│                                                 │
│  Your Pace (Season):          Pitches/AB: 3.8 │
│  Opponent Avg Pace:           Pitches/AB: 3.6 │
│  Opponent Pitcher Type:       Right-Handed    │
│                                                 │
│  ✅ MATCHUP EDGE: Slower-paced pitcher        │
│     Gives you more plate time & AB depth      │
│                                                 │
├────────────────────────────────────────────────┤
│ HISTORICAL vs HOU PITCHING:                   │
│                                                 │
│ vs HOU (lifetime):  .312 AVG | 1.2 HR/9      │
│ vs similar pace:    .305 AVG | pace neutral  │
│                                                 │
├────────────────────────────────────────────────┤
│ PACE-BASED PROJECTIONS:                       │
│                                                 │
│ Pace <3.5:          .280-.290 AVG             │
│ Pace 3.5-3.8:       .300-.310 AVG (baseline) │
│ Pace >3.8:          .315-.325 AVG             │
│                                                 │
│ More pitches = more at-bats = more upside    │
│                                                 │
└────────────────────────────────────────────────┘
```

### Key Metrics for MLB:

- **Pitches per at-bat** (season vs opponent)
- **Opponent pitcher pace** (fast vs slow)
- **Zone approach frequency** (how often you see fastballs)
- **Historical performance vs similar-pace pitchers**
- **Pace-adjusted hit rate projection**

---

## UI Components

### 1. **Sub-tabs (like Injuries tab has)**
```
⚡ Pace Matchup
├─ 🎯 This Week     (default) — opponent matchup for upcoming games
├─ 📊 Season Pace   — full season pace breakdown by opponent
├─ 🏆 Head-to-Head — all-time vs this opponent specifically
└─ 📈 Trends        — pace trending over last 10 games
```

### 2. **Matchup Edge Indicator**
```
Green  (#00e676)  = Favorable matchup (faster pace = more touches/opps)
Yellow (#f59e0b)  = Neutral
Red    (#ff5252)  = Unfavorable (slower pace limits touches)
```

### 3. **Cards Layout**
- One card per player (like Props tab)
- Show opponent, date, time of game
- Key pace metrics in large, scannable format
- Projection range in prominent color

### 4. **Filter/Sort Options**
- Filter by league (NBA/NHL/MLB)
- Sort by: matchup favorability, player pace, opponent pace
- Search player name

---

## Data Requirements

### Data Sources Needed:
1. **Pace metrics** by sport:
   - NBA: possessions/48min, player usage rate
   - NHL: shifts/60, touches, ice time
   - MLB: pitches/AB, pitcher speed, contact rates

2. **Opponent-specific data**:
   - Team pace profile (fast vs slow)
   - Team defense pace allowed
   - H2H historical matchups

3. **Projections**:
   - ML models to estimate how pace delta affects scoring

### Integration with Scraper:
- Scraper (`propedge_scraper_setup.md`) would need to pull:
  - Daily opponent matchups
  - That opponent's season pace metrics
  - Historical H2H data
  - Player pace trends

---

## Implementation Roadmap

### Phase 1: MVP (NBA only)
1. Add new `data-view="pace"` tab to nav
2. Create pace card component (similar to props cards)
3. Display:
   - Player's season pace
   - Opponent team pace allowed
   - Simple edge indicator
   - Basic projection (±2-4 pts based on pace delta)

### Phase 2: Enhanced (NBA + NHL)
1. Add NHL-specific pace metrics
2. Add sub-tabs (This Week / Season / H2H / Trends)
3. Implement head-to-head historical lookup
4. Add pitcher/goalie matchup depth

### Phase 3: Full Feature (All Sports)
1. Add MLB pace metrics
2. Context-aware data (batter vs pitcher pace types)
3. Advanced projections (ML model)
4. Trend analysis charts

---

## Visual Design Notes

- **Colors**: Use league-specific accent colors (already in design system)
  - NBA: Orange (#ff8c00)
  - NHL: Blue (#4488ff)
  - MLB: Red (#ff4444)

- **Icons**: Emoji-based (matches current design)
  - ⚡ for pace/speed
  - 📊 for matchup metrics
  - 🏃 for player pace
  - ⏱️ for timing/tempo

- **Responsive**: Stack vertically on mobile, grid on desktop (like Injuries tab)

- **Performance**: Load pace data lazily like other tabs (avoid blocking main view)

---

## Example Use Cases

1. **Betting**: "Should I take the over on LeBron's points? BOS slows pace by -5.3, so I'll adjust down 2-3 pts from my baseline"

2. **Fantasy**: "McDavid is going against LAK who give up fast play. Stack him this week for ceiling games"

3. **Props Prop**: "MLB player faces slow-pace pitcher. Fewer pitches = fewer ABs = lower hit expectation"

4. **Parlay Building**: Filter pace matchups to find stacked favorable games

---

## Competitor Analysis

- **DraftKings Insights** → Shows matchup difficulty
- **ESPN Stats** → Shows pace metrics buried in advanced
- **FiveThirtyEight** → Shows team pace trends
- **PropEdge edge**: Real-time pace vs opponent + projection impact

---

## Questions for User Testing

1. Which pace metric is most useful for your sport?
2. Do you prefer historical H2H or season-long opponent pace?
3. Would you want push notifications for pace-favorable matchups?
4. How would you use this in prop selection workflow?
