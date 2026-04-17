import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { getAdminDb } from '@/lib/firebase-admin';
import { Resend } from 'resend';
import type { AccessToken, DiscountCoupon } from '@/lib/types';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

async function sendAccessEmail(email: string, token: string, experienceName: string, lang: 'es' | 'en', startingPoint?: string) {
    if (!resend) return;

    const playUrl = `https://storyhunt.city/play/t/${token}`;
    const isEn = lang === 'en';

    try {
        await resend.emails.send({
            from: 'StoryHunt <hello@storyhunt.city>',
            to: email,
            subject: isEn
                ? `Your access to "${experienceName}" is ready`
                : `Tu acceso a "${experienceName}" está listo`,
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
    <span style="font-size:12px;color:#00d2ff;letter-spacing:0.15em;">ACCESS_GRANTED // MISSION_READY</span>
</td></tr>

<!-- Main -->
<tr><td style="padding:20px 40px;">
    <h1 style="font-size:28px;color:#fff;margin:0 0 16px;line-height:1.3;font-family:'Courier New',monospace;">
        ${isEn ? 'Your hunt is ready.' : 'Tu aventura está lista.'}
    </h1>
    <p style="font-size:16px;color:#888;line-height:1.6;margin:0 0 24px;">
        ${isEn
            ? `You now have access to <strong style="color:#fff;">${experienceName}</strong>. Open the link below on your phone when you're ready to start walking.`
            : `Ya tenés acceso a <strong style="color:#fff;">${experienceName}</strong>. Abrí el link de abajo desde tu teléfono cuando estés listo para salir a caminar.`
        }
    </p>
</td></tr>

<!-- Starting point -->
${startingPoint ? `
<tr><td style="padding:0 40px 16px;">
    <div style="background:rgba(255,0,51,0.08);border:1px solid rgba(255,0,51,0.25);border-radius:8px;padding:12px 16px;">
        <div style="font-size:11px;color:#ff0033;letter-spacing:0.15em;margin-bottom:4px;">${isEn ? 'MEET_POINT' : 'PUNTO_DE_INICIO'}</div>
        <div style="font-size:16px;color:#fff;font-weight:600;">${startingPoint}</div>
        <div style="font-size:12px;color:#666;margin-top:4px;">${isEn ? 'Be there before you tap START' : 'Estando ahí, tocá COMENZAR'}</div>
    </div>
</td></tr>
` : ''}

<!-- CTA Button -->
<tr><td style="padding:0 40px 24px;">
    <a href="${playUrl}" style="display:inline-block;background:#ff0033;color:#fff;padding:16px 32px;text-decoration:none;font-weight:700;font-size:16px;letter-spacing:0.08em;border-radius:4px;font-family:'Courier New',monospace;">
        ${isEn ? 'START_THE_HUNT' : 'COMENZAR_LA_AVENTURA'}
    </a>
</td></tr>

<!-- Instructions -->
<tr><td style="padding:0 40px 32px;">
    <p style="font-size:13px;color:#666;line-height:1.6;margin:0;">
        ${isEn
            ? '• Open the link on your phone<br>• Go to the starting location<br>• Follow the chat clues<br>• You can close and come back anytime — use this same link to continue where you left off<br>• You have 30 days to play'
            : '• Abrí el link desde tu celular<br>• Andá al punto de inicio<br>• Seguí las pistas del chat<br>• Podés cerrar y volver cuando quieras — usá este mismo link para continuar donde lo dejaste<br>• Tenés 30 días para jugar'
        }
    </p>
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
        console.log(`[access/verify] Access email sent to ${email}`);
    } catch (err) {
        console.error('[access/verify] Failed to send access email:', err);
    }
}

// ─── POST /api/access/verify ─────────────────────────────────────────────────
// Verifies a Stripe checkout session and creates an access token if it doesn't exist yet.
// This is a fallback for when the webhook hasn't fired or failed.
// All Firestore writes use Admin SDK so they bypass client security rules.

function generateToken(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let token = 'SH-';
    for (let i = 0; i < 6; i++) token += chars[Math.floor(Math.random() * chars.length)];
    return token;
}

export async function POST(req: NextRequest) {
    try {
        const { session_id, token } = await req.json() as { session_id?: string; token?: string };
        const db = getAdminDb();

        // If it's an SH- token, just look it up
        if (token && !token.startsWith('cs_')) {
            const snap = await db.collection('access_tokens').where('token', '==', token).limit(1).get();
            if (snap.empty) {
                return NextResponse.json({ error: 'Token not found' }, { status: 404 });
            }
            const accessToken = { id: snap.docs[0].id, ...snap.docs[0].data() } as AccessToken;
            return NextResponse.json({ access_token: accessToken });
        }

        const checkoutId = session_id || token;
        if (!checkoutId) {
            return NextResponse.json({ error: 'session_id or token required' }, { status: 400 });
        }

        // First check if we already have an access token for this session
        const existingSnap = await db
            .collection('access_tokens')
            .where('stripe_session_id', '==', checkoutId)
            .limit(1)
            .get();

        if (!existingSnap.empty) {
            const existing = { id: existingSnap.docs[0].id, ...existingSnap.docs[0].data() } as AccessToken;
            return NextResponse.json({ access_token: existing });
        }

        // No token exists — verify with Stripe and create one
        const stripe = getStripe();
        const session = await stripe.checkout.sessions.retrieve(checkoutId);

        if (session.payment_status !== 'paid') {
            return NextResponse.json({ error: 'Payment not completed' }, { status: 402 });
        }

        const metadata = session.metadata || {};
        const experienceId = metadata.experience_id;
        const lang = (metadata.lang || 'es') as 'es' | 'en';
        const experienceName = metadata.experience_name || '';
        const couponCode = metadata.coupon_code;
        const email = session.customer_details?.email || session.customer_email || '';

        if (!experienceId) {
            return NextResponse.json({ error: 'No experience_id in session metadata' }, { status: 400 });
        }

        // Create access token (Admin SDK)
        const nowIso = new Date().toISOString();
        const expiresAt = new Date(Date.now() + 720 * 60 * 60 * 1000).toISOString();
        const tokenData = {
            token: generateToken(),
            experience_id: experienceId,
            lang,
            email,
            max_uses: 20,
            times_used: 0,
            status: 'active' as const,
            expires_at: expiresAt,
            stripe_session_id: checkoutId,
            created_at: nowIso,
        };
        const tokenRef = await db.collection('access_tokens').add(tokenData);
        const accessToken: AccessToken = { id: tokenRef.id, ...tokenData };

        // Record sale
        await db.collection('sales').add({
            experience_id: experienceId,
            experience_name: experienceName,
            email,
            amount: session.amount_total ?? 0,
            currency: session.currency ?? 'usd',
            coupon_code: couponCode,
            discount_applied: session.total_details?.amount_discount ?? 0,
            stripe_session_id: checkoutId,
            access_token_id: accessToken.id,
            created_at: nowIso,
        });

        // Increment coupon if used
        if (couponCode) {
            const couponSnap = await db
                .collection('discount_coupons')
                .where('code', '==', couponCode.toUpperCase())
                .limit(1)
                .get();
            if (!couponSnap.empty) {
                const coupon = { id: couponSnap.docs[0].id, ...couponSnap.docs[0].data() } as DiscountCoupon;
                const newCount = coupon.times_redeemed + 1;
                await db.collection('discount_coupons').doc(coupon.id).update({
                    times_redeemed: newCount,
                    status: newCount >= coupon.max_redemptions ? 'expired' : coupon.status,
                });
            }
        }

        // Send access email (fallback — same as webhook, with starting point)
        if (email) {
            let startingPoint: string | undefined;
            try {
                const expDoc = await db.collection('experiences').doc(experienceId).get();
                startingPoint = expDoc.data()?.starting_point;
            } catch { /* non-critical */ }
            await sendAccessEmail(email, tokenData.token, experienceName, lang, startingPoint);
        }

        console.log(`[access/verify] Created token for session ${checkoutId}: ${accessToken.token}`);
        return NextResponse.json({ access_token: accessToken });

    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error verifying access';
        console.error('[access/verify]', err);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
