const fs = require('fs');
const path = '/Users/devonjohnson/Documents/Claude/Projects/PropEdge/index.html';
let html = fs.readFileSync(path, 'utf8');

const replacements = [
    {
        find: `['NBA', 'NHL', 'MLB', 'NFL']`,
        replace: `['NBA', 'NHL', 'MLB', 'NFL', 'WNBA']`
    },
    {
        find: `['NBA', 'NHL', 'MLB']`,
        replace: `['NBA', 'NHL', 'MLB', 'WNBA']`
    },
    {
        find: `window._teamStats  = { NBA: {}, NHL: {}, MLB: {} };`,
        replace: `window._teamStats  = { NBA: {}, NHL: {}, MLB: {}, WNBA: {} };`
    },
    {
        find: `window._gameLocations = { NBA: {}, NHL: {}, MLB: {}, NFL: {} };`,
        replace: `window._gameLocations = { NBA: {}, NHL: {}, MLB: {}, NFL: {}, WNBA: {} };`
    },
    {
        find: `games: { NBA: [], NHL: [], MLB: [], NFL: [] },`,
        replace: `games: { NBA: [], NHL: [], MLB: [], NFL: [], WNBA: [] },`
    },
    {
        find: `teamSituational: { NBA: {}, NHL: {}, MLB: {} }, // abbr → { daysRest, isB2b, restPlus, revengeVs }`,
        replace: `teamSituational: { NBA: {}, NHL: {}, MLB: {}, WNBA: {} }, // abbr → { daysRest, isB2b, restPlus, revengeVs }`
    },
    {
        find: `matchupMatrix: { NBA: {}, NHL: {}, MLB: {} }, // opp|statBucket → { rank, paceRank, score }`,
        replace: `matchupMatrix: { NBA: {}, NHL: {}, MLB: {}, WNBA: {} }, // opp|statBucket → { rank, paceRank, score }`
    },
    {
        find: `injuries: { NBA: [], NHL: [], MLB: [], NFL: [] },`,
        replace: `injuries: { NBA: [], NHL: [], MLB: [], NFL: [], WNBA: [] },`
    },
    {
        find: `<div class="sport-tab" data-league="MLB">⚾ MLB</div>`,
        replace: `<div class="sport-tab" data-league="MLB">⚾ MLB</div>\n    <div class="sport-tab" data-league="WNBA">🏀 WNBA</div>`
    },
    {
        find: `<button class="propai-league-tab" type="button" data-league="MLB" onclick="toggleMarketsLeague('MLB')">⚾ MLB</button>`,
        replace: `<button class="propai-league-tab" type="button" data-league="MLB" onclick="toggleMarketsLeague('MLB')">⚾ MLB</button>\n                  <button class="propai-league-tab" type="button" data-league="WNBA" onclick="toggleMarketsLeague('WNBA')">🏀 WNBA</button>`
    }
];

let changed = false;
for (const r of replacements) {
    if (html.includes(r.find) && !html.includes(r.replace)) {
        html = html.replace(r.find, r.replace);
        console.log("✅ Replaced:", r.find.substring(0, 30) + '...');
        changed = true;
    }
}

// Add WNBA to ESPNs URLs if not there
const nflUrl = `NFL: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard'`;
const wnbaUrl = `NFL: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',\n      WNBA: 'https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/scoreboard'`;
if (html.includes(nflUrl) && !html.includes(`WNBA: 'https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/scoreboard'`)) {
    html = html.replace(nflUrl, wnbaUrl);
    console.log("✅ Added WNBA scoreboard URL");
    changed = true;
}

if (changed) {
    fs.writeFileSync(path, html);
    console.log("✅ WNBA successfully restored to index.html");
} else {
    console.log("⚠️ WNBA already present or targets not found");
}
