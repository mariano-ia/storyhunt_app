import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
    const secret = req.nextUrl.searchParams.get('secret');
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    try {
        const db = getAdminDb();
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        const allSnap = await db.collection('contacts').count().get();
        const totalAll = allSnap.data().count;

        const recentSnap = await db.collection('contacts')
            .where('created_at', '>=', sevenDaysAgo)
            .get();

        const recent = recentSnap.docs.map(d => {
            const x = d.data();
            return {
                email: x.email,
                source: x.source,
                created_at: x.created_at,
                lang: x.lang,
            };
        }).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

        const bySource: Record<string, number> = {};
        for (const r of recent) {
            bySource[r.source || 'unknown'] = (bySource[r.source || 'unknown'] || 0) + 1;
        }

        return NextResponse.json({
            ok: true,
            admin_sdk_working: true,
            total_contacts_ever: totalAll,
            contacts_last_7_days: recent.length,
            by_source_last_7_days: bySource,
            most_recent_5: recent.slice(0, 5),
            all_recent: recent,
        });
    } catch (err: unknown) {
        return NextResponse.json({
            ok: false,
            admin_sdk_working: false,
            error: err instanceof Error ? err.message : String(err),
        }, { status: 500 });
    }
}
