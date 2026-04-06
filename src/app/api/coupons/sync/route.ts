import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { verifyAuth } from '@/lib/firebase-admin';
import type { DiscountCouponFormData } from '@/lib/types';

export async function POST(req: NextRequest) {
    const user = await verifyAuth(req);
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    try {
        const data = await req.json() as DiscountCouponFormData;
        const stripe = getStripe();

        // Check if promo code already exists in Stripe
        const existingPromos = await stripe.promotionCodes.list({ code: data.code, limit: 1 });
        if (existingPromos.data.length > 0) {
            const existing = existingPromos.data[0];
            const promotion = existing.promotion as any;
            const couponId = promotion?.coupon || '';
            return NextResponse.json({
                stripe_coupon_id: couponId,
                stripe_promo_id: existing.id,
            });
        }

        // Create new coupon in Stripe
        const stripeCoupon = await stripe.coupons.create({
            ...(data.discount_type === 'percent'
                ? { percent_off: data.discount_value }
                : { amount_off: Math.round(data.discount_value * 100), currency: 'usd' }),
            duration: 'once',
            name: data.code,
        });

        // Create promo code linked to coupon
        const promoCode = await stripe.promotionCodes.create({
            promotion: { type: 'coupon', coupon: stripeCoupon.id },
            code: data.code,
            restrictions: { first_time_transaction: true },
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
