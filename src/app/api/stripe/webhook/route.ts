import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { getAdminDb } from '@/lib/firebase-admin';
import type Stripe from 'stripe';
import { FieldValue } from 'firebase-admin/firestore';
import { provisionAccess, markAccessRefunded } from '@/lib/fulfillment';

// ─── Webhook event dedup ──────────────────────────────────────────────────────
// Stripe retries failed webhooks for up to 3 days. Without an idempotency
// check this would create duplicate tokens, sales, emails and double-increment
// coupons. Pattern: `stripe_events/{event.id}` via .create() — throws if it
// exists, which we treat as "already processed, exit cleanly".
async function isFirstTimeEvent(eventId: string): Promise<boolean> {
    try {
        await getAdminDb().collection('stripe_events').doc(eventId).create({
            received_at: FieldValue.serverTimestamp(),
        });
        return true;
    } catch (err) {
        void err;
        return false;
    }
}

// ─── POST /api/stripe/webhook ────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    const body = await req.text();
    const sig = req.headers.get('stripe-signature');

    if (!sig) {
        return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
    }

    let event: Stripe.Event;
    try {
        event = getStripe().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Webhook signature verification failed';
        console.error('[stripe/webhook] Signature error:', message);
        return NextResponse.json({ error: message }, { status: 400 });
    }

    // Idempotency gate: if Stripe retried this exact event, exit cleanly with 200.
    if (!(await isFirstTimeEvent(event.id))) {
        console.log(`[stripe/webhook] Duplicate event ${event.id} (${event.type}) — skip`);
        return NextResponse.json({ received: true, duplicate: true });
    }

    // ─── Refunds + disputes: revoke the associated access token ─────────────
    if (event.type === 'charge.refunded' || event.type === 'charge.dispute.created') {
        const charge = event.data.object as Stripe.Charge;
        const sessionId = (charge.metadata && charge.metadata.checkout_session) || null;
        try {
            let stripeSessionId: string | null = sessionId;
            if (!stripeSessionId && charge.payment_intent) {
                const piId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent.id;
                const sessions = await getStripe().checkout.sessions.list({ payment_intent: piId, limit: 1 });
                stripeSessionId = sessions.data[0]?.id || null;
            }
            if (stripeSessionId) {
                await markAccessRefunded({ stripe_session_id: stripeSessionId });
                console.log(`[stripe/webhook] Revoked tokens for session ${stripeSessionId} due to ${event.type}`);
            }
        } catch (err) {
            console.error('[stripe/webhook] Refund/dispute handling error:', err);
        }
        return NextResponse.json({ received: true });
    }

    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
        const session = event.data.object as Stripe.Checkout.Session;
        const metadata = session.metadata || {};

        const experienceId = metadata.experience_id;
        const lang = (metadata.lang || 'es') as 'es' | 'en';
        const experienceName = metadata.experience_name || '';
        const couponCode = metadata.coupon_code;

        // Resolve email from every known Stripe field. If still empty, look up
        // the Customer or PaymentIntent — handles edge cases where the buyer
        // finished checkout via Apple/Google Pay and email landed on a
        // different object than customer_details.
        let email = session.customer_details?.email || session.customer_email || '';
        if (!email && session.customer) {
            try {
                const stripe = getStripe();
                const customerId = typeof session.customer === 'string' ? session.customer : session.customer.id;
                const customer = await stripe.customers.retrieve(customerId);
                if (customer && !('deleted' in customer)) email = customer.email || '';
            } catch (err) {
                console.warn('[stripe/webhook] customer fetch failed:', err);
            }
        }
        if (!email && session.payment_intent) {
            try {
                const stripe = getStripe();
                const piId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent.id;
                const pi = await stripe.paymentIntents.retrieve(piId);
                email = pi.receipt_email || '';
            } catch (err) {
                console.warn('[stripe/webhook] payment_intent fetch failed:', err);
            }
        }
        if (!email) {
            console.error(`[stripe/webhook] 🚨 No email found for session ${session.id}. Token will be created but access email will NOT be sent. User can recover via /api/access/verify.`);
        }

        if (!experienceId) {
            console.error('[stripe/webhook] No experience_id in metadata');
            return NextResponse.json({ received: true, skipped: 'missing_experience_id' });
        }

        try {
            // Belt-and-suspenders: even though the stripe_events dedup catches
            // retries, also short-circuit if a sale row already exists for this
            // Stripe session — handles the case where a previous run created
            // the sale but the stripe_events.create() write was lost.
            const db = getAdminDb();
            const existing = await db.collection('sales').where('stripe_session_id', '==', session.id).limit(1).get();
            if (!existing.empty) {
                console.log(`[stripe/webhook] Sale already exists for session ${session.id} — skip`);
                return NextResponse.json({ received: true, duplicate: true });
            }

            await provisionAccess({
                email,
                experience_id: experienceId,
                experience_name: experienceName,
                lang,
                source: (metadata.source as 'direct') || 'direct',
                stripe_session_id: session.id,
                amount: session.amount_total ?? 0,
                currency: session.currency ?? 'usd',
                coupon_code: couponCode || null,
                discount_applied: session.total_details?.amount_discount ?? 0,
                utm_source: metadata.utm_source || null,
                utm_medium: metadata.utm_medium || null,
                utm_campaign: metadata.utm_campaign || null,
                referrer: metadata.referrer || null,
                client_ip: metadata.client_ip,
                client_ua: metadata.client_ua,
                fbp: metadata.fbp,
                fbc: metadata.fbc,
            });
        } catch (err) {
            // Always return 200 after the dedup gate has passed — if we 500, Stripe
            // will retry, and our dedup will skip future retries leaving a partial
            // write irrecoverable. Log loudly so monitoring picks it up.
            console.error('[stripe/webhook] 🚨 Error processing payment:', err);
            return NextResponse.json({ received: true, error: 'processing_failed' });
        }
    }

    if (event.type !== 'checkout.session.completed' && event.type !== 'checkout.session.async_payment_succeeded') {
        console.log(`[stripe/webhook] Unhandled event ${event.type}`);
    }

    return NextResponse.json({ received: true });
}
