#!/bin/bash
set -e

echo "🌐 Complete Cloudflare Tunnel Setup"
echo "===================================="

# Get inputs
read -p "Enter tunnel ID (e.g., f7a2293e-99b5-4bc6-846f-41cc7d7a2b2f): " TUNNEL_ID
read -p "Enter domain (e.g., example.com): " DOMAIN
read -p "Enter subdomain for Ollama (default: ollama): " SUBDOMAIN
SUBDOMAIN=${SUBDOMAIN:-ollama}
OLLAMA_URL="$SUBDOMAIN.$DOMAIN"

echo ""
echo "Configuration:"
echo "  Tunnel ID: $TUNNEL_ID"
echo "  Domain: $DOMAIN"
echo "  Subdomain: $SUBDOMAIN"
echo "  Full URL: https://$OLLAMA_URL"
echo ""

# Step 1: Create config file
echo "[1/3] Creating config file..."
mkdir -p ~/.cloudflared

cat > ~/.cloudflared/config.yml <<EOF
tunnel: $TUNNEL_ID
credentials-file: ~/.cloudflared/$TUNNEL_ID.json

ingress:
  - hostname: $OLLAMA_URL
    service: http://localhost:11434
  - service: http_status:404
EOF

echo "✓ Config file created at ~/.cloudflared/config.yml"

# Step 2: Route DNS
echo "[2/3] Routing DNS..."
cloudflared tunnel route dns $TUNNEL_ID $OLLAMA_URL
echo "✓ DNS routed: $OLLAMA_URL → localhost:11434"

# Step 3: Update serverless function
echo "[3/3] Updating serverless function..."

PROPEDGE_DIR="/Users/devonjohnson/Documents/Claude/Projects/PropEdge/propedge-deploy"
FUNCTION_FILE="$PROPEDGE_DIR/netlify/functions/ai-recommendations.js"

# Backup original
cp "$FUNCTION_FILE" "$FUNCTION_FILE.backup"

# Use Node.js to safely update the function (avoids regex issues)
node << EOF
const fs = require('fs');
const path = require('path');

const tunnelUrl = "https://$OLLAMA_URL";
const functionFile = "$FUNCTION_FILE";

let content = fs.readFileSync(functionFile, 'utf8');

// Find callOllamaAPI function and replace it
const oldFunction = /async function callOllamaAPI\(props, model = "nemotron-3-super:cloud"\) \{[\s\S]*?\n\}\n(?=\nfunction returnMockRecommendations)/;

const newFunction = `async function callOllamaAPI(props, model = "nemotron-3-super:cloud") {
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

  const userContent = \`You are a premium sports betting AI analyst like LineMAKER or ESPN+. Analyze these player props with matchup-specific insights.

Current Props (ranked by PropIQ score):
\${JSON.stringify(propsData, null, 2)}

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
}\`;

  const payload = JSON.stringify({
    model: model,
    prompt: userContent,
    stream: false
  });

  return new Promise((resolve, reject) => {
    const tunnelUrl = new URL("${tunnelUrl}");
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
        console.log(\`[AI] Ollama status: \${res.statusCode}\`);
        if (res.statusCode !== 200) {
          reject(new Error(\`Ollama status \${res.statusCode}\`));
          return;
        }
        try {
          const json = JSON.parse(data);
          const text = json.response || "";
          const match = text.match(/\\{[\\s\\S]*\\}/);
          const result = match ? JSON.parse(match[0]) : {};

          resolve({
            recommendations: result.recommendations || [],
            parlays: result.parlays || [],
            disclaimer: \`AI-powered analysis (\${model})\`
          });
        } catch (e) {
          reject(new Error(\`Ollama response parse failed: \${e.message}\`));
        }
      });
    });

    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}`;

if (oldFunction.test(content)) {
  content = content.replace(oldFunction, newFunction);
  fs.writeFileSync(functionFile, content, 'utf8');
  console.log('✓ Function updated');
} else {
  console.error('✗ Could not find callOllamaAPI function');
  process.exit(1);
}
EOF

echo "✓ Serverless function updated"

# Step 4: Commit and deploy
cd "$PROPEDGE_DIR"
git add netlify/functions/ai-recommendations.js
git commit -m "Setup: Cloudflare Tunnel for Ollama nemotron ($OLLAMA_URL)" || true
echo "✓ Changes committed"

echo ""
echo "⏳ Deploying to Netlify..."
netlify deploy --prod --dir=.

echo ""
echo "✅ Complete setup finished!"
echo ""
echo "═══════════════════════════════════════════════════"
echo "🎯 Next steps:"
echo ""
echo "1. Start Cloudflare Tunnel (keep running):"
echo "   cloudflared tunnel run ollama"
echo ""
echo "2. Start Ollama (in another terminal):"
echo "   ollama serve"
echo ""
echo "3. Verify tunnel is working:"
echo "   curl https://$OLLAMA_URL/api/generate -X POST"
echo ""
echo "4. Test at:"
echo "   https://propedgemasters.netlify.app"
echo "   → Go to Analyst tab and type a question"
echo ""
echo "═══════════════════════════════════════════════════"
