#!/usr/bin/env node

/**
 * ESPN Endpoint Discovery Tool
 * Tests various ESPN API paths to find correct player stats endpoint
 */

const https = require('https');

const ENDPOINTS = [
  // Original (broken)
  {
    name: 'Athletes (Original - Broken)',
    url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/athletes?limit=10',
    league: 'NBA',
  },
  // Try without limit param
  {
    name: 'Athletes (No limit)',
    url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/athletes',
    league: 'NBA',
  },
  // Try teams endpoint
  {
    name: 'Teams',
    url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams',
    league: 'NBA',
  },
  // Try teams with limit
  {
    name: 'Teams (with limit)',
    url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams?limit=30',
    league: 'NBA',
  },
  // Try standings
  {
    name: 'Standings',
    url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/standings',
    league: 'NBA',
  },
  // Try news (different resource)
  {
    name: 'News',
    url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/news?limit=5',
    league: 'NBA',
  },
  // Try scores
  {
    name: 'Scores',
    url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
    league: 'NBA',
  },
  // NHL variants
  {
    name: 'NHL Teams',
    url: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/teams',
    league: 'NHL',
  },
  // MLB variants
  {
    name: 'MLB Teams',
    url: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/teams',
    league: 'MLB',
  },
];

async function testEndpoint(config) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let result = {
      name: config.name,
      url: config.url,
      league: config.league,
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
      result.error = 'Exceeded 10s timeout';
      resolve(result);
    }, 10000);

    https.get(config.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json',
      },
    }, (res) => {
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
            result.topLevelKeys = Object.keys(json).slice(0, 8);
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
  const statusIcon = {
    SUCCESS: '✅',
    TIMEOUT: '⏱️ ',
    CONNECTION_ERROR: '❌',
    PARSE_ERROR: '⚠️ ',
    HTTP_404: '🚫',
    HTTP_403: '🔒',
    PENDING: '⏳',
  }[result.status] || '❓';

  return `
${statusIcon} [${result.league}] ${result.name}
   Status: ${result.status} | ${result.responseTime}ms
   Status Code: ${result.statusCode || 'N/A'}
   Top-level keys: ${result.topLevelKeys.join(', ') || 'N/A'}
   ${result.error ? `Error: ${result.error}` : ''}`;
}

async function run() {
  console.log('\n' + '═'.repeat(70));
  console.log(' ESPN Endpoint Discovery Tool');
  console.log(' ' + new Date().toLocaleString());
  console.log('═'.repeat(70) + '\n');

  console.log('Testing ESPN API path variations...\n');

  const results = [];
  for (const endpoint of ENDPOINTS) {
    const result = await testEndpoint(endpoint);
    results.push(result);
    console.log(formatResult(result));
  }

  console.log('\n' + '═'.repeat(70));
  console.log('SUMMARY');
  console.log('═'.repeat(70) + '\n');

  const working = results.filter(r => r.status === 'SUCCESS');
  const failing = results.filter(r => r.status !== 'SUCCESS');

  console.log(`✅ Working Endpoints: ${working.length}/${results.length}`);
  working.forEach(r => {
    console.log(`   • [${r.league}] ${r.name}`);
    console.log(`     → ${r.url}`);
    console.log(`     → Keys: ${r.topLevelKeys.join(', ')}`);
  });

  console.log(`\n❌ Failing Endpoints: ${failing.length}/${results.length}`);
  failing.forEach(r => {
    console.log(`   • [${r.league}] ${r.name}`);
    console.log(`     → ${r.status}`);
  });

  console.log('\n' + '═'.repeat(70));
  console.log('RECOMMENDATION');
  console.log('═'.repeat(70) + '\n');

  if (working.length === 0) {
    console.log('⚠️  No working player stats endpoints found via ESPN site API.');
    console.log('   → Possible solutions:');
    console.log('      1. ESPN player stats require team roster iteration (per-team lookup)');
    console.log('      2. Switch to alternative data source (balldontlie, nba-api)');
    console.log('      3. Use outcome-tracking-only model (5% baseline, calibrate from user data)');
  } else {
    const teamsEndpoint = working.find(r => r.name.includes('Teams'));
    if (teamsEndpoint) {
      console.log(`✅ TEAMS endpoint found: ${teamsEndpoint.url}`);
      console.log('   → Strategy: Fetch all teams, iterate rosters for per-player stats');
      console.log('   → Implement: fetchAllTeamRosters() function');
    }
  }

  console.log('\n' + '═'.repeat(70) + '\n');
}

run().catch(console.error);
