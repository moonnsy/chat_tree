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

let coreChat = [
    { is_user: true, mes: "A" },
    { is_user: false, mes: "B" }
];
let stack = [
    { is_user: true, mes: "A" },
    { is_user: false, mes: "B" }
];

async function deleteBranchTarget(toRestore) {
    if (!toRestore || toRestore.length === 0) return;

    let divergeIdx = -1;
    for (let i = 0; i < Math.min(coreChat.length, toRestore.length); i++) {
        if (!isNodeMatch(coreChat[i], toRestore[i])) {
            divergeIdx = i;
            break;
        }
    }
    if (divergeIdx === -1) {
        divergeIdx = Math.min(coreChat.length, toRestore.length);
    }
    console.log("divergeIdx:", divergeIdx);

    let deletedAtLeastOne = false;

    if (divergeIdx === toRestore.length) {
        coreChat.length = toRestore.length - 1;
        deletedAtLeastOne = true;
    }
    console.log("coreChat.length after truncate:", coreChat.length);
}

deleteBranchTarget(stack);
