#!/usr/bin/env node

/**
 * Test the pace-data Netlify Function locally
 */

const handler = require('./netlify/functions/pace-data').handler;

async function testApi() {
  console.log('\n🧪 Testing pace-data API...\n');

  const tests = [
    { name: 'Get all players', query: { action: 'all' } },
    { name: 'Get player trends', query: { action: 'player-trends', playerId: '1' } },
    { name: 'Get player pace history', query: { action: 'player', playerId: '2', days: '30' } },
    { name: 'Get all trends', query: { action: 'trends' } },
  ];

  for (const test of tests) {
    try {
      const event = { queryStringParameters: test.query };
      const response = await handler(event);

      const data = JSON.parse(response.body);
      console.log(`✅ ${test.name}`);
      console.log(`   Status: ${response.statusCode}`);
      console.log(`   Data points: ${data.count || data.trends?.length || 'N/A'}`);
      console.log();
    } catch (error) {
      console.log(`❌ ${test.name}: ${error.message}`);
    }
  }
}

testApi();
