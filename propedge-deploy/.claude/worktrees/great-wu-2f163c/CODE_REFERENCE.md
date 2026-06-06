# PropEdge Pace Tab - Code Reference

## Key Code Snippets

### 1. Navigation Tab Addition

**Location:** Line 4622 in index.html

```html
<div class="nav-tab" data-view="pace">
  <span class="nav-tab-icon">⚡</span>
  Pace
</div>
```

### 2. HTML Container

**Location:** Lines 5166-5209 in index.html

```html
<div class="view-container" id="paceContainer">
  <div class="pace-header">
    <div>
      <div class="pace-header-title">Pace vs Opponent</div>
      <div class="pace-header-subtitle">Player tempo analysis for this week's matchups</div>
    </div>
  </div>

  <div class="pace-league-pills">
    <div class="pace-pill pill-all active" data-league="ALL" onclick="setPaceLeague('ALL')">All</div>
    <div class="pace-pill pill-nba" data-league="NBA" onclick="setPaceLeague('NBA')">🏀 NBA</div>
    <div class="pace-pill pill-nhl" data-league="NHL" onclick="setPaceLeague('NHL')">🏒 NHL</div>
    <div class="pace-pill pill-mlb" data-league="MLB" onclick="setPaceLeague('MLB')">⚾ MLB</div>
  </div>

  <div class="pace-search-wrap">
    <span class="pace-search-icon">🔍</span>
    <input class="pace-search" id="paceSearchInput" placeholder="Search player..." oninput="renderPace()" />
  </div>

  <div class="pace-sort-bar">
    <select class="pace-sort-select" id="paceSortSelect" onchange="renderPace()">
      <option value="favorability">Matchup Edge ↓</option>
      <option value="playerPace">Player Pace ↓</option>
      <option value="opponentPace">Opponent Pace ↓</option>
    </select>
  </div>

  <div id="paceCards">
    <!-- Cards render here -->
  </div>
</div>
```

### 3. CSS Structure

**Location:** Lines 3722-3858 in index.html

Key classes:
```css
.pace-card { /* Main card container */ }
.pace-league-pills { /* Filter pill container */ }
.pace-metrics { /* 2-3 column metric grid */ }
.pace-edge-banner { /* Matchup favorability indicator */ }
.pace-edge-favorable { /* Green background + border */ }
.pace-edge-neutral { /* Yellow background + border */ }
.pace-edge-unfavorable { /* Red background + border */ }
.pace-projection { /* Purple projection box */ }
```

### 4. JavaScript: Initialize Data

**Location:** Line 14912 in index.html

```javascript
function initPaceData() {
  state.paceData = [
    {
      id: 'pace-nba-1',
      league: 'NBA',
      player: 'LeBron James',
      team: 'LAL',
      opponent: 'BOS',
      date: 'Tue, Apr 1',
      playerPace: 102.1,
      teamPace: 103.5,
      opponentPace: 98.2,
      favorability: 'favorable',
      favorabilityDelta: -5.3,
      projectionLow: 22,
      projectionHigh: 24,
      stat: 'Points'
    },
    // ... more data
  ];
}
```

### 5. JavaScript: Main Render Function

**Location:** Line 14922 in index.html

```javascript
function renderPace() {
  if (!state.paceData || state.paceData.length === 0) {
    initPaceData();
  }

  const search = (document.getElementById('paceSearchInput') || {}).value || '';
  const league = state.paceLeague || 'ALL';
  const sort = document.getElementById('paceSortSelect')?.value || 'favorability';

  let filtered = state.paceData.filter(p => {
    const matchesLeague = league === 'ALL' || p.league === league;
    const matchesSearch = p.player.toLowerCase().includes(search.toLowerCase()) ||
                         p.team.toLowerCase().includes(search.toLowerCase());
    return matchesLeague && matchesSearch;
  });

  // Sort logic
  if (sort === 'favorability') {
    const order = { favorable: -1, neutral: 0, unfavorable: 1 };
    filtered.sort((a, b) => order[a.favorability] - order[b.favorability]);
  } else if (sort === 'playerPace') {
    filtered.sort((a, b) => b.playerPace - a.playerPace);
  } else if (sort === 'opponentPace') {
    filtered.sort((a, b) => a.opponentPace - b.opponentPace);
  }

  // Render or show empty state
  const html = filtered.length ? filtered.map(p => renderPaceCard(p)).join('') :
    '<div class="pace-empty"><div class="pace-empty-icon">⚡</div><div>No pace matchups found</div></div>';

  document.getElementById('paceCards').innerHTML = html;
}
```

### 6. JavaScript: Card Renderer

**Location:** Line 14954 in index.html (excerpt)

```javascript
function renderPaceCard(p) {
  const leagueEmoji = { NBA: '🏀', NHL: '🏒', MLB: '⚾' }[p.league] || '⚡';
  const edgeClass = `pace-edge-${p.favorability}`;
  const edgeIcons = { favorable: '✅', neutral: '⚠️', unfavorable: '❌' };
  const edgeMessages = {
    favorable: `${p.league === 'MLB' ? 'Slower-paced pitcher' : 'Faster-paced opponent'} — favors your matchup`,
    neutral: 'Neutral pace matchup',
    unfavorable: `${p.league === 'MLB' ? 'Faster-paced pitcher' : 'Slower-paced opponent'} — less favorable`
  };

  return `
    <div class="pace-card">
      <div class="pace-card-header">
        <div class="pace-card-title">
          ${p.player}
          <span class="pace-league-tag ${p.league.toLowerCase()}">${leagueEmoji} ${p.league}</span>
        </div>
        <div class="pace-matchup-info">${p.team} @ ${p.opponent} • ${p.date}</div>
      </div>

      <div class="pace-metrics">
        <div class="pace-metric">
          <div class="pace-metric-label">Your Pace</div>
          <div class="pace-metric-value">${p.playerPace.toFixed(1)}</div>
        </div>
        <div class="pace-metric">
          <div class="pace-metric-label">Team Pace</div>
          <div class="pace-metric-value">${p.teamPace.toFixed(1)}</div>
        </div>
        <div class="pace-metric">
          <div class="pace-metric-label">Opp Pace ${p.league === 'MLB' ? '(Pitcher)' : ''}</div>
          <div class="pace-metric-value">${p.opponentPace.toFixed(1)}</div>
        </div>
      </div>

      <div class="pace-edge-banner ${edgeClass}">
        <div class="pace-edge-icon">${edgeIcons[p.favorability]}</div>
        <div class="pace-edge-text">
          <div class="pace-edge-title">${edgeMessages[p.favorability]}</div>
          <!-- Delta calculation logic -->
        </div>
      </div>

      <div class="pace-projection">
        <div class="pace-projection-label">📊 Projection: ${p.stat}</div>
        <div class="pace-projection-range">
          ${p.projectionLow.toFixed(p.projectionLow < 1 ? 2 : 0)} - ${p.projectionHigh.toFixed(p.projectionHigh < 1 ? 2 : 0)}
        </div>
      </div>
    </div>
  `;
}
```

### 7. View Switching Integration

**Location:** Line 15061 in index.html

```javascript
// Inside initTabs() event listener
if (state.view === 'pace') renderPace();
```

**Location:** Line 15055 in index.html

```javascript
// Inside view-switching container logic
document.getElementById('paceContainer').className = state.view === 'pace' ? 'view-container show' : 'view-container';
```

### 8. League Filter Handler

**Location:** Line 15020 in index.html

```javascript
function setPaceLeague(league) {
  document.querySelectorAll('.pace-pill').forEach(p => p.classList.remove('active'));
  document.querySelector(`.pace-pill[data-league="${league}"]`).classList.add('active');
  state.paceLeague = league;
  renderPace();
}
```

## Data Flow Diagram

```
User clicks ⚡ Pace tab
         ↓
    initTabs() fires
         ↓
state.view = 'pace'
         ↓
paceContainer becomes visible
         ↓
renderPace() is called
         ↓
League/search/sort filters applied
         ↓
renderPaceCard() generates HTML for each match
         ↓
Cards inserted into #paceCards
         ↓
User sees filtered pace matchups
```

## State Structure

```javascript
state = {
  // ... existing state
  paceLeague: 'ALL',           // Currently selected league
  paceSort: 'favorability',    // Current sort option
  paceSearch: '',              // Current search string
  paceData: [                  // Array of pace records
    {
      id: string,
      league: 'NBA'|'NHL'|'MLB',
      player: string,
      team: string,
      opponent: string,
      date: string,
      playerPace: number,
      teamPace: number,
      opponentPace: number,
      favorability: 'favorable'|'neutral'|'unfavorable',
      favorabilityDelta: number,
      projectionLow: number,
      projectionHigh: number,
      stat: string
    }
  ]
}
```

## Event Listeners

```javascript
// League pill click
.pace-pill → onclick="setPaceLeague('LEAGUE')"

// Search input
#paceSearchInput → oninput="renderPace()"

// Sort dropdown
#paceSortSelect → onchange="renderPace()"

// Tab click (delegated)
.nav-tab[data-view="pace"] → triggers initTabs() listener
```

## CSS Variables Used

```css
--bg-primary: #22263a          /* Main background */
--bg-secondary: #1c2033        /* Secondary background */
--bg-tertiary: #272d44         /* Tertiary background */
--bg-card: #2e3452             /* Card background */
--bg-card-hover: #343c5e       /* Card hover state */
--text-primary: #f0f2f8        /* Primary text */
--text-secondary: #b8c2d8      /* Secondary text */
--text-muted: #7a85a0          /* Muted text */
--accent-green: #00e676        /* Favorable (green) */
--accent-gold: #f59e0b         /* Neutral (yellow) */
--accent-red: #ff5252          /* Unfavorable (red) */
--accent-blue: #4a8fff         /* NHL (blue) */
--border-color: #3a4260        /* Border color */
--radius-sm: 6px               /* Small border radius */
--radius-md: 10px              /* Medium border radius */
```

## Notes

- All code is vanilla JavaScript (no frameworks)
- Follows existing PropEdge patterns and conventions
- CSS is scoped with `.pace-*` prefix to avoid conflicts
- Ready for data integration from API/scraper
- Mobile-responsive using CSS media queries
- Lazy-loaded (only renders when tab is active)

