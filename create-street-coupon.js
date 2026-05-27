/**
 * Creates the STREET coupon (sticker campaign founder access) in BOTH Stripe
 * (coupon + promotion code) and Firestore (discount_coupons doc). Idempotent:
 * re-running reuses an existing STREET promo / Firestore doc instead of duping.
 *
 * Run from the project root:  node create-street-coupon.js
 */
const PROJECT_DIR = '/Users/marianonoceti/Desktop/Antigravity/StoryHuntABM';

// Load .env.local exactly the way Next.js does, so process.env matches the app.
require('@next/env').loadEnvConfig(PROJECT_DIR);

// Same tolerant parser the app uses (handles dotenv-mangled \n in private_key).
function parseServiceAccount(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    let out = '';
    let inStr = false;
    let escaped = false;
    for (const c of raw) {
      if (escaped) { out += c; escaped = false; continue; }
      if (c === '\\') { out += c; escaped = true; continue; }
      if (c === '"') { inStr = !inStr; out += c; continue; }
      if (inStr) {
        if (c === '\n') { out += '\\n'; continue; }
        if (c === '\r') { out += '\\r'; continue; }
        if (c === '\t') { out += '\\t'; continue; }
      }
      out += c;
    }
    return JSON.parse(out);
  }
}

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_KEY) { console.error('STRIPE_SECRET_KEY missing'); process.exit(1); }
const Stripe = require('stripe');
// Pin a stable apiVersion: the account default is newer (Basil) and rejects the
// `coupon` param on promotionCodes.create. 2024-06-20 accepts it.
const stripe = new Stripe(STRIPE_KEY, { apiVersion: '2024-06-20' });

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const app = initializeApp({ credential: cert(parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)) });
const db = getFirestore(app);

const CODE = 'STREET';
const PERCENT_OFF = 100;          // founder access = free (matches founders/STORYHUNT)
const MAX_REDEMPTIONS = 1000;
const VALID_UNTIL = '2099-12-31T23:59:59.000Z';

(async () => {
  // 1. Reuse an existing STREET promotion code if present (idempotent)
  let promo = (await stripe.promotionCodes.list({ code: CODE, limit: 1 })).data[0];
  let couponId;

  if (promo) {
    couponId = typeof promo.coupon === 'string' ? promo.coupon : promo.coupon.id;
    console.log(`↺ Reusing existing Stripe promo ${promo.id} (coupon ${couponId})`);
  } else {
    const coupon = await stripe.coupons.create({
      percent_off: PERCENT_OFF,
      duration: 'once',
      name: 'STREET — sticker founder access',
    });
    couponId = coupon.id;
    promo = await stripe.promotionCodes.create({
      coupon: couponId,
      code: CODE,
      max_redemptions: MAX_REDEMPTIONS,
      active: true,
    });
    console.log(`✓ Created Stripe coupon ${couponId} + promo ${promo.id} (code ${CODE})`);
  }

  // 2. Upsert the Firestore discount_coupons doc (checkout looks here first)
  const existing = await db.collection('discount_coupons').where('code', '==', CODE).limit(1).get();
  const docData = {
    code: CODE,
    discount_type: 'percent',
    discount_value: PERCENT_OFF,
    max_redemptions: MAX_REDEMPTIONS,
    times_redeemed: 0,
    valid_until: VALID_UNTIL,
    status: 'active',
    stripe_coupon_id: couponId,
    stripe_promo_id: promo.id,
  };

  if (existing.empty) {
    const ref = await db.collection('discount_coupons').add({ ...docData, created_at: new Date().toISOString() });
    console.log(`✓ Created Firestore discount_coupons/${ref.id}`);
  } else {
    const ref = existing.docs[0].ref;
    await ref.update(docData);
    console.log(`✓ Updated Firestore discount_coupons/${ref.id}`);
  }

  console.log(`\nDONE — ${CODE} = ${PERCENT_OFF}% off, promo ${promo.id}`);
  process.exit(0);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
