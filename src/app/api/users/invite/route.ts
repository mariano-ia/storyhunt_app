import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY!;
const now = () => new Date().toISOString();

// ─── POST /api/users/invite ──────────────────────────────────────────────────
// Invites a new admin. Migrated to Admin SDK 2026-05-18: the prior version
// used client SDK against `admins` which (a) couldn't authenticate server-side
// and (b) tripped the new closed-rule on admins. Admin SDK bypasses rules.
//
// Caller must be in the admins allowlist (enforced by verifyAuth).

export async function POST(req: NextRequest) {
    const user = await verifyAuth(req);
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    try {
        const { email } = await req.json() as { email: string };

        if (!email || !email.includes('@')) {
            return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
        }
        const normalized = email.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
            return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
        }

        const db = getAdminDb();
        const existing = await db
            .collection('admins')
            .where('email', '==', normalized)
            .limit(1)
            .get();
        if (!existing.empty) {
            return NextResponse.json({ error: 'Este email ya fue invitado.' }, { status: 409 });
        }

        const tempPassword = crypto.randomUUID().replace(/-/g, '').slice(0, 20) + 'Aa1!';
        const createRes = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: normalized, password: tempPassword, returnSecureToken: false }),
            }
        );

        if (!createRes.ok) {
            const err = await createRes.json();
            const msg: string = err?.error?.message ?? 'ERROR';
            if (!msg.includes('EMAIL_EXISTS')) {
                return NextResponse.json({ error: `Error al crear usuario: ${msg}` }, { status: 400 });
            }
        }

        await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${FIREBASE_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requestType: 'PASSWORD_RESET', email: normalized }),
            }
        );

        await db.collection('admins').add({
            email: normalized,
            invited_at: now(),
            invited_by: user.email,
            status: 'invited',
        });

        return NextResponse.json({ success: true });

    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error al invitar';
        console.error('[invite]', err);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    const user = await verifyAuth(req);
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    try {
        const snap = await getAdminDb().collection('admins').get();
        const admins = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        return NextResponse.json({ admins });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// Suppress unused import warning for FieldValue (kept for potential future use).
void FieldValue;
