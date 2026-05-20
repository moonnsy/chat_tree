import { getContext } from '../../../extensions.js';
import { eventSource, event_types, reloadCurrentChat, chat as coreChat, saveChatConditional } from '../../../../script.js';

let shadowChat = [];
let activeSwipes = {};
let isBusy = false;
let syncTimer = null;

function cloneChat(chatArray) {
    if (!chatArray) return [];
    return chatArray.map(m => {
        if (!m) return m;
        let cloned = { ...m };
        if (m.swipes) cloned.swipes = [...m.swipes];
        if (m.branch_futures) cloned.branch_futures = JSON.parse(JSON.stringify(m.branch_futures));
        return cloned;
    });
}

function cloneMessageWithSwipe(msg, s) {
    if (!msg) return msg;
    let cloned = { ...msg };
    if (msg.swipes) cloned.swipes = [...msg.swipes];
    cloned.swipe_id = s;
    cloned.mes = msg.swipes ? msg.swipes[s] : msg.mes;
    if (msg.branch_futures) cloned.branch_futures = JSON.parse(JSON.stringify(msg.branch_futures));
    return cloned;
}

function isPathDuplicate(pathA, pathB) {
    if (!pathA || !pathB) return false;
    if (pathA.length !== pathB.length) return false;
    for (let i = 0; i < pathA.length; i++) {
        let a = pathA[i], b = pathB[i];
        if (!a || !b) {
            if (a !== b) return false;
            continue;
        }
        if (a.mes !== b.mes || a.is_user !== b.is_user) return false;
    }
    return true;
}

function msgFingerprint(m) {
    if (!m) return "";
    let text = (m.swipes && m.swipes.length > 0 ? m.swipes[0] : m.mes) || "";
    return text;
}

function isGhost(m) {
    if (!m) return true;
    if (m.mes && m.mes.trim() !== '') return false;
    if (m.swipes && m.swipes.some(s => s && s.trim() !== '')) return false;
    return true;
}

function buildRestoreArray(stack) {
    if (!stack) return [];
    return stack.map(item => cloneMessageWithSwipe(item.msg, item.swipeId));
}

async function deleteBranchTarget(toRestore) {
    if (!toRestore || toRestore.length === 0) return;

    let divergeIdx = -1;
    for (let i = 0; i < Math.min(coreChat.length, toRestore.length); i++) {
        if (coreChat[i].mes !== toRestore[i].mes || coreChat[i].is_user !== toRestore[i].is_user) {
            divergeIdx = i;
            break;
        }
    }
    if (divergeIdx === -1) {
        divergeIdx = Math.min(coreChat.length, toRestore.length);
    }

    if (divergeIdx === toRestore.length) {
        coreChat.length = toRestore.length - 1;
        if (typeof saveChatConditional === 'function') await saveChatConditional();
        if (typeof reloadCurrentChat === 'function') await reloadCurrentChat();
        return;
    }

    if (divergeIdx > 0) {
        let ancestorIdx = divergeIdx - 1;
        let ancestor = coreChat[ancestorIdx];

        if (ancestor && ancestor.branch_futures) {
            let branchToMatch = toRestore.slice(divergeIdx);
            let deletedAtLeastOne = false;

            for (let swipeKey in ancestor.branch_futures) {
                let futures = ancestor.branch_futures[swipeKey];
                if (!Array.isArray(futures)) continue;

                if (futures.length > 0 && !Array.isArray(futures[0])) {
                    futures = [futures];
                    ancestor.branch_futures[swipeKey] = futures;
                }

                for (let f = futures.length - 1; f >= 0; f--) {
                    let candidate = futures[f];
                    if (!Array.isArray(candidate) || candidate.length === 0 || !candidate[0]) continue;

                    let fpCandidate = msgFingerprint(candidate[0]);
                    let fpTarget = msgFingerprint(branchToMatch[0]);

                    if (fpCandidate.trim() === fpTarget.trim() && candidate[0].is_user === branchToMatch[0].is_user) {
                        futures.splice(f, 1);
                        deletedAtLeastOne = true;
                    }
                }
            }

            if (deletedAtLeastOne) {
                if (typeof saveChatConditional === 'function') await saveChatConditional();
                if (typeof reloadCurrentChat === 'function') await reloadCurrentChat();
                return;
            }
        }
    }
}

function syncShadow() {
    if (!coreChat) return;
    shadowChat = cloneChat(coreChat);
    activeSwipes = {};
    coreChat.forEach((m, i) => {
        activeSwipes[i] = m.swipe_id || 0;
    });
}

function syncShadowDebounced() {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(syncShadow, 300);
}

eventSource.on(event_types.CHAT_CHANGED, syncShadow);
eventSource.on(event_types.MESSAGE_RECEIVED, syncShadowDebounced);
eventSource.on(event_types.MESSAGE_SENT, syncShadowDebounced);
eventSource.on(event_types.MESSAGE_DELETED, syncShadow);
eventSource.on(event_types.MESSAGE_EDITED, syncShadowDebounced);

eventSource.on(event_types.MESSAGE_SWIPED, async (id) => {
    if (!coreChat || isBusy) return;
    const msg = coreChat[id];
    if (!msg) return;

    const newSwipeId = msg.swipe_id || 0;
    const oldSwipeId = activeSwipes[id] !== undefined ? activeSwipes[id] : 0;

    if (newSwipeId === oldSwipeId) return;

    if (shadowChat.length > id + 1) {
        if (!msg.branch_futures) msg.branch_futures = {};

        let newFuture = cloneChat(shadowChat.slice(id + 1));
        if (isGhost(newFuture[0])) return;

        let alreadyExists = false;
        for (let key in msg.branch_futures) {
            let entries = msg.branch_futures[key];
            if (!Array.isArray(entries)) continue;
            if (entries.length > 0 && !Array.isArray(entries[0])) entries = [entries];
            for (let entry of entries) {
                if (isPathDuplicate(entry, newFuture)) {
                    alreadyExists = true;
                    break;
                }
            }
            if (alreadyExists) break;
        }

        if (!alreadyExists) {
            let existing = msg.branch_futures[oldSwipeId] || [];
            if (existing.length > 0 && !Array.isArray(existing[0])) {
                existing = [existing];
            }
            existing.push(newFuture);
            msg.branch_futures[oldSwipeId] = existing;
        }
    }
    syncShadow();
});

function getAvatar(isUser, msgName) {
    const context = getContext();
    let src = '';
    if (isUser) {
        src = $('.mes[is_user="true"] .avatar img').last().attr('src')
            || $('.avatar-container img').attr('src')
            || $('#avatar_url_input').val()
            || $('#user_avatar').attr('src')
            || '/img/user-default.png';
    } else {
        if (msgName) {
            let safeName = String(msgName).replace(/"/g, '\\"');
            src = $(`.mes[ch_name="${safeName}"] .avatar img`).first().attr('src');
        }
        if (!src && msgName && context.characters) {
            let chars = Array.isArray(context.characters) ? context.characters : Object.values(context.characters);
            let found = chars.find(c => c && String(c.name).trim() === String(msgName).trim());
            if (found && found.avatar) src = '/characters/' + found.avatar;
        }
        if (!src) {
            let charId = context.characterId;
            if (charId !== undefined && context.characters && context.characters[charId]) {
                src = `/characters/${context.characters[charId].avatar}`;
            } else {
                src = '/img/logo.png';
            }
        }
    }
    return `background-image: url('${src}');`;
}

function escapeHtml(text) {
    if (!text) return '';
    return String(text).replace(/[&<>"']/g, function (m) { return '&#' + m.charCodeAt(0) + ';'; });
}

function buildHtmlTree(node) {
    let html = '<li style="flex-shrink: 0 !important;">';

    let currentNode = node;
    let linearNodes = [];

    while (currentNode) {
        linearNodes.push(currentNode);
        if (currentNode.children && currentNode.children.length === 1) {
            currentNode = currentNode.children[0];
        } else {
            break;
        }
    }

    html += `<div class="ct-linear-group" style="display: flex; flex-direction: column; align-items: center;">`;

    linearNodes.forEach((n, index) => {
        const border = n.isActive ? '3px solid #8db7d5' : '2px solid rgba(255,255,255,0.2)';
        let shadowCss = n.isActive ? 'box-shadow: 0 0 15px #8db7d5;' : (n.children && n.children.length > 0 ? 'box-shadow: 0 0 10px #00aaff;' : '');
        const activeClass = n.isActive ? 'active-node' : '';
        const avatarStyle = getAvatar(n.isUser, n.msgData ? n.msgData.name : null) + " background-position: center; background-repeat: no-repeat;";

        window.ctNodeMap[n.id] = n.chatToRestoreStack;
        window.ctNodeTextMap[n.id] = n.text;

        html += `
            <div class="ct-node ${activeClass}" data-id="${n.id}" style="display: block; width: 45px; height: 45px; min-width: 45px; min-height: 45px; max-width: 45px; max-height: 45px; flex-shrink: 0 !important; cursor: pointer; position: relative; z-index: ${n.isActive ? 3 : 1}; margin: 0 auto;">
                <div title="Нажмите для предпросмотра" style="width:100%; height:100%; border-radius:50%; ${avatarStyle} background-size:cover; border:${border}; ${shadowCss} opacity:${n.isActive ? 1 : 0.6}; transition:0.2s; box-sizing: border-box;"></div>
            </div>`;

        if (index < linearNodes.length - 1) {
            html += `<div style="width: 2px; height: 20px; background-color: rgba(255,255,255,0.3); margin: 0 auto;"></div>`;
        }
    });

    html += `</div>`;

    let lastNode = linearNodes[linearNodes.length - 1];
    if (lastNode.children && lastNode.children.length > 1) {
        html += '<ul style="margin: 0; padding: 20px 0 0 0;">';
        lastNode.children.forEach(child => {
            html += buildHtmlTree(child);
        });
        html += '</ul>';
    }

    html += '</li>';
    return html;
}

function unifyMessages(baseMsg, incMsg) {
    let clone = cloneChat([baseMsg])[0];
    let baseSwipes = clone.swipes || [clone.mes];
    let incSwipes = incMsg.swipes || [incMsg.mes];

    clone.swipes = [...baseSwipes];
    clone.branch_futures = clone.branch_futures || {};

    let incToBaseMap = {};

    for (let i = 0; i < incSwipes.length; i++) {
        let text = incSwipes[i] || "";
        let existingIdx = clone.swipes.indexOf(text);
        if (existingIdx !== -1) {
            incToBaseMap[i] = existingIdx;
        } else {
            let newIdx = clone.swipes.length;
            clone.swipes.push(text);
            incToBaseMap[i] = newIdx;
        }
    }

    if (incMsg.branch_futures) {
        for (let s in incMsg.branch_futures) {
            let sInt = parseInt(s);
            let mappedS = incToBaseMap[sInt];
            if (mappedS === undefined) continue;

            let existingFutures = clone.branch_futures[mappedS] || [];
            if (existingFutures.length > 0 && !Array.isArray(existingFutures[0])) existingFutures = [existingFutures];

            let incFutures = incMsg.branch_futures[s];
            if (!Array.isArray(incFutures)) continue;
            if (incFutures.length > 0 && !Array.isArray(incFutures[0])) incFutures = [incFutures];

            for (let incF of incFutures) {
                if (!incF || incF.length === 0 || !incF[0]) continue;
                if (isGhost(incF[0])) continue;

                let alreadyExists = false;
                for (let exF of existingFutures) {
                    if (isPathDuplicate(exF, incF)) {
                        alreadyExists = true;
                        break;
                    }
                }
                if (!alreadyExists) {
                    existingFutures.push(cloneChat(incF));
                }
            }
            clone.branch_futures[mappedS] = existingFutures;
        }
    }
    return { unifiedMsg: clone, incToBaseMap: incToBaseMap };
}

function parseArray(msgArray, reconstructStack, activePathAccumulator, virtualFuturesToInject = []) {
    if (!msgArray || !Array.isArray(msgArray) || msgArray.length === 0) return [];

    if (reconstructStack.length > 2000) return [];

    let currentStack = [...reconstructStack];
    let msg = msgArray[0];

    if (isGhost(msg)) {
        return parseArray(msgArray.slice(1), currentStack, activePathAccumulator, virtualFuturesToInject);
    }

    let swipes = msg.swipes || [msg.mes];
    let activeSwipe = msg.swipe_id || 0;
    let swipeNodes = [];

    for (let s = 0; s < swipes.length; s++) {
        let isLocalSwipeActive = (s === activeSwipe);
        let isGloballyGreen = isLocalSwipeActive && activePathAccumulator;

        let targetChatToRestoreStack = [...currentStack, { msg: msg, swipeId: s }];

        let childrenPaths = [];
        if (isLocalSwipeActive && msgArray.length > 1) {
            childrenPaths.push({ path: msgArray.slice(1), isNativelyActive: isGloballyGreen });
        }

        let stored = (msg.branch_futures && msg.branch_futures[s]) ? msg.branch_futures[s] : [];
        if (stored.length > 0) {
            if (!Array.isArray(stored[0])) stored = [stored];
            stored.forEach(st => childrenPaths.push({ path: st, isNativelyActive: false }));
        }

        if (virtualFuturesToInject && virtualFuturesToInject.length > 0) {
            virtualFuturesToInject.forEach(vf => {
                if (vf.parentSwipe === s) childrenPaths.push({ path: vf.tail, isNativelyActive: vf.isNativelyActive });
            });
        }

        let groupedPaths = {};
        childrenPaths.forEach(cp => {
            let path = cp.path;
            if (!path || !Array.isArray(path)) return;
            path = path.filter(m => !isGhost(m));
            if (path.length === 0) return;

            let msg0 = path[0];
            let groupKey = msg0.is_user + "_" + (msg0.name || "");

            if (!groupedPaths[groupKey]) groupedPaths[groupKey] = [];
            groupedPaths[groupKey].push({ path: path, isNativelyActive: cp.isNativelyActive });
        });

        let mergedPaths = [];
        for (let key in groupedPaths) {
            let cps = groupedPaths[key];
            let unifiedMsg = { ...cps[0].path[0] };
            let isGloballyActive = cps[0].isNativelyActive;
            let activeSwipeIdx = unifiedMsg.swipe_id || 0;

            let virtualFutures = [];
            if (cps[0].path.length > 1) {
                virtualFutures.push({ tail: cps[0].path.slice(1), parentSwipe: activeSwipeIdx, isNativelyActive: cps[0].isNativelyActive });
            }

            for (let i = 1; i < cps.length; i++) {
                let incMsg = cps[i].path[0];
                let unifyResult = unifyMessages(unifiedMsg, incMsg);
                unifiedMsg = unifyResult.unifiedMsg;
                let incMap = unifyResult.incToBaseMap;

                let incActiveOld = incMsg.swipe_id || 0;
                let incActiveNew = incMap[incActiveOld] !== undefined ? incMap[incActiveOld] : 0;

                if (cps[i].isNativelyActive) {
                    isGloballyActive = true;
                    activeSwipeIdx = incActiveNew;
                }

                if (cps[i].path.length > 1) {
                    virtualFutures.push({ tail: cps[i].path.slice(1), parentSwipe: incActiveNew, isNativelyActive: cps[i].isNativelyActive });
                }
            }

            unifiedMsg.swipe_id = activeSwipeIdx;
            mergedPaths.push({ path: [unifiedMsg], isActive: isGloballyActive, virtualFutures: virtualFutures });
        }

        let childrenNodes = [];
        mergedPaths.forEach(mp => {
            childrenNodes.push(...parseArray(mp.path, targetChatToRestoreStack, mp.isActive, mp.virtualFutures));
        });

        let sNode = {
            id: 'node_' + Math.random().toString(36).substr(2, 9),
            msgData: msg,
            swipeId: s,
            text: swipes[s],
            isActive: isGloballyGreen,
            isUser: msg.is_user,
            chatToRestoreStack: targetChatToRestoreStack,
            children: childrenNodes
        };
        swipeNodes.push(sNode);
    }
    return swipeNodes;
}

function renderTree() {
    if (!coreChat || coreChat.length === 0) return;

    window.ctNodeMap = {};
    window.ctNodeTextMap = {};

    try {
        let roots = parseArray(coreChat, [], true);
        let html = '<div class="ct-tree-container" style="padding: 60px 40px; width: max-content; min-width: 100%; height: max-content; display:flex; justify-content:center; padding-bottom: 300px;">';
        html += '<ul style="margin:0; padding:0;">';
        roots.forEach(root => html += buildHtmlTree(root));
        html += '</ul></div>';
        $('#tree-transform').html(html);
    } catch (err) {
        console.error("Chat Tree Render Error:", err);
        $('#tree-transform').html(`<div style="background:white; color:red; padding:20px; border-radius:10px; font-family:sans-serif; max-width: 600px; white-space: pre-wrap;"><b>Критическая ошибка рендера:</b><br>${err.message}<br><br>${err.stack}</div>`);
        return;
    }

    $('#tree-transform').off('click', '.ct-node').on('click', '.ct-node', async function (e) {
        e.stopPropagation();

        // СИНЯЯ ПОДСВЕТКА ВЫБРАННОГО СООБЩЕНИЯ
        $('.ct-node').removeClass('ct-selected');
        $(this).addClass('ct-selected');

        const id = $(this).data('id');
        const toRestoreStack = window.ctNodeMap[id];
        const nodeText = window.ctNodeTextMap[id] || "(пустое сообщение)";
        if (!toRestoreStack) return;

        $('#ct-preview-panel').css('display', 'flex');
        $('#ct-preview-text').html(escapeHtml(nodeText).replace(/\n/g, '<br>'));

        $('#ct-delete-btn').off('click').on('click', async function () {
            if (confirm("Вы точно хотите безвозвратно удалить это сообщение и всю ветку, идущую после него?")) {
                let toRestore = buildRestoreArray(toRestoreStack);
                await deleteBranchTarget(toRestore);
                $(this).closest('#chat-tree-modal').remove();
                if (typeof showTreeModal === 'function') setTimeout(showTreeModal, 200);
            }
        });

        $('#ct-jump-btn').off('click').on('click', async function () {
            let safeToRestore = buildRestoreArray(toRestoreStack);

            for (let i = 0; i < safeToRestore.length; i++) {
                if (coreChat[i]) {
                    let rSwipes = safeToRestore[i].swipes || [safeToRestore[i].mes];
                    let cSwipes = coreChat[i].swipes || [coreChat[i].mes];
                    let isSameMsg = rSwipes.includes(coreChat[i].mes) || cSwipes.includes(safeToRestore[i].mes);

                    if (isSameMsg) {
                        let unifiedObj = unifyMessages(coreChat[i], safeToRestore[i]);
                        let unifiedMsg = unifiedObj.unifiedMsg;

                        let targetText = safeToRestore[i].mes;
                        let newIdx = unifiedMsg.swipes.indexOf(targetText);
                        if (newIdx === -1) {
                            unifiedMsg.swipes.push(targetText);
                            newIdx = unifiedMsg.swipes.length - 1;
                        }
                        unifiedMsg.swipe_id = newIdx;
                        unifiedMsg.mes = targetText;
                        unifiedMsg.is_user = safeToRestore[i].is_user;

                        safeToRestore[i] = unifiedMsg;
                    }
                }
            }

            let divergeIdx = -1;
            for (let i = 0; i < Math.min(coreChat.length, safeToRestore.length); i++) {
                if (coreChat[i].mes !== safeToRestore[i].mes || coreChat[i].is_user !== safeToRestore[i].is_user) {
                    divergeIdx = i;
                    break;
                }
            }
            if (divergeIdx === -1) divergeIdx = Math.min(coreChat.length, safeToRestore.length);

            if (divergeIdx >= 0 && divergeIdx < coreChat.length) {
                let parentIdx = divergeIdx - 1;
                let lostStart = divergeIdx;

                if (parentIdx >= 0) {
                    let parentTextInCore = coreChat[parentIdx].mes;
                    let mappedS = safeToRestore[parentIdx].swipes ? safeToRestore[parentIdx].swipes.indexOf(parentTextInCore) : -1;
                    if (mappedS === -1) mappedS = safeToRestore[parentIdx].swipe_id || 0;

                    let lostFuture = coreChat.slice(lostStart);
                    if (lostFuture.length > 0 && !isGhost(lostFuture[0])) {
                        if (!safeToRestore[parentIdx].branch_futures) safeToRestore[parentIdx].branch_futures = {};
                        if (!safeToRestore[parentIdx].branch_futures[mappedS]) safeToRestore[parentIdx].branch_futures[mappedS] = [];

                        let existing = safeToRestore[parentIdx].branch_futures[mappedS];
                        if (existing.length > 0 && !Array.isArray(existing[0])) existing = [existing];

                        let cleanLost = cloneChat(lostFuture);

                        let alreadyExists = false;
                        for (let entry of existing) {
                            if (isPathDuplicate(entry, cleanLost)) {
                                alreadyExists = true;
                                break;
                            }
                        }

                        if (!alreadyExists) {
                            existing.push(cleanLost);
                        }
                        safeToRestore[parentIdx].branch_futures[mappedS] = existing;
                    }
                }
            }

            isBusy = true;
            let bfBackup = {};
            safeToRestore.forEach((m, i) => {
                if (m && m.branch_futures) bfBackup[i] = JSON.parse(JSON.stringify(m.branch_futures));
            });

            while (coreChat.length > 0) coreChat.pop();
            safeToRestore.forEach(m => coreChat.push(m));

            $('#chat-tree-modal').remove();
            if (typeof saveChatConditional === 'function') await saveChatConditional();

            try {
                if (typeof reloadCurrentChat === 'function') {
                    await reloadCurrentChat();
                    for (let i in bfBackup) {
                        if (coreChat[i]) coreChat[i].branch_futures = bfBackup[i];
                    }
                }
            } catch (e) { console.error('Chat Tree UI error', e); }

            setTimeout(() => { isBusy = false; syncShadow(); }, 500);
        });
    });
}

function showTreeModal() {
    $('#chat-tree-modal').remove();
    $('#ct-tree-style').remove();

    $('head').append(`
    <style id="ct-tree-style">
        @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400..700&display=swap');

        .ct-tree-container ul { 
            display: flex; 
            justify-content: center; 
            align-items: flex-start; 
            padding-top: 20px; 
            position: relative; 
        }
        
        .ct-tree-container li { 
            display: flex; 
            flex-direction: column; 
            align-items: center; 
            position: relative; 
            padding: 20px 10px 0 10px; 
            flex-shrink: 0 !important; 
            align-self: flex-start;
        }
        
        .ct-tree-container li::before, .ct-tree-container li::after { 
            content: ''; 
            position: absolute; 
            top: 0; 
            width: 50%; 
            height: 20px; 
            box-sizing: border-box;
        }
        .ct-tree-container li::before { 
            left: 0; 
            right: 50%; 
            border-top: 2px solid rgba(255,255,255,0.3); 
        }
        .ct-tree-container li::after { 
            left: 50%; 
            right: 0; 
            border-top: 2px solid rgba(255,255,255,0.3); 
            border-left: 2px solid rgba(255,255,255,0.3); 
        }
        
        .ct-tree-container li:first-child::before { border: 0 none; }
        .ct-tree-container li:last-child::after { border: 0 none; }
        .ct-tree-container li:last-child::before { 
            border-right: 2px solid rgba(255,255,255,0.3); 
            border-radius: 0 5px 0 0; 
        }
        .ct-tree-container li:first-child::after { border-radius: 5px 0 0 0; }
        
        .ct-tree-container li:only-child::before, .ct-tree-container li:only-child::after { display: none; }
        .ct-tree-container li:only-child { padding-top: 0; padding-left: 0; padding-right: 0; }
        
        .ct-tree-container ul ul::before { 
            content: ''; 
            position: absolute; 
            top: 0; 
            left: 50%; 
            border-left: 2px solid rgba(255,255,255,0.3); 
            width: 0; 
            height: 20px; 
            transform: translateX(-1px);
        }
        
        .ct-node { 
            border-radius: 50% !important; 
            background-color: #222; 
        }

        .ct-node.ct-selected > div {
            box-shadow: 0 0 25px 8px rgba(141, 183, 213, 0.9) !important;
            border-color: #8db7d5 !important;
        }
        
        .ct-search-box { position:relative; flex:1; height:100%; }
        .ct-search-icon { position:absolute; left:12px; top:11px; width:18px; height:18px; filter: drop-shadow(0px 0px 2px rgba(141,183,213,0.4)); }
        .ct-search-input { width: 100%; height: 100%; padding: 0 15px 0 40px; border-radius: 8px; background: rgba(20,20,20,0.85); backdrop-filter: blur(8px); color: #fff; border: 1px solid rgba(141,183,213,0.3); font-size: 15px; box-sizing: border-box; outline: none; box-shadow: 0 4px 12px rgba(0,0,0,0.5); transition: 0.2s; }
        .ct-btn { width:42px; height:42px; background:rgba(20,20,20,0.85); backdrop-filter: blur(8px); border:1px solid rgba(141,183,213,0.3); border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center; box-sizing: border-box; box-shadow: 0 4px 12px rgba(0,0,0,0.5); transition: 0.2s; }
        .ct-btn-close { border:1px solid rgba(205,92,92,0.4); color:#CD5C5C; font-size:28px; padding-bottom: 4px; }
    </style>`);

    $('body').append(`
    <div id="chat-tree-modal" style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.95); z-index:9999; display:flex; font-family: sans-serif;">
        <div id="tree-container" style="flex:1; overflow:hidden; position:relative; touch-action: none;">
            <div id="tree-transform" style="transform-origin: 0 0; position:absolute; top:0; left:0; width: max-content; height: max-content; min-width: 100%; min-height: 100%;"></div>
            
            <div style="position: absolute; top: 15px; left: 50%; transform: translateX(-50%); display: flex; align-items: stretch; gap: 10px; z-index: 1000; width: 90%; max-width: 600px; height: 42px;">
                <div class="ct-search-box">
                    <svg fill="none" class="ct-search-icon" stroke="#8db7d5" stroke-width="2.5" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <input id="ct-search-input" class="ct-search-input" type="text" placeholder="Поиск по веткам..." autocomplete="off">
                </div>
                <button id="ct-center-btn" class="ct-btn" title="Сфокусироваться на текущем сообщении">
                    <svg fill="none" stroke="#8db7d5" stroke-width="2" viewBox="0 0 24 24" style="width:20px; height:20px;">
                        <circle cx="12" cy="12" r="3"></circle><path d="M12 2v4M12 18v4M2 12h4M18 12h4"></path>
                    </svg>
                </button>
                <button id="ct-close-btn" class="ct-btn ct-btn-close" title="Закрыть дерево (Esc)">&times;</button>
            </div>
        </div>
        
        <div id="ct-preview-panel" style="display:none; position:absolute; bottom:80px; left:20px; right:20px; background:#111; border: 2px solid #333; border-radius: 10px; padding: 15px; flex-direction: column; z-index: 10000; max-height: 40vh;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #333; padding-bottom: 10px; margin-bottom: 10px;">
                <span style="color: #8db7d5; font-weight: 600; font-family: 'Caveat', cursive; font-size: 24px; letter-spacing: 0.5px;">Предпросмотр сообщения</span>
                <button id="ct-preview-close" style="background: transparent; border: none; color: #fff; font-size: 20px; cursor: pointer;">&times;</button>
            </div>
            <div id="ct-preview-text" style="color: #ddd; flex: 1; overflow-y: auto; font-size: 14px; line-height: 1.4; margin-bottom: 15px;"></div>
            <div style="display:flex; gap:10px;">
                <button id="ct-jump-btn" style="flex:1; padding:10px; background:#8db7d5; color:#111; border:none; border-radius:5px; cursor:pointer; font-weight:bold; font-size:15px;">ПРЫЖОК</button>
                <button id="ct-delete-btn" style="flex:1; padding:10px; background:#CD5C5C; color:#fff; border:none; border-radius:5px; cursor:pointer; font-weight:bold; font-size:15px;">УДАЛИТЬ</button>
            </div>
        </div>
    </div>`);

    $('#ct-close-btn').on('click', () => $('#chat-tree-modal').remove());
    $('#ct-preview-close').on('click', function () {
        $('#ct-preview-panel').hide();
        $('.ct-node').removeClass('ct-selected');
    });

    let searchTimer = null;
    $('#ct-search-input').on('input', function () {
        let val = $(this).val().toLowerCase();
        if (searchTimer) clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            $('.ct-node').each(function () {
                if (!val) { $(this).css('box-shadow', ''); return; }
                let id = $(this).data('id');
                let text = window.ctNodeTextMap[id];
                if (text && text.toLowerCase().includes(val)) {
                    $(this).css('box-shadow', '0 0 20px 8px rgba(255, 255, 0, 0.8)');
                } else {
                    $(this).css('box-shadow', '');
                }
            });
        }, 300);
    });

    renderTree();

    $('#tree-transform').on('dragstart', 'div, img', e => e.preventDefault());

    const vp = document.getElementById('tree-container'), tf = document.getElementById('tree-transform');
    if (!tf || !vp) return;

    let scale = 1, isDown = false, startX, startY;

    let posX = vp.clientWidth / 2 - tf.clientWidth / 2;
    let posY = 50;

    const update = () => tf.style.transform = `translate(${posX}px, ${posY}px) scale(${scale})`;

    setTimeout(() => {
        posX = vp.clientWidth / 2 - tf.clientWidth / 2;
        update();
    }, 50);

    $('#ct-center-btn').on('click', function () {
        let activeNodes = $('.active-node');
        if (activeNodes.length > 0) {
            let activeNode = activeNodes.last();

            let activeRect = activeNode[0].getBoundingClientRect();
            let tfRect = tf.getBoundingClientRect();

            let relX = (activeRect.left - tfRect.left + activeRect.width / 2) / scale;
            let relY = (activeRect.top - tfRect.top + activeRect.height / 2) / scale;

            let vpRect = vp.getBoundingClientRect();

            posX = vpRect.width / 2 - relX * scale;
            posY = vpRect.height / 3 - relY * scale;

            tf.style.transition = 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)';
            update();
            setTimeout(() => { tf.style.transition = ''; }, 400);
        }
    });

    vp.onmousedown = e => {
        if (e.target.closest('.ct-node')) return;
        isDown = true; startX = e.clientX - posX; startY = e.clientY - posY;
    };
    window.onmouseup = () => isDown = false;
    vp.onmousemove = e => { if (isDown) { posX = e.clientX - startX; posY = e.clientY - startY; update(); } };

    vp.onwheel = e => {
        e.preventDefault();
        const rect = vp.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const delta = e.deltaY > 0 ? 0.9 : 1.1;

        posX = mouseX - (mouseX - posX) * delta;
        posY = mouseY - (mouseY - posY) * delta;
        scale *= delta;

        update();
    };

    let initialDistance = 0;
    vp.addEventListener('touchstart', e => {
        if (e.touches.length === 2) {
            initialDistance = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
        } else if (e.touches.length === 1) {
            if (e.target.closest('.ct-node')) return;
            isDown = true; startX = e.touches[0].clientX - posX; startY = e.touches[0].clientY - posY;
        }
    }, { passive: false });

    vp.addEventListener('touchmove', e => {
        if (isDown || e.touches.length === 2) e.preventDefault();

        if (e.touches.length === 2) {
            const currentDistance = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
            if (initialDistance > 0) {
                const rect = vp.getBoundingClientRect();
                const clientX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                const clientY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

                const mouseX = clientX - rect.left;
                const mouseY = clientY - rect.top;

                const ratio = currentDistance / initialDistance;

                posX = mouseX - (mouseX - posX) * ratio;
                posY = mouseY - (mouseY - posY) * ratio;
                scale *= ratio;

                initialDistance = currentDistance;
                update();
            }
        } else if (e.touches.length === 1 && isDown) {
            posX = e.touches[0].clientX - startX; posY = e.touches[0].clientY - startY; update();
        }
    }, { passive: false });

    vp.addEventListener('touchend', e => {
        if (e.touches.length < 2) initialDistance = 0;
        if (e.touches.length === 0) isDown = false;

        if (e.touches.length === 1) {
            isDown = true;
            startX = e.touches[0].clientX - posX;
            startY = e.touches[0].clientY - posY;
        }
    });
}

function createTreeButtonUI() {
    if ($("#extensionsMenu").length > 0 && $("#ct-menu-item-container").length === 0) {
        $("#extensionsMenu").append(`
            <div id="ct-menu-item-container" class="extension_container interactable" tabindex="0">
                <div id="ct_btn_open_tree" class="list-group-item flex-container flexGap5 interactable" tabindex="0">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:20px; height:20px; margin-right:5px; flex-shrink:0; transform:translateY(2px);"><path d="M12 22v-5"></path><path d="M9 18c-2.3 0-4.3-1.6-4.8-3.8-1.4-.4-2.2-1.7-2.2-3.2 0-2.2 1.8-4 4-4 .4 0 .8.1 1.2.2C8.1 5.1 9.9 4 12 4s3.9 1.1 4.8 3.2c.4-.1.8-.2 1.2-.2 2.2 0 4 1.8 4 4 0 1.5-.8 2.8-2.2 3.2-.5 2.2-2.5 3.8-4.8 3.8"></path></svg>
                    <span>Chat Tree</span>
                </div>
            </div>
        `);
    }
}

jQuery(async () => {
    setInterval(createTreeButtonUI, 1000);

    // ИСПРАВЛЕНА ОПЕЧАТКА ЗДЕСЬ (ct_btn_open_tree вместо ct-btn_open_tree)
    $(document).off("click", "#ct_btn_open_tree").on("click", "#ct_btn_open_tree", function (e) {
        e.stopPropagation();
        showTreeModal();
    });

    setTimeout(syncShadow, 2000);
});