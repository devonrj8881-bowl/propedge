# PropEdgeMasters Ollama + Netlify patch

This patch fixes the failing architecture where a Netlify Function tries to call a private Tailscale IP such as `http://100.x.x.x:11434`. Netlify Functions run in Netlify's cloud, not inside your tailnet, so private Tailscale IPs are expected to time out.

## Files

- `netlify/functions/ask-analyst.js` replaces or creates your Netlify Function for Ask an Analyst.
- `local-ollama-proxy.js` runs on your Mac and forwards authenticated requests to local Ollama.

## Fastest setup

From your PropEdge project folder:

```bash
cd /Users/devonjohnson/Documents/Claude/Projects/PropEdge
mkdir -p netlify/functions
cp /path/to/propedge-ollama-patch/netlify/functions/ask-analyst.js netlify/functions/ask-analyst.js
cp /path/to/propedge-ollama-patch/local-ollama-proxy.js ./local-ollama-proxy.js
```

Start Ollama locally, then start the proxy:

```bash
export OLLAMA_PROXY_TOKEN="$(openssl rand -hex 32)"
echo "$OLLAMA_PROXY_TOKEN"
node local-ollama-proxy.js
```

In another terminal, expose the proxy through Tailscale Funnel:

```bash
tailscale funnel --bg localhost:8787
tailscale funnel status
```

Use the Funnel HTTPS URL shown by `tailscale funnel status` as `OLLAMA_BASE_URL` in Netlify.

## Netlify environment variables

Set these in Netlify project settings:

```text
OLLAMA_BASE_URL=https://your-mac.your-tailnet.ts.net
OLLAMA_PROXY_TOKEN=the-same-token-you-exported-locally
OLLAMA_MODEL=mistral
OLLAMA_TIMEOUT_MS=60000
```

Redeploy after changing environment variables.

## Test locally

```bash
curl http://127.0.0.1:8787/health
curl -H "Authorization: Bearer $OLLAMA_PROXY_TOKEN" http://127.0.0.1:8787/api/tags
```

Test the Netlify Function after deployment:

```bash
curl -X POST "https://propedgemasters.netlify.app/.netlify/functions/ask-analyst" \
  -H "Content-Type: application/json" \
  -d '{"question":"Give me a quick framework for evaluating an NBA points prop."}'
```

## Important

Do not set `OLLAMA_BASE_URL` in Netlify to:

```text
http://100.x.x.x:11434
http://127.0.0.1:11434
http://192.168.x.x:11434
```

Those are private from Netlify's perspective. Use a public HTTPS Funnel URL with the token-protected proxy, or make the browser call Tailscale Serve directly from a Tailscale-connected device.
