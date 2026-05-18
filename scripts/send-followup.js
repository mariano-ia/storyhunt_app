// Friendly follow-up to founders who got a token but haven't completed.
// Default = dry run. Pass --send to actually send.
//
// Excludes: Mariano (testing), Hernán (already awaiting_arrival from Buenos Aires).
// Custom message for akanelin (he's at 10% — different tone).
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
const envPath = path.join(__dirname, '..', '.env.local');
const RESEND = rawValue(envPath, 'RESEND_API_KEY');
const DO_SEND = process.argv.includes('--send');

const FROM = 'StoryHunt <hello@storyhunt.city>';
const REPLY_TO = 'mariano@storyhunt.city';

// Three buckets:
// 1) Never opened the email link (lazy, no activation) — friendly nudge + ask why
// 2) Started but stalled at NYC gate (step 0) — ask if they had an issue
// 3) Genuine progress (akanelin only) — ask how it's going

const BUCKETS = {
    never_opened: {
        emails: ['peisun01@gmail.com', 'pad6446@gmail.com', 'mohammed.zahin@gmail.com', 'nasrullah.cmn@gmail.com'],
        subject: 'Did your StoryHunt link arrive?',
        html: (email) => `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f7f7f7;font-family:-apple-system,Helvetica,Arial,sans-serif;color:#111;line-height:1.5;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
<tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;padding:32px 28px;">
<tr><td>
<p style="margin:0 0 16px;font-size:15px;">Hey,</p>
<p style="margin:0 0 16px;font-size:15px;">Quick question — I saw your StoryHunt link is still sitting unopened.
I just want to make sure the email actually reached you and that the link works.</p>
<p style="margin:0 0 16px;font-size:15px;">Could you tell me one of these?</p>
<ul style="margin:0 0 16px;padding-left:20px;font-size:15px;">
  <li>You haven't seen the email (check spam?)</li>
  <li>You got it but you're not in NYC yet — saving for later</li>
  <li>You tried but ran into something weird</li>
</ul>
<p style="margin:0 0 16px;font-size:15px;">Just hit reply with a one-liner. The link doesn't expire for a year, so no rush — but I'd like to know.</p>
<p style="margin:0 0 8px;font-size:15px;">Thanks,</p>
<p style="margin:0;font-size:15px;"><strong>Mariano</strong> · StoryHunt</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`
    },
    stalled_at_gate: {
        emails: ['nicolasseunarine93@gmail.com', 'r.soileau@outlook.com', 'ojrana@gmail.com', 'eddiecantu85@gmail.com', 'coincollectorymy@gmail.com', 'aprilvacc31@gmail.com'],
        subject: 'Quick check on your StoryHunt',
        html: (email) => `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f7f7f7;font-family:-apple-system,Helvetica,Arial,sans-serif;color:#111;line-height:1.5;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
<tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;padding:32px 28px;">
<tr><td>
<p style="margin:0 0 16px;font-size:15px;">Hey,</p>
<p style="margin:0 0 16px;font-size:15px;">I noticed you opened your StoryHunt link but didn't start the experience. I'm curious why — the chat asks if you're in NYC right now, and most people seem to bounce there.</p>
<p style="margin:0 0 16px;font-size:15px;">If it's any of these, just hit reply with a quick line:</p>
<ul style="margin:0 0 16px;padding-left:20px;font-size:15px;">
  <li>You're not in NYC yet — saving for when you arrive</li>
  <li>The question was confusing</li>
  <li>Something didn't load right</li>
  <li>Just wanted to look around, not play</li>
</ul>
<p style="margin:0 0 16px;font-size:15px;">Whatever the reason, your link still works — no clock has started until you tap "begin" at the meeting point.</p>
<p style="margin:0 0 8px;font-size:15px;">Thanks for picking up a hunt,</p>
<p style="margin:0;font-size:15px;"><strong>Mariano</strong> · StoryHunt</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`
    },
    progressing: {
        emails: ['akanelin1997@gmail.com'],
        subject: 'How is the Midtown hunt going?',
        html: (email) => `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f7f7f7;font-family:-apple-system,Helvetica,Arial,sans-serif;color:#111;line-height:1.5;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
<tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;padding:32px 28px;">
<tr><td>
<p style="margin:0 0 16px;font-size:15px;">Hey,</p>
<p style="margin:0 0 16px;font-size:15px;">I saw you got a few steps into <em>The Midtown Protocol</em> — thanks for picking it up.</p>
<p style="margin:0 0 16px;font-size:15px;">Just checking in: are you planning to come back to finish it, or did you hit something that didn't work right? Honest feedback is the most useful thing for us right now.</p>
<p style="margin:0 0 16px;font-size:15px;">Just hit reply — even one line helps a ton.</p>
<p style="margin:0 0 8px;font-size:15px;">Thanks,</p>
<p style="margin:0;font-size:15px;"><strong>Mariano</strong> · StoryHunt</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`
    },
};

(async () => {
    if (!RESEND) { console.error('No RESEND_API_KEY'); process.exit(1); }

    const plan = [];
    for (const [bucketName, b] of Object.entries(BUCKETS)) {
        for (const email of b.emails) {
            plan.push({ bucket: bucketName, email, subject: b.subject, html: b.html(email) });
        }
    }

    console.log(`\n=== FOLLOWUP PLAN ===`);
    console.log(`Total recipients: ${plan.length}`);
    console.log(`Mode: ${DO_SEND ? 'SEND' : 'DRY RUN — pass --send to execute'}`);
    console.log();
    plan.forEach(p => console.log(`  [${p.bucket.padEnd(16)}] ${p.email.padEnd(35)} subj="${p.subject}"`));

    if (!DO_SEND) {
        console.log(`\n--- Preview of "never_opened" copy ---\n`);
        console.log(BUCKETS.never_opened.html('preview@example.com').replace(/<[^>]+>/g, '').replace(/\n\s+\n/g, '\n').trim());
        console.log(`\n--- Preview of "stalled_at_gate" copy ---\n`);
        console.log(BUCKETS.stalled_at_gate.html('preview@example.com').replace(/<[^>]+>/g, '').replace(/\n\s+\n/g, '\n').trim());
        console.log(`\n--- Preview of "progressing" copy ---\n`);
        console.log(BUCKETS.progressing.html('preview@example.com').replace(/<[^>]+>/g, '').replace(/\n\s+\n/g, '\n').trim());
        console.log(`\nDry run complete. Run with --send to actually send.`);
        return;
    }

    let sent = 0, failed = 0;
    for (const p of plan) {
        try {
            const res = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: { Authorization: `Bearer ${RESEND}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    from: FROM,
                    to: p.email,
                    reply_to: REPLY_TO,
                    subject: p.subject,
                    html: p.html,
                }),
            });
            if (res.ok) {
                const j = await res.json();
                console.log(`  ✓ ${p.email}  id=${j.id?.slice(0, 12)}`);
                sent++;
            } else {
                const t = await res.text();
                console.log(`  ✗ ${p.email}  ${res.status} ${t.slice(0, 100)}`);
                failed++;
            }
        } catch (e) {
            console.log(`  ✗ ${p.email}  ${e.message}`);
            failed++;
        }
        await new Promise(r => setTimeout(r, 600)); // rate-limit friendly
    }
    console.log(`\nSent: ${sent}  Failed: ${failed}`);
})().catch(e => { console.error(e); process.exit(1); });
