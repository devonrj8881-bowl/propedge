const fs = require('fs');
const path = '/Users/devonjohnson/Documents/Claude/Projects/PropEdge/index.html';
let html = fs.readFileSync(path, 'utf8');

// Ensure WNBA is always in the league order lists
const leagueOrders = [
  "['NBA', 'NHL', 'MLB', 'NFL']",
  "['NBA', 'NHL', 'MLB', 'NFL', 'WNBA']",
  "['NBA', 'NHL', 'MLB']"
];

for (const order of leagueOrders) {
  if (html.includes(order)) {
    html = html.replace(order, "['NBA', 'NHL', 'MLB', 'WNBA', 'NFL']");
  }
}

// Fixed activeLeagues join for Odds API
html = html.replace(/const activeLeagues = \['NBA', 'MLB', 'NHL', 'WNBA'\]\.join\(','\)/g, "const activeLeagues = ['NBA', 'MLB', 'NHL', 'WNBA', 'NFL'].join(',')");

fs.writeFileSync(path, html);
