// IF user is in Tree UI and clicks Delete.
// deleteBranchTarget runs.
// divergeIdx === toRestore.length is TRUE.
// coreChat.length = toRestore.length - 1. (truncates)
// deletedAtLeastOne = true.
// saveChatConditional() runs.
// reloadCurrentChat() runs.
// And it STILL doesn't work?
// Why?
// Because reloadCurrentChat is asynchronous?
// `await reloadCurrentChat()`
// What if it throws?
// In index.js line 922:
// `if (typeof showTreeModal === 'function') setTimeout(showTreeModal, 200);`
// If `reloadCurrentChat` throws, the tree modal won't show. Does the modal close? Yes. Does it reopen? If it doesn't throw.

// Let's look at ST's reloadCurrentChat:
// `export const reloadCurrentChat = reloadChatMutex.update.bind(reloadChatMutex);`
// WAIT. If we just `coreChat.length = 1` and `await saveChatConditional()`,
// and then `reloadCurrentChat()`, ST *should* wipe it from the UI!
// Why would the user say "messages still not deleted at all"?
// MAYBE the ghost branch is generated AFTER reload?
// If syncShadow runs and sees `branch_futures` has it?
// IF we delete an ACTIVE branch, branch_futures is NOT scrubbed because the active branch was NEVER in branch_futures!
// Wait. Active branches ARE NOT IN `branch_futures`!
// They are in `coreChat`!
// If we truncate `coreChat`, the active branch is GONE.
// Where could it possibly come back from?
// Could `branch_futures` of the parent have a copy of the active branch?
