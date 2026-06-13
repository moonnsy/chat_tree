function isPathDuplicate(pathA, pathB) {
    if (!pathA || !pathB) return false;
    if (pathA.length !== pathB.length) return false;
    for (let i = 0; i < pathA.length; i++) {
        if (pathA[i].mes !== pathB[i].mes) return false;
    }
    return true;
}

// But wait, pathToDelete might be longer than the candidate!
// If candidate is [2], and pathToDelete is [2, 3].
// If we delete [2, 3], we should remove [2] ? No, we are deleting the node 3! Wait.
// If pathToDelete is [0, 1, 2].
// It means node 2 was deleted.
// We should remove ANY candidate that exactly matches pathTail OR candidate starts with pathTail!
