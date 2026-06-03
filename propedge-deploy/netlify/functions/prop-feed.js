/**
 * PropEdge prop-feed — serves sheet data via Google Sheets API (always fresh).
 * Falls back to gviz/tq public URL for sheets not covered by the API path.
 *
 * GET /.netlify/functions/prop-feed?sheet=propedge-main
 * GET /.netlify/functions/prop-feed?sheet=_meta
 * GET /.netlify/functions/prop-feed?sheet=Prop_Hits
 */

const { google } = require("googleapis");
const path = require("path");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const SHEET_ID = "1e53GcCS9alxJhzDQPqkH55mpllEjVUShPKyP63R-BeY";
const DEFAULT_SHEET = "propedge-main";
const ALLOWED_SHEETS = new Set(["propedge-main", "Prop_Hits", "_meta"]);

// Sheets that we fetch via the API (guaranteed fresh, bypasses Google CDN cache)
const API_SHEETS = new Set(["propedge-main", "_meta"]);

// One-time auth init per cold start
let _sheetsClient = null;
async function getSheetsClient() {
  if (_sheetsClient) return _sheetsClient;

  let auth;
  if (process.env.GOOGLE_CREDENTIALS_JSON) {
    // Production: credentials stored as Netlify environment variable
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
    auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
  } else {
    // Local dev: read from credentials.json file
    const keyFile = path.join(__dirname, "..", "..", "credentials.json");
    auth = new google.auth.GoogleAuth({
      keyFile,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
  }

  const client = await auth.getClient();
  _sheetsClient = google.sheets({ version: "v4", auth: client });
  return _sheetsClient;
}

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

// Fetch via Google Sheets API — always returns live data
async function fetchViaApi(sheetName) {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${sheetName}!A:Z`,
    valueRenderOption: "FORMATTED_VALUE",
  });
  const rows = res.data.values || [];
  if (rows.length === 0) return null;
  return valuesToCsv(rows);
}

// Fallback: gviz/tq public URL (may be cached by Google for a few minutes)
async function fetchViaGviz(sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
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

  try {
    let csv = null;

    if (API_SHEETS.has(sheet)) {
      // Use the Sheets API for critical sheets — bypasses Google CDN cache entirely
      try {
        csv = await fetchViaApi(sheet);
      } catch (apiErr) {
        console.warn(`[prop-feed] API fetch failed for ${sheet}, falling back to gviz: ${apiErr.message}`);
        csv = await fetchViaGviz(sheet);
      }
    } else {
      csv = await fetchViaGviz(sheet);
    }

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
        // No-cache for API-served sheets so every load gets fresh data
        "Cache-Control": API_SHEETS.has(sheet)
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
