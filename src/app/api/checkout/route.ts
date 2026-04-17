import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { getExperience } from '@/lib/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { callLLM } from '@/lib/llm';
import type { DiscountCoupon } from '@/lib/types';

// Ensure the experience has name + description in the requested lang.
// Translates from whatever source text exists and caches the result in Firestore
// under `<field>_<lang>` so subsequent checkouts are instant.
async function getLocalizedProduct(
    exp: Record<string, any>,
    experienceId: string,
    lang: 'es' | 'en',
): Promise<{ name: string; description: string }> {
    const nameField = `name_${lang}`;
    const descField = `web_description_${lang}`;

    const cachedName = exp[nameField];
    const cachedDesc = exp[descField];
    if (cachedName && cachedDesc) {
        return { name: cachedName, description: cachedDesc };
    }

    const sourceName = exp.name || '';
    const sourceDesc = exp.web_description || exp.description || '';

    const apiKey = process.env.OPENAI_API_KEY || '';
    const targetLabel = lang === 'en' ? 'English' : 'neutral Latin American Spanish';
    const fallbackName = lang === 'en' ? 'StoryHunt Experience' : 'Experiencia StoryHunt';
    const fallbackDesc = lang === 'en'
        ? 'Immersive interactive StoryHunt experience'
        : 'Experiencia interactiva StoryHunt';

    const translate = async (text: string, fallback: string): Promise<string> => {
        if (!text?.trim()) return fallback;
        if (!apiKey) return fallback;
        const prompt = `You are a professional translator. Translate the text the user sends you into ${targetLabel}. Keep proper nouns, place names, and the tone intact. If the text is already in ${targetLabel}, return it unchanged. Respond ONLY with the translated text, no explanations or quotes.`;
        try {
            const result = await callLLM(apiKey, prompt, text, { temperature: 0.2, maxTokens: 400 });
            return result.text?.trim() || fallback;
        } catch (err) {
            console.error('[checkout] translate error', err);
            return fallback;
        }
    };

    const [name, description] = await Promise.all([
        cachedName ? Promise.resolve(cachedName) : translate(sourceName, fallbackName),
        cachedDesc ? Promise.resolve(cachedDesc) : translate(sourceDesc, fallbackDesc),
    ]);

    // Cache to Firestore so next checkout is instant (fire-and-forget, non-blocking)
    const updates: Record<string, string> = {};
    if (!cachedName && name) updates[nameField] = name;
    if (!cachedDesc && description) updates[descField] = description;
    if (Object.keys(updates).length > 0) {
        getAdminDb().collection('experiences').doc(experienceId).update(updates).catch(err => {
            console.error('[checkout] failed to cache translations', err);
        });
    }

    return { name, description };
}

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

        // Guarantee product strings in the chosen lang (translates + caches on first miss)
        const { name: productName, description: productDescription } = await getLocalizedProduct(
            experience as any,
            experience_id,
            lang,
        );

        // Append starting point to Stripe product description if available
        const exp = experience as any;
        const startingPoint = exp.starting_point;
        const fullDescription = startingPoint
            ? `${productDescription.slice(0, 150)} | ${lang === 'en' ? 'Starts at' : 'Comienza en'}: ${startingPoint}`
            : productDescription.slice(0, 200);

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
                        description: fullDescription.slice(0, 200),
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
