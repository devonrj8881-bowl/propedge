// components/StrikeoutGaugeWidget.tsx
'use client';

import React, { useState } from 'react';

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
  hitRate
}: WidgetProps) {
  // Allow user to simulate changes in performance lines directly inside the component
  const [simulatedInnings, setSimulatedInnings] = useState<number>(6);
  
  // Basic math simulation adjustments inside the client UI
  const adjustedProjection = ((projectedKs / 5.5) * simulatedInnings).toFixed(1);

  return (
    <div className="my-6 rounded-xl border border-zinc-800 bg-zinc-950 p-6 text-zinc-100 shadow-2xl">
      <div className="mb-4 flex items-center justify-between border-b border-zinc-800 pb-4">
        <div>
          <h4 className="text-lg font-bold tracking-tight">{playerName} Analysis Engine</h4>
          <p className="text-xs text-zinc-400">PropEdge Proprietary Valuation Model</p>
        </div>
        <span className="rounded-full bg-emerald-950 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-800">
          +{evPercentage}% EV Edge
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="flex flex-col items-center justify-center p-4 bg-zinc-900 rounded-lg border border-zinc-800">
          <span className="text-xs text-zinc-400 uppercase tracking-wider mb-1">Vegas Line</span>
          <span className="text-3xl font-black tracking-tight">{line}</span>
        </div>
        <div className="flex flex-col items-center justify-center p-4 bg-zinc-900 rounded-lg border border-zinc-800">
          <span className="text-xs text-zinc-400 uppercase tracking-wider mb-1">AI Projection</span>
          <span className="text-3xl font-black text-emerald-400 tracking-tight">{adjustedProjection}</span>
        </div>
        <div className="flex flex-col items-center justify-center p-4 bg-zinc-900 rounded-lg border border-zinc-800">
          <span className="text-xs text-zinc-400 uppercase tracking-wider mb-1">L10 Hit Rate</span>
          <span className="text-3xl font-black tracking-tight">{hitRate * 100}%</span>
        </div>
      </div>

      {/* Simulator Control Layer */}
      <div className="space-y-2 bg-zinc-900 p-4 rounded-lg border border-zinc-800">
        <div className="flex justify-between text-sm">
          <label htmlFor="innings-slider" className="font-medium text-zinc-300">Simulate Expected Innings Pitched</label>
          <span className="font-mono text-emerald-400 font-bold">{simulatedInnings} IP</span>
        </div>
        <input
          id="innings-slider"
          type="range"
          min="1"
          max="9"
          step="0.5"
          value={simulatedInnings}
          onChange={(e) => setSimulatedInnings(parseFloat(e.target.value))}
          className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
        />
      </div>
    </div>
  );
}