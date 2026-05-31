import { NextRequest, NextResponse } from "next/server";

const PROP_FEED_URL =
  "https://propedgemasters.netlify.app/.netlify/functions/prop-feed?sheet=propedge-main";

const MODEL = "gemini-2.5-flash";
const GEMINI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY || "";

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

function buildTopProps(rows: Record<string, string>[], league: string, limit = 8) {
  const filtered = league === "ALL"
    ? rows
    : rows.filter((r) => (r["League"] || "").toUpperCase() === league.toUpperCase());
  return filtered
    .filter((r) => r["Player"] && r["PF Rating"])
    .sort((a, b) => parseFloat(b["PF Rating"] || "0") - parseFloat(a["PF Rating"] || "0"))
    .slice(0, limit);
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

    const systemPrompt = `You are a sharp sports betting analyst writing a premium prop report. Produce deep editorial analysis — professional handicapper quality.

CRITICAL: USE YOUR FULL KNOWLEDGE.
The PropEdge board gives ranked props with PF Rating, hit rates, edges, and matchup data. Use it as your foundation, then LAYER IN everything from your training: Statcast percentiles (xSLG, Barrel%, Exit Velocity, Hard-Hit%), platoon splits, pitcher FIP/ERA/K-rate vs handedness, ballpark factors, lineup context, and recent form.

FORMAT:
matchup_analysis MUST start with: ## Top Player Prop Values
For each pick: **Player (TEAM) — Over/Under X.X Market (+odds)**
Follow with a 3-5 sentence paragraph. Linemaker prose, cite board edge + Statcast/splits depth.
Blank line between picks.
Optional: ## Game Lines & Totals (1-2 paragraphs) when data supports it.

key_numbers_breakdown: markdown bullets — threshold stats, split gates, edge drivers.
Do NOT fabricate players, lines, or odds not in the board payload.`;

    const userPrompt = `${question || `What are the best ${league} props today?`}

LEAGUE: ${league}

PROPEDGE BOARD:
${JSON.stringify(topProps, null, 2)}

Write a full analyst report enriched with Statcast data, splits, and pitcher context.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const payload = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 2500,
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
      throw new Error(`Gemini API ${res.status}: ${err.slice(0, 300)}`);
    }

    const data = await res.json();
    const raw = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") || "";
    if (!raw) throw new Error("Gemini returned empty response");

    const parsed = JSON.parse(raw);
    // Unescape literal \n that Gemini sometimes emits inside JSON strings
    for (const k of ["matchup_analysis", "key_numbers_breakdown", "featured_intro"]) {
      if (typeof parsed[k] === "string") {
        parsed[k] = parsed[k].replace(/\\n/g, "\n");
      }
    }

    return NextResponse.json({ ok: true, analysis: parsed, model: MODEL, propCount: topProps.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[analyze]", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
