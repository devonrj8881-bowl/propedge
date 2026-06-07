import { NextRequest, NextResponse } from "next/server";
import { buildPropEdgeLlmPayload } from "../../../lib/propedge-payload";
import type { BoardProp } from "../../../lib/types";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const PROP_FEED_URL =
  "https://propedgemasters.netlify.app/.netlify/functions/prop-feed?sheet=propedge-main";

const ASK_ANALYST_URL =
  "https://propedgemasters.netlify.app/.netlify/functions/ask-analyst";

const GAME_FILTER_URL =
  "https://propedgemasters.netlify.app/.netlify/functions/game-filter";

const GEMINI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY || "";
const GEMINI_MODEL_FALLBACKS = [
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-3.1-flash-image",
  "gemini-3-pro-image",
  "gemini-2.5-flash-image",
];

const PRIMARY_MODEL = process.env.GEMINI_MODEL || GEMINI_MODEL_FALLBACKS[0];
const MODEL_CHAIN = Array.from(new Set([PRIMARY_MODEL, ...GEMINI_MODEL_FALLBACKS]));
const MAX_PROPS = 4;
const MAX_GEMINI_ATTEMPTS = 3;

async function fetchProps(): Promise<Record<string, string>[]> {
  const res = await fetch(PROP_FEED_URL, { cache: "no-store" });
  const csv = await res.text();
  if (!csv.includes("Player") && !csv.includes("PF Rating")) {
    throw new Error("Invalid prop feed response");
  }
  const lines = csv.trim().split("\n");
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
  });
}

const SLATE_TIMEZONE = "America/New_York";

function slateDateParts(timeZone = SLATE_TIMEZONE) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  const yyyy = get("year");
  const mm = get("month");
  const dd = get("day");
  return {
    iso: `${yyyy}-${mm}-${dd}`,
    espn: `${yyyy}${mm}${dd}`,
    display: `${Number(mm)}/${Number(dd)}/${yyyy}`,
    timezone: timeZone,
  };
}
type ActiveSlate = {
  date: string;
  dateDisplay: string;
  timezone: string;
  activeTeams: Record<string, string[]>;
  games: Array<{ league?: string; home?: string; away?: string; label?: string; status?: string }>;
};

async function fetchActiveSlate(league: string): Promise<ActiveSlate | null> {
  try {
    const slate = slateDateParts();
    const leagues = league && league !== "ALL" ? league.toUpperCase() : undefined;
    const params = new URLSearchParams({ tz: SLATE_TIMEZONE, date: slate.espn });
    if (leagues) params.set("leagues", leagues);
    const res = await fetch(`${GAME_FILTER_URL}?${params.toString()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.ok || !data.activeTeams) return null;
    return {
      date: data.date || slate.iso,
      dateDisplay: data.dateDisplay || slate.display,
      timezone: data.timezone || SLATE_TIMEZONE,
      activeTeams: data.activeTeams,
      games: data.games || [],
    };
  } catch {
    return null;
  }
}

function normalizeTeamAbbr(team: string): string {
  return String(team || "").toUpperCase().trim();
}

function filterRowsToActiveSlate(
  rows: Record<string, string>[],
  slate: ActiveSlate | null,
  leagueFilter: string,
): Record<string, string>[] {
  if (!slate?.activeTeams) return rows;

  const wantedLeague = leagueFilter && leagueFilter !== "ALL" ? leagueFilter.toUpperCase() : null;

  return rows.filter((row) => {
    const league = (row["League"] || "").toUpperCase();
    if (!league) return false;
    if (wantedLeague && league !== wantedLeague) return false;

    const active = slate.activeTeams[league];
    // No games on today's slate for this league → drop all props (eliminated/off-day)
    if (!active?.length) return false;

    const team = normalizeTeamAbbr(row["Team"] || row["team"] || "");
    const opp = normalizeTeamAbbr(row["Opponent"] || row["Opp"] || row["opponent"] || row["Matchup"] || "");
    return active.includes(team) || (opp.length > 0 && active.includes(opp));
  });
}

function propsMatchingQuestion(rows: Record<string, string>[], question: string): Record<string, string>[] {
  const q = String(question || "").toLowerCase();
  if (q.length < 3) return [];
  return rows.filter((row) => {
    const player = String(row["Player"] || "").toLowerCase();
    const team = String(row["Team"] || "").toLowerCase();
    if (player && q.includes(player)) return true;
    if (player) {
      const parts = player.split(/\s+/).filter((p) => p.length > 2);
      if (parts.some((p) => q.includes(p))) return true;
    }
    if (team && q.includes(team)) return true;
    return false;
  });
}

function buildTopProps(
  rows: Record<string, string>[],
  league: string,
  question = "",
  limit = MAX_PROPS,
) {
  let filtered = league === "ALL"
    ? rows
    : rows.filter((r) => (r["League"] || "").toUpperCase() === league.toUpperCase());

  filtered = filtered.filter((r) => r["Player"] && r["PF Rating"]);

  const matched = propsMatchingQuestion(filtered, question)
    .sort((a, b) => parseFloat(b["PF Rating"] || "0") - parseFloat(a["PF Rating"] || "0"));

  const ranked = [...filtered].sort(
    (a, b) => parseFloat(b["PF Rating"] || "0") - parseFloat(a["PF Rating"] || "0"),
  );

  const merged: Record<string, string>[] = [];
  const seen = new Set<string>();
  for (const row of [...matched, ...ranked]) {
    const key = `${row["Player"]}|${row["Prop"] || row["Market"]}|${row["Line"]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(row);
    if (merged.length >= Math.max(1, Math.min(limit, MAX_PROPS))) break;
  }

  return merged;
}

function formatSlateContext(slate: ActiveSlate | null, league: string): string {
  if (!slate) return "";
  const leagues = league && league !== "ALL" ? [league.toUpperCase()] : Object.keys(slate.activeTeams);
  const lines: string[] = [
    `TODAY'S DATE (US Eastern): ${slate.dateDisplay || slate.date}`,
    `SLATE TIMEZONE: ${slate.timezone || SLATE_TIMEZONE}`,
    "TEAMS PLAYING TODAY (ESPN scoreboard):",
  ];
  for (const lg of leagues) {
    const teams = slate.activeTeams[lg] || [];
    lines.push(`${lg}: ${teams.length ? teams.join(", ") : `NO GAMES — exclude all ${lg} props`}`);
    const games = (slate.games || []).filter((g) => g.league === lg);
    for (const g of games.slice(0, 12)) {
      if (g.home && g.away) lines.push(`  ${g.away} @ ${g.home}${g.status ? ` (${g.status})` : ""}`);
    }
  }
  lines.push("Use ONLY the date above in titles. Do NOT recommend players from teams not listed.");
  return lines.join("\n");
}

function stripJsonFence(raw: string): string {
  return raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

function unescapeJsonString(value: string): string {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

function repairJson(raw: string): string {
  let s = stripJsonFence(raw);
  if (!s.startsWith("{")) {
    const start = s.indexOf("{");
    if (start >= 0) s = s.slice(start);
  }
  if (!s.endsWith("}")) {
    const openStrings = (s.match(/(?<!\\)"/g) || []).length % 2;
    if (openStrings) s += '"';
    const opens = (s.match(/{/g) || []).length;
    const closes = (s.match(/}/g) || []).length;
    s += "}".repeat(Math.max(0, opens - closes));
  }
  return s;
}

function extractJsonFields(raw: string): Record<string, string | number> | null {
  const s = stripJsonFence(raw);
  const out: Record<string, string | number> = {};
  const stringFields = ["article_title", "featured_intro", "matchup_analysis", "key_numbers_breakdown"] as const;

  for (const key of stringFields) {
    const marker = `"${key}"`;
    const idx = s.indexOf(marker);
    if (idx < 0) continue;
    const colon = s.indexOf(":", idx + marker.length);
    if (colon < 0) continue;
    let i = colon + 1;
    while (i < s.length && /\s/.test(s[i])) i += 1;
    if (s[i] !== '"') continue;
    i += 1;
    let value = "";
    while (i < s.length) {
      const ch = s[i];
      if (ch === "\\" && i + 1 < s.length) {
        value += s[i + 1];
        i += 2;
        continue;
      }
      if (ch === '"') break;
      value += ch;
      i += 1;
    }
    if (value) out[key] = unescapeJsonString(value);
  }

  const confMatch = s.match(/"confidence_rating"\s*:\s*([0-9.]+)/);
  out.confidence_rating = confMatch ? Number(confMatch[1]) : 7;

  if (!out.matchup_analysis && !out.featured_intro && !out.article_title) return null;
  return out;
}

function normalizeAnalysis(parsed: Record<string, unknown>) {
  const out: Record<string, string | number> = {
    article_title: String(parsed.article_title || "PropEdge Analyst Report"),
    featured_intro: String(parsed.featured_intro || ""),
    matchup_analysis: String(parsed.matchup_analysis || ""),
    key_numbers_breakdown: String(parsed.key_numbers_breakdown || ""),
    confidence_rating: Number(parsed.confidence_rating) || 7,
  };
  for (const k of ["matchup_analysis", "key_numbers_breakdown", "featured_intro", "article_title"] as const) {
    if (typeof out[k] === "string") out[k] = unescapeJsonString(out[k]);
  }
  return out;
}

function parseGeminiJson(raw: string) {
  const attempts = [raw, stripJsonFence(raw), repairJson(raw)];
  for (const attempt of attempts) {
    try {
      return normalizeAnalysis(JSON.parse(attempt) as Record<string, unknown>);
    } catch {
      /* try next */
    }
  }
  const extracted = extractJsonFields(raw);
  if (extracted) return normalizeAnalysis(extracted);
  throw new Error("Gemini returned malformed JSON");
}

class GeminiApiError extends Error {
  status: number;
  body: string;

  constructor(status: number, body: string) {
    super(`Gemini API ${status}: ${body.slice(0, 300)}`);
    this.status = status;
    this.body = body;
  }
}

function isTransientGeminiError(status: number, body: string): boolean {
  if ([429, 500, 502, 503, 504].includes(status)) return true;
  return /UNAVAILABLE|RESOURCE_EXHAUSTED|high demand|overloaded|temporarily unavailable/i.test(body);
}

function isModelUnavailableError(status: number, body: string): boolean {
  if (status === 404) return true;
  return /not found for API version|not supported for generateContent|is not found/i.test(body);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGeminiModel(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  maxOutputTokens: number,
) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
  const payload = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    generationConfig: {
      temperature: 0.45,
      maxOutputTokens,
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          article_title: { type: "string" },
          featured_intro: { type: "string" },
          matchup_analysis: { type: "string" },
          key_numbers_breakdown: { type: "string" },
          confidence_rating: { type: "number" },
        },
        required: ["article_title", "featured_intro", "matchup_analysis", "key_numbers_breakdown", "confidence_rating"],
      },
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new GeminiApiError(res.status, err);
  }

  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") || "";
  const finishReason = data?.candidates?.[0]?.finishReason || "";
  if (!raw) throw new Error("Gemini returned empty response");
  return { raw, finishReason };
}

async function callGeminiWithResilience(
  systemPrompt: string,
  userPrompt: string,
  maxOutputTokens: number,
) {
  let lastErr: Error | null = null;

  for (const model of MODEL_CHAIN) {
    for (let attempt = 0; attempt < MAX_GEMINI_ATTEMPTS; attempt++) {
      try {
        const result = await callGeminiModel(model, systemPrompt, userPrompt, maxOutputTokens);
        return { ...result, model, fallback: model !== PRIMARY_MODEL };
      } catch (err) {
        lastErr = err instanceof Error ? err : new Error(String(err));
        const status = err instanceof GeminiApiError ? err.status : 0;
        const body = err instanceof GeminiApiError ? err.body : lastErr.message;
        const transient = isTransientGeminiError(status, body);
        const hasRetriesLeft = attempt < MAX_GEMINI_ATTEMPTS - 1;

        if (isModelUnavailableError(status, body)) break;
        if (!transient) throw lastErr;
        if (hasRetriesLeft) {
          await delay(700 * 2 ** attempt + Math.floor(Math.random() * 300));
          continue;
        }
      }
    }
  }

  throw lastErr || new Error("Gemini unavailable");
}

function csvRowToAnalystProp(row: Record<string, string>, league: string) {
  return {
    player: row["Player"] || "",
    team: row["Team"] || "",
    prop: row["Prop"] || row["Market"] || "",
    line: row["Line"] || "",
    league: row["League"] || league,
    pfRating: row["PF Rating"] || "",
    l10Pct: row["L10 Hit %"] || row["L10"] || "",
    edge: row["Edge %"] || row["Edge"] || "",
    odds: row["Odds"] || "",
    direction: row["Direction"] || row["O/U"] || "",
  };
}

// Build a BoardProp directly from a raw CSV row using known column names.
// Bypasses parsePropFeedCsv to avoid "L5 Avg" / "L5" index-collision bug
// and strips the leading apostrophe in Odds like "'-333".
function rowToBoardProp(row: Record<string, string>, league: string): BoardProp {
  const propStr = row["Prop"] || row["Market"] || "";
  const lineMatch = propStr.match(/[ou]?\s*([\d.]+)/i);
  const line = lineMatch ? parseFloat(lineMatch[1]) : 0;
  const propType = propStr.replace(/^[ou]?\s*[\d.]+\s*/i, "").trim();
  const direction = propStr.toLowerCase().trimStart().startsWith("u") ? "UNDER" : "OVER";
  const rawOdds = (row["Odds"] || "").replace(/'/g, "").trim();
  return {
    league: row["League"] || league || undefined,
    player: row["Player"] || "",
    team: row["Team"] || undefined,
    opponent: row["opponent_est"] || undefined,
    pos: row["Pos"] || undefined,
    prop: propType || propStr,
    stat: propType || propStr,
    line: Number.isFinite(line) ? line : undefined,
    direction,
    odds: rawOdds || undefined,
    // Use exact column names — L5/L10/L20 are "(N/M)" fraction hit rates
    l5Pct: row["L5"] || undefined,
    l10Pct: row["L10"] || undefined,
    l20Pct: row["L20"] || undefined,
    seasonPct: row["'25-'26"] || row["Season"] || undefined,
    l5Avg: parseFloat(row["L5 Avg"]) || undefined,
    l10Avg: parseFloat(row["L10 Avg"]) || undefined,
    confidence: parseFloat(row["Confidence %"]) || undefined,
    modelScore: parseFloat(row["PF Rating"]) || undefined,
    matchup_scalar: parseFloat(row["Matchup Scalar"]) || undefined,
    sznMatchup: row["SZN Matchup"] || undefined,
    h2h: row["H2H"] || undefined,
    pitcherERA: parseFloat(row["pitcher_era"]) || undefined,
    pitcherXERA: parseFloat(row["pitcher_xera"]) || undefined,
    streak: parseFloat(row["Streak"]) || undefined,
  };
}

function enrichRow(
  row: Record<string, string>,
  league: string,
): Record<string, unknown> {
  const base = csvRowToAnalystProp(row, league);
  const bp = rowToBoardProp(row, league);
  const payload = buildPropEdgeLlmPayload(bp);
  if (!payload) return base;
  const a = payload.analytics;
  const m = payload.market;
  return {
    ...base,
    ...(a.hit_rate_last_5 != null && { l5_pct: `${Math.round(a.hit_rate_last_5 * 100)}%` }),
    ...(a.hit_rate_last_20 != null && { l20_pct: `${Math.round(a.hit_rate_last_20 * 100)}%` }),
    ...(a.ev_percentage != null && { ev_pct: `${(Math.round(a.ev_percentage * 10) / 10).toFixed(1)}%` }),
    // Use board's PF Rating as canonical score — matches what the board shows.
    // computePortablePropIq score is kept only for factor/signal text generation.
    ...(parseFloat(row["PF Rating"]) > 0 && { propiq_score: parseFloat(row["PF Rating"]) }),
    ...(a.propiq_for_factors?.length && { propiq_signals: a.propiq_for_factors.slice(0, 3) }),
    ...(a.propiq_against_factors?.length && { propiq_risks: a.propiq_against_factors.slice(0, 2) }),
    ...(payload.matchup_context.defensive_rank != null && { matchup: payload.matchup_context.defensive_rank }),
    ...(a.pitcher_era != null && { pitcher_era: a.pitcher_era }),
    ...(m.opening_line != null && { opening_line: m.opening_line }),
    ...(m.book_delta != null && { line_delta: m.book_delta }),
  };
}

async function callPropEdgeAskAnalystFallback(
  question: string,
  league: string,
  topProps: Record<string, string>[],
) {
  const props = topProps
    .map((row) => csvRowToAnalystProp(row, league))
    .filter((p) => p.player);

  const res = await fetch(ASK_ANALYST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      league: league === "ALL" ? (props[0]?.league || "MLB") : league,
      props,
      response_mode: "ev_detail",
      options: { temperature: 0.45, num_predict: 1500 },
    }),
  });

  const data = await res.json().catch(() => null);
  const answer = typeof data?.answer === "string" ? data.answer.trim() : "";
  if (!answer) {
    throw new Error(data?.error || "PropEdge analyst fallback returned no answer");
  }

  try {
    return {
      parsed: parseGeminiJson(answer),
      model: data?.model || "propedge-ask-analyst",
      finishReason: "STOP",
      fallback: true,
    };
  } catch {
    return {
      parsed: normalizeAnalysis({
        article_title: "PropEdge Analyst Report",
        featured_intro: "Primary Gemini was temporarily busy — this report was generated via PropEdge backup analyst.",
        matchup_analysis: answer.slice(0, 6000),
        key_numbers_breakdown: "",
        confidence_rating: 6,
      }),
      model: data?.model || "propedge-ask-analyst",
      finishReason: "STOP",
      fallback: true,
    };
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  try {
    const { question, league = "ALL" } = await req.json();

    if (!GEMINI_API_KEY) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");

    const [rows, slate] = await Promise.all([
      fetchProps(),
      fetchActiveSlate(league),
    ]);
    const slateRows = filterRowsToActiveSlate(rows, slate, league);
    const topRows = buildTopProps(slateRows, league, question || "");

    if (!topRows.length) {
      return NextResponse.json({
        ok: false,
        error: `No active ${league === "ALL" ? "" : `${league} `}props on today's slate. Teams not playing today (including eliminated playoff teams) are excluded.`,
        slateDate: slate?.dateDisplay || slate?.date,
        filteredOut: rows.length - slateRows.length,
      }, { status: 200, headers: CORS_HEADERS });
    }

    const slateContext = formatSlateContext(slate, league);

    // Enrich top props with full PropIQ scoring signals
    const topProps = topRows.map((row) => enrichRow(row, league));

    const systemPrompt = `You are a sharp sports betting analyst writing a premium prop report.

TODAY is ${slate?.dateDisplay || slateDateParts().display} (US Eastern). Use this exact date in article_title — never tomorrow's date.

Use the PropEdge board as foundation, then add Statcast/splits context you know.
Keep JSON compact: 2-3 sentence paragraphs per pick, max ${MAX_PROPS} picks.

FORMAT inside matchup_analysis:
## Top Player Prop Values
**Player (TEAM) — Over/Under X.X Market (+odds)**
Short paragraph per pick. Blank line between picks.

key_numbers_breakdown: short markdown bullets only.
Do NOT fabricate players, lines, or odds not in the board payload.
Do NOT include eliminated or off-slate teams (e.g. NBA teams with no game today).

SCORING FIELDS (when present in payload):
propiq_score: composite 0-100 signal. ≥80 = elite, 65-79 = strong, <65 = value/marginal. Always cite score by name ("PropIQ 83").
propiq_signals: top scoring factors — lead with 1-2 strongest in your pick paragraph.
propiq_risks: capping factors — note the primary risk if present.
l5_pct / l20_pct: supplement l10 hit rate. Hot L5 vs cold L20 = trending up. Cold L5 = cooling.
line_delta: line movement since open. Negative = movement toward under (steam indicator).
ev_pct: edge above fair value — positive = value, cite if > 3%.`;

    const userPrompt = `${question || `What are the best ${league} props today?`}

LEAGUE: ${league}
${slateContext ? `\n${slateContext}\n` : ""}
PROPEDGE BOARD (today's active slate only):
${JSON.stringify(topProps, null, 2)}

Return valid JSON only. Keep prose concise so the full JSON completes.`;

    let raw = "";
    let finishReason = "";
    let modelUsed = PRIMARY_MODEL;
    let usedFallback = false;

    try {
      const gemini = await callGeminiWithResilience(systemPrompt, userPrompt, 8192);
      raw = gemini.raw;
      finishReason = gemini.finishReason;
      modelUsed = gemini.model;
      usedFallback = !!gemini.fallback;
    } catch (geminiErr) {
      console.warn("[analyze] Gemini exhausted retries:", geminiErr instanceof Error ? geminiErr.message : geminiErr);
      const backup = await callPropEdgeAskAnalystFallback(
        question || `What are the best ${league} props today?`,
        league,
        topRows,
      );
      return NextResponse.json({
        ok: true,
        analysis: backup.parsed,
        model: backup.model,
        propCount: topRows.length,
        fallback: true,
        fallback_reason: geminiErr instanceof Error ? geminiErr.message : String(geminiErr),
      }, { headers: CORS_HEADERS });
    }

    let parsed;
    try {
      parsed = parseGeminiJson(raw);
    } catch (firstErr) {
      if (finishReason === "MAX_TOKENS") {
        const retryProps = buildTopProps(slateRows, league, question || "", 3);
        const retryPrompt = `${userPrompt}\n\nIMPORTANT: Cover only the top ${retryProps.length} picks with shorter paragraphs.`;
        const retry = await callGeminiWithResilience(systemPrompt, retryPrompt, 8192);
        parsed = parseGeminiJson(retry.raw);
        modelUsed = retry.model;
        usedFallback = usedFallback || !!retry.fallback;
      } else {
        throw firstErr;
      }
    }

    return NextResponse.json({
      ok: true,
      analysis: parsed,
      model: modelUsed,
      propCount: topRows.length,
      fallback: usedFallback,
      slateDate: slate?.dateDisplay || slate?.date,
      filteredOut: rows.length - slateRows.length,
    }, { headers: CORS_HEADERS });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[analyze]", msg);
    const friendly = /503|429|UNAVAILABLE|high demand/i.test(msg)
      ? "Gemini is temporarily busy. Please wait a few seconds and try again."
      : /404|not found/i.test(msg)
        ? "Analysis model unavailable — please try again."
        : msg;
    return NextResponse.json({ ok: false, error: friendly }, { status: 500, headers: CORS_HEADERS });
  }
}
