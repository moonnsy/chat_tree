let msg = { extra: { img: 1 } };
let cloned = { ...msg };
delete msg.extra;
console.log(cloned.extra);
