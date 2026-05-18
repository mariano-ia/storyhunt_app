// Deploys firestore.rules to production via the Firebase Rules REST API.
// Uses the service account from .env.local — same one the Admin SDK uses.
// Requires the SA to have role roles/firebaserules.admin or roles/owner.
const path = require('path');
const fs = require('fs');
const { GoogleAuth } = require('google-auth-library');

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

(async () => {
    const envPath = path.join(__dirname, '..', '.env.local');
    const sakRaw = rawValue(envPath, 'FIREBASE_SERVICE_ACCOUNT_KEY');
    if (!sakRaw) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY missing');

    // Same JSON-cleaning the Admin SDK init does
    let cleaned = '', inString = false, escaped = false;
    for (let i = 0; i < sakRaw.length; i++) {
        const ch = sakRaw[i];
        if (inString) {
            cleaned += ch;
            if (escaped) { escaped = false; continue; }
            if (ch === '\\') { escaped = true; continue; }
            if (ch === '"') { inString = false; continue; }
        } else {
            if (ch === '\\' && sakRaw[i + 1] === 'n') { i++; continue; }
            cleaned += ch;
            if (ch === '"') inString = true;
        }
    }
    const sa = JSON.parse(cleaned);
    if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n');

    const auth = new GoogleAuth({
        credentials: sa,
        scopes: ['https://www.googleapis.com/auth/firebase'],
    });
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    if (!token.token) throw new Error('Failed to mint access token');

    const projectId = sa.project_id;
    const rulesText = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');

    console.log(`Deploying firestore.rules to project ${projectId}...`);
    console.log(`  Rules length: ${rulesText.length} chars`);

    // 1. Create a new Ruleset
    const createRes = await fetch(
        `https://firebaserules.googleapis.com/v1/projects/${projectId}/rulesets`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                source: {
                    files: [{ name: 'firestore.rules', content: rulesText }],
                },
            }),
        },
    );
    if (!createRes.ok) {
        const errText = await createRes.text();
        throw new Error(`Ruleset create failed ${createRes.status}: ${errText}`);
    }
    const ruleset = await createRes.json();
    console.log(`  ✓ Created ruleset: ${ruleset.name}`);

    // 2. Update (PATCH) the cloud.firestore release to point to the new ruleset
    const releaseName = `projects/${projectId}/releases/cloud.firestore`;
    const patchRes = await fetch(
        `https://firebaserules.googleapis.com/v1/${releaseName}`,
        {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${token.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                release: {
                    name: releaseName,
                    rulesetName: ruleset.name,
                },
                updateMask: 'rulesetName',
            }),
        },
    );
    if (!patchRes.ok) {
        const errText = await patchRes.text();
        throw new Error(`Release update failed ${patchRes.status}: ${errText}`);
    }
    const release = await patchRes.json();
    console.log(`  ✓ Promoted ruleset to release: ${release.name}`);
    console.log(`\nFirestore rules deployed.`);
})().catch(e => { console.error('\n✗ Deploy failed:', e.message); process.exit(1); });
