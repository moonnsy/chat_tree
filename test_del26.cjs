let coreChat = [ {mes:"A"}, {mes:"B"} ];
coreChat[0].branch_futures = { 0: [ [ {mes:"B"} ] ] };
let toRestore = [ {mes:"A"}, {mes:"B"} ];
// Tree delete:
let divergeIdx = 1; // wait, isNodeMatch(A, A) is true. isNodeMatch(B, B) is true.
// so divergeIdx = 2!
// coreChat.length = 1.
// i = 0.
// ancestor is coreChat[0] (which is A).
// pathTail is [B].
// futures has [ {mes:"B"} ].
// matches. futures.splice(0, 1).
// So branch_futures BECOMES EMPTY.
// deletedAtLeastOne = true.
// saveChatConditional() -> ST saves coreChat to disk.
// The file on disk now has A, with NO branch_futures.
// reloadCurrentChat() -> ST reloads from disk.
// UI updates to show just A.
// IT SHOULD WORK FOR TREE UI DELETION.
