// Environment variables provided by Netlify dashboard (not .env file)

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

// TEST MODE - bypass heavy operations
const TEST_MODE = false;

// Import article fetcher
let fetchArticles, formatArticlesForPrompt;
try {
  const articlesModule = require('./fetch-articles-legal');
  fetchArticles = articlesModule.fetchArticles;
  formatArticlesForPrompt = articlesModule.formatArticlesForPrompt;
} catch (e) {
  fetchArticles = async () => [];
  formatArticlesForPrompt = () => "";
}

// Import roster fetcher
let fetchAllRosters, fetchEspnRosters, formatRostersForContext;
try {
  const rostersModule = require('./fetch-current-rosters');
  fetchAllRosters = rostersModule.fetchAllRosters;
  fetchEspnRosters = rostersModule.fetchEspnRosters;
  formatRostersForContext = rostersModule.formatRostersForContext;
} catch (e) {
  fetchAllRosters = async () => null;
  fetchEspnRosters = async () => ({});
  formatRostersForContext = () => "";
}

// Import Claude SDK. Claude is the primary analyst. PropEdge board data,
// article excerpts, rosters, and source context are supplemental context only.
let Anthropic;
let claudeClient;
try {
  Anthropic = require("@anthropic-ai/sdk");
  claudeClient = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
  console.log('Claude SDK initialized');
} catch (err) {
  console.error('FATAL: Claude SDK initialization failed:', err.message);
  claudeClient = null;
}

const DEFAULT_MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";
const GEMINI_MODEL_FALLBACKS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
];
const GEMINI_EV_DETAIL_MODEL = process.env.GEMINI_EV_DETAIL_MODEL || process.env.GEMINI_MODEL || GEMINI_MODEL_FALLBACKS[0];
const GEMINI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY || "";
const DEFAULT_TIMEOUT_MS = Number(process.env.CLAUDE_TIMEOUT_MS || 27000);
const MAX_INPUT_CHARS = Number(process.env.ANALYST_MAX_INPUT_CHARS || 9000);

// Circuit breaker
const CLAUDE_CIRCUIT = { isOpen: false, failureCount: 0, lastFailureTime: 0 };
const CIRCUIT_FAILURE_THRESHOLD = 3;
const CIRCUIT_COOLDOWN_MS = 60000;
const RESPONSE_CACHE = new Map();
const CACHE_TTL_MS = 3600000;

function getCacheKey(question, league, props, responseMode) {
  const propStr = props.length > 0 ? `${props[0]?.player || ''}|${props.length}` : '';
  const mode = responseMode || 'default';
  return `${question.toLowerCase().slice(0, 50)}|${league}|${propStr}|${mode}`.replace(/[^\w|]/g, '');
}

function getCachedResponse(question, league, props, responseMode) {
  const key = getCacheKey(question, league, props, responseMode);
  const cached = RESPONSE_CACHE.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.answer;
  }
  RESPONSE_CACHE.delete(key);
  return null;
}

function setCachedResponse(question, league, props, answer, responseMode) {
  const key = getCacheKey(question, league, props, responseMode);
  RESPONSE_CACHE.set(key, { answer, timestamp: Date.now() });
}

function isCircuitOpen() {
  if (!CLAUDE_CIRCUIT.isOpen) return false;
  const timeSinceLast = Date.now() - CLAUDE_CIRCUIT.lastFailureTime;
  if (timeSinceLast > CIRCUIT_COOLDOWN_MS) {
    CLAUDE_CIRCUIT.isOpen = false;
    CLAUDE_CIRCUIT.failureCount = 0;
    return false;
  }
  return true;
}

function recordClaudeFailure() {
  CLAUDE_CIRCUIT.failureCount++;
  CLAUDE_CIRCUIT.lastFailureTime = Date.now();
  if (CLAUDE_CIRCUIT.failureCount >= CIRCUIT_FAILURE_THRESHOLD) {
    CLAUDE_CIRCUIT.isOpen = true;
  }
}

function recordClaudeSuccess() {
  CLAUDE_CIRCUIT.failureCount = Math.max(0, CLAUDE_CIRCUIT.failureCount - 1);
  if (CLAUDE_CIRCUIT.failureCount === 0) {
    CLAUDE_CIRCUIT.isOpen = false;
  }
}

async function callClaudeWithRetry(messages, maxAttempts = 3, claudeOptions = {}) {
  if (isCircuitOpen()) {
    throw new Error('Claude API circuit breaker open');
  }

  let systemMessage = "";
  let userMessages = [];
  for (const msg of messages) {
    if (msg.role === "system") {
      systemMessage = msg.content;
    } else {
      userMessages.push(msg);
    }
  }

  const backoffMs = [1000, 3000, 8000];
  let lastError;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      if (!claudeClient) {
        throw new Error('Claude client not initialized');
      }

      const payload = {
        model: DEFAULT_MODEL,
        max_tokens: claudeOptions.max_tokens || Number(process.env.CLAUDE_MAX_TOKENS || 850),
        temperature: claudeOptions.temperature != null ? claudeOptions.temperature : 0.1,
        messages: userMessages,
      };

      if (systemMessage) {
        payload.system = systemMessage;
      }

      // Add timeout using Promise.race
      let timeoutId;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`Claude API timeout (${DEFAULT_TIMEOUT_MS}ms)`)), DEFAULT_TIMEOUT_MS);
      });

      const response = await Promise.race([
        claudeClient.messages.create(payload),
        timeoutPromise,
      ]);
      clearTimeout(timeoutId);
      recordClaudeSuccess();
      return response;
    } catch (error) {
      lastError = error;
      console.error(`Claude attempt ${attempt + 1}: ${error.message}`);
      recordClaudeFailure();

      if (attempt < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, backoffMs[attempt]));
      }
    }
  }

  throw lastError || new Error('Claude API failed after retries');
}

function stripJsonFence(text) {
  return String(text || "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

async function callGeminiEvDetail(messages, options = {}) {
  if (!GEMINI_API_KEY) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not configured");
  }

  const systemMessage = messages.find((m) => m.role === "system")?.content || "";
  const userMessage = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n\n");

  const modelChain = Array.from(new Set([GEMINI_EV_DETAIL_MODEL, ...GEMINI_MODEL_FALLBACKS].filter(Boolean)));

  const payloadBase = {
    ...(systemMessage ? { systemInstruction: { parts: [{ text: systemMessage }] } } : {}),
    contents: [{ role: "user", parts: [{ text: userMessage }] }],
    generationConfig: {
      temperature: options.temperature != null ? options.temperature : 0.5,
      maxOutputTokens: options.max_tokens || options.num_predict || 1500,
      responseMimeType: "application/json",
    },
  };

  let lastErr;
  for (const model of modelChain) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
      let timeoutId;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`Gemini API timeout (${DEFAULT_TIMEOUT_MS}ms)`)), DEFAULT_TIMEOUT_MS);
      });

      try {
        const res = await Promise.race([
          fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payloadBase),
          }),
          timeoutPromise,
        ]);
        clearTimeout(timeoutId);

        if (!res.ok) {
          const errBody = await res.text().catch(() => "");
          const modelUnavailable = res.status === 404
            || /not found for API version|not supported for generateContent|is not found/i.test(errBody);
          const transient = [429, 500, 502, 503, 504].includes(res.status)
            || /UNAVAILABLE|RESOURCE_EXHAUSTED|high demand|overloaded/i.test(errBody);
          lastErr = new Error(`Gemini API HTTP ${res.status}: ${errBody.slice(0, 240)}`);
          if (modelUnavailable) break;
          if (transient && attempt < 2) {
            await new Promise((r) => setTimeout(r, 700 * 2 ** attempt));
            continue;
          }
          if (transient) break;
          throw lastErr;
        }

        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
        if (!text.trim()) {
          lastErr = new Error("Gemini returned empty response");
          if (attempt < 2) continue;
          throw lastErr;
        }
        return stripJsonFence(text);
      } catch (err) {
        clearTimeout(timeoutId);
        lastErr = err;
        const msg = err?.message || "";
        const transient = /503|429|UNAVAILABLE|high demand|timeout/i.test(msg);
        if (transient && attempt < 2) {
          await new Promise((r) => setTimeout(r, 700 * 2 ** attempt));
          continue;
        }
        if (!transient) throw err;
      }
    }
  }

  throw lastErr || new Error("Gemini unavailable");
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

function teamsFromQuestion(question, league) {
  const aliases = {
    NBA: {
      HAWKS: "ATL", CELTICS: "BOS", NETS: "BKN", HORNETS: "CHA", BULLS: "CHI", CAVALIERS: "CLE", CAVS: "CLE",
      MAVERICKS: "DAL", MAVS: "DAL", NUGGETS: "DEN", PISTONS: "DET", WARRIORS: "GSW", ROCKETS: "HOU",
      PACERS: "IND", CLIPPERS: "LAC", LAKERS: "LAL", GRIZZLIES: "MEM", HEAT: "MIA", BUCKS: "MIL",
      TIMBERWOLVES: "MIN", WOLVES: "MIN", PELICANS: "NOP", KNICKS: "NYK", THUNDER: "OKC", MAGIC: "ORL",
      "76ERS": "PHI", SIXERS: "PHI", SUNS: "PHX", BLAZERS: "POR", KINGS: "SAC", SPURS: "SAS", "SAN ANTONIO": "SAS",
      RAPTORS: "TOR", JAZZ: "UTA", WIZARDS: "WAS"
    },
    NHL: {
      DUCKS: "ANA", BRUINS: "BOS", SABRES: "BUF", FLAMES: "CGY", HURRICANES: "CAR", CANES: "CAR", BLACKHAWKS: "CHI",
      AVALANCHE: "COL", JACKETS: "CBJ", STARS: "DAL", WINGS: "DET", OILERS: "EDM", PANTHERS: "FLA", KINGS: "LAK",
      WILD: "MIN", CANADIENS: "MTL", PREDS: "NSH", DEVILS: "NJD", ISLANDERS: "NYI", RANGERS: "NYR", SENATORS: "OTT",
      FLYERS: "PHI", PENGUINS: "PIT", SHARKS: "SJS", KRAKEN: "SEA", BLUES: "STL", LIGHTNING: "TBL", LEAFS: "TOR",
      UTAH: "UTA", CANUCKS: "VAN", KNIGHTS: "VGK", "GOLDEN KNIGHTS": "VGK", CAPITALS: "WSH", JETS: "WPG"
    },
    MLB: {
      DIAMONDBACKS: "ARI", BRAVES: "ATL", ORIOLES: "BAL", "RED SOX": "BOS", CUBS: "CHC", "WHITE SOX": "CHW",
      REDS: "CIN", GUARDIANS: "CLE", ROCKIES: "COL", TIGERS: "DET", ASTROS: "HOU", ROYALS: "KC", "KANSAS CITY": "KC",
      ANGELS: "LAA", DODGERS: "LAD", MARLINS: "MIA", BREWERS: "MIL", TWINS: "MIN", METS: "NYM", YANKEES: "NYY",
      ATHLETICS: "ATH", PHILLIES: "PHI", PIRATES: "PIT", PADRES: "SD", GIANTS: "SF", MARINERS: "SEA", CARDINALS: "STL",
      RAYS: "TB", RANGERS: "TEX", BLUEJAYS: "TOR", "BLUE JAYS": "TOR", NATIONALS: "WSH"
    },
    NFL: {
      CARDINALS: "ARI", FALCONS: "ATL", RAVENS: "BAL", BILLS: "BUF", PANTHERS: "CAR", BEARS: "CHI", BENGALS: "CIN",
      BROWNS: "CLE", COWBOYS: "DAL", BRONCOS: "DEN", LIONS: "DET", PACKERS: "GB", TEXANS: "HOU", COLTS: "IND",
      JAGUARS: "JAX", CHIEFS: "KC", "KANSAS CITY": "KC", RAIDERS: "LV", CHARGERS: "LAC", RAMS: "LAR", DOLPHINS: "MIA",
      VIKINGS: "MIN", PATRIOTS: "NE", SAINTS: "NO", GIANTS: "NYG", JETS: "NYJ", EAGLES: "PHI", STEELERS: "PIT",
      SEAHAWKS: "SEA", NINERS: "SF", "49ERS": "SF", BUCCANEERS: "TB", TITANS: "TEN", COMMANDERS: "WSH"
    },
  };
  const q = ` ${String(question || "").toUpperCase().replace(/[^A-Z0-9 ]+/g, " ")} `;
  const teams = new Set();
  for (const [name, abbr] of Object.entries(aliases[league] || {})) {
    if (q.includes(` ${name} `)) teams.add(abbr);
  }
  const knownAbbrs = new Set(Object.values(aliases[league] || {}));
  for (const abbr of knownAbbrs) {
    if (q.includes(` ${abbr} `)) teams.add(abbr);
  }
  return [...teams];
}

function teamsFromProps(props) {
  const teams = new Set();
  for (const prop of props || []) {
    const team = String(prop?.team || prop?.teamAbbr || "").toUpperCase();
    const opponent = String(prop?.opponent || prop?.opp || "").toUpperCase();
    if (team) teams.add(team);
    if (opponent) teams.add(opponent);
    if (teams.size >= 2) break;
  }
  return [...teams];
}

async function fetchFocusedRosterData(question, league, props) {
  const focusTeams = teamsFromQuestion(question, league);
  const teams = focusTeams.length ? focusTeams : teamsFromProps(props);
  if (!teams.length || !fetchEspnRosters) return null;

  const rosterPromise = fetchEspnRosters(league, teams.slice(0, 2));
  const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 6500));
  const rosters = await Promise.race([rosterPromise, timeoutPromise]);
  if (!rosters || !Object.keys(rosters).length) return null;
  return { [league]: rosters };
}

function validatePropsAgainstRosters(props, rosterData, league) {
  if (!props || props.length === 0 || !rosterData || !rosterData[league]) return props;

  const validatedProps = props.map(prop => {
    const teamRosters = rosterData[league];
    const teamKey = prop.team ? Object.keys(teamRosters).find(key =>
      teamRosters[key].abbreviation === prop.team
    ) : null;

    const teamRoster = teamKey ? teamRosters[teamKey] : null;
    const playerExists = teamRoster ? teamRoster.roster.some(p =>
      p.name.toLowerCase() === (prop.player || '').toLowerCase()
    ) : null;

    if (playerExists === false) {
      prop._validation_warning = `⚠️ ${prop.player} not found in current ${prop.team} roster`;
    }
    return prop;
  });

  return validatedProps;
}

function extractInjuriesFromArticles(articleContext) {
  if (!articleContext) return [];

  const injuries = [];
  // Match patterns like "Player is out", "sidelined with", "injury status", "questionable", "doubtful", "out indefinitely"
  const injuryPatterns = [
    /(\w+\s+\w+)\s+(?:is\s+)?(?:out|sidelined|ruled out|questionable|doubtful|day-to-day)\s+(?:with|due to|from)?\s+([^.,]+)/gi,
    /(\w+\s+\w+)\s+(?:suffered|sustained)\s+(?:an?\s+)?([^.,]+)/gi,
  ];

  injuryPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(articleContext)) !== null) {
      injuries.push({
        player: match[1],
        status: match[2] || 'injured',
        source: 'article'
      });
    }
  });

  return injuries;
}

function compactPropsForClaude(props) {
  return (props || []).slice(0, 18).map((p) => ({
    player: p.player || p.name || "",
    team: p.team || p.teamAbbr || "",
    opponent: p.opponent || p.opp || "",
    league: p.league || "",
    market: p.market || p.stat || p.prop_type || "",
    line: p.line ?? p.point ?? p.points ?? "",
    side: p.side || p.direction || "",
    book: p.book || p.sportsbook || "",
    odds: p.odds ?? p.price ?? "",
    edge: p.edge ?? p.bet_edge ?? "",
    propiq: p.propiq ?? p.prop_iq ?? p.prop_iq_score ?? p.modelScore ?? p.score ?? p.PropIQ ?? "",
    probability: p.probability ?? p.model_probability ?? "",
    confidence: p.confidence ?? "",
    risk: p.risk_notes || p.risk || "",
  })).filter((p) => p.player || p.team || p.market);
}

function normalizeToken(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

function uniqueClean(values) {
  return [...new Set((values || []).map((v) => String(v || "").trim()).filter(Boolean))];
}

function teamsFromProps(props, league) {
  const out = [];
  for (const p of props || []) {
    if (!p || String(p.league || "").toUpperCase() !== String(league || "").toUpperCase()) continue;
    if (p.team) out.push(String(p.team).toUpperCase());
    if (p.opponent) out.push(String(p.opponent).toUpperCase());
    if (p.opp) out.push(String(p.opp).toUpperCase());
  }
  return uniqueClean(out).slice(0, 6);
}

function isLikelyOffSportNoise(text) {
  const t = normalizeToken(text);
  return /(monmouth park|renegade|speed figure|thoroughbred|horse racing|earnings 2026 wins)/i.test(t);
}

function articleRelevanceScore(article, teams, leagueTokens) {
  const hay = normalizeToken(
    `${article?.title || ""} ${article?.summary || ""} ${article?.article_excerpt || ""} ${article?.url || ""} ${article?.source || ""}`
  );
  if (!hay) return -999;
  if (isLikelyOffSportNoise(hay)) return -500;
  let score = 0;
  for (const t of teams) {
    const n = normalizeToken(t);
    if (!n) continue;
    if (hay.includes(n)) score += 8;
  }
  for (const tok of leagueTokens) {
    if (hay.includes(tok)) score += 2;
  }
  if (/\binjury|lineup|out|questionable|odds|best bet|pick|preview|matchup|series|game\b/i.test(hay)) score += 2;
  return score;
}

function buildGameScopedNewsContext(newsContext, question, props, league) {
  const questionTeams = teamsFromQuestion(question, league) || [];
  const propTeams = teamsFromProps(props, league);
  const teams = uniqueClean([...(newsContext?.teams || []), ...questionTeams, ...propTeams]).slice(0, 6);
  const leagueTokens = {
    NBA: ["nba", "basketball", "playoff", "western conference", "eastern conference"],
    NFL: ["nfl", "football", "afc", "nfc"],
    MLB: ["mlb", "baseball", "innings", "pitcher"],
    NHL: ["nhl", "hockey", "stanley cup"],
  }[String(league || "NBA").toUpperCase()] || [String(league || "").toLowerCase()];

  const ranked = (newsContext?.articles || [])
    .map((a) => ({ a, score: articleRelevanceScore(a, teams, leagueTokens) }))
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score)
    .map((x) => x.a);

  const top = ranked.slice(0, 3);
  const headline = top.map((a) => `${a.source || "Source"}: ${String(a.title || a.summary || "").slice(0, 120)}`).join(" | ");
  const seriesState = teams.length >= 2
    ? `Matchup focus ${teams[0]} vs ${teams[1]} (${String(league || "NBA").toUpperCase()}); using ${top.length || 0} matchup-relevant news items and current board context.`
    : `Matchup focus for ${String(league || "NBA").toUpperCase()}; using ${top.length || 0} relevant news items and current board context.`;

  const lines = top.map((a) => `- ${a.source || "Source"}: ${String(a.summary || a.article_excerpt || a.title || "").slice(0, 240)}`);
  return { teams, top, headline, seriesState, lines };
}

function sourceContextToArticleBlock(sourceContext, question, league) {
  const q = String(question || "").toLowerCase();
  const teams = teamsFromQuestion(question, league);
  const terms = new Set(teams.map((t) => String(t).toLowerCase()));
  q.split(/\s+/).filter((w) => w.length >= 4).slice(0, 12).forEach((w) => terms.add(w));
  const lines = [];
  for (const item of (sourceContext || [])) {
    if (!item || item.source === "ESPN Team Profile") continue;
    const text = String(item.article_excerpt || item.excerpt || item.summary || item.description || "").replace(/\s+/g, " ").trim();
    if (!text) continue;
    const hay = `${text} ${item.title || ""} ${item.url || ""}`.toLowerCase();
    if (terms.size && ![...terms].some((term) => hay.includes(term))) continue;
    lines.push(`- ${item.source || "Source"}${item.title ? `: ${item.title}` : ""}\n  Excerpt: ${text.slice(0, 420)}${item.url ? `\n  URL: ${item.url}` : ""}`);
    if (lines.length >= 5) break;
  }
  return lines.length ? `PUBLIC ARTICLE / NEWS EXCERPTS:\n${lines.join("\n")}` : "";
}

function trimMessagesToBudget(messages) {
  return messages.map((msg) => {
    if (String(msg.content || "").length <= MAX_INPUT_CHARS) return msg;
    return { ...msg, content: String(msg.content || "").slice(0, MAX_INPUT_CHARS) + "\n\n[Context trimmed to avoid serverless timeout]" };
  });
}

function buildStructuredFallback(question, league, props, sourceContext, reason) {
  const compact = compactPropsForClaude(props);
  const top = compact.slice(0, 3);
  const sources = [...new Set((sourceContext || []).filter((s) => s?.source).map((s) => s.source))].join(", ") || "PropEdge board";
  const propLines = top.length
    ? top.map((p) => `${String(p.player || "PLAYER").toUpperCase()} ${p.side || "O/U"} ${p.line || "line"} ${p.market || "prop"}\n• PropEdge edge: ${p.edge || "n/a"} | PropIQ: ${p.propiq || "n/a"} | Confidence: ${p.confidence || p.probability || "n/a"}\n• Use only if the current book price still matches the board.`).join("\n\n")
    : "No player prop rows were attached. Provide matchup-level analysis only until current sportsbook rows load.";
  const parlay = top.length >= 2
    ? top.slice(0, 3).map((p) => `${p.player} ${p.side || ""} ${p.line || ""} ${p.market || ""}`.replace(/\s+/g, " ").trim()).join(" + ")
    : "No parlay until at least two verified correlated prop rows are available.";
  const scopedNews = buildGameScopedNewsContext(null, question, props, league);
  return cleanResponseFormat(`TITLE: ${String(question || league || "Requested matchup")} Analysis

SERIES STATE: ${scopedNews.seriesState}

KEY EFFICIENCY METRICS
Team | eFG% | TS% | Pace | ORtg | DRtg
Data unavailable | n/a | n/a | n/a | n/a | n/a
Use live article/news context and PropEdge board data as support once Claude responds.

PLAYER PROP RECOMMENDATIONS

🟢 STRONG OWNS

${propLines}

🧠 VALUE PLAYS

Use PropEdge edges as supplemental confirmation, not the primary thesis. Recheck injuries, lineup status, and market movement before betting.

SERIES PREDICTION & PROP LOGIC

Most Likely: No forced side. The primary Claude read did not complete in time.
• Fallback reason: ${reason}
• Sources available: ${sources}
• PropEdge data should guide recommendations only after the matchup/player context is verified.

OPTIMAL PARLAY

1. ${parlay}
   Joint probability: n/a
   Reasoning: Only build correlated legs from the same game script and verified player availability.`);
}

function buildDeepSynthesisMessages(question, league, props, sourceContext, sourceSummary, rosterData, articleContext = "", newsContext = null) {
  // Dynamic date and season calculation
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  // Season year changes in October (e.g., Oct 2026 = 2026-2027 season)
  const seasonStart = currentMonth >= 9 ? currentYear : currentYear - 1;
  const seasonEnd = seasonStart + 1;
  const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // Validate props against live rosters
  const validatedProps = validatePropsAgainstRosters(props, rosterData, league);

  // Log validation warnings
  validatedProps.forEach(prop => {
    if (prop._validation_warning) {
      console.warn(`VALIDATION: ${prop._validation_warning}`);
    }
  });

  // Format roster data for inclusion + extract injury context
  const rosterContext = rosterData ? formatRostersForContext(rosterData) : "";

  // Extract injured players from rosters + parse from articles
  let injuryContext = "";
  const rosterInjuries = [];
  const articleInjuries = extractInjuriesFromArticles(articleContext);

  // Collect roster injuries
  if (rosterData && Object.keys(rosterData).length > 0) {
    Object.entries(rosterData).forEach(([league, teamData]) => {
      if (!teamData) return;
      Object.entries(teamData).forEach(([teamKey, team]) => {
        if (team.roster && Array.isArray(team.roster)) {
          team.roster.filter(p => p.injured).forEach(p => {
            rosterInjuries.push(`${p.name} (${team.abbreviation}) - roster flagged`);
          });
        }
      });
    });
  }

  // Merge and deduplicate
  const allInjuries = new Map();
  rosterInjuries.forEach(inj => allInjuries.set(inj.split('(')[0].trim(), inj));
  articleInjuries.forEach(inj => {
    const key = inj.player.toLowerCase();
    const existing = [...allInjuries.keys()].find(k => k.toLowerCase().includes(key) || key.includes(k.toLowerCase()));
    if (existing) {
      allInjuries.set(existing, `${existing} - ${inj.status} (from article)`);
    } else {
      allInjuries.set(inj.player, `${inj.player} - ${inj.status} (from article)`);
    }
  });

  if (allInjuries.size > 0) {
    const injuryList = Array.from(allInjuries.values()).join(", ");
    injuryContext = `\n⚠️ INJURY ALERTS: ${injuryList}\n`;
  }

  const systemPrompt = `You are PropEdgeMasters Ask an Analyst for ${dateStr}. Claude is primary. PropEdge props, rosters, and article excerpts are supplemental context only.

CRITICAL: Provide player prop OPTIONS for BOTH TEAMS. Show which props favor the AWAY team, which favor the HOME team, and best overall edges. Include team-level context (form, injuries, trades, news) for both competitors.

Return concise plain text under 750 words. No markdown headings, no **bold**.
Required section headers exactly:
TITLE:
SERIES STATE:
KEY EFFICIENCY METRICS:
TEAM MATCHUP ANALYSIS:
PLAYER PROP RECOMMENDATIONS:
SERIES PREDICTION & PROP LOGIC:
OPTIMAL PARLAY:

PLAYER PROP RECOMMENDATIONS format:
- Group by team advantage (AWAY TEAM PLAYS / HOME TEAM PLAYS / CROSS-TEAM VALUE PLAYS)
- List 2-3 props per group
- Format: PLAYER O/U LINE MARKET (team) | PropIQ: [score] | Confidence: [%] | Edge: [pts]
- 1-2 bullets per prop explaining team matchup advantage and PropIQ edge

TEAM MATCHUP ANALYSIS format:
- [AWAY] Recent form, key injuries, trades, offensive/defensive trends from supplied articles
- [HOME] Recent form, key injuries, trades, offensive/defensive trends from supplied articles
- Comparative advantage explanation

Rules:
- Synthesize article/news context into one game-specific read; include recent form/trades/injuries for BOTH teams.
- SERIES STATE must include the actual matchup teams and one concrete status line (injury, lineup, game/series state, or market shift). Never use generic filler.
- Include PropIQ scores and confidence percentages for all props (use supplied data; don't invent).
- Use supplied PropEdge props only as supporting confirmation for player recommendations.
- If a metric is unknown, write n/a and keep moving.
- Do not invent injuries, odds, or unavailable player lines.
- Always compare both teams; never favor one team without explaining why.`;

  const compactProps = compactPropsForClaude(validatedProps);
  const articleBlock = [
    articleContext,
    sourceContextToArticleBlock(sourceContext, question, league),
  ].filter(Boolean).join("\n\n");

  const scopedNews = buildGameScopedNewsContext(newsContext, question, validatedProps, league);
  const newsBlockContent = newsContext ? `LIVE NEWS CONTEXT (${newsContext.league}):
Teams: ${scopedNews.teams.join(' vs ') || 'Unknown'}
Series state seed: ${scopedNews.seriesState}
Recent matchup headlines: ${scopedNews.headline || 'No matchup-relevant headlines found'}
${scopedNews.lines.length ? `Matchup notes:\n${scopedNews.lines.join('\n')}` : ''}

` : '';

  const userMessage = `${question}
${injuryContext}
${newsBlockContent}${rosterContext ? `CURRENT ROSTERS (from ESPN, ${dateStr}):
${rosterContext}

` : ''}${compactProps.length > 0 ? `Supplemental PropEdge board data (${compactProps.length} props, compacted):
${JSON.stringify(compactProps, null, 2)}

` : ''}${articleBlock ? `${articleBlock}

` : ''}${sourceContext.length > 0 ? `Supporting source names: ${sourceSummary}` : ''}`;

  return trimMessagesToBudget([
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ]);
}

function buildEvDetailSystemPrompt() {
  return [
    'You are a sharp sports betting analyst writing a premium prop report. Your job is to produce a deep, editorial analysis that reads like a professional handicapper — not a data dump.',
    '',
    'CRITICAL INSTRUCTION — USE YOUR FULL KNOWLEDGE:',
    'The PropEdge board payload below gives you ranked props, PropIQ scores, hit rates (L5/L10/L20), edges, and matchup scalars. Use that data as your foundation. Then LAYER IN everything you know from your training data: Statcast percentiles (xSLG, Barrel%, Exit Velocity, Hard-Hit%), platoon splits, pitcher FIP/ERA/K-rate vs. handedness, ballpark factors, lineup context, recent form trends, and any other relevant analytics that strengthen or weaken the case. The goal is analysis that matches what a sharp Gemini-native query would return — rich, specific, numbers-first prose.',
    '',
    'FORMAT RULES:',
    'Output strict JSON only. No markdown code fences wrapping the outer object.',
    'Inside the JSON string values, use rich markdown: **bold**, * bullets, ## section headers.',
    '',
    'matchup_analysis structure:',
    '  ## Top Player Prop Values',
    '  For each pick: **Player (TEAM) — Over/Under X.X Market (+odds)**',
    '  Followed by a 3-5 sentence paragraph citing the board edge + your own analytical depth (percentiles, splits, matchup context, park factors). Write like a linemaker, not a stats scraper.',
    '  Blank line between each pick.',
    '  Optional: ## Game Lines & Totals with 1-2 paragraphs when the board data supports game-market plays.',
    '',
    'key_numbers_breakdown: markdown bullet list of threshold stats, split gates, and edge drivers for the top picks.',
    '',
    'Do not fabricate players, lines, or odds. Only recommend picks that appear in the board payload. All enrichment must come from your training knowledge about real players.',
    '',
    'JSON schema:',
    '{',
    '  "article_title": "string (sharp headline)",',
    '  "featured_intro": "string (3-4 sentence mathematical thesis for the slate)",',
    '  "matchup_analysis": "string (rich markdown as described above)",',
    '  "key_numbers_breakdown": "string (markdown bullet thresholds and splits)",',
    '  "confidence_rating": 8',
    '}'
  ].join('\n');
}

function buildEvDetailMessages(question, league, propedgePayloads, props) {
  const board = (Array.isArray(propedgePayloads) && propedgePayloads.length)
    ? propedgePayloads.slice(0, 8)
    : (Array.isArray(props) ? props.slice(0, 8) : []);
  const userMessage = `${question}

LEAGUE: ${league || 'ALL'}

PROPEDGE BOARD (ranked props with PropIQ, edges, hit rates):
${JSON.stringify(board, null, 2)}

Using the board payload above as your foundation, write a full analyst report. Enrich each pick narrative with relevant Statcast data, splits, pitcher context, and park factors from your training knowledge. Return one raw JSON object matching the schema. Each pick in matchup_analysis must use **Player (TEAM) — Over/Under line Market (odds)** followed by a deep narrative paragraph. If a prop has weak data, say PASS instead of forcing a play.`;

  return trimMessagesToBudget([
    { role: "system", content: buildEvDetailSystemPrompt() },
    { role: "user", content: userMessage },
  ]);
}

function cleanResponseFormat(text) {
  // Remove markdown bold (**text** -> text)
  text = text.replace(/\*\*([^\*]+)\*\*/g, '$1');

  // Convert markdown heading artifacts into the plain structured format requested.
  text = text.replace(/^#{1,6}\s*(.+)$/gm, (m, title) => /^title\s*:/i.test(title) ? title : `TITLE: ${title}`);

  // Remove leading asterisks from lines (artifact from markdown formatting)
  text = text.split('\n').map(line => line.replace(/^\*\s*/, '').trim()).join('\n');

  // Clean up extra whitespace
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

function enforceStructuredResponse(text, question, league, props, sourceContext) {
  let out = cleanResponseFormat(text || "");
  if (!out) return out;
  if (!/^TITLE\s*:/im.test(out)) {
    const lines = out.split("\n");
    const firstContentIndex = lines.findIndex((line) => line.trim());
    if (firstContentIndex >= 0) {
      lines[firstContentIndex] = `TITLE: ${lines[firstContentIndex].replace(/^TITLE\s*:\s*/i, "").trim()}`;
      out = lines.join("\n");
    }
  }
  const required = [
    "TITLE\\s*:",
    "SERIES STATE",
    "KEY EFFICIENCY METRICS",
    "PLAYER PROP RECOMMENDATIONS",
    "SERIES PREDICTION & PROP LOGIC",
    "OPTIMAL PARLAY",
  ];
  const missing = required.filter((section) => !new RegExp(section, "i").test(out));
  if (!missing.length) return out;
  const fallbackShell = buildStructuredFallback(question, league, props, sourceContext, `Claude response missed required section(s): ${missing.join(", ")}`);
  return `${out}\n\nSTRUCTURE COMPLETION\n${fallbackShell}`;
}

exports.handler = async function handler(event) {
  // Hard timeout: 28s (Netlify limit is 30s, leaving 2s buffer for response serialization)
  const HARD_TIMEOUT_MS = 28000;
  let requestTimedOut = false;
  const timeoutHandle = setTimeout(() => {
    requestTimedOut = true;
    console.error("HARD TIMEOUT: Function exceeded 25s");
  }, HARD_TIMEOUT_MS);

  if (event.httpMethod === "OPTIONS") {
    clearTimeout(timeoutHandle);
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  if (event.httpMethod !== "POST") {
    clearTimeout(timeoutHandle);
    return json(405, { error: "Method not allowed" });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const question = body.question || body.prompt || "";
  const league = body.league || "NBA";
  const rawProps = body.props || [];
  const props = Array.isArray(rawProps) ? rawProps.filter(p => p && typeof p === 'object') : [];
  const responseMode = body.response_mode || "";
  const propedgePayloads = Array.isArray(body.propedge_payloads) ? body.propedge_payloads : [];
  const clientOptions = body.options || {};
  let sourceContext = body.source_context || [];
  if (!Array.isArray(sourceContext)) sourceContext = [];

  // Phase 4: News context from client polling
  const newsContext = body.news_context || null;

  const sourceSummary = sourceContext.length
    ? [...new Set(sourceContext.filter(s => s?.source).map(s => s.source))].join(", ")
    : "PropEdge board";

  // Check timeout
  if (requestTimedOut) {
    return json(503, {
      ok: false,
      error: "Request timeout (>25s)",
      provider: "timeout",
    });
  }

  // TEST MODE - return immediately
  if (TEST_MODE) {
    return json(200, {
      ok: true,
      provider: "test",
      model: DEFAULT_MODEL,
      answer: "PropEdge IQ Analysis\n\nTest mode active. Function is responding.",
      source_context: sourceContext,
    });
  }

  // Check API key — only block non-ev_detail requests (ev_detail uses Gemini as primary, not Claude)
  if (!process.env.ANTHROPIC_API_KEY && responseMode !== "ev_detail") {
    return json(200, {
      ok: true,
      error: "ANTHROPIC_API_KEY not configured",
      provider: "claude-fallback",
      model: DEFAULT_MODEL,
      answer: buildStructuredFallback(question, league, props, sourceContext, "Claude API key is not configured"),
    });
  }

  // Check cache
  const cached = getCachedResponse(question, league, props, responseMode);
  if (cached) {
    return json(200, {
      ok: true,
      provider: responseMode === "ev_detail" ? "gemini-cache" : "cache",
      model: responseMode === "ev_detail" ? GEMINI_EV_DETAIL_MODEL : DEFAULT_MODEL,
      answer: cached,
      source_context: sourceContext,
    });
  }

  // Fetch articles asynchronously — don't block Claude call
  let articleContext = "";
  const articleTeams = teamsFromQuestion(question, league);
  const wantsArticleContext = /article|news|analysis|prediction|injury|lineup|preview|best bet|props?/i.test(question);
  const alreadyHasSourceText = sourceContext.some((s) => s?.article_excerpt || s?.excerpt || s?.summary || s?.description);

  if (!alreadyHasSourceText && (wantsArticleContext || articleTeams.length)) {
    try {
      const articlePromise = fetchArticles(articleTeams, league);
      const articleTimeout = new Promise((resolve) => setTimeout(() => resolve([]), 3500));
      const articles = await Promise.race([articlePromise, articleTimeout]);
        if (Array.isArray(articles)) {
          articleContext = formatArticlesForPrompt(articles.slice(0, 3));
          console.log(`[Articles] Fetched ${articles.length} articles for prompt`);
        }
    } catch (err) {
      console.warn("Article fetch failed:", err.message);
    }
  }

  let rosterData = null;
  try {
    rosterData = await fetchFocusedRosterData(question, league, props);
    console.log(rosterData ? `Roster context included for ${league}` : `Roster context unavailable or not requested for ${league}`);
  } catch (err) {
    console.warn(`Roster fetch skipped after failure: ${err.message}`);
    rosterData = null;
  }

  // Build messages with roster data and article context for injury extraction
  const isEvDetail = responseMode === "ev_detail";
  let messages;
  if (isEvDetail) {
    messages = buildEvDetailMessages(question, league, propedgePayloads, props);
  } else {
    messages = buildDeepSynthesisMessages(question, league, props, sourceContext, sourceSummary, rosterData, articleContext, newsContext);
  }

  // Inject articles if available (standard mode only)
  if (!isEvDetail && articleContext && messages.length > 0) {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role === "user") {
      lastMsg.content = `${articleContext}\n\n${lastMsg.content}`;
    }
  }

  // ev_detail: Gemini JSON analyst (primary). Claude structured fallback only for non-ev_detail.
  if (isEvDetail) {
    const geminiOpts = {
      temperature: clientOptions.temperature != null ? clientOptions.temperature : 0.5,
      max_tokens: clientOptions.num_predict || clientOptions.max_tokens || 1500,
    };

    try {
      const answer = await callGeminiEvDetail(messages, geminiOpts);
      setCachedResponse(question, league, props, answer, responseMode);
      return json(200, {
        ok: true,
        provider: "gemini",
        model: GEMINI_EV_DETAIL_MODEL,
        answer,
        source_context: sourceContext,
      });
    } catch (geminiErr) {
      console.error("[ev_detail] Gemini failed:", geminiErr.message);
      try {
        const claudeOpts = {
          temperature: geminiOpts.temperature,
          max_tokens: geminiOpts.max_tokens,
        };
        const response = await callClaudeWithRetry(messages, 1, claudeOpts);
        let answer = stripJsonFence(response?.content?.[0]?.text || "");
        if (!answer) throw new Error("Claude ev_detail backup returned empty response");
        setCachedResponse(question, league, props, answer, responseMode);
        return json(200, {
          ok: true,
          provider: "claude",
          model: DEFAULT_MODEL,
          answer,
          source_context: sourceContext,
          fallback_reason: `Gemini unavailable: ${geminiErr.message}`,
        });
      } catch (claudeErr) {
        console.error("[ev_detail] Claude backup failed:", claudeErr.message);
        return json(200, {
          ok: false,
          provider: "gemini-fallback",
          model: GEMINI_EV_DETAIL_MODEL,
          error: geminiErr.message,
          answer: "",
          source_context: sourceContext,
        });
      }
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  // Call Claude (no retries — 25s hard limit doesn't allow time for backoff + retry)
  try {
    const claudeOpts = {};
    const response = await callClaudeWithRetry(messages, 1, claudeOpts);
    let answer = (response?.content?.[0]?.text || "").trim();

    if (!answer) {
      return json(200, {
        ok: false,
        error: "Empty response from Claude",
        answer: "PropEdge IQ Analysis\n\nError: Claude API returned empty response.\n\nThis may indicate:\n- API timeout\n- Message formatting issue\n- Model unavailable\n\nPlease check function logs: https://app.netlify.com/projects/propedgemasters/logs/functions",
      });
    }

    answer = enforceStructuredResponse(answer, question, league, props, sourceContext);

    setCachedResponse(question, league, props, answer, responseMode);

    return json(200, {
      ok: true,
      provider: "claude",
      model: DEFAULT_MODEL,
      answer,
      source_context: sourceContext,
      article_context_included: articleContext.length > 0 || sourceContext.some((s) => s?.article_excerpt || s?.summary || s?.excerpt),
      usage: {
        input_tokens: response?.usage?.input_tokens,
        output_tokens: response?.usage?.output_tokens,
      },
    });
  } catch (error) {
    console.error("CLAUDE API ERROR:", error.message, error.stack);
    const diagnosticAnswer = buildStructuredFallback(question, league, props, sourceContext, error.message);

    return json(200, {
      ok: true,
      provider: "claude-fallback",
      model: DEFAULT_MODEL,
      error: error.message,
      circuit_status: CLAUDE_CIRCUIT.isOpen ? "OPEN" : "CLOSED",
      answer: diagnosticAnswer,
      article_context_included: articleContext.length > 0 || sourceContext.some((s) => s?.article_excerpt || s?.summary || s?.excerpt),
    });
  } finally {
    clearTimeout(timeoutHandle);
  }
};
