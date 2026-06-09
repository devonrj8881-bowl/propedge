/**
 * PropEdge prop-feed — serves sheet data as CSV.
 *
 * Pure fetch implementation (NO googleapis dependency — node_modules is not
 * deployed, so requiring googleapis crashed the function at cold start with
 * "Cannot find module 'googleapis'"). The sheet is public, so we read it via
 * the Google API key (fresh, no CDN cache) and fall back to the public gviz
 * CSV endpoint.
 *
 * GET /.netlify/functions/prop-feed?sheet=propedge-main
 * GET /.netlify/functions/prop-feed?sheet=meta
 * GET /.netlify/functions/prop-feed?sheet=Prop_Hits
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const SHEET_ID = "1e53GcCS9alxJhzDQPqkH55mpllEjVUShPKyP63R-BeY";
const DEFAULT_SHEET = "propedge-main";
const ALLOWED_SHEETS = new Set(["propedge-main", "Prop_Hits", "meta"]);

// Sheets that must always be fresh (no CDN cache) — served no-store.
const FRESH_SHEETS = new Set(["propedge-main"]);

// Convert a 2D array of values to CSV string
function valuesToCsv(rows) {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const s = String(cell ?? "");
          return s.includes(",") || s.includes('"') || s.includes("\n")
            ? `"${s.replace(/"/g, '""')}"`
            : s;
        })
        .join(",")
    )
    .join("\n");
}

// Fetch via Google API key — works for public sheets, key fits in Netlify env var
async function fetchViaApiKey(sheetName) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) return null;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(sheetName)}!A:Z?key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const rows = data.values || [];
  if (rows.length === 0) return null;
  return valuesToCsv(rows);
}

const SHEET_GIDS = {
  "propedge-main": "1351555262",
  "meta": "1129712148",
  "Prop_Hits": "127085720",
};

// Public CSV export endpoint — no auth required for a public sheet.
async function fetchViaGviz(sheetName, bustCache) {
  const gid = SHEET_GIDS[sheetName];
  const cacheBust = bustCache ? `&_=${Date.now()}` : "";
  const url = gid
    ? `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}${cacheBust}`
    : `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}${cacheBust}`;
  const res = await fetch(url, { headers: { "User-Agent": "PropEdge-prop-feed/1.0" } });
  if (!res.ok) return null;
  const text = await res.text();
  if (!text || /^\s*</.test(text)) return null;
  return text;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers: { ...CORS_HEADERS, "Content-Type": "text/plain" }, body: "Method not allowed" };
  }

  const params = event.queryStringParameters || {};
  const sheet = ALLOWED_SHEETS.has(params.sheet) ? params.sheet : DEFAULT_SHEET;
  const fresh = FRESH_SHEETS.has(sheet);

  try {
    // Prefer API key (always fresh); fall back to public gviz.
    let csv = await fetchViaApiKey(sheet);
    if (!csv) csv = await fetchViaGviz(sheet, fresh);

    if (!csv) {
      return {
        statusCode: 502,
        headers: { ...CORS_HEADERS, "Content-Type": "text/plain" },
        body: `Sheet data unavailable for: ${sheet}`,
      };
    }

    return {
      statusCode: 200,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": fresh
          ? "no-store"
          : "public, max-age=60, stale-while-revalidate=120",
      },
      body: csv,
    };
  } catch (err) {
    console.error("[prop-feed]", err.message);
    return {
      statusCode: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "text/plain" },
      body: err.message || "prop-feed error",
    };
  }
};
