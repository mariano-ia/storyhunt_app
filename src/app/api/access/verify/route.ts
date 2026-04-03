import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { createAccessToken, createSale, getAccessToken, getCouponByCode, updateCoupon } from '@/lib/firestore';

// ─── POST /api/access/verify ─────────────────────────────────────────────────
// Verifies a Stripe checkout session and creates an access token if it doesn't exist yet.
// This is a fallback for when the webhook hasn't fired or failed.

export async function POST(req: NextRequest) {
    try {
        const { session_id, token } = await req.json() as { session_id?: string; token?: string };

        // If it's an SH- token, just look it up
        if (token && !token.startsWith('cs_')) {
            const accessToken = await getAccessToken(token);
            if (!accessToken) {
                return NextResponse.json({ error: 'Token not found' }, { status: 404 });
            }
            return NextResponse.json({ access_token: accessToken });
        }

        const checkoutId = session_id || token;
        if (!checkoutId) {
            return NextResponse.json({ error: 'session_id or token required' }, { status: 400 });
        }

        // First check if we already have an access token for this session
        const { getDocs, collection, query, where } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        const q = query(collection(db, 'access_tokens'), where('stripe_session_id', '==', checkoutId));
        const snap = await getDocs(q);

        if (!snap.empty) {
            const existing = { id: snap.docs[0].id, ...snap.docs[0].data() };
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

        // Create access token
        const accessToken = await createAccessToken({
            experience_id: experienceId,
            lang,
            email,
            max_uses: 2,
            expires_hours: 48,
            stripe_session_id: checkoutId,
        });

        // Record sale
        await createSale({
            experience_id: experienceId,
            experience_name: experienceName,
            email,
            amount: session.amount_total ?? 0,
            currency: session.currency ?? 'usd',
            coupon_code: couponCode,
            discount_applied: session.total_details?.amount_discount ?? 0,
            stripe_session_id: checkoutId,
            access_token_id: accessToken.id,
        });

        // Increment coupon if used
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

        console.log(`[access/verify] Created token for session ${checkoutId}: ${accessToken.token}`);
        return NextResponse.json({ access_token: accessToken });

    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error verifying access';
        console.error('[access/verify]', err);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
