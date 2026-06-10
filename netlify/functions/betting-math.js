/**
 * Port of propedge-deploy/analyst/betting-math.reference.ts (gemini-code-1780208856151.ts)
 */

function parseAmericanOdds(americanOdds) {
  const raw = String(americanOdds ?? "").replace(/[^\d+\-.]/g, "");
  const n = parseFloat(raw);
  return Number.isFinite(n) && n !== 0 ? n : null;
}

function calculateImpliedProbability(americanOdds) {
  const n = typeof americanOdds === "number" ? americanOdds : parseAmericanOdds(americanOdds);
  if (n === null) return null;
  if (n < 0) {
    return Math.abs(n) / (Math.abs(n) + 100);
  }
  return 100 / (n + 100);
}

function calculateEdge(trueProbability, marketOdds) {
  const impliedProb = calculateImpliedProbability(marketOdds);
  if (impliedProb === null || !Number.isFinite(trueProbability)) return null;
  return Math.round((trueProbability - impliedProb) * 1000) / 10;
}

function calculateKellyAllocation(b, p, q) {
  if (!Number.isFinite(b) || b <= 0 || !Number.isFinite(p) || !Number.isFinite(q)) return 0;
  const allocation = (b * p - q) / b;
  return allocation > 0 ? Math.round(allocation * 1000) / 10 : 0;
}

function americanToDecimal(americanOdds) {
  const n = parseAmericanOdds(americanOdds);
  if (n === null) return null;
  if (n > 0) return 1 + n / 100;
  return 1 + 100 / Math.abs(n);
}

function kellyFromAmerican(trueProbability, americanOdds) {
  const dec = americanToDecimal(americanOdds);
  if (dec === null || !Number.isFinite(trueProbability)) return 0;
  const b = dec - 1;
  const p = trueProbability;
  const q = 1 - p;
  return calculateKellyAllocation(b, p, q);
}

function isPropEdgePayloadSanityValid(payload) {
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

module.exports = {
  parseAmericanOdds,
  calculateImpliedProbability,
  calculateEdge,
  calculateKellyAllocation,
  americanToDecimal,
  kellyFromAmerican,
  isPropEdgePayloadSanityValid,
};
