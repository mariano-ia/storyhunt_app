// Deep audit: answer Mariano's specific questions.
// 1) Sessions with advanced progress + NO email — what's the actual situation?
// 2) Completed sessions ever — and their in_nyc value
// 3) Hernán's full session history
// 4) Sessions broken down by experience mode (test vs production) — to see if test sessions
//    explain the no-email rows
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
    // ─── Experience modes (which are test vs production?) ───
    const expSnap = await db.collection('experiences').get();
    const expMap = {};
    expSnap.forEach(doc => {
        const d = doc.data();
        expMap[doc.id] = { name: d.name, mode: d.mode, status: d.status, price: d.price };
    });
    console.log(`\n=== EXPERIENCES ===\n`);
    Object.entries(expMap).forEach(([id, e]) => {
        console.log(`  ${id}  ${e.name?.slice(0, 30).padEnd(30)} mode=${e.mode} status=${e.status} price=${e.price}`);
    });

    // ─── ALL sessions (not just window) ───
    const sessSnap = await db.collection('user_sessions').get();
    const all = [];
    sessSnap.forEach(doc => all.push({ id: doc.id, ...doc.data() }));
    console.log(`\n=== ALL SESSIONS (total: ${all.length}) ===\n`);

    // Q1: Sessions with no email + progress > 0
    const noEmailWithProgress = all
        .filter(s => !s.email && (s.current_step || 0) > 0)
        .sort((a, b) => (b.current_step || 0) - (a.current_step || 0));
    console.log(`--- Sessions with NO email AND progress > 0: ${noEmailWithProgress.length} ---`);
    noEmailWithProgress.slice(0, 15).forEach(s => {
        const exp = expMap[s.experience_id] || {};
        const pct = s.total_steps ? Math.round((s.current_step / s.total_steps) * 100) : 0;
        const started = s.started_at ? (s.started_at.toDate ? s.started_at.toDate() : new Date(s.started_at)).toISOString().slice(0, 16) : '-';
        console.log(`  ${s.id.slice(0, 12)}  step=${s.current_step}/${s.total_steps} (${pct}%) status=${s.status} in_nyc=${s.in_nyc || '-'} mode=${exp.mode || '-'} exp="${(exp.name || '').slice(0, 20)}" started=${started}`);
    });

    // Q2: Completed sessions — do we know their in_nyc?
    const completed = all.filter(s => s.status === 'completed');
    console.log(`\n--- COMPLETED sessions ever: ${completed.length} ---`);
    const completedBreakdown = { yes: 0, no: 0, unclear: 0, missing: 0 };
    completed.forEach(s => completedBreakdown[s.in_nyc || 'missing']++);
    console.log(`  in_nyc breakdown:`, completedBreakdown);
    console.log(`\n  Last 10 completed:`);
    completed
        .sort((a, b) => {
            const ad = a.completed_at ? new Date(a.completed_at) : new Date(a.started_at);
            const bd = b.completed_at ? new Date(b.completed_at) : new Date(b.started_at);
            return bd - ad;
        })
        .slice(0, 10)
        .forEach(s => {
            const exp = expMap[s.experience_id] || {};
            const when = s.completed_at ? new Date(s.completed_at).toISOString().slice(0, 16) : '-';
            console.log(`    ${when}  email=${s.email || '(none)'}  in_nyc=${s.in_nyc || '-'}  exp="${(exp.name || '').slice(0, 20)}"  mode=${exp.mode}  rating=${s.rating || '-'}`);
        });

    // Q3: Sessions per experience mode — does mode=test explain the no-email rows?
    console.log(`\n--- Sessions by experience mode + email presence ---`);
    const buckets = {};
    all.forEach(s => {
        const exp = expMap[s.experience_id] || {};
        const key = `${exp.mode || 'unknown'}/${s.email ? 'with_email' : 'no_email'}`;
        buckets[key] = (buckets[key] || 0) + 1;
    });
    console.log(buckets);

    // Q4: Hernán's full session history
    console.log(`\n--- Hernán's sessions (hernangabrieltorres@gmail.com) ---`);
    const hernan = all.filter(s => s.email === 'hernangabrieltorres@gmail.com');
    hernan.forEach(s => {
        const exp = expMap[s.experience_id] || {};
        const started = s.started_at ? (s.started_at.toDate ? s.started_at.toDate() : new Date(s.started_at)).toISOString().slice(0, 16) : '-';
        console.log(`  ${s.id}  step=${s.current_step}/${s.total_steps}  status=${s.status}  in_nyc=${s.in_nyc}  in_nyc_reply="${(s.in_nyc_reply || '').slice(0, 60)}"  started=${started}  exp="${exp.name || '?'}"`);
    });

    // Q5: Time series of sessions — when was the no-email closure bug actually fixed?
    console.log(`\n--- No-email sessions over time (when does the bug stop?) ---`);
    const monthly = {};
    all.forEach(s => {
        const d = s.started_at?.toDate ? s.started_at.toDate() : new Date(s.started_at);
        if (isNaN(d)) return;
        const ym = d.toISOString().slice(0, 7);
        if (!monthly[ym]) monthly[ym] = { total: 0, no_email: 0 };
        monthly[ym].total++;
        if (!s.email) monthly[ym].no_email++;
    });
    Object.entries(monthly).sort().forEach(([ym, c]) => {
        const pct = Math.round((c.no_email / c.total) * 100);
        console.log(`  ${ym}: ${c.total} sessions, ${c.no_email} no-email (${pct}%)`);
    });

    console.log(`\n=== DONE ===\n`);
})().catch(e => { console.error(e); process.exit(1); });
