const fs = require('fs');
const pathIndex = '/Users/devonjohnson/Documents/Claude/Projects/PropEdge/index.html';
let html = fs.readFileSync(pathIndex, 'utf8');

// 1. Remove the broken block that is too early
const brokenBlock = `// MULTI-BOOK BEST ODDS (Priority 1)
        let bestOdds = odds; // Fallback to whatever 'odds' column is
        let bestBook = 'FD';
        if (dkLineSheet && fdLineSheet) {
            if (dkLineSheet > fdLineSheet) {
                bestOdds = dkLineSheet;
                bestBook = 'DK';
            } else if (fdLineSheet > dkLineSheet) {
                bestOdds = fdLineSheet;
                bestBook = 'FD';
            }
        } else if (dkLineSheet && dkLineSheet > odds) {
            bestOdds = dkLineSheet;
            bestBook = 'DK';
        } else if (fdLineSheet && fdLineSheet > odds) {
            bestOdds = fdLineSheet;
            bestBook = 'FD';
        }
        
        // Re-calculate rawImplied with the best available odds
        const rawImplied = bestOdds < 0 ? Math.abs(bestOdds) / (Math.abs(bestOdds) + 100) : 100 / (bestOdds + 100);
        `;

if (html.includes(brokenBlock)) {
    html = html.replace(brokenBlock, "");
    console.log("✅ Removed broken initialization block");
} else {
    console.log("⚠️ Broken block not found");
}

// 2. Add it back right after odds is declared
const oddsDeclaration = `const odds = parseInt(oddsStr.replace(/[^0-9\\-]/g, '')) || -110;`;
const fixedBlock = `const odds = parseInt(oddsStr.replace(/[^0-9\\-]/g, '')) || -110;
        
        // MULTI-BOOK BEST ODDS (Priority 1)
        let bestOdds = odds;
        let bestBook = 'FD';
        if (dkLineSheet && fdLineSheet) {
            if (dkLineSheet > fdLineSheet) { bestOdds = dkLineSheet; bestBook = 'DK'; }
            else if (fdLineSheet > dkLineSheet) { bestOdds = fdLineSheet; bestBook = 'FD'; }
        } else if (dkLineSheet && dkLineSheet > odds) { bestOdds = dkLineSheet; bestBook = 'DK'; }
        else if (fdLineSheet && fdLineSheet > odds) { bestOdds = fdLineSheet; bestBook = 'FD'; }
        
        const rawImplied = bestOdds < 0 ? Math.abs(bestOdds) / (Math.abs(bestOdds) + 100) : 100 / (bestOdds + 100);
        `;

if (html.includes(oddsDeclaration)) {
    html = html.replace(oddsDeclaration, fixedBlock);
    console.log("✅ Inserted fixed block at correct location");
} else {
    console.log("⚠️ Odds declaration not found");
}

// 3. Fix the "already declared" replacement error I made earlier
const oldComment = `// rawImplied already calculated using bestOdds above`;
const newComment = `// rawImplied properly calculated above with best odds`;

if (html.includes(oldComment)) {
    html = html.replace(oldComment, newComment);
}

fs.writeFileSync(pathIndex, html);
