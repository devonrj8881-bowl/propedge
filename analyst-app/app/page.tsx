"use client";
import { useState } from "react";

const LEAGUES = ["ALL", "MLB", "NBA", "NHL", "NFL"];

interface Analysis {
  article_title: string;
  featured_intro: string;
  matchup_analysis: string;
  key_numbers_breakdown: string;
  confidence_rating: number;
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderProse(raw: string): string {
  if (!raw) return "";
  const lines = raw.split("\n");
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // ## Section header
    if (line.startsWith("## ")) {
      out.push(`<h3 style="color:#22c55e;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:0.08em;margin:28px 0 14px;border-bottom:1px solid rgba(34,197,94,0.2);padding-bottom:6px;">${esc(line.slice(3))}</h3>`);
      continue;
    }

    // **Pick header** — bold line is a pick headline
    if (line.startsWith("**") && line.endsWith("**")) {
      const text = line.slice(2, -2);
      out.push(`<div style="color:#fff;font-size:16px;font-weight:800;margin:20px 0 6px;line-height:1.3;">${esc(text)}</div>`);
      continue;
    }

    // **Pick header** followed by text on same line or next
    if (line.startsWith("**") && line.includes("**", 2)) {
      const endBold = line.indexOf("**", 2);
      const boldPart = line.slice(2, endBold);
      const rest = line.slice(endBold + 2).trim();
      out.push(`<div style="color:#fff;font-size:16px;font-weight:800;margin:20px 0 6px;line-height:1.3;">${esc(boldPart)}</div>`);
      if (rest) out.push(`<p style="color:#94a3b8;font-size:14px;line-height:1.8;margin:0 0 16px;">${esc(rest)}</p>`);
      continue;
    }

    // Bullet point
    if (line.startsWith("* ") || line.startsWith("- ")) {
      // Collect all consecutive bullets
      const items: string[] = [];
      while (i < lines.length && (lines[i].trim().startsWith("* ") || lines[i].trim().startsWith("- "))) {
        const bullet = lines[i].trim().replace(/^[*-]\s+/, "");
        items.push(`<li style="color:#94a3b8;font-size:13px;line-height:1.7;margin-bottom:5px;">${renderInline(bullet)}</li>`);
        i++;
      }
      i--; // back up one since loop will increment
      out.push(`<ul style="padding-left:18px;margin:8px 0 16px;">${items.join("")}</ul>`);
      continue;
    }

    // Regular paragraph
    out.push(`<p style="color:#94a3b8;font-size:14px;line-height:1.8;margin:0 0 14px;">${renderInline(esc(line))}</p>`);
  }

  return out.join("");
}

function renderInline(html: string): string {
  return html.replace(/\*\*(.*?)\*\*/g, "<strong style='color:#e2e8f0;font-weight:700;'>$1</strong>");
}

export default function Home() {
  const [question, setQuestion] = useState("");
  const [league, setLeague] = useState("ALL");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ analysis: Analysis; model: string; propCount: number; fallback?: boolean } | null>(null);
  const [error, setError] = useState("");

  async function run(retryCount = 0) {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question || `What are the best ${league} props today?`, league }),
      });
      const data = await res.json();
      if (!data.ok) {
        const msg = data.error || "Analysis failed";
        const isBusy = /503|UNAVAILABLE|high demand|temporarily busy/i.test(msg + (data.detail || ""));
        if (isBusy && retryCount < 2) {
          await new Promise((r) => setTimeout(r, 1200 * (retryCount + 1)));
          return run(retryCount + 1);
        }
        throw new Error(msg);
      }
      setResult(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const isBusy = /503|UNAVAILABLE|high demand|temporarily busy/i.test(msg);
      setError(
        isBusy
          ? "Gemini is temporarily busy. We retried automatically — please tap Analyze again in a few seconds."
          : msg,
      );
    } finally {
      setLoading(false);
    }
  }

  const a = result?.analysis;
  const conf = a ? Math.max(1, Math.min(10, Math.round(Number(a.confidence_rating) || 7))) : 0;

  return (
    <main style={{ minHeight: "100vh", background: "#0f1117", color: "#e2e8f0", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", padding: "32px 16px" }}>
      <div style={{ maxWidth: 780, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 28, textAlign: "center" }}>
          <div style={{ color: "#22c55e", fontWeight: 900, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>PropEdge</div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: "#fff", margin: "0 0 6px" }}>Generative Analyst</h1>
          <p style={{ color: "#475569", fontSize: 13, margin: 0 }}>Powered by Gemini · PropEdge board data</p>
        </div>

        {/* League selector */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          {LEAGUES.map((l) => (
            <button key={l} onClick={() => setLeague(l)} style={{
              padding: "7px 16px", borderRadius: 999, border: "1px solid",
              borderColor: league === l ? "#22c55e" : "rgba(255,255,255,0.1)",
              background: league === l ? "rgba(34,197,94,0.15)" : "transparent",
              color: league === l ? "#22c55e" : "#64748b", fontWeight: 700, fontSize: 12,
              cursor: "pointer", letterSpacing: "0.04em", transition: "all 0.15s"
            }}>{l}</button>
          ))}
        </div>

        {/* Search bar */}
        <div style={{ display: "flex", gap: 8, marginBottom: 32 }}>
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && run()}
            placeholder={`Ask about ${league === "ALL" ? "today's props" : league + " props"}...`}
            style={{
              flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12, padding: "13px 16px", color: "#fff", fontSize: 14, outline: "none"
            }}
          />
          <button onClick={() => run()} disabled={loading} style={{
            padding: "13px 28px", borderRadius: 12,
            background: loading ? "#1e293b" : "#22c55e",
            color: loading ? "#475569" : "#000",
            fontWeight: 900, fontSize: 14, border: "none",
            cursor: loading ? "not-allowed" : "pointer", minWidth: 110
          }}>
            {loading ? "Analyzing…" : "Analyze"}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 12, padding: "14px 16px", marginBottom: 20, color: "#fca5a5", fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#475569" }}>
            <div style={{ fontSize: 32, marginBottom: 14 }}>⚡</div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Gemini is analyzing the board…</div>
            <div style={{ fontSize: 13, marginTop: 6 }}>Pulling Statcast data, splits & matchup context</div>
          </div>
        )}

        {/* Result */}
        {a && !loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Meta row */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#475569", fontSize: 12 }}>
                {result?.fallback ? "PropEdge backup" : "Gemini"} · {result?.model} · {result?.propCount} props analyzed
              </span>
              <span style={{
                padding: "4px 12px", borderRadius: 999,
                border: "1px solid rgba(34,197,94,0.3)",
                background: "rgba(34,197,94,0.08)",
                color: "#22c55e", fontSize: 11, fontWeight: 900
              }}>{conf}/10 Confidence</span>
            </div>

            {/* Title + intro card */}
            <div style={{ background: "linear-gradient(135deg,rgba(34,197,94,0.07),rgba(56,189,248,0.04))", border: "1px solid rgba(34,197,94,0.18)", borderRadius: 16, padding: "22px 24px" }}>
              <div style={{ color: "#22c55e", fontSize: 10, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Model Assessment</div>
              <h2 style={{ color: "#fff", fontSize: 22, fontWeight: 900, margin: "0 0 16px", lineHeight: 1.3 }}>{a.article_title}</h2>
              <div style={{ borderLeft: "3px solid #22c55e", paddingLeft: 14 }}>
                <p style={{ color: "#cbd5e1", fontSize: 14, lineHeight: 1.75, margin: 0 }}>{a.featured_intro}</p>
              </div>
            </div>

            {/* Main analysis */}
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "24px 26px" }}>
              <div dangerouslySetInnerHTML={{ __html: renderProse(a.matchup_analysis) }} />
            </div>

            {/* Key numbers */}
            {a.key_numbers_breakdown && (
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "20px 26px" }}>
                <div style={{ color: "#22c55e", fontSize: 10, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>Key Variances &amp; Splits</div>
                <div dangerouslySetInnerHTML={{ __html: renderProse(a.key_numbers_breakdown) }} />
              </div>
            )}

          </div>
        )}
      </div>
    </main>
  );
}
