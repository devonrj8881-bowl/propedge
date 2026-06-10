const fs = require('fs');
const pathIndex = '/Users/devonjohnson/Documents/Claude/Projects/PropEdge/index.html';
let html = fs.readFileSync(pathIndex, 'utf8');

// Replace the duplicate const with a block or let, or just overwrite the later one
const targetDupe = `const rawImplied = odds < 0 ? Math.abs(odds) / (Math.abs(odds) + 100) : 100 / (odds + 100);`;
const replacementFix = `// rawImplied already calculated using bestOdds above`;

if (html.includes(targetDupe)) {
    html = html.replace(targetDupe, replacementFix);
    fs.writeFileSync(pathIndex, html);
    console.log("✅ Fixed duplicate rawImplied declaration");
} else {
    console.log("⚠️ duplicate rawImplied not found");
}
