#!/usr/bin/env node

/**
 * Alternative Sports Data APIs Diagnostic
 * Tests balldontlie.io, statsapi.mlb.com, sofascore, etc.
 */

const https = require('https');
const http = require('http');

const TESTS = [
  // NBA
  {
    name: 'balldontlie.io NBA - Search Player',
    url: 'https://api.balldontlie.io/api/v1/players?search=luka',
    method: 'GET',
    sport: 'NBA',
    timeout: 10000,
    expected: ['data', 'meta'],
  },
  {
    name: 'balldontlie.io NBA - Season Stats',
    url: 'https://api.balldontlie.io/api/v1/season_averages?season=2026',
    method: 'GET',
    sport: 'NBA',
    timeout: 10000,
    expected: ['data', 'meta'],
  },
  // MLB
  {
    name: 'MLB StatsAPI - Player Search',
    url: 'https://statsapi.mlb.com/api/v1/players?name=aaron%20judge',
    method: 'GET',
    sport: 'MLB',
    timeout: 10000,
    expected: ['people'],
  },
  {
    name: 'MLB StatsAPI - Season Stats',
    url: 'https://statsapi.mlb.com/api/v1/people/694885/stat?group=hitting&type=season',
    method: 'GET',
    sport: 'MLB',
    timeout: 10000,
    expected: ['stats'],
  },
  // Hockey
  {
    name: 'NHL API - Player Search',
    url: 'https://records.nhl.com/site/api/player?cayenneExp=firstName=~%20%22Connor%22',
    method: 'GET',
    sport: 'NHL',
    timeout: 10000,
    expected: ['data'],
  },
  // SofaScore (free tier)
  {
    name: 'SofaScore API - Team Stats (NBA)',
    url: 'https://api.sofascore.com/api/v1/season/163/statistics',
    method: 'GET',
    sport: 'NBA',
    timeout: 10000,
    expected: ['season', 'season'],
  },
  // TheRundown
  {
    name: 'TheRundown API - Odds',
    url: 'https://api.therundown.io/api/v1/sports?sport=nba',
    method: 'GET',
    sport: 'NBA',
    timeout: 10000,
    expected: ['sports'],
  },
  // SportsData fallback (public free endpoints if available)
  {
    name: 'ESPN Alternative - Standings (verify working)',
    url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/standings',
    method: 'GET',
    sport: 'NBA',
    timeout: 10000,
    expected: ['fullViewLink'],
  },
];

async function testEndpoint(config) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let result = {
      name: config.name,
      url: config.url,
      sport: config.sport,
      status: 'PENDING',
      statusCode: null,
      responseTime: null,
      dataAvailable: false,
      topLevelKeys: [],
      error: null,
    };

    const timeout = setTimeout(() => {
      result.status = 'TIMEOUT';
      result.responseTime = Date.now() - startTime;
      result.error = `Exceeded ${config.timeout}ms`;
      resolve(result);
    }, config.timeout);

    const protocol = config.url.startsWith('https') ? https : http;
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (PropEdge/1.0)',
        'Accept': 'application/json',
      }
    };

    protocol.get(config.url, options, (res) => {
      clearTimeout(timeout);
      result.statusCode = res.statusCode;
      let data = '';

      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        result.responseTime = Date.now() - startTime;

        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            result.status = 'SUCCESS';
            result.dataAvailable = true;
            result.topLevelKeys = Object.keys(json).slice(0, 5);
          } catch (e) {
            result.status = 'PARSE_ERROR';
            result.error = e.message;
          }
        } else {
          result.status = `HTTP_${res.statusCode}`;
          result.error = `Server returned ${res.statusCode}`;
        }

        resolve(result);
      });
    }).on('error', (err) => {
      clearTimeout(timeout);
      result.responseTime = Date.now() - startTime;
      result.status = 'CONNECTION_ERROR';
      result.error = err.message;
      resolve(result);
    });
  });
}

function formatResult(result) {
  const icons = {
    SUCCESS: '✅',
    TIMEOUT: '⏱️ ',
    CONNECTION_ERROR: '❌',
    PARSE_ERROR: '⚠️ ',
    HTTP_404: '🚫',
    HTTP_403: '🔒',
    HTTP_429: '⛔',
  };
  const icon = icons[result.status] || '❓';

  return `
${icon} [${result.sport}] ${result.name}
   Status: ${result.status} | ${result.responseTime}ms
   Status Code: ${result.statusCode || 'N/A'}
   Keys: ${result.topLevelKeys.join(', ') || 'N/A'}
   ${result.error ? `Error: ${result.error}` : ''}`;
}

async function run() {
  console.log('\n' + '═'.repeat(70));
  console.log(' Alternative Sports APIs Diagnostic');
  console.log(' ' + new Date().toLocaleString());
  console.log('═'.repeat(70) + '\n');

  console.log('Testing alternative data sources...\n');

  const results = [];
  for (const test of TESTS) {
    const result = await testEndpoint(test);
    results.push(result);
    console.log(formatResult(result));
  }

  console.log('\n' + '═'.repeat(70));
  console.log('SUMMARY');
  console.log('═'.repeat(70) + '\n');

  const working = results.filter(r => r.status === 'SUCCESS');
  const failing = results.filter(r => r.status !== 'SUCCESS');

  console.log(`✅ Working: ${working.length}/${results.length}`);
  working.forEach(r => {
    console.log(`   • [${r.sport}] ${r.name}`);
    console.log(`     → ${r.responseTime}ms`);
  });

  console.log(`\n❌ Failing: ${failing.length}/${results.length}`);
  failing.forEach(r => {
    console.log(`   • [${r.sport}] ${r.name} (${r.status})`);
  });

  console.log('\n' + '═'.repeat(70));
  console.log('RECOMMENDATIONS');
  console.log('═'.repeat(70) + '\n');

  const ballontlie = working.find(r => r.name.includes('balldontlie'));
  const mlbstats = working.find(r => r.name.includes('MLB StatsAPI'));
  const nhl = working.find(r => r.name.includes('NHL API'));

  if (ballontlie) {
    console.log(`✅ balldontlie.io is WORKING (${ballontlie.responseTime}ms)`);
    console.log('   → Can be primary source for NBA season stats');
    console.log('   → Rate limit: 100 requests/hour (sufficient for daily enrichment)\n');
  } else {
    console.log('❌ balldontlie.io not working\n');
  }

  if (mlbstats) {
    console.log(`✅ MLB StatsAPI is WORKING (${mlbstats.responseTime}ms)`);
    console.log('   → Can be primary source for MLB season stats');
    console.log('   → No rate limit documented\n');
  } else {
    console.log('❌ MLB StatsAPI not working\n');
  }

  if (nhl) {
    console.log(`✅ NHL API is WORKING (${nhl.responseTime}ms)`);
    console.log('   → Can be primary source for NHL season stats\n');
  } else {
    console.log('❌ NHL API not working\n');
  }

  if (working.length === 0) {
    console.log('⚠️  No alternative APIs responded successfully.');
    console.log('   → Outcome-tracking-only model is the reliable path forward.\n');
  } else if (working.length >= 2) {
    console.log(`✅ ${working.length} working alternatives found.`);
    console.log('   → Implement multi-source fallback chain\n');
  }

  console.log('═'.repeat(70) + '\n');
}

run().catch(console.error);
