// ─── Server-side analytics wrapper ──────────────────────────────────────────
//
// Mirrors the client-side wrapper but fires from the server:
//   - Meta Conversions API (CAPI) — survives ad blockers + iOS tracking prevention
//   - GA4 Measurement Protocol — same
//   - Firestore `events` collection — our own log, queryable from /dashboard
//
// All three receive the SAME event_id when one is provided, so platforms dedupe
// against client-side counterparts.

import crypto from 'crypto';
import { getAdminDb } from './firebase-admin';

const META_PIXEL_ID = '1719479962357595';
const GA4_MEASUREMENT_ID = 'G-4EWN9RMYR9';

type EventName = 'Lead' | 'InitiateCheckout' | 'AddPaymentInfo' | 'Purchase';

export interface ServerEventPayload {
    event_id?: string;
    value?: number;
    currency?: string;
    content_ids?: string[];
    content_name?: string;
    email?: string;
    coupon?: string;
    lang?: string;
    transaction_id?: string;
    client_ip_address?: string;
    client_user_agent?: string;
    fbp?: string; // Facebook browser cookie
    fbc?: string; // Facebook click ID
    ga_client_id?: string; // GA4 client_id from cookie
}

function sha256(input: string): string {
    return crypto.createHash('sha256').update(input.toLowerCase().trim()).digest('hex');
}

function uuid(): string {
    return crypto.randomUUID();
}

function ga4Name(eventName: EventName): string {
    switch (eventName) {
        case 'Lead': return 'generate_lead';
        case 'InitiateCheckout': return 'begin_checkout';
        case 'AddPaymentInfo': return 'add_payment_info';
        case 'Purchase': return 'purchase';
    }
}

// ─── Meta Conversions API ───────────────────────────────────────────────────

async function sendMetaCAPI(eventName: EventName, p: ServerEventPayload, sourceUrl: string): Promise<boolean> {
    const token = process.env.META_ADS_ACCESS_TOKEN;
    if (!token) {
        console.warn(`[analytics-server] META_ADS_ACCESS_TOKEN missing — skipping Meta CAPI ${eventName}`);
        return false;
    }

    const userData: Record<string, unknown> = {};
    if (p.email) userData.em = [sha256(p.email)];
    if (p.client_ip_address) userData.client_ip_address = p.client_ip_address;
    if (p.client_user_agent) userData.client_user_agent = p.client_user_agent;
    if (p.fbp) userData.fbp = p.fbp;
    if (p.fbc) userData.fbc = p.fbc;

    const customData: Record<string, unknown> = {};
    if (p.value !== undefined) customData.value = p.value;
    if (p.currency) customData.currency = p.currency;
    if (p.content_ids?.length) {
        customData.content_ids = p.content_ids;
        customData.content_type = 'product';
    }
    if (p.content_name) customData.content_name = p.content_name;
    if (p.coupon) customData.coupon = p.coupon;

    const body = {
        data: [{
            event_name: eventName,
            event_time: Math.floor(Date.now() / 1000),
            event_id: p.event_id,
            action_source: 'website',
            event_source_url: sourceUrl,
            user_data: userData,
            custom_data: customData,
        }],
    };

    try {
        const res = await fetch(
            `https://graph.facebook.com/v21.0/${META_PIXEL_ID}/events?access_token=${token}`,
            { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
        );
        if (!res.ok) {
            const text = await res.text();
            console.error(`[analytics-server] Meta CAPI ${eventName} failed:`, res.status, text);
            return false;
        }
        return true;
    } catch (err) {
        console.error(`[analytics-server] Meta CAPI ${eventName} error:`, err);
        return false;
    }
}

// ─── GA4 Measurement Protocol ───────────────────────────────────────────────

async function sendGA4MP(eventName: EventName, p: ServerEventPayload): Promise<boolean> {
    const apiSecret = process.env.GA4_API_SECRET;
    if (!apiSecret) {
        console.warn(`[analytics-server] GA4_API_SECRET missing — skipping GA4 ${eventName}`);
        return false;
    }

    // GA4 requires a client_id. If we don't have one from the cookie, we generate
    // one from the email (consistent across calls for the same user).
    const clientId = p.ga_client_id ||
        (p.email ? `email-${sha256(p.email).slice(0, 16)}` : `srv-${uuid()}`);

    const eventParams: Record<string, unknown> = {};
    if (p.value !== undefined) eventParams.value = p.value;
    if (p.currency) eventParams.currency = p.currency;
    if (p.coupon) eventParams.coupon = p.coupon;
    if (p.transaction_id) eventParams.transaction_id = p.transaction_id;
    if (p.event_id) eventParams.event_id = p.event_id;
    if (p.content_ids?.length) {
        eventParams.items = p.content_ids.map(id => ({
            item_id: id,
            item_name: p.content_name || id,
        }));
    }

    const body = {
        client_id: clientId,
        events: [{
            name: ga4Name(eventName),
            params: eventParams,
        }],
        // For purchases, attach user_id (hashed email) for cross-device attribution
        ...(p.email ? { user_id: sha256(p.email) } : {}),
    };

    try {
        const res = await fetch(
            `https://www.google-analytics.com/mp/collect?measurement_id=${GA4_MEASUREMENT_ID}&api_secret=${apiSecret}`,
            { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
        );
        if (!res.ok) {
            const text = await res.text();
            console.error(`[analytics-server] GA4 MP ${eventName} failed:`, res.status, text);
            return false;
        }
        return true;
    } catch (err) {
        console.error(`[analytics-server] GA4 MP ${eventName} error:`, err);
        return false;
    }
}

// ─── Firestore log ──────────────────────────────────────────────────────────

async function logToFirestore(eventName: EventName, p: ServerEventPayload, sourceUrl: string, status: { meta: boolean; ga4: boolean }) {
    try {
        await getAdminDb().collection('events').add({
            event_name: eventName,
            event_id: p.event_id || null,
            value: p.value ?? null,
            currency: p.currency ?? null,
            content_ids: p.content_ids ?? [],
            content_name: p.content_name ?? null,
            email: p.email ?? null,
            coupon: p.coupon ?? null,
            lang: p.lang ?? null,
            transaction_id: p.transaction_id ?? null,
            source_url: sourceUrl,
            sent_to_meta: status.meta,
            sent_to_ga4: status.ga4,
            timestamp: new Date().toISOString(),
        });
    } catch (err) {
        console.error('[analytics-server] Firestore log failed:', err);
    }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Fire a server-side event to Meta CAPI + GA4 Measurement Protocol + Firestore log.
 * `payload.event_id` should match the client-side `event_id` so platforms dedupe.
 * Always non-blocking — never throws.
 */
export async function trackServer(
    eventName: EventName,
    payload: ServerEventPayload,
    sourceUrl: string = 'https://storyhunt.city',
): Promise<{ event_id: string; meta: boolean; ga4: boolean }> {
    const eventId = payload.event_id || uuid();
    const enriched = { ...payload, event_id: eventId };

    const [metaOk, ga4Ok] = await Promise.all([
        sendMetaCAPI(eventName, enriched, sourceUrl).catch(() => false),
        sendGA4MP(eventName, enriched).catch(() => false),
    ]);

    // Log to Firestore (don't block on this)
    logToFirestore(eventName, enriched, sourceUrl, { meta: metaOk, ga4: ga4Ok }).catch(() => { /* logged inside */ });

    return { event_id: eventId, meta: metaOk, ga4: ga4Ok };
}
