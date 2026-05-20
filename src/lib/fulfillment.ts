// ─── Shared purchase fulfillment ──────────────────────────────────────────────
//
// Both Stripe (direct) and Bokun (OTA distribution: Viator / TripAdvisor /
// GetYourGuide) land in the same place: generate an access token, write a
// sales row with attribution, mark the contact converted, send the access
// email, and fire the server-side Purchase event. Refunds flip token + sale
// to status='refunded'. Keeping the flow in one helper means a single source
// of truth for what a "successful purchase" means in our system.

import crypto from 'crypto';
import { Resend } from 'resend';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from './firebase-admin';
import { trackServer } from './analytics-server';

export type FulfillmentSource =
    | 'direct'
    | 'bokun_viator'
    | 'bokun_tripadvisor'
    | 'bokun_gyg'
    | 'bokun_direct';

// Crockford base32 (no I/L/O/U) — 32 chars × 8 positions = 40 bits entropy.
const TOKEN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateAccessToken(): string {
    const bytes = crypto.randomBytes(8);
    let token = 'SH-';
    for (let i = 0; i < 8; i++) {
        token += TOKEN_ALPHABET[bytes[i] % TOKEN_ALPHABET.length];
    }
    return token;
}

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function sendAccessEmail(
    email: string,
    token: string,
    experienceName: string,
    lang: 'es' | 'en',
    startingPoint?: string,
): Promise<void> {
    if (!resend) return;

    const playUrl = `https://storyhunt.city/play/t/${token}`;
    const isEn = lang === 'en';

    try {
        await resend.emails.send({
            from: 'StoryHunt <hello@storyhunt.city>',
            replyTo: 'hello@storyhunt.city',
            to: email,
            headers: {
                'List-Unsubscribe': `<mailto:hello@storyhunt.city?subject=unsubscribe>, <https://storyhunt.city/unsubscribe?email=${encodeURIComponent(email)}>`,
                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            },
            subject: isEn
                ? `[StoryHunt] Your hunt is ready — ${experienceName}`
                : `[StoryHunt] Tu aventura está lista — ${experienceName}`,
            html: `
<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#050505;font-family:'Courier New',monospace;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#050505;padding:40px 20px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#0a0a0a;border:1px solid #1a1a1a;border-radius:8px;overflow:hidden;">

<tr><td style="padding:32px 40px 24px;border-bottom:1px solid #1a1a1a;">
    <span style="font-size:20px;font-weight:700;color:#fff;letter-spacing:0.1em;">STORY</span><span style="font-size:20px;font-weight:700;color:#ff0033;letter-spacing:0.1em;">HUNT</span>
</td></tr>

<tr><td style="padding:24px 40px 0;">
    <span style="font-size:12px;color:#00d2ff;letter-spacing:0.15em;">ACCESS_GRANTED // MISSION_READY</span>
</td></tr>

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

${startingPoint ? `
<tr><td style="padding:0 40px 16px;">
    <div style="background:rgba(255,0,51,0.08);border:1px solid rgba(255,0,51,0.25);border-radius:8px;padding:12px 16px;">
        <div style="font-size:11px;color:#ff0033;letter-spacing:0.15em;margin-bottom:4px;">${isEn ? 'MEET_POINT' : 'PUNTO_DE_INICIO'}</div>
        <div style="font-size:16px;color:#fff;font-weight:600;">${startingPoint}</div>
        <div style="font-size:12px;color:#666;margin-top:4px;">${isEn ? 'Be there before you tap START' : 'Estando ahí, tocá COMENZAR'}</div>
    </div>
</td></tr>
` : ''}

<tr><td style="padding:0 40px 24px;">
    <a href="${playUrl}" style="display:inline-block;background:#ff0033;color:#fff;padding:16px 32px;text-decoration:none;font-weight:700;font-size:16px;letter-spacing:0.08em;border-radius:4px;font-family:'Courier New',monospace;">
        ${isEn ? 'START_THE_HUNT' : 'COMENZAR_LA_AVENTURA'}
    </a>
</td></tr>

<tr><td style="padding:0 40px 16px;">
    <p style="font-size:13px;color:#666;line-height:1.6;margin:0;">
        ${isEn
            ? '• Open the link on your phone<br>• Go to the starting location<br>• Follow the chat clues<br>• You can close and come back anytime — use this same link to continue where you left off'
            : '• Abrí el link desde tu celular<br>• Andá al punto de inicio<br>• Seguí las pistas del chat<br>• Podés cerrar y volver cuando quieras — usá este mismo link para continuar donde lo dejaste'
        }
    </p>
</td></tr>

<tr><td style="padding:0 40px 32px;">
    <div style="background:rgba(0,210,255,0.06);border:1px solid rgba(0,210,255,0.2);border-radius:8px;padding:12px 16px;">
        <div style="font-size:11px;color:#00d2ff;letter-spacing:0.15em;margin-bottom:6px;">${isEn ? 'COMING_TO_NYC_SOON?' : '¿VIAJÁS_PRONTO_A_NYC?'}</div>
        <div style="font-size:13px;color:#aaa;line-height:1.6;">
            ${isEn
                ? 'Save this link for your trip. Your <strong style="color:#fff;">30-day clock starts the first time you open it on your phone</strong> — not before.'
                : 'Guardá este link para tu viaje. <strong style="color:#fff;">Los 30 días arrancan recién cuando abras el link por primera vez en tu celular</strong> — no antes.'
            }
        </div>
    </div>
</td></tr>

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
        console.log(`[fulfillment] Access email sent to ${email}`);
    } catch (err) {
        console.error('[fulfillment] Failed to send access email:', err);
    }
}

export interface ProvisionAccessArgs {
    email: string;
    experience_id: string;
    experience_name: string;
    lang: 'es' | 'en';
    source: FulfillmentSource;

    // External booking reference — Stripe session_id OR Bokun booking_id.
    // Used for refund handling joins.
    stripe_session_id?: string;
    bokun_booking_id?: string;

    // Sales record fields
    amount?: number;            // cents
    currency?: string;          // 'usd' default
    coupon_code?: string | null;
    discount_applied?: number;  // cents

    // Attribution (Stripe metadata or Bokun-equivalent)
    utm_source?: string | null;
    utm_medium?: string | null;
    utm_campaign?: string | null;
    referrer?: string | null;

    // Meta CAPI matching signals (Stripe-only for now)
    client_ip?: string;
    client_ua?: string;
    fbp?: string;
    fbc?: string;
}

export interface ProvisionAccessResult {
    token: string;
    access_token_id: string;
    sale_id: string;
}

export async function provisionAccess(args: ProvisionAccessArgs): Promise<ProvisionAccessResult> {
    const db = getAdminDb();
    const nowIso = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    const token = generateAccessToken();

    // 1. Access token doc (lazy activation: 30d clock starts on first /play/t/[token])
    const tokenRef = await db.collection('access_tokens').add({
        token,
        experience_id: args.experience_id,
        lang: args.lang,
        email: args.email,
        max_uses: 20,
        times_used: 0,
        status: 'active',
        source: args.source,
        expires_at: expiresAt,
        activated_at: null,
        ...(args.stripe_session_id ? { stripe_session_id: args.stripe_session_id } : {}),
        ...(args.bokun_booking_id ? { bokun_booking_id: args.bokun_booking_id } : {}),
        created_at: nowIso,
    });

    // 2. Sales doc with attribution
    const saleRef = await db.collection('sales').add({
        experience_id: args.experience_id,
        experience_name: args.experience_name,
        email: args.email,
        amount: args.amount ?? 0,
        currency: args.currency ?? 'usd',
        coupon_code: args.coupon_code ? args.coupon_code.toUpperCase() : null,
        discount_applied: args.discount_applied ?? 0,
        ...(args.stripe_session_id ? { stripe_session_id: args.stripe_session_id } : {}),
        ...(args.bokun_booking_id ? { bokun_booking_id: args.bokun_booking_id } : {}),
        access_token_id: tokenRef.id,
        source: args.source,
        utm_source: args.utm_source ?? null,
        utm_medium: args.utm_medium ?? null,
        utm_campaign: args.utm_campaign ?? null,
        referrer: args.referrer ?? null,
        created_at: nowIso,
    });

    // 3. Mark contact converted (stop nurturing E2/E3/E5/E7)
    if (args.email) {
        try {
            const contacts = await db.collection('contacts')
                .where('email', '==', args.email.toLowerCase()).get();
            for (const c of contacts.docs) {
                await c.ref.update({ converted: true, converted_at: nowIso });
            }
        } catch (err) {
            console.error('[fulfillment] Failed to mark contact converted:', err);
        }
    }

    // 4. Increment coupon redemption if applicable
    if (args.coupon_code) {
        try {
            const couponsSnap = await db.collection('discount_coupons')
                .where('code', '==', args.coupon_code.toUpperCase()).get();
            if (!couponsSnap.empty) {
                const couponDoc = couponsSnap.docs[0];
                const couponData = couponDoc.data();
                const maxRed = couponData.max_redemptions || 999;
                await couponDoc.ref.update({
                    times_redeemed: FieldValue.increment(1),
                });
                const fresh = await couponDoc.ref.get();
                const newCount = fresh.data()?.times_redeemed || 0;
                if (newCount >= maxRed) {
                    await couponDoc.ref.update({ status: 'expired' });
                }
            }
        } catch (err) {
            console.error('[fulfillment] Coupon increment failed:', err);
        }
    }

    // 5. Send access email
    if (args.email) {
        let startingPoint: string | undefined;
        try {
            const expDoc = await db.collection('experiences').doc(args.experience_id).get();
            startingPoint = expDoc.data()?.starting_point;
        } catch { /* non-critical */ }
        sendAccessEmail(args.email, token, args.experience_name, args.lang, startingPoint).catch(err =>
            console.error('[fulfillment] sendAccessEmail failed:', err),
        );
    }

    // 6. Server-side Purchase event (Meta CAPI + GA4 MP + PostHog + Firestore log)
    const eventId = args.stripe_session_id || args.bokun_booking_id || `${args.source}_${tokenRef.id}`;
    trackServer('Purchase', {
        event_id: eventId,
        value: (args.amount ?? 0) / 100,
        currency: (args.currency || 'usd').toUpperCase(),
        content_ids: [args.experience_id],
        content_name: args.experience_name,
        email: args.email || undefined,
        coupon: args.coupon_code || undefined,
        lang: args.lang,
        transaction_id: eventId,
        client_ip_address: args.client_ip || undefined,
        client_user_agent: args.client_ua || undefined,
        fbp: args.fbp || undefined,
        fbc: args.fbc || undefined,
    }, 'https://storyhunt.city/start').catch(err =>
        console.error('[fulfillment] trackServer Purchase failed:', err),
    );

    console.log(`[fulfillment] Sale recorded (${args.source}): ${args.experience_name} → ${(args.email || '').replace(/(.{2}).*@/, '$1***@')} → token ${token.slice(0, 5)}***`);

    return { token, access_token_id: tokenRef.id, sale_id: saleRef.id };
}

// ─── Refund handling ─────────────────────────────────────────────────────────
// Flips both the access token AND the corresponding sale row to status='refunded'.
// Lookup key is the external booking ref (stripe_session_id OR bokun_booking_id).

export type RefundLookupKey =
    | { stripe_session_id: string }
    | { bokun_booking_id: string };

export async function markAccessRefunded(key: RefundLookupKey): Promise<{ tokensRefunded: number; salesRefunded: number }> {
    const db = getAdminDb();
    const nowIso = new Date().toISOString();
    const [keyName, keyValue] = Object.entries(key)[0];

    const tokens = await db.collection('access_tokens').where(keyName, '==', keyValue).get();
    for (const t of tokens.docs) {
        await t.ref.update({ status: 'refunded', refunded_at: nowIso });
    }
    const sales = await db.collection('sales').where(keyName, '==', keyValue).get();
    for (const s of sales.docs) {
        await s.ref.update({ status: 'refunded', refunded_at: nowIso });
    }

    console.log(`[fulfillment] Refunded ${tokens.size} token(s) + ${sales.size} sale(s) for ${keyName}=${keyValue}`);
    return { tokensRefunded: tokens.size, salesRefunded: sales.size };
}
