// Quick: list this week's access_tokens with all fields, to see real usage.
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

const WEEK_START = new Date('2026-05-11T00:00:00Z');
const WEEK_END = new Date('2026-05-19T00:00:00Z');

(async () => {
    const snap = await db.collection('access_tokens').get();
    const week = [];
    snap.forEach(doc => {
        const d = doc.data();
        const ts = d.created_at;
        const dd = ts?.toDate ? ts.toDate() : new Date(ts);
        if (dd >= WEEK_START && dd < WEEK_END) week.push({ id: doc.id, ...d });
    });
    if (week.length) {
        console.log(`Fields in first doc: ${Object.keys(week[0]).join(', ')}\n`);
    }
    console.log(`Tokens issued in window: ${week.length}\n`);
    week.forEach(t => {
        const created = t.created_at?.toDate ? t.created_at.toDate().toISOString().slice(0, 16) : '-';
        const firstUsed = t.first_used_at?.toDate ? t.first_used_at.toDate().toISOString().slice(0, 16) : '-';
        console.log(`  ${created}  uses=${t.uses_count ?? t.uses ?? 0}/${t.max_uses ?? '?'}  first_used=${firstUsed}  email=${t.email}  exp=${t.experience_id}  token=${t.token}`);
    });
})().catch(e => { console.error(e); process.exit(1); });
