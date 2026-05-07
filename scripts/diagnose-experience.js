// Read-only diagnostic for an experience.
// Usage: node scripts/diagnose-experience.js "<name substring>"

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');
const fs = require('fs');
// Read .env.local raw — manage FIREBASE_SERVICE_ACCOUNT_KEY ourselves because
// dotenv mangles \n inside the JSON. Other vars we don't need here.
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
    // The .env.local stores JSON as a single line with literal \n everywhere —
    // both as cosmetic newlines between properties (invalid JSON) and inside the
    // private_key string (valid JSON escape). We need to drop the cosmetic ones
    // while preserving the in-string ones. Walk the buffer, track string state.
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
            if (ch === '\\' && raw[i + 1] === 'n') { i++; continue; } // skip \n outside strings
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
    const arg = (process.argv[2] || '').toLowerCase();
    if (!arg) {
        console.error('usage: node scripts/diagnose-experience.js "<name substring>"');
        process.exit(1);
    }
    const expSnap = await db.collection('experiences').get();
    const matches = expSnap.docs.filter(d => (d.data().name || '').toLowerCase().includes(arg));
    if (matches.length === 0) {
        console.error('No experience matches:', arg);
        console.error('Available:');
        expSnap.docs.forEach(d => console.error(' -', d.data().name));
        process.exit(2);
    }
    for (const expDoc of matches) {
        const exp = expDoc.data();
        console.log('\n══════════════════════════════════════════════════════════');
        console.log('EXPERIENCE:', exp.name, '  id=', expDoc.id);
        console.log('══════════════════════════════════════════════════════════');
        console.log('  status:', exp.status, ' mode:', exp.mode, ' price:', exp.price);

        // Scenes
        const scenesSnap = await db.collection('experiences').doc(expDoc.id).collection('scenes').orderBy('order').get();
        const scenes = scenesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        console.log('\nSCENES:', scenes.length);
        scenes.forEach(sc => {
            console.log(`  • [${sc.order}] ${sc.name}  id=${sc.id}  next_scene_id=${sc.next_scene_id || '(none)'}`);
        });

        // Steps — fetch ALL to also catch ones without scene_id
        const stepsSnap = await db.collection('experiences').doc(expDoc.id).collection('steps').get();
        const steps = stepsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        console.log(`\nSTEPS: ${steps.length}`);

        // Group by scene
        const bySceneId = new Map();
        const orphan = [];
        for (const s of steps) {
            if (!s.scene_id) { orphan.push(s); continue; }
            if (!bySceneId.has(s.scene_id)) bySceneId.set(s.scene_id, []);
            bySceneId.get(s.scene_id).push(s);
        }

        for (const sc of scenes) {
            const list = (bySceneId.get(sc.id) || []).sort((a, b) => (a.order || 0) - (b.order || 0));
            console.log(`\n  ── Scene "${sc.name}" (${list.length} steps) ──`);
            const orders = list.map(s => s.order);
            const dupOrders = orders.filter((o, i) => orders.indexOf(o) !== i);
            const gaps = [];
            for (let i = 0; i < orders.length; i++) if (orders[i] !== i + 1) gaps.push(i + 1);
            if (dupOrders.length) console.log('    ⚠ DUPLICATED orders:', [...new Set(dupOrders)]);
            if (gaps.length) console.log('    ⚠ ORDER GAPS at indices:', gaps, '— actual:', orders);
            list.forEach((s, idx) => {
                const expectedOrder = idx + 1;
                const orderTag = s.order === expectedOrder ? '' : ` ⚠ (expected ${expectedOrder})`;
                const nextTag = s.next_step_id ? ` ⤳ next_step_id=${s.next_step_id.slice(0, 8)}…` : '';
                const msg = (s.message_to_send || '').slice(0, 50).replace(/\n/g, ' ');
                console.log(`    ${String(s.order).padStart(2)}. [${s.step_type || '?'}] ${msg}${orderTag}${nextTag}`);
            });
            // Validate next_step_id targets
            for (const s of list) {
                if (s.next_step_id) {
                    const target = steps.find(t => t.id === s.next_step_id);
                    if (!target) {
                        console.log(`    ⚠ step #${s.order} has next_step_id pointing to non-existent step ${s.next_step_id}`);
                    } else if (target.scene_id && target.scene_id !== s.scene_id) {
                        console.log(`    ℹ step #${s.order} jumps to a step in a DIFFERENT scene (${target.scene_id})`);
                    }
                }
            }
        }
        if (orphan.length) {
            console.log('\n  ⚠ ORPHAN STEPS (no scene_id):', orphan.length);
            orphan.forEach(s => console.log(`    - id=${s.id} order=${s.order} type=${s.step_type}`));
        }
    }
    process.exit(0);
})().catch(e => { console.error('ERROR:', e); process.exit(1); });
