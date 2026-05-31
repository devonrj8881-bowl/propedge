/**
 * Batch Narrative Generation (Daily 11am EST)
 * Fetches live props from Google Sheet, calls Claude API in batches
 * Stores results in _narratives.json for instant modal lookup
 */

const fs = require('fs');
const path = require('path');

exports.handler = async (event) => {
  console.log("[Batch Narrative] Generation started");

  try {
    // 1. Fetch live props from Google Sheet
    const props = await fetchPropsFromSheet();
    console.log(`[Batch Narrative] Fetched ${props.length} props from sheet`);

    if (props.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "No props to process", generated: 0 })
      };
    }

    // 2. Batch into groups of 50
    const batchSize = 50;
    const batches = [];
    for (let i = 0; i < props.length; i += batchSize) {
      batches.push(props.slice(i, i + batchSize));
    }
    console.log(`[Batch Narrative] Split into ${batches.length} batch(es)`);

    // 3. Process each batch with Claude
    const allNarratives = {};
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`[Batch Narrative] Processing batch ${i + 1}/${batches.length} (${batch.length} props)`);

      const batchNarratives = await processBatchWithClaude(batch);
      Object.assign(allNarratives, batchNarratives);
    }

    console.log(`[Batch Narrative] Generated narratives for ${Object.keys(allNarratives).length} props`);

    // 4. Return (would normally save to file or S3)
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generated_at: new Date().toISOString(),
        total_props: props.length,
        narratives_generated: Object.keys(allNarratives).length,
        narratives: allNarratives
      })
    };
  } catch (error) {
    console.error("[Batch Narrative] Error:", error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

/**
 * Fetch live props from Google Sheet
 */
async function fetchPropsFromSheet() {
  const SHEET_ID = process.env.GOOGLE_SHEET_ID || "1xZj..."; // Your sheet ID
  const SHEET_NAME = "Props";

  const props = [];

  try {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${SHEET_NAME}&_=${Date.now()}`;
    const resp = await fetch(url, { cache: 'no-store' });

    if (!resp.ok) {
      console.warn("[Batch Narrative] Sheet fetch failed:", resp.status);
      return [];
    }

    const csv = await resp.text();
    const lines = csv.split('\n');
    const headers = parseCSVLine(lines[0]);

    // Find column indices
    const colPlayer = headers.findIndex(h => h.toLowerCase().includes('player'));
    const colTeam = headers.findIndex(h => h.toLowerCase().includes('team'));
    const colProp = headers.findIndex(h => h.toLowerCase().includes('prop'));
    const colLine = headers.findIndex(h => h.toLowerCase().includes('line'));
    const colL5 = headers.findIndex(h => h.toLowerCase().includes('l5'));
    const colL10 = headers.findIndex(h => h.toLowerCase().includes('l10'));
    const colOpp = headers.findIndex(h => h.toLowerCase().includes('opp'));
    const colScore = headers.findIndex(h => h.toLowerCase().includes('score'));

    // Parse props (skip header + empty rows)
    for (let i = 1; i < Math.min(lines.length, 200); i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cols = parseCSVLine(line);
      const player = cols[colPlayer]?.trim();
      const team = cols[colTeam]?.trim();
      const propType = cols[colProp]?.trim();
      const line_ = parseFloat(cols[colLine]) || 0;
      const l5 = parseFloat(cols[colL5]) || 0;
      const l10 = parseFloat(cols[colL10]) || 0;
      const oppTeam = cols[colOpp]?.trim();
      const score = parseFloat(cols[colScore]) || 0;

      if (player && propType) {
        props.push({
          id: `${player}_${propType}_${team}`.replace(/\s+/g, '_'),
          player,
          team,
          prop: propType,
          line: line_,
          l5_pct: l5,
          l10_pct: l10,
          opponent: oppTeam,
          score: score
        });
      }
    }
  } catch (e) {
    console.warn("[Batch Narrative] Sheet parse failed:", e.message);
  }

  return props;
}

/**
 * Process batch of props with Claude API
 */
async function processBatchWithClaude(props) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[Batch Narrative] No API key found");
    return {};
  }

  // Build prompt for batch
  const propsJson = props.map(p => ({
    player: p.player,
    prop: p.prop,
    line: p.line,
    l5_hit_pct: p.l5_pct,
    l10_hit_pct: p.l10_pct,
    opponent: p.opponent,
    propiq_score: p.score
  }));

  const prompt = `You are a sports analytics AI. Generate match analysis narratives for these props.
For EACH prop, provide 3 short paragraphs (2-3 sentences each):
1. Recent form (L5/L10 trend, consistency)
2. Matchup context (opponent weakness, expected minutes)
3. Verdict (recommendation, confidence reasoning)

Props:
${JSON.stringify(propsJson, null, 2)}

Return a JSON object:
{
  "Player_Prop_Team": {
    "recent": "paragraph",
    "matchup": "paragraph",
    "verdict": "paragraph"
  }
}

Narratives must be concise, professional, and data-driven (not flowery).`;

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    if (!resp.ok) {
      const errData = await resp.json();
      throw new Error(`Claude API error: ${resp.status} ${JSON.stringify(errData)}`);
    }

    const data = await resp.json();
    const responseText = data.content[0]?.text || '';

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("[Batch Narrative] No JSON in Claude response");
      return {};
    }

    const narratives = JSON.parse(jsonMatch[0]);
    console.log(`[Batch Narrative] Claude generated ${Object.keys(narratives).length} narratives`);
    return narratives;
  } catch (error) {
    console.error("[Batch Narrative] Claude API error:", error.message);
    return {};
  }
}

function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}
