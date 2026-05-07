// Repair `.order` for an experience: normalize each scene to 1..N preserving
// current within-scene ordering. Targets a SINGLE experience by id; default
// is dry-run (no writes). Pass --apply to actually write to Firestore.
//
// Usage:
//   node scripts/repair-experience-orders.js <experienceId>          # dry-run
//   node scripts/repair-experience-orders.js <experienceId> --apply  # write

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
process.env.FIREBASE_SERVICE_ACCOUNT_KEY = rawValue(path.join(__dirname, '..', '.env.local'), 'FIREBASE_SERVICE_ACCOUNT_KEY');

if (!getApps().length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    let cleaned = '';
    let inString = false;
    let escaped = false;
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
    const expId = process.argv[2];
    const apply = process.argv.includes('--apply');
    if (!expId) {
        console.error('usage: node scripts/repair-experience-orders.js <experienceId> [--apply]');
        process.exit(1);
    }

    const expDoc = await db.collection('experiences').doc(expId).get();
    if (!expDoc.exists) {
        console.error('Experience not found:', expId);
        process.exit(2);
    }
    const exp = expDoc.data();
    console.log('\nEXPERIENCE:', exp.name, '  id=', expId);
    console.log('Mode:', apply ? '🔴 APPLY (will write)' : '🟢 DRY-RUN (no writes)');

    // Scenes (we won't modify scenes — only steps)
    const scenesSnap = await db.collection('experiences').doc(expId).collection('scenes').orderBy('order').get();
    const scenes = scenesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Steps
    const stepsSnap = await db.collection('experiences').doc(expId).collection('steps').get();
    const steps = stepsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const changes = []; // { stepId, oldOrder, newOrder, sceneName }

    for (const sc of scenes) {
        const list = steps
            .filter(s => s.scene_id === sc.id)
            .sort((a, b) => {
                if ((a.order ?? 0) !== (b.order ?? 0)) return (a.order ?? 0) - (b.order ?? 0);
                // Tiebreaker for duplicates: created order via doc id (lexicographic)
                return a.id.localeCompare(b.id);
            });

        list.forEach((s, idx) => {
            const newOrder = idx + 1;
            if (s.order !== newOrder) {
                changes.push({ stepId: s.id, oldOrder: s.order, newOrder, sceneName: sc.name });
            }
        });
    }

    if (changes.length === 0) {
        console.log('\n✓ No changes needed — every scene already has 1..N orders.');
        process.exit(0);
    }

    console.log(`\nProposed changes: ${changes.length} step(s)\n`);
    const bySceneTitle = new Map();
    for (const c of changes) {
        if (!bySceneTitle.has(c.sceneName)) bySceneTitle.set(c.sceneName, []);
        bySceneTitle.get(c.sceneName).push(c);
    }
    for (const [scName, list] of bySceneTitle) {
        console.log(`  ── ${scName} ──`);
        list.forEach(c => console.log(`     ${String(c.oldOrder).padStart(3)} → ${String(c.newOrder).padStart(2)}   (step ${c.stepId.slice(0, 8)}…)`));
        console.log('');
    }

    if (!apply) {
        console.log('🟢 Dry run complete. Re-run with --apply to write these changes.');
        process.exit(0);
    }

    // Apply in batches of 500 (Firestore limit)
    const collRef = db.collection('experiences').doc(expId).collection('steps');
    const chunkSize = 400;
    for (let i = 0; i < changes.length; i += chunkSize) {
        const batch = db.batch();
        const chunk = changes.slice(i, i + chunkSize);
        for (const c of chunk) {
            batch.update(collRef.doc(c.stepId), { order: c.newOrder });
        }
        await batch.commit();
        console.log(`Wrote ${chunk.length} updates (batch ${Math.floor(i / chunkSize) + 1})`);
    }
    console.log(`\n🔴 Applied ${changes.length} order updates to ${exp.name}.`);
    process.exit(0);
})().catch(e => { console.error('ERROR:', e); process.exit(1); });
