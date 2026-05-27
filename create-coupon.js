const fs = require('fs');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Read env file and extract multiline FIREBASE_SERVICE_ACCOUNT_KEY
const envContent = fs.readFileSync('/Users/marianonoceti/Desktop/Antigravity/StoryHuntABM/.env.local', 'utf8');

// Find the key - it starts with FIREBASE_SERVICE_ACCOUNT_KEY= and the JSON starts with {
const startMarker = 'FIREBASE_SERVICE_ACCOUNT_KEY=';
const startIdx = envContent.indexOf(startMarker);
if (startIdx === -1) { console.error('Key not found'); process.exit(1); }

let jsonStart = startIdx + startMarker.length;
// Find the matching closing brace
let braceCount = 0;
let jsonEnd = jsonStart;
for (let i = jsonStart; i < envContent.length; i++) {
    if (envContent[i] === '{') braceCount++;
    if (envContent[i] === '}') braceCount--;
    if (braceCount === 0 && envContent[i] === '}') { jsonEnd = i + 1; break; }
}

const keyJson = envContent.substring(jsonStart, jsonEnd);
const app = initializeApp({ credential: cert(JSON.parse(keyJson)) });
const db = getFirestore(app);

db.collection('discount_coupons').add({
    code: 'STORYHUNT',
    discount_type: 'percent',
    discount_value: 100,
    max_redemptions: 100,
    times_redeemed: 0,
    valid_until: '2099-12-31T23:59:59.000Z',
    status: 'active',
    stripe_coupon_id: 'vioDOA1O',
    stripe_promo_id: 'promo_1TK1sTL7BKrNVx2ivi9sK1TT',
    created_at: new Date().toISOString(),
}).then(ref => { console.log('Created coupon:', ref.id); process.exit(0); })
  .catch(e => { console.error(e.message); process.exit(1); });
