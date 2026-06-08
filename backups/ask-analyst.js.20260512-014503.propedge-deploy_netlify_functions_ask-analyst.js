// Load environment variables
require("dotenv").config();

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
let fetchAllRosters, formatRostersForContext;
try {
  const rostersModule = require('./fetch-current-rosters');
  fetchAllRosters = rostersModule.fetchAllRosters;
  formatRostersForContext = rostersModule.formatRostersForContext;
} catch (e) {
  fetchAllRosters = async () => null;
  formatRostersForContext = () => "";
}

// Import Claude SDK
let Anthropic;
let claudeClient;
try {
  Anthropic = require("@anthropic-ai/sdk");
  console.log('DEBUG: ANTHROPIC_API_KEY is', process.env.ANTHROPIC_API_KEY ? 'SET' : 'UNDEFINED');
  console.log('DEBUG: Key length:', (process.env.ANTHROPIC_API_KEY || '').length);
  console.log('DEBUG: Key starts with:', (process.env.ANTHROPIC_API_KEY || '').substring(0, 20));
  claudeClient = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
  console.log('DEBUG: Claude SDK initialized successfully');
} catch (err) {
  console.error('FATAL: Claude SDK initialization failed:', err.message);
  claudeClient = null;
}

const DEFAULT_MODEL = "claude-sonnet-4-6";
const DEFAULT_TIMEOUT_MS = Number(process.env.CLAUDE_TIMEOUT_MS || 15000); // 15s for Netlify 30s limit, no retries

// Circuit breaker
const CLAUDE_CIRCUIT = { isOpen: false, failureCount: 0, lastFailureTime: 0 };
const CIRCUIT_FAILURE_THRESHOLD = 3;
const CIRCUIT_COOLDOWN_MS = 60000;
const RESPONSE_CACHE = new Map();
const CACHE_TTL_MS = 3600000;

function getCacheKey(question, league, props) {
  const propStr = props.length > 0 ? `${props[0]?.player || ''}|${props.length}` : '';
  return `${question.toLowerCase().slice(0, 50)}|${league}|${propStr}`.replace(/[^\w|]/g, '');
}

function getCachedResponse(question, league, props) {
  const key = getCacheKey(question, league, props);
  const cached = RESPONSE_CACHE.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.answer;
  }
  RESPONSE_CACHE.delete(key);
  return null;
}

function setCachedResponse(question, league, props, answer) {
  const key = getCacheKey(question, league, props);
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

async function callClaudeWithRetry(messages, maxAttempts = 3) {
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
        max_tokens: 1024,
        temperature: 0.1,
        messages: userMessages,
      };

      if (systemMessage) {
        payload.system = systemMessage;
      }

      // Add timeout using Promise.race
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Claude API timeout (${DEFAULT_TIMEOUT_MS}ms)`)), DEFAULT_TIMEOUT_MS)
      );

      const response = await Promise.race([
        claudeClient.messages.create(payload),
        timeoutPromise,
      ]);
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

function json(statusCode, body) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

function teamsFromQuestion(question, league) {
  const aliases = {
    NBA: { LAKERS: "LAL", CELTICS: "BOS", DUCKS: "ANA", KNIGHTS: "VGK", CAVALIERS: "CLE", PISTONS: "DET" },
    NHL: { DUCKS: "ANA", KNIGHTS: "VGK", CELTICS: "BOS" },
  };
  const q = ` ${String(question || "").toUpperCase().replace(/[^A-Z0-9 ]+/g, " ")} `;
  const teams = new Set();
  for (const [name, abbr] of Object.entries(aliases[league] || {})) {
    if (q.includes(` ${name} `)) teams.add(abbr);
  }
  return [...teams];
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

function buildDeepSynthesisMessages(question, league, props, sourceContext, sourceSummary, rosterData, articleContext = "") {
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

  const systemPrompt = `You are PropEdgeMasters Ask an Analyst—expert sports analysis for ${dateStr} (${seasonStart}-${seasonEnd} season).

CONTEXT: Date: ${dateStr} | Leagues: NBA, NHL, MLB | Your role: expert analysis grounded in current rosters, lineups, matchups.

${rosterContext ? `ROSTER AUTHORITY (${dateStr}):
${rosterContext}
If your knowledge conflicts with roster data above, the above data is authoritative. Never assert a player on a team if roster data shows them elsewhere.` : "Use your best current knowledge of rosters."}

ANALYSIS: Lead with YOUR assessment. Integrate PropEdge board data to confirm. Use past context only to explain WHY, not predict WHAT. Anchor in current reality (${dateStr}).

RESPONSE FORMAT — STRUCTURED ANALYSIS (REQUIRED)

1. TITLE: "[AWAY] vs [HOME] Series/Game Matchup Analysis (Game #, Date)"

2. SERIES STATE: One-line summary of series position and stakes

3. KEY EFFICIENCY METRICS (if series/multi-game):
   Team | eFG% | TS% | Pace | ORtg | DRtg
   [data] | [%] | [%] | [#] | [#] | [#]
   [data] | [%] | [%] | [#] | [#] | [#]
   Then 1-2 sentences of context.

4. PLAYER PROP RECOMMENDATIONS (Game #)

   🟢 STRONG OWNS

   [PLAYER] O/U [LINE] 💪
   • [Key metric]
   • [Trend/pattern]
   • [Matchup context]
   • Confidence: [X]% | Edge: [+X pts]

   🧠 VALUE PLAYS

   [PLAYER] O/U [LINE] [emoji]
   • [Key metric]
   • [Context]
   • Confidence: [X]% | Edge: [+X pts]

5. SERIES PREDICTION & PROP LOGIC

   Most Likely: [PREDICTION] ([X-X]% implied), [outcome].
   • [Reason 1]
   • [Reason 2]
   • [Reason 3]

6. OPTIMAL PARLAY FOR GAME [#]

   1. [Prop 1] + [Prop 2] + [Prop 3]
      Joint probability: ~X% (combined multiplier)
      Reasoning

RULES: NO markdown (no **, ##, ###). Emojis: 💪 elite, 🔥 hot, 🧠 value, ⚠️ risk. Bullet points ONLY in analysis sections. Player names ALL CAPS on prop lines. Section headers plain text.`;

  const userMessage = `${question}
${injuryContext}
${rosterContext ? `CURRENT ROSTERS (from ESPN, ${dateStr}):
${rosterContext}

` : ''}${validatedProps.length > 0 ? `Supplemental PropEdge board data (${validatedProps.length} props):
${JSON.stringify(validatedProps, null, 2)}

` : ''}${sourceContext.length > 0 ? `Supporting context & news: ${sourceSummary}` : ''}`;

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ];
}

let globalTimeoutFired = false;

function cleanResponseFormat(text) {
  // Remove markdown bold (**text** -> text)
  text = text.replace(/\*\*([^\*]+)\*\*/g, '$1');

  // Remove leading asterisks from lines (artifact from markdown formatting)
  text = text.split('\n').map(line => line.replace(/^\*\s*/, '').trim()).join('\n');

  // Clean up extra whitespace
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

exports.handler = async function handler(event) {
  // Hard timeout: 25s (Netlify limit is 30s, leaving 5s buffer)
  const HARD_TIMEOUT_MS = 25000;
  const timeoutHandle = setTimeout(() => {
    globalTimeoutFired = true;
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
  let sourceContext = body.source_context || [];
  if (!Array.isArray(sourceContext)) sourceContext = [];

  const sourceSummary = sourceContext.length
    ? [...new Set(sourceContext.filter(s => s?.source).map(s => s.source))].join(", ")
    : "PropEdge board";

  // Check timeout
  if (globalTimeoutFired) {
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

  // Check API key
  if (!process.env.ANTHROPIC_API_KEY) {
    return json(200, {
      ok: false,
      error: "ANTHROPIC_API_KEY not configured",
      provider: "error",
      answer: "PropEdge IQ Analysis\n\nConfiguration Error: ANTHROPIC_API_KEY environment variable not set on Netlify.\n\nPlease verify:\n- Netlify site environment variables are configured\n- ANTHROPIC_API_KEY is deployed to production\n\nFunction logs: https://app.netlify.com/projects/propedgemasters/logs/functions",
    });
  }

  // Check cache
  const cached = getCachedResponse(question, league, props);
  if (cached) {
    return json(200, {
      ok: true,
      provider: "cache",
      model: DEFAULT_MODEL,
      answer: cached,
      source_context: sourceContext,
    });
  }

  // SKIP articles — RotoWire/Covers fetching hanging
  let articleContext = "";
  console.log(`Skipping articles fetch (timeout risk)`);

  // SKIP rosters for now — ESPN API hanging causing 504s
  // TODO: Re-enable after adding abort controller for faster failures
  let rosterData = null;
  console.log(`Skipping rosters fetch (ESPN API timeout risk)`);
  rosterData = null;

  // Build messages with roster data and article context for injury extraction
  const messages = buildDeepSynthesisMessages(question, league, props, sourceContext, sourceSummary, rosterData, articleContext);

  // Inject articles if available
  if (articleContext && messages.length > 0) {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role === "user") {
      lastMsg.content = `${articleContext}\n\n${lastMsg.content}`;
    }
  }

  // Call Claude (no retries — 25s hard limit doesn't allow time for backoff + retry)
  try {
    const response = await callClaudeWithRetry(messages, 1);
    let answer = (response?.content?.[0]?.text || "").trim();

    if (!answer) {
      return json(200, {
        ok: false,
        error: "Empty response from Claude",
        answer: "PropEdge IQ Analysis\n\nError: Claude API returned empty response.\n\nThis may indicate:\n- API timeout\n- Message formatting issue\n- Model unavailable\n\nPlease check function logs: https://app.netlify.com/projects/propedgemasters/logs/functions",
      });
    }

    // Clean markdown formatting from response
    answer = cleanResponseFormat(answer);

    setCachedResponse(question, league, props, answer);

    return json(200, {
      ok: true,
      provider: "claude",
      model: DEFAULT_MODEL,
      answer,
      source_context: sourceContext,
      article_context_included: articleContext.length > 0,
      usage: {
        input_tokens: response?.usage?.input_tokens,
        output_tokens: response?.usage?.output_tokens,
      },
    });
  } catch (error) {
    console.error("CLAUDE API ERROR:", error.message, error.stack);
    // Return diagnostic answer so frontend shows what failed
    const diagnosticAnswer = `PropEdge IQ Analysis\n\nClaude API Error: ${error.message}\n\nDiagnostics:\n- Circuit Status: ${CLAUDE_CIRCUIT.isOpen ? "OPEN" : "CLOSED"}\n- Question: ${question}\n- League: ${league}\n\nPlease check function logs at: https://app.netlify.com/projects/propedgemasters/logs/functions`;

    return json(200, {
      ok: false,
      provider: "error",
      error: error.message,
      circuit_status: CLAUDE_CIRCUIT.isOpen ? "OPEN" : "CLOSED",
      answer: diagnosticAnswer, // Include answer so frontend doesn't fall back to Ollama
    });
  } finally {
    clearTimeout(timeoutHandle);
  }
};
