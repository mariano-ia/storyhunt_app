import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { provisionAccess, markAccessRefunded, type FulfillmentSource } from '@/lib/fulfillment';

// ─── Bokun webhook (OTA distribution: Viator / TripAdvisor / GetYourGuide) ──
//
// Bokun's "HTTP Booking notification" (Settings → Connections → Integrated
// systems) does NOT sign payloads with HMAC. Auth is a shared-token query
// param: configure `Query parameters` field as `token=<BOKUN_WEBHOOK_SECRET>`
// in the Bokun integration form. Webhook only accepts requests whose `?token`
// matches the env var.
//
// We mirror the Stripe flow on the inside: dedupe via bokun_events/{id}, map
// productId → our experience_id, and call provisionAccess() to generate token
// + sale + access email. Cancellations flip token + sale to status='refunded'.

// Event types we care about. Bokun's HTTP Booking notification fires three
// distinct events — we surface them via the body's `eventType`-equivalent
// field (varies by Bokun version: action, type, eventType).
const CONFIRMED_EVENTS = new Set([
    'booking_confirmed', 'booking.confirmed', 'booking-confirmed',
    'booking_created', 'booking.created', 'booking-created',
    'confirmed', 'created',
]);
const CANCELLED_EVENTS = new Set([
    'booking_cancelled', 'booking.cancelled', 'booking-cancelled',
    'booking_canceled', 'booking.canceled',
    'cancelled', 'canceled',
]);

function verifyQueryToken(req: NextRequest, secret: string): boolean {
    const token = req.nextUrl.searchParams.get('token');
    if (!token) return false;
    // Constant-time compare to dodge token-leak via timing side channels.
    const a = Buffer.from(token);
    const b = Buffer.from(secret);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

async function isFirstTimeEvent(eventId: string): Promise<boolean> {
    try {
        await getAdminDb().collection('bokun_events').doc(eventId).create({
            received_at: FieldValue.serverTimestamp(),
        });
        return true;
    } catch (err) {
        void err;
        return false;
    }
}

interface BokunPayload {
    id?: string | number;
    bookingId?: string | number;
    confirmationCode?: string;
    action?: string;           // 'BOOKING_CONFIRMED' / 'BOOKING_CANCELLED' (Bokun HTTP Booking notification)
    eventType?: string;
    type?: string;
    status?: string;
    product?: { id?: string | number; title?: string; externalId?: string };
    productId?: string | number;
    productConfirmationCode?: string;
    customer?: {
        email?: string;
        firstName?: string;
        lastName?: string;
        language?: string;
        languageCode?: string;
    };
    contact?: { email?: string };
    vendor?: { id?: string | number; title?: string };
    seller?: { title?: string };
    salesChannel?: string;
    bookingChannel?: { title?: string; type?: string };
    affiliate?: { title?: string };
    totalPrice?: number;
    currency?: string;
    couponCode?: string;
    discountCode?: string;
}

// Map Bokun "where did this booking come from" signals → our canonical source string.
function resolveSource(payload: BokunPayload): FulfillmentSource {
    const candidates = [
        payload.salesChannel,
        payload.bookingChannel?.title,
        payload.bookingChannel?.type,
        payload.vendor?.title,
        payload.seller?.title,
        payload.affiliate?.title,
    ].filter(Boolean).map(s => String(s).toLowerCase());

    const joined = candidates.join(' ');
    if (joined.includes('viator')) return 'bokun_viator';
    if (joined.includes('tripadvisor') || joined.includes('trip advisor')) return 'bokun_tripadvisor';
    if (joined.includes('getyourguide') || joined.includes('gyg') || joined.includes('get your guide')) return 'bokun_gyg';
    return 'bokun_direct';
}

function resolveLang(payload: BokunPayload): 'es' | 'en' {
    const raw = (payload.customer?.language || payload.customer?.languageCode || '').toLowerCase();
    if (raw.startsWith('es')) return 'es';
    return 'en';
}

function resolveBookingId(payload: BokunPayload): string | null {
    if (payload.id != null) return String(payload.id);
    if (payload.bookingId != null) return String(payload.bookingId);
    if (payload.confirmationCode) return payload.confirmationCode;
    if (payload.productConfirmationCode) return payload.productConfirmationCode;
    return null;
}

function resolveEventType(req: NextRequest, payload: BokunPayload): string {
    // Bokun's HTTP Booking notification embeds the action in the payload
    // (varies: action / type / eventType / status). Header fallback for older
    // pub/sub-style configs.
    const fromHeader = req.headers.get('x-bokun-topic') || req.headers.get('x-bokun-event');
    const fromBody = payload.action || payload.eventType || payload.type || '';
    const raw = fromHeader || fromBody;
    return String(raw).toLowerCase().replace(/\s+/g, '_');
}

async function logRun(payload: { event_type: string; ok: boolean; error?: string; booking_id?: string | null }) {
    try {
        await getAdminDb().collection('cron_runs').add({
            cron: 'bokun_webhook',
            ...payload,
            timestamp: FieldValue.serverTimestamp(),
        });
    } catch (err) {
        console.error('[bokun/webhook] cron_runs log failed:', err);
    }
}

export async function POST(req: NextRequest) {
    const secret = process.env.BOKUN_WEBHOOK_SECRET;
    if (!secret) {
        console.error('[bokun/webhook] BOKUN_WEBHOOK_SECRET not configured — rejecting');
        return NextResponse.json({ error: 'webhook not configured' }, { status: 503 });
    }
    if (!verifyQueryToken(req, secret)) {
        console.error('[bokun/webhook] Invalid or missing ?token');
        return NextResponse.json({ error: 'invalid token' }, { status: 401 });
    }

    const rawBody = await req.text();
    let payload: BokunPayload;
    try {
        payload = JSON.parse(rawBody);
    } catch (err) {
        console.error('[bokun/webhook] JSON parse failed:', err);
        return NextResponse.json({ error: 'invalid json' }, { status: 400 });
    }

    const bookingId = resolveBookingId(payload);
    const eventType = resolveEventType(req, payload);

    if (!bookingId) {
        console.error('[bokun/webhook] No booking id in payload');
        await logRun({ event_type: eventType, ok: false, error: 'missing_booking_id' });
        return NextResponse.json({ received: true, skipped: 'missing_booking_id' });
    }

    // Idempotency: dedup by `<eventType>:<bookingId>` so a confirm + later
    // cancel for the same booking don't collide on the same doc id.
    const eventDocId = `${eventType || 'unknown'}:${bookingId}`;
    if (!(await isFirstTimeEvent(eventDocId))) {
        console.log(`[bokun/webhook] Duplicate event ${eventDocId} — skip`);
        return NextResponse.json({ received: true, duplicate: true });
    }

    // ─── Cancellation / refund ───────────────────────────────────────────────
    if (CANCELLED_EVENTS.has(eventType)) {
        try {
            const result = await markAccessRefunded({ bokun_booking_id: bookingId });
            await logRun({ event_type: eventType, ok: true, booking_id: bookingId });
            return NextResponse.json({ received: true, ...result });
        } catch (err) {
            console.error('[bokun/webhook] cancellation handling failed:', err);
            await logRun({ event_type: eventType, ok: false, error: String(err), booking_id: bookingId });
            return NextResponse.json({ received: true, error: 'cancellation_failed' });
        }
    }

    // ─── Confirmation → provision access ─────────────────────────────────────
    if (CONFIRMED_EVENTS.has(eventType) || payload.status === 'CONFIRMED') {
        const productId = payload.product?.id != null
            ? String(payload.product.id)
            : payload.productId != null ? String(payload.productId) : null;
        const productExternalId = payload.product?.externalId ? String(payload.product.externalId) : null;

        if (!productId && !productExternalId) {
            console.error('[bokun/webhook] No product id in payload');
            await logRun({ event_type: eventType, ok: false, error: 'missing_product_id', booking_id: bookingId });
            return NextResponse.json({ received: true, skipped: 'missing_product_id' });
        }

        // Map Bokun product → StoryHunt experience via `bokun_product_id` field
        const db = getAdminDb();
        let experienceDoc = null;
        for (const candidate of [productId, productExternalId].filter(Boolean) as string[]) {
            const snap = await db.collection('experiences').where('bokun_product_id', '==', candidate).limit(1).get();
            if (!snap.empty) {
                experienceDoc = snap.docs[0];
                break;
            }
        }
        if (!experienceDoc) {
            console.error(`[bokun/webhook] No experience mapped to Bokun product ${productId || productExternalId}`);
            await logRun({ event_type: eventType, ok: false, error: `unmapped_product:${productId || productExternalId}`, booking_id: bookingId });
            return NextResponse.json({ received: true, skipped: 'unmapped_product' });
        }
        const expData = experienceDoc.data();
        const experienceId = experienceDoc.id;
        const experienceName = expData.name || '';

        const email = payload.customer?.email || payload.contact?.email || '';
        if (!email) {
            console.error(`[bokun/webhook] 🚨 No email in Bokun payload for booking ${bookingId}. Token will be created but access email will NOT be sent.`);
        }

        const lang = resolveLang(payload);
        const source = resolveSource(payload);

        // Belt-and-suspenders: skip if sale row already exists for this Bokun booking.
        const existing = await db.collection('sales').where('bokun_booking_id', '==', bookingId).limit(1).get();
        if (!existing.empty) {
            console.log(`[bokun/webhook] Sale already exists for booking ${bookingId} — skip`);
            return NextResponse.json({ received: true, duplicate: true });
        }

        try {
            const result = await provisionAccess({
                email,
                experience_id: experienceId,
                experience_name: experienceName,
                lang,
                source,
                bokun_booking_id: bookingId,
                amount: payload.totalPrice != null ? Math.round(payload.totalPrice * 100) : 0,
                currency: (payload.currency || 'usd').toLowerCase(),
                coupon_code: payload.couponCode || payload.discountCode || null,
            });
            console.log(`[bokun/webhook] Provisioned access for booking ${bookingId} → token ${result.token.slice(0, 5)}***`);
            await logRun({ event_type: eventType, ok: true, booking_id: bookingId });
            return NextResponse.json({ received: true, token: result.token });
        } catch (err) {
            console.error('[bokun/webhook] 🚨 Error processing booking:', err);
            await logRun({ event_type: eventType, ok: false, error: String(err), booking_id: bookingId });
            return NextResponse.json({ received: true, error: 'processing_failed' });
        }
    }

    // Other events (booking_updated, etc.): ack so Bokun stops retrying.
    console.log(`[bokun/webhook] Unhandled event ${eventType} for booking ${bookingId}`);
    await logRun({ event_type: eventType, ok: true, booking_id: bookingId });
    return NextResponse.json({ received: true, ignored: eventType });
}
