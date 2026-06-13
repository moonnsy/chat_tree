let coreChat = [ {mes:"A"}, {mes:"B"} ];
coreChat[0].branch_futures = {
    0: [
        [ {mes:"B"} ]
    ]
};
// If I use the tree to delete an INACTIVE branch from branch_futures.
// The Tree UI runs deleteBranchTarget with toRestore path.
// Say toRestore is [ {mes:"A"}, {mes:"B"} ].
// divergeIdx = 1.
// divergeIdx === toRestore.length is FALSE (1 !== 2).
// i=0. ancestor = A. pathTail = [B].
// ancestor.branch_futures[0] has [ [{mes:"B"}] ].
// It matches, so truncateIdx = 0 -> futures.splice(f, 1).
// This correctly deletes inactive branches via the tree UI!
