const fs = require('fs');
let code = fs.readFileSync('index.js', 'utf8');

// 1. Jump button
let jumpStart = code.indexOf('<button id="ct-jump-btn"');
// Ensure it's not the one we already replaced correctly (the dynamic one)
// Wait, we WANT to replace the CT-PREVIEW-PANEL one, not the old ones.
// Let's find the one inside ct-preview-panel!
let panelStart = code.indexOf('id="ct-preview-panel"');

if (panelStart !== -1) {
    let jumpStart = code.indexOf('<button id="ct-jump-btn"', panelStart);
    if (jumpStart !== -1) {
        let jumpEnd = code.indexOf('</button>', jumpStart) + 9;
        const jumpNew = '<button id="ct-jump-btn" style="flex:1; padding:10px; background:#98FB98; color:#111; border:none; border-radius:5px; cursor:pointer; font-weight:bold; display:none; font-size:15px;">ПРЫЖОК</button>';
        code = code.substring(0, jumpStart) + jumpNew + code.substring(jumpEnd);
    }
    
    let delStart = code.indexOf('<button id="ct-delete-btn"', panelStart);
    if (delStart !== -1) {
        let delEnd = code.indexOf('</button>', delStart) + 9;
        const delNew = '<button id="ct-delete-btn" style="flex:1; padding:10px; background:#CD5C5C; color:#fff; border:none; border-radius:5px; cursor:pointer; font-weight:bold; display:none; font-size:15px;">УДАЛИТЬ</button>';
        code = code.substring(0, delStart) + delNew + code.substring(delEnd);
    }
    
    let titleStart = code.indexOf('<span style="color: #4CAF50;', panelStart);
    if (titleStart !== -1) {
        let titleEnd = code.indexOf('</span>', titleStart) + 7;
        const titleNew = '<span style="color: #98FB98; font-weight: 600; font-family: Segoe UI, Tahoma, sans-serif; font-size: 18px; letter-spacing: 0.5px;">Предпросмотр сообщения</span>';
        code = code.substring(0, titleStart) + titleNew + code.substring(titleEnd);
    }
}

fs.writeFileSync('index.js', code, 'utf8');
console.log('Fixed multiline buttons reliably!');
