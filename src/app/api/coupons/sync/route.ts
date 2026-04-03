import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import type { DiscountCouponFormData } from '@/lib/types';

// ─── POST /api/coupons/sync ──────────────────────────────────────────────────
// Creates a coupon + promotion code in Stripe, returns their IDs.

export async function POST(req: NextRequest) {
    try {
        const data = await req.json() as DiscountCouponFormData;

        // Create Stripe coupon
        const stripeCoupon = await stripe.coupons.create({
            ...(data.discount_type === 'percent'
                ? { percent_off: data.discount_value }
                : { amount_off: Math.round(data.discount_value * 100), currency: 'usd' }),
            max_redemptions: data.max_redemptions,
            redeem_by: Math.floor(new Date(data.valid_until).getTime() / 1000),
        });

        // Create promotion code (the user-facing code)
        const promoCode = await stripe.promotionCodes.create({
            promotion: { type: 'coupon', coupon: stripeCoupon.id },
            code: data.code,
            max_redemptions: data.max_redemptions,
            expires_at: Math.floor(new Date(data.valid_until).getTime() / 1000),
        });

        return NextResponse.json({
            stripe_coupon_id: stripeCoupon.id,
            stripe_promo_id: promoCode.id,
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error syncing with Stripe';
        console.error('[coupons/sync]', err);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
