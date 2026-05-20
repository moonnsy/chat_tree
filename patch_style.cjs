const fs = require('fs');
let code = fs.readFileSync('index.js', 'utf8');

const pairs = [
    [
        '<h3 style="margin-top:0; color:#00ff80;">Предпросмотр сообщения</h3>',
        '<h3 style="margin-top:0; color:#98FB98; font-family: Segoe UI, Tahoma, Geneva, Verdana, sans-serif; font-size: 18px; letter-spacing: 0.5px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">Предпросмотр сообщения</h3>'
    ],
    [
        'background:#00ff80; color:#000; border:none; border-radius:5px; cursor:pointer; font-weight:bold;">ПЕРЕПРЫГНУТЬ ДИАЛОГ СЮДА</button>',
        'background:#98FB98; color:#111; border:none; border-radius:5px; cursor:pointer; font-weight:bold;">ПЕРЕПРЫГНУТЬ ДИАЛОГ СЮДА</button>'
    ],
];

pairs.forEach(p => {
    code = code.replace(p[0], p[1]);
});

// 2. Buttons in preview panel
let jumpOrig = 'background:#00ff80; color:#000; border:none; border-radius:5px; cursor:pointer; font-weight:bold;">ПЕРЕПРЫГНУТЬ ДИАЛОГ СЮДА</button>';
let jumpNew = 'background:#98FB98; color:#111; border:none; border-radius:5px; cursor:pointer; font-weight:bold;">ПЕРЕПРЫГНУТЬ ДИАЛОГ СЮДА</button>';
code = code.replace(jumpOrig, jumpNew);

let delOrig = 'background:#ff4040; color:#fff; border:none; border-radius:5px; cursor:pointer; font-weight:bold;">УДАЛИТЬ ВЕТКУ</button>';
let delNew = 'background:#FF9AA2; color:#111; border:none; border-radius:5px; cursor:pointer; font-weight:bold;">УДАЛИТЬ ВЕТКУ</button>';
code = code.replace(delOrig, delNew);

// 3. Header panel flexbox
let searchStart = code.indexOf('<!-- Поиск по словам -->');
let searchEnd = code.indexOf('</div>', searchStart) + 6;

if (searchStart !== -1 && searchEnd !== -1) {
    let newHeader = '            <!-- Верхняя панель (Поиск + Закрыть) -->' + '\n' +
        '            <div style="position: absolute; top: 10px; left: 10px; right: 10px; display: flex; justify-content: center; align-items: center; gap: 10px; z-index: 1000;">' + '\n' +
        '                <input id="ct-search-input" type="text" placeholder="Поиск по тексту узлов..." autocomplete="off" style="flex: 1; max-width: 500px; padding: 12px; border-radius: 8px; background: #1a1a1a; color: #fff; border: 1px solid #444; font-size: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">' + '\n' +
        '                <button id="ct-close-btn" style="font-size:32px; font-weight:300; background:none; border:none; color:#fff; cursor:pointer; padding: 0 10px; line-height: 1;">&times;</button>' + '\n' +
        '            </div>';
    code = code.substring(0, searchStart) + newHeader + code.substring(searchEnd);
}

// Remove the old lone close button
let closeBtnStart = code.lastIndexOf('<button id="ct-close-btn"');
if (closeBtnStart !== -1) {
    let closeBtnEnd = code.indexOf('</button>', closeBtnStart) + 9;
    code = code.substring(0, closeBtnStart) + code.substring(closeBtnEnd);
}

fs.writeFileSync('index.js', code, 'utf8');
console.log('Fixed styles perfectly!');
