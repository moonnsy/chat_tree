const fs = require('fs');
let code = fs.readFileSync('index.js', 'utf8');

// Title
const titleOrig = '<span style="color: #4CAF50; font-weight: bold;">Предпросмотр сообщения</span>';
const titleNew = '<span style="color: #98FB98; font-weight: 600; font-family: Segoe UI, Tahoma, sans-serif; font-size: 18px; letter-spacing: 0.5px;">Предпросмотр сообщения</span>';
code = code.replace(titleOrig, titleNew);

// Jump button
const jumpOrig = '<button id="ct-jump-btn" style="flex:1; padding:10px; background:#4CAF50; color:#fff; border:none; border-radius:5px; cursor:pointer; font-weight:bold; display:none;">ПЕРЕПРЫГНУТЬ ДИОЛОГ СЮДА</button>';
const jumpNew = '<button id="ct-jump-btn" style="flex:1; padding:10px; background:#98FB98; color:#111; border:none; border-radius:5px; cursor:pointer; font-weight:bold; display:none; font-size:15px;">ПРЫЖОК</button>';
code = code.replace(jumpOrig, jumpNew);

// Delete button
const delOrig = '<button id="ct-delete-btn" style="flex:1; padding:10px; background:#f44336; color:#fff; border:none; border-radius:5px; cursor:pointer; font-weight:bold; display:none;">УДАЛИТЬ ВЕТКУ</button>';
const delNew = '<button id="ct-delete-btn" style="flex:1; padding:10px; background:#CD5C5C; color:#fff; border:none; border-radius:5px; cursor:pointer; font-weight:bold; display:none; font-size:15px;">УДАЛИТЬ</button>';
code = code.replace(delOrig, delNew);

fs.writeFileSync('index.js', code, 'utf8');
console.log('Fixed styling on popup panel!');
