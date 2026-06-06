"use client";

import { useEffect, useState } from "react";
import {
  generateBetAnalysis,
  generateSlateEvAnalysis,
  generateTopStrikeoutAnalysis,
} from "@/app/actions/betting-analyst";

type League = "ALL" | "NBA" | "NHL" | "MLB";

interface AnalystDashboardProps {
  initialLeague?: string;
}

export function AnalystDashboard({ initialLeague }: AnalystDashboardProps) {
  const [analysisComponent, setAnalysisComponent] = useState<React.ReactNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [league, setLeague] = useState<League>((initialLeague as League) || "ALL");
  const [playerName, setPlayerName] = useState("");
  const [propType, setPropType] = useState("Strikeouts");

  useEffect(() => {
    const onMessage = (ev: MessageEvent) => {
      const data = ev.data;
      if (!data || data.type !== "propedge:init") return;
      if (data.league) setLeague(String(data.league).toUpperCase() as League);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  async function run(action: "slate" | "strikeout" | "player") {
    setLoading(true);
    setError(null);
    try {
      let ui: React.ReactNode;
      if (action === "slate") {
        ui = await generateSlateEvAnalysis(league === "ALL" ? undefined : league);
      } else if (action === "strikeout") {
        ui = await generateTopStrikeoutAnalysis();
      } else {
        const name = playerName.trim();
        if (!name) throw new Error("Enter a player name");
        ui = await generateBetAnalysis(name, propType, league === "ALL" ? undefined : league);
      }
      setAnalysisComponent(ui);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
      setAnalysisComponent(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <header className="mb-8 border-b border-zinc-800 pb-6">
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-emerald-400">
          PropEdge Generative UI
        </p>
        <h1 className="text-2xl font-black text-zinc-100">+EV Analyst Engine</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Vercel AI SDK streamUI — Markdown analysis streams alongside React gauge components from live board data.
        </p>
      </header>

      <div className="mb-6 flex flex-wrap gap-2">
        {(["ALL", "NBA", "NHL", "MLB"] as League[]).map((lg) => (
          <button
            key={lg}
            type="button"
            onClick={() => setLeague(lg)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              league === lg
                ? "bg-emerald-600 text-white"
                : "border border-zinc-700 text-zinc-300 hover:border-emerald-700"
            }`}
          >
            {lg}
          </button>
        ))}
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <input
          type="text"
          placeholder="Player name (optional)"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500"
        />
        <input
          type="text"
          placeholder="Prop type e.g. Strikeouts"
          value={propType}
          onChange={(e) => setPropType(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500"
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => run("slate")}
          disabled={loading}
          className="rounded-lg bg-emerald-600 px-6 py-3 font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
        >
          {loading ? "Processing Slate Math..." : "Generate +EV Analysis"}
        </button>
        <button
          type="button"
          onClick={() => run("strikeout")}
          disabled={loading}
          className="rounded-lg border border-zinc-600 px-4 py-3 text-sm font-semibold text-zinc-200 hover:border-emerald-600 disabled:opacity-50"
        >
          Top K Prop + Gauge
        </button>
        {playerName.trim() ? (
          <button
            type="button"
            onClick={() => run("player")}
            disabled={loading}
            className="rounded-lg border border-zinc-600 px-4 py-3 text-sm font-semibold text-zinc-200 hover:border-emerald-600 disabled:opacity-50"
          >
            Analyze Player
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="mt-6 rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <div className="prose prose-invert mt-8 max-w-none">{analysisComponent}</div>
    </div>
  );
}
