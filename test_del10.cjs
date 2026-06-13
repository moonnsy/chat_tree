// Let's reproduce "try to delete all swipes"
// 1. Message 1 has Swipe A and Swipe B.
// 2. You open ST UI and delete Message 1 entirely (clicks garbage bin).
// ST deletes Message 1 from coreChat.
// coreChat is empty. shadowChat was [Message1].
// pathToDelete is [Message1].
// deleteBranchTarget runs with [Message1].
// It checks branch_futures of ... nothing, because ancestor is index -1.
// So branch_futures are NOT scrubbed if they lived on earlier messages?
// Wait, if Message 1 is index 0, it has NO ancestors.
// Then how can it survive?
// Unless ST UI delete only deletes the ACTIVE swipe?
