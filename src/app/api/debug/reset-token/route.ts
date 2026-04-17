import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

// GET /api/debug/reset-token?secret=CRON_SECRET&email=<email>
// Resets the most recent access token for the given email:
//   times_used=0, status=active, max_uses=20

export async function GET(req: NextRequest) {
    const secret = req.nextUrl.searchParams.get('secret');
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const email = req.nextUrl.searchParams.get('email');
    if (!email) {
        return NextResponse.json({ error: 'email required' }, { status: 400 });
    }

    const db = getAdminDb();
    const snap = await db.collection('access_tokens')
        .where('email', '==', email)
        .orderBy('created_at', 'desc')
        .limit(1)
        .get();

    if (snap.empty) {
        return NextResponse.json({ error: 'no tokens found for email' }, { status: 404 });
    }

    const doc = snap.docs[0];
    const before = doc.data();

    await doc.ref.update({
        times_used: 0,
        status: 'active',
        max_uses: 20,
    });

    return NextResponse.json({
        ok: true,
        token: before.token,
        before: {
            times_used: before.times_used,
            status: before.status,
            max_uses: before.max_uses,
        },
        after: { times_used: 0, status: 'active', max_uses: 20 },
    });
}
