const fs = require('fs');
let code = fs.readFileSync('index.js', 'utf8');

// Title
const titleOrig = '<span style="color: #8db7d5; font-family: \'Caveat\', cursive; font-weight: bold; font-size: 22px;">Предпросмотр сообщения</span>';
const titleNew = '<span style="color: #8db7d5; font-family: \'Caveat\', cursive; font-weight: 600; font-size: 22px; letter-spacing: 0.5px;">Предпросмотр сообщения</span>';
code = code.replace(titleOrig, titleNew);

// Jump button
const jumpOrig = '<button id="ct-jump-btn" style="flex:1; padding:10px; background:#4CAF50; color:#fff; border:none; border-radius:5px; cursor:pointer; font-weight:bold; display:none;">ПЕРЕПРЫГНУТЬ ДИОЛОГ СЮДА</button>';
const jumpNew = '<button id="ct-jump-btn" style="flex:1; padding:10px; background:#8db7d5; color:#111; border:none; border-radius:5px; cursor:pointer; font-weight:bold; display:none; font-size:15px;">ПРЫЖОК</button>';
code = code.replace(jumpOrig, jumpNew);

// Delete button
const delOrig = '<button id="ct-delete-btn" style="flex:1; padding:10px; background:#f44336; color:#fff; border:none; border-radius:5px; cursor:pointer; font-weight:bold; display:none;">УДАЛИТЬ ВЕТКУ</button>';
const delNew = '<button id="ct-delete-btn" style="flex:1; padding:10px; background:#CD5C5C; color:#fff; border:none; border-radius:5px; cursor:pointer; font-weight:bold; display:none; font-size:15px;">УДАЛИТЬ</button>';
code = code.replace(delOrig, delNew);

fs.writeFileSync('index.js', code, 'utf8');
console.log('Fixed styling on popup panel!');
