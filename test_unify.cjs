function cloneChat(chatArray) {
    if (!chatArray) return [];
    return chatArray.map(m => {
        if (!m) return m;
        let cloned = { ...m };
        if (m.branch_futures) {
            cloned.branch_futures = JSON.parse(JSON.stringify(m.branch_futures));
        }
        return cloned;
    });
}
function unifyMessages(baseMsg, incMsg) {
    let clone = cloneChat([baseMsg])[0];
    let baseSwipes = clone.swipes || [clone.mes];
    let incSwipes = incMsg.swipes || [incMsg.mes];

    let baseSwipesInfo = clone.swipes_info || [{}];
    let incSwipesInfo = incMsg.swipes_info || [{}];

    clone.swipes = [...baseSwipes];
    clone.swipes_info = baseSwipesInfo.map(info => info ? { ...info } : info);
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
            existingIdx = i;
        } else {
            existingIdx = clone.swipes.findIndex(s => {
                let sClean = (s || "").trim().replace(/\r\n/g, '\n');
                if (sClean === cleanText) return true;
                return false;
            });
        }
        
        if (existingIdx !== -1) {
            incToBaseMap[i] = existingIdx;
        } else {
            let newIdx = clone.swipes.length;
            clone.swipes.push(text);
            incToBaseMap[i] = newIdx;
        }
    }
    return { unifiedMsg: clone, incToBaseMap: incToBaseMap };
}

let activeMsg = { mes: "A", swipes: ["A", "B"], swipe_id: 0, extra: { img: 1 }, send_date: "123" };
let incMsg = { mes: "B", swipes: ["B", "A"], swipe_id: 0, extra: { img: 2 }, send_date: "123" };

let res = unifyMessages(activeMsg, incMsg);
console.log(res.unifiedMsg.extra);
