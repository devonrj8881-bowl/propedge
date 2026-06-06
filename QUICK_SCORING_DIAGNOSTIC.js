// Quick Diagnostic: Copy this into browser console to identify scoring issues
// Run this while viewing the PropEdge app

console.log('%c🔍 PropEdge Scoring Diagnostic', 'font-size: 16px; font-weight: bold; color: #0066cc;');

// 1. Find all props with score >= 90
const highScorers = (state.props || [])
  .filter(p => {
    const score = p.modelScore + (p.confidence || 0) / 25 + (p.l5Pct || 0) / 50;
    return score >= 90;
  })
  .sort((a, b) => {
    const scoreA = a.modelScore + (a.confidence || 0) / 25 + (a.l5Pct || 0) / 50;
    const scoreB = b.modelScore + (b.confidence || 0) / 25 + (b.l5Pct || 0) / 50;
    return scoreB - scoreA;
  })
  .slice(0, 20); // Top 20

console.log(`\n📊 Top 20 High-Scored Picks (Score >= 90):`);
console.table(highScorers.map(p => ({
  'Player': p.playerName || p.name || 'Unknown',
  'Prop': p.propType,
  'Line': p.line,
  'Model Score': Math.round(p.modelScore),
  'L5%': p.l5Pct,
  'L10%': p.l10Pct,
  'Pitcher ERA': p.h2h || 'N/A',
  'Days Rest': p.daysRest || 'N/A'
})));

// 2. Search for Michael Busch specifically
const busch = (state.props || []).find(p =>
  (p.playerName || p.name || '').toLowerCase().includes('busch') &&
  (p.propType || '').toLowerCase().includes('hits')
);

if (busch) {
  console.log('%c\n🎯 Michael Busch Hits Prop Details:', 'font-weight: bold; color: #ff6600;');
  console.log({
    Player: busch.playerName || busch.name,
    PropType: busch.propType,
    Line: busch.line,
    ModelScore: busch.modelScore,
    Confidence: busch.confidence,
    L5Pct: busch.l5Pct,
    L10Pct: busch.l10Pct,
    L5Avg: busch.l5Avg,
    Season: busch.seasonPct,
    H2H: busch.h2h,
    PitcherInfo: busch.oppDetails,
    DaysRest: busch.daysRest,
    TeamAbbr: busch.teamAbbr,
    OpponentAbbr: busch.oppAbbr,
    Spread: busch.spread,
    GameTotal: busch.total
  });
} else {
  console.log('⚠️ Michael Busch (Hits) not found in current props');
}

// 3. Analyze hit rate by league
const byLeague = {};
(state.props || []).forEach(p => {
  const league = p.league || 'Unknown';
  if (!byLeague[league]) byLeague[league] = { count: 0, names: [] };
  byLeague[league].count++;
  byLeague[league].names.push(p.playerName || p.name);
});

console.log('\n📈 Props by League:');
console.table(byLeague);

// 4. Check if pitcher ERA is being parsed
const mlbProps = (state.props || []).filter(p => p.league === 'MLB');
const withERA = mlbProps.filter(p => {
  const h2h = (p.h2h || '').toLowerCase();
  return /era\s*[:<]\s*([\d.]+)/.test(h2h);
});

console.log(`\n⚾ MLB Props Pitcher ERA Parsing:`);
console.log(`   Total MLB Props: ${mlbProps.length}`);
console.log(`   With ERA Info: ${withERA.length} (${Math.round(withERA.length / mlbProps.length * 100)}%)`);
console.log(`   ⚠️ Missing ERA: ${mlbProps.length - withERA.length}`);

// 5. Export raw data for analysis
console.log('\n💾 Raw Export (paste into analysis tool):');
console.log(JSON.stringify({
  highScorers: highScorers.map(p => ({
    name: p.playerName || p.name,
    propType: p.propType,
    line: p.line,
    modelScore: p.modelScore,
    l5Pct: p.l5Pct,
    l10Pct: p.l10Pct,
    l5Avg: p.l5Avg,
    seasonPct: p.seasonPct,
    confidence: p.confidence,
    h2h: p.h2h,
    daysRest: p.daysRest,
    league: p.league
  })),
  busch: busch ? {
    name: busch.playerName || busch.name,
    propType: busch.propType,
    line: busch.line,
    modelScore: busch.modelScore,
    l5Pct: busch.l5Pct,
    l10Pct: busch.l10Pct,
    l5Avg: busch.l5Avg,
    h2h: busch.h2h,
    daysRest: busch.daysRest
  } : null,
  mlbParsingStats: {
    totalMlbProps: mlbProps.length,
    withERA: withERA.length,
    eraParsingRate: `${Math.round(withERA.length / mlbProps.length * 100)}%`
  }
}, null, 2));
