let coreChat = [ {mes:"A"} ]; // Suppose it's just A now.
// Does ST or Tree UI somehow restore it?
// Look at syncShadow.
// syncShadow is called on CHAT_CHANGED.
// But wait! When Tree UI deletes, it calls saveChatConditional().
// ST might emit CHAT_CHANGED.
// And syncShadow just updates shadowChat.
