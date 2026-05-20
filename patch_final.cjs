const fs = require('fs');
let code = fs.readFileSync('index.js', 'utf8');

const jumpBtnOrig = new RegExp('<button id="ct-jump-btn"[^>]*>.*?</button>');
// Use template string safely
const jumpBtnNew = '<button id="ct-jump-btn" data-id="${id}" style="flex:1; padding:10px; background:#8db7d5; color:#111; border:none; border-radius:5px; cursor:pointer; font-weight:bold; font-size:16px;">ПРЫЖОК</button>';
code = code.replace(jumpBtnOrig, jumpBtnNew);

const delBtnOrig = new RegExp('<button id="ct-delete-btn"[^>]*>.*?</button>');
const delBtnNew = '<button id="ct-delete-btn" data-id="${id}" style="flex:1; padding:10px; background:#CD5C5C; color:#fff; border:none; border-radius:5px; cursor:pointer; font-weight:bold; font-size:16px;">УДАЛИТЬ</button>';
code = code.replace(delBtnOrig, delBtnNew);

const titleOrig = new RegExp('<(span|h3)[^>]*>Предпросмотр сообщения</(span|h3)>');
const titleNew = '<span style="color:#8db7d5; font-family: \'Caveat\', cursive; font-size: 24px; font-weight: 600; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">Предпросмотр сообщения</span>';
code = code.replace(titleOrig, titleNew);

fs.writeFileSync('index.js', code, 'utf8');
console.log('Fixed buttons & title');
