import { NextRequest, NextResponse } from "next/server";

const PROP_FEED_URL =
  "https://propedgemasters.netlify.app/.netlify/functions/prop-feed?sheet=propedge-main";

const ASK_ANALYST_URL =
  "https://propedgemasters.netlify.app/.netlify/functions/ask-analyst";

const GEMINI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY || "";
const PRIMARY_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const MODEL_CHAIN = Array.from(
  new Set(
    [
      PRIMARY_MODEL,
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite",
    ].filter(Boolean),
  ),
);
const MAX_PROPS = 4;
const MAX_GEMINI_ATTEMPTS = 3;

async function fetchProps(): Promise<Record<string, string>[]> {
  const res = await fetch(PROP_FEED_URL, { next: { revalidate: 300 } });
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

function buildTopProps(rows: Record<string, string>[], league: string, limit = MAX_PROPS) {
  const filtered = league === "ALL"
    ? rows
    : rows.filter((r) => (r["League"] || "").toUpperCase() === league.toUpperCase());
  return filtered
    .filter((r) => r["Player"] && r["PF Rating"])
    .sort((a, b) => parseFloat(b["PF Rating"] || "0") - parseFloat(a["PF Rating"] || "0"))
    .slice(0, Math.max(1, Math.min(limit, MAX_PROPS)));
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

export async function POST(req: NextRequest) {
  try {
    const { question, league = "ALL" } = await req.json();

    if (!GEMINI_API_KEY) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");

    const rows = await fetchProps();
    const topProps = buildTopProps(rows, league);

    if (!topProps.length) {
      return NextResponse.json({ error: "No props available right now." }, { status: 200 });
    }

    const systemPrompt = `You are a sharp sports betting analyst writing a premium prop report.

Use the PropEdge board as foundation, then add Statcast/splits context you know.
Keep JSON compact: 2-3 sentence paragraphs per pick, max ${MAX_PROPS} picks.

FORMAT inside matchup_analysis:
## Top Player Prop Values
**Player (TEAM) — Over/Under X.X Market (+odds)**
Short paragraph per pick. Blank line between picks.

key_numbers_breakdown: short markdown bullets only.
Do NOT fabricate players, lines, or odds not in the board payload.`;

    const userPrompt = `${question || `What are the best ${league} props today?`}

LEAGUE: ${league}

PROPEDGE BOARD:
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
        topProps,
      );
      return NextResponse.json({
        ok: true,
        analysis: backup.parsed,
        model: backup.model,
        propCount: topProps.length,
        fallback: true,
        fallback_reason: geminiErr instanceof Error ? geminiErr.message : String(geminiErr),
      });
    }

    let parsed;
    try {
      parsed = parseGeminiJson(raw);
    } catch (firstErr) {
      if (finishReason === "MAX_TOKENS") {
        const retryProps = buildTopProps(rows, league, 3);
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
      propCount: topProps.length,
      fallback: usedFallback,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[analyze]", msg);
    const friendly = /503|429|UNAVAILABLE|high demand/i.test(msg)
      ? "Gemini is temporarily busy. Please wait a few seconds and try again."
      : /404|not found/i.test(msg)
        ? "Analysis model unavailable — please try again."
        : msg;
    return NextResponse.json({ ok: false, error: friendly }, { status: 500 });
  }
}
