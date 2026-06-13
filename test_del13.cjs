function isNodeMatch(a, b) {
    if (!a || !b) return a === b;
    let aUser = String(a.is_user) === 'true';
    let bUser = String(b.is_user) === 'true';
    if (aUser !== bUser) return false;

    if (a.send_date && b.send_date && a.send_date === b.send_date) return true;

    let aMes = (a.mes || "").trim().replace(/\r\n/g, '\n');
    let bMes = (b.mes || "").trim().replace(/\r\n/g, '\n');
    if (aMes === bMes) return true;

    let aNoSrc = aMes.replace(/src="[^"]*"/g, '').replace(/\[IMG:GEN\]/g, '').trim();
    let bNoSrc = bMes.replace(/src="[^"]*"/g, '').replace(/\[IMG:GEN\]/g, '').trim();
    if (aNoSrc === bNoSrc && aNoSrc.length > 0) return true;

    return false;
}

let shadowChat = [ { is_user: true, mes: "A" }, { is_user: false, mes: "B" } ];
let coreChat = [ { is_user: true, mes: "A" } ];

let deletedIdx = -1;
for (let i = 0; i < shadowChat.length; i++) {
    if (i >= coreChat.length || !isNodeMatch(shadowChat[i], coreChat[i])) {
        deletedIdx = i;
        break;
    }
}
let pathToDelete = shadowChat.slice(0, deletedIdx + 1); // [A, B]

// Wait! If shadowChat is [A, B], and coreChat is [A].
// deletedIdx will be 1 (which is B).
// pathToDelete will be shadowChat.slice(0, 2) => [A, B].
// This is correct!

let toRestore = [ { is_user: true, mes: "A" }, { is_user: false, mes: "B" } ];
// deleteBranchTarget runs:
let divergeIdx = -1;
for (let i = 0; i < Math.min(coreChat.length, toRestore.length); i++) {
    // Math.min(1, 2) = 1.
    // i=0. isNodeMatch(coreChat[0], toRestore[0]) -> A vs A -> true.
}
if (divergeIdx === -1) {
    divergeIdx = Math.min(coreChat.length, toRestore.length); // 1
}

// divergeIdx is 1. toRestore.length is 2.
// divergeIdx === toRestore.length is FALSE.
// SO deletedAtLeastOne remains FALSE (unless branch_futures scrub does something).

for (let i = 0; i < toRestore.length - 1; i++) {
    // toRestore is [A, B]. length=2.
    // loop runs for i=0.
    let ancestor = coreChat[0]; // A
    let pathTail = toRestore.slice(1); // [B]
    
    // Now scrub B from A's branch_futures.
    // IF B is in branch_futures, it gets deleted, deletedAtLeastOne = true.
    // BUT what if B is NOT in branch_futures?
    // What if B was the ACTIVE branch, and had no alternate swipes?
    // Then branch_futures is empty!
    // And deletedAtLeastOne remains FALSE.
    // And ST never saves! Wait, ST saves natively. But tree doesn't reload.
    // Is that a problem? No, because ST already removed B from coreChat.
    // SO WHERE DOES IT COME FROM?
}
