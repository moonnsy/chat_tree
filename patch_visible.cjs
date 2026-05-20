const fs = require('fs');
let code = fs.readFileSync('index.js', 'utf8');

// The replacement I made hardcoded `display:none;` into the button style!
// Let's remove `display:none; ` from those two exact strings.

// Jump
const jumpOld = '<button id="ct-jump-btn" style="flex:1; padding:10px; background:#8db7d5; color:#111; border:none; border-radius:5px; cursor:pointer; font-weight:bold; display:none; font-size:15px;">ПРЫЖОК</button>';
const jumpNew = '<button id="ct-jump-btn" style="flex:1; padding:10px; background:#8db7d5; color:#111; border:none; border-radius:5px; cursor:pointer; font-weight:bold; font-size:15px;">ПРЫЖОК</button>';
code = code.replace(jumpOld, jumpNew);

// Delete
const delOld = '<button id="ct-delete-btn" style="flex:1; padding:10px; background:#CD5C5C; color:#fff; border:none; border-radius:5px; cursor:pointer; font-weight:bold; display:none; font-size:15px;">УДАЛИТЬ</button>';
const delNew = '<button id="ct-delete-btn" style="flex:1; padding:10px; background:#CD5C5C; color:#fff; border:none; border-radius:5px; cursor:pointer; font-weight:bold; font-size:15px;">УДАЛИТЬ</button>';
code = code.replace(delOld, delNew);

fs.writeFileSync('index.js', code, 'utf8');
console.log('Buttons are VISIBLE again!');
