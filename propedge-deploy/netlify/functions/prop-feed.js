/**
 * PropEdge prop-feed — serves sheet data via Google Sheets API (always fresh).
 * Falls back to API key (for public sheets), then gviz.
 *
 * GET /.netlify/functions/prop-feed?sheet=propedge-main
 * GET /.netlify/functions/prop-feed?sheet=meta
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
const ALLOWED_SHEETS = new Set(["propedge-main", "Prop_Hits", "meta"]);

// Sheets fetched via authenticated API (bypasses Google CDN cache)
const API_SHEETS = new Set(["propedge-main"]);

// One-time auth init per cold start
let _sheetsClient = null;
async function getSheetsClient() {
  if (_sheetsClient) return _sheetsClient;

  let auth;
  if (process.env.GOOGLE_CREDENTIALS_JSON) {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
    auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
  } else {
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

// Fetch via service account (full API access)
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

// Last resort: gviz public URL
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
      try {
        csv = await fetchViaApi(sheet);
      } catch (_) {
        csv = await fetchViaApiKey(sheet);
        if (!csv) csv = await fetchViaGviz(sheet);
      }
    } else {
      csv = await fetchViaApiKey(sheet);
      if (!csv) csv = await fetchViaGviz(sheet);
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
