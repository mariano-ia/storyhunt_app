// StoryHunt Marketing Review — product snapshot puller (Node + firebase-admin)
//
// Outputs a JSON blob to stdout describing the product state the content
// strategy should react to:
//   - published experiences (so the plan knows what's live, detects new ones)
//   - sales last 7d grouped by experience_id and by source (direct vs Bokun OTAs)
//   - sessions last 7d grouped by status + experience (funnel health)
//   - access tokens bought but never played (re-activation content cohort)
//
// Read-only: only .get() calls, never writes. Mirrors the firebase-admin init
// pattern used across scripts/*.js (add-admin.js, audit-week.js).
//
// Usage:  node pull_product_snapshot.js > .last-product-snapshot.json

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
    if (!raw) {
        console.error('ERROR: FIREBASE_SERVICE_ACCOUNT_KEY not found in .env.local');
        process.exit(1);
    }
    // Same JSON cleaner used by scripts/add-admin.js — strips stray escapes
    // outside string literals that break JSON.parse on the env-stored key.
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

// --- time windows: last 7d (current) and the 7d before that (previous) ---
const now = new Date();
const CUR_END = now;
const CUR_START = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
const PREV_END = CUR_START;
const PREV_START = new Date(CUR_START.getTime() - 7 * 24 * 60 * 60 * 1000);

function toDate(ts) {
    if (!ts) return null;
    if (ts.toDate) return ts.toDate();              // Firestore Timestamp
    if (typeof ts === 'object' && ts._seconds) return new Date(ts._seconds * 1000);
    const d = new Date(ts);                          // ISO string or epoch
    return isNaN(d.getTime()) ? null : d;
}

function whichWindow(ts) {
    const d = toDate(ts);
    if (!d) return null;
    if (d >= CUR_START && d < CUR_END) return 'current';
    if (d >= PREV_START && d < PREV_END) return 'previous';
    return null;
}

function bump(obj, key, by = 1) {
    if (key === undefined || key === null || key === '') key = 'unknown';
    obj[key] = (obj[key] || 0) + by;
}

(async () => {
    // ---------- EXPERIENCES (published) ----------
    const expSnap = await db.collection('experiences').get();
    const experiences = [];
    const expName = {};
    expSnap.forEach(doc => {
        const d = doc.data();
        expName[doc.id] = d.name || d.title || doc.id;
        if (d.status === 'published') {
            experiences.push({
                id: doc.id,
                name: d.name || d.title || doc.id,
                slug: d.slug || null,
                price: d.price ?? null,
                status: d.status,
                mode: d.mode || null,
                has_tripadvisor: !!(d.review_links && d.review_links.tripadvisor),
            });
        }
    });

    // ---------- SALES (last 7d + prev 7d) ----------
    const salesSnap = await db.collection('sales').get();
    const sales = {
        current: { total: 0, revenue_usd: 0, by_experience: {}, by_source: {} },
        previous: { total: 0, revenue_usd: 0, by_experience: {}, by_source: {} },
    };
    salesSnap.forEach(doc => {
        const d = doc.data();
        const win = whichWindow(d.created_at || d.createdAt || d.timestamp);
        if (!win) return;
        const bucket = sales[win];
        bucket.total += 1;
        // amount may be cents (Stripe) or dollars; store raw, label in analyze
        const amount = Number(d.amount_total ?? d.amount ?? d.price ?? 0);
        bucket.revenue_usd += isNaN(amount) ? 0 : amount;
        const expId = d.experience_id || d.experienceId || 'unknown';
        bump(bucket.by_experience, expName[expId] || expId);
        bump(bucket.by_source, d.source || 'direct');
    });

    // ---------- USER SESSIONS (last 7d) ----------
    const sessSnap = await db.collection('user_sessions').get();
    const sessions = {
        current: { total: 0, by_status: {}, by_experience: {}, by_nyc_gate: {} },
        previous: { total: 0, by_status: {}, by_experience: {}, by_nyc_gate: {} },
    };
    sessSnap.forEach(doc => {
        const d = doc.data();
        const win = whichWindow(d.created_at || d.createdAt || d.started_at || d.timestamp);
        if (!win) return;
        const bucket = sessions[win];
        bucket.total += 1;
        bump(bucket.by_status, d.status || 'unknown');
        const expId = d.experience_id || d.experienceId || 'unknown';
        bump(bucket.by_experience, expName[expId] || expId);
        if (d.in_nyc) bump(bucket.by_nyc_gate, d.in_nyc);
    });

    // ---------- ACCESS TOKENS bought-but-never-played ----------
    // times_used == 0 and created more than 7d ago → re-activation cohort.
    const tokSnap = await db.collection('access_tokens').get();
    let unusedOlderThan7d = 0;
    const unusedByExperience = {};
    tokSnap.forEach(doc => {
        const d = doc.data();
        const used = Number(d.times_used || 0);
        if (used > 0) return;
        if ((d.status || 'active') === 'refunded') return;
        const created = toDate(d.created_at || d.createdAt);
        if (created && created < CUR_START) {
            unusedOlderThan7d += 1;
            const expId = d.experience_id || d.experienceId || 'unknown';
            bump(unusedByExperience, expName[expId] || expId);
        }
    });

    const out = {
        generated_at: now.toISOString(),
        windows: {
            current: { since: CUR_START.toISOString(), until: CUR_END.toISOString() },
            previous: { since: PREV_START.toISOString(), until: PREV_END.toISOString() },
        },
        experiences,
        sales,
        sessions,
        unused_tokens: {
            bought_never_played_older_than_7d: unusedOlderThan7d,
            by_experience: unusedByExperience,
        },
    };

    process.stdout.write(JSON.stringify(out, null, 2));
})().catch(e => {
    console.error('ERROR pulling product snapshot:', e.message);
    process.exit(1);
});
