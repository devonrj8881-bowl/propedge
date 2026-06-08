const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const DEFAULT_MODEL = process.env.OLLAMA_MODEL || "mistral";
const DEFAULT_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS || 60000);

function json(statusCode, body) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

function isPrivateTailscaleOrLanUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname;

    if (host === "localhost" || host === "127.0.0.1" || host.startsWith("127.")) return true;
    if (host.startsWith("10.")) return true;
    if (host.startsWith("192.168.")) return true;

    const parts = host.split(".").map(Number);
    if (parts.length === 4 && parts.every((n) => Number.isInteger(n))) {
      const [a, b] = parts;
      if (a === 100 && b >= 64 && b <= 127) return true; // Tailscale CGNAT range
      if (a === 172 && b >= 16 && b <= 31) return true;
    }

    return false;
  } catch {
    return false;
  }
}

function normalizeBaseUrl(rawUrl) {
  return String(rawUrl || "").replace(/\/+$/, "");
}

async function postJsonWithTimeout(url, payload, headers = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    if (!response.ok) {
      const message = data?.error || data?.message || `Ollama proxy returned HTTP ${response.status}`;
      const err = new Error(message);
      err.status = response.status;
      err.details = data;
      throw err;
    }

    return data;
  } finally {
    clearTimeout(timer);
  }
}

exports.handler = async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const baseUrl = normalizeBaseUrl(process.env.OLLAMA_BASE_URL);
  const proxyToken = process.env.OLLAMA_PROXY_TOKEN;

  if (!baseUrl) {
    return json(500, {
      error: "Missing OLLAMA_BASE_URL",
      fix: "Set OLLAMA_BASE_URL to your public Tailscale Funnel proxy URL, not a 100.x Tailscale IP.",
    });
  }

  if (isPrivateTailscaleOrLanUrl(baseUrl)) {
    return json(502, {
      error: "Netlify cannot reach private Ollama URLs",
      detail: `OLLAMA_BASE_URL is set to ${baseUrl}, which is private/LAN/Tailscale-only from Netlify's cloud runtime.`,
      fix: "Use a token-protected Tailscale Funnel proxy URL, or call Ollama directly from the browser on a Tailscale-connected device.",
    });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const question = body.question || body.prompt || body.message;
  const messages = Array.isArray(body.messages)
    ? body.messages
    : [
        {
          role: "system",
          content:
            "You are PropEdgeMasters Ask an Analyst. Give concise, practical sports prop analysis. Do not invent odds or injury news that were not provided.",
        },
        {
          role: "user",
          content: String(question || ""),
        },
      ];

  if (!messages.some((m) => String(m.content || "").trim())) {
    return json(400, { error: "Missing question, prompt, message, or messages content" });
  }

  const headers = {};
  if (proxyToken) {
    headers.Authorization = `Bearer ${proxyToken}`;
  }

  const payload = {
    model: body.model || DEFAULT_MODEL,
    messages,
    stream: false,
    options: body.options || {
      temperature: 0.3,
      num_predict: 700,
    },
  };

  try {
    const data = await postJsonWithTimeout(`${baseUrl}/api/chat`, payload, headers);
    const answer = data?.message?.content || data?.response || "";

    return json(200, {
      ok: true,
      provider: "ollama",
      model: payload.model,
      answer,
      raw: data,
    });
  } catch (error) {
    const timedOut = error?.name === "AbortError";

    return json(502, {
      ok: false,
      error: timedOut ? "Ollama proxy request timed out" : "Ollama proxy request failed",
      detail: timedOut ? `Timed out after ${DEFAULT_TIMEOUT_MS}ms` : error.message,
      fix:
        "If OLLAMA_BASE_URL is a Tailscale Serve URL, Netlify still cannot access it. Use Tailscale Funnel with the local authenticated proxy, or switch the app to browser-direct mode.",
    });
  }
};
