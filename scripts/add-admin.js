// One-shot: ensure marianonoceti@gmail.com is in the admins allowlist BEFORE
// deploying the verifyAuth admin check. Without this, deploying that change
// would lock Mariano out of the dashboard.
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');
const fs = require('fs');

function rawValue(envPath, key) {
    if (!fs.existsSync(envPath)) return undefined;
    const text = fs.readFileSync(envPath, 'utf8');
    const re = new RegExp(`^${key}=(.*)$`, 'm');
    const m = text.match(re);
    if (!m) return undefined;
    let v = m[1].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    return v;
}
process.env.FIREBASE_SERVICE_ACCOUNT_KEY = rawValue(
    path.join(__dirname, '..', '.env.local'),
    'FIREBASE_SERVICE_ACCOUNT_KEY'
);
if (!getApps().length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    let cleaned = '', inString = false, escaped = false;
    for (let i = 0; i < raw.length; i++) {
        const ch = raw[i];
        if (inString) {
            cleaned += ch;
            if (escaped) { escaped = false; continue; }
            if (ch === '\\') { escaped = true; continue; }
            if (ch === '"') { inString = false; continue; }
        } else {
            if (ch === '\\' && raw[i + 1] === 'n') { i++; continue; }
            cleaned += ch;
            if (ch === '"') inString = true;
        }
    }
    const sa = JSON.parse(cleaned);
    if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n');
    initializeApp({ credential: cert(sa) });
}
const db = getFirestore();

(async () => {
    const email = (process.argv[2] || 'marianonoceti@gmail.com').toLowerCase();
    const existing = await db.collection('admins').where('email', '==', email).limit(1).get();
    if (!existing.empty) {
        console.log(`✓ ${email} already in admins (${existing.docs[0].id})`);
        return;
    }
    const ref = await db.collection('admins').add({
        email,
        status: 'active',
        invited_at: new Date().toISOString(),
        bootstrapped_by: 'audit-2026-05-18',
    });
    console.log(`✓ Added ${email} to admins as ${ref.id}`);
})().catch(e => { console.error(e); process.exit(1); });
