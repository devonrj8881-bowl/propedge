exports.handler = async (event) => {
  console.log("[Narrative] Handler called");
  try {
    const { prompt, player, prop } = JSON.parse(event.body || "{}");

    if (!prompt) {
      console.log("[Narrative] No prompt provided");
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "No prompt", recent: "", matchup: "", verdict: "" })
      };
    }

    console.log(`[Narrative] Generating for ${player} ${prop}`);

    // Try local Ollama via Tailscale/ngrok
    try {
      console.log("[Narrative] Attempting Ollama...");
      const result = await callOllamaAPI(prompt);
      console.log("[Narrative] Ollama success");
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result)
      };
    } catch (ollamaErr) {
      console.warn("[Narrative] Ollama failed:", ollamaErr.message);
      // Return fallback
      const fallback = {
        recent: `Analyzing ${player} prop for ${prop}...`,
        matchup: "Matchup context loading...",
        verdict: "Narrative generation unavailable"
      };
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fallback)
      };
    }
  } catch (error) {
    console.error("[Narrative] Handler error:", error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message,
        recent: "Error generating narrative",
        matchup: "Please try again",
        verdict: "PropIQ analysis available"
      })
    };
  }
};

async function callOllamaAPI(prompt) {
  const http = require("http");
  const https = require("https");
  const url = require("url");

  const baseUrl = process.env.OLLAMA_BASE_URL || "http://100.74.107.50:11434";
  const model = process.env.OLLAMA_MODEL || "gemma4:e4b";
  const timeout = parseInt(process.env.OLLAMA_TIMEOUT_MS || "30000");

  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      model: model,
      prompt: prompt,
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
        console.log(`[Narrative] Ollama status: ${res.statusCode}`);
        if (res.statusCode !== 200) {
          console.log(`[Narrative] Error:`, data.substring(0, 200));
          reject(new Error(`Status ${res.statusCode}`));
          return;
        }
        try {
          const json = JSON.parse(data);
          const text = json.response || "";
          const match = text.match(/\{[\s\S]*\}/);
          const result = match ? JSON.parse(match[0]) : {};

          resolve({
            recent: result.recent || "Loading...",
            matchup: result.matchup || "Loading...",
            verdict: result.verdict || "Loading..."
          });
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on("error", reject);
    req.on("timeout", () => reject(new Error("Narrative request timeout")));
    req.write(payload);
    req.end();
  });
}
