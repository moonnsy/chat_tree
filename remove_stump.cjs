const fs = require('fs');
let code = fs.readFileSync('index.js', 'utf8');

const target = `
        if (!isLocalSwipeActive && childrenPaths.length === 0) {
            continue;
        }`;

if (code.indexOf(target) !== -1) {
    code = code.replace(target, '');
    fs.writeFileSync('index.js', code, 'utf8');
    console.log('Removed stump filter!');
} else {
    // fallback with simple replace
    const target2 = `        if (!isLocalSwipeActive && childrenPaths.length === 0) {\n            continue;\n        }`;
    if (code.indexOf(target2) !== -1) {
        code = code.replace(target2, '');
        fs.writeFileSync('index.js', code, 'utf8');
        console.log('Removed stump filter via fallback!');
    } else {
        console.log('Could not find stump filter');
    }
}
