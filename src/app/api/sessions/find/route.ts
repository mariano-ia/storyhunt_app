import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

// ─── POST /api/sessions/find ─────────────────────────────────────────────────
// Finds an existing in_progress session for a given experience + email.
// Used by the token landing page to detect resumable sessions.

export async function POST(req: NextRequest) {
    try {
        const { experience_id, email, access_token } = await req.json() as {
            experience_id?: string;
            email?: string;
            access_token?: string;
        };
        if (!experience_id) {
            return NextResponse.json({ error: 'experience_id required' }, { status: 400 });
        }
        if (!email && !access_token) {
            return NextResponse.json({ error: 'email or access_token required' }, { status: 400 });
        }

        const db = getAdminDb();

        // Three equality filters — no orderBy, so we don't need a composite index.
        // We sort + take the latest client-side. With the new dedup logic in
        // /play/[id] there should be at most ~1 in_progress per (email, exp)
        // going forward; old duplicates from before the fix get filtered here.
        //
        // 2026-05-18: also accept access_token as a fallback when email is
        // missing (orphan sessions from the post-purchase race condition).
        let snap;
        if (email) {
            snap = await db
                .collection('user_sessions')
                .where('experience_id', '==', experience_id)
                .where('email', '==', email)
                .where('status', '==', 'in_progress')
                .get();
            // Fallback: if no email match found, try access_token.
            if (snap.empty && access_token) {
                snap = await db
                    .collection('user_sessions')
                    .where('experience_id', '==', experience_id)
                    .where('access_token', '==', access_token)
                    .where('status', '==', 'in_progress')
                    .get();
            }
        } else {
            snap = await db
                .collection('user_sessions')
                .where('experience_id', '==', experience_id)
                .where('access_token', '==', access_token!)
                .where('status', '==', 'in_progress')
                .get();
        }

        if (snap.empty) {
            return NextResponse.json({ session: null });
        }

        type SessionDoc = {
            id: string;
            data: Record<string, unknown>;
        };
        const candidates: SessionDoc[] = snap.docs
            .map(d => ({ id: d.id, data: d.data() }))
            .sort((a, b) => {
                const ax = typeof a.data.started_at === 'string' ? a.data.started_at : '';
                const bx = typeof b.data.started_at === 'string' ? b.data.started_at : '';
                return bx.localeCompare(ax); // ISO string sort = chronological
            });

        const top = candidates[0];
        return NextResponse.json({
            session: {
                id: top.id,
                current_step: top.data.current_step,
                total_steps: top.data.total_steps,
                started_at: top.data.started_at,
                in_nyc: top.data.in_nyc,
            },
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error finding session';
        console.error('[sessions/find]', err);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
