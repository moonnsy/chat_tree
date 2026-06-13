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

function cloneMessageWithSwipe(msg, s) {
    if (!msg) return msg;
    let cloned = { ...msg };
    cloned.swipe_id = s;
    cloned.mes = Array.isArray(msg.swipes) && msg.swipes.length > s ? msg.swipes[s] : msg.mes;
    if (msg.branch_futures) {
        cloned.branch_futures = JSON.parse(JSON.stringify(msg.branch_futures));
    }
    return cloned;
}

// 1. Initial state: Message with 2 swipes. We are on Swipe 0 with an image.
let coreChat = [
    { mes: "A", swipes: ["A", "B"], swipe_id: 0, extra: { image: "img0.png" } }
];

// 2. User DELETES the image.
delete coreChat[0].extra;

// 3. User opens Tree. Tree parses coreChat.
let toRestoreStack_Swipe1 = [ { msg: coreChat[0], swipeId: 1 } ];

// 4. User jumps to Swipe 1.
let safeToRestore = [ cloneMessageWithSwipe(toRestoreStack_Swipe1[0].msg, toRestoreStack_Swipe1[0].swipeId) ];

// Jump unification logic
for (let i = 0; i < safeToRestore.length; i++) {
    // unify
    let unifiedMsg = cloneChat([coreChat[i]])[0];
    unifiedMsg.swipe_id = safeToRestore[i].swipe_id;
    unifiedMsg.mes = safeToRestore[i].mes;
    if (safeToRestore[i].extra !== undefined) {
        unifiedMsg.extra = safeToRestore[i].extra;
    }
    safeToRestore[i] = unifiedMsg;
}

// Save lost future (divergeIdx = 0)
let lostFuture = coreChat.slice(0);
let cleanLost = cloneChat(lostFuture);
// cleanLost goes into branch_futures, but here we just simulate replacing coreChat
coreChat.length = 0;
safeToRestore.forEach(m => coreChat.push(m));

console.log("coreChat after jump to Swipe 1:", coreChat[0].extra);

// 5. Now user jumps back to Swipe 0.
// Let's assume branch_futures had the cleanLost. But wait, Swipe 0 was the active path initially, so it's in coreChat[0] history?
// Actually, safeToRestore for Swipe 0 would just be built from the stored future.
// The stored future is cleanLost.
console.log("cleanLost extra:", cleanLost[0].extra);
