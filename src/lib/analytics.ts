// ─── Client-side analytics wrapper ──────────────────────────────────────────
//
// Single entry point that fires Meta Pixel + GA4 with the same payload.
// Generates an `event_id` per call so server-side counterparts can dedup.
// Stores last 50 events in localStorage for quick inspection in DevTools:
//   JSON.parse(localStorage.eventLog)

type EventName =
    | 'PageView'
    | 'ViewContent'
    | 'Lead'
    | 'InitiateCheckout'
    | 'AddPaymentInfo'
    | 'Purchase';

export interface EventPayload {
    value?: number;
    currency?: string;
    content_ids?: string[];
    content_name?: string;
    content_type?: string;
    num_items?: number;
    email?: string;
    coupon?: string;
    lang?: string;
    [key: string]: unknown;
}

interface FbqGlobal {
    (command: 'track' | 'trackCustom', name: string, data?: object, options?: { eventID?: string }): void;
    callMethod?: unknown;
    queue?: unknown[];
}

interface GtagGlobal {
    (command: 'event' | 'config' | 'js', target: string, params?: object): void;
}

declare global {
    interface Window {
        fbq?: FbqGlobal;
        gtag?: GtagGlobal;
        dataLayer?: unknown[];
    }
}

const LOG_KEY = 'eventLog';
const LOG_MAX = 50;

function uuid(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
}

function logToLocalStorage(eventName: string, payload: EventPayload, eventId: string) {
    if (typeof window === 'undefined') return;
    try {
        const raw = window.localStorage.getItem(LOG_KEY);
        const log: unknown[] = raw ? JSON.parse(raw) : [];
        log.unshift({ ts: new Date().toISOString(), eventName, eventId, payload });
        window.localStorage.setItem(LOG_KEY, JSON.stringify(log.slice(0, LOG_MAX)));
    } catch { /* localStorage unavailable */ }
}

// Maps standard event names to GA4 recommended event names.
// GA4 prefers snake_case + standard event names for built-in reports.
function ga4Name(eventName: EventName): string {
    switch (eventName) {
        case 'PageView': return 'page_view';
        case 'ViewContent': return 'view_item';
        case 'Lead': return 'generate_lead';
        case 'InitiateCheckout': return 'begin_checkout';
        case 'AddPaymentInfo': return 'add_payment_info';
        case 'Purchase': return 'purchase';
    }
}

// GA4 expects items array for commerce events
function ga4Payload(eventName: EventName, p: EventPayload): Record<string, unknown> {
    const base: Record<string, unknown> = {};
    if (p.value !== undefined) base.value = p.value;
    if (p.currency) base.currency = p.currency;
    if (p.coupon) base.coupon = p.coupon;
    if (p.content_ids?.length) {
        base.items = p.content_ids.map(id => ({
            item_id: id,
            item_name: p.content_name || id,
        }));
    }
    if (eventName === 'Purchase') {
        base.transaction_id = p.transaction_id || undefined;
    }
    if (p.lang) base.lang = p.lang;
    return base;
}

/**
 * Fire an event to Meta Pixel + GA4 simultaneously, with the same `event_id`.
 * Server-side counterparts (CAPI / Measurement Protocol) should reuse the
 * `event_id` returned here for dedup.
 */
export function track(eventName: EventName, payload: EventPayload = {}): string {
    const eventId = uuid();

    if (typeof window === 'undefined') return eventId;

    // Meta Pixel
    try {
        if (window.fbq) {
            const fbPayload: Record<string, unknown> = { ...payload };
            // Meta uses `contents` array for commerce; map content_ids if present
            if (payload.content_ids?.length) {
                fbPayload.contents = payload.content_ids.map(id => ({ id, quantity: 1 }));
                fbPayload.content_type = payload.content_type || 'product';
            }
            window.fbq('track', eventName, fbPayload, { eventID: eventId });
        }
    } catch (err) {
        console.warn('[analytics] fbq error', err);
    }

    // GA4
    try {
        if (window.gtag) {
            window.gtag('event', ga4Name(eventName), {
                ...ga4Payload(eventName, payload),
                event_id: eventId, // surfaced as custom dim if defined in GA4
            });
        }
    } catch (err) {
        console.warn('[analytics] gtag error', err);
    }

    logToLocalStorage(eventName, payload, eventId);
    return eventId;
}

// Convenience wrappers — keeps callsites readable
export const trackViewContent = (experienceIds: string[], extra?: EventPayload) =>
    track('ViewContent', { content_ids: experienceIds, content_type: 'product', ...extra });

export const trackLead = (extra?: EventPayload) =>
    track('Lead', extra);

export const trackInitiateCheckout = (experienceId: string, value: number, lang: string, extra?: EventPayload) =>
    track('InitiateCheckout', { content_ids: [experienceId], value, currency: 'USD', lang, ...extra });

export const trackAddPaymentInfo = (experienceId: string, value: number, extra?: EventPayload) =>
    track('AddPaymentInfo', { content_ids: [experienceId], value, currency: 'USD', ...extra });

export const trackPurchase = (experienceId: string, value: number, transactionId: string, extra?: EventPayload) =>
    track('Purchase', { content_ids: [experienceId], value, currency: 'USD', transaction_id: transactionId, ...extra });
