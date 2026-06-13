// Ah, look at deleteBranchTarget:
/*
    if (deletedAtLeastOne) {
        if (typeof saveChatConditional === 'function') await saveChatConditional();
        if (typeof reloadCurrentChat === 'function') await reloadCurrentChat();
    }
*/
// reloadCurrentChat Unsafely clears the chat and reloads it from disk.
// And it emits CHAT_CHANGED.
// This triggers syncShadow!
// So syncShadow overwrites shadowChat with the freshly reloaded chat.
// BUT wait, is there a problem with how it cleans branch_futures?
