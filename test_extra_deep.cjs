let m1 = { extra: { a: 1 } };
let m2 = { ...m1 };
m2.extra.a = 2;
console.log(m1.extra.a); // Will be 2

// How to safely clone extra?
function safeCloneExtra(extra) {
    if (!extra) return extra;
    if (typeof extra !== 'object') return extra;
    let newExtra = {};
    for (let k in extra) {
        // If it's a DOM node or complex object, we might just copy reference?
        // Let's just JSON deep copy it, catching errors?
        try {
            newExtra[k] = JSON.parse(JSON.stringify(extra[k]));
        } catch(e) {
            newExtra[k] = extra[k]; // fallback to shallow
        }
    }
    return newExtra;
}
m1 = { extra: { a: 1, dom: { nodeType: 1 } } };
m2 = { ...m1, extra: safeCloneExtra(m1.extra) };
m2.extra.a = 2;
console.log(m1.extra.a); // 1!
