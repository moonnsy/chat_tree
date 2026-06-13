let shadowChat = [ { mes: "A" }, { mes: "B" }, { mes: "C" } ];
let coreChat = [ { mes: "A" }, { mes: "B" } ];

// ST UI triggers MESSAGE_DELETED
if (shadowChat && coreChat && coreChat.length < shadowChat.length) {
    let deletedIdx = -1;
    for (let i = 0; i < shadowChat.length; i++) {
        if (i >= coreChat.length || shadowChat[i].mes !== coreChat[i].mes) {
            deletedIdx = i;
            break;
        }
    }
    if (deletedIdx !== -1) {
        let pathToDelete = shadowChat.slice(0, deletedIdx + 1); // [A, B, C]
        console.log("passing to deleteBranchTarget:", pathToDelete);
    }
}
