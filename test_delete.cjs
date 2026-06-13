const fs = require('fs');

function msgFingerprint(msg) {
    if (!msg) return "";
    let clean = (msg.mes || "").trim().replace(/\r\n/g, '\n');
    let short = clean.substring(0, 100);
    return short + "|||" + msg.is_user;
}

let coreChat = [
    { mes: "1", is_user: true },
    { mes: "2", is_user: false },
    { mes: "3", is_user: true }
];

coreChat[0].branch_futures = {
    0: [
        [ { mes: "2", is_user: false }, { mes: "3", is_user: true } ]
    ]
};

let toRestore = [
    { mes: "1", is_user: true },
    { mes: "2", is_user: false },
    { mes: "3", is_user: true }
];

let divergeIdx = -1;
for (let i = 0; i < Math.min(coreChat.length, toRestore.length); i++) {
    if (coreChat[i].mes !== toRestore[i].mes) { divergeIdx = i; break; }
}
if (divergeIdx === -1) divergeIdx = Math.min(coreChat.length, toRestore.length);

console.log("divergeIdx", divergeIdx);
if (divergeIdx === toRestore.length) {
    // ACTIVE BRANCH CASE
    coreChat.length = toRestore.length - 1; 
    console.log("Truncated coreChat to length", coreChat.length);
}

console.log("coreChat[0].branch_futures", JSON.stringify(coreChat[0].branch_futures));
