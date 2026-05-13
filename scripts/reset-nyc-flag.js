// One-shot helper: clears in_nyc on an in_progress session so the gate fires again.
// Used by Mariano while smoke-testing the NYC gate locally.
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
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
    const email = process.argv[2] || 'marianonoceti@gmail.com';
    const expId = process.argv[3] || '4qtIlakWYLhoCJzzMWQT'; // Brooklyn default
    const snap = await db.collection('user_sessions')
        .where('experience_id', '==', expId)
        .where('email', '==', email)
        .where('status', '==', 'in_progress')
        .get();
    if (snap.empty) {
        console.log(`No in_progress sessions for ${email} on experience ${expId}`);
        return;
    }
    for (const doc of snap.docs) {
        await doc.ref.update({
            in_nyc: FieldValue.delete(),
            in_nyc_reply: FieldValue.delete(),
            current_step: 0,
        });
        console.log(`Reset session ${doc.id}: in_nyc cleared, current_step=0`);
    }
})().catch(e => { console.error(e); process.exit(1); });
