// Check Resend delivery logs for the 18 emails issued this week (5-11 → 5-18).
// Also dump details of the 4 sessions in May with no email.
const path = require('path');
const fs = require('fs');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

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
const envPath = path.join(__dirname, '..', '.env.local');
process.env.FIREBASE_SERVICE_ACCOUNT_KEY = rawValue(envPath, 'FIREBASE_SERVICE_ACCOUNT_KEY');
process.env.RESEND_API_KEY = rawValue(envPath, 'RESEND_API_KEY');
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
    // Get the 18 token recipients
    const tokensSnap = await db.collection('access_tokens').get();
    const START = new Date('2026-05-11T00:00:00Z'), END = new Date('2026-05-19T00:00:00Z');
    const recipients = [];
    tokensSnap.forEach(doc => {
        const d = doc.data();
        const created = d.created_at?.toDate ? d.created_at.toDate() : new Date(d.created_at);
        if (created >= START && created < END) recipients.push({ email: d.email, token: d.token, exp: d.experience_id, created });
    });
    console.log(`\n=== RESEND DELIVERY CHECK ===\nRecipients in window: ${recipients.length}\n`);

    // Query Resend for emails sent recently. Resend's /emails endpoint paginates.
    const KEY = process.env.RESEND_API_KEY;
    if (!KEY) { console.log('No RESEND_API_KEY — skipping'); return; }

    // List emails (Resend returns latest by default, paginated).
    // Endpoint: GET https://api.resend.com/emails?limit=100
    const res = await fetch('https://api.resend.com/emails?limit=100', {
        headers: { Authorization: `Bearer ${KEY}` },
    });
    if (!res.ok) {
        const t = await res.text();
        console.log(`Resend API error ${res.status}: ${t.slice(0, 200)}`);
        return;
    }
    const json = await res.json();
    const emails = json.data || [];
    console.log(`Resend returned ${emails.length} recent emails (showing ones matching our 18 recipients):\n`);

    const recipientEmails = new Set(recipients.map(r => r.email.toLowerCase()));
    const matched = emails.filter(e => {
        const to = Array.isArray(e.to) ? e.to[0] : e.to;
        return to && recipientEmails.has(String(to).toLowerCase());
    });

    console.log(`Matched ${matched.length} of ${recipients.length}\n`);
    matched.forEach(e => {
        const to = Array.isArray(e.to) ? e.to[0] : e.to;
        console.log(`  ${e.created_at?.slice(0, 16)}  to=${to.padEnd(35)}  subject="${(e.subject || '').slice(0, 40)}"  status=${e.last_event || '-'}  id=${e.id?.slice(0, 12)}`);
    });

    // Find recipients we did NOT see in the last 100 emails — they may have gotten the email earlier or not at all
    const notFound = recipients.filter(r => !matched.some(m => {
        const to = Array.isArray(m.to) ? m.to[0] : m.to;
        return String(to).toLowerCase() === r.email.toLowerCase();
    }));
    console.log(`\nRecipients NOT in last 100 Resend emails: ${notFound.length}`);
    notFound.forEach(r => console.log(`  ${r.email}  (token ${r.token}, exp ${r.exp})`));

    // For matched emails, fetch detailed status (delivered / opened / bounced)
    console.log(`\n--- Detailed delivery status for matched ---`);
    for (const e of matched.slice(0, 20)) {
        const det = await fetch(`https://api.resend.com/emails/${e.id}`, { headers: { Authorization: `Bearer ${KEY}` } });
        if (det.ok) {
            const d = await det.json();
            const to = Array.isArray(d.to) ? d.to[0] : d.to;
            console.log(`  ${to.padEnd(35)}  last_event=${d.last_event}  delivered_at=${d.delivered_at || '-'}  opened_at=${d.opened_at || '-'}  bounced_at=${d.bounced_at || '-'}`);
        }
    }

    // ─── Detail on the 4 May no-email sessions ───
    console.log(`\n\n=== MAY SESSIONS WITH NO EMAIL ===\n`);
    const sessSnap = await db.collection('user_sessions').get();
    const MAY_START = new Date('2026-05-01T00:00:00Z');
    const maybeBug = [];
    sessSnap.forEach(doc => {
        const d = doc.data();
        const started = d.started_at?.toDate ? d.started_at.toDate() : new Date(d.started_at);
        if (started >= MAY_START && !d.email) maybeBug.push({ id: doc.id, ...d, started });
    });
    maybeBug.sort((a, b) => b.started - a.started);
    maybeBug.forEach(s => {
        console.log(`  ${s.id}`);
        console.log(`    started=${s.started.toISOString().slice(0, 16)} step=${s.current_step}/${s.total_steps} status=${s.status} in_nyc=${s.in_nyc || '-'}`);
        console.log(`    exp=${s.experience_id} lang=${s.lang} completed_at=${s.completed_at || '-'}`);
        console.log(`    all fields:`, Object.keys(s).join(', '));
    });

    console.log(`\n=== DONE ===\n`);
})().catch(e => { console.error(e); process.exit(1); });
