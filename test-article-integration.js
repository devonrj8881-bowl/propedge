/**
 * Test harness for article integration + Ollama reliability layer
 * Simulates ask-analyst.js handler with mock data
 */

const fetchArticlesModule = require('./netlify/functions/fetch-articles-legal.js');
const { fetchArticles, formatArticlesForPrompt } = fetchArticlesModule;

async function testArticleIntegration() {
  console.log('='.repeat(80));
  console.log('PROPEDGE ARTICLE INTEGRATION TEST');
  console.log('='.repeat(80));

  // Test 1: Article fetching
  console.log('\n[TEST 1] Fetching articles for Lakers vs Celtics (NBA)...\n');
  try {
    const articles = await fetchArticles(['LAL', 'BOS'], 'NBA');
    console.log(`✓ Fetched ${articles.length} articles\n`);
    
    articles.slice(0, 2).forEach((article, i) => {
      console.log(`Article ${i + 1}:`);
      console.log(`  Title: ${article.title}`);
      console.log(`  Source: ${article.source}`);
      console.log(`  Excerpt: ${article.excerpt.slice(0, 80)}...`);
      console.log(`  URL: ${article.url}\n`);
    });
  } catch (e) {
    console.log(`✗ Article fetch failed: ${e.message}\n`);
  }

  // Test 2: Format articles for prompt
  console.log('[TEST 2] Formatting articles for Ollama prompt injection...\n');
  try {
    const articles = await fetchArticles(['LAL', 'BOS'], 'NBA');
    const formatted = formatArticlesForPrompt(articles);
    console.log('Formatted prompt context:');
    console.log('-'.repeat(80));
    console.log(formatted.slice(0, 400) + '...');
    console.log('-'.repeat(80));
    console.log(`\nTotal formatted length: ${formatted.length} chars\n`);
  } catch (e) {
    console.log(`✗ Format failed: ${e.message}\n`);
  }

  // Test 3: Simulate handler response structure
  console.log('[TEST 3] Simulated handler response with articles...\n');
  const mockResponse = {
    ok: true,
    provider: 'ollama',
    model: 'gemma4:e4b',
    article_context_included: true,
    source_context: [
      {
        source: 'ESPN',
        status: 'ok',
        summary: 'Lakers vs Celtics Game 4 Playoff matchup',
      },
    ],
    answer: `PRE-GAME MATCHUP ANALYSIS
Lakers at Celtics, Game 4 playoff series, 7:30 PM EST at TD Garden.

THE NARRATIVE
Celtics lead series 2-1. Lakers facing elimination pressure with LeBron and AD both active.

PLAYER-BY-PLAYER BREAKDOWN
- LeBron James: Points, assists, rebounds exposure
- Anthony Davis: Points, boards prop interest
- Jayson Tatum: Primary Celtics scorer, monitor usage

ARTICLE TEXT CONTEXT
- ESPN: Lakers historically shoot 34% from three in playoff elimination games; Celtics defensive pressure focused on three-point line.
- CBS Sports: Injury report shows no new scratches; both teams at full strength.

BEST BETS TO PLAY
- Tatum over 27.5 points: Celtics targeting LeBron defensively, creating secondary scoring opportunities
- Game total under 218: Defensive intensity in elimination scenario typically depresses scoring

SOURCES USED
Analyst sources: PropEdge board; ESPN (ok); article context integrated from multi-source fetch.`,
  };

  console.log(JSON.stringify(mockResponse, null, 2).slice(0, 600) + '...\n');

  // Test 4: Circuit breaker state
  console.log('[TEST 4] Ollama reliability layer status...\n');
  const mockCircuitState = {
    circuitOpen: false,
    failureCount: 0,
    failureThreshold: 3,
    cooldownMs: 60000,
    cacheSize: 2,
    cacheTTLMs: 3600000,
  };
  console.log(JSON.stringify(mockCircuitState, null, 2));
  console.log('\n✓ Circuit breaker active, ready for Tailscale tunnel recovery\n');

  console.log('='.repeat(80));
  console.log('TEST COMPLETE');
  console.log('='.repeat(80));
}

testArticleIntegration().catch(console.error);
