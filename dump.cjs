const fs = require('fs');
let text = fs.readFileSync('index.js', 'utf8');
let start = text.indexOf('ct-jump-btn');
console.log(text.substring(start - 200, start + 2000));
