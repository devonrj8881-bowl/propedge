#!/usr/bin/env node

const https = require('https');

async function inspect() {
  return new Promise((resolve) => {
    https.get('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams?limit=1', {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
    }, (res) => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        const json = JSON.parse(data);
        // Get team object
        const team = json?.sports?.[0]?.leagues?.[0]?.teams?.[0]?.team;

        console.log('=== TEAM DATA STRUCTURE ===\n');
        if (team) {
          console.log('Team Name:', team.displayName);
          console.log('Team ID:', team.id);
          console.log('Top-level keys:', Object.keys(team).join(', '));

          // Check if players/roster are nested
          if (team.players) {
            console.log('\n✅ PLAYERS found in team object!');
            console.log('Number of players:', team.players.length);
            if (team.players[0]) {
              console.log('\nFirst player structure:');
              console.log(JSON.stringify(team.players[0], null, 2).slice(0, 1500));
            }
          } else if (team.roster) {
            console.log('\n✅ ROSTER found in team object!');
            console.log(JSON.stringify(team.roster, null, 2).slice(0, 1500));
          } else {
            console.log('\n❌ No players/roster nested in team object');
            console.log('Team object keys:', Object.keys(team).slice(0, 20));
          }
        }
        resolve();
      });
    }).on('error', (err) => {
      console.error('Error:', err.message);
      resolve();
    });
  });
}

inspect();
