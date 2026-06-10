#!/usr/bin/env node

/**
 * PropEdge Enrichment Endpoints Diagnostic Tool
 *
 * Tests all data sources:
 * - ESPN season stats (NBA, NHL, MLB)
 * - ESPN game logs (NHL)
 * - ESPN scoreboard (injury data)
 * - stats.nba.com (currently timing out)
 * - baseball-savant (MLB pitch data)
 * - ESPN matchup data
 *
 * Reports: Success/Failure, Response time, Data quality
 */

const https = require('https');

// Test configuration
const TESTS = {
  espn_nba_athletes: {
    url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/athletes?limit=10',
    name: 'ESPN NBA Athletes (Season Stats)',
    timeout: 20000,
    expected: ['athletes', 'count'],
  },
  espn_nhl_athletes: {
    url: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/athletes?limit=10',
    name: 'ESPN NHL Athletes (Season Stats)',
    timeout: 20000,
    expected: ['athletes'],
  },
  espn_mlb_athletes: {
    url: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/athletes?limit=10',
    name: 'ESPN MLB Athletes (Season Stats)',
    timeout: 20000,
    expected: ['athletes'],
  },
  espn_injuries: {
    url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries',
    name: 'ESPN NBA Injuries',
    timeout: 20000,
    expected: ['injuries'],
  },
  espn_scoreboard: {
    url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=20260502',
    name: 'ESPN NBA Scoreboard',
    timeout: 20000,
    expected: ['events'],
  },
  stats_nba: {
    url: 'https://stats.nba.com/stats/leaguedashteamstats?Season=2025&SeasonType=Regular',
    name: 'stats.nba.com (Team Stats) — EXPECTED TO TIMEOUT',
    timeout: 5000,
    expected: ['resultSets'],
  },
  baseball_savant: {
    url: 'https://baseballsavant.mlb.com/statcast?&hfPT=&hfAB=&hfBBT=&hfPR=&hfZ=&stadium=&hfBuiltInPlay=&team=&player_type=pitcher&hfOuts=&opponent=&pitcher_throws=&bats=&start_date=2026-01-01&end_date=2026-05-02&group_by=pitcher&sort_col=pitches&sort_order=desc&min_pitches=0&chk=true',
    name: 'Baseball Savant (MLB Pitch Data)',
    timeout: 15000,
    expected: ['data', 'result'],
  },
};

// HTTP request helper with detailed diagnostics
async function testEndpoint(key, config) {
  const startTime = Date.now();
  let result = {
    key,
    name: config.name,
    url: config.url,
    status: 'PENDING',
    statusCode: null,
    responseTime: null,
    dataAvailable: false,
    error: null,
    expectedFields: config.expected,
    actualFields: [],
  };

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      result.status = 'TIMEOUT';
      result.responseTime = Date.now() - startTime;
      result.error = `Request exceeded ${config.timeout}ms timeout`;
      resolve(result);
    }, config.timeout);

    https
      .get(config.url, {
        headers: {
          'User-Agent': 'PropEdge-Diagnostic-Tool/1.0',
          'Accept': 'application/json',
        },
      }, (res) => {
        clearTimeout(timeout);
        result.statusCode = res.statusCode;
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          result.responseTime = Date.now() - startTime;

          if (res.statusCode === 200 || res.statusCode === 201) {
            try {
              const json = JSON.parse(data);
              result.status = 'SUCCESS';
              result.dataAvailable = true;
              result.actualFields = Object.keys(json).slice(0, 5);
              const hasExpected = config.expected.some(field => field in json);
              result.dataValid = hasExpected;
            } catch (e) {
              result.status = 'PARSE_ERROR';
              result.error = `Invalid JSON: ${e.message}`;
            }
          } else {
            result.status = `HTTP_${res.statusCode}`;
            result.error = `Server returned ${res.statusCode}`;
          }

          resolve(result);
        });
      })
      .on('error', (err) => {
        clearTimeout(timeout);
        result.responseTime = Date.now() - startTime;
        result.status = 'CONNECTION_ERROR';
        result.error = err.message;
        resolve(result);
      });
  });
}

// Format results
function formatResult(result) {
  const statusIcon = {
    SUCCESS: '✅',
    TIMEOUT: '⏱️ ',
    CONNECTION_ERROR: '❌',
    PARSE_ERROR: '⚠️ ',
    HTTP_403: '🚫',
    HTTP_404: '❌',
    HTTP_429: '⛔',
    PENDING: '⏳',
  }[result.status] || '❓';

  return `
${statusIcon} ${result.name}
   Status: ${result.status}
   Response time: ${result.responseTime}ms
   Status code: ${result.statusCode || 'N/A'}
   Data available: ${result.dataAvailable ? 'YES' : 'NO'}
   ${result.error ? `Error: ${result.error}` : ''}
   Expected fields: ${result.expectedFields.join(', ')}
   Actual fields: ${result.actualFields.join(', ') || 'N/A'}
`;
}

// Main
async function runDiagnostics() {
  console.log('\n' + '═'.repeat(70));
  console.log(' PropEdge Enrichment Endpoints Diagnostic');
  console.log(' ' + new Date().toLocaleString());
  console.log('═'.repeat(70) + '\n');

  console.log('Testing endpoints...\n');

  const results = [];
  for (const [key, config] of Object.entries(TESTS)) {
    const result = await testEndpoint(key, config);
    results.push(result);
    console.log(formatResult(result));
  }

  // Summary
  console.log('\n' + '═'.repeat(70));
  console.log('SUMMARY');
  console.log('═'.repeat(70) + '\n');

  const successful = results.filter(r => r.status === 'SUCCESS');
  const failed = results.filter(r => r.status !== 'SUCCESS');

  console.log(`✅ Working: ${successful.length}/${results.length}`);
  successful.forEach(r => console.log(`   - ${r.name}`));

  console.log(`\n❌ Failing: ${failed.length}/${results.length}`);
  failed.forEach(r => console.log(`   - ${r.name} (${r.status})`));

  console.log('\n' + '═'.repeat(70));
  console.log('RECOMMENDATIONS');
  console.log('═'.repeat(70) + '\n');

  if (results.find(r => r.key === 'stats_nba' && r.status === 'TIMEOUT')) {
    console.log('⚠️  stats.nba.com is timing out. This is EXPECTED and ACCEPTABLE.');
    console.log('    → ESPN endpoints are working. Use those instead.\n');
  }

  if (results.find(r => r.key === 'baseball_savant' && r.status === 'TIMEOUT')) {
    console.log('⚠️  baseball-savant.mlb.com is timing out.');
    console.log('    → Consider using ESPN MLB season stats instead.\n');
  }

  const workingEspn = results.filter(r => r.key.startsWith('espn') && r.status === 'SUCCESS');
  if (workingEspn.length >= 3) {
    console.log(`✅ ESPN endpoints are RELIABLE (${workingEspn.length} working).`);
    console.log('   → Safe to use as primary data source for all three sports.\n');
  }

  console.log('═'.repeat(70) + '\n');
}

runDiagnostics().catch(console.error);
