import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import type { AccessToken } from '@/lib/types';

// ─── POST /api/access/use ────────────────────────────────────────────────────
// Increments times_used on an access token (called when the player is entered).
// Uses Admin SDK so it works regardless of client Firestore rules.

export async function POST(req: NextRequest) {
    try {
        const { id } = await req.json() as { id?: string };
        if (!id) {
            return NextResponse.json({ error: 'id required' }, { status: 400 });
        }

        const db = getAdminDb();
        const ref = db.collection('access_tokens').doc(id);
        const snap = await ref.get();
        if (!snap.exists) {
            return NextResponse.json({ error: 'Token not found' }, { status: 404 });
        }

        const data = snap.data() as AccessToken;
        const newTimesUsed = (data.times_used ?? 0) + 1;
        const updates: Record<string, unknown> = {
            times_used: newTimesUsed,
            used_at: new Date().toISOString(),
        };
        if (newTimesUsed >= (data.max_uses ?? 2)) {
            updates.status = 'used';
        }
        await ref.update(updates);

        return NextResponse.json({ ok: true });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error using access token';
        console.error('[access/use]', err);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
