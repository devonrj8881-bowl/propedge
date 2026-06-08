const fs = require('fs');
const path = '/Users/devonjohnson/Documents/Claude/Projects/PropEdge/index.html';
let html = fs.readFileSync(path, 'utf8');

// 1. Add WNBA to renderGames todayGames list
const oldGamesList = `const todayGames = [
        ...(state.games.NBA || []),
        ...(state.games.NHL || []),
        ...(state.games.MLB || []),
        ...(state.games.NFL || [])
      ];`;
const newGamesList = `const todayGames = [
        ...(state.games.NBA || []),
        ...(state.games.NHL || []),
        ...(state.games.MLB || []),
        ...(state.games.NFL || []),
        ...(state.games.WNBA || [])
      ];`;

if (html.includes(oldGamesList)) {
    html = html.replace(oldGamesList, newGamesList);
    console.log("✅ Added WNBA to renderGames");
}

// 2. Add WNBA to league order in renderGames
const oldLeagueOrder = `const leagueOrder = ['NBA', 'NHL', 'MLB', 'NFL'];`;
const newLeagueOrder = `const leagueOrder = ['NBA', 'NHL', 'MLB', 'WNBA', 'NFL'];`;

if (html.includes(oldLeagueOrder)) {
    html = html.replace(oldLeagueOrder, newLeagueOrder);
    console.log("✅ Added WNBA to leagueOrder");
}

// 3. Inject game-odds fetching into loadData
const loadDataSearch = `const csv = await fetchPropedgeMainCsv();`;
const loadDataReplacement = `const csv = await fetchPropedgeMainCsv();
        
        // --- RESTORED: Fetch Game-Level Odds (ML, Totals, Spreads, Alts) ---
        try {
          console.log('[PropEdge] Fetching game-level odds from Odds API...');
          const activeLeagues = ['NBA', 'MLB', 'NHL', 'WNBA'].join(',');
          const oddsResp = await fetch(\`/.netlify/functions/game-odds?leagues=\${activeLeagues}&alt=true\`, { cache: 'no-store' });
          if (oddsResp.ok) {
            const oddsData = await oddsResp.json();
            state.gameOdds = oddsData.odds || {};
            console.log(\`[PropEdge] Loaded \${Object.keys(state.gameOdds).length} game odds entries\`);
          }
        } catch (e) {
          console.warn('[PropEdge] Game-level odds fetch failed:', e);
        }
        // ------------------------------------------------------------------`;

if (html.includes(loadDataSearch) && !html.includes('game-odds?leagues')) {
    html = html.replace(loadDataSearch, loadDataReplacement);
    console.log("✅ Injected game-odds fetch into loadData");
}

// 4. Initialize state.gameOdds
const stateSearch = `const state = {`;
const stateReplacement = `const state = {
      gameOdds: {}, // Restored for game-level ML/Totals/Spreads/Alts`;

if (html.includes(stateSearch) && !html.includes('gameOdds: {},')) {
    html = html.replace(stateSearch, stateReplacement);
    console.log("✅ Initialized state.gameOdds");
}

fs.writeFileSync(path, html);
