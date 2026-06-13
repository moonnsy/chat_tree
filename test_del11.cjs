// What if deleting via Tree UI?
let coreChat = [ {mes:"A"} ]; // Message 1
coreChat[0].branch_futures = { 0: [], 1: [ [ {mes:"C"} ] ] }; // Message 1 has a future. Wait, branch_futures are stored on the parent.
// If Message 1 is index 0, its branch_futures are on index -1 ? No, they are on index 0 for its OWN children.
// But what about its own alternative swipes?
// Swipes of index 0 are stored as coreChat[0].swipes.
// They are NOT in branch_futures! branch_futures only stores children!
// Ah! branch_futures stores the paths that come AFTER the current message.
// What about the alternate swipes of the current message? They are in coreChat[0].swipes!
// If we delete the message via Tree UI, we just truncate coreChat.
// What if we delete an alternate swipe of the message?
