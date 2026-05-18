// CORRECTED audit — uses the right field name (times_used, not uses_count).
// Also fixes the user lookup for akanelin etc.
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
    // ─── Tokens (CORRECTED field name) ───
    const snap = await db.collection('access_tokens').get();
    const week = [];
    snap.forEach(doc => {
        const d = doc.data();
        const ts = d.created_at;
        const dd = ts?.toDate ? ts.toDate() : new Date(ts);
        if (dd >= WEEK_START && dd < WEEK_END) week.push({ id: doc.id, ...d });
    });
    console.log(`\n=== TOKENS IN WINDOW (CORRECTED with times_used field) ===\n`);
    console.log(`Total tokens: ${week.length}`);

    let used = 0, activated = 0, lazy = 0;
    week.forEach(t => {
        if ((t.times_used || 0) > 0) used++;
        if (t.activated_at) activated++;
        else lazy++;
    });
    console.log(`  times_used > 0:        ${used}`);
    console.log(`  activated_at != null:  ${activated}  (clock started — 30d countdown active)`);
    console.log(`  activated_at = null:   ${lazy}  (lazy — never opened the email link)`);

    console.log(`\n--- Each token ---`);
    week.sort((a, b) => {
        const ad = a.created_at?.toDate ? a.created_at.toDate() : new Date(a.created_at);
        const bd = b.created_at?.toDate ? b.created_at.toDate() : new Date(b.created_at);
        return ad - bd;
    });
    week.forEach(t => {
        const cr = t.created_at?.toDate ? t.created_at.toDate() : new Date(t.created_at);
        const act = t.activated_at ? new Date(t.activated_at).toISOString().slice(0, 16) : 'never';
        const firstUsed = t.first_used_at ? new Date(t.first_used_at).toISOString().slice(0, 16) : '-';
        console.log(`  ${cr.toISOString().slice(0, 16)}  ${t.token}  times_used=${t.times_used || 0}  activated=${act}  first_used=${firstUsed}  ${t.email.padEnd(35)}  exp=${t.experience_id?.slice(0, 8)}`);
    });

    // ─── Same for all sessions, by email (find sessions for users I'll list) ───
    const usersToLookup = [
        'nicolasseunarine93@gmail.com',
        'akanelin1997@gmail.com',
        'r.soileau@outlook.com',
        'peisun01@gmail.com',
        'pad6446@gmail.com',
        'ojrana@gmail.com',
        'eddiecantu85@gmail.com',
        'coincollectorymy@gmail.com',
        'mohammed.zahin@gmail.com',
        'aprilvacc31@gmail.com',
        'nasrullah.cmn@gmail.com',
        'hernangabrieltorres@gmail.com',
    ];

    console.log(`\n\n=== PER-USER STATUS (real founders/buyers) ===\n`);
    for (const email of usersToLookup) {
        const tokens = week.filter(t => t.email === email);
        const sessSnap = await db.collection('user_sessions').where('email', '==', email).get();
        const sessions = [];
        sessSnap.forEach(d => sessions.push({ id: d.id, ...d.data() }));
        const usedCount = tokens.reduce((acc, t) => acc + (t.times_used || 0), 0);
        const activatedCount = tokens.filter(t => t.activated_at).length;
        console.log(`\n  ${email}`);
        console.log(`    tokens: ${tokens.length}  activated: ${activatedCount}  total uses: ${usedCount}  sessions: ${sessions.length}`);
        sessions.forEach(s => {
            const ts = s.started_at?.toDate ? s.started_at.toDate() : new Date(s.started_at);
            const pct = s.total_steps ? Math.round((s.current_step / s.total_steps) * 100) : 0;
            console.log(`      sess ${ts.toISOString().slice(0, 16)}  step=${s.current_step}/${s.total_steps} (${pct}%)  status=${s.status}  in_nyc=${s.in_nyc || '-'}  exp=${s.experience_id?.slice(0, 8)}`);
        });
    }

    // ─── Contacts (Mariano said "hay varios emails en contactos") ───
    console.log(`\n\n=== CONTACTS (from web form) ===\n`);
    const csnap = await db.collection('contacts').orderBy('created_at', 'desc').limit(50).get();
    console.log(`Showing latest 50:`);
    csnap.forEach(d => {
        const x = d.data();
        const ts = x.created_at?.toDate ? x.created_at.toDate() : new Date(x.created_at);
        console.log(`  ${ts.toISOString().slice(0, 16)}  ${(x.email || '-').padEnd(35)}  ${(x.name || '').slice(0, 25)}  src=${x.source || x.utm_source || '-'}`);
    });

    console.log(`\n=== DONE ===\n`);
})().catch(e => { console.error(e); process.exit(1); });
