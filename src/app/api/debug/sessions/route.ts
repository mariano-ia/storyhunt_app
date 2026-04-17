import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

// ─── GET /api/debug/sessions ─────────────────────────────────────────────────
// Returns recent user_sessions with cross-referenced email from access_tokens.

export async function GET(req: NextRequest) {
    const secret = req.nextUrl.searchParams.get('secret');
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const days = Number(req.nextUrl.searchParams.get('days') || '7');
    const db = getAdminDb();
    const since = new Date(Date.now() - days * 86400000).toISOString();

    const [sessionsSnap, tokensSnap] = await Promise.all([
        db.collection('user_sessions').where('started_at', '>=', since).orderBy('started_at', 'desc').get(),
        db.collection('access_tokens').where('created_at', '>=', new Date(Date.now() - 30 * 86400000).toISOString()).get(),
    ]);

    const tokensByExpId: Record<string, any[]> = {};
    for (const d of tokensSnap.docs) {
        const t = d.data();
        const key = t.experience_id;
        if (!tokensByExpId[key]) tokensByExpId[key] = [];
        tokensByExpId[key].push({ email: t.email, token: t.token, lang: t.lang, created_at: t.created_at, times_used: t.times_used });
    }

    const sessions = sessionsSnap.docs.map(d => {
        const s = d.data();
        const candidates = (tokensByExpId[s.experience_id] || [])
            .filter((t: any) => t.times_used > 0)
            .sort((a: any, b: any) => Math.abs(new Date(a.created_at).getTime() - new Date(s.started_at).getTime()) - Math.abs(new Date(b.created_at).getTime() - new Date(s.started_at).getTime()));
        const match = candidates[0];
        return {
            id: d.id,
            experience_id: s.experience_id,
            started_at: s.started_at,
            status: s.status,
            current_step: s.current_step,
            total_steps: s.total_steps,
            lang: s.lang,
            completed_at: s.completed_at,
            rating: s.rating,
            probable_email: match?.email || s.email || '(unknown)',
            matched_token: match?.token,
        };
    });

    return NextResponse.json({ count: sessions.length, sessions });
}
