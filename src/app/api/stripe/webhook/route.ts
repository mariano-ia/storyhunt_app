import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { getAdminDb } from '@/lib/firebase-admin';
import type Stripe from 'stripe';

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

            console.log(`[stripe/webhook] Sale recorded: ${experienceName} → ${email} → token ${token}`);

        } catch (err) {
            console.error('[stripe/webhook] Error processing payment:', err);
            return NextResponse.json({ error: 'Error processing payment' }, { status: 500 });
        }
    }

    return NextResponse.json({ received: true });
}
