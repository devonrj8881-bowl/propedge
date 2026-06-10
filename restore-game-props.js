const fs = require('fs');
const path = '/Users/devonjohnson/Documents/Claude/Projects/PropEdge/index.html';
let html = fs.readFileSync(path, 'utf8');

// 1. Create the helper function to generate game-level props
const helperFunction = `
    function createGameLevelPropsFromOdds() {
      if (!state.gameOdds || Object.keys(state.gameOdds).length === 0) return [];
      const gameProps = [];
      
      Object.entries(state.gameOdds).forEach(([gameId, markets]) => {
        // Find the game info from state.games
        const league = gameId.split(':')[0]; // format was league:away:home:time
        const game = [...(state.games.NBA || []), ...(state.games.NHL || []), ...(state.games.MLB || []), ...(state.games.WNBA || []), ...(state.games.NFL || [])]
          .find(g => String(g.id) === String(gameId));
        
        if (!game) return;

        Object.entries(markets).forEach(([marketKey, lines]) => {
          if (!Array.isArray(lines)) return;
          
          lines.forEach((line, idx) => {
            const propType = line.market || marketKey;
            const side = line.side || 'OVER';
            
            // Create a pseudo-prop object compatible with the board
            const p = {
              id: \`game-\${gameId}-\${marketKey}-\${idx}\`,
              player: game.awayTeam + ' @ ' + game.homeTeam,
              team: side === 'OVER' || line.name === game.homeTeam ? game.homeTeam : game.awayTeam,
              opponent: side === 'OVER' || line.name === game.homeTeam ? game.awayTeam : game.homeTeam,
              league: league,
              prop: propType,
              statType: propType,
              line: line.line || line.point || '',
              odds: line.odds || line.price || '',
              direction: side,
              modelScore: 70, // Baseline for game-level odds
              pfRating: 70,
              confidence: 65,
              l10Pct: 50,
              isGameLevel: true,
              game_id: gameId
            };
            gameProps.push(p);
          });
        });
      });
      return gameProps;
    }
`;

// 2. Inject the call into syncUnifiedScores
const syncTarget = `console.log(\`[PropEdge v5] syncUnifiedScores: aligned \${synced} props to computeBetScore() engine\`);`;
const syncReplacement = `
      // --- RESTORED: Inject Game-Level Props (ML, Totals, Spreads) ---
      const gameLevelProps = createGameLevelPropsFromOdds();
      if (gameLevelProps.length > 0) {
        state.props = [...state.props, ...gameLevelProps];
        console.log(\`[PropEdge] Injected \${gameLevelProps.length} game-level props from Odds API\`);
      }
      // --------------------------------------------------------------
      console.log(\`[PropEdge v5] syncUnifiedScores: aligned \${synced} props to computeBetScore() engine\`);`;

// 3. Update propAIMarketCategory to recognize game markets
const catTarget = `if (market.includes('steals')) return 'Steals';`;
const catReplacement = `if (market.includes('steals')) return 'Steals';
      if (market.includes('moneyline') || market.includes('h2h')) return 'Moneyline';
      if (market.includes('total') || market.includes('o/u')) return 'Totals';
      if (market.includes('spread')) return 'Spread';`;

// 4. Update the Markets Sidebar HTML to show the new categories
const htmlTarget = `<button class="propai-market-tab" type="button" data-market="Goals" onclick="setPropAIMarketFilter('Goals')">Goals</button>`;
const htmlReplacement = `<button class="propai-market-tab" type="button" data-market="Goals" onclick="setPropAIMarketFilter('Goals')">Goals</button>
                <button class="propai-market-tab" type="button" data-market="Moneyline" onclick="setPropAIMarketFilter('Moneyline')">Moneyline</button>
                <button class="propai-market-tab" type="button" data-market="Totals" onclick="setPropAIMarketFilter('Totals')">Totals</button>
                <button class="propai-market-tab" type="button" data-market="Spread" onclick="setPropAIMarketFilter('Spread')">Spread</button>`;

if (!html.includes('function createGameLevelPropsFromOdds')) {
    html = html.replace('function syncUnifiedScores() {', helperFunction + '\n    function syncUnifiedScores() {');
    html = html.replace(syncTarget, syncReplacement);
    html = html.replace(catTarget, catReplacement);
    // Replace in both sidebar locations
    html = html.replace(new RegExp(htmlTarget, 'g'), htmlReplacement);
    
    fs.writeFileSync(path, html);
    console.log("✅ Restored Game-Level Prop generation and Market UI");
} else {
    console.log("✅ Game-level props already restored");
}
