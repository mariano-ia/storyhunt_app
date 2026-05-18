// Dump ALL user_sessions, most recent first, like the dashboard.
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
    const snap = await db.collection('user_sessions').get();
    const all = [];
    snap.forEach(d => all.push({ id: d.id, ...d.data() }));
    all.sort((a, b) => {
        const ad = a.started_at?.toDate ? a.started_at.toDate() : new Date(a.started_at);
        const bd = b.started_at?.toDate ? b.started_at.toDate() : new Date(b.started_at);
        return bd - ad;
    });

    console.log(`\n=== ALL SESSIONS (${all.length} total, most recent first) ===\n`);
    all.forEach(s => {
        const ts = s.started_at?.toDate ? s.started_at.toDate() : new Date(s.started_at);
        const pct = s.total_steps ? Math.round((s.current_step / s.total_steps) * 100) : 0;
        const email = (s.email || '(no email)').padEnd(38);
        const date = ts.toISOString().slice(0, 16);
        const stepInfo = `step=${s.current_step || 0}/${s.total_steps}`.padEnd(15);
        const status = (s.status || 'unknown').padEnd(18);
        const nyc = (s.in_nyc || '-').padEnd(8);
        console.log(`  ${date}  ${email}  ${stepInfo} ${pct.toString().padStart(3)}%  ${status} nyc=${nyc} exp=${s.experience_id?.slice(0, 8)}`);
    });

    console.log(`\n=== BREAKDOWN ===`);
    const sinceMay11 = all.filter(s => {
        const ts = s.started_at?.toDate ? s.started_at.toDate() : new Date(s.started_at);
        return ts >= new Date('2026-05-11T00:00:00Z');
    });
    console.log(`Sessions since 2026-05-11:     ${sinceMay11.length}`);
    console.log(`  with email:                  ${sinceMay11.filter(s => s.email).length}`);
    console.log(`  no email:                    ${sinceMay11.filter(s => !s.email).length}`);
    console.log(`  with progress > 0:           ${sinceMay11.filter(s => (s.current_step || 0) > 0).length}`);
    console.log(`  step 0 (entered, no answer): ${sinceMay11.filter(s => (s.current_step || 0) === 0).length}`);
})().catch(e => { console.error(e); process.exit(1); });
