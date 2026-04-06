---
name: pace-report-generator
description: Generate weekly PDF reports showing player pace vs opponent with expected total points per game on a game-by-game basis. Use this skill whenever the user wants to create pace analysis reports for NBA, NHL, or MLB players, whether for a single week's matchups or seasonal analysis. Trigger whenever the user mentions "pace report", "pace vs opponent", "game-by-game pace analysis", "weekly pace PDF", or asks to "export pace matchups" or "create pace expectations". This skill fetches real-time data, calculates pace-adjusted projections, and formats everything into a professional card-based PDF.
compatibility: Requires pdf skill, ESPN API access (optional - can use mock data)
---

# Pace vs Opponent PDF Report Generator

Generate professional weekly PDF reports analyzing player pace against opponent matchups with expected total points per game projections.

## What This Skill Does

Creates a game-by-game pace analysis report in PDF format showing:
- **Player & Matchup Info** — Player name, team, opponent, game date/time
- **Pace Metrics** — Player season pace, team pace, opponent's pace-allowed
- **Matchup Edge** — Color-coded favorability (green = favorable, red = unfavorable)
- **Pace Delta** — Numeric difference showing how opponent's pace compares
- **Expected Points Projection** — Range of expected points based on pace adjustment
- **Sport-Specific Metrics** — NBA (possessions/48min), NHL (shifts/60), MLB (pitches/AB)

## How It Works

### Step 1: Gather Input

Provide one or more of:
- **Player names** (e.g., "LeBron James, Luka Doncic")
- **Week/date range** (e.g., "April 1-7, 2026" or "this week")
- **Sport(s)** (NBA, NHL, MLB - default: all three)
- **Data source** (ESPN API, Google Sheet, or mock data - default: ESPN)

### Step 2: Fetch Data

The skill will:
1. Query ESPN APIs for player season stats and opponent data
2. Calculate pace metrics for each player's upcoming matchups
3. Retrieve pace-allowed data for opponents
4. Compute pace-adjusted projections using league-specific formulas

### Step 3: Create Card Layout

Each game generates a beautifully formatted card with:
```
┌─────────────────────────────────────────┐
│ Player Name          🏀 NBA              │
│ TEAM @ OPPONENT • Date/Time              │
├─────────────────────────────────────────┤
│ Your Pace   Team Pace   Opponent Pace    │
│   102.1       103.5        98.2          │
├─────────────────────────────────────────┤
│ ✅ Slower opponent — pace favors matchup │
│    Delta: -5.3                           │
├─────────────────────────────────────────┤
│ Expected Points: 22-24                   │
│ (Pace-adjusted from 25 pt avg)           │
└─────────────────────────────────────────┘
```

### Step 4: Generate PDF

- **Title page** with week summary and statistics
- **One card per game** on separate pages or grid layout
- **Summary page** at end with weekly trends and recommendations
- **Professional formatting** with PropEdge design system colors
- **Sortable by favorability**, date, or sport

## Input Format

You can trigger this skill by providing:

**Option A: Natural language**
```
"Create a pace report for this week's NBA games with LeBron, Luka, and Jalen Brunson"
```

**Option B: CSV/Excel with player list**
```
Player,Sport,Date
LeBron James,NBA,2026-04-01
Connor McDavid,NHL,2026-04-02
Mike Trout,MLB,2026-04-03
```

**Option C: Google Sheet link**
```
"Generate pace reports from my weekly props sheet: https://docs.google.com/spreadsheets/d/..."
```

## Output Format

A professional PDF file with:
- **Filename:** `pace-report_<week>_<year>.pdf` (e.g., `pace-report_week15_2026.pdf`)
- **Size:** Standard letter (8.5" × 11")
- **Layout:** Card-based, one game per card
- **Colors:** Green (favorable), Yellow (neutral), Red (unfavorable)
- **Metrics:** Sport-specific (NBA: pts, assists; NHL: points, assists; MLB: AVG, HR)

## Scheduling

You can set this to run weekly automatically by saying:
```
"Create a pace report every Monday morning at 8am for all my props players"
```

This will use the `schedule` skill to set up recurring PDF generation.

## Data Sources

### Primary: ESPN API (Recommended)
- Real-time player stats
- Updated weekly with live data
- No setup required
- Free tier available

### Fallback: Google Sheets
- Connect to your propedge scraper output
- Custom player lists
- Requires sheet sharing/authentication

### Demo: Mock Data
- Sample players with realistic metrics
- Useful for testing
- No API required

## Customization

**Change the layout:**
```
"Generate pace report but arrange 3 cards per row instead of 1 per page"
```

**Filter by sport:**
```
"Only show NHL and MLB, skip NBA this week"
```

**Include historical data:**
```
"Add a trends section showing how these players performed vs pace over the last 4 weeks"
```

**Export as Excel instead:**
```
"Generate the same pace analysis but as an Excel file I can edit"
```

## Examples

### Example 1: Weekly NBA Report
**Input:**
```
"Create a pace report for this week's NBA games. Players: LeBron James, Luka Doncic, Jayson Tatum"
```

**Output:** PDF with 3 cards showing each player's matchup, pace vs opponent, and expected points range. Color-coded by favorability. Summary page shows which matchups are most favorable overall.

### Example 2: Multi-Sport Weekly Report
**Input:**
```
"Generate pace reports for all three sports. I want to see my players for the week:
NBA: LeBron, Luka
NHL: McDavid
MLB: Trout, Judge"
```

**Output:** 5-page PDF with cards organized by sport. Title page shows overview. Each sport gets its own section with sport-specific metrics. Final page summarizes top pace-favorable matchups across all sports.

### Example 3: Automated Weekly Reports
**Input:**
```
"Set up automatic weekly pace reports every Monday morning at 8am. Pull player list from my Google Sheet https://docs.google.com/spreadsheets/d/1xQE... and email me the PDF"
```

**Output:** Weekly scheduled task configured. First report generates immediately. Every Monday at 8am, pulls latest player list, fetches ESPN data, generates PDF, and emails to you.

## Recommendations

- **Best practice:** Run Monday mornings to prep for the week's games
- **Update frequency:** ESPN data updates daily; best to pull fresh data for each report
- **Combine with props:** Use pace reports alongside your PropEdge props analysis
- **Archive reports:** Save weekly reports in a folder to track trends over time

## Troubleshooting

**"No data found for player X"**
→ Check player name spelling. Use full name (e.g., "LeBron James" not "Bron")

**"Cannot connect to ESPN API"**
→ Fall back to mock data for demo, or provide a Google Sheet link

**"Pace data not available"**
→ Some new players or trades may have limited historical data. Report will use league averages.

---

## Technical Details

### Pace Formulas by Sport

**NBA:**
- Player Pace = Possessions per 48 minutes (season avg)
- Opponent Pace Allowed = Team's defensive pace allowed
- Projection delta = ±2-3 points per 5-possession swing

**NHL:**
- Player Pace = Shifts per 60 minutes
- Opponent Pace = Team's average opponent shifts/60
- Projection delta = ±0.2-0.5 points per shift variance

**MLB:**
- Player Pace = Pitches per at-bat (season avg)
- Pitcher Pace = Average pitches thrown
- Projection delta = ±5-10 points on batting average per pace point

### Colors & Thresholds

- **Green (Favorable):** Opponent pace allows more touches/opportunities (slower pace for hitter, faster pace for pitcher)
- **Yellow (Neutral):** Within 1-2 standard deviations of season average
- **Red (Unfavorable):** Opponent pace limits touches/opportunities

---

Ready to generate! Provide your player list and date range.
