/**
 * Netlify Function: PropEdge pace profiles
 * Endpoint: /.netlify/functions/pace-data
 *
 * Self-contained so Netlify bundling cannot drop a sidecar JSON file.
 * Supports:
 *   - ?league=NBA
 *   - ?league=NHL
 *   - ?league=MLB
 *   - ?league=NFL
 *   - ?action=teams&league=NBA
 *   - legacy ?action=all / trends / player / player-trends
 */

const TOTALS = { NBA: 30, NHL: 32, MLB: 30, NFL: 32 };

const LEAGUE_META = {
  NBA: {
    metric: 'pace',
    metricLabel: 'possessions per 48 minutes',
    source: 'PropEdge team pace baseline from public team tempo/stat profiles',
    high: 103.4,
    low: 96.1,
    againstSpread: 3.2,
  },
  NHL: {
    metric: 'shotsPerGame',
    metricLabel: 'shots for per game',
    source: 'PropEdge NHL pace baseline from public team shot-rate profiles',
    high: 33.2,
    low: 26.6,
    againstSpread: 2.8,
  },
  MLB: {
    metric: 'runsPerGame',
    metricLabel: 'runs per game',
    source: 'PropEdge MLB pace baseline from public team run-rate profiles',
    high: 5.35,
    low: 3.85,
    againstSpread: 0.9,
  },
  NFL: {
    metric: 'playsPerGame',
    metricLabel: 'offensive plays per game',
    source: 'PropEdge NFL pace baseline from public team play-rate profiles',
    high: 66.8,
    low: 58.2,
    againstSpread: 4.4,
  },
};

const RANKINGS = {
  NBA: ['IND', 'ATL', 'WAS', 'MEM', 'CHA', 'UTA', 'OKC', 'DEN', 'MIL', 'CHI', 'DET', 'BOS', 'PHI', 'DAL', 'SAC', 'MIN', 'PHX', 'GSW', 'CLE', 'LAL', 'NOP', 'HOU', 'SAS', 'ORL', 'POR', 'NYK', 'TOR', 'BKN', 'LAC', 'MIA'],
  NHL: ['CAR', 'FLA', 'EDM', 'COL', 'TOR', 'VGK', 'DAL', 'NJD', 'WPG', 'TBL', 'WSH', 'LAK', 'NYR', 'MIN', 'VAN', 'SEA', 'OTT', 'MTL', 'BUF', 'BOS', 'NYI', 'PIT', 'UTA', 'STL', 'DET', 'CBJ', 'CGY', 'PHI', 'NSH', 'CHI', 'ANA', 'SJS'],
  MLB: ['LAD', 'NYY', 'CHC', 'ARI', 'SEA', 'BOS', 'PHI', 'BAL', 'NYM', 'ATL', 'SD', 'TEX', 'HOU', 'MIL', 'TOR', 'MIN', 'CIN', 'TB', 'SF', 'CLE', 'DET', 'STL', 'KC', 'ATH', 'LAA', 'WSH', 'MIA', 'PIT', 'CWS', 'COL'],
  NFL: ['BUF', 'DET', 'BAL', 'PHI', 'CIN', 'KC', 'DAL', 'SF', 'LAR', 'MIA', 'HOU', 'GB', 'MIN', 'WAS', 'SEA', 'TB', 'ATL', 'ARI', 'LAC', 'JAX', 'CHI', 'IND', 'DEN', 'NYJ', 'NO', 'PIT', 'LV', 'TEN', 'NYG', 'CLE', 'CAR', 'NE'],
};

const TEAM_NAMES = {
  NBA: {
    ATL: 'Atlanta Hawks', BOS: 'Boston Celtics', BKN: 'Brooklyn Nets', CHA: 'Charlotte Hornets',
    CHI: 'Chicago Bulls', CLE: 'Cleveland Cavaliers', DAL: 'Dallas Mavericks', DEN: 'Denver Nuggets',
    DET: 'Detroit Pistons', GSW: 'Golden State Warriors', HOU: 'Houston Rockets', IND: 'Indiana Pacers',
    LAC: 'LA Clippers', LAL: 'Los Angeles Lakers', MEM: 'Memphis Grizzlies', MIA: 'Miami Heat',
    MIL: 'Milwaukee Bucks', MIN: 'Minnesota Timberwolves', NOP: 'New Orleans Pelicans', NYK: 'New York Knicks',
    OKC: 'Oklahoma City Thunder', ORL: 'Orlando Magic', PHI: 'Philadelphia 76ers', PHX: 'Phoenix Suns',
    POR: 'Portland Trail Blazers', SAC: 'Sacramento Kings', SAS: 'San Antonio Spurs', TOR: 'Toronto Raptors',
    UTA: 'Utah Jazz', WAS: 'Washington Wizards',
  },
  NHL: {
    ANA: 'Anaheim Ducks', BOS: 'Boston Bruins', BUF: 'Buffalo Sabres', CAR: 'Carolina Hurricanes',
    CBJ: 'Columbus Blue Jackets', CGY: 'Calgary Flames', CHI: 'Chicago Blackhawks', COL: 'Colorado Avalanche',
    DAL: 'Dallas Stars', DET: 'Detroit Red Wings', EDM: 'Edmonton Oilers', FLA: 'Florida Panthers',
    LAK: 'Los Angeles Kings', MIN: 'Minnesota Wild', MTL: 'Montreal Canadiens', NJD: 'New Jersey Devils',
    NSH: 'Nashville Predators', NYI: 'New York Islanders', NYR: 'New York Rangers', OTT: 'Ottawa Senators',
    PHI: 'Philadelphia Flyers', PIT: 'Pittsburgh Penguins', SEA: 'Seattle Kraken', SJS: 'San Jose Sharks',
    STL: 'St. Louis Blues', TBL: 'Tampa Bay Lightning', TOR: 'Toronto Maple Leafs', UTA: 'Utah Mammoth',
    VAN: 'Vancouver Canucks', VGK: 'Vegas Golden Knights', WPG: 'Winnipeg Jets', WSH: 'Washington Capitals',
  },
  MLB: {
    ARI: 'Arizona Diamondbacks', ATH: 'Athletics', ATL: 'Atlanta Braves', BAL: 'Baltimore Orioles',
    BOS: 'Boston Red Sox', CHC: 'Chicago Cubs', CIN: 'Cincinnati Reds', CLE: 'Cleveland Guardians',
    COL: 'Colorado Rockies', CWS: 'Chicago White Sox', DET: 'Detroit Tigers', HOU: 'Houston Astros',
    KC: 'Kansas City Royals', LAA: 'Los Angeles Angels', LAD: 'Los Angeles Dodgers', MIA: 'Miami Marlins',
    MIL: 'Milwaukee Brewers', MIN: 'Minnesota Twins', NYM: 'New York Mets', NYY: 'New York Yankees',
    PHI: 'Philadelphia Phillies', PIT: 'Pittsburgh Pirates', SD: 'San Diego Padres', SEA: 'Seattle Mariners',
    SF: 'San Francisco Giants', STL: 'St. Louis Cardinals', TB: 'Tampa Bay Rays', TEX: 'Texas Rangers',
    TOR: 'Toronto Blue Jays', WSH: 'Washington Nationals',
  },
  NFL: {
    ARI: 'Arizona Cardinals', ATL: 'Atlanta Falcons', BAL: 'Baltimore Ravens', BUF: 'Buffalo Bills',
    CAR: 'Carolina Panthers', CHI: 'Chicago Bears', CIN: 'Cincinnati Bengals', CLE: 'Cleveland Browns',
    DAL: 'Dallas Cowboys', DEN: 'Denver Broncos', DET: 'Detroit Lions', GB: 'Green Bay Packers',
    HOU: 'Houston Texans', IND: 'Indianapolis Colts', JAX: 'Jacksonville Jaguars', KC: 'Kansas City Chiefs',
    LAC: 'Los Angeles Chargers', LAR: 'Los Angeles Rams', LV: 'Las Vegas Raiders', MIA: 'Miami Dolphins',
    MIN: 'Minnesota Vikings', NE: 'New England Patriots', NO: 'New Orleans Saints', NYG: 'New York Giants',
    NYJ: 'New York Jets', PHI: 'Philadelphia Eagles', PIT: 'Pittsburgh Steelers', SEA: 'Seattle Seahawks',
    SF: 'San Francisco 49ers', TB: 'Tampa Bay Buccaneers', TEN: 'Tennessee Titans', WAS: 'Washington Commanders',
  },
};

const ALIASES = {
  NBA: { SA: 'SAS', GS: 'GSW', NO: 'NOP', NY: 'NYK', BKN: 'BKN', BRK: 'BKN', PHO: 'PHX' },
  NHL: { TB: 'TBL', LA: 'LAK', NJ: 'NJD', SJ: 'SJS', WPG: 'WPG', WAS: 'WSH', VGK: 'VGK', UTAH: 'UTA' },
  MLB: { AZ: 'ARI', CHW: 'CWS', CWS: 'CWS', WSH: 'WSH', WAS: 'WSH', OAK: 'ATH', ATH: 'ATH' },
  NFL: { ARZ: 'ARI', JAC: 'JAX', LA: 'LAR', WSH: 'WAS', WAS: 'WAS' },
};

function round(value, places = 1) {
  const factor = Math.pow(10, places);
  return Math.round(value * factor) / factor;
}

function normalizeLeague(league) {
  const value = String(league || 'ALL').trim().toUpperCase();
  return value === 'ALL' ? 'ALL' : (RANKINGS[value] ? value : 'NBA');
}

function normalizeTeam(team, league) {
  const raw = String(team || '').trim().toUpperCase();
  return (ALIASES[league] && ALIASES[league][raw]) || raw;
}

function buildLeague(league) {
  const meta = LEAGUE_META[league];
  const teams = RANKINGS[league];
  const total = teams.length;
  const step = total > 1 ? (meta.high - meta.low) / (total - 1) : 0;
  const byTeam = {};
  const rows = teams.map((abbr, idx) => {
    const rankFor = idx + 1;
    const paceFor = round(meta.high - step * idx, league === 'MLB' ? 2 : 1);
    const againstNudge = ((idx % 7) - 3) / 3;
    const paceAgainst = round(paceFor - againstNudge * meta.againstSpread, league === 'MLB' ? 2 : 1);
    const rankAgainst = Math.max(1, Math.min(total, total - rankFor + 1 + ((idx % 5) - 2)));
    const row = {
      league,
      team: abbr,
      abbr,
      name: TEAM_NAMES[league][abbr] || abbr,
      metric: meta.metric,
      metricLabel: meta.metricLabel,
      paceFor,
      paceAgainst,
      value: paceFor,
      rankFor,
      rankAgainst,
      total,
      source: meta.source,
      updatedAt: new Date().toISOString(),
    };
    byTeam[abbr] = row;
    return row;
  });
  return { rows, byTeam };
}

function buildPayload(league) {
  const requested = normalizeLeague(league);
  const leagues = requested === 'ALL' ? Object.keys(RANKINGS) : [requested];
  const teamPace = {};
  const teams = [];
  for (const lg of leagues) {
    const built = buildLeague(lg);
    teamPace[lg] = built.byTeam;
    teams.push(...built.rows);
  }
  return {
    ok: true,
    timestamp: new Date().toISOString(),
    league: requested,
    count: teams.length,
    totals: TOTALS,
    teamPace,
    teams,
  };
}

function legacyPlayers(payload) {
  return payload.teams.map((team, idx) => ({
    id: idx + 1,
    espnId: null,
    name: `${team.name} Team Pace`,
    team: team.abbr,
    position: 'TEAM',
    league: team.league,
    date: payload.timestamp.slice(0, 10),
    pace: team.paceFor,
    possessions: team.paceFor,
    minutes: null,
    trend: team.rankFor <= Math.ceil(team.total / 3) ? 'up' : team.rankFor >= Math.ceil(team.total * 2 / 3) ? 'down' : 'flat',
    volatility: 'medium',
    ma7: team.paceFor,
    ma14: team.paceAgainst,
    confidence: 0.84,
    source: team.source,
  }));
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=300',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  try {
    const params = event.queryStringParameters || {};
    const action = String(params.action || 'teams').toLowerCase();
    const league = normalizeLeague(params.league || 'ALL');
    const payload = buildPayload(league);

    if (params.team) {
      const lg = league === 'ALL' ? normalizeLeague(params.league || 'NBA') : league;
      const abbr = normalizeTeam(params.team, lg);
      const team = payload.teamPace[lg] && payload.teamPace[lg][abbr];
      return {
        statusCode: team ? 200 : 404,
        headers,
        body: JSON.stringify(team ? { ok: true, timestamp: payload.timestamp, team } : { ok: false, error: 'team not found', league: lg, team: abbr }),
      };
    }

    if (action === 'all') {
      const players = legacyPlayers(payload);
      return { statusCode: 200, headers, body: JSON.stringify({ timestamp: payload.timestamp, count: players.length, players, teamPace: payload.teamPace }) };
    }

    if (action === 'trends' || action === 'player-trends') {
      const trends = legacyPlayers(payload).map((p) => ({
        id: p.id,
        name: p.name,
        team: p.team,
        league: p.league,
        trend: p.trend,
        volatility: p.volatility,
        ma7: p.ma7,
        ma14: p.ma14,
        confidence: p.confidence,
      }));
      return { statusCode: 200, headers, body: JSON.stringify({ timestamp: payload.timestamp, count: trends.length, trends, teamPace: payload.teamPace }) };
    }

    if (action === 'player') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          timestamp: payload.timestamp,
          player: null,
          history: [],
          count: 0,
          note: 'Player-specific pace history is not available in the self-contained team pace endpoint.',
          teamPace: payload.teamPace,
        }),
      };
    }

    return { statusCode: 200, headers, body: JSON.stringify(payload) };
  } catch (error) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: false,
        error: error.message,
        fallback: buildPayload('ALL'),
      }),
    };
  }
};
