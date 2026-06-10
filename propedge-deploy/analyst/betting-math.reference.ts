// utils/bettingMath.ts

export interface MarketOdds {
  overOdds: number;
  underOdds: number;
  line: number;
}

/**
 * Converts American odds into implied probability percentage.
 */
export function calculateImpliedProbability(americanOdds: number): number {
  if (americanOdds < 0) {
    return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
  }
  return 100 / (americanOdds + 100);
}

/**
 * Your custom logic calculation to determine the exact +EV edge percentage.
 */
export function calculateEdge(trueProbability: number, marketOdds: number): number {
  const impliedProb = calculateImpliedProbability(marketOdds);
  // Returns raw percentage edge (e.g., 5.4 for a 5.4% edge)
  return Math.round((trueProbability - impliedProb) * 1000) / 10;
}

/**
 * Optional: Custom calculation for fractional unit bankroll allocation
 */
export function calculateKellyAllocation(b: number, p: number, q: number): number {
  // Kelly Criterion formula: f* = (bp - q) / b
  // b = decimal odds minus 1, p = true probability, q = true loss probability
  const allocation = (b * p - q) / b;
  return allocation > 0 ? Math.round(allocation * 1000) / 10 : 0;
}