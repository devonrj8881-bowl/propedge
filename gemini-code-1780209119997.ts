// app/actions/betting-analyst.ts
'use server';

import { createOpenAI } from '@ai-sdk/openai';
import { streamUI } from 'ai/rsc';
import { z } from 'zod';
import React from 'react';
import { StrikeoutGaugeWidget } from '@/components/StrikeoutGaugeWidget';

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

// This matches the data transformer schema we discussed earlier
interface PropDataPayload {
  player: { name: string; team: string };
  market: { prop_type: string; line: number; odds: number; implied_probability: number };
  analytics: { projected_ks: number; ev_percentage: number; hit_rate_last_10: number };
}

async function fetchPropData(playerName: string, propType: string): Promise<PropDataPayload> {
  // In production, database or external API aggregation logic goes here.
  // Returning mock data matching our established pipeline for demonstration:
  return {
    player: { name: playerName, team: 'PHI' },
    market: { prop_type: propType, line: 5.5, odds: -108, implied_probability: 0.5192 },
    analytics: { projected_ks: 6.2, ev_percentage: 4.5, hit_rate_last_10: 0.60 }
  };
}

export async function generateBetAnalysis(playerName: string, propType: string) {
  // 1. Retrieve the clean, structured data layer
  const propData = await fetchPropData(playerName, propType);

  // 2. Stream the text response alongside UI component execution
  const ui = await streamUI({
    model: openai('gpt-4o'),
    system: `You are an elite, data-driven MLB sports betting analyst powering PropEdge Master. 
    Your sole objective is to identify and explain positive expected value (+EV) targets.
    Your tone is sharp, objective, and mathematical. Do not use conversational filler.
    
    Structure your analysis using clear Markdown. Focus heavily on 'The Angle'.
    You have a tool called 'render_strikeout_gauge' that you MUST use to visually accompany 
    your mathematical argument whenever analyzing pitcher props.`,
    
    // Inject the structured payload as the context context for the model
    messages: [
      {
        role: 'user',
        content: `Analyze the following prop data: ${JSON.stringify(propData)}`
      }
    ],
    tools: {
      render_strikeout_gauge: {
        description: 'Renders an interactive radial gauge visualization of win probability, projections, and line metrics.',
        parameters: z.object({
          playerName: z.string(),
          line: z.number(),
          projectedKs: z.number(),
          evPercentage: z.number(),
          hitRate: z.number()
        }),
        // This function executes when the AI recognizes it needs to emit a UI component
        generate: async function* ({ playerName, line, projectedKs, evPercentage, hitRate }) {
          yield <div>Calculating projections...</div>;
          
          return React.createElement(StrikeoutGaugeWidget, {
            playerName,
            line,
            projectedKs,
            evPercentage,
            hitRate
          });
        }
      }
    }
  });

  return ui.value;
}