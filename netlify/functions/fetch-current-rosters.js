/**
 * PropEdge Current Rosters Fetcher
 *
 * Fetches current rosters, trades, and roster transactions from ESPN/official sources
 * Returns authoritative current roster data for all leagues (NBA, NHL, MLB)
 *
 * Sources:
 * - ESPN API (team rosters, injury reports)
 * - Official league data (trades, transactions)
 */

const https = require("https");

const ROSTER_CACHE = new Map();
const CACHE_TTL_MS = 3600000; // 1 hour
const FETCH_TIMEOUT_MS = 5000;

// ESPN endpoints for rosters
const ESPN_BASE_ENDPOINTS = {
  NBA: "https://site.api.espn.com/apis/site/v2/sports/basketball/nba",
  NHL: "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl",
  MLB: "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb",
};

function getCacheKey(league) {
  return `rosters|${league}|${new Date().toISOString().split("T")[0]}`;
}

function getCachedRosters(league) {
  const key = getCacheKey(league);
  const cached = ROSTER_CACHE.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }
  ROSTER_CACHE.delete(key);
  return null;
}

function setCachedRosters(league, data) {
  const key = getCacheKey(league);
  ROSTER_CACHE.set(key, { data, timestamp: Date.now() });
}

function extractInjuryInfo(athlete) {
  const raw = athlete?.injuryStatus || athlete?.injury || athlete?.status || {};
  const injuries = Array.isArray(athlete?.injuries) ? athlete.injuries : [];
  const firstInjury = injuries[0] || {};
  const statusText = String(
    raw.displayName ||
    raw.name ||
    raw.type ||
    raw.description ||
    firstInjury.status ||
    firstInjury.type ||
    firstInjury.detail ||
    ""
  ).trim();
  const detail = String(firstInjury.detail || firstInjury.shortComment || raw.detail || raw.description || "").trim();
  const activeFlag = raw.isActive;
  const activeStatus = /^active$/i.test(statusText) || activeFlag === true;
  const injured = !activeStatus && (
    activeFlag === false ||
    injuries.length > 0 ||
    /out|injur|questionable|doubtful|day.to.day|ir|inactive/i.test(`${statusText} ${detail}`)
  );
  return {
    injured,
    injuryStatus: statusText || (injured ? "injured" : ""),
    injuryDetail: detail,
  };
}

async function fetchUrl(url, timeoutMs = FETCH_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      req.abort();
      reject(new Error(`Timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    const req = https.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        clearTimeout(timer);
        if (res.statusCode === 200) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });

    req.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function fetchEspnRosters(league, focusTeams = null) {
  try {
    const cached = getCachedRosters(league);
    if (cached) {
      console.log(`${league} rosters from cache`);
      return cached;
    }

    const baseEndpoint = ESPN_BASE_ENDPOINTS[league];
    if (!baseEndpoint) {
      console.warn(`No endpoint for ${league}`);
      return {};
    }

    // Step 1: Get list of teams
    console.log(`Fetching ${league} teams list from ${baseEndpoint}/teams`);
    const teamsResponse = await fetchUrl(`${baseEndpoint}/teams`);
    const teamsData = JSON.parse(teamsResponse);

    if (!teamsData.sports?.[0]?.leagues?.[0]?.teams) {
      console.warn(`${league}: No teams found in ESPN response`);
      return {};
    }

    let teamsList = teamsData.sports[0].leagues[0].teams;
    const focusSet = Array.isArray(focusTeams) && focusTeams.length
      ? new Set(focusTeams.map((t) => String(t).toUpperCase()))
      : null;
    if (focusSet) {
      teamsList = teamsList.filter((teamWrapper) => {
        const team = teamWrapper.team || teamWrapper;
        return focusSet.has(String(team.abbreviation || "").toUpperCase());
      });
    }
    const teamCount = teamsList.length;
    console.log(`${league}: Found ${teamCount} teams${focusSet ? " after focus-team filter" : ""}`);

    const rosters = {};

    // Step 2: Fetch roster for each team
    for (const teamWrapper of teamsList) {
      const team = teamWrapper.team || teamWrapper;
      const teamId = team.id || team.uid;
      const teamKey = team.abbreviation || team.slug || team.displayName;

      if (!teamId) {
        console.warn(`${league}: Team missing ID - ${teamKey}`);
        continue;
      }

      try {
        const rosterUrl = `${baseEndpoint}/teams/${teamId}/roster`;
        const rosterResponse = await fetchUrl(rosterUrl);
        const rosterData = JSON.parse(rosterResponse);

        rosters[teamKey] = {
          name: team.displayName || team.name,
          abbreviation: team.abbreviation,
          roster: [],
        };

        if (rosterData.athletes && Array.isArray(rosterData.athletes)) {
          let playerCount = 0;

          // Handle different roster formats
          for (const athleteGroup of rosterData.athletes) {
            // NBA/MLB format: flat array of athletes
            if (athleteGroup.displayName) {
              if (playerCount < 15) {
                const injuryInfo = extractInjuryInfo(athleteGroup);
                rosters[teamKey].roster.push({
                  name: athleteGroup.displayName,
                  position: athleteGroup.position?.abbreviation || athleteGroup.position?.name || "",
                  ...injuryInfo,
                });
                playerCount++;
              }
            }
            // NHL format: grouped by position with items array
            else if (athleteGroup.items && Array.isArray(athleteGroup.items)) {
              for (const athlete of athleteGroup.items) {
                if (playerCount >= 15) break;
                if (athlete.displayName) {
                  const injuryInfo = extractInjuryInfo(athlete);
                  rosters[teamKey].roster.push({
                    name: athlete.displayName,
                    position: athleteGroup.position || "",
                    ...injuryInfo,
                  });
                  playerCount++;
                }
              }
            }
          }

          if (playerCount > 0) {
            console.log(`${league} ${teamKey}: ${playerCount} players extracted`);
          } else {
            console.warn(`${league} ${teamKey}: No athletes in roster`);
          }
        } else {
          console.warn(`${league} ${teamKey}: No athletes array in roster`);
        }
      } catch (teamError) {
        console.warn(`${league} ${teamKey}: Failed to fetch roster - ${teamError.message}`);
      }
    }

    console.log(`${league} rosters complete: ${Object.keys(rosters).length} teams with data`);
    setCachedRosters(league, rosters);
    return rosters;
  } catch (error) {
    console.error(`Error fetching ${league} rosters:`, error.message, error.stack);
    return {};
  }
}

async function fetchAllRosters() {
  const rosters = {
    NBA: await fetchEspnRosters("NBA"),
    NHL: await fetchEspnRosters("NHL"),
    MLB: await fetchEspnRosters("MLB"),
  };
  return rosters;
}

function formatRostersForContext(rosters) {
  if (!rosters) return "";

  const formatted = [];

  Object.entries(rosters).forEach(([league, teamData]) => {
    if (!teamData) return;

    formatted.push(`${league} Rosters:`);

    Object.entries(teamData).forEach(([teamKey, team]) => {
      if (team.roster && Array.isArray(team.roster) && team.roster.length > 0) {
        const active = team.roster.filter((p) => !p.injured);
        const injured = team.roster.filter((p) => p.injured);

        let teamInfo = `${team.abbreviation}: ${active.map((p) => p.name).join(", ")}`;
        if (injured.length > 0) {
          teamInfo += ` | Injured: ${injured.map((p) => `${p.name}${p.injuryStatus ? ` (${p.injuryStatus})` : ""}`).join(", ")}`;
        }
        formatted.push(teamInfo);
      }
    });
  });

  return formatted.join("\n");
}

exports.fetchAllRosters = fetchAllRosters;
exports.fetchEspnRosters = fetchEspnRosters;
exports.formatRostersForContext = formatRostersForContext;
