const fs = require('fs');
let code = fs.readFileSync('index.js', 'utf8');

let idx = code.indexOf('Предпросмотр сообщения');
if (idx !== -1) {
    console.log(code.substring(idx - 200, idx + 1000));
} else {
    console.log('Not found');
}
