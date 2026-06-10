#!/usr/bin/env node
/**
 * API-Sports minimal probe (≤10 upstream calls).
 * Usage: node scripts/probe-apisports.js
 * Requires APISPORTS_KEY (or API_SPORTS_KEY) in .env
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const KEY = process.env.APISPORTS_KEY || process.env.API_SPORTS_KEY || process.env.APISPORTS_API_KEY;
const HOSTS = {
  NBA: { host: 'v1.basketball.api-sports.io', league: 12, season: seasonBasketballHockey() },
  NHL: { host: 'v1.hockey.api-sports.io', league: 57, season: seasonBasketballHockey() },
  MLB: { host: 'v1.baseball.api-sports.io', league: 1, season: String(new Date().getFullYear()) },
};

function seasonBasketballHockey() {
  const y = new Date().getFullYear();
  const m = new Date().getMonth() + 1;
  return m >= 10 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function fetchApi(host, pathname) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: host,
        path: pathname,
        method: 'GET',
        headers: { 'x-apisports-key': KEY },
      },
      (res) => {
        let body = '';
        res.on('data', (c) => { body += c; });
        res.on('end', () => {
          let json = null;
          try { json = JSON.parse(body); } catch (_) {}
          resolve({
            status: res.statusCode,
            remaining: res.headers['x-ratelimit-requests-remaining'],
            limit: res.headers['x-ratelimit-requests-limit'],
            errors: json?.errors,
            results: Array.isArray(json?.response) ? json.response.length : 0,
            sample: json?.response?.[0] || null,
          });
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(12000, () => req.destroy(new Error('timeout')));
    req.end();
  });
}

async function main() {
  if (!KEY) {
    console.error('Missing APISPORTS_KEY in .env');
    process.exit(1);
  }
  const date = today();
  const report = { date, probes: [], calls: 0 };

  async function probe(name, host, path) {
    report.calls += 1;
    const r = await fetchApi(host, path);
    report.probes.push({ name, path, ...r });
    console.log(`${name}: HTTP ${r.status} results=${r.results} remaining=${r.remaining ?? '?'}`);
    return r;
  }

  const nba = HOSTS.NBA;
  await probe('NBA_leagues', nba.host, '/leagues');
  const nbaGames = await probe('NBA_games', nba.host, `/games?date=${date}&league=${nba.league}&season=${nba.season}`);
  await probe('NBA_injuries', nba.host, `/injuries?league=${nba.league}&season=${nba.season}`);
  const gameId = nbaGames.sample?.id;
  if (gameId) {
    await probe('NBA_odds', nba.host, `/odds?game=${gameId}`);
  } else {
    report.probes.push({ name: 'NBA_odds', skipped: 'no game id' });
  }

  const nhl = HOSTS.NHL;
  await probe('NHL_games', nhl.host, `/games?date=${date}&league=${nhl.league}&season=${nhl.season}`);

  const mlb = HOSTS.MLB;
  await probe('MLB_games', mlb.host, `/games?date=${date}&league=${mlb.league}&season=${mlb.season}`);

  report.summary = {
    total_calls: report.calls,
    odds_has_player_markets: report.probes.find((p) => p.name === 'NBA_odds')?.results > 0,
    injuries_supported: (report.probes.find((p) => p.name === 'NBA_injuries')?.results || 0) > 0,
  };

  const outDir = path.join(__dirname, '..', 'logs');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `apisports-probe-${date.replace(/-/g, '')}.json`);
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nWrote ${outPath} (${report.calls} calls)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
