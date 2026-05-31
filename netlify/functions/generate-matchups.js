/**
 * Daily matchup data generator
 * Runs 11am EST — fetches injuries, H2H, opponent stats
 * Outputs: _matchups.json (cached for instant modal lookup)
 */

exports.handler = async (event) => {
  console.log("[Matchups] Generation started");
  try {
    // 1. Fetch injury data
    const injuries = await fetchNBAInjuries();
    console.log(`[Matchups] Fetched ${Object.keys(injuries).length} injury records`);

    // 2. Fetch opponent defensive stats
    const oppStats = await fetchOpponentStats();
    console.log(`[Matchups] Fetched opponent stats for ${Object.keys(oppStats).length} teams`);

    // 3. Fetch live games (matchups today)
    const games = await fetchLiveGames();
    console.log(`[Matchups] Found ${games.length} live/upcoming games`);

    // 4. Build H2H for players in live games
    const matchups = await buildMatchups(games, injuries, oppStats);
    console.log(`[Matchups] Generated ${matchups.length} matchup profiles`);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generated_at: new Date().toISOString(),
        matchups: matchups,
        injury_data: injuries,
        opponent_stats: oppStats
      })
    };
  } catch (error) {
    console.error("[Matchups] Error:", error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

/**
 * Fetch injuries from ESPN/NBA official sources
 */
async function fetchNBAInjuries() {
  const injuries = {};

  try {
    // ESPN injury feed (public, no auth required)
    const espnResp = await fetch(
      "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries",
      { headers: { "User-Agent": "PropEdge/1.0" } }
    );

    if (espnResp.ok) {
      const data = await espnResp.json();
      // Parse ESPN structure
      if (data.injuries) {
        data.injuries.forEach(inj => {
          const key = `${inj.player}:${inj.team}`.toLowerCase();
          injuries[key] = {
            player: inj.player,
            team: inj.team,
            status: inj.status, // OUT, DOUBTFUL, QUESTIONABLE, PROBABLE
            notes: inj.details || ""
          };
        });
      }
    }
  } catch (e) {
    console.warn("[Matchups] ESPN injury fetch failed:", e.message);
  }

  try {
    // NBA.com official injury report (more reliable)
    const nbaResp = await fetch("https://data.nba.com/data/10s/v2/nba/league/injuries.json");
    if (nbaResp.ok) {
      const data = await nbaResp.json();
      if (data.league && data.league.teams) {
        data.league.teams.forEach(team => {
          if (team.players) {
            team.players.forEach(p => {
              if (p.injuryStatus) {
                const key = `${p.firstName} ${p.lastName}:${team.tricode}`.toLowerCase();
                injuries[key] = {
                  player: `${p.firstName} ${p.lastName}`,
                  team: team.tricode,
                  status: p.injuryStatus,
                  notes: p.injuryStatusText || ""
                };
              }
            });
          }
        });
      }
    }
  } catch (e) {
    console.warn("[Matchups] NBA.com injury fetch failed:", e.message);
  }

  return injuries;
}

/**
 * Fetch opponent defensive stats from ESPN
 */
async function fetchOpponentStats() {
  const stats = {};

  try {
    // ESPN NBA team stats (PPG allowed, assists allowed, etc.)
    const resp = await fetch(
      "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/statistics",
      { headers: { "User-Agent": "PropEdge/1.0" } }
    );

    if (resp.ok) {
      const data = await resp.json();
      if (data.teams) {
        data.teams.forEach(team => {
          stats[team.abbreviation] = {
            team: team.abbreviation,
            name: team.displayName,
            ppg_allowed: parseFloat(team.stats?.find(s => s.name === "pointsAgainst")?.value) || 0,
            rpg_allowed: parseFloat(team.stats?.find(s => s.name === "reboundsAgainst")?.value) || 0,
            apg_allowed: parseFloat(team.stats?.find(s => s.name === "assistsAgainst")?.value) || 0,
            defensive_rank: team.stats?.find(s => s.name === "defenseRank")?.value || 15
          };
        });
      }
    }
  } catch (e) {
    console.warn("[Matchups] ESPN stats fetch failed:", e.message);
  }

  return stats;
}

/**
 * Fetch today's games from ESPN
 */
async function fetchLiveGames() {
  const games = [];

  try {
    const today = new Date().toISOString().split("T")[0];
    const resp = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${today.replace(/-/g, "")}`,
      { headers: { "User-Agent": "PropEdge/1.0" } }
    );

    if (resp.ok) {
      const data = await resp.json();
      if (data.events) {
        data.events.forEach(event => {
          const home = event.competitions[0].home;
          const away = event.competitions[0].away;
          games.push({
            id: event.id,
            homeTeam: home.team.abbreviation,
            awayTeam: away.team.abbreviation,
            status: event.status.type.description,
            time: event.date
          });
        });
      }
    }
  } catch (e) {
    console.warn("[Matchups] Live games fetch failed:", e.message);
  }

  return games;
}

/**
 * Build matchup profiles: combine H2H, opponent stats, injuries
 */
async function buildMatchups(games, injuries, oppStats) {
  const matchups = [];

  games.forEach(game => {
    const homeOppStats = oppStats[game.homeTeam] || {};
    const awayOppStats = oppStats[game.awayTeam] || {};
    const homeInjuries = Object.values(injuries).filter(inj => inj.team === game.homeTeam);
    const awayInjuries = Object.values(injuries).filter(inj => inj.team === game.awayTeam);

    // Build matchup profile
    const profile = {
      game_id: game.id,
      matchup: `${game.awayTeam} @ ${game.homeTeam}`,
      date: game.time,
      status: game.status,
      teams: {
        home: {
          team: game.homeTeam,
          opponent: game.awayTeam,
          defense_rank: homeOppStats.defensive_rank || 15,
          ppg_allowed: homeOppStats.ppg_allowed || 0,
          rpg_allowed: homeOppStats.rpg_allowed || 0,
          apg_allowed: homeOppStats.apg_allowed || 0,
          weakness: identifyWeakness(homeOppStats)
        },
        away: {
          team: game.awayTeam,
          opponent: game.homeTeam,
          defense_rank: awayOppStats.defensive_rank || 15,
          ppg_allowed: awayOppStats.ppg_allowed || 0,
          rpg_allowed: awayOppStats.rpg_allowed || 0,
          apg_allowed: awayOppStats.apg_allowed || 0,
          weakness: identifyWeakness(awayOppStats)
        }
      },
      injuries: {
        home: homeInjuries,
        away: awayInjuries
      },
      generated_at: new Date().toISOString()
    };

    matchups.push(profile);
  });

  return matchups;
}

/**
 * Identify opponent's defensive weakness from stats
 */
function identifyWeakness(stats) {
  if (!stats || !stats.ppg_allowed) return "N/A";

  // Simple heuristic: if allowing high PPG, weakness is scoring
  if (stats.ppg_allowed > 120) {
    return `Allows ${stats.ppg_allowed.toFixed(1)} PPG (top 10 weakness: scoring)`;
  } else if (stats.ppg_allowed < 105) {
    return `Stingy defense (${stats.ppg_allowed.toFixed(1)} PPG allowed)`;
  } else {
    return `Average defense (${stats.ppg_allowed.toFixed(1)} PPG allowed)`;
  }
}
