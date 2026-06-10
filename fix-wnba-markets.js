const fs = require('fs');
const path = '/Users/devonjohnson/Documents/Claude/Projects/PropEdge/index.html';
let html = fs.readFileSync(path, 'utf8');

// The block we want to ensure is clean
const correctTabs = `<button class="propai-league-tab active" type="button" data-league="ALL" onclick="toggleMarketsLeague('ALL')">All</button>
            <button class="propai-league-tab" type="button" data-league="NBA" onclick="toggleMarketsLeague('NBA')">🏀 NBA</button>
            <button class="propai-league-tab" type="button" data-league="NHL" onclick="toggleMarketsLeague('NHL')">🏒 NHL</button>
            <button class="propai-league-tab" type="button" data-league="MLB" onclick="toggleMarketsLeague('MLB')">⚾ MLB</button>
            <button class="propai-league-tab" type="button" data-league="NFL" onclick="toggleMarketsLeague('NFL')">🏈 NFL</button>
            <button class="propai-league-tab" type="button" data-league="WNBA" onclick="toggleMarketsLeague('WNBA')">🏀 WNBA</button>`;

// Replace all instances of the league tabs blocks carefully. 
// We will just regex replace the whole block of tabs from ALL to NFL/WNBA.
html = html.replace(/<button class="propai-league-tab active"[^>]*>All<\/button>[\s\S]*?(?=<\/div>)/g, 
  `<button class="propai-league-tab active" type="button" data-league="ALL" onclick="toggleMarketsLeague('ALL')">All</button>
                  <button class="propai-league-tab" type="button" data-league="NBA" onclick="toggleMarketsLeague('NBA')">🏀 NBA</button>
                  <button class="propai-league-tab" type="button" data-league="NHL" onclick="toggleMarketsLeague('NHL')">🏒 NHL</button>
                  <button class="propai-league-tab" type="button" data-league="MLB" onclick="toggleMarketsLeague('MLB')">⚾ MLB</button>
                  <button class="propai-league-tab" type="button" data-league="NFL" onclick="toggleMarketsLeague('NFL')">🏈 NFL</button>
                  <button class="propai-league-tab" type="button" data-league="WNBA" onclick="toggleMarketsLeague('WNBA')">🏀 WNBA</button>\n                `);

fs.writeFileSync(path, html);
console.log("✅ Fixed Markets / PropAI league tabs to include WNBA correctly");
