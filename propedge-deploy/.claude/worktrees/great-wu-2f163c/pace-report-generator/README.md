# Pace vs Opponent PDF Report Generator

A skill for generating professional weekly PDF reports showing game-by-game pace analysis with expected points projections across NBA, NHL, and MLB.

## Quick Start

**Basic usage:**
```
"Create a pace report for this week's NBA games. Players: LeBron James, Luka Doncic"
```

**Multi-sport:**
```
"Generate pace reports for all three sports:
NBA: LeBron, Luka
NHL: McDavid
MLB: Trout"
```

**Automated weekly:**
```
"Set up automatic pace reports every Monday at 8am"
```

## What You Get

A professional PDF with:
- 📊 **Game-by-game pace cards** — One per matchup with formatted metrics
- 🎨 **Color-coded matchups** — Green (favorable), Yellow (neutral), Red (unfavorable)
- ⚡ **Pace metrics** — Player pace, team pace, opponent pace-allowed
- 📈 **Projections** — Expected points range based on pace adjustment
- 📄 **Summary page** — Weekly trends and top matchups
- 🏆 **Multi-sport** — Organized by NBA, NHL, MLB

## Card Format

Each game shows:
```
┌────────────────────────────────────────────┐
│ LeBron James                    🏀 NBA     │
│ LAL @ BOS • Tue, Apr 1                     │
├────────────────────────────────────────────┤
│ Your Pace   Team Pace   Opponent Pace      │
│   102.1       103.5        98.2            │
├────────────────────────────────────────────┤
│ ✅ Slower opponent — pace favors matchup  │
│    Delta: -5.3                             │
├────────────────────────────────────────────┤
│ Expected Points: 22-24                     │
│ (Pace-adjusted from 25 pt avg)             │
└────────────────────────────────────────────┘
```

## How It Works

1. **You provide:** Player names, week, sports
2. **Skill fetches:** ESPN API data on player pace and opponent pace-allowed
3. **Calculates:** Pace-adjusted projections using sport-specific formulas
4. **Generates:** Professional PDF with game cards

## Data Sources

- **ESPN API** (primary) - Real-time stats, updated daily
- **Google Sheets** - Connect to your propedge scraper
- **Mock data** - For demos/testing (no API needed)

## Examples

### Single Sport
```
"Create a pace report for this week's NHL players: Connor McDavid and Auston Matthews"
```
→ PDF with 2 NHL cards showing shift/pace analysis

### Multi-Sport
```
"Generate pace reports across all sports:
NBA: LeBron James, Luka Doncic
NHL: Connor McDavid
MLB: Mike Trout, Aaron Judge"
```
→ 6-page PDF organized by sport with summary

### Scheduled Weekly
```
"Set up automatic pace reports every Monday morning at 8am. Use my player list from: https://docs.google.com/spreadsheets/d/1xQE..."
```
→ First report generates immediately, then every Monday at 8am

## Sport-Specific Metrics

**NBA:**
- Pace: Possessions per 48 minutes
- Projection delta: ±2-3 pts per 5-possession swing

**NHL:**
- Pace: Shifts per 60 minutes
- Projection delta: ±0.2-0.5 pts per shift variance

**MLB:**
- Pace: Pitches per at-bat
- Projection delta: ±5-10 pts on batting average per pace point

## Files

- `SKILL.md` - Full skill documentation
- `scripts/generate_pace_pdf.py` - PDF generation engine
- `evals/evals.json` - Test cases

## Output

- Filename: `pace-report_week<N>_<year>.pdf`
- Format: Professional card-based layout
- Size: Standard letter (8.5" × 11")
- Pages: 1 title + 1 per sport + 1 summary = 4+ pages

## Next Steps

1. Use this skill whenever you want weekly pace analysis
2. Combine with PropEdge props for complete analysis
3. Archive reports to track trends over time
4. Set up automatic Monday morning generation

Ready to generate your first report!
