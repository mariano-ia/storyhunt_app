// Adds apex SPF record to storyhunt.city via Google Cloud DNS REST API.
// Uses the Firebase service account from .env.local. Requires the SA to have
// roles/dns.admin (or owner). If permission denied, the script reports clearly.
//
// What we add:  storyhunt.city.  TXT  "v=spf1 include:amazonses.com ~all"
//
// Idempotent: if the record already exists with the same value, exits 0.
// Dry-run by default — pass --apply to commit.
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
    const APPLY = process.argv.includes('--apply');
    const envPath = path.join(__dirname, '..', '.env.local');
    const sakRaw = rawValue(envPath, 'FIREBASE_SERVICE_ACCOUNT_KEY');
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
        scopes: ['https://www.googleapis.com/auth/ndev.clouddns.readwrite'],
    });
    const client = await auth.getClient();
    const tok = await client.getAccessToken();
    if (!tok.token) throw new Error('No token');

    const project = sa.project_id;

    // 1. List managed zones, find the one for storyhunt.city
    const zonesRes = await fetch(
        `https://dns.googleapis.com/dns/v1/projects/${project}/managedZones`,
        { headers: { Authorization: `Bearer ${tok.token}` } },
    );
    if (!zonesRes.ok) {
        const t = await zonesRes.text();
        console.error(`✗ Can't list zones (${zonesRes.status}). Likely cause: service account lacks roles/dns.admin.`);
        console.error(`  Response: ${t.slice(0, 300)}`);
        console.error(`\n  Fix: in IAM, grant the SA roles/dns.admin (Google Cloud Console → IAM → grant on storyhunt-platform-961ec).`);
        console.error(`  Or do the DNS edit manually — see ./scripts/dns-spf-add.js for the exact record.`);
        process.exit(2);
    }
    const zones = await zonesRes.json();
    const zone = (zones.managedZones || []).find(z => z.dnsName === 'storyhunt.city.');
    if (!zone) {
        console.error(`✗ No Cloud DNS managed zone for storyhunt.city.`);
        console.error(`  Zones in project: ${(zones.managedZones || []).map(z => z.dnsName).join(', ') || '(none)'}`);
        process.exit(3);
    }
    console.log(`✓ Found zone: ${zone.name} (${zone.dnsName})`);

    // 2. Read current TXT records at the apex
    const rrsRes = await fetch(
        `https://dns.googleapis.com/dns/v1/projects/${project}/managedZones/${zone.name}/rrsets?name=storyhunt.city.&type=TXT`,
        { headers: { Authorization: `Bearer ${tok.token}` } },
    );
    const rrs = await rrsRes.json();
    const existing = (rrs.rrsets || []).find(r => r.name === 'storyhunt.city.' && r.type === 'TXT');
    const currentValues = existing ? existing.rrdatas : [];
    const spfTarget = '"v=spf1 include:amazonses.com ~all"';
    const alreadyHas = currentValues.some(v => v.includes('v=spf1'));

    console.log(`Current TXT at apex:`);
    currentValues.forEach(v => console.log(`  ${v}`));
    if (alreadyHas) {
        console.log(`\n✓ SPF record already present. Nothing to do.`);
        return;
    }

    // 3. Build the change request: delete existing TXT rrset and add new one with appended SPF.
    const newValues = [...currentValues, spfTarget];
    const change = {
        additions: [{
            name: 'storyhunt.city.',
            type: 'TXT',
            ttl: existing?.ttl || 300,
            rrdatas: newValues,
        }],
    };
    if (existing) {
        change.deletions = [{
            name: existing.name,
            type: existing.type,
            ttl: existing.ttl,
            rrdatas: existing.rrdatas,
        }];
    }

    console.log(`\nPlan:`);
    console.log(`  Replace apex TXT rrset with these values:`);
    newValues.forEach(v => console.log(`    ${v}`));

    if (!APPLY) {
        console.log(`\nDry run. Run with --apply to commit the change.`);
        return;
    }

    const changeRes = await fetch(
        `https://dns.googleapis.com/dns/v1/projects/${project}/managedZones/${zone.name}/changes`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${tok.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(change),
        },
    );
    if (!changeRes.ok) {
        const t = await changeRes.text();
        throw new Error(`Change failed ${changeRes.status}: ${t.slice(0, 300)}`);
    }
    const j = await changeRes.json();
    console.log(`\n✓ Change submitted: id=${j.id} status=${j.status}`);
})().catch(e => { console.error('\n✗ Failed:', e.message); process.exit(1); });
