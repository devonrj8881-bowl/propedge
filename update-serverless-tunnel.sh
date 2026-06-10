#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Usage: ./update-serverless-tunnel.sh https://ollama.example.com"
  exit 1
fi

TUNNEL_URL="$1"
PROPEDGE_DIR="/Users/devonjohnson/Documents/Claude/Projects/PropEdge/propedge-deploy"
FUNCTION_FILE="$PROPEDGE_DIR/netlify/functions/ai-recommendations.js"

echo "📡 Updating serverless function with tunnel URL: $TUNNEL_URL"

# Create new version of callOllamaAPI with https and tunnel URL
cat > /tmp/ollama-api-patch.txt << 'EOF'
async function callOllamaAPI(props, model = "nemotron-3-super:cloud") {
  const https = require("https");
  const url = require("url");

  const propsData = props.slice(0, 12).map(p => ({
    player: p.player || p.playerName,
    stat: p.statType || p.stat_type,
    line: p.line,
    odds: p.odds || p.line_odds || "-110",
    score: p.modelScore || p.baseScore || 65,
    l5Pct: p.l5Pct || 0,
    l10Pct: p.l10Pct || 0,
    league: p.league || "NBA"
  })).filter(p => p.player && p.stat);

  const userContent = `You are a premium sports betting AI analyst like LineMAKER or ESPN+. Analyze these player props with matchup-specific insights.

Current Props (ranked by PropIQ score):
${JSON.stringify(propsData, null, 2)}

For EACH prop, generate professional analysis:
1. Player form narrative (L5/L10 trajectory, consistency)
2. Matchup-specific edge (opponent defense, pace, rest)
3. Vegas implications (implied odds vs hit rate)
4. Recommendation with clear ROI thesis
5. Confidence level (60-95) based on sample size + edge

Return ONLY valid JSON (no markdown):
{
  "recommendations": [
    {
      "player": "NAME",
      "prop": "STAT",
      "line": NUMBER,
      "recommendation": "STRONG BUY|BUY|PASS|FADE|STRONG FADE",
      "confidence": 70,
      "analysis": "2-3 sentence narrative: form edge + matchup advantage + why this prints. Professional tone."
    }
  ],
  "parlays": [
    {
      "name": "Parlay name",
      "picks": ["Player1 Over 20.5 Pts", "Player2 Under 5.5 Reb"],
      "confidence": 75,
      "thesis": "Why these correlate + edge"
    }
  ]
}`;

  const payload = JSON.stringify({
    model: model,
    prompt: userContent,
    stream: false
  });

  return new Promise((resolve, reject) => {
    const tunnelUrl = new URL("TUNNEL_URL_PLACEHOLDER");
    const options = {
      hostname: tunnelUrl.hostname,
      port: tunnelUrl.port || 443,
      path: "/api/generate",
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
            disclaimer: `AI-powered analysis (${model})`
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
EOF

# Replace placeholder with actual URL
sed -i '' "s|TUNNEL_URL_PLACEHOLDER|$TUNNEL_URL|g" /tmp/ollama-api-patch.txt

# Find line numbers for function replacement
START_LINE=$(grep -n "^async function callOllamaAPI" "$FUNCTION_FILE" | cut -d: -f1)
if [ -z "$START_LINE" ]; then
  echo "❌ callOllamaAPI function not found in $FUNCTION_FILE"
  exit 1
fi

END_LINE=$(tail -n +$((START_LINE + 1)) "$FUNCTION_FILE" | grep -n "^}" | head -1 | cut -d: -f1)
END_LINE=$((START_LINE + END_LINE))

# Create backup
cp "$FUNCTION_FILE" "$FUNCTION_FILE.backup"

# Extract parts before and after function
head -n $((START_LINE - 1)) "$FUNCTION_FILE" > /tmp/before.txt
tail -n +$((END_LINE + 1)) "$FUNCTION_FILE" > /tmp/after.txt

# Combine
cat /tmp/before.txt /tmp/ollama-api-patch.txt /tmp/after.txt > "$FUNCTION_FILE"

cd "$PROPEDGE_DIR"
git add netlify/functions/ai-recommendations.js
git commit -m "Setup: Cloudflare Tunnel for Ollama nemotron ($TUNNEL_URL)"
netlify deploy --prod --dir=.

echo "✅ Serverless updated and deployed"
echo "   Tunnel: $TUNNEL_URL"
echo "   Site: https://propedgemasters.netlify.app"
