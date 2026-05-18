import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { AccessToken } from '@/lib/types';

// ─── POST /api/access/use ────────────────────────────────────────────────────
// Increments times_used on an access token (called when the player is entered).
// If the user already has an in_progress session for this experience, skips the
// increment so that resuming doesn't consume an extra use.
// Uses Admin SDK so it works regardless of client Firestore rules.

export async function POST(req: NextRequest) {
    try {
        const { id, experience_id } = await req.json() as { id?: string; experience_id?: string };
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
        const currentUses = data.times_used ?? 0;
        const isFirstUse = currentUses === 0;

        // On the first use we always increment — even if a session row exists. The
        // session may have been created seconds ago by /play/[id]'s session-create
        // call, and a strict "skip if in_progress" check would race against that
        // write and leave the token at times_used=0 forever.
        if (!isFirstUse && experience_id && data.email) {
            const sessionSnap = await db
                .collection('user_sessions')
                .where('experience_id', '==', experience_id)
                .where('email', '==', data.email)
                .where('status', '==', 'in_progress')
                .limit(1)
                .get();

            if (!sessionSnap.empty) {
                console.log(`[access/use] Resuming session for ${data.email} — skipping increment`);
                return NextResponse.json({ ok: true, resumed: true });
            }
        }

        // Atomic increment + side-effect updates. Read-back to determine if we
        // crossed the max_uses threshold (race-safe vs concurrent calls).
        const nowIso = new Date().toISOString();
        const updates: Record<string, unknown> = {
            times_used: FieldValue.increment(1),
            used_at: nowIso,
        };
        if (isFirstUse) updates.first_used_at = nowIso;
        await ref.update(updates);

        // Re-read to enforce max_uses guard correctly.
        const fresh = await ref.get();
        const newTimesUsed = (fresh.data()?.times_used as number) || 0;
        const maxUses = (fresh.data()?.max_uses as number) ?? 20;
        if (newTimesUsed >= maxUses) {
            await ref.update({ status: 'used' });
        }

        return NextResponse.json({ ok: true, first_use: isFirstUse });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error using access token';
        console.error('[access/use]', err);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
