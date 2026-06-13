let coreChat = [
    { mes: "1", is_user: true },
    { mes: "2", is_user: false }
];
let shadowChat = [
    { mes: "1", is_user: true },
    { mes: "2", is_user: false },
    { mes: "3", is_user: true }
];

let deletedPart = shadowChat.slice(coreChat.length);
console.log("Deleted:", deletedPart);
