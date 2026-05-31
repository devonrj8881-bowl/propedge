/**
 * PropEdge Article Fetcher — Legal, Multi-Source
 *
 * Fetches sports betting articles from public sources:
 * - ESPN (API)
 * - CBS Sports (public pages)
 * - RotoWire (public pages)
 * - Covers (public pages)
 * - SportsLine (public pages)
 * - SBD (public pages)
 *
 * Legal compliance:
 * - Excerpts only (2-3 sentences max)
 * - Always attribute source
 * - Always link to original
 * - No reproduction of full articles
 */

const https = require("https");
const http = require("http");

const FETCH_TIMEOUT_MS = 3000;
const EXCERPT_MAX_LENGTH = 300; // ~2-3 sentences
const CACHE_TTL_MS = 3600000; // 1 hour

const ARTICLE_CACHE = new Map();

// ============================================================================
// SOURCE CONFIGS
// ============================================================================

const SOURCES = {
  espn: {
    name: "ESPN",
    legal: "free-api",
    color: "#000000",
    fetchFn: fetchEspnArticles,
  },
  cbssports: {
    name: "CBS Sports",
    legal: "public-excerpt",
    color: "#1A1A1A",
    fetchFn: fetchCbsSportsArticles,
  },
  rotowire: {
    name: "RotoWire",
    legal: "public-excerpt",
    color: "#1B5E20",
    fetchFn: fetchRotoWireArticles,
  },
  covers: {
    name: "Covers",
    legal: "public-excerpt",
    color: "#0066CC",
    fetchFn: fetchCoversArticles,
  },
  sportsbettingdime: {
    name: "SBD",
    legal: "public-excerpt",
    color: "#FF6600",
    fetchFn: fetchSbdArticles,
  },
};

// ============================================================================
// UTILITIES
// ============================================================================

function getCacheKey(teams, league) {
  const sorted = Array.isArray(teams) ? teams.sort().join("|") : teams;
  return `${sorted}|${league}|${new Date().toISOString().split("T")[0]}`;
}

async function fetchUrl(url, timeoutMs = FETCH_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const timer = setTimeout(() => {
      req.abort();
      reject(new Error(`Timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    const req = lib.get(url, { timeout: timeoutMs }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        clearTimeout(timer);
        resolve(data);
      });
    });

    req.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function scopeTerms(teams, league) {
  const base = Array.isArray(teams) ? teams : String(teams || "").split(/[\s,|/]+/);
  const terms = new Set(base.map((t) => String(t || "").toLowerCase()).filter((t) => t.length >= 2));
  const aliases = {
    NBA: { LAL: ["lakers", "los angeles"], BOS: ["celtics", "boston"], SAS: ["spurs", "san antonio"], MIN: ["timberwolves", "wolves", "minnesota"], OKC: ["thunder", "oklahoma city"], PHX: ["suns", "phoenix"], NYK: ["knicks"], PHI: ["76ers", "sixers"] },
    NHL: { VGK: ["golden knights", "vegas"], ANA: ["ducks", "anaheim"], EDM: ["oilers"], FLA: ["panthers"], TOR: ["maple leafs", "leafs"], BOS: ["bruins"] },
    MLB: { KC: ["royals", "kansas city"], DET: ["tigers", "detroit"], LAD: ["dodgers"], NYY: ["yankees"], BOS: ["red sox"], CHC: ["cubs"] },
    NFL: { KC: ["chiefs", "kansas city"], DET: ["lions", "detroit"], BUF: ["bills"], PHI: ["eagles"], DAL: ["cowboys"], BAL: ["ravens"] },
  };
  for (const t of [...terms]) {
    (aliases[league]?.[t.toUpperCase()] || []).forEach((a) => terms.add(a));
  }
  return [...terms].filter((t) => t.length >= 3);
}

function articleMatchesTeams(article, teams, league) {
  const terms = scopeTerms(teams, league);
  if (!terms.length) return true;
  const text = `${article.title || ""} ${article.excerpt || ""} ${article.url || ""}`.toLowerCase();
  return terms.some((term) => text.includes(term));
}

function truncateExcerpt(text, maxLength = EXCERPT_MAX_LENGTH) {
  if (text.length <= maxLength) return text;
  const truncated = text.slice(0, maxLength);
  const lastPeriod = truncated.lastIndexOf(".");
  if (lastPeriod > maxLength * 0.7) {
    return truncated.slice(0, lastPeriod + 1);
  }
  return truncated + "...";
}

// ============================================================================
// SOURCE FETCHERS
// ============================================================================

async function fetchEspnArticles(teams, league) {
  try {
    const espnPath = {
      NBA: "basketball/nba",
      NHL: "hockey/nhl",
      MLB: "baseball/mlb",
      NFL: "football/nfl",
    }[league] || "basketball/nba";

    const url = `https://site.api.espn.com/apis/site/v2/sports/${espnPath}/news`;
    const data = JSON.parse(await fetchUrl(url, 2000));
    const articles = (data.articles || []).slice(0, 3).map((article) => ({
      title: article.headline || article.description || "",
      excerpt: truncateExcerpt(article.description || ""),
      url: article.links?.[0]?.href || "",
      source: "ESPN",
      published: article.lastModified || "",
    }));
    return articles.filter((a) => a.excerpt && a.url);
  } catch (e) {
    return [];
  }
}

async function fetchCbsSportsArticles(teams, league) {
  try {
    const leagueMap = { NBA: "nba", NHL: "nhl", MLB: "mlb", NFL: "nfl" };
    const leagueSlug = leagueMap[league] || "nba";
    const url = `https://www.cbssports.com/${leagueSlug}/news`;

    const html = await fetchUrl(url, FETCH_TIMEOUT_MS);
    const clean = stripHtml(html);

    // Extract news snippets (rough parsing)
    const articles = [];
    const snippets = clean.match(/[A-Z][^.!?]{20,200}[.!?]/g) || [];
    for (const snippet of snippets.slice(0, 3)) {
      articles.push({
        title: snippet.slice(0, 60),
        excerpt: truncateExcerpt(snippet),
        url: `https://www.cbssports.com/${leagueSlug}/news`,
        source: "CBS Sports",
        published: new Date().toISOString(),
      });
    }
    return articles;
  } catch (e) {
    return [];
  }
}

async function fetchRotoWireArticles(teams, league) {
  try {
    const leagueMap = { NBA: "nba", NHL: "nhl", MLB: "mlb", NFL: "nfl" };
    const leagueSlug = leagueMap[league] || "nba";
    const url = `https://www.rotowire.com/${leagueSlug}/news`;

    const html = await fetchUrl(url, FETCH_TIMEOUT_MS);
    const clean = stripHtml(html);

    const articles = [];
    const newsItems = clean.match(/[A-Z][^.!?]{20,200}[.!?]/g) || [];
    for (const item of newsItems.slice(0, 3)) {
      articles.push({
        title: item.slice(0, 60),
        excerpt: truncateExcerpt(item),
        url: `https://www.rotowire.com/${leagueSlug}/news`,
        source: "RotoWire",
        published: new Date().toISOString(),
      });
    }
    return articles;
  } catch (e) {
    return [];
  }
}

async function fetchCoversArticles(teams, league) {
  try {
    const leagueMap = { NBA: "nba", NHL: "nhl", MLB: "mlb", NFL: "nfl" };
    const leagueSlug = leagueMap[league] || "nba";
    const url = `https://www.covers.com/${leagueSlug}/news`;

    const html = await fetchUrl(url, FETCH_TIMEOUT_MS);
    const clean = stripHtml(html);

    const articles = [];
    const newsBlocks = clean.match(/[A-Z][^.!?]{20,200}[.!?]/g) || [];
    for (const block of newsBlocks.slice(0, 3)) {
      articles.push({
        title: block.slice(0, 60),
        excerpt: truncateExcerpt(block),
        url: `https://www.covers.com/${leagueSlug}/news`,
        source: "Covers",
        published: new Date().toISOString(),
      });
    }
    return articles;
  } catch (e) {
    return [];
  }
}

async function fetchSbdArticles(teams, league) {
  try {
    const leagueMap = {
      NBA: "nba",
      NHL: "nhl",
      MLB: "mlb",
      NFL: "nfl",
    };
    const leagueSlug = leagueMap[league] || "nba";
    const url = `https://www.sportsbettingdime.com/news/${leagueSlug}`;

    const html = await fetchUrl(url, FETCH_TIMEOUT_MS);
    const clean = stripHtml(html);

    const articles = [];
    const snippets = clean.match(/[A-Z][^.!?]{20,200}[.!?]/g) || [];
    for (const snippet of snippets.slice(0, 3)) {
      articles.push({
        title: snippet.slice(0, 60),
        excerpt: truncateExcerpt(snippet),
        url: `https://www.sportsbettingdime.com/news/${leagueSlug}`,
        source: "SBD",
        published: new Date().toISOString(),
      });
    }
    return articles;
  } catch (e) {
    return [];
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

async function fetchArticles(teams, league) {
  const cacheKey = getCacheKey(teams, league);
  const cached = ARTICLE_CACHE.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.articles;
  }

  // Fetch all sources in parallel with timeout
  const allArticles = await Promise.all(
    Object.values(SOURCES).map((source) =>
      source
        .fetchFn(teams, league)
        .catch(() => [])
    )
  );

  // Flatten, scope to requested teams/matchup, and deduplicate.
  const articles = [];
  const seen = new Set();
  for (const sourceArticles of allArticles) {
    for (const article of sourceArticles) {
      if (!articleMatchesTeams(article, teams, league)) continue;
      const key = `${article.source}|${article.title}`;
      if (!seen.has(key)) {
        seen.add(key);
        articles.push(article);
      }
    }
  }

  // Cache and return
  ARTICLE_CACHE.set(cacheKey, {
    articles,
    timestamp: Date.now(),
  });

  return articles;
}

// ============================================================================
// FORMATTING FOR PROMPT
// ============================================================================

function formatArticlesForPrompt(articles) {
  if (!articles || articles.length === 0) {
    return "No current articles available.";
  }

  let prompt = "PUBLIC ARTICLE / NEWS CONTEXT FOR SYNTHESIS:\nUse these excerpts as supporting context. Do not repeat them source-by-source; consolidate them into one game-specific summary and cite source names.\n";
  for (const article of articles.slice(0, 5)) {
    prompt += `- [${article.source}] ${article.title}\n`;
    prompt += `  "${article.excerpt}"\n`;
    prompt += `  Read: ${article.url}\n\n`;
  }
  return prompt;
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = { fetchArticles, formatArticlesForPrompt };
