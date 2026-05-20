const fs = require('fs');
let code = fs.readFileSync('index.js', 'utf8');

const newLogic = `        $('#ct-jump-btn').off('click').on('click', async function () {
            // Гарантируем, что текущая ветка надежно спрячется в branch_futures старого свайпа точки расхождения!
            let divergeIdx = -1;
            for (let i = 0; i < Math.min(coreChat.length, toRestore.length); i++) {
                let oldS = coreChat[i].swipe_id || 0;
                let newS = toRestore[i].swipe_id || 0;
                if (oldS !== newS || coreChat[i].mes !== toRestore[i].mes) {
                    divergeIdx = i;
                    break;
                }
            }
            if (divergeIdx === -1) {
                divergeIdx = Math.min(coreChat.length, toRestore.length);
            }

            if (divergeIdx >= 0 && divergeIdx < coreChat.length) {
                let parentIdx = Math.min(divergeIdx, toRestore.length - 1);
                let oldS = coreChat[parentIdx].swipe_id || 0;
                let lostFuture = coreChat.slice(parentIdx + 1);

                if (lostFuture.length > 0) {
                    if (!toRestore[parentIdx].branch_futures) toRestore[parentIdx].branch_futures = {};
                    if (!toRestore[parentIdx].branch_futures[oldS]) toRestore[parentIdx].branch_futures[oldS] = [];
                    
                    let existing = toRestore[parentIdx].branch_futures[oldS];
                    if (existing.length > 0 && !Array.isArray(existing[0])) {
                        existing = [existing];
                        toRestore[parentIdx].branch_futures[oldS] = existing;
                    }
                    existing.push(cloneChat(lostFuture));
                }
            }

            // Заменяем внутренний массив ядра in-place
            while (coreChat.length > 0) {
                coreChat.pop();
            }
            toRestore.forEach(m => coreChat.push(m));

            $('#chat-tree-modal').remove();

            // Теперь, когда мы точно изменяем корневой массив, мы дожидаемся сохранения памяти на диск
            if (typeof saveChatConditional === 'function') await saveChatConditional();
            if (typeof reloadCurrentChat === 'function') await reloadCurrentChat();
        });`;

const start = code.indexOf("$('#ct-jump-btn').off('click').on('click'");
const end = code.indexOf("if (typeof saveChatConditional === 'function') await saveChatConditional();", start) + 165; // Skip up to the end of the handler

if (start !== -1) {
    let before = code.substring(0, start);
    let afterStart = code.substring(start);
    let afterEndIndex = afterStart.indexOf('});') + 3;
    let after = afterStart.substring(afterEndIndex);
    
    code = before + newLogic + after;
    fs.writeFileSync('index.js', code, 'utf8');
    console.log("Patched jumpToState successfully!");
} else {
    console.log("Could not find start index");
}
