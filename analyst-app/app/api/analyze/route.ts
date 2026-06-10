import { NextRequest, NextResponse } from "next/server";
import { buildPropEdgeLlmPayload } from "../../../lib/propedge-payload";
import type { BoardProp } from "../../../lib/types";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const PROP_FEED_URL =
  process.env.PROPEDGE_FEED_URL ||
  "https://propedgemasters.netlify.app/.netlify/functions/prop-feed?sheet=propedge-main";

const PROP_FEED_GVIZ_FALLBACK =
  "https://docs.google.com/spreadsheets/d/1e53GcCS9alxJhzDQPqkH55mpllEjVUShPKyP63R-BeY/gviz/tq?tqx=out:csv&sheet=propedge-main";

const ASK_ANALYST_URL =
  "https://propedgemasters.netlify.app/.netlify/functions/ask-analyst";

const GAME_FILTER_URL =
  "https://propedgemasters.netlify.app/.netlify/functions/game-filter";

const GAME_ODDS_URL =
  "https://propedgemasters.netlify.app/.netlify/functions/game-odds";

const GEMINI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY || "";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const MOONSHOT_API_KEY = process.env.MOONSHOT_API_KEY || process.env.KIMI_API_KEY || "";

type KimiBackend = "openrouter" | "moonshot";

function resolveKimiConfig(): {
  apiKey: string;
  apiUrl: string;
  model: string;
  backend: KimiBackend;
} | null {
  if (OPENROUTER_API_KEY) {
    return {
      apiKey: OPENROUTER_API_KEY,
      apiUrl: process.env.KIMI_API_URL || "https://openrouter.ai/api/v1/chat/completions",
      model: process.env.KIMI_MODEL || "moonshotai/kimi-k2-0905",
      backend: "openrouter",
    };
  }
  if (MOONSHOT_API_KEY) {
    return {
      apiKey: MOONSHOT_API_KEY,
      apiUrl: process.env.KIMI_API_URL || "https://api.moonshot.ai/v1/chat/completions",
      model: process.env.KIMI_MODEL || "kimi-k2.5",
      backend: "moonshot",
    };
  }
  return null;
}

const GEMINI_MODEL_FALLBACKS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
];

const PRIMARY_MODEL = process.env.GEMINI_MODEL || GEMINI_MODEL_FALLBACKS[0];
const MODEL_CHAIN = Array.from(new Set([PRIMARY_MODEL, ...GEMINI_MODEL_FALLBACKS]));
const MAX_PROPS = 6;
const MAX_GEMINI_ATTEMPTS = 3;
const KIMI_TIMEOUT_MS = Number(process.env.KIMI_TIMEOUT_MS || 90000);
const KIMI_MAX_OUTPUT_TOKENS = Number(process.env.KIMI_MAX_OUTPUT_TOKENS || 8192);
const GEMINI_MAX_OUTPUT_TOKENS = Number(process.env.GEMINI_MAX_OUTPUT_TOKENS || 8192);

export const maxDuration = 300;

function buildAnalystSystemPrompt(slateDateDisplay: string, maxProps: number): string {
  return `You are a sharp sports betting analyst writing a premium PropEdge +EV report — linemaker tone, data-driven, no fluff.

TODAY is ${slateDateDisplay} (US Eastern). Use this exact date in article_title — never tomorrow's date.

Use ONLY players/lines/odds from the PropEdge board payload. Add matchup/splits context from your training knowledge, but never invent props.

LINEMAKER PRINCIPLES — APPLY ON EVERY PICK:
1. REGRESSION: Hot L5 streaks on cold L20/season baselines are traps — call out explicitly.
2. CONVERGENCE: Best plays have PropIQ + hit-rate windows + matchup all aligned; flag conflicts.
3. JUICE GATE: Heavy juice (≤-180) needs bigger cushion; say FADE when grade is elite but price kills ROI.
4. MARKET SOFTNESS: Rebounds/assists/combos = softer; points = sharper — adjust thesis accordingly.

FOR EACH PICK — READ THE BOARD FIRST, THEN LAYER TRAINING DATA:
- Start with payload: PropIQ, L5/L10/L20, H2H, ev_pct, line cushion, propiq_signals/risks.
- Then add sport context you know: NBA pace/ORTG/DRTG/rest; MLB Statcast/splits/park; NHL goalie/PP; NFL target share/weather.
- If L5 >> L20/season: flag regression risk. If L5 << L20: flag bounce-back.

OUTPUT JSON keys: article_title, featured_intro, matchup_analysis, key_numbers_breakdown, confidence_rating (1-10).

article_title: Specific slate headline with date and featured matchup(s).

featured_intro: 4-6 sentences. Set the slate narrative — pace, key matchups, where PropIQ clusters (overs/unders, stars, totals). Premium betting preview lede.

matchup_analysis — use this EXACT markdown outline (include EVERY section, do not skip or merge):

## Slate Snapshot
3-4 sentences: game count, board theme, where PropIQ clusters, juice/edge patterns.

## Top Player Prop Values
Cover all ${maxProps} picks from the payload. For EACH pick use this block:

**Player (TEAM) — Over/Under X.X Market (+odds)**
5-7 sentence paragraph. MUST cite when present: PropIQ score, L5/L10/L20 hit %, H2H vs opponent, line cushion vs L5 avg, ev_pct, 1-2 propiq_signals, 1 propiq_risk, sport-specific context (pace, usage, splits), and a clear BUY/LEAN/PASS/FADE lean with one-line thesis. Never compress a pick into 1-2 sentences.

Blank line between picks.

## Game Line Plays
If GAME LINES are in the payload: 2-3 sentences on 1-2 correlated ML/spread/total/1Q plays with exact lines/odds and why they tie to prop thesis.
If no GAME LINES section: write "No game lines on today's board payload."

## Risk Notes
4-5 bullets: slate-wide cautions (heavy juice, regression, small samples, correlated exposure, key-number traps).

key_numbers_breakdown: 8-12 markdown bullets — sharpest split/variance numbers from your picks (L5 vs L20 divergences, H2H, line_delta, matchup rank, cushion %). Specific numbers only.

Do NOT truncate, summarize, or omit sections. Write the complete report every time.

SCORING FIELD GLOSSARY (use when present in payload):
propiq_score: 0-100 PropIQ grade. ≥80 elite, 65-79 strong, <65 value/marginal.
propiq_signals / propiq_risks: top supporting and capping factors.
l5_pct / l10_pct / l20_pct / last_season_pct: hit-rate windows.
h2h: hit rate vs this opponent. ev_pct: edge above fair value. line_delta: steam/movement.`;
}

function isValidPropFeedCsv(csv: string): boolean {
  const text = csv.trim();
  if (!text || text.length < 100) return false;
  if (text.startsWith("<") || text.startsWith("{")) return false;
  return text.includes("Player") || text.includes("PF Rating");
}

async function downloadPropFeedCsv(url: string): Promise<string> {
  const res = await fetch(url, { cache: "no-store" });
  const csv = await res.text();
  if (!res.ok) {
    throw new Error(`Prop feed HTTP ${res.status} from ${url}`);
  }
  if (!isValidPropFeedCsv(csv)) {
    throw new Error(`Prop feed invalid payload from ${url}`);
  }
  return csv;
}

async function fetchProps(): Promise<Record<string, string>[]> {
  const sources = [PROP_FEED_URL, PROP_FEED_GVIZ_FALLBACK];
  let csv = "";
  let lastErr: Error | null = null;

  for (const url of sources) {
    try {
      csv = await downloadPropFeedCsv(url);
      break;
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      console.warn("[analyze] prop feed attempt failed:", lastErr.message);
    }
  }

  if (!csv) {
    throw new Error(lastErr?.message || "Invalid prop feed response");
  }

  const lines = csv.trim().split("\n");
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    // Use first-wins for duplicate headers (e.g. propedge-main has two "League" columns;
    // the first one at index 24 is authoritative — set by the scraper's consolidation).
    const row: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i];
      if (h && !(h in row)) row[h] = values[i] ?? "";
    }
    return row;
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

type GameBetProp = {
  league: string;
  team: string;
  opponent: string;
  prop: string;
  direction: string;
  line?: number;
  odds?: number;
  gameLabel: string;
  gameId?: string;
};

async function fetchGameOdds(leagueFilter: string): Promise<GameBetProp[]> {
  try {
    const params = new URLSearchParams({ alt: "true" });
    if (leagueFilter && leagueFilter !== "ALL") params.set("leagues", leagueFilter.toUpperCase());
    const res = await fetch(`${GAME_ODDS_URL}?${params.toString()}`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    if (!data?.ok || !Array.isArray(data.props)) return [];
    return data.props as GameBetProp[];
  } catch {
    return [];
  }
}

const GAME_ODDS_CORE_MARKETS = new Set(["Moneyline", "Spread", "Total", "Alt Total", "1H Total", "1Q Total"]);

function formatGameLinesContext(gameBets: GameBetProp[]): string {
  if (!gameBets.length) return "";
  const core = gameBets.filter((b) => GAME_ODDS_CORE_MARKETS.has(b.prop));
  if (!core.length) return "";

  const fmtOdds = (o?: number) => o == null ? "?" : (o > 0 ? `+${o}` : String(o));
  const fmtLine = (l?: number) => l == null ? "" : (l >= 0 ? "+" + l : String(l));

  const byGame = new Map<string, { league: string; label: string; bets: GameBetProp[] }>();
  for (const b of core) {
    const key = `${b.league}|${b.gameId || b.gameLabel}`;
    if (!byGame.has(key)) byGame.set(key, { league: b.league, label: b.gameLabel, bets: [] });
    byGame.get(key)!.bets.push(b);
  }

  const lines: string[] = ["GAME LINES (DraftKings):"];
  for (const { league, label, bets } of byGame.values()) {
    const get = (market: string) => bets.filter((b) => b.prop === market);
    const ml  = get("Moneyline").map((b) => `${b.team} ${fmtOdds(b.odds)}`).join("/");
    const sp  = get("Spread").map((b) => `${b.team}${fmtLine(b.line)} (${fmtOdds(b.odds)})`).join("/");
    const tot = get("Total").map((b) => `${b.direction} ${b.line} (${fmtOdds(b.odds)})`).join(" ");
    // Alt totals: show up to 3 lines nearest to -110 (best value lines)
    const altTotNear110 = get("Alt Total").sort((a, b) => Math.abs(Math.abs(a.odds ?? 110) - 110) - Math.abs(Math.abs(b.odds ?? 110) - 110)).slice(0, 3);
    const altTot = altTotNear110.map((b) => `${b.direction} ${b.line} (${fmtOdds(b.odds)})`).join(" ");
    const h1  = get("1H Total").map((b) => `${b.direction} ${b.line} (${fmtOdds(b.odds)})`).join(" ");
    const q1  = get("1Q Total").map((b) => `${b.direction} ${b.line} (${fmtOdds(b.odds)})`).join(" ");
    const parts = [ml && `ML: ${ml}`, sp && `Spread: ${sp}`, tot && `Total: ${tot}`, altTot && `AltTot: ${altTot}`, h1 && `1H: ${h1}`, q1 && `1Q: ${q1}`].filter(Boolean);
    if (parts.length) lines.push(`[${league}] ${label}: ${parts.join(" | ")}`);
  }
  return lines.length > 1 ? lines.join("\n") : "";
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
      temperature: 0.55,
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

class KimiApiError extends Error {
  status: number;
  body: string;

  constructor(status: number, body: string) {
    super(`Kimi API ${status}: ${body.slice(0, 300)}`);
    this.status = status;
    this.body = body;
  }
}

async function callKimiModel(
  systemPrompt: string,
  userPrompt: string,
  maxOutputTokens: number,
) {
  const cfg = resolveKimiConfig();
  if (!cfg) throw new Error("No Kimi API key configured (set OPENROUTER_API_KEY or MOONSHOT_API_KEY)");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${cfg.apiKey}`,
  };
  if (cfg.backend === "openrouter") {
    headers["HTTP-Referer"] = process.env.OPENROUTER_REFERER || "https://propedgemasters.netlify.app";
    headers["X-Title"] = process.env.OPENROUTER_APP_NAME || "PropEdge Generative Analyst";
  }

  const res = await fetch(cfg.apiUrl, {
    method: "POST",
    headers,
    signal: AbortSignal.timeout(KIMI_TIMEOUT_MS),
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        {
          role: "system",
          content: `${systemPrompt}\n\nReturn valid JSON only with keys: article_title, featured_intro, matchup_analysis, key_numbers_breakdown, confidence_rating.`,
        },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.55,
      max_tokens: maxOutputTokens,
      response_format: { type: "json_object" },
      ...(cfg.backend === "openrouter"
        ? { provider: { sort: "latency" } }
        : {}),
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new KimiApiError(res.status, err);
  }

  const data = await res.json();
  const message = data?.choices?.[0]?.message || {};
  const raw = String(message.content || message.reasoning || "").trim();
  if (!raw) throw new Error("Kimi returned empty response");
  return { raw, finishReason: data?.choices?.[0]?.finish_reason || "stop", model: cfg.model };
}

async function callKimiWithResilience(
  systemPrompt: string,
  userPrompt: string,
  maxOutputTokens: number,
) {
  try {
    const result = await callKimiModel(systemPrompt, userPrompt, maxOutputTokens);
    return { ...result, fallback: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new Error(`Kimi timed out after ${Math.round(KIMI_TIMEOUT_MS / 1000)}s`);
    }
    throw err instanceof Error ? err : new Error(msg);
  }
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
    lastSeasonPct: row["'24-'25"] || undefined,
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
    ...(payload.matchup_context.h2h_history != null && { h2h: payload.matchup_context.h2h_history }),
    ...(bp.lastSeasonPct != null && { last_season_pct: bp.lastSeasonPct }),
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

    const [rows, slate, gameOddsBets] = await Promise.all([
      fetchProps(),
      fetchActiveSlate(league),
      fetchGameOdds(league),
    ]);
    let slateRows = filterRowsToActiveSlate(rows, slate, league);
    // Guard: if slate filter is too aggressive (stale scraper data), fall back to full board
    const MIN_SLATE_PROPS = 15;
    const rawSlateCount = slateRows.length;
    const usedFullBoard = rawSlateCount < MIN_SLATE_PROPS && rows.length >= MIN_SLATE_PROPS;
    if (usedFullBoard) slateRows = rows;
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
    const gameLinesContext = formatGameLinesContext(gameOddsBets);
    const slateDateDisplay = slate?.dateDisplay || slateDateParts().display;

    // Enrich top props with full PropIQ scoring signals
    const topProps = topRows.map((row) => enrichRow(row, league));

    const systemPrompt = buildAnalystSystemPrompt(slateDateDisplay, MAX_PROPS);

    const userPrompt = `${question || `What are the best ${league} props today?`}

LEAGUE: ${league}
${slateContext ? `\n${slateContext}\n` : ""}${gameLinesContext ? `\n${gameLinesContext}\n` : ""}
PROPEDGE BOARD (today's active slate only):
${JSON.stringify(topProps, null, 2)}

Return valid JSON only. Write the COMPLETE premium report — all four ## sections, ${MAX_PROPS} full pick paragraphs (5-7 sentences each), and 8-12 key_numbers bullets. Do not truncate or shorten.`;

    let raw = "";
    let finishReason = "";
    let modelUsed = PRIMARY_MODEL;
    let providerUsed: "kimi" | "gemini" | "propedge" = "gemini";
    let usedFallback = false;

    if (resolveKimiConfig()) {
      try {
        const kimi = await callKimiWithResilience(systemPrompt, userPrompt, KIMI_MAX_OUTPUT_TOKENS);
        raw = kimi.raw;
        finishReason = kimi.finishReason;
        modelUsed = kimi.model;
        providerUsed = "kimi";
      } catch (kimiErr) {
        console.warn("[analyze] Kimi failed, falling back to Gemini:", kimiErr instanceof Error ? kimiErr.message : kimiErr);
        usedFallback = true;
      }
    }

    if (!raw) {
      try {
        const gemini = await callGeminiWithResilience(systemPrompt, userPrompt, GEMINI_MAX_OUTPUT_TOKENS);
        raw = gemini.raw;
        finishReason = gemini.finishReason;
        modelUsed = gemini.model;
        providerUsed = "gemini";
        usedFallback = usedFallback || !!gemini.fallback;
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
          provider: "propedge",
          propCount: topRows.length,
          fallback: true,
          fallback_reason: geminiErr instanceof Error ? geminiErr.message : String(geminiErr),
        }, { headers: CORS_HEADERS });
      }
    }

    let parsed;
    try {
      parsed = parseGeminiJson(raw);
    } catch (firstErr) {
      if (finishReason === "MAX_TOKENS" || finishReason === "length") {
        const retryProps = buildTopProps(slateRows, league, question || "", 4);
        const retryPrompt = `${userPrompt}\n\nIMPORTANT: Prioritize complete JSON. Cover top ${retryProps.length} picks with full section outline but slightly shorter paragraphs.`;
        if (providerUsed === "kimi" && resolveKimiConfig()) {
          const retry = await callKimiWithResilience(systemPrompt, retryPrompt, KIMI_MAX_OUTPUT_TOKENS);
          parsed = parseGeminiJson(retry.raw);
          modelUsed = retry.model;
          finishReason = retry.finishReason;
        } else {
          const retry = await callGeminiWithResilience(systemPrompt, retryPrompt, GEMINI_MAX_OUTPUT_TOKENS);
          parsed = parseGeminiJson(retry.raw);
          modelUsed = retry.model;
          usedFallback = usedFallback || !!retry.fallback;
        }
      } else {
        throw firstErr;
      }
    }

    return NextResponse.json({
      ok: true,
      analysis: parsed,
      model: modelUsed,
      provider: providerUsed,
      propCount: topRows.length,
      fallback: usedFallback,
      slateDate: slate?.dateDisplay || slate?.date,
      filteredOut: usedFullBoard ? rows.length - rawSlateCount : rows.length - slateRows.length,
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
