const fs = require('fs');

const pathEnrichment = '/Users/devonjohnson/Documents/Claude/Projects/PropEdge/run-enrichment.js';
let code = fs.readFileSync(pathEnrichment, 'utf8');

const targetMetrics = `const l10Avg = validGames.length >= 10
    ? rates.slice(0, 10).reduce((a, b) => a + b, 0) / 10
    : allAvg;`;

const replacementMetrics = `const l10Avg = validGames.length >= 10
    ? rates.slice(0, 10).reduce((a, b) => a + b, 0) / 10
    : allAvg;

  // HOME/AWAY SPLITS
  const homeGames = validGames.filter(g => g.isHome);
  const awayGames = validGames.filter(g => !g.isHome);
  
  const homeRates = homeGames.map(g => g[minutesKey] > 0 ? (g[statKey] / g[minutesKey]) : 0);
  const awayRates = awayGames.map(g => g[minutesKey] > 0 ? (g[statKey] / g[minutesKey]) : 0);
  
  const perMinHome = homeRates.length > 0 ? homeRates.reduce((a, b) => a + b, 0) / homeRates.length : allAvg;
  const perMinAway = awayRates.length > 0 ? awayRates.reduce((a, b) => a + b, 0) / awayRates.length : allAvg;`;

const targetReturn = `return {
    perMinAvg: parseFloat(allAvg.toFixed(4)),
    perMinL5: parseFloat(l5Avg.toFixed(4)),
    perMinL10: parseFloat(l10Avg.toFixed(4)),
    variance: parseFloat(variance.toFixed(4)),
    confidence,
    samples: validGames.length,
  };`;

const replacementReturn = `return {
    perMinAvg: parseFloat(allAvg.toFixed(4)),
    perMinL5: parseFloat(l5Avg.toFixed(4)),
    perMinL10: parseFloat(l10Avg.toFixed(4)),
    perMinHome: parseFloat(perMinHome.toFixed(4)),
    perMinAway: parseFloat(perMinAway.toFixed(4)),
    variance: parseFloat(variance.toFixed(4)),
    confidence,
    samples: validGames.length,
  };`;

if (code.includes(targetMetrics) && code.includes(targetReturn)) {
    code = code.replace(targetMetrics, replacementMetrics).replace(targetReturn, replacementReturn);
    fs.writeFileSync(pathEnrichment, code);
    console.log("✅ Patched run-enrichment.js with Home/Away metrics");
} else {
    console.log("⚠️ run-enrichment.js targets not found");
}
