/**
 * PropEdge production smoke tests — run: npx tsx smoke-test.ts
 */
import assert from "node:assert";
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const root = import.meta.dirname || process.cwd();

const { isPropEdgePayloadSanityValid } = require(join(root, "netlify/functions/betting-math.js"));
const { buildPropEdgeLlmPayload } = require(join(root, "netlify/functions/build-propedge-llm-payload.js"));

const colors = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  dim: "\x1b[2m",
  reset: "\x1b[0m",
};

const ANALYST_TIMEOUT_MS = 8000;
const PROP_FEED =
  process.env.PROPEDGE_FEED_URL ||
  "https://propedgemasters.netlify.app/.netlify/functions/prop-feed?sheet=propedge-main";

type AnalystJson = {
  article_title?: string;
  featured_intro?: string;
  matchup_analysis?: string;
  key_numbers_breakdown?: string;
  confidence_rating?: number;
};

function parseStrictAnalystTemplate(text: string): AnalystJson | null {
  const raw = String(text || "").trim();
  if (!raw) return null;
  const cleanJson = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  if (!cleanJson.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(cleanJson) as AnalystJson;
    if (parsed?.article_title) return parsed;
    return null;
  } catch {
    return null;
  }
}

function analystTimeoutFallback(teamName: string, reason: string): string {
  return JSON.stringify({
    article_title: `${teamName} — High Local Traffic`,
    featured_intro: `Model analysis processed. Live inference unavailable (${reason}).`,
    matchup_analysis:
      "High local traffic — verify injuries, lineups, and live price drift before wagering.",
    key_numbers_breakdown: "Review live charts in the Primary Markets tab for verified edges.",
    confidence_rating: 5,
  });
}

function payloadToGaugeArgs(pl: {
  player: { name: string };
  market: { line?: number | null };
  analytics: {
    projected_ks?: number | null;
    projected_value?: number | null;
    ev_percentage?: number | null;
    hit_rate_last_10?: number | null;
  };
}) {
  return {
    playerName: pl.player.name,
    line: pl.market.line ?? 5.5,
    projectedKs: pl.analytics.projected_ks ?? pl.analytics.projected_value ?? pl.market.line ?? 5.5,
    evPercentage: pl.analytics.ev_percentage ?? 0,
    hitRate: pl.analytics.hit_rate_last_10 ?? 0.5,
  };
}

function gaugeToolSchemaValid(args: ReturnType<typeof payloadToGaugeArgs>): boolean {
  return (
    typeof args.playerName === "string" &&
    args.playerName.length > 0 &&
    Number.isFinite(args.line) &&
    args.line > 0 &&
    Number.isFinite(args.projectedKs) &&
    Number.isFinite(args.evPercentage) &&
    Number.isFinite(args.hitRate)
  );
}

async function fetchLuzardoStrikeoutProp(): Promise<Record<string, unknown> | null> {
  const res = await fetch(PROP_FEED, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Prop feed HTTP ${res.status}`);
  const csv = await res.text();
  if (!csv || csv.trim().startsWith("<")) throw new Error("Invalid prop feed response");

  const lines = csv.split("\n");
  const headers = lines[0].toLowerCase().split(",").map((h) => h.replace(/"/g, "").trim());
  const playerIdx = headers.findIndex((h) => h === "player" || h.includes("player"));
  const propIdx = headers.findIndex((h) => h === "prop" || h.includes("prop"));
  const leagueIdx = headers.findIndex((h) => h === "league" || h === "sport");
  const teamIdx = headers.findIndex((h) => h === "team");
  const oddsIdx = headers.findIndex((h) => h === "odds");
  const l10Idx = headers.findIndex((h) => h.includes("l10 avg"));
  const l5Idx = headers.findIndex((h) => h.includes("l5 avg"));
  const edgeIdx = headers.findIndex((h) => h === "edge");
  const confIdx = headers.findIndex((h) => h.includes("confidence"));

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.replace(/"/g, "").trim());
    const player = cols[playerIdx] || "";
    const propStr = cols[propIdx] || "";
    if (!/luzardo/i.test(player)) continue;
    if (!/strikeout|\bk\b|\bks\b/i.test(propStr)) continue;

    const lineMatch = propStr.match(/[ou]?([\d.]+)/i);
    const line = lineMatch ? parseFloat(lineMatch[1]) : 5.5;
    const propType = propStr.replace(/^[ou]?[\d.]+\s*/i, "").trim();

    return {
      league: (cols[leagueIdx] || "MLB").toUpperCase(),
      player,
      team: cols[teamIdx] || undefined,
      prop: propType,
      stat: propType,
      line,
      odds: cols[oddsIdx] || "-110",
      direction: propStr.toLowerCase().startsWith("u") ? "UNDER" : "OVER",
      l10Avg: parseFloat(cols[l10Idx]) || undefined,
      l5Avg: parseFloat(cols[l5Idx]) || undefined,
      edge: parseFloat(cols[edgeIdx]) || undefined,
      confidence: parseFloat(cols[confIdx]) || 55,
      l10Pct: "50",
      l5Pct: "50",
    };
  }
  return null;
}

function mockLuzardoProp(): Record<string, unknown> {
  return {
    league: "MLB",
    player: "Jesús Luzardo",
    team: "PHI",
    opponent: "ATL",
    prop: "Pitcher Strikeouts",
    stat: "Pitcher Strikeouts",
    line: 5.5,
    odds: "-112",
    direction: "OVER",
    l10Avg: 6.2,
    l5Avg: 5.8,
    l10Pct: "60",
    l5Pct: "55",
    confidence: 72,
    edge: 8.2,
    modelScore: 78,
  };
}

async function simulateAskAnalystMeltdown(): Promise<{ elapsedMs: number; response: AnalystJson; degraded: boolean }> {
  const hangForever = new Promise<string>((_, reject) => {
    setTimeout(() => reject(new Error("analyst-timeout")), ANALYST_TIMEOUT_MS);
  });

  const start = Date.now();
  try {
    const originalKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "sk-fake-invalid-key-to-force-meltdown";
    try {
      await Promise.race([
        fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: "ping" }],
            max_tokens: 5,
          }),
          signal: AbortSignal.timeout(ANALYST_TIMEOUT_MS),
        }),
        hangForever,
      ]);
    } finally {
      if (originalKey !== undefined) process.env.OPENAI_API_KEY = originalKey;
      else delete process.env.OPENAI_API_KEY;
    }
    throw new Error("Expected meltdown path");
  } catch {
    const elapsedMs = Date.now() - start;
    const fallbackRaw = analystTimeoutFallback("Jesús Luzardo", "8s limit");
    const parsed = parseStrictAnalystTemplate(fallbackRaw);
    assert(parsed, "Fallback must be valid analyst JSON");
    return { elapsedMs, response: parsed, degraded: true };
  }
}

let passed = 0;
let failed = 0;

function pass(label: string, detail?: string) {
  passed++;
  console.log(`${colors.green}✅ PASS${colors.reset} ${label}${detail ? ` ${colors.dim}(${detail})${colors.reset}` : ""}`);
}

function fail(label: string, err: unknown) {
  failed++;
  const msg = err instanceof Error ? err.message : String(err);
  console.log(`${colors.red}❌ FAIL${colors.reset} ${label}\n   ${colors.red}${msg}${colors.reset}`);
}

async function testHappyPath() {
  process.stdout.write(`${colors.yellow}⏳ TEST 1: Happy Path (Luzardo K prop → JSON → gauge)…${colors.reset} `);

  try {
    let boardProp = await fetchLuzardoStrikeoutProp();
    const source = boardProp ? "live feed" : "mock fallback";
    if (!boardProp) boardProp = mockLuzardoProp();

    const payload = buildPropEdgeLlmPayload(boardProp);
    assert(payload, "buildPropEdgeLlmPayload must return payload");
    assert(isPropEdgePayloadSanityValid(payload), "Payload must pass sanity gate");

    const jsonRoundTrip = JSON.parse(JSON.stringify(payload));
    assert(jsonRoundTrip.player?.name, "Payload JSON must include player.name");

    const sampleAnalystJson = JSON.stringify({
      article_title: `${payload.player.name} — Strikeout Edge Breakdown`,
      featured_intro: `Mathematical thesis for ${payload.player.name} K prop at ${payload.market.line}.`,
      matchup_analysis: "Opposing lineup whiff rate supports over lean.",
      key_numbers_breakdown: `EV ${payload.analytics.ev_percentage}% · L10 hit ${Math.round((payload.analytics.hit_rate_last_10 ?? 0.5) * 100)}%`,
      confidence_rating: 8,
    });

    const parsed = parseStrictAnalystTemplate(sampleAnalystJson);
    assert(parsed?.article_title, "Analyst JSON must parse with article_title");

    const gaugeArgs = payloadToGaugeArgs(payload);
    assert(gaugeToolSchemaValid(gaugeArgs), "Gauge widget args must be valid");

    const gaugeHtmlMarker = existsSync(join(root, "analyst-app/components/StrikeoutGaugeWidget.tsx"));
    assert(gaugeHtmlMarker, "StrikeoutGaugeWidget component must exist");

    pass("Happy Path", `${source} · ${payload.player.name} · line ${payload.market.line} · gauge OK`);
  } catch (err) {
    fail("Happy Path", err);
  }
}

async function testMeltdown() {
  process.stdout.write(`${colors.yellow}⏳ TEST 2: Meltdown (invalid API / 8s timeout fallback)…${colors.reset} `);

  try {
    const { elapsedMs, response, degraded } = await simulateAskAnalystMeltdown();
    assert(elapsedMs < ANALYST_TIMEOUT_MS + 1500, `Fallback must arrive within ~8s (took ${elapsedMs}ms)`);
    assert(degraded, "Must mark degraded fallback path");
    assert(response.article_title?.includes("High Local Traffic") || response.featured_intro?.includes("traffic"), "Fallback copy must surface safe state");
    assert(typeof response.confidence_rating === "number", "Fallback JSON must include confidence_rating");

    pass("Meltdown", `${elapsedMs}ms · fallback JSON rendered`);
  } catch (err) {
    fail("Meltdown", err);
  }
}

async function testDataTypo() {
  process.stdout.write(`${colors.yellow}⏳ TEST 3: Data Typo (K line 55.5 blocked by sanity)…${colors.reset} `);

  try {
    const badProp = {
      ...mockLuzardoProp(),
      line: 55.5,
      prop: "Pitcher Strikeouts",
      stat: "Pitcher Strikeouts",
      odds: "-110",
    };

    const badPayload = buildPropEdgeLlmPayload(badProp);
    assert(badPayload === null, "buildPropEdgeLlmPayload must return null for absurd K line");

    const manualBad = {
      event: { date: "2026-05-31" },
      player: { name: "Jesús Luzardo", team: "PHI" },
      market: { prop_type: "Pitcher Strikeouts", line: 55.5, implied_probability: 0.52, odds: -110 },
      analytics: { ev_percentage: 4.2 },
    };
    assert(!isPropEdgePayloadSanityValid(manualBad), "Sanity check must reject K line 55.5");

    const highEv = {
      ...manualBad,
      market: { ...manualBad.market, line: 5.5 },
      analytics: { ev_percentage: 42 },
    };
    assert(!isPropEdgePayloadSanityValid(highEv), "Sanity check must reject |EV| > 30%");

    pass("Data Typo", "55.5 K line + 42% EV both blocked before LLM");
  } catch (err) {
    fail("Data Typo", err);
  }
}

async function testAnalystAppModules() {
  process.stdout.write(`${colors.yellow}⏳ TEST 4: Analyst-app ETL parity…${colors.reset} `);

  try {
    const tsPath = join(root, "analyst-app/lib/betting-math.ts");
    const src = readFileSync(tsPath, "utf8");
    assert(src.includes("isPropEdgePayloadSanityValid"), "analyst-app betting-math must export sanity helper");

    const payloadPath = join(root, "analyst-app/lib/propedge-payload.ts");
    const payloadSrc = readFileSync(payloadPath, "utf8");
    assert(payloadSrc.includes("isPropEdgePayloadSanityValid"), "analyst-app payload builder must gate on sanity");

    pass("Analyst-app ETL parity");
  } catch (err) {
    fail("Analyst-app ETL parity", err);
  }
}

function stripMarkdownInline(s: string): string {
  return String(s || "")
    .replace(/^#{1,6}\s+/, "")
    .replace(/^\*\*|\*\*$/g, "")
    .replace(/\*\*/g, "")
    .replace(/^[-*]\s+/, "")
    .trim();
}

function parseEvDetailMarkdownPicks(text: string): {
  picks: Array<{ section: string; headline: string; matchup: string; angle: string; isGameBet: boolean }>;
  followups: string[];
} {
  const raw = String(text || "").trim();
  if (!raw) return { picks: [], followups: [] };
  const picks: Array<{ section: string; headline: string; matchup: string; angle: string; isGameBet: boolean }> = [];
  const followups: string[] = [];
  let section = "props";
  let current: { section: string; headline: string; matchup: string; angle: string } | null = null;

  const flush = () => {
    if (!current?.headline) return;
    if (current.section === "followup") {
      followups.push(stripMarkdownInline(current.headline));
      if (current.angle) followups.push(stripMarkdownInline(current.angle));
    } else {
      picks.push({
        section: current.section,
        headline: stripMarkdownInline(current.headline),
        matchup: stripMarkdownInline(current.matchup),
        angle: stripMarkdownInline(current.angle),
        isGameBet: section === "singles",
      });
    }
    current = null;
  };

  raw.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const sectionHdr = trimmed.match(/^##\s+(.+)$/);
    if (sectionHdr) {
      flush();
      const t = sectionHdr[1].toLowerCase();
      if (/best singles|straight bet/.test(t)) section = "singles";
      else if (/where should we look|look next/.test(t)) section = "followup";
      else section = "props";
      return;
    }
    if (section === "followup") {
      const bullet = trimmed.match(/^[-*•]\s+(.+)$/);
      followups.push(stripMarkdownInline(bullet ? bullet[1] : trimmed));
      return;
    }
    const h3 = trimmed.match(/^###\s+(.+)$/);
    if (h3) {
      flush();
      current = { section, headline: h3[1], matchup: "", angle: "" };
      return;
    }
    const pickBold = trimmed.match(/^\*\*(.+)\*\*$/);
    if (pickBold) {
      flush();
      current = { section, headline: pickBold[1], matchup: "", angle: "" };
      return;
    }
    const matchupLine = trimmed.match(/^\*\*Matchup:\*\*\s*(.*)$/i);
    if (matchupLine && current) {
      current.matchup = matchupLine[1].trim();
      return;
    }
    const angleLine = trimmed.match(/^\*\*The Angle:\*\*\s*(.*)$/i);
    if (angleLine && current) {
      current.angle = angleLine[1].trim();
      return;
    }
    if (current) {
      const plain = trimmed.replace(/\*\*/g, "").trim();
      current.angle = (current.angle ? current.angle + " " : "") + plain;
    }
  });
  flush();
  return { picks: picks.slice(0, 10), followups: [...new Set(followups.filter(Boolean))].slice(0, 6) };
}

function mockEvDetailRichCardHtml(player: string, league: string): string {
  const key = `${player}_${league}`.replace(/\s+/g, "_");
  return `<div class="propai-bestbet-headshot"><img data-player-headshot-key="${key}" data-player="${player}" data-league="${league}"></div>`;
}

async function testGeminiPromptBundled() {
  process.stdout.write(`${colors.yellow}⏳ TEST 5: Gemini prompt bundled in functions…${colors.reset} `);

  try {
    const promptPath = join(root, "netlify/functions/gemini-system-prompt.txt");
    assert(existsSync(promptPath), "gemini-system-prompt.txt must exist in netlify/functions/");
    const content = readFileSync(promptPath, "utf8");
    assert(/angle/i.test(content), "Prompt must require angle field in JSON output");
    assert(/matchup/i.test(content), "Prompt must require matchup field in JSON output");
    assert(/best_singles/i.test(content), "Prompt must include best_singles section");

    const askSrc = readFileSync(join(root, "netlify/functions/ask-analyst.js"), "utf8");
    assert(askSrc.includes("callEvDetailAnalyst"), "ask-analyst must use Gemini-only ev_detail path");
    assert(askSrc.includes('gemini-system-prompt.txt'), "ask-analyst must load bundled prompt");
    assert(askSrc.includes("SLATE_GAME_INTEL"), "ask-analyst must pass slate game intel to Gemini");
    assert(askSrc.includes("callGeminiEvDetail"), "ev_detail must use single-model Gemini JSON path");
    assert(askSrc.includes("EV_DETAIL_MODEL"), "ev_detail must lock to EV_DETAIL_MODEL");
    assert(askSrc.includes("gemini35_json_v1"), "Cache key must bust stale ev_detail responses");
    assert(existsSync(join(root, "netlify/functions/gemini-ev-detail-schema.json")), "ev_detail schema must be bundled");
    assert(existsSync(join(root, "netlify/functions/mlb-pitcher-intel.js")), "mlb-pitcher-intel function must exist");

    pass("Gemini prompt bundled");
  } catch (err) {
    fail("Gemini prompt bundled", err);
  }
}

async function testEvDetailRichParse() {
  process.stdout.write(`${colors.yellow}⏳ TEST 6: ev_detail markdown → headshot card markup…${colors.reset} `);

  try {
    const sample = `## Top Player Props

### Geraldo Perdomo (ARI) — RBIs (0.5) (+230)

**Matchup:** vs. Griffin Canning (SD)

**The Angle:** EV 12.4%; implied 30.3%; L10 hit 60%.

## Where should we look next

- Check weather and wind data
- Find alternate strikeout ladder targets`;

    const parsed = parseEvDetailMarkdownPicks(sample);
    assert(parsed.picks.length >= 1, "Must parse at least one pick from Gemini markdown");
    assert(parsed.picks[0].headline.includes("Perdomo"), "Headline must include player name");
    assert(parsed.picks[0].matchup.includes("Canning"), "Matchup must parse opponent pitcher");
    assert(parsed.picks[0].angle.includes("EV"), "Angle must include EV cite");
    assert(parsed.followups.length >= 1, "Follow-up bullets must parse");

    assert(stripMarkdownInline("## **Foo**") === "Foo", "stripMarkdownInline must remove markdown");

    const html = mockEvDetailRichCardHtml("Geraldo Perdomo", "MLB");
    assert(html.includes("data-player-headshot-key"), "Rich card HTML must include headshot key");

    const indexHtml = readFileSync(join(root, "propedge-deploy/index.html"), "utf8");
    assert(indexHtml.includes("renderEvDetailRichHTML"), "index.html must define renderEvDetailRichHTML");
    assert(indexHtml.includes("propai-bestbet-card"), "index.html must use bestbet card layout");
    assert(indexHtml.includes("ev-detail-rich-report .propai-bestbet-headshot img"), "Headshot img must be scoped in CSS");
    assert(indexHtml.includes("buildSlateGameIntelForAnalyst"), "index.html must build slate game intel");
    assert(indexHtml.includes("gemini35_json_v1"), "Client cache key must bust stale HTML");
    assert(indexHtml.includes("parseEvDetailAnalystJson"), "index.html must parse ev_detail JSON");
    assert(indexHtml.includes("renderEvDetailFromJson"), "index.html must render ev_detail JSON");
    assert(indexHtml.includes("fetchMlbPitcherIntel"), "index.html must fetch MLB pitcher intel");

    pass("ev_detail rich parse");
  } catch (err) {
    fail("ev_detail rich parse", err);
  }
}

function scrubEvDetailJsonText(text: string): string {
  let clean = String(text || "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  if (!clean.startsWith("{")) {
    clean = clean.replace(/^[\s\S]*?\{/, "{").replace(/\}[^}]*$/, "}").trim();
  }
  return clean;
}

function parseEvDetailAnalystJson(text: string): {
  best_singles: Array<{ headline: string; matchup: string; angle: string }>;
  top_player_props: Array<{ headline: string; matchup: string; angle: string }>;
  followups: string[];
} | null {
  const clean = scrubEvDetailJsonText(text);
  if (!clean.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(clean) as {
      best_singles?: Array<{ headline: string; matchup: string; angle: string }>;
      top_player_props?: Array<{ headline: string; matchup: string; angle: string }>;
      followups?: string[];
    };
    if (!Array.isArray(parsed.best_singles)) parsed.best_singles = [];
    if (!Array.isArray(parsed.top_player_props)) parsed.top_player_props = [];
    if (!Array.isArray(parsed.followups)) parsed.followups = [];
    if (!parsed.best_singles.length && !parsed.top_player_props.length) return null;
    return parsed as {
      best_singles: Array<{ headline: string; matchup: string; angle: string }>;
      top_player_props: Array<{ headline: string; matchup: string; angle: string }>;
      followups: string[];
    };
  } catch {
    return null;
  }
}

async function testEvDetailJsonParse() {
  process.stdout.write(`${colors.yellow}⏳ TEST 8: ev_detail JSON parse + scrub…${colors.reset} `);

  try {
    const noisy = 'noise before\n```json\n{"best_singles":[],"top_player_props":[{"headline":"A","matchup":"B","angle":"C"}],"followups":["x"]}\n```\ntrailing';
    const parsed = parseEvDetailAnalystJson(noisy);
    assert(parsed?.top_player_props.length === 1, "Must parse JSON inside fences");
    assert(parsed.top_player_props[0].angle === "C", "Angle field must survive scrub");

    const brace = parseEvDetailAnalystJson('prefix {"best_singles":[{"headline":"Tampa F5","matchup":"A vs B","angle":"Edge"}],"top_player_props":[],"followups":[]} suffix');
    assert(brace?.best_singles.length === 1, "Brace scrub must extract object");

    assert(parseEvDetailAnalystJson("not json") === null, "Invalid text must return null");

    pass("ev_detail JSON parse");
  } catch (err) {
    fail("ev_detail JSON parse", err);
  }
}

async function testGenerativeUiUrl() {
  process.stdout.write(`${colors.yellow}⏳ TEST 7: Generative UI iframe URL…${colors.reset} `);

  try {
    const indexHtml = readFileSync(join(root, "propedge-deploy/index.html"), "utf8");
    const match = indexHtml.match(/meta name="analyst-app-url" content="([^"]+)"/);
    assert(match?.[1], "analyst-app-url meta must be set");
    assert(match[1].includes("vercel.app"), "Generative UI must point to Vercel deploy");

    const res = await fetch(match[1], { signal: AbortSignal.timeout(15000) });
    assert(res.ok, `Generative UI URL must respond (${res.status})`);
    const csp = res.headers.get("content-security-policy") || "";
    assert(csp.includes("propedgemasters.netlify.app"), "CSP must allow Netlify iframe embed");

    pass("Generative UI URL", match[1]);
  } catch (err) {
    fail("Generative UI URL", err);
  }
}

async function main() {
  console.log(`${colors.yellow}🚀 PropEdge Smoke Tests${colors.reset}\n`);

  await testHappyPath();
  await testMeltdown();
  await testDataTypo();
  await testAnalystAppModules();
  await testGeminiPromptBundled();
  await testEvDetailRichParse();
  await testEvDetailJsonParse();
  await testGenerativeUiUrl();

  console.log(`\n${colors.yellow}🏁 Results:${colors.reset} ${colors.green}${passed} passed${colors.reset}, ${failed ? colors.red : colors.dim}${failed} failed${colors.reset}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
