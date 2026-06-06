"use client";

import React, { useState } from "react";

interface WidgetProps {
  playerName: string;
  line: number;
  projectedKs: number;
  evPercentage: number;
  hitRate: number;
}

export function StrikeoutGaugeWidget({
  playerName,
  line,
  projectedKs,
  evPercentage,
  hitRate,
}: WidgetProps) {
  const [simulatedInnings, setSimulatedInnings] = useState<number>(6);
  const safeLine = line > 0 ? line : 5.5;
  const safeProj = projectedKs > 0 ? projectedKs : safeLine;
  const adjustedProjection = ((safeProj / safeLine) * simulatedInnings).toFixed(1);

  return (
    <div className="my-6 rounded-xl border border-zinc-800 bg-zinc-950 p-6 text-zinc-100 shadow-2xl">
      <div className="mb-4 flex items-center justify-between border-b border-zinc-800 pb-4">
        <div>
          <h4 className="text-lg font-bold tracking-tight">{playerName} Analysis Engine</h4>
          <p className="text-xs text-zinc-400">PropEdge Proprietary Valuation Model</p>
        </div>
        <span className="rounded-full border border-emerald-800 bg-emerald-950 px-3 py-1 text-xs font-semibold text-emerald-400">
          +{evPercentage}% EV Edge
        </span>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="flex flex-col items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <span className="mb-1 text-xs uppercase tracking-wider text-zinc-400">Vegas Line</span>
          <span className="text-3xl font-black tracking-tight">{safeLine}</span>
        </div>
        <div className="flex flex-col items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <span className="mb-1 text-xs uppercase tracking-wider text-zinc-400">AI Projection</span>
          <span className="text-3xl font-black tracking-tight text-emerald-400">{adjustedProjection}</span>
        </div>
        <div className="flex flex-col items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <span className="mb-1 text-xs uppercase tracking-wider text-zinc-400">L10 Hit Rate</span>
          <span className="text-3xl font-black tracking-tight">{Math.round(hitRate * 100)}%</span>
        </div>
      </div>

      <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex justify-between text-sm">
          <label htmlFor="innings-slider" className="font-medium text-zinc-300">
            Simulate Expected Innings Pitched
          </label>
          <span className="font-mono font-bold text-emerald-400">{simulatedInnings} IP</span>
        </div>
        <input
          id="innings-slider"
          type="range"
          min="1"
          max="9"
          step="0.5"
          value={simulatedInnings}
          onChange={(e) => setSimulatedInnings(parseFloat(e.target.value))}
          className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-zinc-800 accent-emerald-500"
        />
      </div>
    </div>
  );
}
