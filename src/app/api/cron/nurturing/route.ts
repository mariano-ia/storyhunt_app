import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { Resend } from 'resend';
import {
    mysteryTeaserEmail,
    socialProofEmail,
    missionPendingEmail,
    lastCallEmail,
} from '@/lib/email-templates';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const CRON_SECRET = process.env.CRON_SECRET || '';
const COUPON_CODE = 'THANKYOU40';

// ─── GET /api/cron/nurturing ────────────────────────────────────────────────
// Runs daily. Handles E2 (teaser), E3 (social proof), E5 (mission pending),
// and E7 (last call coupon) nurturing emails.

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!resend) {
        return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 });
    }

    const db = getAdminDb();
    const now = new Date();

    const results = {
        e2_teaser: { sent: 0, failed: 0 },
        e3_social_proof: { sent: 0, failed: 0 },
        e5_mission_pending: { sent: 0, failed: 0 },
        e7_last_call: { sent: 0, failed: 0 },
    };

    try {
        // Run all nurturing checks in parallel
        await Promise.all([
            processE2Teaser(db, now, results),
            processE3SocialProof(db, now, results),
            processE5MissionPending(db, now, results),
            processE7LastCall(db, now, results),
        ]);

        return NextResponse.json({ message: 'Nurturing cycle complete', results });
    } catch (err: any) {
        console.error('[nurturing] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// ─── E2: Mystery Teaser (3 days after signup, not converted) ────────────────

async function processE2Teaser(
    db: FirebaseFirestore.Firestore,
    now: Date,
    results: any,
) {
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const fourDaysAgo = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString();

    const contactsSnap = await db.collection('contacts')
        .where('welcome_sent', '==', true)
        .get();

    for (const doc of contactsSnap.docs) {
        const data = doc.data();

        // Must be 3-4 days old
        if (!data.created_at || data.created_at > threeDaysAgo || data.created_at < fourDaysAgo) continue;
        // Must not have received teaser already
        if (data.teaser_sent) continue;
        // Must not have converted (purchased)
        if (data.converted) continue;
        if (!data.email) continue;

        const isEn = (data.lang || 'en') === 'en';
        const { subject, html } = mysteryTeaserEmail(isEn);

        try {
            await resend!.emails.send({
                from: 'StoryHunt <hello@storyhunt.city>',
                to: data.email,
                subject,
                html,
            });
            await doc.ref.update({ teaser_sent: true, teaser_sent_at: now.toISOString() });
            results.e2_teaser.sent++;
            console.log(`[nurturing/E2] Teaser sent to ${data.email}`);
        } catch (err) {
            results.e2_teaser.failed++;
            console.error(`[nurturing/E2] Failed for ${data.email}:`, err);
        }
    }
}

// ─── E3: Social Proof (7 days after signup, not converted) ──────────────────

async function processE3SocialProof(
    db: FirebaseFirestore.Firestore,
    now: Date,
    results: any,
) {
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString();

    const contactsSnap = await db.collection('contacts')
        .where('teaser_sent', '==', true)
        .get();

    // Get real stats for the email content
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const salesSnap = await db.collection('sales')
        .where('created_at', '>=', thirtyDaysAgo)
        .get();
    const hunterCount = Math.max(salesSnap.size, 10); // floor at 10 for social proof

    // Get satisfaction % from sessions
    const sessionsSnap = await db.collection('sessions')
        .where('status', '==', 'completed')
        .get();
    let positive = 0;
    let total = 0;
    for (const s of sessionsSnap.docs) {
        const d = s.data();
        if (d.rating) {
            total++;
            if (d.rating === 'positive') positive++;
        }
    }
    const satisfactionPct = total > 0 ? Math.round((positive / total) * 100) : 95; // default 95 if no data

    for (const doc of contactsSnap.docs) {
        const data = doc.data();

        // Must be 7-8 days old
        if (!data.created_at || data.created_at > sevenDaysAgo || data.created_at < eightDaysAgo) continue;
        // Must not have received social proof already
        if (data.social_proof_sent) continue;
        // Must not have converted
        if (data.converted) continue;
        if (!data.email) continue;

        const isEn = (data.lang || 'en') === 'en';
        const { subject, html } = socialProofEmail(hunterCount, satisfactionPct, isEn);

        try {
            await resend!.emails.send({
                from: 'StoryHunt <hello@storyhunt.city>',
                to: data.email,
                subject,
                html,
            });
            await doc.ref.update({ social_proof_sent: true, social_proof_sent_at: now.toISOString() });
            results.e3_social_proof.sent++;
            console.log(`[nurturing/E3] Social proof sent to ${data.email}`);
        } catch (err) {
            results.e3_social_proof.failed++;
            console.error(`[nurturing/E3] Failed for ${data.email}:`, err);
        }
    }
}

// ─── E5: Mission Pending (7 days after purchase, token unused) ──────────────

async function processE5MissionPending(
    db: FirebaseFirestore.Firestore,
    now: Date,
    results: any,
) {
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString();

    // Find active tokens with 0 uses, created 7-8 days ago
    const tokensSnap = await db.collection('access_tokens')
        .where('times_used', '==', 0)
        .where('status', '==', 'active')
        .get();

    for (const doc of tokensSnap.docs) {
        const data = doc.data();

        // Must be 7-8 days old
        if (!data.created_at || data.created_at > sevenDaysAgo || data.created_at < eightDaysAgo) continue;
        // Must not have sent reminder already
        if (data.reminder_sent) continue;
        if (!data.email) continue;

        // Calculate days left on token
        const expiresAt = new Date(data.expires_at);
        const daysLeft = Math.max(1, Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));

        // Look up experience name
        let experienceName = 'StoryHunt Experience';
        try {
            const expDoc = await db.collection('experiences').doc(data.experience_id).get();
            if (expDoc.exists) {
                experienceName = expDoc.data()?.name || experienceName;
            }
        } catch { /* use default */ }

        const playUrl = `https://storyhunt.city/play/t/${data.token}`;
        const isEn = (data.lang || 'en') === 'en';
        const { subject, html } = missionPendingEmail(experienceName, playUrl, daysLeft, isEn);

        try {
            await resend!.emails.send({
                from: 'StoryHunt <hello@storyhunt.city>',
                to: data.email,
                subject,
                html,
            });
            await doc.ref.update({ reminder_sent: true, reminder_sent_at: now.toISOString() });
            results.e5_mission_pending.sent++;
            console.log(`[nurturing/E5] Mission pending sent to ${data.email}`);
        } catch (err) {
            results.e5_mission_pending.failed++;
            console.error(`[nurturing/E5] Failed for ${data.email}:`, err);
        }
    }
}

// ─── E7: Last Call (14 days after review email, no new purchase) ────────────

async function processE7LastCall(
    db: FirebaseFirestore.Firestore,
    now: Date,
    results: any,
) {
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString();

    // Find tokens that received review email 14-15 days ago
    const tokensSnap = await db.collection('access_tokens')
        .where('review_email_sent', '==', true)
        .get();

    for (const doc of tokensSnap.docs) {
        const data = doc.data();

        // Must have review email sent 14-15 days ago
        const reviewDate = data.review_email_date || '';
        if (!reviewDate || reviewDate > fourteenDaysAgo || reviewDate < fifteenDaysAgo) continue;
        // Must not have sent last call already
        if (data.last_call_sent) continue;
        if (!data.email) continue;

        // Check if this person made a NEW purchase after the review email
        const newSales = await db.collection('sales')
            .where('email', '==', data.email)
            .where('created_at', '>', reviewDate)
            .get();

        if (!newSales.empty) {
            // Already converted again — skip and mark to avoid re-checking
            await doc.ref.update({ last_call_sent: true, last_call_sent_at: now.toISOString() });
            continue;
        }

        const isEn = (data.lang || 'en') === 'en';
        const { subject, html } = lastCallEmail(COUPON_CODE, isEn);

        try {
            await resend!.emails.send({
                from: 'StoryHunt <hello@storyhunt.city>',
                to: data.email,
                subject,
                html,
            });
            await doc.ref.update({ last_call_sent: true, last_call_sent_at: now.toISOString() });
            results.e7_last_call.sent++;
            console.log(`[nurturing/E7] Last call sent to ${data.email}`);
        } catch (err) {
            results.e7_last_call.failed++;
            console.error(`[nurturing/E7] Failed for ${data.email}:`, err);
        }
    }
}
