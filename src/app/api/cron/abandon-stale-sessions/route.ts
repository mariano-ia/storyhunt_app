import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// ─── GET /api/cron/abandon-stale-sessions ──────────────────────────────────
// Daily cron that flips user_sessions stuck in `in_progress` for >12h to
// `abandoned`. Otherwise completion-rate metrics are silently wrong because
// the funnel denominator grows forever (users close the tab before rating).
//
// Protected by CRON_SECRET via Authorization header (same as other crons).

const STALE_HOURS = 12;
const CRON_SECRET = process.env.CRON_SECRET || '';

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getAdminDb();
    const cutoff = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000).toISOString();
    const startedAt = new Date().toISOString();

    let scanned = 0;
    let abandoned = 0;
    const errors: string[] = [];

    try {
        // Sessions with started_at < cutoff AND status = in_progress.
        // No index needed if we filter status first (status is low-cardinality).
        const snap = await db.collection('user_sessions')
            .where('status', '==', 'in_progress')
            .where('started_at', '<', cutoff)
            .get();

        scanned = snap.size;
        for (const doc of snap.docs) {
            try {
                await doc.ref.update({
                    status: 'abandoned',
                    abandoned_at: new Date().toISOString(),
                    abandoned_reason: `stale > ${STALE_HOURS}h`,
                });
                abandoned++;
            } catch (err) {
                errors.push(`${doc.id}: ${err instanceof Error ? err.message : 'unknown'}`);
            }
        }

        // Log the cron run.
        await db.collection('cron_runs').add({
            cron: 'abandon-stale-sessions',
            started_at: startedAt,
            finished_at: new Date().toISOString(),
            scanned,
            abandoned,
            errors_count: errors.length,
            ok: true,
            timestamp: FieldValue.serverTimestamp(),
        });

        return NextResponse.json({ ok: true, scanned, abandoned, errors });
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'unknown';
        await db.collection('cron_runs').add({
            cron: 'abandon-stale-sessions',
            started_at: startedAt,
            finished_at: new Date().toISOString(),
            ok: false,
            error: msg,
            timestamp: FieldValue.serverTimestamp(),
        }).catch(() => { /* best-effort */ });
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}
