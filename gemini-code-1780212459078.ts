import assert from 'node:assert';
import { generateBetAnalysis } from './app/actions/betting-analyst'; // Adjust path as needed

// ANSI color codes for terminal output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m'
};

async function runSmokeTests() {
  console.log(`${colors.yellow}🚀 Starting PropEdge Master Terminal Smoke Tests...${colors.reset}\n`);

  // ==========================================
  // TEST 1: The Happy Path
  // ==========================================
  try {
    process.stdout.write('⏳ TEST 1: Happy Path (Valid Data)... ');
    
    // Call the server action normally
    const result = await generateBetAnalysis("Jesús Luzardo", "Strikeouts");
    
    // Assert that the result contains something (UI component or stream)
    assert(result !== null && result !== undefined, "Result should not be null");
    console.log(`${colors.green}✅ PASS${colors.reset}`);
  } catch (error) {
    console.log(`${colors.red}❌ FAIL${colors.reset}\n`, error);
  }

  // ==========================================
  // TEST 2: The Meltdown Test (Timeout)
  // ==========================================
  try {
    process.stdout.write('⏳ TEST 2: Meltdown Test (Simulated 8s Timeout)... ');
    
    // Temporarily sabotage the API key to force a failure/timeout from the LLM
    const originalApiKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "sk-fake-invalid-key-to-force-meltdown";

    try {
      // We expect this to fail and return our safe fallback UI or throw a handled error
      await generateBetAnalysis("Jesús Luzardo", "Strikeouts");
      console.log(`${colors.red}❌ FAIL (Did not catch bad API/Timeout)${colors.reset}`);
    } catch (error: any) {
      // If your system correctly catches the timeout/API error, it should pass this test
      assert(error.message.includes('401') || error.message.includes('timeout') || error.message.includes('API'), "Expected a caught network/timeout error");
      console.log(`${colors.green}✅ PASS (Caught timeout/error gracefully)${colors.reset}`);
    }

    // Restore the key
    process.env.OPENAI_API_KEY = originalApiKey;
  } catch (error) {
    console.log(`${colors.red}❌ FAIL${colors.reset}\n`, error);
  }

  // ==========================================
  // TEST 3: The Data Typo (Sanity Check)
  // ==========================================
  try {
    process.stdout.write('⏳ TEST 3: Data Typo Check (Invalid Line = 55.5)... ');
    
    // Note: To make this test work, you must add a check inside `generateBetAnalysis` 
    // that throws an error if a line is absurdly high before sending it to the LLM.
    try {
      // Simulating passing a bad prop type or hardcoded bad data if your function allows overrides
      // (If your function strictly fetches from DB, you may need to mock the DB fetch here)
      await generateBetAnalysis("Jesús Luzardo", "AbsurdlyHighLineTest");
      
      console.log(`${colors.red}❌ FAIL (LLM attempted to analyze bad data)${colors.reset}`);
    } catch (error: any) {
      assert(error.message.includes('sanity check') || error.message.includes('invalid line'), "Expected sanity check to block the request");
      console.log(`${colors.green}✅ PASS (Sanity check blocked bad data)${colors.reset}`);
    }

  } catch (error) {
    console.log(`${colors.red}❌ FAIL${colors.reset}\n`, error);
  }

  console.log(`\n${colors.yellow}🏁 Smoke Tests Completed.${colors.reset}`);
}

// Execute the test suite
runSmokeTests();