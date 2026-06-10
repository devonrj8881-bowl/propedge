#!/usr/bin/env node
/**
 * PropEdge — team allowed-stat ranks × pace (matchup matrix v1).
 * Output: propedge-deploy/data/matchup-matrix.json
 *
 * Usage: node build-matchup-matrix.js [--dry-run]
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const https = require('https');

const OUT_JSON = path.join(__dirname, 'propedge-deploy/data/matchup-matrix.json');
const DRY_RUN = process.argv.includes('--dry-run');

const LEAGUE_APIS = {
  NBA: {
    stats: 'https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/statistics/byteam?season=2026&seasontype=2&limit=32',
    paceKeys: ['pace', 'possessionspergame', 'pointspergame']
  },
  NHL: {
    stats: 'https://site.web.api.espn.com/apis/common/v3/sports/hockey/nhl/statistics/byteam?season=2026&seasontype=2&limit=32',
    paceKeys: ['goalspergame', 'goalsfor']
  },
  MLB: {
    stats: 'https://site.web.api.espn.com/apis/common/v3/sports/baseball/mlb/statistics/byteam?season=2026&seasontype=2&limit=32',
    paceKeys: ['runspergame', 'runsscored']
  }
};

const BUCKETS = {
  NBA: [
    { key: 'pts_allowed', statKeys: ['pointsagainst', 'opppointspergame', 'pointsallowed'] },
    { key: 'reb_allowed', statKeys: ['reboundsagainst', 'oppreboundspergame'] },
    { key: 'ast_allowed', statKeys: ['assistsagainst', 'oppassistspergame'] }
  ],
  NHL: [
    { key: 'goals_allowed', statKeys: ['goalsagainst', 'goalsallowed'] }
  ],
  MLB: [
    { key: 'runs_allowed', statKeys: ['runsagainst', 'runsallowed'] },
    { key: 'k_allowed', statKeys: ['strikeouts'] }
  ]
};

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

function flattenTeam(entry) {
  const abbr = (entry.athlete?.abbreviation || entry.team?.abbreviation || '').toUpperCase();
  const map = {};
  (entry.categories || []).forEach((cat) => {
    (cat.labels || []).forEach((lbl, i) => {
      map[String(lbl).toLowerCase().replace(/\s+/g, '')] = parseFloat(cat.stats?.[i]) || 0;
    });
    (cat.names || []).forEach((nm, i) => {
      map[String(nm).toLowerCase().replace(/\s+/g, '')] = parseFloat(cat.stats?.[i]) || 0;
    });
  });
  return { abbr, map };
}

function statVal(map, keys) {
  for (const k of keys) {
    const v = map[k] ?? map[k.replace(/_/g, '')];
    if (v > 0) return v;
  }
  return 0;
}

function rankTeams(rows, getter) {
  const sorted = [...rows].sort((a, b) => getter(b) - getter(a));
  const ranks = {};
  sorted.forEach((r, i) => { ranks[r.abbr] = i + 1; });
  return ranks;
}

async function buildLeague(league, config) {
  const data = await fetchJson(config.stats);
  const teams = (data.athletes || data.teams || []).map(flattenTeam).filter((t) => t.abbr);
  const paceGetter = (t) => statVal(t.map, config.paceKeys);
  const paceRanks = rankTeams(teams, paceGetter);

  const matrix = {};
  const buckets = BUCKETS[league] || BUCKETS.NBA;

  buckets.forEach((bucket) => {
    const vals = teams.map((t) => ({
      abbr: t.abbr,
      v: statVal(t.map, bucket.statKeys) || statVal(t.map, ['pointsagainst', 'goalsagainst', 'runsagainst'])
    }));
    const hasData = vals.some((x) => x.v > 0);
    if (!hasData) {
      vals.forEach((x) => {
        const team = teams.find((t) => t.abbr === x.abbr);
        x.v = team ? paceGetter(team) : 0;
      });
    }
    const ranks = rankTeams(vals.map((x) => ({ abbr: x.abbr, map: { v: x.v } })), (t) => t.map.v);
    vals.forEach((x) => {
      const key = `${x.abbr}|${bucket.key}`;
      matrix[key] = {
        rank: ranks[x.abbr] || 15,
        paceRank: paceRanks[x.abbr] || 15,
        raw: x.v
      };
    });
  });

  return matrix;
}

async function main() {
  const matrix = { generated_at: new Date().toISOString(), NBA: {}, NHL: {}, MLB: {} };
  for (const league of Object.keys(LEAGUE_APIS)) {
    console.log(`[matrix] ${league}...`);
    matrix[league] = await buildLeague(league, LEAGUE_APIS[league]);
    console.log(`[matrix] ${league}: ${Object.keys(matrix[league]).length} cells`);
  }

  if (DRY_RUN) {
    console.log(JSON.stringify(matrix, null, 2).slice(0, 1500));
    return;
  }

  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify({ matrix }, null, 2));
  console.log(`[matrix] Wrote ${OUT_JSON}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
