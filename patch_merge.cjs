const fs = require('fs');
let code = fs.readFileSync('index.js', 'utf8');

const unifyFunc = `function unifyMessages(baseMsg, incMsg) {
    let clone = cloneChat([baseMsg])[0];
    let baseSwipes = clone.swipes || [clone.mes];
    let incSwipes = incMsg.swipes || [incMsg.mes];
    
    clone.swipes = [...baseSwipes];
    clone.branch_futures = clone.branch_futures || {};
    
    let incToBaseMap = {};
    
    for (let i = 0; i < incSwipes.length; i++) {
        let text = incSwipes[i];
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
            if (!clone.branch_futures[mappedS]) {
                clone.branch_futures[mappedS] = cloneChat(incMsg.branch_futures[s]);
            } else {
                clone.branch_futures[mappedS].push(...cloneChat(incMsg.branch_futures[s]));
            }
        }
    }
    
    return { unifiedMsg: clone, incToBaseMap: incToBaseMap };
}

`;

const newMergedPathsBlock = `        let mergedPaths = [];
        childrenPaths.forEach(cp => {
            let path = cp.path;
            if (!path || path.length === 0) return;

            let isPathActive = cp.isNativelyActive;
            let matchIdx = mergedPaths.findIndex(p => p.path[0].is_user === path[0].is_user && String(p.path[0].name).trim() === String(path[0].name).trim());

            if (matchIdx === -1) {
                let vFutures = [];
                if (path.length > 1) {
                    vFutures.push({ tail: path.slice(1), parentSwipe: path[0].swipe_id || 0, isNativelyActive: isPathActive });
                }
                mergedPaths.push({ path: [path[0]], isActive: isPathActive, virtualFutures: vFutures });
            } else {
                let existing = mergedPaths[matchIdx];
                let unifiedResult = unifyMessages(existing.path[0], path[0]);
                existing.path[0] = unifiedResult.unifiedMsg;
                
                if (path.length > 1) {
                    let oldSwipe = path[0].swipe_id || 0;
                    let mappedSwipe = unifiedResult.incToBaseMap[oldSwipe];
                    existing.virtualFutures.push({ 
                        tail: path.slice(1), 
                        parentSwipe: mappedSwipe, 
                        isNativelyActive: isPathActive 
                    });
                }
                
                if (isPathActive) {
                    existing.isActive = true;
                    let actOldSwipe = path[0].swipe_id || 0;
                    let actMappedSwipe = unifiedResult.incToBaseMap[actOldSwipe];
                    existing.path[0].swipe_id = actMappedSwipe;
                    existing.path[0].mes = existing.path[0].swipes[actMappedSwipe];
                }
            }
        });`;

let pArrayStart = code.indexOf('function parseArray(msgArray');
code = code.substring(0, pArrayStart) + unifyFunc + code.substring(pArrayStart);

let mpStart = code.indexOf('let mergedPaths = [];');
let mpEndMarker = '        let childrenNodes = [];';
let mpEnd = code.indexOf(mpEndMarker, mpStart);

if (mpStart !== -1 && mpEnd !== -1) {
    code = code.substring(0, mpStart) + newMergedPathsBlock + '\n\n' + code.substring(mpEnd);
    fs.writeFileSync('index.js', code, 'utf8');
    console.log('Patched merge logic!');
} else {
    console.log('Failed to find replace markers');
}
