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

function mdToHtml(raw: string): string {
  if (!raw) return "";
  let html = raw.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  html = html.replace(/^##\s+(.+)$/gm, '<h3 class="section-head">$1</h3>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="pick-head">$1</strong>');
  const blocks = html.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return blocks.map((b) => {
    if (b.startsWith("<h3")) return b;
    if (/^(?:[*+-]\s+.+\n?)+$/m.test(b)) {
      const items = b.split("\n").filter((l) => /^[*+-]\s+/.test(l.trim()))
        .map((l) => `<li>${l.replace(/^[*+-]\s+/, "")}</li>`).join("");
      return `<ul>${items}</ul>`;
    }
    return `<p>${b.replace(/\n/g, "<br>")}</p>`;
  }).join("");
}

export default function Home() {
  const [question, setQuestion] = useState("");
  const [league, setLeague] = useState("ALL");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ analysis: Analysis; model: string; propCount: number } | null>(null);
  const [error, setError] = useState("");

  async function run() {
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
      if (!data.ok) throw new Error(data.error || "Analysis failed");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const a = result?.analysis;
  const conf = a ? Math.max(1, Math.min(10, Math.round(Number(a.confidence_rating) || 7))) : 0;

  return (
    <main style={{ minHeight: "100vh", background: "#0f1117", color: "#e2e8f0", fontFamily: "system-ui,sans-serif", padding: "24px 16px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 24, textAlign: "center" }}>
          <div style={{ color: "#22c55e", fontWeight: 900, fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>PropEdge</div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: "#fff", margin: 0 }}>Generative Analyst</h1>
          <p style={{ color: "#64748b", fontSize: 13, marginTop: 6 }}>Powered by Gemini · PropEdge board data</p>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {LEAGUES.map((l) => (
            <button key={l} onClick={() => setLeague(l)} style={{
              padding: "8px 16px", borderRadius: 999, border: "1px solid",
              borderColor: league === l ? "#22c55e" : "rgba(255,255,255,0.12)",
              background: league === l ? "rgba(34,197,94,0.15)" : "transparent",
              color: league === l ? "#22c55e" : "#94a3b8", fontWeight: 700, fontSize: 12,
              cursor: "pointer", letterSpacing: "0.05em"
            }}>{l}</button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && run()}
            placeholder={`Ask about ${league === "ALL" ? "today's props" : league + " props"}...`}
            style={{
              flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 12, padding: "12px 16px", color: "#fff", fontSize: 14, outline: "none"
            }}
          />
          <button onClick={run} disabled={loading} style={{
            padding: "12px 24px", borderRadius: 12, background: loading ? "#1e293b" : "#22c55e",
            color: loading ? "#64748b" : "#000", fontWeight: 900, fontSize: 14,
            border: "none", cursor: loading ? "not-allowed" : "pointer", minWidth: 100
          }}>
            {loading ? "Analyzing…" : "Analyze"}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 12, padding: 16, marginBottom: 16, color: "#fca5a5", fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: "center", padding: "48px 0", color: "#64748b" }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>⚡</div>
            <div style={{ fontWeight: 700 }}>Gemini is analyzing the board…</div>
          </div>
        )}

        {/* Result */}
        {a && !loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Meta */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#64748b", fontSize: 12 }}>
                Gemini · {result?.model} · {result?.propCount} props analyzed
              </span>
              <span style={{
                padding: "4px 12px", borderRadius: 999, border: "1px solid rgba(34,197,94,0.35)",
                background: "rgba(34,197,94,0.1)", color: "#22c55e", fontSize: 11, fontWeight: 900
              }}>{conf}/10 Confidence</span>
            </div>

            {/* Title card */}
            <div style={{ background: "linear-gradient(135deg,rgba(34,197,94,0.08),rgba(56,189,248,0.06))", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 16, padding: 20 }}>
              <div style={{ color: "#22c55e", fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Model Assessment</div>
              <h2 style={{ color: "#fff", fontSize: 20, fontWeight: 900, margin: "0 0 12px" }}>{a.article_title}</h2>
              <div style={{ color: "#cbd5e1", fontSize: 14, lineHeight: 1.7, margin: 0, borderLeft: "3px solid #22c55e", paddingLeft: 12 }} dangerouslySetInnerHTML={{ __html: mdToHtml(a.featured_intro) }} />
            </div>

            {/* Prose */}
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 20 }}>
              <style>{`
                .section-head { color: #22c55e; font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.06em; margin: 20px 0 10px; }
                .section-head:first-child { margin-top: 0; }
                .pick-head { color: #fff; display: block; font-size: 15px; font-weight: 800; margin: 16px 0 6px; }
                p { color: #94a3b8; font-size: 14px; line-height: 1.75; margin: 0 0 12px; }
                ul { color: #94a3b8; font-size: 13px; line-height: 1.7; padding-left: 20px; margin: 8px 0 12px; }
                li { margin-bottom: 4px; }
                strong { color: #fff; }
              `}</style>
              <div dangerouslySetInnerHTML={{ __html: mdToHtml(a.matchup_analysis) }} />
            </div>

            {/* Key numbers */}
            {a.key_numbers_breakdown && (
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 20 }}>
                <div style={{ color: "#22c55e", fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Key Variances &amp; Splits</div>
                <div dangerouslySetInnerHTML={{ __html: mdToHtml(a.key_numbers_breakdown) }} />
              </div>
            )}

          </div>
        )}
      </div>
    </main>
  );
}
