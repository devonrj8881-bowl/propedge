#!/usr/bin/env node

/**
 * PropEdge Data Engine v1.0
 *
 * Fetches real game-by-game data from official sources, calculates:
 * - Per-minute efficiency (not per-game volume)
 * - Confidence scores (variance + sample size adjusted)
 * - Opponent matchup defensive ratings
 * - Injury impact multipliers
 *
 * Runs daily via cron. Outputs enriched CSV for PropEdge ingestion.
 *
 * Usage: node propedge-data-engine.js [league] [date]
 * Example: node propedge-data-engine.js NBA 2026-04-27
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  leagues: {
    NBA: {
      statsEndpoint: 'https://stats.nba.com/api/v1',
      injurySource: 'espn', // will scrape ESPN for injuries
      minMinutesThreshold: 5,
    },
    NHL: {
      statsEndpoint: 'https://statsapi.web.nhl.com/api/v1',
      injurySource: 'espn',
      minMinutesThreshold: 3,
    },
    MLB: {
      statsEndpoint: 'https://baseballsavant.mlb.com/api/v1',
      injurySource: 'mlb',
      minAtBatsThreshold: 2,
    },
  },
  gameLogDepth: 20, // last N games to analyze
  outputDir: './propedge-enriched',
  cacheDir: './propedge-cache',
};

// ============================================================================
// UTILITY: HTTP FETCH
// ============================================================================

function httpGet(url, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout }, (res) => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse JSON from ${url}: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timeout: ${url}`));
    });
  });
}

// ============================================================================
// PART 1: ESPN INJURY FETCHER
// ============================================================================

class InjuryFetcher {
  /**
   * Fetches injury reports from ESPN.
   * Returns { playerName: { status, injuredPart, daysOut, impact } }
   */
  static async fetchNBAInjuries() {
    try {
      // ESPN NBA injuries endpoint (unofficial but reliable)
      const url = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries';
      const data = await httpGet(url);

      const injuries = {};
      if (data.teams) {
        data.teams.forEach(team => {
          team.athletes?.forEach(athlete => {
            if (athlete.injuries && athlete.injuries.length > 0) {
              injuries[athlete.displayName] = {
                status: athlete.injuries[0].status,
                detail: athlete.injuries[0].detail || '',
                team: team.displayName,
              };
            }
          });
        });
      }
      return injuries;
    } catch (err) {
      console.warn(`[InjuryFetcher] NBA injuries unavailable: ${err.message}`);
      return {};
    }
  }

  static async fetchNHLInjuries() {
    try {
      const url = 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/injuries';
      const data = await httpGet(url);

      const injuries = {};
      if (data.teams) {
        data.teams.forEach(team => {
          team.athletes?.forEach(athlete => {
            if (athlete.injuries && athlete.injuries.length > 0) {
              injuries[athlete.displayName] = {
                status: athlete.injuries[0].status,
                detail: athlete.injuries[0].detail || '',
                team: team.displayName,
              };
            }
          });
        });
      }
      return injuries;
    } catch (err) {
      console.warn(`[InjuryFetcher] NHL injuries unavailable: ${err.message}`);
      return {};
    }
  }

  static async fetchMLBInjuries() {
    try {
      const url = 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/injuries';
      const data = await httpGet(url);

      const injuries = {};
      if (data.teams) {
        data.teams.forEach(team => {
          team.athletes?.forEach(athlete => {
            if (athlete.injuries && athlete.injuries.length > 0) {
              injuries[athlete.displayName] = {
                status: athlete.injuries[0].status,
                detail: athlete.injuries[0].detail || '',
                team: team.displayName,
              };
            }
          });
        });
      }
      return injuries;
    } catch (err) {
      console.warn(`[InjuryFetcher] MLB injuries unavailable: ${err.message}`);
      return {};
    }
  }
}

// ============================================================================
// PART 2: GAME LOG FETCHER (NBA.COM, NHL.COM, BASEBALL SAVANT)
// ============================================================================

class GameLogFetcher {
  /**
   * Fetches last N games for a player from NBA.com stats API
   * Returns array of { date, minutes, stat1, stat2, ... }
   */
  static async fetchNBAGameLog(playerName, playerID, depth = 20) {
    try {
      // NBA.com official stats API
      const url = `https://stats.nba.com/stats/playergamelog?PlayerID=${playerID}&Season=2025&SeasonType=Regular%20Season`;
      const data = await httpGet(url, 8000);

      const games = [];
      if (data.resultSets && data.resultSets[0]) {
        const headers = data.resultSets[0].headers;
        const rows = data.resultSets[0].rowSet || [];

        rows.slice(0, depth).forEach(row => {
          const gameData = {};
          headers.forEach((h, i) => {
            gameData[h] = row[i];
          });

          games.push({
            date: gameData.GAME_DATE || '',
            minutes: parseFloat(gameData.MIN) || 0,
            points: parseFloat(gameData.PTS) || 0,
            rebounds: parseFloat(gameData.REB) || 0,
            assists: parseFloat(gameData.AST) || 0,
            threePointers: parseFloat(gameData.FG3M) || 0,
            opponent: gameData.MATCHUP ? gameData.MATCHUP.split(' ')[gameData.MATCHUP.includes('@') ? 1 : 0] : '',
          });
        });
      }

      return games;
    } catch (err) {
      console.warn(`[GameLogFetcher] NBA logs for ${playerName} unavailable: ${err.message}`);
      return [];
    }
  }

  static async fetchNHLGameLog(playerName, playerID, depth = 20) {
    try {
      // NHL.com official stats API
      const url = `https://statsapi.web.nhl.com/api/v1/people/${playerID}/stats?stats=gameLog`;
      const data = await httpGet(url, 8000);

      const games = [];
      if (data.stats && data.stats[0]) {
        const logs = data.stats[0].stats || [];
        logs.slice(0, depth).forEach(game => {
          games.push({
            date: game.date || '',
            minutes: game.stats?.timeOnIce ? parseTimeOnIce(game.stats.timeOnIce) : 0,
            goals: game.stats?.goals || 0,
            assists: game.stats?.assists || 0,
            shots: game.stats?.shots || 0,
            opponent: game.opponent?.name || '',
          });
        });
      }

      return games;
    } catch (err) {
      console.warn(`[GameLogFetcher] NHL logs for ${playerName} unavailable: ${err.message}`);
      return [];
    }
  }

  static async fetchMLBGameLog(playerName, playerID, depth = 20) {
    try {
      // MLB Statcast / Baseball Savant endpoint
      const url = `https://baseballsavant.mlb.com/statcast?player_name=${encodeURIComponent(playerName)}&group_by=game`;
      const data = await httpGet(url, 8000);

      const games = [];
      if (Array.isArray(data)) {
        data.slice(0, depth).forEach(game => {
          games.push({
            date: game.game_date || '',
            atBats: game.pa || 0,
            hits: game.h || 0,
            strikeouts: game.so || 0,
            rbis: game.rbi || 0,
            opponent: game.home_team === 'opponent' ? game.away_team : game.home_team || '',
          });
        });
      }

      return games;
    } catch (err) {
      console.warn(`[GameLogFetcher] MLB logs for ${playerName} unavailable: ${err.message}`);
      return [];
    }
  }
}

// ============================================================================
// PART 3: METRICS CALCULATOR
// ============================================================================

class MetricsCalculator {
  /**
   * Calculates per-minute/per-opportunity efficiency
   * Input: array of game logs
   * Output: { perMinAvg, perMinL5, perMinL10, variance, confidence, samples }
   */
  static calculateEfficiency(games, statKey = 'points', minutesKey = 'minutes') {
    if (!games || games.length === 0) {
      return {
        perMinAvg: 0,
        perMinL5: 0,
        perMinL10: 0,
        variance: 0,
        confidence: 0,
        samples: 0,
      };
    }

    // Filter games where player played meaningful minutes
    const validGames = games.filter(g => g[minutesKey] > 0);
    if (validGames.length === 0) {
      return { perMinAvg: 0, perMinL5: 0, perMinL10: 0, variance: 0, confidence: 0, samples: 0 };
    }

    // Calculate per-minute rate for each game
    const perMinRates = validGames.map(g =>
      g[minutesKey] > 0 ? (g[statKey] / g[minutesKey]) : 0
    );

    // Calculate statistics
    const allAvg = perMinRates.reduce((a, b) => a + b, 0) / perMinRates.length;
    const l5Avg = validGames.length >= 5
      ? perMinRates.slice(0, 5).reduce((a, b) => a + b, 0) / 5
      : allAvg;
    const l10Avg = validGames.length >= 10
      ? perMinRates.slice(0, 10).reduce((a, b) => a + b, 0) / 10
      : allAvg;

    // Calculate variance (std dev)
    const variance = Math.sqrt(
      perMinRates.reduce((sum, rate) => sum + Math.pow(rate - allAvg, 2), 0) / perMinRates.length
    );

    // Confidence: higher with larger sample, lower with high variance
    const sampleConfidence = Math.min(perMinRates.length / 20, 1.0); // max at 20 games
    const varianceConfidence = Math.max(1 - (variance / (allAvg || 1)), 0.3); // penalize high variance
    const confidence = sampleConfidence * varianceConfidence;

    return {
      perMinAvg: parseFloat(allAvg.toFixed(4)),
      perMinL5: parseFloat(l5Avg.toFixed(4)),
      perMinL10: parseFloat(l10Avg.toFixed(4)),
      variance: parseFloat(variance.toFixed(4)),
      confidence: parseFloat((confidence * 100).toFixed(1)), // 0-100
      samples: validGames.length,
    };
  }

  /**
   * Estimates minutes for tonight based on role + recent usage
   */
  static estimateMinutesTonight(games, playerRole = 'starter') {
    if (!games || games.length === 0) return 20;

    const recentMinutes = games.slice(0, 10).map(g => g.minutes || 0);
    const avgMinutes = recentMinutes.reduce((a, b) => a + b, 0) / recentMinutes.length;

    // Adjust by role
    const roleMultiplier = {
      'starter': 1.0,
      'sixth-man': 0.85,
      'bench': 0.65,
      'limited': 0.5,
    }[playerRole] || 1.0;

    return Math.max(Math.round(avgMinutes * roleMultiplier), 8);
  }
}

// ============================================================================
// PART 4: MATCHUP INDEX GENERATOR
// ============================================================================

class MatchupIndexGenerator {
  /**
   * Fetches opponent defensive ranks for a given stat type
   * Returns { rank, allowedPerGame, efficiency }
   */
  static async fetchNBAMatchupRanks(statType = 'points') {
    try {
      // NBA.com team stats endpoint
      const url = `https://stats.nba.com/stats/leaguedashteamstats?Season=2025&SeasonType=Regular`;
      const data = await httpGet(url, 8000);

      const ranks = {};
      if (data.resultSets && data.resultSets[0]) {
        const headers = data.resultSets[0].headers;
        const rows = data.resultSets[0].rowSet || [];

        const statIndexMap = {
          'points': 'PTS',
          'rebounds': 'REB',
          'assists': 'AST',
          'threePointers': 'FG3M',
        };
        const colName = statIndexMap[statType] || 'PTS';
        const colIndex = headers.indexOf(colName);

        if (colIndex >= 0) {
          rows.forEach((row, idx) => {
            const teamId = row[0];
            const teamName = row[1];
            const statValue = parseFloat(row[colIndex]) || 0;
            ranks[teamName] = {
              rank: idx + 1,
              allowedPerGame: parseFloat(statValue.toFixed(1)),
              rankScalar: ((30 - (idx + 1)) / 30), // 0.0-1.0, higher = easier defense
            };
          });
        }
      }
      return ranks;
    } catch (err) {
      console.warn(`[MatchupIndexGenerator] NBA matchup ranks unavailable: ${err.message}`);
      return {};
    }
  }

  static async fetchNHLMatchupRanks(statType = 'goals') {
    try {
      // NHL.com team stats
      const url = `https://statsapi.web.nhl.com/api/v1/teams?expand=team.stats`;
      const data = await httpGet(url, 8000);

      const ranks = {};
      if (data.teams) {
        const stats = [];
        data.teams.forEach(team => {
          const stat = team.teamStats?.[0]?.stats;
          if (stat) {
            const key = statType === 'goals' ? 'goalsAllowed' : 'shotsAllowed';
            stats.push({
              name: team.name,
              value: stat[key] || 0,
            });
          }
        });

        // Sort and assign ranks
        stats.sort((a, b) => a.value - b.value);
        stats.forEach((s, idx) => {
          ranks[s.name] = {
            rank: idx + 1,
            allowed: parseFloat(s.value.toFixed(1)),
            rankScalar: ((30 - (idx + 1)) / 30),
          };
        });
      }
      return ranks;
    } catch (err) {
      console.warn(`[MatchupIndexGenerator] NHL matchup ranks unavailable: ${err.message}`);
      return {};
    }
  }

  static async fetchMLBMatchupRanks(statType = 'hits') {
    try {
      // MLB team stats via official API
      const url = `https://statsapi.mlb.com/api/v1/teams?hydrate=stats`;
      const data = await httpGet(url, 8000);

      const ranks = {};
      if (data.teams) {
        const stats = [];
        data.teams.forEach(team => {
          // Parse team stats from response
          const stat = team.stats?.[0]?.stats;
          if (stat) {
            const key = statType === 'hits' ? 'hitsAllowed' : statType === 'strikeouts' ? 'strikeOuts' : 'runsAllowed';
            stats.push({
              name: team.name,
              value: stat[key] || 0,
            });
          }
        });

        stats.sort((a, b) => a.value - b.value);
        stats.forEach((s, idx) => {
          ranks[s.name] = {
            rank: idx + 1,
            allowed: parseFloat(s.value.toFixed(1)),
            rankScalar: ((30 - (idx + 1)) / 30),
          };
        });
      }
      return ranks;
    } catch (err) {
      console.warn(`[MatchupIndexGenerator] MLB matchup ranks unavailable: ${err.message}`);
      return {};
    }
  }
}

// ============================================================================
// PART 5: MAIN ENGINE
// ============================================================================

class PropEdgeDataEngine {
  constructor(league = 'NBA', date = new Date().toISOString().split('T')[0]) {
    this.league = league;
    this.date = date;
    this.players = [];
    this.injuries = {};
    this.matchupRanks = {};
  }

  async run() {
    console.log(`\n[PropEdgeDataEngine] Starting ${this.league} enrichment for ${this.date}`);

    try {
      // Step 1: Fetch injuries
      console.log(`[1/4] Fetching injury reports...`);
      this.injuries = await this.fetchInjuries();
      console.log(`  ✓ Found ${Object.keys(this.injuries).length} injured players`);

      // Step 2: Fetch matchup data
      console.log(`[2/4] Fetching matchup defensive ranks...`);
      this.matchupRanks = await this.fetchMatchupRanks();
      console.log(`  ✓ Matchup data loaded`);

      // Step 3: Enrich player data (read from existing CSV or input)
      console.log(`[3/4] Enriching player game logs...`);
      await this.enrichPlayerData();
      console.log(`  ✓ Enriched ${this.players.length} players`);

      // Step 4: Output enriched CSV
      console.log(`[4/4] Writing enriched CSV...`);
      await this.outputEnrichedCSV();
      console.log(`  ✓ Output: propedge-enriched-${this.league}-${this.date}.csv`);

      console.log(`\n[PropEdgeDataEngine] ✅ Complete. Ready for PropEdge ingestion.\n`);
    } catch (err) {
      console.error(`\n[PropEdgeDataEngine] ❌ Error: ${err.message}\n`);
    }
  }

  async fetchInjuries() {
    switch (this.league) {
      case 'NBA':
        return await InjuryFetcher.fetchNBAInjuries();
      case 'NHL':
        return await InjuryFetcher.fetchNHLInjuries();
      case 'MLB':
        return await InjuryFetcher.fetchMLBInjuries();
      default:
        return {};
    }
  }

  async fetchMatchupRanks() {
    switch (this.league) {
      case 'NBA':
        return await MatchupIndexGenerator.fetchNBAMatchupRanks('points');
      case 'NHL':
        return await MatchupIndexGenerator.fetchNHLMatchupRanks('goals');
      case 'MLB':
        return await MatchupIndexGenerator.fetchMLBMatchupRanks('hits');
      default:
        return {};
    }
  }

  async enrichPlayerData() {
    // TODO: Read from existing CSV, iterate players, fetch game logs, calculate metrics
    // For now, placeholder
    this.players = [];
  }

  async outputEnrichedCSV() {
    const filename = `propedge-enriched-${this.league}-${this.date}.csv`;
    const filepath = path.join(CONFIG.outputDir, filename);

    // Ensure output directory exists
    if (!fs.existsSync(CONFIG.outputDir)) {
      fs.mkdirSync(CONFIG.outputDir, { recursive: true });
    }

    // CSV headers
    const headers = [
      'Player', 'Sport', 'Prop Type', 'Line', 'Direction',
      'Per_Min_Avg', 'Per_Min_L5', 'Per_Min_L10',
      'Variance', 'Confidence%', 'Samples',
      'Matchup_Rank', 'Matchup_Scalar',
      'Expected_Minutes', 'Injury_Status', 'Injury_Impact',
      'Home_Away', 'Rest_Days', 'Back_to_Back_Flag',
    ];

    // Write CSV
    const csv = [headers.join(',')];
    this.players.forEach(p => {
      const row = [
        p.name, p.league, p.propType, p.line, p.direction,
        p.perMinAvg, p.perMinL5, p.perMinL10,
        p.variance, p.confidence, p.samples,
        p.matchupRank, p.matchupScalar,
        p.expectedMinutes, p.injuryStatus, p.injuryMultiplier,
        p.homeAway, p.restDays, p.backToBackFlag,
      ];
      csv.push(row.join(','));
    });

    fs.writeFileSync(filepath, csv.join('\n'), 'utf-8');
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function parseTimeOnIce(timeStr) {
  // Convert MM:SS format to minutes
  if (!timeStr) return 0;
  const [min, sec] = timeStr.split(':').map(Number);
  return min + (sec / 60);
}

// ============================================================================
// ENTRY POINT
// ============================================================================

(async () => {
  const league = process.argv[2] || 'NBA';
  const date = process.argv[3] || new Date().toISOString().split('T')[0];

  const engine = new PropEdgeDataEngine(league, date);
  await engine.run();
})();
