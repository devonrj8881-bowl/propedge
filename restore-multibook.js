const fs = require('fs');
const path = '/Users/devonjohnson/Documents/Claude/Projects/PropEdge/index.html';
let html = fs.readFileSync(path, 'utf8');

const targetMethod = `async function fetchMultiBookOdds(player, propType, team, league) {`;
const replacementMethod = `// MULTIBOOK ODDS PROVIDER (Restored)
    class MultiBookOddsProvider {
      constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://api.the-odds-api.com/v4/sports';
        this.sportsMap = {
          'NBA': 'basketball_nba',
          'NHL': 'hockey_nhl',
          'MLB': 'baseball_mlb',
          'NFL': 'americanfootball_nfl',
          'WNBA': 'basketball_wnba'
        };
      }

      async fetchPlayerProps(league, eventId) {
        if (!this.sportsMap[league]) return null;
        try {
          // Add alternate totals/lines to markets
          const markets = 'player_points,player_rebounds,player_assists,player_threes,player_blocks,player_steals,player_points_rebounds_assists,alternate_player_points,alternate_player_rebounds,alternate_player_assists';
          const url = \`\${this.baseUrl}/\${this.sportsMap[league]}/events/\${eventId}/odds?apiKey=\${this.apiKey}&regions=us&markets=\${markets}&oddsFormat=american\`;
          
          const response = await fetch(url);
          if (!response.ok) return null;
          return await response.json();
        } catch(e) {
          console.warn('[MultiBook] Failed to fetch odds:', e);
          return null;
        }
      }
    }
    
    // Fallback to existing logic if odds API is rate-limited
    async function fetchMultiBookOdds(player, propType, team, league) {`;

if (html.includes(targetMethod) && !html.includes('class MultiBookOddsProvider')) {
    html = html.replace(targetMethod, replacementMethod);
    console.log("✅ Restored MultiBookOddsProvider logic");
} else if (html.includes('class MultiBookOddsProvider')) {
    console.log("✅ MultiBookOddsProvider already exists");
}

fs.writeFileSync(path, html);
