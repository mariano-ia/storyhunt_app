// Cleanup dead fields from Firestore docs (data migration only — code has
// already stopped reading these as of 2026-05-19).
//
// Step subdocs:    expected_answer, expected_answer_en, hints, wrong_answer_message
// Experience docs: activation_keyword
//
// Default = dry run. Pass --delete to actually strip the fields.
//
// Usage:
//   node scripts/cleanup-dead-step-fields.js              # dry run
//   node scripts/cleanup-dead-step-fields.js --delete     # execute

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
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

const STEP_DEAD_FIELDS = ['expected_answer', 'expected_answer_en', 'hints', 'wrong_answer_message'];
const EXPERIENCE_DEAD_FIELDS = ['activation_keyword'];

(async () => {
    console.log(`\n=== DEAD FIELD CLEANUP ===`);
    console.log(`Mode: ${DO_DELETE ? 'DELETE' : 'DRY RUN (pass --delete to execute)'}\n`);

    const experiencesSnap = await db.collection('experiences').get();
    console.log(`Scanning ${experiencesSnap.size} experiences...\n`);

    let expDirty = 0;
    let stepsScanned = 0;
    let stepsDirty = 0;
    const expBatch = db.batch();
    let stepBatch = db.batch();
    let stepBatchSize = 0;
    const stepBatches = [stepBatch];

    for (const expDoc of experiencesSnap.docs) {
        const expData = expDoc.data();
        const expUpdates = {};
        for (const f of EXPERIENCE_DEAD_FIELDS) {
            if (f in expData) expUpdates[f] = FieldValue.delete();
        }
        if (Object.keys(expUpdates).length > 0) {
            expDirty++;
            console.log(`  EXP ${expDoc.id}  ${expData.name?.slice(0, 40)}  → strip [${Object.keys(expUpdates).join(', ')}]`);
            if (DO_DELETE) expBatch.update(expDoc.ref, expUpdates);
        }

        const stepsSnap = await expDoc.ref.collection('steps').get();
        for (const stepDoc of stepsSnap.docs) {
            stepsScanned++;
            const stepData = stepDoc.data();
            const stepUpdates = {};
            for (const f of STEP_DEAD_FIELDS) {
                if (f in stepData) stepUpdates[f] = FieldValue.delete();
            }
            if (Object.keys(stepUpdates).length > 0) {
                stepsDirty++;
                if (DO_DELETE) {
                    if (stepBatchSize >= 450) {
                        stepBatch = db.batch();
                        stepBatches.push(stepBatch);
                        stepBatchSize = 0;
                    }
                    stepBatch.update(stepDoc.ref, stepUpdates);
                    stepBatchSize++;
                }
            }
        }
    }

    console.log(`\n=== SUMMARY ===`);
    console.log(`Experiences scanned:      ${experiencesSnap.size}`);
    console.log(`Experiences to clean:     ${expDirty}`);
    console.log(`Steps scanned:            ${stepsScanned}`);
    console.log(`Steps to clean:           ${stepsDirty}`);
    console.log(`Step batches to commit:   ${stepBatches.length}`);

    if (!DO_DELETE) {
        console.log(`\nDry run only. Run with --delete to actually strip these fields.\n`);
        return;
    }

    console.log(`\nCommitting writes...`);
    if (expDirty > 0) await expBatch.commit();
    for (let i = 0; i < stepBatches.length; i++) {
        await stepBatches[i].commit();
        console.log(`  step batch ${i + 1}/${stepBatches.length} committed`);
    }
    console.log(`\nDone.\n`);
})().catch(err => {
    console.error('FAILED:', err);
    process.exit(1);
});
