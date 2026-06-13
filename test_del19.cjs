// User: "when you try to delete all swipes"
// "messages still not deleted at all, neither through ST nor through tree"
// "when you try to delete all swipes" -> this implies the user is in the Tree UI, clicking "DELETE" on a node that happens to have NO alternate swipes?
// OR maybe they click DELETE on a node in Tree UI, and then what?
// Let's trace Tree UI delete again.
// toRestore = buildRestoreArray(toRestoreStack).
// If user deletes message B via Tree UI.
// coreChat = [A, B]
// toRestore = [A, B]
// divergeIdx = 2. toRestore.length = 2.
// divergeIdx === toRestore.length => true. coreChat.length = 1.
// saveChatConditional() is called.
// BUT... when we truncate coreChat via `coreChat.length = 1`, does ST actually delete it from DOM?
// NO! `coreChat` in index.js is an imported reference to `chat` array from ST.
// Setting `chat.length = 1` just truncates the array. It does NOT remove the DOM elements in ST!
