// Netlify Function — /.netlify/functions/news
// ---------------------------------------------------------
// CORS proxy for the news ingestion layer (Fix 03).
// Allowlists ESPN, Rotowire, CBS Sports only. Caches in memory
// for 5 minutes per URL. No credentials required.
//
// Save as: netlify/functions/news.js

const ALLOWED_HOSTS = new Set([
  'site.api.espn.com',
  'www.rotowire.com',
  'www.cbssports.com'
]);

const cache = new Map();
const TTL_MS = 5 * 60 * 1000;

exports.handler = async (event) => {
  const target = event.queryStringParameters && event.queryStringParameters.url;
  if (!target) return { statusCode: 400, body: 'missing url' };
  let parsed;
  try { parsed = new URL(target); }
  catch { return { statusCode: 400, body: 'invalid url' }; }
  if (!ALLOWED_HOSTS.has(parsed.host)) {
    return { statusCode: 403, body: 'host not allowed' };
  }
  const key = parsed.toString();
  const now = Date.now();
  const c = cache.get(key);
  if (c && now - c.ts < TTL_MS) {
    return {
      statusCode: 200,
      headers: { 'access-control-allow-origin': '*', 'content-type': c.contentType, 'x-news-cache': 'hit' },
      body: c.body
    };
  }
  try {
    const res = await fetch(parsed.toString(), {
      headers: { 'user-agent': 'PropEdgeBot/1.0 (+contact: devon@propedge)' }
    });
    const body = await res.text();
    const contentType = res.headers.get('content-type') || 'text/plain';
    if (res.ok) cache.set(key, { ts: now, body, contentType });
    return {
      statusCode: res.status,
      headers: { 'access-control-allow-origin': '*', 'content-type': contentType, 'x-news-cache': 'miss' },
      body
    };
  } catch (err) {
    return { statusCode: 502, body: `upstream error: ${err.message}` };
  }
};
