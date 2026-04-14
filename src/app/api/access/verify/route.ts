import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { getAdminDb } from '@/lib/firebase-admin';
import type { AccessToken, DiscountCoupon } from '@/lib/types';

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
            max_uses: 2,
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

        console.log(`[access/verify] Created token for session ${checkoutId}: ${accessToken.token}`);
        return NextResponse.json({ access_token: accessToken });

    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error verifying access';
        console.error('[access/verify]', err);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
