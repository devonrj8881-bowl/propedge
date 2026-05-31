/**
 * league-news.js
 * Aggregates game context + article summaries for PropAI news panel
 * Called by refreshLeagueNews() in index.html
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json",
};

const TIMEOUT_MS = 5000;

async function fetchWithTimeout(url, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "PropEdgeMasters/1.0",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function cleanText(str) {
  return String(str || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitle(html) {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  if (og) return cleanText(og[1]).slice(0, 120);
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return title ? cleanText(title[1]).slice(0, 120) : "Article";
}

function extractSummary(html) {
  const og = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
  if (og) return cleanText(og[1]).slice(0, 200);
  const desc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
  if (desc) return cleanText(desc[1]).slice(0, 200);
  const text = cleanText(html);
  const para = text.match(/[A-Z][^.!?]+[.!?]/);
  return para ? para[0].slice(0, 200) : "Sports news";
}

async function fetchNewsArticle(url, source) {
  try {
    const html = await fetchWithTimeout(url, 3000);
    return {
      url,
      source,
      league: "NBA",
      title: extractTitle(html),
      summary: extractSummary(html),
      status: "ok",
    };
  } catch (err) {
    return {
      url,
      source,
      league: "NBA",
      title: "Article unavailable",
      summary: err.message,
      status: "error",
    };
  }
}

// Sample game context URLs
const GAME_SOURCES = {
  NBA: [
    {
      source: "ESPN",
      url: "https://www.espn.com/nba/",
      league: "NBA",
    },
    {
      source: "CBS Sports",
      url: "https://www.cbssports.com/nba/news/",
      league: "NBA",
    },
  ],
  NFL: [
    {
      source: "ESPN",
      url: "https://www.espn.com/nfl/",
      league: "NFL",
    },
  ],
  MLB: [
    {
      source: "ESPN",
      url: "https://www.espn.com/mlb/",
      league: "MLB",
    },
  ],
  NHL: [
    {
      source: "ESPN",
      url: "https://www.espn.com/nhl/",
      league: "NHL",
    },
  ],
};

const NEWS_SOURCES = {
  NBA: [
    {
      source: "Covers",
      url: "https://www.covers.com/nba/betting-news",
      league: "NBA",
    },
    {
      source: "CBS SportsLine",
      url: "https://www.cbssports.com/nba/news/",
      league: "NBA",
    },
  ],
  NFL: [
    {
      source: "Covers",
      url: "https://www.covers.com/nfl/betting-news",
      league: "NFL",
    },
    {
      source: "CBS SportsLine",
      url: "https://www.cbssports.com/nfl/news/",
      league: "NFL",
    },
  ],
  MLB: [
    {
      source: "Covers",
      url: "https://www.covers.com/mlb/betting-news",
      league: "MLB",
    },
    {
      source: "CBS SportsLine",
      url: "https://www.cbssports.com/mlb/news/",
      league: "MLB",
    },
  ],
  NHL: [
    {
      source: "Covers",
      url: "https://www.covers.com/nhl/betting-news",
      league: "NHL",
    },
    {
      source: "CBS SportsLine",
      url: "https://www.cbssports.com/nhl/news/",
      league: "NHL",
    },
  ],
};

exports.handler = async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  const league = (event.queryStringParameters?.league || "NBA").toUpperCase();
  const validLeagues = ["NBA", "NFL", "MLB", "NHL"];

  if (!validLeagues.includes(league)) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Invalid league" }),
    };
  }

  try {
    // Fetch game context + articles in parallel
    const games = [];
    const articles = [];
    const sources = [];

    // Game sources (lighter, just metadata)
    const gameSources = GAME_SOURCES[league] || [];
    for (const gameSrc of gameSources.slice(0, 1)) {
      sources.push({ name: gameSrc.source, status: "ok" });
      games.push({
        source: gameSrc.source,
        league,
        matchup: `${league} Games Today`,
        score: "Live scores",
        status: "Check ESPN for live games",
        headlines: [`Visit ${gameSrc.source} for live updates`],
        url: gameSrc.url,
      });
    }

    // Article sources
    const newsSources = NEWS_SOURCES[league] || [];
    const articlePromises = newsSources.slice(0, 3).map((src) =>
      fetchNewsArticle(src.url, src.source).catch(() => ({
        source: src.source,
        league,
        title: "Unable to fetch articles",
        summary: "Check source website directly",
        status: "error",
        url: src.url,
      }))
    );

    const fetchedArticles = await Promise.all(articlePromises);
    articles.push(...fetchedArticles.filter((a) => a.status === "ok"));
    sources.push(
      ...newsSources.slice(0, 3).map((s) => ({
        name: s.source,
        status: fetchedArticles.find((a) => a.source === s.source)?.status === "ok" ? "ok" : "limited",
      }))
    );

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        ok: true,
        league,
        games: games.slice(0, 8),
        articles: articles.slice(0, 12),
        sources: sources.slice(0, 6),
        updated_at: new Date().toISOString(),
      }),
    };
  } catch (err) {
    console.error("[league-news]", err.message);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        ok: false,
        league,
        games: [],
        articles: [],
        sources: [],
        updated_at: new Date().toISOString(),
        error: err.message,
      }),
    };
  }
};
