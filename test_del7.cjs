// What if deleting via Tree UI?
let coreChat = [ {mes:"A"}, {mes:"B"}, {mes:"C"} ];
// Tree delete passes:
let toRestore = [ {mes:"A"}, {mes:"B"}, {mes:"C"} ];
// divergeIdx will be 3. divergeIdx === toRestore.length is true.
// coreChat.length = 2.
// Then loop: for (i = 0; i < 3 - 1 = 2; i++)
// i=0 (A): pathTail = [B, C]. truncateIdx = 1. candidate [B,C] -> [B].
// i=1 (B): pathTail = [C]. truncateIdx = 0. candidate [C] -> removed.
// Works for Tree UI!
// Why does Tree UI fail?
