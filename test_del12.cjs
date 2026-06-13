// User: "when you try to delete all swipes"
// "messages still not deleted at all, neither through ST nor through tree"
// Wait. If you delete a message via ST UI, it removes it from coreChat.
// Why does it come back?
// Because it was saved in branch_futures of the PREVIOUS message!
let coreChat = [ {mes:"A", branch_futures: {0: [ [ {mes:"B", swipes:["B", "B2"]} ] ]} } ];
// coreChat[0] is A.
// In ST UI, user is on message B (index 1). User clicks delete.
// pathToDelete is [A, B].
// deleteBranchTarget runs with [A, B].
// i=0. ancestor is A. pathTail is [B].
// ancestor.branch_futures[0] has [ [ {mes:"B"} ] ].
// candidate is [ {mes:"B"} ].
// matches = true.
// truncateIdx = pathTail.length - 1 = 1 - 1 = 0.
// futures.splice(f, 1) -> branch_futures is now empty!
// So it SHOULD scrub it.
// Why does it fail?
