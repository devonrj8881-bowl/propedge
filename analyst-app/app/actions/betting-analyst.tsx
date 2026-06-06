"use server";

import { streamUI } from "@ai-sdk/rsc";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import React from "react";
import { StrikeoutGaugeWidget } from "@/components/StrikeoutGaugeWidget";
import { GEMINI_SYSTEM_PROMPT } from "@/lib/gemini-system-prompt";
import {
  fetchPropDataForPlayer,
  fetchTopEvPayloads,
  fetchTopStrikeoutPayload,
} from "@/lib/fetch-prop-data";
import type { PropEdgeLlmPayload } from "@/lib/types";

function pickModel() {
  if (process.env.GEMINI_API_KEY) {
    return google(process.env.GEMINI_ANALYST_MODEL || process.env.GEMINI_MODEL || "gemini-3.5-flash");
  }
  if (process.env.OPENAI_API_KEY) {
    return openai(process.env.OPENAI_MODEL || "gpt-4o");
  }
  throw new Error("Set GEMINI_API_KEY or OPENAI_API_KEY in analyst-app/.env.local");
}

const gaugeTool = {
  description:
    "Renders an interactive radial gauge visualization of win probability, projections, and line metrics for MLB strikeout props.",
  inputSchema: z.object({
    playerName: z.string(),
    line: z.number(),
    projectedKs: z.number(),
    evPercentage: z.number(),
    hitRate: z.number(),
  }),
  generate: async function* ({
    playerName,
    line,
    projectedKs,
    evPercentage,
    hitRate,
  }: {
    playerName: string;
    line: number;
    projectedKs: number;
    evPercentage: number;
    hitRate: number;
  }) {
    yield <div className="text-sm text-zinc-400">Calculating projections...</div>;
    return (
      <StrikeoutGaugeWidget
        playerName={playerName}
        line={line}
        projectedKs={projectedKs}
        evPercentage={evPercentage}
        hitRate={hitRate}
      />
    );
  },
};

function markdownText({ content }: { content: string }) {
  return <div className="prose prose-invert max-w-none whitespace-pre-wrap">{content}</div>;
}

async function runStreamAnalysis(userContent: string) {
  const ui = await streamUI({
    model: pickModel(),
    system: GEMINI_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
    text: markdownText,
    tools: {
      render_strikeout_gauge: gaugeTool,
    },
  });
  return ui.value;
}

function payloadToGaugeArgs(pl: PropEdgeLlmPayload) {
  return {
    playerName: pl.player.name,
    line: pl.market.line ?? 5.5,
    projectedKs: pl.analytics.projected_ks ?? pl.analytics.projected_value ?? pl.market.line ?? 5.5,
    evPercentage: pl.analytics.ev_percentage ?? 0,
    hitRate: pl.analytics.hit_rate_last_10 ?? 0.5,
  };
}

/** Reference Server Action — single prop, real board data (no mock). */
export async function generateBetAnalysis(playerName: string, propType: string, league?: string) {
  const propData = await fetchPropDataForPlayer(playerName, propType, league);
  if (!propData) {
    throw new Error(`No board prop found for ${playerName} — ${propType}`);
  }
  return runStreamAnalysis(`Analyze the following prop data: ${JSON.stringify(propData, null, 2)}`);
}

/** Slate-wide +EV analysis — top board payloads by EV. */
export async function generateSlateEvAnalysis(league?: string) {
  const payloads = await fetchTopEvPayloads(league, 8);
  if (!payloads.length) throw new Error("No props on board for analysis");
  return runStreamAnalysis(
    `Analyze these PropEdge payloads ranked by EV. Use render_strikeout_gauge for any MLB strikeout props:\n${JSON.stringify(payloads, null, 2)}`
  );
}

/** Auto-pick top MLB strikeout prop from live board (demo default). */
export async function generateTopStrikeoutAnalysis() {
  const payload = await fetchTopStrikeoutPayload("MLB");
  if (!payload) throw new Error("No MLB strikeout props on board");
  const args = payloadToGaugeArgs(payload);
  return runStreamAnalysis(
    `Analyze this strikeout prop and call render_strikeout_gauge with playerName=${args.playerName}, line=${args.line}, projectedKs=${args.projectedKs}, evPercentage=${args.evPercentage}, hitRate=${args.hitRate}:\n${JSON.stringify(payload, null, 2)}`
  );
}
