import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { createAccessToken, createSale, getCouponByCode, updateCoupon } from '@/lib/firestore';
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
            // 1. Create access token (48hs, 2 uses)
            const accessToken = await createAccessToken({
                experience_id: experienceId,
                lang,
                email,
                max_uses: 2,
                expires_hours: 48,
                stripe_session_id: session.id,
            });

            // 2. Record sale
            await createSale({
                experience_id: experienceId,
                experience_name: experienceName,
                email,
                amount: session.amount_total ?? 0,
                currency: session.currency ?? 'usd',
                coupon_code: couponCode,
                discount_applied: session.total_details?.amount_discount ?? 0,
                stripe_session_id: session.id,
                access_token_id: accessToken.id,
            });

            // 3. Increment coupon redemption if used
            if (couponCode) {
                const coupon = await getCouponByCode(couponCode);
                if (coupon) {
                    const newCount = coupon.times_redeemed + 1;
                    await updateCoupon(coupon.id, {
                        times_redeemed: newCount,
                        status: newCount >= coupon.max_redemptions ? 'expired' : coupon.status,
                    });
                }
            }

            console.log(`[stripe/webhook] Sale recorded: ${experienceName} → ${email} → token ${accessToken.token}`);

        } catch (err) {
            console.error('[stripe/webhook] Error processing payment:', err);
            return NextResponse.json({ error: 'Error processing payment' }, { status: 500 });
        }
    }

    return NextResponse.json({ received: true });
}
