import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

// ─── GET /api/dashboard/funnel ────────────────────────────────────────────
// Returns aggregated funnel data from Firestore `events` + `sales` collections.
// Query: ?days=7|30|0 (0 = all-time)

type EventDoc = {
    event_name: string;
    timestamp: string;
    email?: string | null;
    value?: number | null;
    sent_to_meta?: boolean;
    sent_to_ga4?: boolean;
    sent_to_posthog?: boolean;
};

type SaleDoc = {
    amount: number;
    created_at: string;
};

const FUNNEL_STEPS = ['Lead', 'InitiateCheckout', 'AddPaymentInfo', 'Purchase'] as const;

export async function GET(req: NextRequest) {
    try {
        const days = parseInt(req.nextUrl.searchParams.get('days') || '7', 10);
        const cutoff = days > 0
            ? new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
            : '1970-01-01T00:00:00.000Z';

        const db = getAdminDb();

        // Pull events in window
        const eventsSnap = await db.collection('events')
            .where('timestamp', '>=', cutoff)
            .orderBy('timestamp', 'desc')
            .limit(500)
            .get();
        const events = eventsSnap.docs.map(d => d.data() as EventDoc);

        // Pull sales in window (revenue truth)
        const salesSnap = await db.collection('sales')
            .where('created_at', '>=', cutoff)
            .orderBy('created_at', 'desc')
            .get();
        const sales = salesSnap.docs.map(d => d.data() as SaleDoc);

        // Count signups (contacts) in window
        const contactsSnap = await db.collection('contacts')
            .where('created_at', '>=', cutoff)
            .count()
            .get();
        const totalSignups = contactsSnap.data().count;

        // Funnel counts (Lead, InitiateCheckout, AddPaymentInfo, Purchase)
        const funnel: Record<string, number> = {};
        for (const step of FUNNEL_STEPS) funnel[step] = 0;
        for (const e of events) {
            if (e.event_name in funnel) funnel[e.event_name]++;
        }

        // Revenue (cents → dollars)
        const totalRevenueCents = sales.reduce((sum, s) => sum + (s.amount || 0), 0);
        const totalSales = sales.length;

        // Conversion rate: signups → sales
        const conversionRate = totalSignups > 0 ? totalSales / totalSignups : 0;

        // Most recent 50 events for the events table
        const recentEvents = events.slice(0, 50).map(e => ({
            timestamp: e.timestamp,
            event_name: e.event_name,
            email: e.email ? e.email.replace(/(.{2}).*(@.*)/, '$1***$2') : null,
            value: e.value,
            sent_to_meta: !!e.sent_to_meta,
            sent_to_ga4: !!e.sent_to_ga4,
            sent_to_posthog: !!e.sent_to_posthog,
        }));

        // Drop-off rates between funnel steps
        const dropoffs: Record<string, number | null> = {};
        for (let i = 0; i < FUNNEL_STEPS.length - 1; i++) {
            const cur = funnel[FUNNEL_STEPS[i]];
            const next = funnel[FUNNEL_STEPS[i + 1]];
            const key = `${FUNNEL_STEPS[i]}_to_${FUNNEL_STEPS[i + 1]}`;
            dropoffs[key] = cur > 0 ? next / cur : null;
        }

        return NextResponse.json({
            period: { days, cutoff },
            funnel,
            dropoffs,
            stats: {
                total_revenue: totalRevenueCents / 100,
                total_sales: totalSales,
                total_signups: totalSignups,
                total_events: events.length,
                conversion_rate: conversionRate,
            },
            recent_events: recentEvents,
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Funnel query failed';
        console.error('[dashboard/funnel]', err);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
