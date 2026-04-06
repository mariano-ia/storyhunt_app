import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const CRON_SECRET = process.env.CRON_SECRET || '';
const COUPON_CODE = 'THANKYOU40';

// ─── GET /api/cron/post-experience-email ────────────────────────────────────
// Runs daily. Finds users who completed an experience 24+ hours ago
// and haven't received a review email yet. Sends review request + 40% coupon.

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
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const threeDaysAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString();

    try {
        // Find access tokens that were used (times_used > 0) and created 24-72h ago
        const tokensSnap = await db.collection('access_tokens')
            .where('times_used', '>', 0)
            .get();

        const eligible = tokensSnap.docs.filter(doc => {
            const data = doc.data();
            // Must have been created 24-72h ago
            const createdAt = data.created_at || '';
            if (createdAt > oneDayAgo || createdAt < threeDaysAgo) return false;
            // Must not have already received review email
            if (data.review_email_sent) return false;
            // Must have email
            if (!data.email) return false;
            return true;
        });

        if (eligible.length === 0) {
            return NextResponse.json({ message: 'No eligible users for review email', checked: tokensSnap.size });
        }

        const results: { email: string; success: boolean }[] = [];

        for (const doc of eligible) {
            const data = doc.data();
            const email = data.email;
            const lang = (data.lang || 'es') as 'es' | 'en';
            const experienceId = data.experience_id;

            // Look up experience name
            let experienceName = 'StoryHunt Experience';
            try {
                const expDoc = await db.collection('experiences').doc(experienceId).get();
                if (expDoc.exists) {
                    experienceName = expDoc.data()?.name || experienceName;
                }
            } catch { /* use default */ }

            // Ensure THANKYOU40 coupon exists in Firestore (create once, reuse forever)
            const existingCoupon = await db.collection('discount_coupons').where('code', '==', COUPON_CODE).get();
            if (existingCoupon.empty) {
                await db.collection('discount_coupons').add({
                    code: COUPON_CODE,
                    discount_type: 'percent',
                    discount_value: 40,
                    max_redemptions: 9999,
                    times_redeemed: 0,
                    valid_until: '2027-12-31T23:59:59.000Z',
                    status: 'active',
                    stripe_coupon_id: 'nOh4AMZw',
                    stripe_promo_id: 'promo_1TJJsBL7BKrNVx2i5sOrziQl',
                    description: '40% off — post-experience review reward',
                    created_at: new Date().toISOString(),
                });
            }

            const isEn = lang === 'en';
            const success = await sendReviewEmail(email, experienceName, COUPON_CODE, isEn);

            // Mark as sent
            await doc.ref.update({ review_email_sent: true, review_email_date: new Date().toISOString() });

            results.push({ email, success });
        }

        return NextResponse.json({
            sent: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            results,
        });

    } catch (err: any) {
        console.error('[post-experience-email] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}


async function sendReviewEmail(email: string, experienceName: string, couponCode: string, isEn: boolean): Promise<boolean> {
    if (!resend) return false;

    try {
        await resend.emails.send({
            from: 'StoryHunt <onboarding@resend.dev>',
            to: email,
            subject: isEn
                ? `How was "${experienceName}"? + 40% off your next hunt`
                : `¿Cómo fue "${experienceName}"? + 40% off en tu próxima aventura`,
            html: `
<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#050505;font-family:'Courier New',monospace;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#050505;padding:40px 20px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#0a0a0a;border:1px solid #1a1a1a;border-radius:8px;overflow:hidden;">

<!-- Header -->
<tr><td style="padding:32px 40px 24px;border-bottom:1px solid #1a1a1a;">
    <span style="font-size:20px;font-weight:700;color:#fff;letter-spacing:0.1em;">STORY</span><span style="font-size:20px;font-weight:700;color:#ff0033;letter-spacing:0.1em;">HUNT</span>
</td></tr>

<!-- Status -->
<tr><td style="padding:24px 40px 0;">
    <span style="font-size:12px;color:#00d2ff;letter-spacing:0.15em;">MISSION_COMPLETE // DEBRIEF_REQUESTED</span>
</td></tr>

<!-- Main -->
<tr><td style="padding:20px 40px;">
    <h1 style="font-size:26px;color:#fff;margin:0 0 16px;line-height:1.3;font-family:'Courier New',monospace;">
        ${isEn ? 'How was your hunt?' : '¿Cómo fue tu aventura?'}
    </h1>
    <p style="font-size:16px;color:#888;line-height:1.6;margin:0 0 24px;">
        ${isEn
                ? `You completed <strong style="color:#fff;">${experienceName}</strong>. We'd love to hear what you thought — your feedback helps us make better missions.`
                : `Completaste <strong style="color:#fff;">${experienceName}</strong>. Nos encantaría saber qué te pareció — tu feedback nos ayuda a crear mejores misiones.`
            }
    </p>
</td></tr>

<!-- Coupon -->
<tr><td style="padding:0 40px 8px;">
    <span style="font-size:12px;color:#00d2ff;letter-spacing:0.15em;">REWARD_UNLOCKED</span>
</td></tr>
<tr><td style="padding:0 40px 24px;">
    <p style="font-size:16px;color:#888;line-height:1.6;margin:0 0 16px;">
        ${isEn
                ? 'As a thank you, here\'s <strong style="color:#fff;">40% off</strong> your next StoryHunt experience:'
                : 'Como agradecimiento, acá tenés <strong style="color:#fff;">40% off</strong> en tu próxima experiencia:'
            }
    </p>
    <div style="background:#111;border:1px solid #222;border-radius:4px;padding:20px;text-align:center;">
        <span style="font-size:11px;color:#666;letter-spacing:0.1em;">${isEn ? 'YOUR DISCOUNT CODE' : 'TU CÓDIGO DE DESCUENTO'}</span><br>
        <span style="font-size:32px;color:#ff0033;font-weight:700;letter-spacing:0.15em;">${couponCode}</span><br>
        <span style="font-size:13px;color:#666;margin-top:8px;display:inline-block;">40% OFF — ${isEn ? 'one time use' : 'un solo uso'}</span>
    </div>
    <p style="font-size:13px;color:#666;line-height:1.6;margin:16px 0 0;">
        ${isEn
                ? 'Enter the code at checkout when purchasing your next experience on <strong style="color:#888;">storyhunt.city</strong>.'
                : 'Ingresá el código en el checkout cuando compres tu próxima experiencia en <strong style="color:#888;">storyhunt.city</strong>.'
            }
    </p>
</td></tr>

<!-- Browse CTA -->
<tr><td style="padding:0 40px 32px;">
    <a href="https://storyhunt.city" style="display:inline-block;background:#ff0033;color:#fff;padding:16px 32px;text-decoration:none;font-weight:700;font-size:16px;letter-spacing:0.08em;border-radius:4px;font-family:'Courier New',monospace;">
        ${isEn ? 'BROWSE_EXPERIENCES' : 'VER_EXPERIENCIAS'}
    </a>
</td></tr>

<!-- Footer -->
<tr><td style="padding:20px 40px;border-top:1px solid #1a1a1a;">
    <p style="font-size:11px;color:#444;margin:0;letter-spacing:0.05em;">
        STORYHUNT // DECODE_THE_CITY<br>
        <a href="https://storyhunt.city" style="color:#444;text-decoration:none;">storyhunt.city</a>
        &nbsp;·&nbsp;
        <a href="https://www.instagram.com/storyhunt.city/" style="color:#444;text-decoration:none;">@storyhunt.city</a>
    </p>
</td></tr>

</table>
</td></tr>
</table>
</body></html>`,
        });
        console.log(`[post-experience-email] Review email sent to ${email} with coupon ${couponCode}`);
        return true;
    } catch (err) {
        console.error(`[post-experience-email] Failed to send to ${email}:`, err);
        return false;
    }
}
