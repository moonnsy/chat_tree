// Assume shadowChat has 3 msgs, coreChat has 2 (last one deleted via ST UI)
let coreChat = [ { is_user: true, mes: "A" }, { is_user: false, mes: "B" } ];
let shadowChat = [ { is_user: true, mes: "A" }, { is_user: false, mes: "B" }, { is_user: true, mes: "C" } ];

let deletedIdx = -1;
for (let i = 0; i < shadowChat.length; i++) {
    // isNodeMatch simplified:
    let match = (i < coreChat.length && shadowChat[i].mes === coreChat[i].mes);
    if (!match) {
        deletedIdx = i;
        break;
    }
}
console.log("deletedIdx:", deletedIdx);
let pathToDelete = shadowChat.slice(0, deletedIdx + 1);
console.log("pathToDelete length:", pathToDelete.length);

// simulate deleteBranchTarget
let divergeIdx = -1;
for (let i = 0; i < Math.min(coreChat.length, pathToDelete.length); i++) {
    let match = (coreChat[i].mes === pathToDelete[i].mes);
    if (!match) {
        divergeIdx = i;
        break;
    }
}
if (divergeIdx === -1) {
    divergeIdx = Math.min(coreChat.length, pathToDelete.length);
}
console.log("deleteBranchTarget divergeIdx:", divergeIdx);
if (divergeIdx === pathToDelete.length) {
    coreChat.length = pathToDelete.length - 1;
}
console.log("coreChat length after:", coreChat.length);
