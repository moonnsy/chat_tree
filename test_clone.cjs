let coreChat = [ { mes: "1", extra: { a: 1 } } ];
let m = coreChat[0];
let cloned = { ...m };
console.log(cloned.extra === coreChat[0].extra);
