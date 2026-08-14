import { getContext, extension_settings } from '../../../extensions.js';
import { eventSource, event_types, reloadCurrentChat, chat as coreChat, saveChatConditional, saveSettingsDebounced } from '../../../../script.js';

let shadowChat = [];
let shadowChatKey = null; // ПАТЧ: какому чату принадлежит shadowChat
let activeSwipes = {};
let isBusy = false;
let syncTimer = null;

// ПАТЧ: Настройки расширения
const CT_MODULE = 'chat_tree';
function ctSettings() {
    if (!extension_settings[CT_MODULE]) extension_settings[CT_MODULE] = {};
    if (extension_settings[CT_MODULE].showChatTagButtons === undefined) {
        extension_settings[CT_MODULE].showChatTagButtons = true;
    }
    return extension_settings[CT_MODULE];
}

// ПАТЧ: Идентификатор текущего чата (чтобы не сравнивать shadowChat из другого чата)
function getChatKey() {
    try {
        const ctx = getContext();
        let id = typeof ctx.getCurrentChatId === 'function' ? ctx.getCurrentChatId() : null;
        let owner = ctx.groupId !== undefined && ctx.groupId !== null ? ctx.groupId : ctx.characterId;
        return `${owner === undefined || owner === null ? '' : owner}|${id === undefined || id === null ? '' : id}`;
    } catch (e) {
        return null;
    }
}

// ПАТЧ: Синхронизация текста и свайпов (глобально)
function syncMesAndSwipesGlobal(chatArray) {
    if (!chatArray) return;
    chatArray.forEach(m => {
        if (!m) return;
        let sId = m.swipe_id || 0;
        if (m.swipes && m.swipes.length > sId) {
            if (m.mes && m.mes !== m.swipes[sId]) {
                m.swipes[sId] = m.mes;
            }
        } else if (!m.swipes && m.mes) {
            m.swipes = [m.mes];
            m.swipe_id = 0;
        }
    });
}

function cloneChat(chatArray) {
    if (!chatArray) return [];
    return chatArray.map(m => {
        if (!m) return m;
        let cloned = { ...m };
        if (Array.isArray(m.swipes)) {
            cloned.swipes = [...m.swipes];
        } else if (m.swipes) {
            cloned.swipes = Array.from(m.swipes);
        }
        if (Array.isArray(m.swipe_info)) {
            cloned.swipe_info = m.swipe_info.map(info => {
                try {
                    return info ? JSON.parse(JSON.stringify(info)) : info;
                } catch(e) {
                    return info ? { ...info } : info;
                }
            });
        }
        // ПАТЧ: extra копируется только поверхностно (по ссылке через { ...m }), чтобы не ломать внешние DOM-блоки (dreamalbum)
        if (m.branch_futures) {
            try {
                cloned.branch_futures = JSON.parse(JSON.stringify(m.branch_futures));
            } catch (e) {
                cloned.branch_futures = {};
            }
        }
        return cloned;
    });
}

function cloneMessageWithSwipe(msg, s) {
    if (!msg) return msg;
    let cloned = { ...msg };
    if (Array.isArray(msg.swipes)) {
        cloned.swipes = [...msg.swipes];
    } else if (msg.swipes) {
        cloned.swipes = Array.from(msg.swipes);
    }
    if (Array.isArray(msg.swipe_info)) {
        cloned.swipe_info = msg.swipe_info.map(info => {
            try {
                return info ? JSON.parse(JSON.stringify(info)) : info;
            } catch(e) {
                return info ? { ...info } : info;
            }
        });
    }
    cloned.swipe_id = s;
    cloned.mes = Array.isArray(msg.swipes) && msg.swipes.length > s ? msg.swipes[s] : msg.mes;

    // ПАТЧ: Восстанавливаем extra из конкретного свайпа (swipe_info) в корень сообщения, 
    // чтобы внешние расширения (например, DreamAlbum) видели актуальный блок после прыжка.
    if (cloned.swipe_info && cloned.swipe_info[s]) {
        if (cloned.swipe_info[s].extra !== undefined) {
            cloned.extra = JSON.parse(JSON.stringify(cloned.swipe_info[s].extra));
        } else {
            delete cloned.extra;
        }
    }

    if (msg.branch_futures) {
        try {
            cloned.branch_futures = JSON.parse(JSON.stringify(msg.branch_futures));
        } catch (e) {
            cloned.branch_futures = {};
        }
    }
    return cloned;
}

// ПАТЧ: Универсальное сравнение узлов
function isNodeMatch(a, b) {
    if (!a || !b) return a === b;
    let aUser = String(a.is_user) === 'true';
    let bUser = String(b.is_user) === 'true';
    if (aUser !== bUser) return false;

    if (a.send_date && b.send_date && a.send_date === b.send_date) return true;

    let aMes = (a.mes || "").trim().replace(/\r\n/g, '\n');
    let bMes = (b.mes || "").trim().replace(/\r\n/g, '\n');
    if (aMes === bMes) return true;

    let aNoSrc = aMes.replace(/src="[^"]*"/g, '').replace(/\[IMG:GEN\]/g, '').trim();
    let bNoSrc = bMes.replace(/src="[^"]*"/g, '').replace(/\[IMG:GEN\]/g, '').trim();
    if (aNoSrc === bNoSrc && aNoSrc.length > 0) return true;

    return false;
}

// ПАТЧ: Безопасное сравнение путей для старых чатов
function isPathDuplicate(pathA, pathB) {
    if (!pathA || !pathB) return false;
    if (pathA.length !== pathB.length) return false;
    for (let i = 0; i < pathA.length; i++) {
        if (!isNodeMatch(pathA[i], pathB[i])) return false;
    }
    return true;
}

// ПАТЧ: Очистка текста для фингерпринта
function msgFingerprint(m) {
    if (!m) return "";
    let text = (m.swipes && m.swipes.length > 0 ? m.swipes[0] : m.mes) || "";
    return text.trim().replace(/\r\n/g, '\n');
}

function isGhost(m) {
    try {
        if (!m) return true;
        if (m.mes && typeof m.mes === 'string' && m.mes.trim() !== '') return false;
        if (Array.isArray(m.swipes) && m.swipes.some(s => s && typeof s === 'string' && s.trim() !== '')) return false;
        // ПАТЧ: Защита внешних блоков (dreamalbum и др.), у которых может не быть текста
        if (m.extra && typeof m.extra === 'object' && Object.keys(m.extra).length > 0) return false;
        if (m.is_system) return false;
        return true;
    } catch (e) {
        console.warn("chat-tree: Error in isGhost", e, m);
        return false;
    }
}

function getNodeHash(stack) {
    if (!stack) return "";
    let identifiers = stack.map(m => {
        // ПАТЧ: Стабильный хэш на основе send_date, чтобы метки не пропадали при редактировании/генерации картинок
        if (m.msg.send_date) {
            return `${m.msg.is_user}_${m.swipeId}_${m.msg.send_date}`;
        }
        let text = (m.msg.swipes && m.msg.swipes.length > m.swipeId) ? m.msg.swipes[m.swipeId] : m.msg.mes;
        return (text || "").trim();
    });
    let s = identifiers.join('||');
    let h = 0, l = s.length, i = 0;
    if (l > 0) while (i < l) h = (h << 5) - h + s.charCodeAt(i++) | 0;
    return "tag_" + h.toString(36);
}

// ПАТЧ: "Мягкий" хэш узла - без номеров свайпов.
// Номера свайпов перенумеровываются при слиянии веток (unifyMessages), из-за чего
// строгий хэш менялся и тег считался "осиротевшим". Мягкий хэш это переживает
// и позволяет перепривязать тег к новому строгому хэшу.
function getNodeLooseHash(stack) {
    if (!stack || stack.length === 0) return "";
    let identifiers = stack.map(m => `${String(m.msg.is_user)}_${m.msg.send_date || ''}`);
    let last = stack[stack.length - 1];
    let lastText = (last.msg.swipes && last.msg.swipes.length > last.swipeId) ? last.msg.swipes[last.swipeId] : last.msg.mes;
    identifiers.push((lastText || "").trim().replace(/\r\n/g, '\n').slice(0, 300));
    let s = identifiers.join('||');
    let h = 0, l = s.length, i = 0;
    if (l > 0) while (i < l) h = (h << 5) - h + s.charCodeAt(i++) | 0;
    return "lt_" + h.toString(36);
}

function buildRestoreArray(stack) {
    if (!stack) return [];
    return stack.map(item => cloneMessageWithSwipe(item.msg, item.swipeId));
}

// ПАТЧ: Универсальная модалка для тегов и интеграция в чат
function openGlobalTagModal(nodeHash, nodeText, onSaveCallback, onDeleteCallback, looseHash) {
    if (!$('#ct-global-tag-modal-overlay').length) {
        $('body').append(`
        <div id="ct-global-tag-modal-overlay" style="display:none; position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:100001; align-items:center; justify-content:center; background:rgba(0,0,0,0.5);">
            <div id="ct-global-tag-modal" style="background:#111; border: 2px solid #444; border-radius: 10px; padding: 15px; width: 300px; display: flex; flex-direction: column; gap: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.8); font-family: sans-serif;">
                <div style="color:#fff; font-weight:bold; text-align:center;">Настройка тега</div>
                <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;" id="ct-global-tag-color-picker">
                    ${['#8db7d5', '#eb8b8b', '#85c496', '#c0a0c3', '#f2ab7c', '#e6c86e', '#c2a382', '#df98b7', '#a8b2b8'].map(c => `<div class="ct-global-color-option" data-color="${c}" style="width: 25px; height: 25px; border-radius: 50%; background: ${c}; cursor: pointer; border: 2px solid transparent;"></div>`).join('')}
                </div>
                <textarea id="ct-global-tag-desc" placeholder="Описание тега..." style="width:100%; height:80px; padding:8px; border-radius:5px; border:1px solid #555; background:#222; color:#fff; resize:none; box-sizing:border-box;"></textarea>
                <div style="display:flex; gap:5px; flex-wrap:wrap;">
                    <button id="ct-global-tag-save-btn" style="flex:1; min-width: 80px; padding:8px 4px; background:#8db7d5; color:#111; border:none; border-radius:5px; cursor:pointer; font-weight:bold; font-size:12px;">СОХРАНИТЬ</button>
                    <button id="ct-global-tag-del-btn" style="flex:1; min-width: 80px; padding:8px 4px; background:#CD5C5C; color:#fff; border:none; border-radius:5px; cursor:pointer; font-weight:bold; font-size:12px;">УДАЛИТЬ</button>
                    <button id="ct-global-tag-cancel-btn" style="flex:1; min-width: 80px; padding:8px 4px; background:transparent; border:1px solid #555; color:#ddd; border-radius:5px; cursor:pointer; font-weight:bold; font-size:12px;">ОТМЕНА</button>
                </div>
            </div>
        </div>
        `);
        
        $('.ct-global-color-option').off('click').on('click', function() {
            let c = $(this).data('color');
            $('#ct-global-tag-modal').data('selected-color', c);
            $('.ct-global-color-option').css('border-color', 'transparent');
            $(this).css('border-color', '#fff');
        });
        
        $('#ct-global-tag-cancel-btn').off('click').on('click', () => $('#ct-global-tag-modal-overlay').hide());
        $('#ct-global-tag-modal-overlay').on('click', function(e) {
            if (e.target === this) $(this).hide();
        });
    }
    
    let tagData = null;
    if (coreChat && coreChat.length > 0 && coreChat[0].chat_tree_tags && coreChat[0].chat_tree_tags[nodeHash]) {
        tagData = coreChat[0].chat_tree_tags[nodeHash];
    }
    
    $('#ct-global-tag-modal-overlay').css('display', 'flex');
    if (tagData) {
        $('#ct-global-tag-desc').val(tagData.desc || '');
        $('#ct-global-tag-modal').data('selected-color', tagData.color);
        $('.ct-global-color-option').each(function() {
            if ($(this).data('color') === tagData.color) $(this).css('border-color', '#fff');
            else $(this).css('border-color', 'transparent');
        });
        $('#ct-global-tag-del-btn').show();
    } else {
        $('#ct-global-tag-desc').val('');
        let defColor = '#8db7d5';
        $('#ct-global-tag-modal').data('selected-color', defColor);
        $('.ct-global-color-option').each(function() {
            if ($(this).data('color') === defColor) $(this).css('border-color', '#fff');
            else $(this).css('border-color', 'transparent');
        });
        $('#ct-global-tag-del-btn').hide();
    }
    
    $('#ct-global-tag-save-btn').off('click').on('click', async function () {
        if (!coreChat || coreChat.length === 0) return;
        if (!coreChat[0].chat_tree_tags) coreChat[0].chat_tree_tags = {};
        coreChat[0].chat_tree_tags[nodeHash] = {
            color: $('#ct-global-tag-modal').data('selected-color'),
            desc: $('#ct-global-tag-desc').val(),
            nodeText: nodeText,
            // ПАТЧ: мягкий хэш нужен, чтобы тег можно было найти после перенумерации свайпов
            looseHash: looseHash || (tagData && tagData.looseHash) || undefined
        };
        if (typeof saveChatConditional === 'function') await saveChatConditional();
        $('#ct-global-tag-modal-overlay').hide();
        if (onSaveCallback) onSaveCallback(coreChat[0].chat_tree_tags[nodeHash]);
        if (typeof window.renderGlobalTags === 'function') window.renderGlobalTags();
        updateChatUI();
    });
    
    $('#ct-global-tag-del-btn').off('click').on('click', async function () {
        if (!coreChat || coreChat.length === 0 || !coreChat[0].chat_tree_tags) return;
        delete coreChat[0].chat_tree_tags[nodeHash];
        if (typeof saveChatConditional === 'function') await saveChatConditional();
        $('#ct-global-tag-modal-overlay').hide();
        if (onDeleteCallback) onDeleteCallback();
        if (typeof window.renderGlobalTags === 'function') window.renderGlobalTags();
        updateChatUI();
    });
}

function getHashesForCoreChatIndex(index) {
    if (!coreChat || index < 0 || index >= coreChat.length) return null;
    let stack = [];
    for(let i = 0; i <= index; i++) {
        if (!coreChat[i]) continue;
        stack.push({ msg: coreChat[i], swipeId: coreChat[i].swipe_id || 0 });
    }
    return { hash: getNodeHash(stack), looseHash: getNodeLooseHash(stack) };
}

function updateChatUI() {
    // ПАТЧ: Переключатель отображения кнопок тегов в чате
    if (!ctSettings().showChatTagButtons) {
        $('#chat .ct-inline-tag-btn').remove();
        return;
    }
    if (!coreChat || coreChat.length === 0) return;
    $('#chat .mes').each(function() {
        let mesId = $(this).attr('mesid');
        if (mesId === undefined) return;
        let index = parseInt(mesId);
        if (isNaN(index) || index < 0 || index >= coreChat.length) return;
        
        let hashes = getHashesForCoreChatIndex(index);
        if (!hashes || !hashes.hash) return;
        let hash = hashes.hash;
        let looseHash = hashes.looseHash;

        let tagData = null;
        if (coreChat[0].chat_tree_tags && coreChat[0].chat_tree_tags[hash]) {
            tagData = coreChat[0].chat_tree_tags[hash];
        }
        
        let $buttonsContainer = $(this).find('.mes_buttons');
        if ($buttonsContainer.length === 0) return;
        
        let $existingBtn = $buttonsContainer.find('.ct-inline-tag-btn');
        if ($existingBtn.length === 0) {
            $existingBtn = $('<div class="ct-inline-tag-btn" title="Добавить/изменить тег ветки" style="width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--SmartThemeBodyColor, #888); background: transparent; cursor: pointer; margin-right: 5px; opacity: 0.7; transition: 0.2s; align-self: center; display: inline-block; vertical-align: middle;"></div>');
            $existingBtn.hover(function(){ $(this).css('opacity', '1'); }, function(){ $(this).css('opacity', '0.7'); });
            $buttonsContainer.prepend($existingBtn);
        }
        
        // ПАТЧ: Перепривязываем событие каждый раз, чтобы использовать актуальный hash (а не из замыкания)
        $existingBtn.off('click').on('click', function(e) {
            e.stopPropagation();
            let msgText = coreChat[index].swipes ? coreChat[index].swipes[coreChat[index].swipe_id || 0] : coreChat[index].mes;
            openGlobalTagModal(hash, msgText, null, null, looseHash);
        });
        
        if (tagData) {
            $existingBtn.css('border-color', tagData.color).css('background', tagData.color).css('opacity', '1');
            $existingBtn.attr('title', tagData.desc || 'Редактировать тег ветки');
        } else {
            $existingBtn.css('border-color', 'var(--SmartThemeBodyColor, #888)').css('background', 'transparent').css('opacity', '0.7');
            $existingBtn.attr('title', 'Добавить тег ветки');
        }
    });
}

// Следим за изменениями чата для обновления кнопок
const chatObserver = new MutationObserver((mutations) => {
    let shouldUpdate = false;
    for (let m of mutations) {
        if (m.addedNodes.length > 0 || m.type === 'attributes') {
            shouldUpdate = true;
            break;
        }
    }
    if (shouldUpdate) {
        setTimeout(updateChatUI, 50);
    }
});
$(document).ready(() => {
    let chatEl = document.getElementById('chat');
    if (chatEl) {
        chatObserver.observe(chatEl, { childList: true, subtree: true, attributes: true, attributeFilter: ['mesid'] });
        setTimeout(updateChatUI, 500);
    }
});

// ПАТЧ КОНЕЦ

// ПАТЧ: Функция для безопасного удаления одного свайпа
function removeSwipeFromMessage(msg, swipeId) {
    if (!msg || !msg.swipes || msg.swipes.length <= 1) return false; // Указывает, что нужно удалить всё сообщение

    msg.swipes.splice(swipeId, 1);

    if (msg.swipe_info && msg.swipe_info.length > swipeId) {
        msg.swipe_info.splice(swipeId, 1);
    }

    if (msg.branch_futures) {
        let newFutures = {};
        for (let k in msg.branch_futures) {
            let idx = parseInt(k);
            if (idx > swipeId) {
                newFutures[idx - 1] = msg.branch_futures[k];
            } else if (idx < swipeId) {
                newFutures[idx] = msg.branch_futures[k];
            }
        }
        msg.branch_futures = newFutures;
    }

    let oldActive = msg.swipe_id || 0;
    if (oldActive === swipeId) {
        msg.swipe_id = Math.max(0, swipeId - 1);
        msg.mes = msg.swipes[msg.swipe_id];
        if (msg.swipe_info && msg.swipe_info[msg.swipe_id] && msg.swipe_info[msg.swipe_id].extra !== undefined) {
            msg.extra = JSON.parse(JSON.stringify(msg.swipe_info[msg.swipe_id].extra));
        } else {
            delete msg.extra;
        }
    } else if (oldActive > swipeId) {
        msg.swipe_id--;
    }
    return true; // Указывает, что сообщение выжило (удалили только свайп)
}

// ПАТЧ: Нормализованный поиск точки расхождения
async function deleteBranchTarget(toRestore, targetSwipeId = null) {
    if (!toRestore || toRestore.length === 0) return;

    // ПАТЧ: Пока идёт удаление, перестройка чата не должна восприниматься как новое удаление
    let wasBusy = isBusy;
    isBusy = true;
    try {
        await deleteBranchTargetInner(toRestore, targetSwipeId);
    } finally {
        isBusy = wasBusy;
    }
}

async function deleteBranchTargetInner(toRestore, targetSwipeId = null) {
    let divergeIdx = -1;
    for (let i = 0; i < Math.min(coreChat.length, toRestore.length); i++) {
        if (!isNodeMatch(coreChat[i], toRestore[i])) {
            divergeIdx = i;
            break;
        }
    }
    if (divergeIdx === -1) {
        divergeIdx = Math.min(coreChat.length, toRestore.length);
    }

    let deletedAtLeastOne = false;

    if (divergeIdx === toRestore.length) {
        if (targetSwipeId !== null) {
            let targetMsg = coreChat[toRestore.length - 1];
            let oldActive = targetMsg.swipe_id || 0;
            let wasActiveSwipe = (oldActive === targetSwipeId);
            let survived = removeSwipeFromMessage(targetMsg, targetSwipeId);
            if (!survived) {
                coreChat.length = toRestore.length - 1;
            } else if (wasActiveSwipe) {
                coreChat.length = toRestore.length; // Удаляем хвост после сообщения
            }
        } else {
            coreChat.length = toRestore.length - 1;
        }
        deletedAtLeastOne = true;
    }

    // Собираем ВСЕ сообщения, которые есть в текущем чате и его ветках
    let allMsgs = [];
    let visited = new Set();
    function collect(msgs) {
        if (!msgs || !Array.isArray(msgs)) return;
        msgs.forEach(m => {
            if (!m || visited.has(m)) return;
            visited.add(m);
            allMsgs.push(m);
            if (m.branch_futures) {
                for (let k in m.branch_futures) {
                    let entries = m.branch_futures[k];
                    if (!Array.isArray(entries)) continue;
                    if (entries.length > 0 && !Array.isArray(entries[0])) {
                        collect(entries);
                    } else {
                        entries.forEach(e => collect(e));
                    }
                }
            }
        });
    }
    collect(coreChat);

    // ПАТЧ: Тег удаляемого узла стираем ровно один раз (раньше это висело внутри цикла по startIdx
    // и каждый раз считало один и тот же хэш, срабатывая даже когда ничего не удалялось)
    if (coreChat[0] && coreChat[0].chat_tree_tags) {
        let nodeHash = getNodeHash(toRestore.map(m => ({ msg: m, swipeId: m.swipe_id || 0 })));
        if (coreChat[0].chat_tree_tags[nodeHash]) {
            delete coreChat[0].chat_tree_tags[nodeHash];
        }
    }

    // Проходим по всем сообщениям и вычищаем из их веток удаляемый хвост
    allMsgs.forEach(ancestor => {
        if (!ancestor || !ancestor.branch_futures) return;

        // Проверяем каждый возможный суффикс toRestore, так как ветка могла начаться с любого места
        for (let startIdx = 0; startIdx < toRestore.length; startIdx++) {
            let pathTail = toRestore.slice(startIdx);
            if (pathTail.length === 0) continue;

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

                    // Проверяем, совпадает ли начало этого кандидата с pathTail
                    let matches = true;
                    for (let k = 0; k < pathTail.length; k++) {
                        if (k >= candidate.length || !isNodeMatch(candidate[k], pathTail[k])) {
                            matches = false;
                            break;
                        }
                    }

                    if (matches) {
                        let truncateIdx = pathTail.length - 1;
                        let targetMsg = candidate[truncateIdx];

                        if (targetSwipeId !== null) {
                            let oldActive = targetMsg.swipe_id || 0;
                            let wasActiveSwipe = (oldActive === targetSwipeId);
                            let survived = removeSwipeFromMessage(targetMsg, targetSwipeId);

                            if (survived) {
                                if (wasActiveSwipe) {
                                    futures[f] = candidate.slice(0, truncateIdx + 1);
                                }
                                deletedAtLeastOne = true;
                            } else {
                                if (truncateIdx === 0) {
                                    futures.splice(f, 1);
                                } else {
                                    futures[f] = candidate.slice(0, truncateIdx);
                                }
                                deletedAtLeastOne = true;
                            }
                        } else {
                            if (truncateIdx === 0) {
                                futures.splice(f, 1);
                            } else {
                                futures[f] = candidate.slice(0, truncateIdx);
                            }
                            deletedAtLeastOne = true;
                        }
                    }
                }
            }
        }
    });

    if (deletedAtLeastOne) {
        if (typeof saveChatConditional === 'function') await saveChatConditional();
        if (typeof reloadCurrentChat === 'function') await reloadCurrentChat();
    }
}

function syncShadow() {
    if (!coreChat) return;

    let chatKey = getChatKey();
    // ПАТЧ: shadowChat можно сравнивать с coreChat только внутри одного и того же чата
    let sameChat = (shadowChatKey !== null && shadowChatKey === chatKey);

    // ПАТЧ: Проверка на удаление перед обновлением shadowChat.
    // Если длина уменьшилась, значит хвост был удален.
    // ВАЖНО: не срабатывает при isBusy (прыжок по дереву / уже идущее удаление) и при смене чата -
    // раньше прыжок "вверх" делал чат короче, это принималось за удаление и стирало тег/ветку.
    if (!isBusy && sameChat && shadowChat && shadowChat.length > coreChat.length) {
        let pathToDelete = shadowChat.slice(0, coreChat.length + 1);
        deleteBranchTarget(pathToDelete).catch(e => console.error("chat-tree: Error in auto-delete", e));
    }

    syncMesAndSwipesGlobal(coreChat);

    shadowChat = cloneChat(coreChat);
    shadowChatKey = chatKey;
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
eventSource.on(event_types.MESSAGE_DELETED, async () => {
    if (shadowChat && coreChat && coreChat.length < shadowChat.length) {
        // ПАТЧ: Точное определение удаленного узла для полного стирания ветки
        let deletedIdx = -1;
        for (let i = 0; i < shadowChat.length; i++) {
            if (i >= coreChat.length || !isNodeMatch(shadowChat[i], coreChat[i])) {
                deletedIdx = i;
                break;
            }
        }
        if (deletedIdx !== -1) {
            let pathToDelete = shadowChat.slice(0, deletedIdx + 1);
            await deleteBranchTarget(pathToDelete);
        }
    }
    syncShadow();
});
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
            for (let k = 0; k < entries.length; k++) {
                if (isPathDuplicate(entries[k], newFuture)) {
                    alreadyExists = true;
                    entries[k] = newFuture; // Запоминаем последнее состояние (актуальный текст/картинку)
                    break;
                }
            }
            if (alreadyExists) {
                msg.branch_futures[key] = entries;
                break;
            }
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
    if (String(isUser) === 'true') {
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
        window.ctNodeLooseMap[n.id] = n.looseHash;
        
        // ПАТЧ: Отрисовка тегов (полная подсветка)
        let tagData = null;
        if (coreChat && coreChat.length > 0 && coreChat[0].chat_tree_tags) {
            tagData = coreChat[0].chat_tree_tags[n.nodeHash];
        }
        
        let customBorder = border;
        let customShadow = shadowCss;
        
        if (tagData) {
            customBorder = `3px solid ${escapeHtml(tagData.color)}`;
            customShadow = `box-shadow: 0 0 15px ${escapeHtml(tagData.color)};`;
        }

        html += `
            <div class="ct-node ${activeClass}" data-id="${n.id}" data-hash="${n.nodeHash}" style="display: block; width: 45px; height: 45px; min-width: 45px; min-height: 45px; max-width: 45px; max-height: 45px; flex-shrink: 0 !important; cursor: pointer; position: relative; z-index: ${n.isActive ? 3 : 1}; margin: 0 auto;">
                <div title="Нажмите для предпросмотра" style="width:100%; height:100%; border-radius:50%; ${avatarStyle} background-size:cover; border:${customBorder}; ${customShadow} opacity:${n.isActive ? 1 : 0.8}; transition:0.2s; box-sizing: border-box;"></div>
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

// ПАТЧ: Очистка текста при слиянии свайпов
function unifyMessages(baseMsg, incMsg) {
    let clone = cloneChat([baseMsg])[0];
    let baseSwipes = clone.swipes || [clone.mes];
    let incSwipes = incMsg.swipes || [incMsg.mes];

    let baseSwipesInfo = clone.swipe_info || [{}];
    let incSwipesInfo = incMsg.swipe_info || [{}];

    clone.swipes = [...baseSwipes];
    clone.swipe_info = baseSwipesInfo.map(info => info ? { ...info } : info);
    clone.branch_futures = clone.branch_futures || {};

    let incToBaseMap = {};

    let sameMessage = false;
    if (clone.send_date && incMsg.send_date && clone.send_date === incMsg.send_date) {
        sameMessage = true;
    }

    for (let i = 0; i < incSwipes.length; i++) {
        let text = incSwipes[i] || "";
        let cleanText = text.trim().replace(/\r\n/g, '\n');
        
        let existingIdx = -1;
        if (sameMessage && i < clone.swipes.length) {
            existingIdx = i; // ПАТЧ: Если это то же сообщение, объединяем свайпы по индексу, а не по тексту (чтобы не дублировать [IMG:GEN] и готовую картинку)
        } else {
            existingIdx = clone.swipes.findIndex(s => {
                let sClean = (s || "").trim().replace(/\r\n/g, '\n');
                if (sClean === cleanText) return true;
                
                // ПАТЧ: Эвристика для склейки старых дублей свайпов с [IMG:GEN]
                let sNoSrc = sClean.replace(/src="[^"]*"/g, '').replace(/\[IMG:GEN\]/g, '').trim();
                let cNoSrc = cleanText.replace(/src="[^"]*"/g, '').replace(/\[IMG:GEN\]/g, '').trim();
                return (sNoSrc === cNoSrc && sNoSrc.length > 0);
            });
        }
        
        if (existingIdx !== -1) {
            incToBaseMap[i] = existingIdx;
        } else {
            let newIdx = clone.swipes.length;
            clone.swipes.push(text);
            let infoToPush = incSwipesInfo[i] ? { ...incSwipesInfo[i] } : {};
            clone.swipe_info.push(infoToPush);
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
                for (let k = 0; k < existingFutures.length; k++) {
                    if (isPathDuplicate(existingFutures[k], incF)) {
                        alreadyExists = true;
                        // ПАТЧ: НЕ ПЕРЕЗАПИСЫВАТЬ existingFutures[k]! existingFutures берется из coreChat (где картинка уже сгенерирована), а incF - из старого branch_futures (где еще [IMG:GEN])
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

// ПАТЧ: Нормализация ключа группы
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
            let isUserBool = String(msg0.is_user) === 'true'; // Нормализация флага!
            let groupKey = isUserBool + "_" + (msg0.name || "");

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
            nodeHash: getNodeHash(targetChatToRestoreStack),
            looseHash: getNodeLooseHash(targetChatToRestoreStack),
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

// ПАТЧ: Отрисовка глобального списка тегов
window.renderGlobalTags = function() {
    let $list = $('#ct-global-tags-list');
    if (!$list.length) return;
    $list.empty();
    
    if (!coreChat || coreChat.length === 0 || !coreChat[0].chat_tree_tags) return;
    
    let tags = coreChat[0].chat_tree_tags;
    
    for (let hash in tags) {
        let tag = tags[hash];
        if (!tag || tag._orphan) continue; // ПАТЧ: скрытые (потерявшие узел) теги не показываем

        let $item = $(`
            <div class="ct-global-tag" data-hash="${hash}" style="display:flex; flex-direction:column; align-items: flex-end; cursor:pointer; transition:0.2s;">
                <div style="width:20px; height:20px; border-radius:50%; background:${escapeHtml(tag.color)}; flex-shrink:0; border: 2px solid rgba(255,255,255,0.2);"></div>
                <div class="ct-tag-desc-box" style="display:none; background:rgba(20,20,20,0.9); backdrop-filter:blur(8px); border:1px solid ${escapeHtml(tag.color)}; border-radius:8px; padding: 10px; color:#ddd; font-size:13px; white-space:pre-wrap; margin-top: 5px; box-shadow:0 4px 12px rgba(0,0,0,0.5); width: max-content; max-width: 200px; text-align: left;">${escapeHtml(tag.desc || 'Без описания')}</div>
            </div>
        `);
        
        let clickTimer = null;
        $item.on('click', function(e) {
            if (clickTimer) {
                clearTimeout(clickTimer);
                clickTimer = null;
                // Double click - ПЕРЕНОС КАМЕРЫ НА УЗЕЛ
                let $node = $(`.ct-node[data-hash="${hash}"]`);
                if ($node.length) {
                    $node.trigger('click');
                    if (typeof window.ctCenterOnNode === 'function') {
                        window.ctCenterOnNode($node);
                    }
                }
            } else {
                clickTimer = setTimeout(() => {
                    clickTimer = null;
                    // Single click - РАСКРЫТЬ
                    let $desc = $(this).find('.ct-tag-desc-box');
                    $desc.slideToggle(150);
                }, 250);
            }
        });
        
        $list.append($item);
    }
};

// ПАТЧ: Теги больше НЕ удаляются при рендере.
// Раньше любой тег, чей строгий хэш не нашёлся в дереве, стирался навсегда - а хэш меняется
// при перенумерации свайпов после слияния веток. Теперь тег сначала пытаются перепривязать
// по мягкому хэшу, а если узел действительно не найден - он просто помечается скрытым
// (_orphan) и восстановится сам, когда узел снова появится.
function scrubOrphanedTags(roots) {
    if (!coreChat || coreChat.length === 0 || !coreChat[0].chat_tree_tags) return;

    let validHashes = new Set();
    let looseToHash = {};
    let hashToLoose = {};
    function collect(nodes) {
        nodes.forEach(n => {
            validHashes.add(n.nodeHash);
            if (n.looseHash) {
                if (looseToHash[n.looseHash] === undefined) looseToHash[n.looseHash] = n.nodeHash;
                if (hashToLoose[n.nodeHash] === undefined) hashToLoose[n.nodeHash] = n.looseHash;
            }
            if (n.children) collect(n.children);
        });
    }
    collect(roots);

    let tags = coreChat[0].chat_tree_tags;
    let changed = false;
    let remapped = 0, orphaned = 0;

    for (let hash of Object.keys(tags)) {
        let tag = tags[hash];
        if (!tag) continue;

        if (validHashes.has(hash)) {
            if (tag._orphan) { delete tag._orphan; changed = true; }
            // Дописываем мягкий хэш старым тегам, чтобы они пережили будущую перенумерацию свайпов
            if (!tag.looseHash && hashToLoose[hash]) { tag.looseHash = hashToLoose[hash]; changed = true; }
            continue;
        }

        // Пытаемся найти тот же узел с новым номером свайпа
        let newHash = tag.looseHash ? looseToHash[tag.looseHash] : undefined;
        if (newHash && newHash !== hash && !tags[newHash]) {
            delete tag._orphan;
            tags[newHash] = tag;
            delete tags[hash];
            remapped++;
            changed = true;
            continue;
        }

        if (!tag._orphan) {
            tag._orphan = true;
            orphaned++;
            changed = true;
        }
    }

    if (remapped > 0 || orphaned > 0) {
        console.log(`chat-tree: tags remapped=${remapped}, hidden as orphaned=${orphaned}`);
    }
    if (changed && typeof saveChatConditional === 'function') saveChatConditional();
}

function renderTree() {
    if (!coreChat || coreChat.length === 0) return;

    syncMesAndSwipesGlobal(coreChat);

    window.ctNodeMap = {};
    window.ctNodeTextMap = {};
    window.ctNodeLooseMap = {};

    try {
        let roots = parseArray(coreChat, [], true);
        scrubOrphanedTags(roots); // ПАТЧ: Очистка "призрачных" тегов
        
        let html = '<div class="ct-tree-container" style="padding: 60px 40px; width: max-content; min-width: 100%; height: max-content; display:flex; justify-content:center; padding-bottom: 300px;">';
        html += '<ul style="margin:0; padding:0;">';
        roots.forEach(root => html += buildHtmlTree(root));
        html += '</ul></div>';
        $('#tree-transform').html(html);
        renderGlobalTags(); // ПАТЧ: Отрисовываем глобальные теги после построения дерева
    } catch (err) {
        console.error("Chat Tree Render Error:", err);
        $('#tree-transform').html(`<div style="background:white; color:red; padding:20px; border-radius:10px; font-family:sans-serif; max-width: 600px; white-space: pre-wrap;"><b>Критическая ошибка рендера:</b><br>${err.message}<br><br>${err.stack}</div>`);
        return;
    }

    $('#tree-transform').off('click', '.ct-node').on('click', '.ct-node', async function (e) {
        e.stopPropagation();

        $('.ct-node').removeClass('ct-selected');
        $(this).addClass('ct-selected');

        const id = $(this).data('id');
        const nodeHash = $(this).data('hash');
        const nodeLooseHash = window.ctNodeLooseMap ? window.ctNodeLooseMap[id] : undefined;
        const toRestoreStack = window.ctNodeMap[id];
        const nodeText = window.ctNodeTextMap[id] || "(пустое сообщение)";
        if (!toRestoreStack) return;

        $('#ct-preview-panel').css('display', 'flex');
        $('#ct-preview-text').html(escapeHtml(nodeText).replace(/\n/g, '<br>'));

        // ПАТЧ: Настройка тега (Модалка)
        let tagData = null;
        if (coreChat && coreChat.length > 0 && coreChat[0].chat_tree_tags && coreChat[0].chat_tree_tags[nodeHash]) {
            tagData = coreChat[0].chat_tree_tags[nodeHash];
        }
        
        let $trigger = $('#ct-tag-trigger');
        if (tagData) {
            $trigger.css('background', tagData.color).css('border-color', tagData.color);
        } else {
            $trigger.css('background', 'transparent').css('border-color', '#555');
        }

        $trigger.off('click').on('click', function(e) {
            e.stopPropagation();
            openGlobalTagModal(nodeHash, nodeText, 
                (newTagData) => {
                    // On Save
                    $trigger.css('background', newTagData.color).css('border-color', newTagData.color);
                    let $node = $(`.ct-node[data-hash="${nodeHash}"] > div`);
                    $node.css('border', `3px solid ${newTagData.color}`);
                    $node.css('box-shadow', `0 0 15px ${newTagData.color}`);
                },
                () => {
                    // On Delete
                    $trigger.css('background', 'transparent').css('border-color', '#555');
                    let $nodeDiv = $(`.ct-node[data-hash="${nodeHash}"] > div`);
                    let $nodeParent = $(`.ct-node[data-hash="${nodeHash}"]`);
                    let isNodeActive = $nodeParent.hasClass('active-node');
                    $nodeDiv.css('border', isNodeActive ? '3px solid #8db7d5' : '2px solid rgba(255,255,255,0.2)');
                    $nodeDiv.css('box-shadow', isNodeActive ? '0 0 15px #8db7d5' : ($nodeParent.children('ul').length > 0 ? '0 0 10px #00aaff' : 'none'));
                },
                nodeLooseHash
            );
        });

        $('#ct-delete-btn').off('click').on('click', async function () {
            if (confirm("Вы точно хотите безвозвратно удалить этот свайп (или всё сообщение) и всю ветку, идущую после него?")) {
                let toRestore = buildRestoreArray(toRestoreStack);
                let targetSwipeId = null;
                if (toRestoreStack && toRestoreStack.length > 0) {
                    targetSwipeId = toRestoreStack[toRestoreStack.length - 1].swipeId;
                }
                await deleteBranchTarget(toRestore, targetSwipeId);
                $(this).closest('#chat-tree-modal').remove();
                if (typeof showTreeModal === 'function') setTimeout(showTreeModal, 200);
            }
        });

        $('#ct-jump-btn').off('click').on('click', async function () {
            syncMesAndSwipesGlobal(coreChat);
            let safeToRestore = buildRestoreArray(toRestoreStack);

            // ПАТЧ: Очищенная проверка совпадений для безопасного прыжка
            for (let i = 0; i < safeToRestore.length; i++) {
                if (coreChat[i]) {
                    let rSwipes = safeToRestore[i].swipes || [safeToRestore[i].mes];
                    let cSwipes = coreChat[i].swipes || [coreChat[i].mes];
                    
                    let rMesClean = (safeToRestore[i].mes || "").trim().replace(/\r\n/g, '\n');
                    let cMesClean = (coreChat[i].mes || "").trim().replace(/\r\n/g, '\n');

                    let rSwipesClean = rSwipes.map(s => (s || "").trim().replace(/\r\n/g, '\n'));
                    let cSwipesClean = cSwipes.map(s => (s || "").trim().replace(/\r\n/g, '\n'));

                    let isSameMsg = rSwipesClean.includes(cMesClean) || cSwipesClean.includes(rMesClean);
                    
                    if (!isSameMsg && coreChat[i].send_date && safeToRestore[i].send_date && coreChat[i].send_date === safeToRestore[i].send_date) {
                        isSameMsg = true; // Это то же самое сообщение, просто обновленное пользователем или генератором
                    }

                    if (isSameMsg) {
                        let unifiedObj = unifyMessages(coreChat[i], safeToRestore[i]);
                        let unifiedMsg = unifiedObj.unifiedMsg;

                        let targetText = safeToRestore[i].mes;
                        let cleanTargetText = (targetText || "").trim().replace(/\r\n/g, '\n');
                        
                        let newIdx = unifiedMsg.swipes.findIndex(s => (s || "").trim().replace(/\r\n/g, '\n') === cleanTargetText);
                        
                        if (newIdx === -1) {
                            unifiedMsg.swipes.push(targetText);
                            unifiedMsg.swipe_info = unifiedMsg.swipe_info || [];
                            let infoToPush = safeToRestore[i].swipe_info ? safeToRestore[i].swipe_info[safeToRestore[i].swipe_id] : {};
                            unifiedMsg.swipe_info.push(infoToPush ? { ...infoToPush } : {});
                            newIdx = unifiedMsg.swipes.length - 1;
                        }
                        unifiedMsg.swipe_id = newIdx;
                        unifiedMsg.mes = targetText;
                        unifiedMsg.is_user = safeToRestore[i].is_user;

                        // ПАТЧ: Восстанавливаем extra из целевой ветки, чтобы внешние блоки отображали данные нужного свайпа/ветки
                        if (safeToRestore[i].extra !== undefined) {
                            unifiedMsg.extra = safeToRestore[i].extra;
                        } else {
                            delete unifiedMsg.extra;
                        }

                        safeToRestore[i] = unifiedMsg;
                    }
                }
            }

            // ПАТЧ: Нормализованный поиск точки расхождения
            let divergeIdx = -1;
            for (let i = 0; i < Math.min(coreChat.length, safeToRestore.length); i++) {
                if (!isNodeMatch(coreChat[i], safeToRestore[i])) {
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
                    let cleanParentText = (parentTextInCore || "").trim().replace(/\r\n/g, '\n');
                    
                    let mappedS = -1;
                    if (safeToRestore[parentIdx].swipes) {
                        mappedS = safeToRestore[parentIdx].swipes.findIndex(s => (s || "").trim().replace(/\r\n/g, '\n') === cleanParentText);
                    }
                    if (mappedS === -1) mappedS = safeToRestore[parentIdx].swipe_id || 0;

                    let lostFuture = coreChat.slice(lostStart);
                    if (lostFuture.length > 0 && !isGhost(lostFuture[0])) {
                        if (!safeToRestore[parentIdx].branch_futures) safeToRestore[parentIdx].branch_futures = {};
                        if (!safeToRestore[parentIdx].branch_futures[mappedS]) safeToRestore[parentIdx].branch_futures[mappedS] = [];

                        let existing = safeToRestore[parentIdx].branch_futures[mappedS];
                        if (existing.length > 0 && !Array.isArray(existing[0])) existing = [existing];

                        let cleanLost = cloneChat(lostFuture);

                        let alreadyExists = false;
                        for (let k = 0; k < existing.length; k++) {
                            if (isPathDuplicate(existing[k], cleanLost)) {
                                alreadyExists = true;
                                existing[k] = cleanLost; // Запоминаем самую свежую версию
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

// Функции showTreeModal, createTreeButtonUI и jQuery Ready оставлены без изменений,
// так как вся проблема была исключительно в логике парсинга данных.

function showTreeModal() {
    $('#chat-tree-modal').remove();
    $('#ct-tree-style').remove();

    if (!$('#ct-font-caveat').length) {
        $('head').append('<link id="ct-font-caveat" href="https://fonts.googleapis.com/css2?family=Caveat:wght@400..700&display=swap" rel="stylesheet">');
    }

    $('head').append(`
    <style id="ct-tree-style">
        .ct-tree-container ul { display: flex; justify-content: center; align-items: flex-start; padding-top: 20px; position: relative; }
        .ct-tree-container li { display: flex; flex-direction: column; align-items: center; position: relative; padding: 20px 10px 0 10px; flex-shrink: 0 !important; align-self: flex-start; }
        .ct-tree-container li::before, .ct-tree-container li::after { content: ''; position: absolute; top: 0; width: 50%; height: 20px; box-sizing: border-box; }
        .ct-tree-container li::before { left: 0; right: 50%; border-top: 2px solid rgba(255,255,255,0.3); }
        .ct-tree-container li::after { left: 50%; right: 0; border-top: 2px solid rgba(255,255,255,0.3); border-left: 2px solid rgba(255,255,255,0.3); }
        .ct-tree-container li:first-child::before { border: 0 none; }
        .ct-tree-container li:last-child::after { border: 0 none; }
        .ct-tree-container li:last-child::before { border-right: 2px solid rgba(255,255,255,0.3); border-radius: 0 5px 0 0; }
        .ct-tree-container li:first-child::after { border-radius: 5px 0 0 0; }
        .ct-tree-container li:only-child::before, .ct-tree-container li:only-child::after { display: none; }
        .ct-tree-container li:only-child { padding-top: 0; padding-left: 0; padding-right: 0; }
        .ct-tree-container ul ul::before { content: ''; position: absolute; top: 0; left: 50%; border-left: 2px solid rgba(255,255,255,0.3); width: 0; height: 20px; transform: translateX(-1px); }
        .ct-node { border-radius: 50% !important; background-color: #222; }
        .ct-node.ct-selected > div { box-shadow: 0 0 25px 8px rgba(0, 170, 255, 0.9) !important; border-color: #00aaff !important; }
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
                <!-- ПАТЧ: Переключатель кнопок тегов в чате -->
                <button id="ct-toggle-tags-btn" class="ct-btn" title="Кнопки тегов в чате">
                    <span style="position:relative; width:20px; height:20px; display:flex; align-items:center; justify-content:center;">
                        <span class="ct-tag-toggle-dot" style="width:14px; height:14px; border-radius:50%; border:2px solid #8db7d5; background:#8db7d5; box-sizing:border-box; transition:0.2s;"></span>
                        <span class="ct-tag-toggle-slash" style="display:none; position:absolute; left:-1px; top:9px; width:22px; height:2px; background:#CD5C5C; transform:rotate(-45deg); border-radius:2px;"></span>
                    </span>
                </button>
                <button id="ct-close-btn" class="ct-btn ct-btn-close" title="Закрыть дерево (Esc)">&times;</button>
                
                <!-- ПАТЧ: Глобальный список тегов -->
                <div id="ct-global-tags-list" style="position: absolute; top: 50px; right: 0; display: flex; flex-direction: column; gap: 8px; z-index: 1000; max-height: calc(100vh - 100px); overflow-y: auto; width: 220px;">
                </div>
            </div>
        </div>

        <div id="ct-preview-panel" style="display:none; position:absolute; bottom:80px; left:20px; right:20px; background:#111; border: 2px solid #333; border-radius: 10px; padding: 15px; flex-direction: column; z-index: 10000; max-height: 40vh; max-width: 800px; margin: 0 auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #333; padding-bottom: 10px; margin-bottom: 10px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="color: #8db7d5; font-family: 'Caveat', cursive; font-weight: 600; font-size: 22px; letter-spacing: 0.5px;">Предпросмотр сообщения</span>
                    <!-- ПАТЧ: Кнопка открытия редактора тегов -->
                    <div id="ct-tag-trigger" style="width: 20px; height: 20px; border-radius: 50%; border: 2px solid #555; background: transparent; cursor: pointer; transition: 0.2s;" title="Добавить/изменить тег"></div>
                </div>
                <button id="ct-preview-close" style="background: transparent; border: none; color: #fff; font-size: 20px; cursor: pointer;">&times;</button>
            </div>
            <div id="ct-preview-text" style="color: #ddd; flex: 1; overflow-y: auto; font-size: 14px; line-height: 1.4; margin-bottom: 15px; padding-right: 5px;"></div>

            <div style="display:flex; gap:10px;">
                <button id="ct-jump-btn" style="flex:1; padding:10px; background:#8db7d5; color:#111; border:none; border-radius:5px; cursor:pointer; font-weight:bold; font-size:15px;">ПРЫЖОК</button>
                <button id="ct-delete-btn" style="flex:1; padding:10px; background:#CD5C5C; color:#fff; border:none; border-radius:5px; cursor:pointer; font-weight:bold; font-size:15px;">УДАЛИТЬ</button>
            </div>
        </div>
    </div>`);

    // ПАТЧ: Переключатель отображения кнопок тегов в чате
    function ctRefreshTagToggleBtn() {
        let on = ctSettings().showChatTagButtons;
        let $b = $('#ct-toggle-tags-btn');
        if (!$b.length) return;
        $b.attr('title', on ? 'Кнопки тегов в чате: ВКЛ (нажмите, чтобы скрыть)' : 'Кнопки тегов в чате: ВЫКЛ (нажмите, чтобы показать)');
        $b.css('border-color', on ? 'rgba(141,183,213,0.6)' : 'rgba(255,255,255,0.15)');
        $b.find('.ct-tag-toggle-dot').css({
            'background': on ? '#8db7d5' : 'transparent',
            'border-color': on ? '#8db7d5' : '#777',
            'opacity': on ? '1' : '0.6'
        });
        $b.find('.ct-tag-toggle-slash').css('display', on ? 'none' : 'block');
    }
    ctRefreshTagToggleBtn();

    $('#ct-toggle-tags-btn').on('click', function (e) {
        e.stopPropagation();
        let s = ctSettings();
        s.showChatTagButtons = !s.showChatTagButtons;
        if (typeof saveSettingsDebounced === 'function') saveSettingsDebounced();
        ctRefreshTagToggleBtn();
        updateChatUI();
    });

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
                let hash = $(this).data('hash');
                let text = window.ctNodeTextMap[id] || "";
                
                let tagText = "";
                if (coreChat && coreChat.length > 0 && coreChat[0].chat_tree_tags && coreChat[0].chat_tree_tags[hash]) {
                    tagText = (coreChat[0].chat_tree_tags[hash].desc || "").toLowerCase();
                }

                if (text.toLowerCase().includes(val) || (tagText && tagText.includes(val))) {
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

    // ПАТЧ: Функция для фокусировки на произвольном узле
    window.ctCenterOnNode = function($node) {
        if (!$node || !$node.length) return;
        let activeRect = $node[0].getBoundingClientRect();
        let tfRect = tf.getBoundingClientRect();
        let relX = (activeRect.left - tfRect.left + activeRect.width / 2) / scale;
        let relY = (activeRect.top - tfRect.top + activeRect.height / 2) / scale;
        let vpRect = vp.getBoundingClientRect();
        posX = vpRect.width / 2 - relX * scale;
        posY = vpRect.height / 3 - relY * scale;
        tf.style.transition = 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)';
        update();
        setTimeout(() => { tf.style.transition = ''; }, 400);
    };

    $('#ct-center-btn').on('click', function () {
        let activeNodes = $('.active-node');
        if (activeNodes.length > 0) {
            window.ctCenterOnNode(activeNodes.last());
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
    $(document).off("click", "#ct_btn_open_tree").on("click", "#ct_btn_open_tree", function (e) {
        e.stopPropagation();
        showTreeModal();
    });
    setTimeout(syncShadow, 2000);
});