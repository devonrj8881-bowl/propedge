exports.handler = async (event) => {
  try {
    // Parse request
    const { context } = JSON.parse(event.body || "{}");

    if (!context?.props?.length) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "No props", recommendations: [], parlays: [] })
      };
    }

    console.log(`[AI] Analyzing ${context.props.length} props`);

    // Try Gemini first (free tier), fallback to Claude (paid)
    const geminiKey = process.env.GOOGLE_API_KEY;
    const claudeKey = process.env.ANTHROPIC_API_KEY;

    console.log(`[AI] Gemini key: ${geminiKey ? "SET (" + geminiKey.slice(0,10) + "...)" : "NOT SET"}, Claude key: ${claudeKey ? "SET (" + claudeKey.slice(0,10) + "...)" : "NOT SET"}`);

    let lastError = null;

    // Try Ollama local first (if running via `netlify dev`)
    try {
      console.log("[AI] Attempting local Ollama (localhost:11434)...");
      const result = await callOllamaAPI(context.props);
      console.log("[AI] Ollama success");
      return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(result) };
    } catch (ollamaErr) {
      lastError = `Ollama: ${ollamaErr.message}`;
      console.warn("[AI] Ollama failed:", lastError);
    }

    // Try Gemini
    if (geminiKey) {
      try {
        console.log("[AI] Attempting Gemini API...");
        const result = await callGeminiAPI(context.props, geminiKey);
        console.log("[AI] Gemini success");
        return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(result) };
      } catch (geminiErr) {
        lastError = `Gemini: ${geminiErr.message}`;
        console.warn("[AI] Gemini failed:", lastError);
      }
    }

    // Fallback to Claude
    if (claudeKey) {
      try {
        console.log("[AI] Attempting Claude API...");
        const result = await callClaudeAPI(context.props, claudeKey);
        console.log("[AI] Claude success");
        return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(result) };
      } catch (claudeErr) {
        lastError = `Claude: ${claudeErr.message}`;
        console.warn("[AI] Claude failed:", lastError);
      }
    }

    // All APIs failed, return mock with error details
    console.warn("[AI] All APIs failed - returning mock. Last error:", lastError);
    const mockResult = returnMockRecommendations(context.props);
    mockResult.body = JSON.stringify({
      ...JSON.parse(mockResult.body),
      apiError: lastError,
      keysConfigured: { gemini: !!geminiKey, claude: !!claudeKey }
    });
    return mockResult;
  } catch (error) {
    console.error("[AI] Handler error:", error.message);
    return returnMockRecommendations([]);
  }
};

async function callOllamaAPI(props) {
  const http = require("http");

  const propsData = props.slice(0, 12).map(p => ({
    player: p.player || p.playerName,
    stat: p.statType || p.stat_type,
    line: p.line,
    l5: p.l5Hit || p.l5Pct || 0
  })).filter(p => p.player && p.stat);

  const userContent = `You are a premium sports betting AI analyst like LineMAKER or ESPN. Analyze these player props and provide detailed narrative analysis.

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

  const payload = JSON.stringify({
    model: "mistral",
    prompt: `You are a premium sports betting AI analyst. ${userContent}`,
    stream: false
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: "localhost",
      port: 11434,
      path: "/api/generate",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload)
      }
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", chunk => { data += chunk; });
      res.on("end", () => {
        console.log(`[AI] Ollama status: ${res.statusCode}`);
        if (res.statusCode !== 200) {
          reject(new Error(`Ollama status ${res.statusCode}`));
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
            disclaimer: "AI-powered analysis (Local Ollama)"
          });
        } catch (e) {
          reject(new Error(`Ollama response parse failed: ${e.message}`));
        }
      });
    });

    req.on("error", reject);
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

async function callClaudeAPI(props, apiKey) {
  const https = require("https");

  const propsData = props.slice(0, 12).map(p => ({
    player: p.player || p.playerName,
    stat: p.statType || p.stat_type,
    line: p.line,
    l5: p.l5Hit || p.l5Pct || 0
  })).filter(p => p.player && p.stat);

  const userContent = `You are a premium sports betting AI analyst like LineMAKER or ESPN. Analyze these player props and provide detailed narrative analysis.

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

  const payload = JSON.stringify({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 4000,
    messages: [{
      role: "user",
      content: `You are a premium sports betting AI analyst. ${userContent}`
    }]
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.anthropic.com",
      path: "/v1/messages",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Length": Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", chunk => { data += chunk; });
      res.on("end", () => {
        console.log(`[AI] Claude status: ${res.statusCode}`);
        if (res.statusCode !== 200) {
          console.log(`[AI] Error:`, data.substring(0, 300));
          reject(new Error(`Status ${res.statusCode}: ${data.substring(0, 300)}`));
          return;
        }
        try {
          const json = JSON.parse(data);
          const text = json.content?.[0]?.text || "";
          const match = text.match(/\{[\s\S]*\}/);
          const result = match ? JSON.parse(match[0]) : {};

          resolve({
            recommendations: result.recommendations || [],
            parlays: result.parlays || [],
            disclaimer: "AI-powered analysis (Claude)"
          });
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

async function callGeminiAPI(props, apiKey) {
  const https = require("https");

  const propsData = props.slice(0, 12).map(p => ({
    player: p.player || p.playerName,
    stat: p.statType || p.stat_type,
    line: p.line,
    l5: p.l5Hit || p.l5Pct || 0
  })).filter(p => p.player && p.stat);

  const userContent = `You are a premium sports betting AI analyst like LineMAKER or ESPN. Analyze these player props and provide detailed narrative analysis.

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

  const payload = JSON.stringify({
    contents: [{
      parts: [{
        text: `You are a premium sports betting AI analyst. ${userContent}`
      }]
    }]
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: "generativelanguage.googleapis.com",
      path: `/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", chunk => { data += chunk; });
      res.on("end", () => {
        console.log(`[AI] Gemini status: ${res.statusCode}`);
        if (res.statusCode !== 200) {
          // Check if response is JSON error (usage_exceeded, etc)
          try {
            const errJson = JSON.parse(data);
            if (errJson.error) {
              reject(new Error(`Gemini ${errJson.error}: ${errJson.message}`));
              return;
            }
          } catch (_) {}
          console.log(`[AI] Error:`, data.substring(0, 300));
          reject(new Error(`Status ${res.statusCode}: ${data.substring(0, 300)}`));
          return;
        }
        try {
          const json = JSON.parse(data);
          const text = json.candidates?.[0]?.content?.parts?.[0]?.text || "";
          const match = text.match(/\{[\s\S]*\}/);
          const result = match ? JSON.parse(match[0]) : {};

          resolve({
            recommendations: result.recommendations || [],
            parlays: result.parlays || [],
            disclaimer: "AI-powered analysis (Gemini)"
          });
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}
