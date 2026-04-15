import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

// ─── GET /api/debug/reconcile ────────────────────────────────────────────────
// Diagnostic endpoint: reports counts of contacts, sales, access_tokens,
// user_sessions from the last N days, and lists sales without a matching
// user_session (plays that happened but weren't recorded due to past bugs).
//
// Protected by ?secret=CRON_SECRET since it reads PII. Remove when no longer needed.

export async function GET(req: NextRequest) {
    const secret = req.nextUrl.searchParams.get('secret');
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const days = Number(req.nextUrl.searchParams.get('days') || '14');
    const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const db = getAdminDb();

    try {
        const [contactsSnap, salesSnap, tokensSnap, sessionsSnap] = await Promise.all([
            db.collection('contacts').where('created_at', '>=', sinceIso).get(),
            db.collection('sales').where('created_at', '>=', sinceIso).get(),
            db.collection('access_tokens').where('created_at', '>=', sinceIso).get(),
            db.collection('user_sessions').where('started_at', '>=', sinceIso).get(),
        ]);

        const sales = salesSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        const sessions = sessionsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        const tokens = tokensSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

        // Sales without a session from the same email
        const sessionEmails = new Set(sessions.map(s => (s.email || '').toLowerCase()).filter(Boolean));
        const salesWithoutSession = sales
            .filter(s => {
                const email = (s.email || '').toLowerCase();
                return email && !sessionEmails.has(email);
            })
            .map(s => ({
                id: s.id,
                email: s.email,
                experience_name: s.experience_name,
                amount: s.amount,
                coupon_code: s.coupon_code,
                created_at: s.created_at,
            }));

        // Access tokens never used (times_used === 0)
        const unusedTokens = tokens
            .filter(t => !t.times_used || t.times_used === 0)
            .map(t => ({
                id: t.id,
                token: t.token,
                email: t.email,
                experience_id: t.experience_id,
                lang: t.lang,
                created_at: t.created_at,
            }));

        return NextResponse.json({
            window_days: days,
            since: sinceIso,
            counts: {
                contacts: contactsSnap.size,
                sales: salesSnap.size,
                access_tokens: tokensSnap.size,
                user_sessions: sessionsSnap.size,
            },
            sales_without_matching_session: {
                count: salesWithoutSession.length,
                items: salesWithoutSession,
            },
            unused_access_tokens: {
                count: unusedTokens.length,
                items: unusedTokens,
            },
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error running reconciliation';
        console.error('[debug/reconcile]', err);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
