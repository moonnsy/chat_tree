const fs = require('fs');
let code = fs.readFileSync('index.js', 'utf8');

const newGetAvatar = `function getAvatar(isUser, msgName) {
    const context = getContext();
    let src = '';
    
    if (isUser) {
        src = $('.mes[is_user="true"] .avatar img').attr('src');
        if (!src) {
            src = $('#user_avatar').attr('src') || '/img/user-default.png';
        }
    } else {
        if (msgName) {
            let safeName = String(msgName).replace(/"/g, '\\\\\"');
            src = $(\`.mes[ch_name="\${safeName}"] .avatar img\`).first().attr('src');
        }
        
        if (!src && msgName) {
            if (context.characters) {
                let chars = Array.isArray(context.characters) ? context.characters : Object.values(context.characters);
                let found = chars.find(c => c && String(c.name).trim() === String(msgName).trim());
                if (found && found.avatar) {
                    src = '/characters/' + found.avatar;
                }
            }
        }
        
        if (!src) {
            let charId = context.characterId;
            if (charId !== undefined && context.characters && context.characters[charId]) {
                src = \`/characters/\${context.characters[charId].avatar}\`;
            } else {
                src = '/img/logo.png';
            }
        }
    }
    return \`background-image: url('\${src}');\`;
}

function escapeHtml(text)`;

const newJump = `        $('#ct-jump-btn').off('click').on('click', async function () {
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
                let parentIdx = divergeIdx;
                let lostStart = divergeIdx + 1;
                
                if (!toRestore[divergeIdx] || !coreChat[divergeIdx]) {
                    parentIdx = divergeIdx - 1;
                    lostStart = divergeIdx;
                } else {
                    let rSwipes = toRestore[divergeIdx].swipes || [toRestore[divergeIdx].mes];
                    let cSwipes = coreChat[divergeIdx].swipes || [coreChat[divergeIdx].mes];
                    
                    let isSameMessage = rSwipes.includes(coreChat[divergeIdx].mes) || cSwipes.includes(toRestore[divergeIdx].mes);
                    
                    if (!isSameMessage) {
                        parentIdx = divergeIdx - 1;
                        lostStart = divergeIdx;
                    }
                }
                
                if (parentIdx >= 0) {
                    let oldS = coreChat[parentIdx].swipe_id || 0;
                    let lostFuture = coreChat.slice(lostStart);
                    
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
            }

            // Заменяем внутренний массив ядра in-place
            while (coreChat.length > 0) {`;

// Patch getAvatar
let avStart = code.indexOf('function getAvatar(isUser, msgName) {');
let avEnd = code.indexOf('function escapeHtml(text)');
if (avStart !== -1 && avEnd !== -1) {
    code = code.substring(0, avStart) + newGetAvatar + code.substring(avEnd + 25);
}

// Patch jumpToState
let jumpStart = code.indexOf("$('#ct-jump-btn').off('click').on('click'");
let oldWhileStart = code.lastIndexOf("while (coreChat.length > 0) {");

if (jumpStart !== -1 && oldWhileStart !== -1) {
    // We replace from jumpStart to the end of the old while{ line
    code = code.substring(0, jumpStart) + newJump + code.substring(oldWhileStart + 29);
}

fs.writeFileSync('index.js', code, 'utf8');
console.log('Fixed index.js completely 2');
