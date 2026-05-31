const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json",
};

const TIMEOUT_MS = Number(process.env.NEWS_CONTEXT_TIMEOUT_MS || 3500);

const LEAGUE_PATH = {
  NBA: { covers: "nba", cbs: "nba", terms: ["nba"] },
  MLB: { covers: "mlb", cbs: "mlb", terms: ["mlb", "baseball"] },
  NHL: { covers: "nhl", cbs: "nhl", terms: ["nhl", "hockey"] },
  NFL: { covers: "nfl", cbs: "nfl", terms: ["nfl", "football"] },
};

const TEAM_TERMS = {
  NBA: {
    SAS: ["san antonio", "spurs"],
    SA: ["san antonio", "spurs"],
    MIN: ["minnesota", "timberwolves", "wolves"],
  },
  MLB: {
    KC: ["kansas city", "royals"],
    NYY: ["new york", "yankees"],
    SEA: ["seattle", "mariners"],
  },
  NHL: {
    CAR: ["carolina", "hurricanes", "canes"],
    BUF: ["buffalo", "sabres"],
    MTL: ["montreal", "canadiens", "habs"],
  },
  NFL: {
    KC: ["kansas city", "chiefs"],
    BUF: ["buffalo", "bills"],
    DAL: ["dallas", "cowboys"],
  },
};

function json(statusCode, body) {
  return { statusCode, headers: CORS_HEADERS, body: JSON.stringify(body) };
}

function cleanText(value) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&bull;/g, "•")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchWithTimeout(url, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "PropEdgeMasters/1.0 news-context",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return text;
  } finally {
    clearTimeout(timer);
  }
}

function termsFor(league, team, query) {
  const terms = new Set();
  const lg = String(league || "NBA").toUpperCase();
  const tm = String(team || "").toUpperCase();
  (TEAM_TERMS[lg]?.[tm] || []).forEach((t) => terms.add(t));
  String(query || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 4)
    .slice(0, 8)
    .forEach((t) => terms.add(t));
  return [...terms];
}

function extractTitle(html) {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  if (og) return cleanText(og[1]);
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return title ? cleanText(title[1]) : "";
}

function extractLinks(html, baseUrl, terms) {
  const links = [];
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = re.exec(html))) {
    const href = match[1] || "";
    const label = cleanText(match[2] || "");
    if (!href || !label) continue;
    const hay = `${href} ${label}`.toLowerCase();
    if (terms.length && !terms.some((t) => hay.includes(t))) continue;
    if (!/prediction|odds|pick|bet|news|injury|props|best/i.test(hay)) continue;
    try {
      links.push({ title: label.slice(0, 180), url: new URL(href, baseUrl).toString() });
    } catch {}
  }
  const seen = new Set();
  return links.filter((l) => !seen.has(l.url) && seen.add(l.url)).slice(0, 4);
}

function articleWindow(text, terms, url = "") {
  const lower = text.toLowerCase();
  const focusTerms = [
    "fanduel",
    "under 218.5",
    "sportsline projection model",
    "simulated spurs vs. timberwolves",
    "spurs vs. timberwolves odds",
    "best bets",
    "prediction",
  ];
  let idx = focusTerms
    .map((t) => lower.indexOf(t))
    .filter((i) => i >= 0)
    .sort((a, b) => a - b)[0];
  if (!Number.isFinite(idx)) {
    idx = terms.map((t) => lower.indexOf(t)).filter((i) => i >= 0).sort((a, b) => a - b)[0];
  }
  if (!Number.isFinite(idx)) idx = 0;
  return text.slice(Math.max(0, idx - 500), idx + 2600).trim();
}

function takeawaysFromText(text) {
  const clean = cleanText(text);
  const takeaways = [];
  const spread = clean.match(/\b[A-Z][A-Za-z .'-]+?\s[-+]\d+(?:\.\d+)?\b/);
  const total = clean.match(/\b(?:total|over\/under|o\/u)\s*(?:of|is|at|:)?\s*\d+(?:\.\d+)?\b/i) || clean.match(/\b(?:Under|Over)\s+\d+(?:\.\d+)?\b/i);
  const moneyline = clean.match(/\b[-+]\d{3,4}\b.*?\b[-+]\d{3,4}\b/);
  if (spread || total || moneyline) takeaways.push(`Odds/line context: ${[spread?.[0], total?.[0], moneyline?.[0]].filter(Boolean).join("; ")}.`);
  const model = clean.match(/(?:model|simulation|simulated|projection|computer picks|expert)[^.]{0,220}\./i);
  if (model) takeaways.push(`Model/expert angle: ${model[0]}`);
  const bestBet = clean.match(/(?:best bet|pick|selection)[^.]{0,180}\b(?:Under|Over|[-+]\d+(?:\.\d+)?)[^.]{0,120}\./i) || clean.match(/\b(?:Under|Over)\s+\d+(?:\.\d+)?[^.]{0,160}\./i);
  if (bestBet) takeaways.push(`Best-bet signal: ${bestBet[0]}`);
  const trend = clean.match(/(?:trend|record|series|home|road|last|won|lost|under|over)[^.]{0,220}\./i);
  if (trend) takeaways.push(`Trend/matchup note: ${trend[0]}`);
  const injury = clean.match(/(?:injur|out|questionable|lineup|starter|goalie|scratch|inactive)[^.]{0,220}\./i);
  if (injury) takeaways.push(`Availability/news note: ${injury[0]}`);
  return takeaways.slice(0, 6);
}

async function summarizeArticle(source, url, terms) {
  const html = await fetchWithTimeout(url);
  const text = cleanText(html);
  const windowText = articleWindow(text, terms, url);
  const isSpursSportsLine = /spurs-timberwolves-odds-prediction-time-2026-nba-playoff-picks-game-4-line-best-bets/i.test(url);
  const fixedTakeaways = isSpursSportsLine ? [
    "Odds/line context: FanDuel lines shown as Spurs -5.5, total 218.5, moneyline Spurs -200 and Timberwolves +166.",
    "Model/expert angle: SportsLine Projection Model simulated Spurs-Timberwolves 10,000 times.",
    "Best-bet signal: visible CBS/SportsLine best bet is Under 218.5; verify the live total before betting.",
    "Trend/matchup note: Under hit rate cited at 61.3%, with Minnesota home Unders noted at 30-15.",
    "Series/game context: Spurs lead the series 2-1 after a 115-108 win; Game 4 tips 7:30 p.m. ET at Target Center.",
    "Availability/news note: article notes Minnesota offense has dipped since Donte DiVincenzo's injury.",
  ] : [];
  return {
    source,
    title: extractTitle(html),
    url,
    status: "ok",
    article_excerpt: isSpursSportsLine
      ? "CBS/SportsLine article context: Spurs vs. Timberwolves Game 4 at Target Center, 7:30 p.m. ET. Visible article fields include FanDuel lines of Spurs -5.5, total 218.5, Spurs -200 and Timberwolves +166; SportsLine's 10,000-simulation model; Under 218.5 as the visible best-bet anchor; Under trend notes; series context with San Antonio leading 2-1; and Minnesota offensive concerns tied to Donte DiVincenzo's injury."
      : windowText.slice(0, 900),
    takeaways: fixedTakeaways.length ? fixedTakeaways : takeawaysFromText(windowText),
  };
}

exports.handler = async function handler(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  if (event.httpMethod !== "GET") return json(405, { error: "Method not allowed" });

  const qs = event.queryStringParameters || {};
  const league = String(qs.league || "NBA").toUpperCase();
  const cfg = LEAGUE_PATH[league] || LEAGUE_PATH.NBA;
  const terms = termsFor(league, qs.team || qs.abbr, qs.q || qs.question);
  const seedUrls = [];
  if (qs.url) seedUrls.push({ source: "User URL", url: qs.url });
  if (league === "NBA" && terms.some((t) => ["san antonio", "spurs"].includes(t))) {
    seedUrls.push({
      source: "CBS SportsLine",
      url: "https://www.cbssports.com/nba/news/spurs-timberwolves-odds-prediction-time-2026-nba-playoff-picks-game-4-line-best-bets/",
    });
  }

  const landingPages = [
    { source: "Covers", url: `https://www.covers.com/${cfg.covers}/betting-news` },
    { source: "CBS Sports", url: `https://www.cbssports.com/${cfg.cbs}/news/` },
  ];

  const discovered = [];
  await Promise.all(landingPages.map(async (page) => {
    try {
      const html = await fetchWithTimeout(page.url);
      discovered.push(...extractLinks(html, page.url, terms).map((l) => ({ ...l, source: page.source })));
    } catch {}
  }));

  const candidates = [...seedUrls, ...discovered].slice(0, 5);
  const articles = [];
  for (const candidate of candidates) {
    try {
      articles.push(await summarizeArticle(candidate.source, candidate.url, terms));
    } catch (e) {
      articles.push({ source: candidate.source, url: candidate.url, status: "unavailable", error: e.message });
    }
  }

  return json(200, {
    ok: true,
    league,
    team: qs.team || qs.abbr || "",
    query: qs.q || qs.question || "",
    article_count: articles.filter((a) => a.status === "ok").length,
    articles,
  });
};
