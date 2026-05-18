// Look up everything we know about a specific user by email.
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
process.env.RESEND_API_KEY = rawValue(path.join(__dirname, '..', '.env.local'), 'RESEND_API_KEY');
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
    const target = process.argv[2] || 'nicolasseunarine93@gmail.com';
    console.log(`\n=== Looking up: ${target} ===\n`);

    // Sales
    const sales = await db.collection('sales').where('email', '==', target).get();
    console.log(`Sales: ${sales.size}`);
    sales.forEach(d => {
        const x = d.data();
        const ts = x.created_at?.toDate ? x.created_at.toDate() : new Date(x.created_at);
        console.log(`  ${ts.toISOString().slice(0, 16)}  amount=${x.amount}  coupon=${x.coupon_code || '-'}  exp=${x.experience_id}`);
    });

    // Tokens
    const tokens = await db.collection('access_tokens').where('email', '==', target).get();
    console.log(`\nTokens: ${tokens.size}`);
    tokens.forEach(d => {
        const x = d.data();
        console.log(`  ${x.token}  exp=${x.experience_id}  lang=${x.lang}  times_used=${x.times_used}  status=${x.status}  activated_at=${x.activated_at || 'null (lazy)'}  expires_at=${x.expires_at?.slice(0, 10)}`);
    });

    // Sessions
    const sess = await db.collection('user_sessions').where('email', '==', target).get();
    console.log(`\nSessions with email match: ${sess.size}`);
    sess.forEach(d => {
        const x = d.data();
        const ts = x.started_at?.toDate ? x.started_at.toDate() : new Date(x.started_at);
        console.log(`  ${d.id}  started=${ts.toISOString().slice(0, 16)}  step=${x.current_step}/${x.total_steps}  status=${x.status}  in_nyc=${x.in_nyc || '-'}  in_nyc_reply="${(x.in_nyc_reply || '').slice(0, 60)}"  exp=${x.experience_id}`);
    });

    // Also check sessions that started CLOSE to the token creation (in case the email bug hit)
    if (tokens.size > 0) {
        console.log(`\nSessions near token creation times (no-email closure bug check):`);
        for (const tdoc of tokens.docs) {
            const t = tdoc.data();
            const tCreated = t.created_at?.toDate ? t.created_at.toDate() : new Date(t.created_at);
            const windowStart = new Date(tCreated.getTime() - 5 * 60 * 1000);
            const windowEnd = new Date(tCreated.getTime() + 60 * 60 * 1000);
            console.log(`\n  Token ${t.token} (${t.experience_id}) created ${tCreated.toISOString().slice(0, 16)}`);
            const nearSess = await db.collection('user_sessions')
                .where('experience_id', '==', t.experience_id)
                .where('started_at', '>=', windowStart.toISOString())
                .where('started_at', '<=', windowEnd.toISOString())
                .get();
            nearSess.forEach(d => {
                const x = d.data();
                const ts = x.started_at?.toDate ? x.started_at.toDate() : new Date(x.started_at);
                console.log(`    sess ${d.id} started=${ts.toISOString().slice(0, 16)} email="${x.email || '(none)'}" step=${x.current_step}/${x.total_steps} status=${x.status} in_nyc=${x.in_nyc || '-'}`);
            });
        }
    }

    // Resend emails
    if (process.env.RESEND_API_KEY) {
        console.log(`\n--- Resend delivery for ${target} ---`);
        const res = await fetch('https://api.resend.com/emails?limit=100', {
            headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
        });
        if (res.ok) {
            const j = await res.json();
            const matched = (j.data || []).filter(e => {
                const to = Array.isArray(e.to) ? e.to[0] : e.to;
                return String(to).toLowerCase() === target.toLowerCase();
            });
            console.log(`  ${matched.length} matched in last 100`);
            matched.forEach(e => {
                console.log(`    ${e.created_at?.slice(0, 16)}  subject="${(e.subject || '').slice(0, 50)}"  status=${e.last_event}`);
            });
        }
    }
})().catch(e => { console.error(e); process.exit(1); });
