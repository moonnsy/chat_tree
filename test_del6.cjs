function msgFingerprint(m) {
    if (!m) return "";
    let text = (m.swipes && m.swipes.length > 0 ? m.swipes[0] : m.mes) || "";
    return text.trim().replace(/\r\n/g, '\n');
}

let ancestor = {
    branch_futures: {
        0: [
            [ {mes: "B"}, {mes: "C"} ],
            [ {mes: "B"}, {mes: "D"} ] // This one shouldn't be affected if we delete C
        ]
    }
};

// If pathToDelete is [A, B, C]
// And ancestor is A (index 0).
// pathTail is [B, C].

let pathTail = [ {mes: "B"}, {mes: "C"} ];

for (let swipeKey in ancestor.branch_futures) {
    let futures = ancestor.branch_futures[swipeKey];
    for (let f = futures.length - 1; f >= 0; f--) {
        let candidate = futures[f]; // e.g. [B, C]
        
        // Wait, the logic I wrote checks if candidate matches pathTail:
        let matches = true;
        for (let k = 0; k < pathTail.length; k++) {
            if (k >= candidate.length) {
                matches = false;
                break;
            }
            if (candidate[k].mes !== pathTail[k].mes) {
                matches = false;
                break;
            }
        }
        
        if (matches) {
            let truncateIdx = pathTail.length - 1; // 1
            if (truncateIdx === 0) {
                futures.splice(f, 1);
            } else {
                futures[f] = candidate.slice(0, truncateIdx); // becomes [B]
            }
        }
    }
}
console.log(JSON.stringify(ancestor));
