const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

const core = require('./apisports-bundle-core');

function json(statusCode, body, extra = {}) {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, ...extra },
    body: JSON.stringify(body),
  };
}

exports.handler = async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return json(405, { ok: false, error: 'Method not allowed' });
  }

  const refresh = String(event.queryStringParameters?.refresh || '0') === '1';
  const force = String(event.queryStringParameters?.force || '0') === '1';

  try {
    if (!refresh && !force) {
      const cached = core.getCachedBundle();
      if (cached) {
        return json(200, {
          ok: true,
          cache: 'hit',
          bundle: cached,
          apisports_calls_used: 0,
          apisports_calls_remaining_estimate: Math.max(0, core.DAILY_BUDGET - (cached.meta?.daily_calls_used_estimate || 0)),
        }, {
          'Cache-Control': 'public, max-age=21600, stale-while-revalidate=43200',
          'X-PropEdge-Cache': 'hit',
        });
      }
    }

    const result = await core.refreshBundle({ force: force || refresh });
    const bundle = result.bundle || core.getCachedBundle();
    return json(200, {
      ok: result.ok,
      cache: result.cached ? 'debounced' : 'miss',
      bundle,
      apisports_calls_used: result.calls_used || 0,
      apisports_calls_remaining_estimate: Math.max(0, core.DAILY_BUDGET - (bundle?.meta?.daily_calls_used_estimate || 0)),
      warning: result.error || '',
    }, {
      'Cache-Control': 'public, max-age=21600, stale-while-revalidate=43200',
      'X-PropEdge-Cache': result.cached ? 'debounced' : 'miss',
    });
  } catch (err) {
    const stale = core.getCachedBundle();
    if (stale) {
      return json(200, {
        ok: true,
        cache: 'stale',
        bundle: stale,
        warning: err.message,
        apisports_calls_used: 0,
      });
    }
    return json(200, {
      ok: false,
      error: err.message,
      bundle: null,
      apisports_calls_used: 0,
    });
  }
};
