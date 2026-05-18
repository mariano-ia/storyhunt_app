// Diagnose why 3 May sessions have no email despite the closure-bug fix.
// Cross-reference with tokens, sales, and the experience mode at the time.
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

const SUSPECT_IDS = ['jmbCIjKIWjYiUdli7gBf', 'kBWADVpPenxP3aEWHx7M', 'kAiJxsli25Xhk2qPL9OR', 'bkikAa5VtgukCuUd1BYi'];

(async () => {
    console.log(`\n=== DIAGNOSING NO-EMAIL MAY SESSIONS ===\n`);
    for (const id of SUSPECT_IDS) {
        const ref = db.collection('user_sessions').doc(id);
        const snap = await ref.get();
        if (!snap.exists) { console.log(`  ${id} — NOT FOUND`); continue; }
        const s = snap.data();
        const ts = s.started_at?.toDate ? s.started_at.toDate() : new Date(s.started_at);
        const tsIso = ts.toISOString();
        console.log(`  ${id}`);
        console.log(`    started=${tsIso}  step=${s.current_step}/${s.total_steps}  status=${s.status}  exp=${s.experience_id}  lang=${s.lang}`);
        console.log(`    all fields: ${Object.keys(s).join(', ')}`);

        // Look for tokens created within ±30min of this session
        const win = 30 * 60 * 1000;
        const ws = new Date(ts.getTime() - win).toISOString();
        const we = new Date(ts.getTime() + win).toISOString();
        const tsnap = await db.collection('access_tokens')
            .where('experience_id', '==', s.experience_id)
            .get();
        const closeTokens = [];
        tsnap.forEach(d => {
            const td = d.data();
            const tc = td.created_at?.toDate ? td.created_at.toDate() : new Date(td.created_at);
            const dt = Math.abs(tc - ts) / 1000 / 60;
            if (dt < 30) closeTokens.push({ id: d.id, ...td, deltaMinutes: dt.toFixed(1) });
        });
        if (closeTokens.length) {
            console.log(`    tokens within ±30min on same experience:`);
            closeTokens.forEach(t => {
                console.log(`      ${t.token}  email=${t.email}  Δ${t.deltaMinutes}min  times_used=${t.times_used}  activated_at=${t.activated_at || 'null'}`);
            });
        } else {
            console.log(`    No tokens nearby — session created without a paid path`);
        }
        console.log('');
    }

    // Also check: are there any access_tokens with empty email?
    console.log(`\n--- Tokens with EMPTY email (potential source of empty-email sessions) ---`);
    const allTokens = await db.collection('access_tokens').get();
    let emptyEmail = 0;
    allTokens.forEach(d => {
        const t = d.data();
        if (!t.email || t.email === '') {
            emptyEmail++;
            console.log(`  ${t.token}  created=${(t.created_at?.toDate ? t.created_at.toDate() : new Date(t.created_at)).toISOString().slice(0, 16)}  exp=${t.experience_id}  stripe_session_id=${t.stripe_session_id}`);
        }
    });
    if (emptyEmail === 0) console.log(`  None — all tokens have an email field set`);
})().catch(e => { console.error(e); process.exit(1); });
