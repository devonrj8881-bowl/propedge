#!/usr/bin/env node

/**
 * Local test of ask-analyst handler
 * Run this on your Mac to test article integration + Ollama synthesis
 *
 * Usage: node test-ask-analyst-local.js
 */

const handler = require('./netlify/functions/ask-analyst.js').handler;

async function testAskAnalyst() {
  console.log('='.repeat(80));
  console.log('TESTING: ask-analyst with article integration');
  console.log('='.repeat(80));

  // Sample props from PropEdge board
  const sampleProps = [
    {
      player: "Jayson Tatum",
      team: "BOS",
      league: "NBA",
      stat: "Points",
      line: 27.5,
      over_odds: -110,
      under_odds: -110,
      book: "FanDuel",
      confidence: 0.78,
      edge: 2.3,
      propiq_score: 76,
      l5_avg: 28.1,
      matchup_scalar: 1.04,
      game: "BOS vs LAL"
    },
    {
      player: "LeBron James",
      team: "LAL",
      league: "NBA",
      stat: "Assists",
      line: 8.5,
      over_odds: -110,
      under_odds: -110,
      book: "FanDuel",
      confidence: 0.72,
      edge: 1.8,
      propiq_score: 68,
      l5_avg: 8.8,
      matchup_scalar: 1.02,
      game: "BOS vs LAL"
    },
    {
      player: "Austin Reaves",
      team: "LAL",
      league: "NBA",
      stat: "Points",
      line: 18.5,
      over_odds: -110,
      under_odds: -110,
      book: "FanDuel",
      confidence: 0.68,
      edge: 1.5,
      propiq_score: 65,
      l5_avg: 19.2,
      matchup_scalar: 0.96,
      game: "BOS vs LAL"
    },
  ];

  // Test question that triggers article fetching
  const question = "What are the best Lakers vs Celtics props given the latest news and injury context?";

  const mockEvent = {
    httpMethod: 'POST',
    body: JSON.stringify({
      question,
      league: 'NBA',
      props: sampleProps,
      matchedCount: sampleProps.length,
    }),
  };

  try {
    console.log('\n[REQUEST]');
    console.log(`Question: "${question}"`);
    console.log(`League: NBA`);
    console.log(`Props: ${sampleProps.length} matched`);
    console.log(`Articles detection: ${/\b(news|injury|context)\b/i.test(question) ? 'ENABLED' : 'DISABLED'}`);
    console.log('\n[PROCESSING...]');
    console.log('- Fetching articles (ESPN, RotoWire, Covers, etc.)');
    console.log('- Building ESPN context (matchup, team profile)');
    console.log('- Building public source context (CBS, RotoWire, etc.)');
    console.log('- Injecting articles into Ollama prompt');
    console.log('- Calling Ollama gemma4:e4b for synthesis');
    console.log('');

    const result = await handler(mockEvent);
    const response = JSON.parse(result.body);

    console.log('[RESPONSE]');
    console.log(`Provider: ${response.provider}`);
    console.log(`Model: ${response.model}`);
    console.log(`Article context included: ${response.article_context_included === true ? 'YES ✓' : 'NO'}`);
    console.log(`OK: ${response.ok}`);

    if (response.warning) {
      console.log(`\nWARNING: ${response.warning}`);
      console.log(`Fallback reason: ${response.fallback_reason}`);
    }

    console.log('\n[ANSWER]');
    console.log('='.repeat(80));
    console.log(response.answer);
    console.log('='.repeat(80));

    console.log('\n[SOURCE CONTEXT]');
    if (response.source_context && Array.isArray(response.source_context)) {
      response.source_context.slice(0, 5).forEach((ctx, i) => {
        console.log(`\n${i + 1}. ${ctx.source} (${ctx.status})`);
        if (ctx.summary) {
          console.log(`   ${ctx.summary.slice(0, 100)}...`);
        }
      });
    }

    console.log('\n[METADATA]');
    console.log(`Circuit breaker: ${response.circuit_status || 'N/A'}`);
    console.log(`Retry count: ${response.retry_count || 0}`);
    console.log(`Cache hit: ${response.provider === 'ollama-cache' ? 'YES' : 'NO'}`);

    console.log('\n' + '='.repeat(80));
    console.log('TEST COMPLETE');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n[ERROR]');
    console.error(error.message);
    console.error('\nStack:', error.stack);
  }
}

testAskAnalyst();
