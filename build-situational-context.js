#!/usr/bin/env node
/**
 * PropEdge — team rest / B2B / revenge flags from ESPN scoreboards.
 * Output: propedge-deploy/data/situational-context.json
 * Optional: --sheet writes columns to situational export CSV for scraper merge.
 *
 * Usage: node build-situational-context.js [--dry-run]
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const https = require('https');

const OUT_JSON = path.join(__dirname, 'propedge-deploy/data/situational-context.json');
const LEAGUES = {
  NBA: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
  NHL: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard',
  MLB: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard'
};
const DRY_RUN = process.argv.includes('--dry-run');
const LOOKBACK_DAYS = 12;

function log(msg) { console.log(`[situational] ${msg}`); }

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'PropEdge/1.0' } }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function dateParam(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

async function collectFinalGames(league, baseUrl) {
  const games = [];
  for (let d = 0; d < LOOKBACK_DAYS; d++) {
    const dt = new Date();
    dt.setDate(dt.getDate() - d);
    const url = `${baseUrl}?dates=${dateParam(dt)}&limit=50`;
    try {
      const data = await fetchJson(url);
      (data.events || []).forEach((ev) => {
        const comp = ev.competitions?.[0];
        if (!comp || ev.status?.type?.state !== 'post') return;
        const home = comp.competitors?.find((c) => c.homeAway === 'home');
        const away = comp.competitors?.find((c) => c.homeAway === 'away');
        if (!home || !away) return;
        games.push({
          ended: new Date(ev.date || comp.date).toISOString(),
          homeAbbr: (home.team?.abbreviation || '').toUpperCase(),
          awayAbbr: (away.team?.abbreviation || '').toUpperCase(),
          homeScore: parseInt(home.score, 10) || 0,
          awayScore: parseInt(away.score, 10) || 0
        });
      });
    } catch (e) {
      log(`${league} ${dateParam(dt)} skip: ${e.message}`);
    }
  }
  games.sort((a, b) => new Date(b.ended) - new Date(a.ended));
  return games;
}

function buildLeagueContext(league, finalGames) {
  const teams = {};
  const allAbbr = new Set();
  finalGames.forEach((g) => {
    allAbbr.add(g.homeAbbr);
    allAbbr.add(g.awayAbbr);
  });

  const tonight = new Date();
  allAbbr.forEach((abbr) => {
    if (!abbr) return;
    const last = finalGames.find((g) => g.homeAbbr === abbr || g.awayAbbr === abbr);
    if (!last) return;
    const hoursSince = (tonight - new Date(last.ended)) / 36e5;
    const daysRest = Math.max(0, Math.floor(hoursSince / 24));
    const revengeVs = {};
    finalGames.forEach((g) => {
      if (g.homeAbbr !== abbr && g.awayAbbr !== abbr) return;
      const opp = g.homeAbbr === abbr ? g.awayAbbr : g.homeAbbr;
      if (revengeVs[opp] != null) return;
      const teamWon = (g.homeAbbr === abbr && g.homeScore > g.awayScore)
        || (g.awayAbbr === abbr && g.awayScore > g.homeScore);
      revengeVs[opp] = !teamWon;
    });
    teams[abbr] = {
      daysRest,
      isB2b: daysRest === 0 || hoursSince < 30,
      restPlus: daysRest >= 2,
      lastGameEnded: last.ended,
      revengeVs
    };
  });
  return teams;
}

async function main() {
  const out = { generated_at: new Date().toISOString(), NBA: {}, NHL: {}, MLB: {} };
  for (const [league, url] of Object.entries(LEAGUES)) {
    log(`Fetching ${league}...`);
    const finals = await collectFinalGames(league, url);
    out[league] = buildLeagueContext(league, finals);
    log(`${league}: ${Object.keys(out[league]).length} teams`);
  }

  if (DRY_RUN) {
    console.log(JSON.stringify(out, null, 2).slice(0, 2000));
    return;
  }

  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2));
  log(`Wrote ${OUT_JSON}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
