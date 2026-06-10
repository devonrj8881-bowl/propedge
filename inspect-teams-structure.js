#!/usr/bin/env node

const https = require('https');

async function inspect() {
  return new Promise((resolve) => {
    https.get('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams?limit=2', {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
    }, (res) => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        const json = JSON.parse(data);
        console.log(JSON.stringify(json, null, 2).slice(0, 3000));
        resolve();
      });
    }).on('error', (err) => {
      console.error('Error:', err.message);
      resolve();
    });
  });
}

inspect();
