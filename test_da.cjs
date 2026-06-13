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
            try { return info ? JSON.parse(JSON.stringify(info)) : info; }
            catch(e) { return info ? { ...info } : info; }
        });
    }
    cloned.swipe_id = s;
    cloned.mes = Array.isArray(msg.swipes) && msg.swipes.length > s ? msg.swipes[s] : msg.mes;
    if (msg.branch_futures) cloned.branch_futures = JSON.parse(JSON.stringify(msg.branch_futures));
    return cloned;
}

let coreChat = [
    {
        is_user: false,
        mes: "Hello",
        swipes: ["Hello", "Hi"],
        swipe_id: 0,
        send_date: 100,
        extra: { extblocks: "IMG_A" },
        swipe_info: [ { extra: { extblocks: "IMG_A" } }, { extra: { extblocks: "IMG_B" } } ]
    }
];

// Tree is opened. toRestoreStack for Swipe 1
let stack = [ { msg: coreChat[0], swipeId: 1 } ];

let safeToRestore = stack.map(item => cloneMessageWithSwipe(item.msg, item.swipeId));

console.log("safeToRestore[0].swipe_info before jump:", JSON.stringify(safeToRestore[0].swipe_info));
console.log("safeToRestore[0].extra before jump:", JSON.stringify(safeToRestore[0].extra));

// Jump Logic
let cSwipesClean = coreChat[0].swipes;
let rSwipesClean = safeToRestore[0].swipes;
let isSameMsg = true;

if (isSameMsg) {
    // unifyMessages logic
    let unifiedMsg = cloneMessageWithSwipe(coreChat[0], coreChat[0].swipe_id);
    // Unify swipes... skipping actual unify loop, let's assume it keeps them.
    // wait, unifyMessages logic DOES keep base swipe_info!
    // base is coreChat[0]!
    
    // Jump btn sets extra:
    if (safeToRestore[0].extra !== undefined) {
        unifiedMsg.extra = safeToRestore[0].extra;
    } else {
        delete unifiedMsg.extra;
    }
    // unifiedMsg gets put into coreChat!
    safeToRestore[0] = unifiedMsg;
}

console.log("unifiedMsg swipe_info after jump:", JSON.stringify(safeToRestore[0].swipe_info));
console.log("unifiedMsg extra after jump:", JSON.stringify(safeToRestore[0].extra));
