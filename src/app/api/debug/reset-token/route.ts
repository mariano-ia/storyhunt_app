import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

// GET /api/debug/reset-token?secret=CRON_SECRET&email=<email>
// Resets the most recent access token for the given email:
//   times_used=0, status=active, max_uses=20

export async function GET(req: NextRequest) {
    try {
        const secret = req.nextUrl.searchParams.get('secret');
        if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
            return NextResponse.json({ error: 'forbidden' }, { status: 403 });
        }

        const email = req.nextUrl.searchParams.get('email');
        if (!email) {
            return NextResponse.json({ error: 'email required' }, { status: 400 });
        }

        const db = getAdminDb();
        // No orderBy (avoids requiring a composite index) — sort in memory
        const snap = await db.collection('access_tokens')
            .where('email', '==', email)
            .get();

        if (snap.empty) {
            return NextResponse.json({ error: 'no tokens found for email' }, { status: 404 });
        }

        const docs = snap.docs
            .map(d => ({ id: d.id, ref: d.ref, data: d.data() as Record<string, unknown> }))
            .sort((a, b) => {
                const aTime = String(a.data.created_at || '');
                const bTime = String(b.data.created_at || '');
                return bTime.localeCompare(aTime);
            });

        const target = docs[0];

        await target.ref.update({
            times_used: 0,
            status: 'active',
            max_uses: 20,
        });

        return NextResponse.json({
            ok: true,
            token: target.data.token,
            before: {
                times_used: target.data.times_used,
                status: target.data.status,
                max_uses: target.data.max_uses,
            },
            after: { times_used: 0, status: 'active', max_uses: 20 },
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'unknown error';
        const stack = err instanceof Error ? err.stack : undefined;
        console.error('[debug/reset-token]', err);
        return NextResponse.json({ error: message, stack }, { status: 500 });
    }
}
