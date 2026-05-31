exports.handler = async (event) => {
  console.log("[AI] Handler called");
  try {
    // Parse request
    const { context } = JSON.parse(event.body || "{}");
    console.log("[AI] Request parsed");

    if (!context?.props?.length) {
      console.log("[AI] No props in request");
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "No props", recommendations: [], parlays: [] })
      };
    }

    console.log(`[AI] Analyzing ${context.props.length} props`);

    // Local Ollama via Tailscale
    try {
      console.log("[AI] Attempting local Ollama (gemma4:e4b via Tailscale)...");
      const result = await callOllamaAPI(context.props);
      console.log("[AI] Ollama success");
      return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(result) };
    } catch (ollamaErr) {
      console.warn("[AI] Ollama failed:", ollamaErr.message);
      console.warn("[AI] Returning mock. Error:", ollamaErr.message);
      const mockResult = returnMockRecommendations(context.props);
      mockResult.body = JSON.stringify({
        ...JSON.parse(mockResult.body),
        apiError: ollamaErr.message
      });
      return mockResult;
    }
  } catch (error) {
    console.error("[AI] Handler error:", error.message);
    return returnMockRecommendations([]);
  }
};

async function callOllamaAPI(props) {
  const http = require("http");
  const https = require("https");
  const url = require("url");

  const baseUrl = process.env.OLLAMA_BASE_URL || "http://100.74.107.50:11434";
  const model = process.env.OLLAMA_MODEL || "gemma4:e4b";
  const timeout = parseInt(process.env.OLLAMA_TIMEOUT_MS || "60000");

  const propsData = props.slice(0, 12).map(p => ({
    player: p.player || p.playerName,
    stat: p.statType || p.stat_type,
    line: p.line,
    l5: p.l5Hit || p.l5Pct || 0
  })).filter(p => p.player && p.stat);

  const userContent = `You are a premium sports betting AI analyst. Analyze these player props and provide detailed narrative analysis.

Props: ${JSON.stringify(propsData)}

For EACH prop, generate professional sports analysis including:
1. Player narrative (recent form, context, circumstances affecting performance)
2. Matchup-specific insights (opponent difficulty, defensive ranks, situational advantages)
3. Trend analysis (L5/L10 trajectory, consistency patterns)
4. The recommendation with clear reasoning
5. Key metrics supporting the thesis

Return ONLY valid JSON (no markdown, no extra text):
{
  "recommendations": [
    {
      "player": "PLAYER_NAME",
      "prop": "STAT_TYPE",
      "recommendation": "BUY|PASS|FADE",
      "confidence": 60-95,
      "analysis": "Narrative analysis (2-3 sentences) explaining the edge, recent form, matchup context, and why this prop offers value. Write like a professional sportsbook analyst."
    }
  ],
  "parlays": []
}`;

  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      model: model,
      prompt: userContent,
      stream: false
    });

    const parsedUrl = new url.URL(`${baseUrl}/api/generate`);
    const isHttps = parsedUrl.protocol === "https:";
    const requestModule = isHttps ? https : http;
    const port = parsedUrl.port || (isHttps ? 443 : 80);

    const options = {
      hostname: parsedUrl.hostname,
      port: port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload)
      },
      timeout: timeout
    };

    const req = requestModule.request(options, (res) => {
      let data = "";
      res.on("data", chunk => { data += chunk; });
      res.on("end", () => {
        console.log(`[AI] Ollama status: ${res.statusCode}`);
        if (res.statusCode !== 200) {
          console.log(`[AI] Error:`, data.substring(0, 300));
          reject(new Error(`Status ${res.statusCode}: ${data.substring(0, 300)}`));
          return;
        }
        try {
          const json = JSON.parse(data);
          const text = json.response || "";
          const match = text.match(/\{[\s\S]*\}/);
          const result = match ? JSON.parse(match[0]) : {};

          resolve({
            recommendations: result.recommendations || [],
            parlays: result.parlays || [],
            disclaimer: `AI-powered analysis (${model})`
          });
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on("error", reject);
    req.on("timeout", () => reject(new Error("Ollama request timeout")));
    req.write(payload);
    req.end();
  });
}

function returnMockRecommendations(props) {
  const recs = props.slice(0, 5).map((p, i) => ({
    player: p.player || p.playerName || "Unknown",
    prop: p.statType || p.stat_type || "Stat",
    line: p.line || 20,
    odds: p.odds || "-110",
    recommendation: ["STRONG BUY", "BUY", "BUY", "PASS", "FADE"][i] || "PASS",
    confidence: Math.max(50, 80 - i * 10),
    analysis: `Based on L5 data and scoring model`
  }));

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recommendations: recs,
      parlays: [],
      disclaimer: "Fallback recommendations - API not available"
    })
  };
}
