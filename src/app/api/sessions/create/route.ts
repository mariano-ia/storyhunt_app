import { NextRequest, NextResponse } from 'next/server';
import { adminCreateSession } from '@/lib/firebase-admin';

// ─── POST /api/sessions/create ────────────────────────────────────────────────
// Creates a user_sessions row for a player session (called from /play/[id] on load).
// Uses Admin SDK so it works regardless of client Firestore rules.

export async function POST(req: NextRequest) {
    try {
        const { experience_id, email, lang, total_steps, access_token } = await req.json() as {
            experience_id?: string;
            email?: string;
            lang?: 'es' | 'en';
            total_steps?: number;
            access_token?: string;
        };
        if (!experience_id || typeof total_steps !== 'number') {
            return NextResponse.json({ error: 'experience_id and total_steps required' }, { status: 400 });
        }
        // Log when we get an access_token but no email — this is the orphan-session
        // pattern from 2026-05-12 where the post-purchase flow somehow lost the email.
        if (access_token && !email) {
            console.warn(`[sessions/create] Email missing but access_token present (${access_token}) for exp ${experience_id} — orphan-session pattern, will rely on token for identity recovery`);
        }
        const id = await adminCreateSession({ experience_id, email, lang, total_steps, access_token });
        return NextResponse.json({ id });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error creating session';
        console.error('[sessions/create]', err);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
