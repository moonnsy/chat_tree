const fs = require('fs');
let code = fs.readFileSync('index.js', 'utf8');
let idx = code.indexOf('id="ct-preview-panel"');
console.log(code.substring(idx - 100, idx + 2000));
