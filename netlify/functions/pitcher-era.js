/**
 * Netlify Scheduled Function: Enrich Pitcher ERA Data
 *
 * Schedule: Daily at 8 AM ET (configured in netlify.toml)
 *
 * Sources: ESPN (games + pitchers + ERA/WHIP) + Baseball Savant (xERA)
 * No MLB StatsAPI calls — those are blocked on Netlify/AWS IP ranges.
 *
 * Environment Variables Required:
 * - PROPEDGE_SHEET_ID: Google Sheet ID
 * - GOOGLE_SERVICE_ACCOUNT: JSON string with service account credentials
 */

const https = require('https');
const crypto = require('crypto');

// ─────────────────────────────────────────────────────────────────────────────
// HTTP util
// ─────────────────────────────────────────────────────────────────────────────

function fetchText(url, options = {}) {
  return new Promise((resolve, reject) => {
    const isPost = options.method === 'POST';
    const bodyStr = options.body || null;
    const opts = {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0',
        ...(isPost ? { 'Content-Type': options.contentType || 'application/json' } : {}),
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
      method: options.method || 'GET',
    };
    const req = https.request(url, opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function fetchJSON(url) {
  const text = await fetchText(url);
  return JSON.parse(text);
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1: Today's games from ESPN scoreboard
// ─────────────────────────────────────────────────────────────────────────────

async function fetchESPNGames(date) {
  const data = await fetchJSON('https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?limit=500');
  const games = (data.events || []).filter(e => e.date.startsWith(date));

  return games.map(e => {
    const competitors = e.competitions?.[0]?.competitors || [];
    const home = competitors.find(c => c.homeAway === 'home') || competitors[0];
    const away = competitors.find(c => c.homeAway === 'away') || competitors[1];
    return {
      eventId: e.id,
      homeTeam: home?.team?.abbreviation,
      awayTeam: away?.team?.abbreviation,
      homeTeamName: home?.team?.displayName,
      awayTeamName: away?.team?.displayName,
      status: e.status?.type?.name
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2: Starting pitchers from ESPN game summary boxscore
// ─────────────────────────────────────────────────────────────────────────────

async function fetchStartingPitchers(game) {
  const summary = await fetchJSON(
    `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event=${game.eventId}`
  );

  const result = [];
  for (const team of summary.boxscore?.players || []) {
    const pitching = team.statistics?.find(s => s.type === 'pitching' || s.name === 'pitching');
    if (!pitching) continue;

    // First pitcher listed in boxscore = starting pitcher
    const starter = pitching.athletes?.[0];
    if (!starter?.athlete?.id) continue;

    const isHome = team.team?.abbreviation === game.homeTeam;
    result.push({
      espnId: starter.athlete.id,
      name: starter.athlete.displayName,
      team: isHome ? game.homeTeam : game.awayTeam,
      teamName: isHome ? game.homeTeamName : game.awayTeamName,
      opponent: isHome ? game.awayTeam : game.homeTeam,
      isHome
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3: Season stats from Baseball Savant — ERA, WHIP, xERA (all 2026 only)
// ESPN stats API returns career totals so we use Statcast for all rate stats.
// ─────────────────────────────────────────────────────────────────────────────

async function fetchStatcastLeaderboard() {
  const csv = await fetchText(
    'https://baseballsavant.mlb.com/leaderboard/custom?year=2026&type=pitcher&filter=&sort=4&sortDir=asc&min=0&selections=p_era,p_whip,xera&csv=true'
  );
  const lines = csv.trim().split('\n');
  // Name field contains a comma ("Smith, John") so after split it occupies cols 0+1
  const headers = lines[0].replace(/"/g, '').split(',').map(h => h.trim());
  const eraIdx  = headers.indexOf('p_era');
  const whipIdx = headers.indexOf('p_whip');
  const xeraIdx = headers.indexOf('xera');

  const lookup = {};
  for (const line of lines.slice(1)) {
    const cols = line.replace(/"/g, '').split(',');
    const last  = cols[0]?.trim();
    const first = cols[1]?.trim();
    if (!last || !first) continue;
    const key = `${first} ${last}`.toLowerCase();
    lookup[key] = {
      era:  parseFloat(cols[eraIdx])  || null,
      whip: parseFloat(cols[whipIdx]) || null,
      xera: parseFloat(cols[xeraIdx]) || null,
    };
  }
  return lookup;
}

// ─────────────────────────────────────────────────────────────────────────────
// Google Sheets — pure Node.js implementation (no googleapis package)
// Uses crypto (built-in) to sign JWT, then raw HTTPS for Sheets API calls.
// ─────────────────────────────────────────────────────────────────────────────

async function getGoogleAccessToken(credentials) {
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify(claim)).toString('base64url');
  const unsigned = `${header}.${payload}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(unsigned);
  const sig = sign.sign(credentials.private_key, 'base64url');
  const jwt = `${unsigned}.${sig}`;

  const body = `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`;
  const res = await fetchText('https://oauth2.googleapis.com/token', { method: 'POST', body, contentType: 'application/x-www-form-urlencoded' });
  return JSON.parse(res).access_token;
}

function sheetsRequest(token, method, path, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'sheets.googleapis.com',
      path,
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
      timeout: 10000,
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { resolve(data); } });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Sheets request timeout')); });
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function updateGoogleSheet(pitcherData) {
  const sheetId = process.env.PROPEDGE_SHEET_ID;
  const serviceAccountRaw = process.env.GOOGLE_SERVICE_ACCOUNT;

  if (!sheetId || !serviceAccountRaw) {
    console.warn('⚠️ PROPEDGE_SHEET_ID or GOOGLE_SERVICE_ACCOUNT not configured — skipping');
    return false;
  }

  const credentials = JSON.parse(serviceAccountRaw);
  const token = await getGoogleAccessToken(credentials);

  // Build team → ERA/xERA lookup
  const byTeam = {};
  for (const p of pitcherData) {
    if (p.team) byTeam[p.team.toUpperCase()] = { era: p.era, xera: p.xera };
  }

  const base = `/v4/spreadsheets/${sheetId}/values`;

  // Read current headers
  const headerRes = await sheetsRequest(token, 'GET', `${base}/A1:ZZ1`);
  let headers = headerRes.values?.[0] || [];

  // Add pitcher_era / pitcher_xera columns if missing
  let eraColIdx  = headers.indexOf('pitcher_era');
  let xeraColIdx = headers.indexOf('pitcher_xera');

  if (eraColIdx === -1) {
    eraColIdx = headers.length;
    headers.push('pitcher_era');
    await sheetsRequest(token, 'PUT', `${base}/${colLetter(eraColIdx)}1?valueInputOption=RAW`, { values: [['pitcher_era']] });
    console.log(`  Added pitcher_era at col ${colLetter(eraColIdx)}`);
  }
  if (xeraColIdx === -1) {
    xeraColIdx = headers.length;
    headers.push('pitcher_xera');
    await sheetsRequest(token, 'PUT', `${base}/${colLetter(xeraColIdx)}1?valueInputOption=RAW`, { values: [['pitcher_xera']] });
    console.log(`  Added pitcher_xera at col ${colLetter(xeraColIdx)}`);
  }

  // Read team column (B)
  const teamRes = await sheetsRequest(token, 'GET', `${base}/B:B`);
  const teamCol = teamRes.values || [];

  // Batch update matching rows
  const batchData = [];
  let rowsUpdated = 0;
  const eraL = colLetter(eraColIdx);
  const xeraL = colLetter(xeraColIdx);

  for (let i = 1; i < teamCol.length; i++) {
    const team = teamCol[i]?.[0]?.trim().toUpperCase();
    if (!team || !byTeam[team]) continue;
    const row = i + 1;
    batchData.push({ range: `${eraL}${row}`,  values: [[byTeam[team].era  ?? '']] });
    batchData.push({ range: `${xeraL}${row}`, values: [[byTeam[team].xera ?? '']] });
    rowsUpdated++;
  }

  if (batchData.length > 0) {
    await sheetsRequest(token, 'POST', `${base}:batchUpdate`, { valueInputOption: 'RAW', data: batchData });
  }

  console.log(`  ✅ Sheet updated: ${rowsUpdated} rows written`);
  return true;
}

// Convert 0-based column index to letter(s): 0→A, 25→Z, 26→AA
function colLetter(idx) {
  let result = '';
  idx++;
  while (idx > 0) {
    idx--;
    result = String.fromCharCode(65 + (idx % 26)) + result;
    idx = Math.floor(idx / 26);
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  const startTime = Date.now();
  const now = new Date();
  const date = new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString().split('T')[0]; // ET date

  console.log(`\n🔄 Pitcher ERA Enrichment — ${date} (trigger: ${event.httpMethod || 'scheduled'})\n`);

  try {
    // Step 1: Games
    console.log('📍 Step 1: Fetching ESPN games...');
    const games = await fetchESPNGames(date);
    console.log(`  Found ${games.length} games for ${date}`);

    if (games.length === 0) {
      return { statusCode: 200, body: JSON.stringify({ message: 'No games today', date }) };
    }

    // Step 2: Starters
    console.log('📍 Step 2: Fetching starting pitchers from ESPN boxscores...');
    const allPitchers = [];
    for (const game of games) {
      try {
        const starters = await fetchStartingPitchers(game);
        console.log(`  ${game.awayTeam} @ ${game.homeTeam}: ${starters.map(p => p.name).join(', ') || 'none found'}`);
        allPitchers.push(...starters);
      } catch (err) {
        console.warn(`  ⚠️ Failed for ${game.awayTeam} @ ${game.homeTeam}: ${err.message}`);
      }
    }

    if (allPitchers.length === 0) {
      return { statusCode: 200, body: JSON.stringify({ message: 'No pitcher data available', date }) };
    }

    // Step 3: ERA/WHIP/xERA from Statcast (season-specific, one fetch)
    console.log(`📍 Step 3: Fetching 2026 stats from Baseball Savant...`);

    let statcastLookup = {};
    try {
      statcastLookup = await fetchStatcastLeaderboard();
      console.log(`  Statcast loaded: ${Object.keys(statcastLookup).length} pitchers`);
    } catch (err) {
      console.warn(`  ⚠️ Statcast fetch failed: ${err.message}`);
    }

    const enriched = [];
    for (const pitcher of allPitchers) {
      const stats = statcastLookup[pitcher.name.toLowerCase()] || null;

      const entry = {
        name: pitcher.name,
        team: pitcher.team,
        opponent: pitcher.opponent,
        isHome: pitcher.isHome,
        espnId: pitcher.espnId,
        era:  stats?.era  ?? null,
        xera: stats?.xera ?? null,
      };

      if (entry.era !== null) {
        console.log(`  ✅ ${pitcher.name} (${pitcher.team}): ERA ${entry.era} | xERA ${entry.xera}`);
      } else {
        console.warn(`  ⚠️ ${pitcher.name}: not in Statcast leaderboard`);
      }

      enriched.push(entry);
    }

    // Step 4: Sheet update
    console.log('📍 Step 4: Updating Google Sheet...');
    await updateGoogleSheet(enriched);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const result = {
      success: true,
      message: `✅ Enriched ${enriched.filter(p => p.era).length}/${enriched.length} pitchers in ${duration}s`,
      stats: {
        gamesScraped: games.length,
        pitchersFound: allPitchers.length,
        pitchersWithERA: enriched.filter(p => p.era).length,
        durationSeconds: parseFloat(duration)
      },
      data: enriched,
      date,
    };

    console.log('\n✨ Complete:', result.message);
    return { statusCode: 200, body: JSON.stringify(result) };

  } catch (err) {
    console.error('❌ Fatal error:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
