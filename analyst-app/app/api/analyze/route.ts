import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { NextRequest, NextResponse } from "next/server";

const PROP_FEED_URL =
  "https://propedgemasters.netlify.app/.netlify/functions/prop-feed?sheet=propedge-main";

const MODEL = "gemini-2.5-flash";

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

    const rows = await fetchProps();
    const topProps = buildTopProps(rows, league);

    if (!topProps.length) {
      return NextResponse.json({ error: "No props available on the board right now." }, { status: 200 });
    }

    const systemPrompt = [
      "You are a sharp sports betting analyst writing a premium prop report. Produce deep editorial analysis — professional handicapper quality, not a data dump.",
      "",
      "CRITICAL: USE YOUR FULL KNOWLEDGE.",
      "The PropEdge board below gives ranked props with PF Rating, hit rates, edges, and matchup data. Use it as your foundation, then LAYER IN everything from your training: Statcast percentiles (xSLG, Barrel%, Exit Velocity, Hard-Hit%), platoon splits, pitcher FIP/ERA/K-rate vs handedness, ballpark factors, lineup context, and recent form. Write the kind of analysis that matches what a sharp Gemini query returns natively.",
      "",
      "OUTPUT: Strict JSON only. No markdown code fences around the outer object.",
      "Inside JSON string values use rich markdown: **bold**, * bullets, ## section headers.",
      "",
      "matchup_analysis structure:",
      "  ## Top Player Prop Values",
      "  For each pick: **Player (TEAM) — Over/Under X.X Market (+odds)**",
      "  3-5 sentence paragraph with board edge + Statcast/splits depth. Linemaker prose, not bullet lists.",
      "  Blank line between picks.",
      "  Optional: ## Game Lines & Totals (1-2 paragraphs) when data supports it.",
      "",
      "key_numbers_breakdown: markdown bullets — threshold stats, split gates, edge drivers.",
      "Do NOT fabricate players, lines, or odds not in the board payload.",
      "",
      'JSON schema: { "article_title": "string", "featured_intro": "string", "matchup_analysis": "string", "key_numbers_breakdown": "string", "confidence_rating": 8 }',
    ].join("\n");

    const userPrompt = `${question || "What are the best props on today's board?"}

LEAGUE: ${league}

PROPEDGE BOARD (ranked props with PF Rating, edges, hit rates):
${JSON.stringify(topProps, null, 2)}

Using the board as your foundation, write a full analyst report enriched with Statcast data, splits, pitcher context, and park factors from your training knowledge. Return one raw JSON object matching the schema.`;

    const { text } = await generateText({
      model: google(MODEL),
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.5,
      maxTokens: 2000,
    });

    const clean = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/,"").trim();
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(clean);
    } catch {
      parsed = {
        article_title: "PropEdge Board Analysis",
        featured_intro: text.slice(0, 400),
        matchup_analysis: text,
        key_numbers_breakdown: "",
        confidence_rating: 7,
      };
    }

    return NextResponse.json({ ok: true, analysis: parsed, model: MODEL, propCount: topProps.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[analyze]", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
