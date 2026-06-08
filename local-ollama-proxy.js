#!/usr/bin/env node

const http = require("http");

const PORT = Number(process.env.PORT || 8787);
const TOKEN = process.env.OLLAMA_PROXY_TOKEN;
const OLLAMA_URL = (process.env.OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/+$/, "");

if (!TOKEN || TOKEN.length < 24) {
  console.error("Set OLLAMA_PROXY_TOKEN to a long random value before starting this proxy.");
  console.error("Example:");
  console.error("  export OLLAMA_PROXY_TOKEN=\"$(openssl rand -hex 32)\"");
  process.exit(1);
}

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 10 * 1024 * 1024) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function requireAuth(req, res) {
  const auth = req.headers.authorization || "";
  if (auth !== `Bearer ${TOKEN}`) {
    sendJson(res, 401, { error: "unauthorized" });
    return false;
  }
  return true;
}

async function proxyToOllama(req, res, path) {
  if (!requireAuth(req, res)) return;

  const body = await readBody(req);
  const upstream = await fetch(`${OLLAMA_URL}${path}`, {
    method: req.method,
    headers: {
      "Content-Type": req.headers["content-type"] || "application/json",
    },
    body: req.method === "GET" ? undefined : body,
  });

  const text = await upstream.text();
  res.writeHead(upstream.status, {
    "Content-Type": upstream.headers.get("content-type") || "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  });
  res.end(text);
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      return sendJson(res, 204, {});
    }

    if (req.url === "/health") {
      return sendJson(res, 200, { ok: true, proxy: "local-ollama-proxy", ollamaUrl: OLLAMA_URL });
    }

    if (req.method === "GET" && req.url === "/api/tags") {
      if (!requireAuth(req, res)) return;
      const upstream = await fetch(`${OLLAMA_URL}/api/tags`);
      const text = await upstream.text();
      res.writeHead(upstream.status, { "Content-Type": "application/json" });
      return res.end(text);
    }

    if (req.method === "POST" && ["/api/chat", "/api/generate"].includes(req.url)) {
      return proxyToOllama(req, res, req.url);
    }

    return sendJson(res, 404, { error: "not found" });
  } catch (error) {
    return sendJson(res, 502, { error: "proxy failed", detail: error.message });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Local Ollama proxy listening on http://127.0.0.1:${PORT}`);
  console.log(`Forwarding to ${OLLAMA_URL}`);
});
