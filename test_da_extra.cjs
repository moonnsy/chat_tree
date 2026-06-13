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

    // MY FIX: Sync extra from swipe_info for external blocks
    if (cloned.swipe_info && cloned.swipe_info[s]) {
        if (cloned.swipe_info[s].extra !== undefined) {
            cloned.extra = JSON.parse(JSON.stringify(cloned.swipe_info[s].extra));
        } else {
            delete cloned.extra;
        }
    }

    if (msg.branch_futures) {
        try { cloned.branch_futures = JSON.parse(JSON.stringify(msg.branch_futures)); }
        catch (e) { cloned.branch_futures = {}; }
    }
    return cloned;
}

let stackMsg = {
    extra: { img: "A" },
    swipes: ["A", "B"],
    swipe_info: [
        { extra: { img: "A" } },
        { extra: { img: "B" } }
    ]
};

let safe = cloneMessageWithSwipe(stackMsg, 1);
console.log(safe.extra);
