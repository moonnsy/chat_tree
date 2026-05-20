// Скрипт дедупликации branch_futures во ВСЕХ файлах чатов
const fs = require('fs');
const path = require('path');

const chatDirs = [
    path.join(__dirname, '..', '..', '..', '..', '..', 'data', 'default-user', 'chats'),
    path.join(__dirname, '..', '..', '..', '..', '..', 'data', 'default-user', 'group chats')
];

let totalFiles = 0;
let totalDeduped = 0;

function dedupBranchFutures(msg) {
    if (!msg || !msg.branch_futures) return 0;
    let removed = 0;
    
    for (let swipeKey in msg.branch_futures) {
        let futures = msg.branch_futures[swipeKey];
        if (!Array.isArray(futures)) continue;
        
        // Нормализация: если первый элемент - не массив, оборачиваем
        if (futures.length > 0 && !Array.isArray(futures[0])) {
            futures = [futures];
            msg.branch_futures[swipeKey] = futures;
        }
        
        // Дедупликация по первому сообщению каждой ветки
        let seen = new Map(); // key: mes+is_user → index самой ДЛИННОЙ версии
        let toRemove = [];
        
        for (let i = 0; i < futures.length; i++) {
            let branch = futures[i];
            if (!Array.isArray(branch) || branch.length === 0 || !branch[0]) {
                toRemove.push(i);
                continue;
            }
            
            let key = (branch[0].mes || '').substring(0, 200) + '|||' + String(branch[0].is_user);
            
            if (seen.has(key)) {
                let prevIdx = seen.get(key);
                // Оставляем самую длинную версию
                if (branch.length > futures[prevIdx].length) {
                    toRemove.push(prevIdx);
                    seen.set(key, i);
                } else {
                    toRemove.push(i);
                }
            } else {
                seen.set(key, i);
            }
        }
        
        if (toRemove.length > 0) {
            removed += toRemove.length;
            // Удаляем с конца чтобы не сбивать индексы
            toRemove.sort((a, b) => b - a);
            for (let idx of toRemove) {
                futures.splice(idx, 1);
            }
        }
        
        // Рекурсивно дедуплицируем вложенные сообщения
        for (let branch of futures) {
            if (Array.isArray(branch)) {
                for (let innerMsg of branch) {
                    removed += dedupBranchFutures(innerMsg);
                }
            }
        }
    }
    
    return removed;
}

for (let chatDir of chatDirs) {
    if (!fs.existsSync(chatDir)) {
        console.log('Папка не найдена: ' + chatDir);
        continue;
    }
    
    // Ищем все .jsonl файлы (включая подпапки для обычных чатов)
    function processDir(dir) {
        let entries = fs.readdirSync(dir, { withFileTypes: true });
        for (let entry of entries) {
            let fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                processDir(fullPath);
            } else if (entry.name.endsWith('.jsonl')) {
                totalFiles++;
                let lines = fs.readFileSync(fullPath, 'utf8').split('\n');
                let modified = false;
                let fileDeduped = 0;
                
                let newLines = [];
                for (let line of lines) {
                    if (!line.trim()) continue;
                    try {
                        let msg = JSON.parse(line);
                        let removed = dedupBranchFutures(msg);
                        if (removed > 0) {
                            modified = true;
                            fileDeduped += removed;
                        }
                        newLines.push(JSON.stringify(msg));
                    } catch (e) {
                        newLines.push(line); // Оставляем как есть
                    }
                }
                
                if (modified) {
                    fs.writeFileSync(fullPath, newLines.join('\n') + '\n');
                    totalDeduped += fileDeduped;
                    console.log(`ОЧИЩЕН: ${fullPath} (удалено ${fileDeduped} дублей)`);
                }
            }
        }
    }
    
    processDir(chatDir);
}

console.log(`\nИТОГО: Обработано ${totalFiles} файлов, удалено ${totalDeduped} дублирующих веток.`);
