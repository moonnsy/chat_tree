function unifyMessages(baseMsg, incMsg) {
    let clone = { ...baseMsg };
    clone.swipes = [...baseMsg.swipes];
    clone.swipe_info = baseMsg.swipe_info.map(info => info ? JSON.parse(JSON.stringify(info)) : info);
    
    let incToBaseMap = {};
    let sameMessage = true;
    for (let i = 0; i < incMsg.swipes.length; i++) {
        let existingIdx = i; // simplified sameMessage logic
        incToBaseMap[i] = existingIdx;
    }
    return { unifiedMsg: clone, incToBaseMap: incToBaseMap };
}

let coreChat = [{
    mes: "A", swipes: ["A", "B"], swipe_id: 0,
    swipe_info: [{extra: {img: "A"}}, {extra: {img: "B"}}]
}];

// User deletes image A
delete coreChat[0].swipe_info[0].extra;
let shadowChat = JSON.parse(JSON.stringify(coreChat));

// Jump to swipe 1
// Save future
let future = JSON.parse(JSON.stringify(shadowChat));
// incMsg for jump
let incMsg = JSON.parse(JSON.stringify(coreChat[0]));
incMsg.swipe_id = 1;

let unified = unifyMessages(coreChat[0], incMsg).unifiedMsg;
// The patch in jump-btn:
if (incMsg.extra !== undefined) {
    unified.extra = incMsg.extra;
} else {
    delete unified.extra;
}
coreChat[0] = unified;

// User jumps BACK to swipe 0
let incMsgBack = JSON.parse(JSON.stringify(future[0]));
let unifiedBack = unifyMessages(coreChat[0], incMsgBack).unifiedMsg;
if (incMsgBack.extra !== undefined) {
    unifiedBack.extra = incMsgBack.extra;
} else {
    delete unifiedBack.extra;
}
coreChat[0] = unifiedBack;

console.log(JSON.stringify(coreChat[0].swipe_info));
