import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();
console.log("Public key (goes in assets/js/app.js as VAPID_PUBLIC_KEY, safe to commit):");
console.log(keys.publicKey);
console.log("\nPrivate key (add ONLY as the GitHub secret VAPID_PRIVATE_KEY, never commit):");
console.log(keys.privateKey);
