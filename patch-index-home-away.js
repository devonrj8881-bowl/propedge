const fs = require('fs');

const pathIndex = '/Users/devonjohnson/Documents/Claude/Projects/PropEdge/index.html';
let html = fs.readFileSync(pathIndex, 'utf8');

const targetCols = `per_min_avg: headers.findIndex(h => h && h.toLowerCase().includes('l10 per-min')),
        per_min_l5: headers.findIndex(h => h && h.toLowerCase().includes('l5') && h.toLowerCase().includes('per-min')),
        per_min_l10: headers.findIndex(h => h && h.toLowerCase().includes('l10') && h.toLowerCase().includes('per-min')),`;

const replacementCols = `per_min_avg: headers.findIndex(h => h && h.toLowerCase().includes('l10 per-min')),
        per_min_l5: headers.findIndex(h => h && h.toLowerCase().includes('l5') && h.toLowerCase().includes('per-min')),
        per_min_l10: headers.findIndex(h => h && h.toLowerCase().includes('l10') && h.toLowerCase().includes('per-min')),
        per_min_home: headers.findIndex(h => h && h.toLowerCase().includes('per_min_home')),
        per_min_away: headers.findIndex(h => h && h.toLowerCase().includes('per_min_away')),`;

if (html.includes(targetCols)) {
    html = html.replace(targetCols, replacementCols);
    console.log("✅ Patched index.html columns");
} else {
    console.log("⚠️ cols target not found");
}

const targetProps = `const perMinL10 = parseFloat(getValue(cols.per_min_l10)) || 0;`;
const replacementProps = `const perMinL10 = parseFloat(getValue(cols.per_min_l10)) || 0;
        const perMinHome = parseFloat(getValue(cols.per_min_home)) || 0;
        const perMinAway = parseFloat(getValue(cols.per_min_away)) || 0;`;

if (html.includes(targetProps)) {
    html = html.replace(targetProps, replacementProps);
    console.log("✅ Patched index.html prop extraction");
} else {
    console.log("⚠️ prop extraction target not found");
}

const targetScore = `// 4. Stat-Type Variance Filter (Risk Mitigation)`;
const replacementScore = `// 3.5 Home/Away Split Modifier (Priority 6)
        if (gameLoc === 'home' && perMinHome > 0 && perMinL10 > 0 && (perMinHome - perMinL10)/perMinL10 >= 0.15) {
            modelScore += 6;
            propFactors.push('🏠 Elite Home Court Split');
        } else if (gameLoc === 'away' && perMinAway > 0 && perMinL10 > 0 && (perMinAway - perMinL10)/perMinL10 >= 0.15) {
            modelScore += 6;
            propFactors.push('✈️ Road Warrior Split');
        } else if (gameLoc === 'home' && perMinHome > 0 && perMinL10 > 0 && (perMinL10 - perMinHome)/perMinL10 >= 0.20) {
            modelScore -= 6;
            propFactors.push('⚠️ Negative Home Split');
        }

        // 4. Stat-Type Variance Filter (Risk Mitigation)`;

if (html.includes(targetScore)) {
    html = html.replace(targetScore, replacementScore);
    console.log("✅ Patched index.html score logic");
} else {
    console.log("⚠️ score logic target not found");
}

fs.writeFileSync(pathIndex, html);
