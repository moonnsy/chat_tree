let coreChat = [ { mes: "1", extra: { active: true } } ];
let safeToRestore = [ { mes: "1", extra: { old: true } } ];

for (let i = 0; i < safeToRestore.length; i++) {
    if (coreChat[i]) {
        let isSameMsg = coreChat[i].mes === safeToRestore[i].mes;
        if (isSameMsg) {
            // chat_tree currently does:
            // unifiedMsg.extra = safeToRestore[i].extra;
            // It SHOULD do:
            // unifiedMsg.extra = coreChat[i].extra; // KEEP LIVE EXTRA!
            safeToRestore[i].extra = coreChat[i].extra;
        }
    }
}
console.log(safeToRestore[0].extra);
