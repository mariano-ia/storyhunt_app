// Delete legacy April user_sessions that have no email (closure-bug era).
// Criteria: started_at < 2026-05-01 AND email is empty/missing.
// Default = dry run. Pass --delete to actually delete.
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

const DO_DELETE = process.argv.includes('--delete');
const CUTOFF = new Date('2026-05-01T00:00:00Z');

(async () => {
    const snap = await db.collection('user_sessions').get();
    const victims = [];
    snap.forEach(d => {
        const data = d.data();
        const started = data.started_at?.toDate ? data.started_at.toDate() : new Date(data.started_at);
        if (started < CUTOFF && !data.email) {
            victims.push({ id: d.id, ref: d.ref, started: started.toISOString(), step: data.current_step, total: data.total_steps, status: data.status });
        }
    });

    console.log(`\n=== CLEANUP PREVIEW ===`);
    console.log(`Criteria: started_at < ${CUTOFF.toISOString()}  AND  no email`);
    console.log(`Mode: ${DO_DELETE ? 'DELETE' : 'DRY RUN (pass --delete to execute)'}`);
    console.log(`Sessions matched: ${victims.length}\n`);

    victims.sort((a, b) => new Date(b.started) - new Date(a.started));
    victims.forEach(v => {
        const pct = v.total ? Math.round((v.step / v.total) * 100) : 0;
        console.log(`  ${v.id}  ${v.started.slice(0, 16)}  step=${v.step}/${v.total} (${pct}%)  status=${v.status}`);
    });

    if (!DO_DELETE) {
        console.log(`\nDry run only. Run with --delete to actually remove these.\n`);
        return;
    }

    console.log(`\nDeleting ${victims.length} sessions...\n`);
    // Batch delete (Firestore batch limit is 500, well under our ~33)
    const batch = db.batch();
    victims.forEach(v => batch.delete(v.ref));
    await batch.commit();
    console.log(`✓ Deleted ${victims.length} legacy April sessions.\n`);
})().catch(e => { console.error(e); process.exit(1); });
