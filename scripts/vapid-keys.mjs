// Prints a new VAPID key pair for push notifications. Run: node scripts/vapid-keys.mjs
// Changing keys makes every device subscribe again (the Notifications page asks once more).
import { webcrypto as crypto } from 'node:crypto';
const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
const pub = Buffer.from(await crypto.subtle.exportKey('raw', pair.publicKey)).toString('base64url');
const { d } = await crypto.subtle.exportKey('jwk', pair.privateKey);
console.log(`VAPID_PUBLIC_KEY=${pub}\nVAPID_PRIVATE_KEY=${d}`);
