/**
 * API-Sports slate bundle — shared cache + budgeted refresh (≤12 calls).
 * Used by api-sports-bundle.js and live-odds.js (read-only cache).
 */

const HOSTS = {
  NBA: { host: 'v1.basketball.api-sports.io', league: 12 },
  NHL: { host: 'v1.hockey.api-sports.io', league: 57 },
  MLB: { host: 'v1.baseball.api-sports.io', league: 1 },
};

const MAX_ODDS_GAMES = 6;
const MIN_REFRESH_MS = 4 * 60 * 60 * 1000;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const DAILY_BUDGET = 100;

let bundleCache = null;
let lastRefreshAt = 0;
let dailyCallsUsed = 0;
let dailyCallsDay = '';

function clean(v) {
  return String(v || '').trim();
}

function normName(v) {
  return clean(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function estDateString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

function seasonFor(league) {
  const y = new Date().getFullYear();
  const m = new Date().getMonth() + 1;
  if (league === 'MLB') return String(y);
  return m >= 10 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

function getApiKey() {
  return process.env.APISPORTS_KEY || process.env.API_SPORTS_KEY || process.env.APISPORTS_API_KEY || '';
}

function trackCall() {
  const day = estDateString();
  if (dailyCallsDay !== day) {
    dailyCallsDay = day;
    dailyCallsUsed = 0;
  }
  dailyCallsUsed += 1;
}

async function fetchJson(host, pathname, apiKey) {
  trackCall();
  const url = `https://${host}${pathname}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, {
      headers: { 'x-apisports-key': apiKey },
      signal: controller.signal,
    });
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch (_) {}
    return {
      ok: res.ok,
      status: res.status,
      data,
      remaining: res.headers.get('x-ratelimit-requests-remaining'),
    };
  } finally {
    clearTimeout(timer);
  }
}

function mapGame(league, g) {
  const home = g?.teams?.home || {};
  const away = g?.teams?.away || {};
  const statusShort = g?.status?.short || g?.status?.long || '';
  return {
    id: g?.id,
    league,
    homeTeam: home.code || home.name || '',
    awayTeam: away.code || away.name || '',
    homeName: home.name || '',
    awayName: away.name || '',
    status: /live|1st|2nd|3rd|4th|ot/i.test(statusShort) ? 'live' : /finish|final|ft/i.test(statusShort) ? 'final' : 'scheduled',
    gameTime: g?.date || g?.timestamp || '',
    scores: `${away.score ?? ''}-${home.score ?? ''}`,
    provider: 'apisports',
  };
}

function isGameOddsMarket(market, valueLabel) {
  const m = String(market || '').toLowerCase();
  const v = String(valueLabel || '').toLowerCase();
  if (/moneyline|money line|run line|spread|handicap|home\/away|1st 5|first 5|\bf5\b|winner/.test(m)) return true;
  if (/^home$|^away$|^draw$/.test(v)) return true;
  if (/total|over\/under|ou\b/.test(m) && /over|under|total/.test(v)) return true;
  return false;
}

function parseOddsLines(league, gameId, payload) {
  const propLines = [];
  const gameLines = [];
  const books = payload?.response || [];
  for (const entry of books) {
    const bookName = clean(entry?.bookmaker?.name || 'book').toLowerCase();
    if (bookName && !bookName.includes('fanduel') && !bookName.includes('fan duel')) continue;
    for (const bet of entry?.bets || []) {
      const market = clean(bet?.name || '').toLowerCase();
      for (const val of bet?.values || []) {
        const player = clean(val?.value || '');
        const oddStr = String(val?.odd || '');
        const odds = parseFloat(oddStr);
        if (!player || !Number.isFinite(odds)) continue;
        if (isGameOddsMarket(market, player)) {
          const lineMatch = player.match(/[-+]?[\d.]+/);
          gameLines.push({
            league,
            game_id: gameId,
            selection: player,
            market: market.replace(/_/g, ' '),
            line: lineMatch ? parseFloat(lineMatch[0]) : null,
            odds,
            book: 'FanDuel',
            provider: 'apisports',
          });
          continue;
        }
        const isUnder = /under/i.test(player) || /under/i.test(market);
        const playerName = player.replace(/under|over/gi, '').trim();
        const lineMatch = player.match(/[\d.]+/);
        const line = lineMatch ? parseFloat(lineMatch[0]) : null;
        propLines.push({
          league,
          game_id: gameId,
          player: playerName,
          player_key: normName(playerName),
          market: market.replace(/_/g, ' '),
          market_key: normName(market),
          line,
          side: isUnder ? 'UNDER' : 'OVER',
          odds,
          book: 'FanDuel',
          book_key: 'fanduel',
          fromLive: true,
          provider: 'apisports',
        });
      }
    }
  }
  return { propLines, gameLines };
}

function oddsLinesToFdMap(oddsLines) {
  const map = {};
  for (const row of oddsLines || []) {
    const playerNorm = normName(row.player);
    const propType = clean(row.market_key || row.market);
    if (!playerNorm || !propType) continue;
    const key = `${playerNorm}|${propType}`;
    if (!map[key]) map[key] = { line: row.line, source: 'apisports', fromLive: true };
    if (row.side === 'OVER') map[key].overOdds = row.odds;
    if (row.side === 'UNDER') map[key].underOdds = row.odds;
  }
  return map;
}

function getCachedBundle() {
  if (!bundleCache) return null;
  if (Date.now() - lastRefreshAt > CACHE_TTL_MS * 2) return bundleCache;
  return bundleCache;
}

function canRefresh(force) {
  if (force) return true;
  if (!lastRefreshAt) return true;
  return Date.now() - lastRefreshAt >= MIN_REFRESH_MS;
}

async function refreshBundle(options = {}) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { ok: false, error: 'APISPORTS_KEY not configured', bundle: bundleCache };
  }
  if (!canRefresh(options.force) && bundleCache) {
    return {
      ok: true,
      cached: true,
      bundle: bundleCache,
      calls_used: 0,
      meta: bundleCache.meta,
    };
  }

  const date = estDateString();
  const games = { NBA: [], NHL: [], MLB: [] };
  const injuries = { NBA: [], NHL: [], MLB: [] };
  const odds_lines = [];
  const game_odds_lines = [];
  let calls = 0;
  const errors = [];

  for (const league of ['NBA', 'NHL', 'MLB']) {
    const cfg = HOSTS[league];
    const season = seasonFor(league);
    const path = `/games?date=${date}&league=${cfg.league}&season=${season}`;
    const res = await fetchJson(cfg.host, path, apiKey);
    calls += 1;
    if (!res.ok || !res.data?.response) {
      errors.push(`${league}_games:${res.status}`);
      continue;
    }
    games[league] = res.data.response.map((g) => mapGame(league, g));
  }

  const gameIds = [];
  for (const league of ['NBA', 'NHL', 'MLB']) {
    for (const g of games[league] || []) {
      if (g.id && g.status !== 'final') gameIds.push({ league, id: g.id });
    }
  }
  for (const { league, id } of gameIds.slice(0, MAX_ODDS_GAMES)) {
    const cfg = HOSTS[league];
    const res = await fetchJson(cfg.host, `/odds?game=${id}`, apiKey);
    calls += 1;
    if (res.ok && res.data?.response) {
      const parsed = parseOddsLines(league, id, res.data);
      odds_lines.push(...(parsed.propLines || []));
      game_odds_lines.push(...(parsed.gameLines || []));
    } else {
      errors.push(`${league}_odds_${id}:${res.status}`);
    }
  }

  bundleCache = {
    updated_at: new Date().toISOString(),
    date,
    games,
    injuries,
    odds_lines,
    game_odds_lines,
    fd_lines_map: oddsLinesToFdMap(odds_lines),
    meta: {
      calls_used_this_refresh: calls,
      budget_daily: DAILY_BUDGET,
      daily_calls_used_estimate: dailyCallsUsed,
      errors,
    },
  };
  lastRefreshAt = Date.now();

  return {
    ok: true,
    cached: false,
    bundle: bundleCache,
    calls_used: calls,
    meta: bundleCache.meta,
  };
}

module.exports = {
  getCachedBundle,
  refreshBundle,
  canRefresh,
  oddsLinesToFdMap,
  getApiKey,
  DAILY_BUDGET,
  MIN_REFRESH_MS,
  CACHE_TTL_MS,
};
