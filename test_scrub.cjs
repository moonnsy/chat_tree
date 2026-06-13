function msgFingerprint(msg) {
    if (!msg) return "";
    let clean = (msg.mes || "").trim().replace(/\r\n/g, '\n');
    let short = clean.substring(0, 100);
    return short + "|||" + msg.is_user;
}

function scrubPathFromTree(coreChat, pathToDelete) {
    if (!pathToDelete || pathToDelete.length === 0) return;
    
    // First, if it's the active path, truncate coreChat
    let divergeIdx = -1;
    for (let i = 0; i < Math.min(coreChat.length, pathToDelete.length); i++) {
        if (coreChat[i].mes !== pathToDelete[i].mes) {
            divergeIdx = i;
            break;
        }
    }
    if (divergeIdx === -1) divergeIdx = Math.min(coreChat.length, pathToDelete.length);
    
    if (divergeIdx === pathToDelete.length) {
        // Active path: truncate
        coreChat.length = pathToDelete.length - 1;
    }
    
    // Now scrub from ALL branch_futures in coreChat
    for (let i = 0; i < coreChat.length; i++) {
        let ancestor = coreChat[i];
        if (!ancestor || !ancestor.branch_futures) continue;
        
        // If the pathToDelete diverged at some point, it might be stored here
        // Wait, pathToDelete must match the ancestor up to index i.
        // Actually, let's just use fingerprint matching to be safe.
        // What does pathToDelete look like AFTER the ancestor?
        let pathTail = pathToDelete.slice(i + 1);
        if (pathTail.length === 0) continue;
        
        for (let swipeKey in ancestor.branch_futures) {
            let futures = ancestor.branch_futures[swipeKey];
            if (!Array.isArray(futures)) continue;
            
            for (let f = futures.length - 1; f >= 0; f--) {
                let candidate = futures[f];
                if (!Array.isArray(candidate) || candidate.length === 0) continue;
                
                // Compare candidate[0] with pathTail[0]
                if (msgFingerprint(candidate[0]) === msgFingerprint(pathTail[0])) {
                    futures.splice(f, 1);
                }
            }
        }
    }
}

let coreChat = [
    { mes: "0" }, { mes: "1" }, { mes: "2" }
];
coreChat[1].branch_futures = {
    0: [ [ {mes: "2"} ] ]
};

scrubPathFromTree(coreChat, [{mes:"0"}, {mes:"1"}, {mes:"2"}]);
console.log(coreChat.length);
console.log(JSON.stringify(coreChat[1].branch_futures));
