import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { getAdminDb } from '@/lib/firebase-admin';
import { Resend } from 'resend';
import type Stripe from 'stripe';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

async function sendAccessEmail(email: string, token: string, experienceName: string, lang: 'es' | 'en') {
    if (!resend) return;

    const playUrl = `https://storyhunt.city/play/t/${token}`;
    const isEn = lang === 'en';

    try {
        await resend.emails.send({
            from: 'StoryHunt <onboarding@resend.dev>',
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

<!-- CTA Button -->
<tr><td style="padding:0 40px 24px;">
    <a href="${playUrl}" style="display:inline-block;background:#ff0033;color:#fff;padding:16px 32px;text-decoration:none;font-weight:700;font-size:16px;letter-spacing:0.08em;border-radius:4px;font-family:'Courier New',monospace;">
        ${isEn ? 'START_THE_HUNT' : 'COMENZAR_LA_AVENTURA'}
    </a>
</td></tr>

<!-- Token -->
<tr><td style="padding:0 40px 24px;">
    <div style="background:#111;border:1px solid #222;border-radius:4px;padding:16px;">
        <span style="font-size:11px;color:#666;letter-spacing:0.1em;">${isEn ? 'YOUR ACCESS CODE' : 'TU CÓDIGO DE ACCESO'}</span><br>
        <span style="font-size:24px;color:#00d2ff;font-weight:700;letter-spacing:0.15em;">${token}</span>
    </div>
</td></tr>

<!-- Instructions -->
<tr><td style="padding:0 40px 32px;">
    <p style="font-size:13px;color:#666;line-height:1.6;margin:0;">
        ${isEn
            ? '• Open the link on your phone<br>• Go to the starting location<br>• Follow the chat clues<br>• You have 2 uses and 30 days to play'
            : '• Abrí el link desde tu celular<br>• Andá al punto de inicio<br>• Seguí las pistas del chat<br>• Tenés 2 usos y 30 días para jugar'
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
        console.log(`[stripe/webhook] Access email sent to ${email}`);
    } catch (err) {
        console.error('[stripe/webhook] Failed to send access email:', err);
    }
}

// ─── POST /api/stripe/webhook ────────────────────────────────────────────────
// Processes Stripe webhook events (checkout.session.completed).

export async function POST(req: NextRequest) {
    const body = await req.text();
    const sig = req.headers.get('stripe-signature');

    if (!sig) {
        return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
    }

    let event: Stripe.Event;
    try {
        event = getStripe().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Webhook signature verification failed';
        console.error('[stripe/webhook] Signature error:', message);
        return NextResponse.json({ error: message }, { status: 400 });
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        const metadata = session.metadata || {};

        const experienceId = metadata.experience_id;
        const lang = (metadata.lang || 'es') as 'es' | 'en';
        const experienceName = metadata.experience_name || '';
        const couponCode = metadata.coupon_code;
        const email = session.customer_details?.email || session.customer_email || '';

        if (!experienceId) {
            console.error('[stripe/webhook] No experience_id in metadata');
            return NextResponse.json({ error: 'Missing experience_id' }, { status: 400 });
        }

        try {
            const db = getAdminDb();

            // 1. Create access token (30 days, 2 uses)
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            let token = 'SH-';
            for (let i = 0; i < 6; i++) token += chars[Math.floor(Math.random() * chars.length)];

            const expiresAt = new Date(Date.now() + 720 * 60 * 60 * 1000).toISOString();
            const tokenRef = await db.collection('access_tokens').add({
                token,
                experience_id: experienceId,
                lang,
                email,
                max_uses: 2,
                times_used: 0,
                status: 'active',
                expires_at: expiresAt,
                stripe_session_id: session.id,
                created_at: new Date().toISOString(),
            });

            // 2. Record sale
            await db.collection('sales').add({
                experience_id: experienceId,
                experience_name: experienceName,
                email,
                amount: session.amount_total ?? 0,
                currency: session.currency ?? 'usd',
                coupon_code: couponCode || null,
                discount_applied: session.total_details?.amount_discount ?? 0,
                stripe_session_id: session.id,
                access_token_id: tokenRef.id,
                created_at: new Date().toISOString(),
            });

            // 3. Increment coupon redemption if used
            if (couponCode) {
                const couponsSnap = await db.collection('discount_coupons').where('code', '==', couponCode.toUpperCase()).get();
                if (!couponsSnap.empty) {
                    const couponDoc = couponsSnap.docs[0];
                    const couponData = couponDoc.data();
                    const newCount = (couponData.times_redeemed || 0) + 1;
                    await couponDoc.ref.update({
                        times_redeemed: newCount,
                        status: newCount >= (couponData.max_redemptions || 999) ? 'expired' : couponData.status,
                    });
                }
            }

            // 4. Send access email to customer
            if (email) {
                await sendAccessEmail(email, token, experienceName, lang);
            }

            console.log(`[stripe/webhook] Sale recorded: ${experienceName} → ${email} → token ${token}`);

        } catch (err) {
            console.error('[stripe/webhook] Error processing payment:', err);
            return NextResponse.json({ error: 'Error processing payment' }, { status: 500 });
        }
    }

    return NextResponse.json({ received: true });
}
