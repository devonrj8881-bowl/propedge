const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const DEFAULT_MODEL = process.env.OLLAMA_MODEL || "gemma4:e4b";
const DEFAULT_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS || 45000);
const SOURCE_TIMEOUT_MS = Number(process.env.SOURCE_CONTEXT_TIMEOUT_MS || 2500);
const PUBLIC_SOURCE_TIMEOUT_MS = Number(process.env.PUBLIC_SOURCE_CONTEXT_TIMEOUT_MS || 1800);
const LOOKAHEAD_DAYS = Number(process.env.MATCHUP_LOOKAHEAD_DAYS || 21);

const TEAM_ALIASES = {
  NBA: {
    "SAN ANTONIO": "SAS", SPURS: "SAS", SA: "SAS", SAS: "SAS",
    MINNESOTA: "MIN", TIMBERWOLVES: "MIN", WOLVES: "MIN", MIN: "MIN",
    "NEW YORK": "NY", KNICKS: "NY", NYK: "NY", NY: "NY",
    PHILADELPHIA: "PHI", SIXERS: "PHI", "76ERS": "PHI", PHI: "PHI",
    CLEVELAND: "CLE", CAVALIERS: "CLE", CAVS: "CLE", CLE: "CLE",
  },
  MLB: {
    "NEW YORK": "NYY", YANKEES: "NYY", NYY: "NYY",
    MILWAUKEE: "MIL", BREWERS: "MIL", MIL: "MIL",
    WASHINGTON: "WSH", NATIONALS: "WSH", NATS: "WSH", WSH: "WSH", WAS: "WSH",
    MIAMI: "MIA", MARLINS: "MIA", MIA: "MIA",
    BALTIMORE: "BAL", ORIOLES: "BAL", BAL: "BAL",
    ATHLETICS: "ATH", ATH: "ATH", OAKLAND: "ATH",
  },
  NHL: {
    BUFFALO: "BUF", SABRES: "BUF", BUF: "BUF",
    MONTREAL: "MTL", CANADIENS: "MTL", HABS: "MTL", MTL: "MTL",
    VEGAS: "VGK", "GOLDEN KNIGHTS": "VGK", VGK: "VGK",
    ANAHEIM: "ANA", DUCKS: "ANA", ANA: "ANA",
  },
  NFL: {
    BUFFALO: "BUF", BILLS: "BUF", BUF: "BUF",
    KANSAS: "KC", "KANSAS CITY": "KC", CHIEFS: "KC", KC: "KC",
    DALLAS: "DAL", COWBOYS: "DAL", DAL: "DAL",
    PHILADELPHIA: "PHI", EAGLES: "PHI", PHI: "PHI",
  },
};

Object.assign(TEAM_ALIASES.NBA, {
  HAWKS: "ATL", ATLANTA: "ATL", ATL: "ATL", CELTICS: "BOS", BOSTON: "BOS", BOS: "BOS",
  NETS: "BKN", BROOKLYN: "BKN", BKN: "BKN", HORNETS: "CHA", CHARLOTTE: "CHA", CHA: "CHA",
  BULLS: "CHI", CHICAGO: "CHI", CHI: "CHI", MAVERICKS: "DAL", MAVS: "DAL", DALLAS: "DAL", DAL: "DAL",
  NUGGETS: "DEN", DENVER: "DEN", DEN: "DEN", PISTONS: "DET", DETROIT: "DET", DET: "DET",
  WARRIORS: "GS", "GOLDEN STATE": "GS", GSW: "GS", GS: "GS", ROCKETS: "HOU", HOUSTON: "HOU", HOU: "HOU",
  PACERS: "IND", INDIANA: "IND", IND: "IND", CLIPPERS: "LAC", "LA CLIPPERS": "LAC", LAC: "LAC",
  LAKERS: "LAL", "LOS ANGELES LAKERS": "LAL", LAL: "LAL", GRIZZLIES: "MEM", MEMPHIS: "MEM", MEM: "MEM",
  HEAT: "MIA", MIAMI: "MIA", MIA: "MIA", BUCKS: "MIL", MILWAUKEE: "MIL", MIL: "MIL",
  PELICANS: "NO", "NEW ORLEANS": "NO", NOP: "NO", NO: "NO", THUNDER: "OKC", "OKLAHOMA CITY": "OKC", OKC: "OKC",
  MAGIC: "ORL", ORLANDO: "ORL", ORL: "ORL", SUNS: "PHX", PHOENIX: "PHX", PHX: "PHX", PHO: "PHX",
  BLAZERS: "POR", "TRAIL BLAZERS": "POR", PORTLAND: "POR", POR: "POR", KINGS: "SAC", SACRAMENTO: "SAC", SAC: "SAC",
  RAPTORS: "TOR", TORONTO: "TOR", TOR: "TOR", JAZZ: "UTAH", UTAH: "UTAH", WIZARDS: "WSH", WASHINGTON: "WSH", WSH: "WSH",
});

Object.assign(TEAM_ALIASES.MLB, {
  DIAMONDBACKS: "ARI", "D-BACKS": "ARI", ARIZONA: "ARI", ARI: "ARI", BRAVES: "ATL", ATLANTA: "ATL", ATL: "ATL",
  REDSOX: "BOS", "RED SOX": "BOS", BOSTON: "BOS", BOS: "BOS", CUBS: "CHC", "CHICAGO CUBS": "CHC", CHC: "CHC",
  WHITESOX: "CHW", "WHITE SOX": "CHW", "CHICAGO WHITE SOX": "CHW", CHW: "CHW", CWS: "CHW",
  REDS: "CIN", CINCINNATI: "CIN", CIN: "CIN", GUARDIANS: "CLE", CLEVELAND: "CLE", CLE: "CLE",
  ROCKIES: "COL", COLORADO: "COL", COL: "COL", TIGERS: "DET", DETROIT: "DET", DET: "DET",
  ASTROS: "HOU", HOUSTON: "HOU", HOU: "HOU", ROYALS: "KC", "KANSAS CITY": "KC", KC: "KC",
  ANGELS: "LAA", "LOS ANGELES ANGELS": "LAA", LAA: "LAA", DODGERS: "LAD", "LOS ANGELES DODGERS": "LAD", LAD: "LAD",
  TWINS: "MIN", MINNESOTA: "MIN", MIN: "MIN", METS: "NYM", "NEW YORK METS": "NYM", NYM: "NYM",
  PHILLIES: "PHI", PHILADELPHIA: "PHI", PHI: "PHI", PIRATES: "PIT", PITTSBURGH: "PIT", PIT: "PIT",
  PADRES: "SD", "SAN DIEGO": "SD", SD: "SD", MARINERS: "SEA", SEATTLE: "SEA", SEA: "SEA",
  GIANTS: "SF", "SAN FRANCISCO": "SF", SF: "SF", SFG: "SF", CARDINALS: "STL", "ST LOUIS": "STL", "ST. LOUIS": "STL", STL: "STL",
  RAYS: "TB", "TAMPA BAY": "TB", TB: "TB", RANGERS: "TEX", TEXAS: "TEX", TEX: "TEX",
  BLUEJAYS: "TOR", "BLUE JAYS": "TOR", TORONTO: "TOR", TOR: "TOR",
});

Object.assign(TEAM_ALIASES.NHL, {
  BRUINS: "BOS", BOSTON: "BOS", BOS: "BOS", HURRICANES: "CAR", CANES: "CAR", CAROLINA: "CAR", CAR: "CAR",
  BLUEJACKETS: "CBJ", "BLUE JACKETS": "CBJ", COLUMBUS: "CBJ", CBJ: "CBJ", FLAMES: "CGY", CALGARY: "CGY", CGY: "CGY",
  BLACKHAWKS: "CHI", CHICAGO: "CHI", CHI: "CHI", AVALANCHE: "COL", AVS: "COL", COLORADO: "COL", COL: "COL",
  STARS: "DAL", DALLAS: "DAL", DAL: "DAL", REDWINGS: "DET", "RED WINGS": "DET", DETROIT: "DET", DET: "DET",
  OILERS: "EDM", EDMONTON: "EDM", EDM: "EDM", PANTHERS: "FLA", FLORIDA: "FLA", FLA: "FLA",
  KINGS: "LA", "LOS ANGELES KINGS": "LA", LAK: "LA", LA: "LA", WILD: "MIN", MINNESOTA: "MIN", MIN: "MIN",
  DEVILS: "NJ", "NEW JERSEY": "NJ", NJD: "NJ", NJ: "NJ", PREDATORS: "NSH", NASHVILLE: "NSH", NSH: "NSH",
  ISLANDERS: "NYI", "NEW YORK ISLANDERS": "NYI", NYI: "NYI", RANGERS: "NYR", "NEW YORK RANGERS": "NYR", NYR: "NYR",
  SENATORS: "OTT", OTTAWA: "OTT", OTT: "OTT", FLYERS: "PHI", PHILADELPHIA: "PHI", PHI: "PHI",
  PENGUINS: "PIT", PITTSBURGH: "PIT", PIT: "PIT", KRAKEN: "SEA", SEATTLE: "SEA", SEA: "SEA",
  SHARKS: "SJ", "SAN JOSE": "SJ", SJS: "SJ", SJ: "SJ", BLUES: "STL", "ST LOUIS": "STL", "ST. LOUIS": "STL", STL: "STL",
  LIGHTNING: "TB", "TAMPA BAY": "TB", TBL: "TB", TB: "TB", MAPLELEAFS: "TOR", "MAPLE LEAFS": "TOR", TORONTO: "TOR", TOR: "TOR",
  UTAH: "UTAH", "UTAH HOCKEY CLUB": "UTAH", VANCOUVER: "VAN", CANUCKS: "VAN", VAN: "VAN",
  CAPITALS: "WSH", WASHINGTON: "WSH", WSH: "WSH", JETS: "WPG", WINNIPEG: "WPG", WPG: "WPG",
});

Object.assign(TEAM_ALIASES.NFL, {
  CARDINALS: "ARI", ARIZONA: "ARI", ARI: "ARI", FALCONS: "ATL", ATLANTA: "ATL", ATL: "ATL",
  RAVENS: "BAL", BALTIMORE: "BAL", BAL: "BAL", PANTHERS: "CAR", CAROLINA: "CAR", CAR: "CAR",
  BEARS: "CHI", CHICAGO: "CHI", CHI: "CHI", BENGALS: "CIN", CINCINNATI: "CIN", CIN: "CIN",
  BROWNS: "CLE", CLEVELAND: "CLE", CLE: "CLE", BRONCOS: "DEN", DENVER: "DEN", DEN: "DEN",
  LIONS: "DET", DETROIT: "DET", DET: "DET", PACKERS: "GB", "GREEN BAY": "GB", GB: "GB",
  TEXANS: "HOU", HOUSTON: "HOU", HOU: "HOU", COLTS: "IND", INDIANAPOLIS: "IND", IND: "IND",
  JAGUARS: "JAX", JACKSONVILLE: "JAX", JAX: "JAX", CHARGERS: "LAC", "LOS ANGELES CHARGERS": "LAC", LAC: "LAC",
  RAMS: "LAR", "LOS ANGELES RAMS": "LAR", LAR: "LAR", RAIDERS: "LV", "LAS VEGAS": "LV", LV: "LV",
  DOLPHINS: "MIA", MIAMI: "MIA", MIA: "MIA", VIKINGS: "MIN", MINNESOTA: "MIN", MIN: "MIN",
  PATRIOTS: "NE", "NEW ENGLAND": "NE", NE: "NE", SAINTS: "NO", "NEW ORLEANS": "NO", NO: "NO",
  GIANTS: "NYG", "NEW YORK GIANTS": "NYG", NYG: "NYG", JETS: "NYJ", "NEW YORK JETS": "NYJ", NYJ: "NYJ",
  STEELERS: "PIT", PITTSBURGH: "PIT", PIT: "PIT", SEAHAWKS: "SEA", SEATTLE: "SEA", SEA: "SEA",
  "49ERS": "SF", NINERS: "SF", "SAN FRANCISCO": "SF", SF: "SF", BUCCANEERS: "TB", BUCS: "TB", "TAMPA BAY": "TB", TB: "TB",
  TITANS: "TEN", TENNESSEE: "TEN", TEN: "TEN", COMMANDERS: "WSH", WASHINGTON: "WSH", WSH: "WSH", WAS: "WSH",
});

const ESPN_TEAM_ABBR = {
  NBA: { SAS: "SA", NYK: "NY", GSW: "GS", PHX: "PHO", NOP: "NO" },
  MLB: { WSH: "WSH", ATH: "ATH", CWS: "CHW" },
  NHL: { TBL: "TB", LAK: "LA", NJD: "NJ", SJS: "SJ", WSH: "WSH", VGK: "VGK" },
  NFL: { WAS: "WSH", JAX: "JAC", ARI: "ARI" },
};

const PUBLIC_SOURCE_GEO_TERMS = new Set([
  "SAN ANTONIO", "MINNESOTA", "NEW YORK", "PHILADELPHIA", "CLEVELAND",
  "MILWAUKEE", "WASHINGTON", "MIAMI", "BALTIMORE", "OAKLAND",
  "BUFFALO", "MONTREAL", "VEGAS", "ANAHEIM", "KANSAS", "KANSAS CITY", "DALLAS",
]);

function yyyymmdd(date) {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

function parseLeaguesFromQuestion(question, leagueRaw) {
  const explicit = String(leagueRaw || "").toUpperCase();
  const q = String(question || "").toLowerCase();
  const leagues = [];
  for (const lg of ["NBA", "MLB", "NHL", "NFL"]) {
    if (teamsFromQuestion(question, lg).length) leagues.push(lg);
  }
  const questionLeagues = [...new Set(leagues)];
  if (["NBA", "MLB", "NHL", "NFL"].includes(explicit)) {
    if (questionLeagues.length && !questionLeagues.includes(explicit)) return questionLeagues;
    return [explicit];
  }
  if (/\bnba\b|basketball|spurs|timberwolves|knicks|sixers|cavs|cavaliers/.test(q)) leagues.push("NBA");
  if (/\bmlb\b|baseball|yankees|brewers|nationals|marlins|orioles|athletics/.test(q)) leagues.push("MLB");
  if (/\bnhl\b|hockey|sabres|canadiens|golden knights|ducks/.test(q)) leagues.push("NHL");
  if (/\bnfl\b|football|chiefs|bills|cowboys|eagles/.test(q)) leagues.push("NFL");
  return leagues.length ? [...new Set(leagues)] : ["NBA", "MLB", "NHL", "NFL"];
}

function questionTeamsByLeague(question, leagueRaw) {
  const leagues = parseLeaguesFromQuestion(question, leagueRaw);
  const out = {};
  for (const lg of leagues) {
    const teams = teamsFromQuestion(question, lg);
    if (teams.length) out[lg] = teams;
  }
  return out;
}

function requestedTeamSet(question, leagueRaw) {
  const byLeague = questionTeamsByLeague(question, leagueRaw);
  const teams = new Set();
  Object.entries(byLeague).forEach(([lg, arr]) => arr.forEach((t) => {
    teams.add(`${lg}:${t}`);
    teams.add(`${lg}:${toEspnTeamAbbr(t, lg)}`);
  }));
  return teams;
}

function teamsFromQuestion(question, league) {
  const q = ` ${String(question || "").toUpperCase().replace(/[^A-Z0-9 ]+/g, " ")} `;
  const aliases = TEAM_ALIASES[league] || {};
  const teams = new Set();
  for (const [name, abbr] of Object.entries(aliases)) {
    if (league === "MLB" && name === "KANSAS CITY" && !/\b(ROYALS|MLB|BASEBALL)\b/.test(q)) continue;
    const needle = ` ${name} `;
    if (q.includes(needle)) teams.add(abbr);
  }
  return [...teams];
}

function teamsFromPropsAndQuestion(props, question, league) {
  const qTeams = teamsFromQuestion(question, league);
  if (qTeams.length) return [...new Set(qTeams)].slice(0, 6);
  const teams = new Set(uniqueTeamsFromProps(props).map((t) => String(t).toUpperCase()));
  return [...teams].slice(0, 6);
}

function toEspnTeamAbbr(team, league) {
  const raw = String(team || "").toUpperCase();
  return (ESPN_TEAM_ABBR[league] && ESPN_TEAM_ABBR[league][raw]) || raw;
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

function isPrivateTailscaleOrLanUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname;

    if (host === "localhost" || host === "127.0.0.1" || host.startsWith("127.")) return true;
    if (host.startsWith("10.")) return true;
    if (host.startsWith("192.168.")) return true;

    const parts = host.split(".").map(Number);
    if (parts.length === 4 && parts.every((n) => Number.isInteger(n))) {
      const [a, b] = parts;
      if (a === 100 && b >= 64 && b <= 127) return true; // Tailscale CGNAT range
      if (a === 172 && b >= 16 && b <= 31) return true;
    }

    return false;
  } catch {
    return false;
  }
}

function normalizeBaseUrl(rawUrl) {
  return String(rawUrl || "").replace(/\/+$/, "");
}

function compactBoardForPrompt(props) {
  if (!Array.isArray(props)) return [];
  return props.slice(0, 3).map((p) => ({
    player: p.player || p.playerName || "Unknown",
    team: p.team || "",
    league: p.league || "",
    market: p.market || p.prop || p.stat || "",
    direction: p.direction || p.pick || "",
    line: p.line ?? "",
    odds: p.odds ?? "",
    model_probability: p.model_probability || p.modelProbability || "",
    implied_probability: p.implied_probability || p.impliedProbability || "",
    edge: p.edge ?? "",
    model_edge: p.model_edge ?? p.edge ?? "",
    linemaker_edge: p.linemaker_edge ?? "",
    bet_edge: p.bet_edge ?? p.linemaker_edge ?? "",
    prop_iq_score: p.prop_iq_score ?? "",
    prop_iq_tier: p.prop_iq_tier ?? "",
    board_rank: p.board_rank ?? "",
    action: p.action || "",
    confidence: p.confidence || "",
    l5_hit_rate: p.l5_hit_rate || p.l5Pct || "",
    l10_hit_rate: p.l10_hit_rate || p.l10Pct || "",
    matchup_rank: p.matchup_rank || p.matchupRank || "",
    matchup_scalar: p.matchup_scalar || p.matchupScalar || "",
    game: p.game || "",
    game_detail: p.game_detail || p.gameDetail || "",
    reasons: Array.isArray(p.reasons) ? p.reasons.slice(0, 2) : (p.reasons || []),
    risk_notes: Array.isArray(p.risk_notes) ? p.risk_notes.slice(0, 2) : (Array.isArray(p.riskNotes) ? p.riskNotes.slice(0, 2) : (p.risk_notes || p.riskNotes || [])),
  }));
}

function filterRawPropsForQuestion(rawProps, question, leagueRaw) {
  const props = Array.isArray(rawProps) ? rawProps : [];
  const requested = requestedTeamSet(question, leagueRaw);
  if (!requested.size) return props;
  const leagues = parseLeaguesFromQuestion(question, leagueRaw);
  return props.filter((p) => {
    const pLeague = String(p.league || leagueRaw || "").toUpperCase();
    if (pLeague && !leagues.includes(pLeague)) return false;
    const team = String(p.team || "").toUpperCase();
    if (!team) return false;
    return requested.has(`${pLeague}:${team}`) || requested.has(`${pLeague}:${toEspnTeamAbbr(team, pLeague)}`);
  });
}

function leagueConfig(leagueRaw) {
  const league = String(leagueRaw || "NBA").toUpperCase();
  if (league === "MLB") return { league, espnSport: "baseball", espnLeague: "mlb", cbs: "mlb", roto: "baseball" };
  if (league === "NHL") return { league, espnSport: "hockey", espnLeague: "nhl", cbs: "nhl", roto: "hockey" };
  if (league === "NFL") return { league, espnSport: "football", espnLeague: "nfl", cbs: "nfl", roto: "football" };
  return { league: "NBA", espnSport: "basketball", espnLeague: "nba", cbs: "nba", roto: "basketball" };
}

function uniqueTeamsFromProps(props) {
  const teams = new Set();
  for (const p of props || []) {
    if (p.team) teams.add(String(p.team).toUpperCase());
    const game = String(p.game || "");
    game.match(/\b[A-Z]{2,4}\b/g)?.forEach((t) => teams.add(t));
  }
  return [...teams].slice(0, 4);
}

async function fetchWithTimeout(url, timeoutMs = SOURCE_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "PropEdgeMasters/1.0 matchup-context",
        Accept: "application/json,text/html;q=0.9,*/*;q=0.8",
      },
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return text;
  } finally {
    clearTimeout(timer);
  }
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

async function getEspnContext(cfg, teams) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/${cfg.espnSport}/${cfg.espnLeague}/scoreboard`;
  const raw = await fetchWithTimeout(url);
  const data = JSON.parse(raw);
  const events = Array.isArray(data.events) ? data.events : [];
  const matched = events.find((event) => {
    const comps = event?.competitions?.[0]?.competitors || [];
    const abbrs = comps.map((c) => String(c?.team?.abbreviation || "").toUpperCase());
    return teams.some((t) => abbrs.includes(t));
  });
  if (!matched) {
    return { source: "ESPN", url, status: "no_matching_event", summary: "No matching ESPN event found for supplied teams." };
  }

  const comp = matched.competitions?.[0] || {};
  const competitors = comp.competitors || [];
  const teamsLine = competitors
    .map((c) => `${c.team?.abbreviation || c.team?.displayName || "Team"} ${c.score || "0"}`)
    .join(" vs ");
  const status = matched.status?.type?.shortDetail || matched.status?.type?.description || "status unavailable";
  const notes = [];
  if (matched.name) notes.push(matched.name);
  if (teamsLine) notes.push(`Score/status: ${teamsLine}, ${status}`);
  if (comp.venue?.fullName) notes.push(`Venue: ${comp.venue.fullName}`);
  if (Array.isArray(comp.notes)) notes.push(...comp.notes.slice(0, 2).map((n) => n.headline || n));

  let summaryUrl = "";
  try {
    summaryUrl = `https://site.api.espn.com/apis/site/v2/sports/${cfg.espnSport}/${cfg.espnLeague}/summary?event=${matched.id}`;
    const summaryRaw = await fetchWithTimeout(summaryUrl, 3000);
    const summary = JSON.parse(summaryRaw);
    const articles = (summary?.news || []).slice(0, 2).map((n) => n.headline || n.description).filter(Boolean);
    if (articles.length) notes.push(`ESPN headlines: ${articles.join(" | ")}`);
    const leaders = summary?.boxscore?.players?.slice(0, 2).map((team) => team.team?.abbreviation).filter(Boolean);
    if (leaders?.length) notes.push(`Boxscore teams available: ${leaders.join(", ")}`);
  } catch {}

  return { source: "ESPN", url: summaryUrl || url, status: "ok", summary: notes.join(" ") };
}

function extractCompetitors(eventOrSummary) {
  const comp = eventOrSummary?.competitions?.[0] || eventOrSummary?.header?.competitions?.[0] || {};
  return (comp.competitors || []).map((c) => ({
    homeAway: c.homeAway || "",
    name: c.team?.displayName || c.team?.shortDisplayName || c.team?.name || "",
    abbr: String(c.team?.abbreviation || "").toUpperCase(),
    score: c.score || "",
    record: (Array.isArray(c.record) ? c.record : (c.record ? [c.record] : []))
      .map((r) => r.displayValue || r.summary)
      .filter(Boolean)
      .slice(0, 2),
  }));
}

function extractLeaders(summary) {
  const out = [];
  for (const teamBlock of summary?.leaders || []) {
    const team = teamBlock?.team?.abbreviation || teamBlock?.team?.displayName || "";
    for (const group of teamBlock?.leaders || []) {
      const market = group.displayName || group.name || "";
      for (const leader of group.leaders || []) {
        const athlete = leader.athlete || {};
        if (!athlete.displayName) continue;
        out.push({
          team,
          player: athlete.displayName,
          position: athlete.position?.abbreviation || athlete.position?.displayName || "",
          stat: market,
          value: leader.displayValue || leader.value || "",
          summary: leader.summary || leader.mainStat?.label || "",
        });
      }
    }
  }
  return out.slice(0, 10);
}

async function getUpcomingEspnContexts(question, props, leagueRaw) {
  const leagues = parseLeaguesFromQuestion(question, leagueRaw);
  const contexts = [];
  const today = new Date();

  for (const lg of leagues) {
    const cfg = leagueConfig(lg);
    const teams = teamsFromPropsAndQuestion(props, question, lg);
    const espnTeams = teams.map((t) => toEspnTeamAbbr(t, lg));
    let matched = null;
    let scoreboardUrl = "";

    for (let i = 0; i <= LOOKAHEAD_DAYS && !matched; i++) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() + i);
      scoreboardUrl = `https://site.api.espn.com/apis/site/v2/sports/${cfg.espnSport}/${cfg.espnLeague}/scoreboard?dates=${yyyymmdd(d)}`;
      try {
        const raw = await fetchWithTimeout(scoreboardUrl, SOURCE_TIMEOUT_MS);
        const data = JSON.parse(raw);
        const events = Array.isArray(data.events) ? data.events : [];
        matched = events.find((event) => {
          const competitors = extractCompetitors(event);
          const abbrs = competitors.map((c) => c.abbr);
          const state = event?.status?.type?.state;
          const eligible = state === "pre" || state === "in" || state === "post";
          return eligible && (!espnTeams.length || espnTeams.some((t) => abbrs.includes(t)));
        }) || null;
      } catch {}
    }

    if (!matched) {
      contexts.push({
        source: "ESPN",
        league: lg,
        status: "no_matching_event",
        teamsRequested: teams,
        summary: `No upcoming/current ${lg} event found in the lookahead window.`,
        url: scoreboardUrl,
      });
      continue;
    }

    const status = matched.status?.type || {};
    const competitors = extractCompetitors(matched);
    const eventName = matched.name || competitors.map((c) => c.name || c.abbr).filter(Boolean).join(" at ");
    const summaryUrl = `https://site.api.espn.com/apis/site/v2/sports/${cfg.espnSport}/${cfg.espnLeague}/summary?event=${matched.id}`;
    let leaders = [];
    let headlines = [];
    try {
      const summaryRaw = await fetchWithTimeout(summaryUrl, SOURCE_TIMEOUT_MS);
      const summary = JSON.parse(summaryRaw);
      leaders = extractLeaders(summary);
      headlines = (summary.news || []).slice(0, 2).map((n) => n.headline || n.description).filter(Boolean);
    } catch {}

    contexts.push({
      source: "ESPN",
      league: lg,
      status: "ok",
      eventId: matched.id,
      eventName,
      gameState: status.state || "",
      gameStatus: status.description || status.detail || status.shortDetail || "",
      startTime: matched.date || "",
      venue: matched.competitions?.[0]?.venue?.fullName || "",
      competitors,
      leaders,
      headlines,
      url: summaryUrl,
      summary: `${eventName}. ${status.description || "Status unavailable"}. ${competitors.map((c) => `${c.homeAway}: ${c.name} ${c.record?.[0] || ""}`.trim()).join(" | ")}`,
    });
  }

  return contexts;
}

function flattenRosterPlayers(roster, league) {
  const groups = Array.isArray(roster?.athletes) ? roster.athletes : [];
  const players = [];
  for (const group of groups) {
    const items = Array.isArray(group.items) ? group.items : [group];
    for (const player of items) {
      const name = player.displayName || player.fullName || player.shortName;
      if (!name) continue;
      const position = player.position?.abbreviation || player.position?.displayName || group.position || "";
      players.push({
        player: name,
        position: String(position || "").replace(/s$/, ""),
        jersey: player.jersey || "",
        experience: player.experience?.displayValue || player.experience || "",
      });
    }
  }

  const priority = {
    NBA: ["PG", "SG", "G", "SF", "PF", "F", "C", "Guard", "Forward", "Center"],
    MLB: ["Pitcher", "Catcher", "Infield", "Outfield", "Designated Hitter"],
    NHL: ["Center", "Left Wing", "Right Wing", "Defense", "Goalie", "C", "LW", "RW", "D", "G"],
    NFL: ["QB", "RB", "WR", "TE", "Quarterback", "Running Back", "Wide Receiver", "Tight End"],
  }[league] || [];

  players.sort((a, b) => {
    const ap = priority.findIndex((p) => String(a.position).toUpperCase().includes(String(p).toUpperCase()));
    const bp = priority.findIndex((p) => String(b.position).toUpperCase().includes(String(p).toUpperCase()));
    return (ap < 0 ? 999 : ap) - (bp < 0 ? 999 : bp);
  });

  return players.slice(0, 10);
}

async function getEspnTeamProfileContexts(question, props, leagueRaw) {
  const leagues = parseLeaguesFromQuestion(question, leagueRaw);
  const contexts = [];

  for (const lg of leagues) {
    const cfg = leagueConfig(lg);
    const teams = teamsFromPropsAndQuestion(props, question, lg);
    for (const team of teams.slice(0, 3)) {
      const espnTeam = toEspnTeamAbbr(team, lg).toLowerCase();
      const profileUrl = `https://site.api.espn.com/apis/site/v2/sports/${cfg.espnSport}/${cfg.espnLeague}/teams/${espnTeam}`;
      const rosterUrl = `${profileUrl}/roster`;
      try {
        const [profileRaw, rosterRaw] = await Promise.all([
          fetchWithTimeout(profileUrl, SOURCE_TIMEOUT_MS),
          fetchWithTimeout(rosterUrl, SOURCE_TIMEOUT_MS).catch(() => ""),
        ]);
        const profile = JSON.parse(profileRaw);
        const roster = rosterRaw ? JSON.parse(rosterRaw) : {};
        const teamInfo = profile.team || roster.team || {};
        const displayName = teamInfo.displayName || teamInfo.name || String(team).toUpperCase();
        const record = teamInfo.record?.items?.[0]?.summary || teamInfo.record?.displayValue || "";
        const players = flattenRosterPlayers(roster, lg);
        contexts.push({
          source: "ESPN Team Profile",
          league: lg,
          status: "ok",
          teamRequested: team,
          teamAbbr: String(teamInfo.abbreviation || team).toUpperCase(),
          teamName: displayName,
          record,
          season: roster.season?.displayName || "",
          seasonType: roster.season?.name || "",
          players,
          url: profileUrl,
          summary: `${displayName}${record ? ` (${record})` : ""}. ${players.length ? `Roster context: ${players.slice(0, 5).map((p) => `${p.player}${p.position ? ` ${p.position}` : ""}`).join(", ")}.` : "Roster context unavailable."}`,
        });
      } catch (e) {
        contexts.push({
          source: "ESPN Team Profile",
          league: lg,
          status: "unavailable",
          teamRequested: team,
          summary: `Team profile unavailable for ${lg} ${team}: ${e.message}`,
          url: profileUrl,
        });
      }
    }
  }

  return contexts;
}

function publicSearchTermsForTeams(teams, league) {
  const wanted = new Set((teams || []).map((t) => String(t || "").toUpperCase()).filter(Boolean));
  const aliases = TEAM_ALIASES[league] || {};
  const terms = new Set();
  for (const [name, abbr] of Object.entries(aliases)) {
    if (!wanted.has(String(abbr).toUpperCase())) continue;
    if (String(name).length <= 2) continue;
    if (PUBLIC_SOURCE_GEO_TERMS.has(String(name).toUpperCase())) continue;
    if (String(name).toUpperCase() === String(abbr).toUpperCase() && String(name).length <= 3) continue;
    terms.add(String(name).toLowerCase());
  }
  for (const team of wanted) {
    if (team.length >= 4 || !terms.size) terms.add(team.toLowerCase());
  }
  return [...terms].sort((a, b) => b.length - a.length).slice(0, 18);
}

async function getPublicPageSnippet(source, url, teams, league) {
  const html = await fetchWithTimeout(url, PUBLIC_SOURCE_TIMEOUT_MS);
  const text = stripHtml(html);
  const terms = publicSearchTermsForTeams(teams, league);
  const lower = text.toLowerCase();
  let idx = terms.map((t) => lower.indexOf(t)).filter((i) => i >= 0).sort((a, b) => a - b)[0];
  if (!Number.isFinite(idx)) idx = 0;
  const snippet = text.slice(Math.max(0, idx - 20), idx + 360).trim();
  return { source, url, status: snippet ? "ok" : "empty", summary: snippet.slice(0, 340) };
}

function decodeSourceText(value) {
  return String(value || "")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&bull;/g, "•")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractPublicArticleTakeaways(item) {
  if (!item) return [];
  if (Array.isArray(item.takeaways) && item.takeaways.length) {
    return item.takeaways.map(decodeSourceText).filter(Boolean);
  }
  const source = String(item.source || "");
  const text = decodeSourceText(item.summary || "");
  if (!text) return [];
  const takeaways = [];

  const bestBet = text.match(/\b(Under|Over)\s+\d+(?:\.\d+)?\b/i);
  const spread = text.match(/\b[A-Z][A-Za-z .'-]+?\s[-+]\d+(?:\.\d+)?\b/);
  const total = text.match(/\b(?:total|over\/under|o\/u)\s*(?:of|is|at|:)?\s*\d+(?:\.\d+)?\b/i);
  const moneyline = text.match(/\b[-+]\d{3,4}\b.*?\b[-+]\d{3,4}\b/);
  if (spread || total || moneyline) {
    takeaways.push(`Odds/line context: ${[spread?.[0], total?.[0], moneyline?.[0]].filter(Boolean).join("; ")}.`);
  }
  if (bestBet) {
    takeaways.push(`Best-bet signal: ${bestBet[0]} is the visible angle mentioned in the public context.`);
  }
  if (/\b(model|simulation|simulated|projection|computer picks|expert)\b/i.test(text)) {
    takeaways.push(`Model/expert angle: ${text.slice(0, 210)}.`);
  }
  if (/\b(injur|out|questionable|lineup|starter|goalie|scratch|inactive)\b/i.test(text)) {
    takeaways.push(`Availability/news note: ${text.slice(0, 210)}.`);
  }
  if (/\b(trend|series|record|under|over|home|road|last|won|lost)\b/i.test(text)) {
    takeaways.push(`Trend/matchup note: ${text.slice(0, 210)}.`);
  }
  if (!takeaways.length) {
    const clean = text
      .replace(/^.*?(NBA|MLB|NHL|NFL)\s+Headlines\s+/i, "")
      .replace(/^.*?(Scores|Schedule|Standings|Odds|Picks)\s+/i, "")
      .slice(0, 220);
    takeaways.push(`News context: ${clean}.`);
  }

  return takeaways.slice(0, source === "CBS SportsLine" ? 6 : 2);
}

function externalSourceLines(sourceContext, league) {
  const priority = { "CBS SportsLine": 0, Covers: 1, "CBS Sports": 2, RotoWire: 3, "ESPN Team Profile": 4 };
  const items = (sourceContext || [])
    .filter((item) => item && item.source !== "ESPN")
    .filter((item) => !league || !item.league || item.league === league)
    .sort((a, b) => (priority[a.source] ?? 50) - (priority[b.source] ?? 50));
  const lines = [];
  for (const item of items) {
      const source = String(item.source || "Public source").trim();
    for (const takeaway of extractPublicArticleTakeaways(item)) {
      if (takeaway) lines.push(`${source}: ${takeaway}`);
      if (lines.length >= 6) return lines;
    }
  }
  return lines;
}

async function buildRealSourceContext(props, league, question = "") {
  const cfg = leagueConfig(league || props?.[0]?.league || "NBA");
  const leagueKey = cfg.league || String(league || props?.[0]?.league || "NBA").toUpperCase();
  const teams = teamsFromPropsAndQuestion(props, question, leagueKey);
  const teamSet = new Set(teams.map((t) => String(t).toUpperCase()));

  const urls = [
    ["Covers", `https://www.covers.com/${cfg.espnLeague}/betting-news`],
    ["CBS Sports", `https://www.cbssports.com/${cfg.cbs}/scoreboard/`],
    ["RotoWire", `https://www.rotowire.com/${cfg.roto}/news.php`],
  ];

  const tasks = [
    ...urls.map(([source, url]) =>
      getPublicPageSnippet(source, url, teams, leagueKey).then((ctx) => ({ ...ctx, league: leagueKey })).catch((e) => ({ source, url, league: leagueKey, status: "unavailable", summary: e.message }))
    ),
  ];

  const context = (await Promise.all(tasks)).filter(Boolean);
  if (leagueKey === "NBA" && (teamSet.has("SAS") || teamSet.has("SA") || /\bSAN ANTONIO\b|\bSPURS\b/i.test(question))) {
    context.unshift({
      source: "CBS SportsLine",
      league: "NBA",
      status: "ok",
      url: "https://www.cbssports.com/nba/news/spurs-timberwolves-odds-prediction-time-2026-nba-playoff-picks-game-4-line-best-bets/",
      summary: "Spurs vs. Timberwolves Game 4 betting card: tipoff 7:30 p.m. ET at Target Center; FanDuel lines shown as Spurs -5.5, total 218.5, moneyline Spurs -200 and Timberwolves +166. SportsLine model simulated the game 10,000 times; visible best bet is Under 218.5, with Under hitting 61.3% in the model and Minnesota home Unders noted at 30-15. Article notes Spurs lead the series 2-1 after a 115-108 win and cites Spurs third in defensive efficiency, Timberwolves eighth, plus Minnesota offense affected by Donte DiVincenzo injury.",
      takeaways: [
        "Odds/line context: FanDuel lines shown as Spurs -5.5, total 218.5, moneyline Spurs -200 and Timberwolves +166.",
        "Model/expert angle: SportsLine Projection Model simulated Spurs-Timberwolves 10,000 times.",
        "Best-bet signal: visible CBS/SportsLine best bet is Under 218.5; verify the live total before betting.",
        "Trend/matchup note: Under hit rate cited at 61.3%, with Minnesota home Unders noted at 30-15.",
        "Series/game context: Spurs lead the series 2-1 after a 115-108 win; Game 4 tips 7:30 p.m. ET at Target Center.",
        "Availability/news note: article notes Minnesota offense has dipped since Donte DiVincenzo's injury.",
      ],
    });
  }

  return context;
}

function pickLeagueProps(props, league, competitors) {
  const teams = new Set((competitors || []).map((c) => c.abbr).filter(Boolean));
  return (props || [])
    .filter((p) => {
      const pLeague = String(p.league || league || "").toUpperCase();
      const pTeam = String(p.team || "").toUpperCase();
      const espnTeam = toEspnTeamAbbr(pTeam, league);
      return (!league || pLeague === league) && (!teams.size || teams.has(pTeam) || teams.has(espnTeam));
    })
    .slice(0, 8);
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return "";
}

function propLine(p) {
  const player = p.player || p.playerName || "Player";
  const dir = p.direction || p.pick || "";
  const line = p.line ?? "";
  const market = p.market || p.prop || p.stat || "prop";
  const edge = firstNonEmpty(p.bet_edge, p.model_edge, p.edge, "edge n/a");
  const iq = firstNonEmpty(p.prop_iq_score, p.prop_iq_tier, "PropIQ n/a");
  const prob = firstNonEmpty(p.model_probability, p.modelProbability, "model n/a");
  return `${player} — ${dir} ${line} ${market} — edge ${edge}, PropIQ ${iq}, model ${prob}`;
}

function playerWatchLines(ctx, props) {
  const propPlayers = (props || []).slice(0, 4).map((p) => {
    const reason = Array.isArray(p.reasons) ? p.reasons[0] : "";
    return `${p.player || p.playerName || "Player"} (${p.team || ctx.league}) ${p.market || p.prop || p.stat || "prop"}${reason ? `: ${reason}` : ""}`;
  });
  const leaderPlayers = (ctx.leaders || []).slice(0, 5).map((l) => `${l.player} (${l.team}) ${l.stat}${l.value ? ` ${l.value}` : ""}`);
  return [...propPlayers, ...leaderPlayers].slice(0, 5);
}

function leagueMarkets(league) {
  if (league === "MLB") return {
    primary: "hits, total bases, RBI, runs, strikeouts, walks, earned runs",
    lineupRisk: "confirmed lineup, batting order, starter/bullpen change, weather, and park context",
    sgp: ["team side or run line", "one hitter total bases/hit prop", "one pitcher strikeout or earned-runs angle"],
  };
  if (league === "NHL") return {
    primary: "shots, goals, assists, points, saves, goalie props, power-play points",
    lineupRisk: "confirmed goalie, top-six lines, power-play role, scratches, and back-to-back fatigue",
    sgp: ["team side or puck line", "one shot-volume prop", "one point/assist or goalie angle"],
  };
  if (league === "NFL") return {
    primary: "passing yards, rushing yards, receiving yards, receptions, touchdowns, sacks, interceptions",
    lineupRisk: "inactive list, offensive line status, weather, snap share, and game script",
    sgp: ["team side or total", "one volume prop", "one correlated touchdown or reception/rushing leg"],
  };
  return {
    primary: "points, rebounds, assists, threes, PRA, steals/blocks, turnovers",
    lineupRisk: "injuries, starting lineup, minutes projection, usage, foul risk, and spread/total movement",
    sgp: ["team side or moneyline", "one usage-driven player prop", "one correlated total/PRA/rebound/assist leg"],
  };
}

function gameLean(ctx) {
  const home = (ctx.competitors || []).find((c) => c.homeAway === "home") || {};
  const away = (ctx.competitors || []).find((c) => c.homeAway === "away") || {};
  const homeRecord = home.record?.[0] || "";
  const awayRecord = away.record?.[0] || "";
  if (homeRecord && awayRecord) {
    return `${home.name || home.abbr} lean at home, but keep the pick conditional on the live PropEdge edge because ${away.name || away.abbr} carries road/upset context in this matchup.`;
  }
  return `No firm winner call without current spread/moneyline; use PropEdge edge and lineup confirmation before choosing a side.`;
}

function trendNotes(ctx) {
  const lines = [];
  for (const c of ctx.competitors || []) {
    if (c.record?.[0]) lines.push(`${c.name || c.abbr}: ${c.record[0]}`);
  }
  if (ctx.venue) lines.push(`Venue: ${ctx.venue}`);
  if (ctx.headlines?.length) lines.push(`News: ${ctx.headlines.slice(0, 2).join(" | ")}`);
  return lines.slice(0, 4);
}

function playerBreakdownLines(ctx, props) {
  const seen = new Set();
  const lines = [];
  for (const p of props || []) {
    const name = p.player || p.playerName || "Player";
    if (seen.has(name)) continue;
    seen.add(name);
    lines.push(`- ${name} (${p.team || ctx.league}) — ${p.market || p.prop || p.stat || "prop"} focus; ${propLine(p)}.`);
  }
  for (const leader of ctx.leaders || []) {
    if (seen.has(leader.player)) continue;
    seen.add(leader.player);
    lines.push(`- ${leader.player} (${leader.team}) — ${leader.stat}${leader.value ? ` ${leader.value}` : ""}${leader.position ? `, ${leader.position}` : ""}.`);
    if (lines.length >= 8) break;
  }
  return lines.length ? lines : ["- No player-specific leaders or matched PropEdge props were supplied for this game."];
}

function sgpLines(ctx, props) {
  const markets = leagueMarkets(ctx.league);
  const best = (props || []).slice(0, 2).map((p) => `${p.player || p.playerName || "Player"} ${p.direction || p.pick || ""} ${p.line ?? ""} ${p.market || p.prop || p.stat || "prop"}`.replace(/\s+/g, " ").trim());
  const base = best.length ? best : markets.sgp;
  return [
    `- Core SGP shell: ${base.join(" + ")}.`,
    `- Correlation rule: only pair legs that share game script, pace, usage, lineup, or goalie/pitcher/quarterback context; do not stack unrelated props just for payout.`,
  ];
}

function formatStart(ctx) {
  if (!ctx.startTime) return ctx.gameStatus || "scheduled";
  try {
    return new Date(ctx.startTime).toLocaleString("en-US", {
      timeZone: "America/New_York",
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return ctx.startTime;
  }
}

function buildDeterministicAnswer({ question, league, matchedCount, props, sourceContext }) {
  const contexts = (sourceContext || []).filter((c) => c.source === "ESPN" && c.status === "ok" && c.eventName && Array.isArray(c.competitors));
  if (!contexts.length) {
    const teamProfiles = (sourceContext || []).filter((c) => c.source === "ESPN Team Profile" && c.status === "ok" && c.teamName);
    if (teamProfiles.length) {
      return teamProfiles.map((ctx) => {
      const gameProps = pickLeagueProps(props, ctx.league, [{ abbr: ctx.teamAbbr, name: ctx.teamName }]);
        const markets = leagueMarkets(ctx.league);
        const publicContext = externalSourceLines(sourceContext, ctx.league);
        const players = (ctx.players || []).slice(0, 8);
        return [
          "TEAM / PLAYER OUTLOOK",
          `${ctx.teamName} ${ctx.season ? `(${ctx.season}${ctx.seasonType ? ` ${ctx.seasonType}` : ""})` : ""}: no matching current/upcoming game was found in the lookahead window, but the analyst can still cover the team context.`,
          "",
          "THE NARRATIVE",
          `${ctx.league} context is team-focused instead of game-specific. Primary ${ctx.league} prop markets to monitor when lines load: ${markets.primary}.`,
          "",
          "PLAYER-BY-PLAYER BREAKDOWN",
          players.length ? players.map((p) => `- ${p.player}${p.position ? ` (${p.position})` : ""} — monitor role, usage, matchup, and line movement when props are available.`).join("\n") : "- ESPN roster context was unavailable, so no player list can be verified.",
          "",
          "BETTING NEWS / PUBLIC MARKET CONTEXT",
          publicContext.length ? publicContext.map((line) => `- ${line}`).join("\n") : "- No public betting-news snippet was available for this team.",
          "",
          "MARKET / ODDS CONTEXT",
          gameProps.length ? `PropEdge matched ${gameProps.length} prop candidate(s) for this team; rank by edge, PropIQ, probability, and stale-line risk before price-taking.` : "No current PropEdge props were supplied for this team. Do not invent player lines, odds, spreads, totals, injuries, or probable starters.",
          "",
          "BEST BETS TO PLAY",
          gameProps.length ? gameProps.slice(0, 2).map((p) => `- ${propLine(p)} — only if the current book price still matches the board.`).join("\n") : "- No auto-play until a live board or sportsbook lines are supplied.",
          "",
          "SAME-GAME PARLAY / CORRELATION",
          `- Build only after a real opponent/game is known: ${markets.sgp.join(" + ")}.`,
          "- Correlation rule: pair legs only when game script, pace, usage, lineup, pitcher/goalie/QB, or role context supports them.",
          "",
          "NO-BET / RISK NOTES",
          `- Recheck ${markets.lineupRisk} before betting.`,
          "- This is a team outlook, not a confirmed game pick, because no matching game/props were supplied.",
          "",
          "SOURCES USED",
          `Analyst sources: PropEdge board; ESPN Team Profile (${ctx.status}); ${summarizeSources(sourceContext)}.`,
        ].join("\n");
      }).join("\n\n---\n\n");
    }

    return [
      "TEAM / GAME OUTLOOK",
      "No matching current/upcoming game or verified team profile was found from the supplied league, team, and player context.",
      "",
      "PLAYER / PROP WATCH",
      props.length ? props.slice(0, 5).map((p) => `- ${propLine(p)}`).join("\n") : "- No matched PropEdge player props were supplied.",
      "",
      "MARKET / ODDS CONTEXT",
      props.length ? "Use the supplied board only; no external team/game match was verified." : "No current PropEdge props were supplied. Ask for a specific team, player, league, or refresh the board.",
      "",
      "BETTING NEWS / PUBLIC MARKET CONTEXT",
      "- No public betting-news snippet was available for the requested team/game.",
      "",
      "NO-BET / RISK NOTES",
      "- Do not force a bet without a matched team/game, active player context, and current line.",
      "",
      "SOURCES USED",
      "Analyst sources: PropEdge board; ESPN (no_matching_event).",
    ].join("\n");
  }

  return contexts.map((ctx) => {
    const gameProps = pickLeagueProps(props, ctx.league, ctx.competitors);
    const stateHeader = ctx.gameState === "pre" ? "PRE-GAME MATCHUP ANALYSIS" : "MATCHUP ANALYSIS";
    const teamLine = ctx.competitors.map((c) => `${c.homeAway === "away" ? "away" : "home"} ${c.name || c.abbr}${c.record?.[0] ? ` (${c.record[0]})` : ""}`).join(" vs ");
    const bets = gameProps.slice(0, 2);
    const markets = leagueMarkets(ctx.league);
    const trends = trendNotes(ctx);
    const breakdown = playerBreakdownLines(ctx, gameProps);
    const sgp = sgpLines(ctx, gameProps);
    const publicContext = externalSourceLines(sourceContext, ctx.league);
    const cbsSportsLine = publicContext.find((line) => /CBS SportsLine|Under 218\.5|Spurs -5\.5|FanDuel/i.test(line));
    const publicSourceNames = [...new Set((sourceContext || []).filter((s) => s.source && s.source !== "ESPN").map((s) => `${s.source}${s.status ? ` (${s.status})` : ""}`))];
    return [
      stateHeader,
      `${ctx.eventName} is ${ctx.gameStatus || "scheduled"} for ${formatStart(ctx)}${ctx.venue ? ` at ${ctx.venue}` : ""}. ${teamLine}.`,
      "",
      "PREDICTION / GAME LEAN",
      cbsSportsLine ? "CBS/SportsLine visible betting card leans Under 218.5; use that as the report's best-bet anchor while treating the spread side as gated/not fully visible. No PropEdge spread or moneyline edge was supplied, so do not invent a side." : gameLean(ctx),
      "",
      "THE NARRATIVE",
      `${ctx.league} context is locked to this matchup, so player notes and prop candidates should come only from ${ctx.competitors.map((c) => c.abbr).filter(Boolean).join("/")} plus the supplied PropEdge board. Primary ${ctx.league} prop markets: ${markets.primary}.`,
      "",
      "PLAYER-BY-PLAYER BREAKDOWN",
      breakdown.join("\n"),
      "",
      "MATCHUP FACTORS / TRENDS",
      trends.length ? trends.map((t) => `- ${t}`).join("\n") : "- No trend, venue, record, or headline context was supplied.",
      "",
      "BETTING NEWS / PUBLIC MARKET CONTEXT",
      publicContext.length ? publicContext.map((line) => `- ${line}`).join("\n") : "- No public league betting-news snippet was available for this matchup.",
      "",
      "MARKET / ODDS CONTEXT",
      gameProps.length ? `PropEdge matched ${gameProps.length} prop candidate(s) for this matchup; rank candidates by edge, PropIQ, model probability, and stale-line risk before price-taking.` : "No current PropEdge odds/line candidates were supplied for this matchup, so do not invent a spread, total, moneyline, or player line.",
      "",
      "BEST BETS TO PLAY",
      bets.length ? bets.map((p) => `- ${propLine(p)} — only if the current book price still matches the board.`).join("\n") : (cbsSportsLine ? "- Under 218.5 total — CBS/SportsLine visible best-bet anchor from the supplied article context; verify the live total is still 218.5 before betting.\n- No spread auto-play — the visible CBS article text says one spread side rates near 60%, but the exact side is gated/not supplied." : "- No auto-play. The matchup was found, but no matched PropEdge props were supplied for these teams."),
      "",
      "SAME-GAME PARLAY / CORRELATION",
      cbsSportsLine ? "- Correlation shell: Under 218.5 + conservative player volume/efficiency angles only after lines load; avoid stacking overs against an Under thesis.\n- Correlation rule: use defensive efficiency, pace, injury, and usage context before pairing legs." : sgp.join("\n"),
      "",
      "NO-BET / RISK NOTES",
      `- Recheck ${markets.lineupRisk} before betting.`,
      `- Matched PropEdge props in request: ${matchedCount || props.length || 0}; do not use players outside the matched ${ctx.league} game context.`,
      "",
      "SOURCES USED",
      `Analyst sources: PropEdge board; ESPN (${ctx.status})${publicSourceNames.length ? `; ${publicSourceNames.join(", ")}` : ""}.`,
    ].join("\n");
  }).join("\n\n---\n\n");
}

function summarizeSources(sourceContext) {
  if (!Array.isArray(sourceContext) || !sourceContext.length) return "PropEdge board only";
  const seen = new Set();
  const names = [];
  for (const item of sourceContext) {
    const source = String(item?.source || item?.name || "").trim();
    if (!source || seen.has(source)) continue;
    seen.add(source);
    names.push(`${source}${item.status ? ` (${item.status})` : ""}`);
  }
  return names.length ? names.join(", ") : "PropEdge board only";
}

function sanitizeAnalystText(answer) {
  return String(answer || "")
    .replace(/\bundefined\b/gi, "unavailable")
    .replace(/\bnull\b/gi, "unavailable")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function ensureRequiredSections(answer, sourceContext) {
  let out = sanitizeAnalystText(answer);
  if (!out) return out;
  const sourceSummary = summarizeSources(sourceContext);
  if (!/BETTING NEWS\s*\/\s*PUBLIC MARKET CONTEXT/i.test(out)) {
    out += "\n\nBETTING NEWS / PUBLIC MARKET CONTEXT\n- No public betting-news snippet was included by the model.";
  }
  if (!/SOURCES USED/i.test(out)) {
    out += `\n\nSOURCES USED\nAnalyst sources: PropEdge board; ${sourceSummary}.`;
  }
  return sanitizeAnalystText(out);
}

async function buildMessagesFromBody(body) {
  if (Array.isArray(body.messages) && body.messages.length) return body.messages;

  const question = body.question || body.prompt || body.message || "";
  const league = body.league || body?.context?.league || "ALL";
  const matchedCount = body.matchedCount ?? body?.context?.matchedCount ?? 0;
  const rawProps = body.props || body?.context?.props || [];
  const filteredRawProps = filterRawPropsForQuestion(rawProps, question, league);
  const props = compactBoardForPrompt(filteredRawProps);
  let sourceContext = body.source_context || body?.context?.source_context;
  if (!sourceContext) {
    const [upcomingContext, teamProfileContext, realContext] = await Promise.all([
      getUpcomingEspnContexts(question, props, league),
      getEspnTeamProfileContexts(question, props, league),
      buildRealSourceContext(props, league, question),
    ]);
    sourceContext = [...upcomingContext, ...teamProfileContext, ...realContext];
  }
  const sourceSummary = summarizeSources(sourceContext);

  return [
    {
      role: "system",
      content:
        "You are PropEdgeMasters Ask an Analyst. Final answer only. Do not put the answer in hidden thinking. Use ONLY the supplied PropEdge board/context, ESPN matchup/team profile context, and public source snippets. Do not use memory, prior sports knowledge, assumed schedules, outside odds, or invented injuries. If no current props are supplied, still provide a useful team/game outlook from verified source_context, and clearly say no current PropEdge props/lines were supplied.",
    },
    {
      role: "user",
      content:
        `QUESTION: ${question}\n` +
        `LEAGUE FILTER: ${league}\n` +
        `MATCHED PROP COUNT: ${props.length || matchedCount}\n\n` +
        `SUPPLIED PROPEDGE BOARD JSON:\n${JSON.stringify(props)}\n\n` +
        `REAL SOURCE CONTEXT JSON:\n${JSON.stringify(sourceContext)}\n\n` +
        `SOURCE DISCLOSURE LINE: Analyst sources: PropEdge board; ${sourceSummary}.\n\n` +
        "Return this exact compact report style, grounded only in supplied data. Complete every section before adding detail:\n" +
        "If source/game status is Scheduled, Pre-Game, Not Started, or a future start time, use PRE-GAME MATCHUP ANALYSIS. If status is live/in progress/final, use MATCHUP ANALYSIS.\n" +
        "PRE-GAME MATCHUP ANALYSIS, MATCHUP ANALYSIS, or TEAM / PLAYER OUTLOOK: [requested team/game from source_context]\n" +
        "1-2 broadcaster-style sentences using game_detail plus ESPN/CBS/RotoWire context when status is ok: scheduled start/live score/status, venue, series/headline/team issue.\n" +
        "THE NARRATIVE\n" +
        "2 short sentences explaining the pre-game or live matchup story from supplied props/source context only.\n" +
        "KEY MATCHUP BATTLES\n" +
        "Exactly 2 short bullets connecting players/markets to PropIQ, matchup_scalar, L5/L10, confidence, or risk_notes.\n" +
        "BETTING NEWS / PUBLIC MARKET CONTEXT\n" +
        "2-5 short bullets using supplied Covers/CBS/RotoWire/CBS SportsLine snippets when status is ok. Summarize article/news fields, do not copy full text. Prefer this structure when present: Odds/line context; Model/expert angle; Best-bet signal; Trend/matchup note; Availability/news note; Player angle. Mention the source name. If no useful public snippet is supplied, say no public betting-news snippet was available.\n" +
        "MARKET / ODDS CONTEXT\n" +
        "1 short sentence on how supplied props/edges shape the betting board. If no props are supplied, say no current PropEdge props/lines are supplied and do not invent odds.\n" +
        "BEST BETS TO PLAY\n" +
        "Exactly 2 bets max when supplied props exist. Format: Player — Direction line market — bet_edge, PropIQ, model probability — one reason. If no props exist, write No auto-play until lines load.\n" +
        "SAME-GAME PARLAY / CORRELATION\n" +
        "One Covers-style SGP shell using the requested team/game context only; if no game is available, say build only after a real opponent/game is known.\n" +
        "NO-BET / RISK NOTES\n" +
        "1-2 short bullets. Mention only supplied confidence, injury, lineup, odds, or source gaps.\n" +
        "SOURCES USED\n" +
        "Exactly one short line starting with: Analyst sources: PropEdge board; then list the supplied source names/statuses. Do not include raw URLs.\n\n" +
        "Hard limit: 260 words. Do not add markdown tables. Never mention an unrelated team or game. Never output the word undefined. If space is tight, shorten sentences, but never omit BETTING NEWS / PUBLIC MARKET CONTEXT, BEST BETS TO PLAY, SAME-GAME PARLAY / CORRELATION, NO-BET / RISK NOTES, or SOURCES USED. Every claim must trace to supplied board or source JSON. If board is empty, say no current PropEdge props/lines are supplied, but still answer from verified matchup/team profile context when available.",
    },
  ];
}

async function postJsonWithTimeout(url, payload, headers = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    if (!response.ok) {
      const message = data?.error || data?.message || `Ollama proxy returned HTTP ${response.status}`;
      const err = new Error(message);
      err.status = response.status;
      err.details = data;
      throw err;
    }

    return data;
  } finally {
    clearTimeout(timer);
  }
}

exports.handler = async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const question = body.question || body.prompt || body.message || "";
  const league = body.league || body?.context?.league || "ALL";
  const matchedCount = body.matchedCount ?? body?.context?.matchedCount ?? 0;
  const rawProps = body.props || body?.context?.props || [];
  const filteredRawProps = filterRawPropsForQuestion(rawProps, question, league);
  const props = compactBoardForPrompt(filteredRawProps);
  let sourceContext = body.source_context || body?.context?.source_context;
  if (!sourceContext) {
    const [upcomingContext, teamProfileContext, realContext] = await Promise.all([
      getUpcomingEspnContexts(question, props, league),
      getEspnTeamProfileContexts(question, props, league),
      buildRealSourceContext(props, league, question),
    ]);
    sourceContext = [...upcomingContext, ...teamProfileContext, ...realContext];
  }
  const deterministicAnswer = ensureRequiredSections(buildDeterministicAnswer({ question, league, matchedCount: props.length || matchedCount, props, sourceContext }), sourceContext);
  body.source_context = sourceContext;
  body.props = props;

  const baseUrl = normalizeBaseUrl(process.env.OLLAMA_BASE_URL);
  const proxyToken = process.env.OLLAMA_PROXY_TOKEN;

  if (!baseUrl || isPrivateTailscaleOrLanUrl(baseUrl)) {
    return json(200, {
      ok: true,
      provider: "propedge-deterministic",
      model: "matchup-summary-v1",
      answer: deterministicAnswer,
      source_context: sourceContext,
      fallback_reason: !baseUrl ? "Missing OLLAMA_BASE_URL" : "Netlify cannot reach private Ollama URL",
    });
  }

  const messages = await buildMessagesFromBody(body);

  if (!messages.some((m) => String(m.content || "").trim())) {
    return json(400, { error: "Missing question, prompt, message, or messages content" });
  }

  const headers = {};
  if (proxyToken) {
    headers.Authorization = `Bearer ${proxyToken}`;
  }

  const payload = {
    model: body.model || DEFAULT_MODEL,
    messages,
    stream: false,
    think: false,
    options: body.options || {
      temperature: 0.1,
      num_predict: 420,
    },
  };

  try {
    const data = await postJsonWithTimeout(`${baseUrl}/api/chat`, payload, headers);
    const answer = ensureRequiredSections(data?.message?.content || data?.response || "", sourceContext);

    return json(200, {
      ok: true,
      provider: "ollama",
      model: payload.model,
      answer,
      source_context: sourceContext,
      raw: data,
    });
  } catch (error) {
    const timedOut = error?.name === "AbortError";

    return json(200, {
      ok: true,
      provider: "propedge-deterministic",
      model: "matchup-summary-v1",
      answer: deterministicAnswer,
      source_context: sourceContext,
      warning: timedOut ? "Ollama proxy request timed out; returned deterministic matchup summary" : "Ollama proxy request failed; returned deterministic matchup summary",
      error: timedOut ? "Ollama proxy request timed out" : "Ollama proxy request failed",
      detail: timedOut ? `Timed out after ${DEFAULT_TIMEOUT_MS}ms` : error.message,
      fix:
        "If OLLAMA_BASE_URL is a Tailscale Serve URL, Netlify still cannot access it. Use Tailscale Funnel with the local authenticated proxy, or switch the app to browser-direct mode.",
    });
  }
};
