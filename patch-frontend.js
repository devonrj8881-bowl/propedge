const fs = require('fs');
const path = '/Users/devonjohnson/Documents/Claude/Projects/PropEdge/index.html';
let html = fs.readFileSync(path, 'utf8');

// Patch 1: True Probability Devig (Additive)
const targetDevig = `const impliedProb = rawImplied * 0.952;`;
const replacementDevig = `// PropEdge Devig Math (Additive Method) - Replaced fixed 0.952 with true proportional devig
        // Assuming symmetric -110 juice as baseline if opposing side isn't known yet
        const impliedProb = odds < 0 
          ? (rawImplied / (rawImplied + (100/(110+100))))
          : (rawImplied / (rawImplied + (110/(110+100))));`;

if (html.includes(targetDevig)) {
    html = html.replace(targetDevig, replacementDevig);
    console.log("✅ Patched Devig Math");
} else {
    console.log("⚠️ Devig math target not found");
}

// Patch 2: Add unit sizing to getPropConvictionSignal
const targetConvictionHTML = `return \`<span class="prop-badge conviction \${signal.cls}" title="\${escapeHTML(signal.title)}">\${signal.label}</span>\`;`;

const replacementConvictionHTML = `// Calculate Unit Size based on signal key
      let unit = '';
      if (signal.key === 'lock') unit = ' • 💰 2.0u';
      else if (signal.key === 'hammer') unit = ' • 💰 1.5u';
      else if (signal.key === 'go' || signal.key === 'play') unit = ' • 💰 1.0u';
      else if (signal.key === 'lean') unit = ' • 💰 0.5u';
      
      return \`<span class="prop-badge conviction \${signal.cls}" title="\${escapeHTML(signal.title)}">\${signal.label}\${unit}</span>\`;`;

if (html.includes(targetConvictionHTML)) {
    html = html.replace(targetConvictionHTML, replacementConvictionHTML);
    console.log("✅ Patched Unit Sizing HTML");
} else {
    console.log("⚠️ Conviction HTML target not found");
}

fs.writeFileSync(path, html);
console.log("✅ index.html updated");
