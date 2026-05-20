const fs = require('fs');
let code = fs.readFileSync('index.js', 'utf8');
let match;
let regex = /id="ct-jump-btn"/g;
while ((match = regex.exec(code)) !== null) {
    console.log("MATCH AT: " + match.index);
    console.log(code.substring(match.index - 50, match.index + 250));
    console.log("-------------------");
}
