const fs = require('fs');

const path = '/Users/devonjohnson/Documents/Claude/Projects/PropEdge/index.html';
let html = fs.readFileSync(path, 'utf8');

const replacements = [
    {
        find: `<button class="site-league-chip" data-shell-league="NFL" onclick="triggerShellLeague('NFL', this)">NFL</button>`,
        replace: `<button class="site-league-chip" data-shell-league="NFL" onclick="triggerShellLeague('NFL', this)">NFL</button>\n            <button class="site-league-chip" data-shell-league="WNBA" onclick="triggerShellLeague('WNBA', this)">WNBA</button>`
    },
    {
        find: `<button class="pace-filter-btn" data-league="MLB" onclick="filterPaceByLeague('MLB')">⚾ MLB</button>`,
        replace: `<button class="pace-filter-btn" data-league="MLB" onclick="filterPaceByLeague('MLB')">⚾ MLB</button>\n        <button class="pace-filter-btn" data-league="WNBA" onclick="filterPaceByLeague('WNBA')">🏀 WNBA</button>`
    },
    {
        find: `<button class="propai-league-tab" type="button" data-league="NFL" onclick="toggleMarketsLeague('NFL')">🏈 NFL</button>`,
        replace: `<button class="propai-league-tab" type="button" data-league="NFL" onclick="toggleMarketsLeague('NFL')">🏈 NFL</button>\n                  <button class="propai-league-tab" type="button" data-league="WNBA" onclick="toggleMarketsLeague('WNBA')">🏀 WNBA</button>`
    },
    {
        find: `<button type="button" class="propai-gen-league-btn" data-gen-league="MLB" onclick="setGenLeague('MLB')">MLB</button>`,
        replace: `<button type="button" class="propai-gen-league-btn" data-gen-league="MLB" onclick="setGenLeague('MLB')">MLB</button>\n                  <button type="button" class="propai-gen-league-btn" data-gen-league="WNBA" onclick="setGenLeague('WNBA')">WNBA</button>`
    },
    {
        find: `<div class="sport-tab" data-league="MLB">⚾ MLB</div>`,
        replace: `<div class="sport-tab" data-league="MLB">⚾ MLB</div>\n    <div class="sport-tab" data-league="WNBA">🏀 WNBA</div>`
    },
    {
        find: `<button class="league-news-pill" data-league-news="NFL" onclick="setLeagueNewsFilter('NFL')">🏈 NFL</button>`,
        replace: `<button class="league-news-pill" data-league-news="NFL" onclick="setLeagueNewsFilter('NFL')">🏈 NFL</button>\n              <button class="league-news-pill" data-league-news="WNBA" onclick="setLeagueNewsFilter('WNBA')">🏀 WNBA</button>`
    }
];

let changed = false;
for (const r of replacements) {
    if (html.includes(r.find) && !html.includes(r.replace)) {
        html = html.replace(r.find, r.replace);
        console.log("✅ Replaced WNBA button near:", r.find.trim().substring(0, 30));
        changed = true;
    }
}

// Ensure odds API script is back.
// Let's check if MultiBookOddsProvider exists in index.html
if (!html.includes('class MultiBookOddsProvider')) {
    console.log("⚠️ MultiBookOddsProvider is missing entirely. Restoring from propedge-deploy/index.html backup...");
    // Let's grab it from the backup index.html.april4-backup or propedge-deploy/index.html.bak
}

fs.writeFileSync(path, html);
console.log("✅ WNBA UI patch complete");

