/**
 * PropEdge prop-feed — public CSV proxy for propedge-main sheet.
 * Used by PropEdge SPA fallback and propedge-generative-analyst (Vercel).
 *
 * GET /.netlify/functions/prop-feed?sheet=propedge-main
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const SHEET_ID = "1e53GcCS9alxJhzDQPqkH55mpllEjVUShPKyP63R-BeY";
const DEFAULT_SHEET = "propedge-main";
const ALLOWED_SHEETS = new Set(["propedge-main", "Prop_Hits", "_meta"]);

function isPropFeedCsvBody(text) {
  const csv = String(text || "").trim();
  if (csv.length < 10 || /^\s*</.test(csv)) return false;
  const head = csv.split("\n")[0] || "";
  return /PF Rating|Player|key/i.test(head);
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "text/plain" },
      body: "Method not allowed",
    };
  }

  const params = event.queryStringParameters || {};
  const sheet = ALLOWED_SHEETS.has(params.sheet) ? params.sheet : DEFAULT_SHEET;

  try {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "PropEdge-prop-feed/1.0" },
    });

    if (!res.ok) {
      return {
        statusCode: 502,
        headers: { ...CORS_HEADERS, "Content-Type": "text/plain" },
        body: `Upstream sheet fetch failed: HTTP ${res.status}`,
      };
    }

    const csv = await res.text();
    if (!isPropFeedCsvBody(csv)) {
      return {
        statusCode: 502,
        headers: { ...CORS_HEADERS, "Content-Type": "text/plain" },
        body: "Invalid prop feed response",
      };
    }

    return {
      statusCode: 200,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": "public, max-age=60, stale-while-revalidate=120",
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
