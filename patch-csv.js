const fs = require('fs');

const pathEnrichment = '/Users/devonjohnson/Documents/Claude/Projects/PropEdge/run-enrichment.js';
let code = fs.readFileSync(pathEnrichment, 'utf8');

const targetHeaders = `const headers = [
      'Name', 'Prop', 'Line', 'Team', 'Opponent',
      'Per_Min_Avg', 'Per_Min_L5', 'Per_Min_L10',
      'Variance', 'Confidence%', 'Samples',
      'Injury_Status', 'Injury_Multiplier',
      'Matchup_Rank', 'Matchup_Scalar', 'Expected_Minutes',
    ];

    const csv = [headers.join(',')];
    enrichedPlayers.forEach(p => {
      const row = [
        p.name, p.prop, p.line, p.team, p.opponent,
        p.perMinAvg, p.perMinL5, p.perMinL10,
        p.variance, p.confidence, p.samples,
        p.injuryStatus, p.injuryMultiplier,
        p.matchupRank, p.matchupScalar, p.expectedMinutes,
      ];`;

const replacementHeaders = `const headers = [
      'Name', 'Prop', 'Line', 'Team', 'Opponent',
      'Per_Min_Avg', 'Per_Min_L5', 'Per_Min_L10',
      'Per_Min_Home', 'Per_Min_Away',
      'Variance', 'Confidence%', 'Samples',
      'Injury_Status', 'Injury_Multiplier',
      'Matchup_Rank', 'Matchup_Scalar', 'Expected_Minutes',
    ];

    const csv = [headers.join(',')];
    enrichedPlayers.forEach(p => {
      const row = [
        p.name, p.prop, p.line, p.team, p.opponent,
        p.perMinAvg, p.perMinL5, p.perMinL10,
        p.perMinHome, p.perMinAway,
        p.variance, p.confidence, p.samples,
        p.injuryStatus, p.injuryMultiplier,
        p.matchupRank, p.matchupScalar, p.expectedMinutes,
      ];`;

if (code.includes(targetHeaders)) {
    code = code.replace(targetHeaders, replacementHeaders);
    fs.writeFileSync(pathEnrichment, code);
    console.log("✅ Patched run-enrichment.js CSV generation");
} else {
    console.log("⚠️ run-enrichment.js CSV target not found");
}
