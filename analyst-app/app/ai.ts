import { createAI } from "@ai-sdk/rsc";
import {
  generateBetAnalysis,
  generateSlateEvAnalysis,
  generateTopStrikeoutAnalysis,
} from "@/app/actions/betting-analyst";

export type AIState = unknown[];
export type UIState = unknown[];

export const AI = createAI<AIState, UIState>({
  actions: {
    generateBetAnalysis,
    generateSlateEvAnalysis,
    generateTopStrikeoutAnalysis,
  },
  initialAIState: [],
  initialUIState: [],
});
