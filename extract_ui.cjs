const fs = require('fs');
let c = fs.readFileSync('index.js', 'utf8');

console.log("--- renderTree ---");
console.log(c.substring(c.indexOf('function renderTree()'), c.indexOf("$(document).on('click', '.ct-node'")));

console.log("\\n--- preview panel ---");
console.log(c.substring(c.indexOf("$(document).on('click', '.ct-node'"), c.indexOf("function cloneChat(arr) {", c.indexOf("$(document).on('click', '.ct-node'"))));
