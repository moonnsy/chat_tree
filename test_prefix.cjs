function isNodeMatch(a, b) {
    if (!a || !b) return a === b;
    if (String(a.is_user) !== String(b.is_user)) return false;
    if (a.send_date && b.send_date && a.send_date === b.send_date) return true;
    
    let aMes = (a.mes || "").trim().replace(/\r\n/g, '\n');
    let bMes = (b.mes || "").trim().replace(/\r\n/g, '\n');
    if (aMes === bMes) return true;

    let aNoSrc = aMes.replace(/src="[^"]*"/g, '').replace(/\[IMG:GEN\]/g, '').trim();
    let bNoSrc = bMes.replace(/src="[^"]*"/g, '').replace(/\[IMG:GEN\]/g, '').trim();
    if (aNoSrc === bNoSrc && aNoSrc.length > 0) return true;

    return false;
}

function isPathPrefix(fullPath, prefixPath) {
    if (!fullPath || !prefixPath) return false;
    if (fullPath.length < prefixPath.length) return false;
    for (let i = 0; i < prefixPath.length; i++) {
        if (!isNodeMatch(fullPath[i], prefixPath[i])) return false;
    }
    return true;
}

let cand = [ { is_user: true, send_date: 123, mes: "A" }, { is_user: false, send_date: 456, mes: "B" } ];
let tail = [ { is_user: true, send_date: 123, mes: "A updated" }, { is_user: false, send_date: 456, mes: "B" } ];

console.log(isPathPrefix(cand, tail));
