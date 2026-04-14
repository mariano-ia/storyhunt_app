import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { getExperience } from '@/lib/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import type { DiscountCoupon } from '@/lib/types';

// ─── POST /api/checkout ──────────────────────────────────────────────────────
// Creates a Stripe Checkout Session for an experience purchase.
// Body: { experience_id: string; lang: 'es' | 'en'; coupon_code?: string }

export async function POST(req: NextRequest) {
    try {
        const { experience_id, lang, coupon_code } = await req.json() as {
            experience_id: string;
            lang: 'es' | 'en';
            coupon_code?: string;
        };

        if (!experience_id || !lang) {
            return NextResponse.json({ error: 'experience_id y lang son requeridos' }, { status: 400 });
        }

        const experience = await getExperience(experience_id);
        if (!experience) {
            return NextResponse.json({ error: 'Experiencia no encontrada' }, { status: 404 });
        }

        const price = (experience as any).price;
        if (!price || price <= 0) {
            return NextResponse.json({ error: 'La experiencia no tiene precio configurado' }, { status: 400 });
        }

        // Pick localized product name + description so Stripe Checkout matches the chosen language
        const exp = experience as any;
        const productName = lang === 'en'
            ? (exp.name_en || exp.name)
            : exp.name;
        const productDescription = lang === 'en'
            ? (exp.web_description_en || exp.description_en || exp.web_description || exp.description || 'Immersive interactive StoryHunt experience')
            : (exp.web_description || exp.description || 'Experiencia interactiva StoryHunt');

        // Build checkout session params
        const sessionParams: Record<string, any> = {
            mode: 'payment',
            payment_method_types: ['card'],
            locale: lang === 'en' ? 'en' : 'es-419',
            line_items: [{
                price_data: {
                    currency: 'usd',
                    unit_amount: Math.round(price * 100), // price is in dollars, Stripe wants cents
                    product_data: {
                        name: productName,
                        description: productDescription.slice(0, 200),
                    },
                },
                quantity: 1,
            }],
            metadata: {
                experience_id,
                lang,
                experience_name: experience.name,
            },
            success_url: `${req.nextUrl.origin}/play/t/{CHECKOUT_SESSION_ID}?success=1&lang=${lang}`,
            cancel_url: `${req.nextUrl.origin}/${experience.slug || `play/${experience_id}`}?cancelled=1`,
        };

        // Apply discount coupon
        if (coupon_code) {
            // First check our DB (Admin SDK — bypasses Firestore rules)
            const couponSnap = await getAdminDb()
                .collection('discount_coupons')
                .where('code', '==', coupon_code.toUpperCase())
                .limit(1)
                .get();
            const coupon = couponSnap.empty
                ? null
                : ({ id: couponSnap.docs[0].id, ...couponSnap.docs[0].data() } as DiscountCoupon);
            if (coupon && coupon.status === 'active' && coupon.times_redeemed < coupon.max_redemptions && coupon.stripe_promo_id) {
                sessionParams.discounts = [{ promotion_code: coupon.stripe_promo_id }];
                sessionParams.metadata.coupon_code = coupon_code;
            } else {
                // Fallback: check if promo code exists directly in Stripe
                try {
                    const stripe = getStripe();
                    const promos = await stripe.promotionCodes.list({ code: coupon_code.toUpperCase(), active: true, limit: 1 });
                    if (promos.data.length > 0) {
                        sessionParams.discounts = [{ promotion_code: promos.data[0].id }];
                        sessionParams.metadata.coupon_code = coupon_code;
                    } else {
                        sessionParams.allow_promotion_codes = true;
                    }
                } catch {
                    sessionParams.allow_promotion_codes = true;
                }
            }
        } else {
            sessionParams.allow_promotion_codes = true;
        }

        const session = await getStripe().checkout.sessions.create(sessionParams);

        return NextResponse.json({ url: session.url, session_id: session.id });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error creando checkout session';
        console.error('[checkout]', err);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
