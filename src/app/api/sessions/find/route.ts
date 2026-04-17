import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

// ─── POST /api/sessions/find ─────────────────────────────────────────────────
// Finds an existing in_progress session for a given experience + email.
// Used by the token landing page to detect resumable sessions.

export async function POST(req: NextRequest) {
    try {
        const { experience_id, email } = await req.json() as {
            experience_id?: string;
            email?: string;
        };
        if (!experience_id || !email) {
            return NextResponse.json({ error: 'experience_id and email required' }, { status: 400 });
        }

        const db = getAdminDb();
        const snap = await db
            .collection('user_sessions')
            .where('experience_id', '==', experience_id)
            .where('email', '==', email)
            .where('status', '==', 'in_progress')
            .orderBy('started_at', 'desc')
            .limit(1)
            .get();

        if (snap.empty) {
            return NextResponse.json({ session: null });
        }

        const doc = snap.docs[0];
        const data = doc.data();
        return NextResponse.json({
            session: {
                id: doc.id,
                current_step: data.current_step,
                total_steps: data.total_steps,
                started_at: data.started_at,
            },
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error finding session';
        console.error('[sessions/find]', err);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
