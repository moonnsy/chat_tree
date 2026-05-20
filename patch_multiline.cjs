const fs = require('fs');
let code = fs.readFileSync('index.js', 'utf8');

// The magical regex that matches across newlines!
const jumpBtnOrig = /<button id="ct-jump-btn"[\\s\\S]*?<\\/button >/;
const jumpBtnNew = '<button id="ct-jump-btn" style="flex:1; padding:10px; background:#98FB98; color:#111; border:none; border-radius:5px; cursor:pointer; font-weight:bold; display:none; font-size:15px;">ПРЫЖОК</button>';
code = code.replace(jumpBtnOrig, jumpBtnNew);

const delBtnOrig = /<button id="ct-delete-btn"[\\s\\S]*?<\\/button >/;
const delBtnNew = '<button id="ct-delete-btn" style="flex:1; padding:10px; background:#CD5C5C; color:#fff; border:none; border-radius:5px; cursor:pointer; font-weight:bold; display:none; font-size:15px;">УДАЛИТЬ</button>';
code = code.replace(delBtnOrig, delBtnNew);

const titleOrig = /<span style="color: #4CAF50; font-weight: bold;">Предпросмотр сообщения<\\/span >/;
const titleNew = '<span style="color: #98FB98; font-weight: 600; font-family: Segoe UI, Tahoma, sans-serif; font-size: 18px; letter-spacing: 0.5px;">Предпросмотр сообщения</span>';
code = code.replace(titleOrig, titleNew);

fs.writeFileSync('index.js', code, 'utf8');
console.log('Successfully replaced multiline buttons!');
