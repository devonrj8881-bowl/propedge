const fs = require('fs');
const pathIndex = '/Users/devonjohnson/Documents/Claude/Projects/PropEdge/index.html';
let html = fs.readFileSync(pathIndex, 'utf8');

const targetProps = `const dkLineSheet = parseFloat(getValue(cols.dk_line)) || null;
        const fdLineSheet = parseFloat(getValue(cols.fd_line_live)) || null;`;

const replacementProps = `const dkLineSheet = parseFloat(getValue(cols.dk_line)) || null;
        const fdLineSheet = parseFloat(getValue(cols.fd_line_live)) || null;
        
        // MULTI-BOOK BEST ODDS (Priority 1)
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

if (html.includes(targetProps)) {
    html = html.replace(targetProps, replacementProps);
    console.log("✅ Patched index.html multi-book extraction");
} else {
    console.log("⚠️ multi-book extraction target not found");
}

fs.writeFileSync(pathIndex, html);
