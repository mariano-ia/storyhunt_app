// One-shot audit: reconcile reported "37 purchases" vs actual Stripe revenue,
// and break down user_sessions by status + NYC gate response.
// Window: 2026-05-11 → 2026-05-18 (matches conversion-review email).
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
const WEEK_END = new Date('2026-05-19T00:00:00Z'); // exclusive

function inWindow(ts) {
    if (!ts) return false;
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d >= WEEK_START && d < WEEK_END;
}

(async () => {
    console.log(`\n=== AUDIT 2026-05-11 → 2026-05-18 ===\n`);

    // ---------- SALES ----------
    const salesSnap = await db.collection('sales').get();
    console.log(`Total sales docs (all time): ${salesSnap.size}`);

    const weekSales = [];
    salesSnap.forEach(doc => {
        const d = doc.data();
        const ts = d.created_at || d.createdAt || d.timestamp;
        if (inWindow(ts)) weekSales.push({ id: doc.id, ...d });
    });

    console.log(`\nSales in window: ${weekSales.length}`);
    if (weekSales.length) {
        console.log(`\nSample doc keys: ${Object.keys(weekSales[0]).join(', ')}`);
    }

    // bucket by price/coupon
    let paidCount = 0, paidRevenue = 0, freeCount = 0, otherCount = 0;
    const couponBreakdown = {};
    for (const s of weekSales) {
        const amount = Number(s.amount ?? s.amount_total ?? s.price ?? 0);
        const coupon = s.coupon_code || s.coupon || s.promo_code || null;
        if (coupon) couponBreakdown[coupon] = (couponBreakdown[coupon] || 0) + 1;

        if (coupon === 'STORYHUNT' || amount === 0) freeCount++;
        else if (amount > 0) { paidCount++; paidRevenue += amount; }
        else otherCount++;
    }

    console.log(`\n--- Sales breakdown ---`);
    console.log(`  Paid (>$0):   ${paidCount}  (revenue: $${(paidRevenue / 100).toFixed(2)} if cents, or $${paidRevenue.toFixed(2)} if dollars)`);
    console.log(`  Free/cupon:   ${freeCount}`);
    console.log(`  Other/0/null: ${otherCount}`);
    console.log(`  Coupon usage:`, couponBreakdown);

    // dump each sale row for full visibility
    console.log(`\n--- Each sale in window ---`);
    weekSales.forEach(s => {
        const ts = s.created_at || s.createdAt || s.timestamp;
        const d = ts?.toDate ? ts.toDate() : new Date(ts);
        console.log(`  ${d.toISOString().slice(0, 16)}  amount=${s.amount ?? s.amount_total ?? '-'}  coupon=${s.coupon_code || s.coupon || '-'}  email=${s.email || '-'}  exp=${s.experience_id || '-'}`);
    });

    // ---------- ACCESS TOKENS ----------
    console.log(`\n\n--- Access tokens created in window ---`);
    const tokensSnap = await db.collection('access_tokens').get();
    const weekTokens = [];
    tokensSnap.forEach(doc => {
        const d = doc.data();
        if (inWindow(d.created_at)) weekTokens.push({ id: doc.id, ...d });
    });
    console.log(`Access tokens issued: ${weekTokens.length}`);
    let tokensUsed = 0;
    weekTokens.forEach(t => {
        if ((t.uses_count || 0) > 0) tokensUsed++;
    });
    console.log(`  Of which used at least once: ${tokensUsed}`);

    // ---------- SESSIONS ----------
    console.log(`\n\n=== SESSIONS in window ===\n`);
    const sessSnap = await db.collection('user_sessions').get();
    const weekSess = [];
    sessSnap.forEach(doc => {
        const d = doc.data();
        const ts = d.started_at || d.created_at;
        if (inWindow(ts)) weekSess.push({ id: doc.id, ...d });
    });

    console.log(`Sessions started in window: ${weekSess.length}`);

    const byStatus = {};
    const byNyc = { yes: 0, no: 0, unclear: 0, missing: 0 };
    const completedByNyc = { yes: 0, no: 0, unclear: 0, missing: 0 };
    const inProgressByNyc = { yes: 0, no: 0, unclear: 0, missing: 0 };
    const abandonedByNyc = { yes: 0, no: 0, unclear: 0, missing: 0 };
    const awaitingArrival = [];
    const noEmailSessions = [];

    for (const s of weekSess) {
        const st = s.status || 'unknown';
        byStatus[st] = (byStatus[st] || 0) + 1;

        const nyc = s.in_nyc || 'missing';
        byNyc[nyc] = (byNyc[nyc] || 0) + 1;

        if (st === 'completed') completedByNyc[nyc]++;
        else if (st === 'in_progress') inProgressByNyc[nyc]++;
        else if (st === 'abandoned') abandonedByNyc[nyc]++;

        if (st === 'awaiting_arrival') awaitingArrival.push(s);
        if (!s.email) noEmailSessions.push(s);
    }

    console.log(`\nBy status:`, byStatus);
    console.log(`\nBy in_nyc field:`, byNyc);
    console.log(`\nBy status × in_nyc:`);
    console.log(`  completed:    `, completedByNyc);
    console.log(`  in_progress:  `, inProgressByNyc);
    console.log(`  abandoned:    `, abandonedByNyc);
    console.log(`\nawaiting_arrival sessions: ${awaitingArrival.length}`);
    console.log(`Sessions with NO email saved: ${noEmailSessions.length} (closure bug — pre-fix)`);

    // sample replies for in_nyc='no' and 'unclear'
    const sampleNo = weekSess.filter(s => s.in_nyc === 'no').slice(0, 5);
    const sampleUnclear = weekSess.filter(s => s.in_nyc === 'unclear').slice(0, 5);
    if (sampleNo.length) {
        console.log(`\nSample replies (in_nyc=no):`);
        sampleNo.forEach(s => console.log(`  "${(s.in_nyc_reply || '').slice(0, 80)}" — ${s.email || '-'}`));
    }
    if (sampleUnclear.length) {
        console.log(`\nSample replies (in_nyc=unclear):`);
        sampleUnclear.forEach(s => console.log(`  "${(s.in_nyc_reply || '').slice(0, 80)}" — ${s.email || '-'}`));
    }

    // ---------- CONTACTS (lead capture leakage check) ----------
    console.log(`\n\n=== CONTACTS in window ===\n`);
    const contactsSnap = await db.collection('contacts').get();
    let weekContacts = 0;
    contactsSnap.forEach(doc => {
        const d = doc.data();
        if (inWindow(d.created_at || d.createdAt)) weekContacts++;
    });
    console.log(`Contacts captured: ${weekContacts}`);

    console.log(`\n=== DONE ===\n`);
})().catch(e => { console.error(e); process.exit(1); });
