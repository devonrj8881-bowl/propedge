export function parseAmericanOdds(americanOdds: unknown): number | null {
  const raw = String(americanOdds ?? "").replace(/[^\d+\-.]/g, "");
  const n = parseFloat(raw);
  return Number.isFinite(n) && n !== 0 ? n : null;
}

export function calculateImpliedProbability(americanOdds: unknown): number | null {
  const n = typeof americanOdds === "number" ? americanOdds : parseAmericanOdds(americanOdds);
  if (n === null) return null;
  if (n < 0) return Math.abs(n) / (Math.abs(n) + 100);
  return 100 / (n + 100);
}

export function calculateEdge(trueProbability: number, marketOdds: unknown): number | null {
  const impliedProb = calculateImpliedProbability(marketOdds);
  if (impliedProb === null || !Number.isFinite(trueProbability)) return null;
  return Math.round((trueProbability - impliedProb) * 1000) / 10;
}

export function kellyFromAmerican(trueProbability: number, americanOdds: unknown): number {
  const n = parseAmericanOdds(americanOdds);
  if (n === null || !Number.isFinite(trueProbability)) return 0;
  const dec = n > 0 ? 1 + n / 100 : 1 + 100 / Math.abs(n);
  const b = dec - 1;
  const p = trueProbability;
  const q = 1 - p;
  if (!Number.isFinite(b) || b <= 0) return 0;
  const allocation = (b * p - q) / b;
  return allocation > 0 ? Math.round(allocation * 1000) / 10 : 0;
}

export function isPropEdgePayloadSanityValid(payload: {
  market?: { implied_probability?: number | null; line?: number | null; prop_type?: string | null };
  analytics?: { ev_percentage?: number | null };
} | null): boolean {
  if (!payload) return false;
  const impl = payload.market?.implied_probability;
  if (impl != null && (impl < 0.01 || impl > 0.99)) return false;
  const ev = payload.analytics?.ev_percentage;
  if (ev != null && Math.abs(ev) > 30) return false;
  const line = payload.market?.line;
  const type = String(payload.market?.prop_type || "").toLowerCase();
  if (line != null && /strikeout|strike out|\bk\b|\bks\b|pitcher strikeouts/.test(type)) {
    if (line > 15 || line < 0.5) return false;
  }
  return true;
}
