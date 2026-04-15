import { NextRequest, NextResponse } from 'next/server';
import { adminUpdateSession } from '@/lib/firebase-admin';

// ─── POST /api/sessions/update ────────────────────────────────────────────────
// Updates a user_sessions row — called from /play/[id] on step advance / completion / abandon.
// Uses Admin SDK so it works regardless of client Firestore rules.

export async function POST(req: NextRequest) {
    try {
        const { id, ...updates } = await req.json() as { id?: string } & Record<string, unknown>;
        if (!id) {
            return NextResponse.json({ error: 'id required' }, { status: 400 });
        }
        await adminUpdateSession(id, updates);
        return NextResponse.json({ ok: true });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error updating session';
        console.error('[sessions/update]', err);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
