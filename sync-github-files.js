const { execSync } = require('child_process');
const path = '/Users/devonjohnson/Documents/Claude/Projects/PropEdge';

console.log('🔄 Syncing with GitHub...');

try {
  process.chdir(path);
  console.log('  - Fetching origin/main');
  execSync('git fetch origin main', { stdio: 'inherit' });
  
  console.log('  - Resetting index.html to origin/main');
  execSync('git checkout origin/main -- index.html', { stdio: 'inherit' });

  const patches = [
    'patch-frontend.js',        // Unit sizing + Devig math
    'patch-index-ev.js',        // Multi-book odds extraction
    'fix-initialization.js',    // Odds init fix
    'fix-syntax.js',            // Syntax fix
    'patch-index-home-away.js', // Home/Away scoring
    'patch-wnba-ui.js',         // WNBA Sport Tabs
    'restore-wnba.js',          // WNBA Logic state
    'fix-wnba-markets.js',      // WNBA Markets Sidebar
    'restore-multibook.js',     // Odds API Class
    'patch-game-odds-logic.js', // Game-level odds logic
    'final-wnba-sync.js',       // Final ticker/array sync
    'final-league-fix.js'       // League order standardizing
  ];

  for (const patch of patches) {
    console.log(`  - Applying ${patch}`);
    try {
      execSync(`node ${patch}`, { stdio: 'inherit' });
    } catch (e) {
      console.warn(`  ⚠️  Patch ${patch} failed`);
    }
  }

  console.log('✅ Sync and local patching complete.');
} catch (e) {
  console.error('❌ GitHub sync failed:', e.message);
}
