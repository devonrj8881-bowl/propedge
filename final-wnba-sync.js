const fs = require('fs');
const path = '/Users/devonjohnson/Documents/Claude/Projects/PropEdge/index.html';
let html = fs.readFileSync(path, 'utf8');

// Ensure WNBA is in the join array for game-odds
html = html.replace(/const activeLeagues = \['NBA', 'MLB', 'NHL', 'WNBA'\]\.join\(','\)/, "const activeLeagues = ['NBA', 'MLB', 'NHL', 'WNBA'].join(',')");
html = html.replace(/const activeLeagues = \['NBA', 'MLB', 'NHL'\]\.join\(','\)/, "const activeLeagues = ['NBA', 'MLB', 'NHL', 'WNBA'].join(',')");

// Ensure WNBA is in the live games ticker loop
html = html.replace(/const liveGames = \[\s*\.\.\.\(state\.games\.NBA \|\| \[\]\), \.\.\.\(state\.games\.NHL \|\| \[\]\),\s*\.\.\.\(state\.games\.MLB \|\| \[\]\), \.\.\.\(state\.games\.NFL \|\| \[\]\),\s*\]/g, 
  "const liveGames = [\n        ...(state.games.NBA || []), ...(state.games.NHL || []),\n        ...(state.games.MLB || []), ...(state.games.NFL || []), ...(state.games.WNBA || []),\n      ]");

fs.writeFileSync(path, html);
console.log("✅ Final WNBA sync complete");
