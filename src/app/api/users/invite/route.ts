import { NextRequest, NextResponse } from 'next/server';
import { addDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY!;
const now = () => new Date().toISOString();

// ─── POST /api/users/invite ────────────────────────────────────────────────────
// Creates a Firebase Auth user + sends password reset email as invitation
// Also saves the admin record to Firestore for listing purposes

export async function POST(req: NextRequest) {
    try {
        const { email } = await req.json() as { email: string };

        if (!email || !email.includes('@')) {
            return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
        }

        // ─── Check if already invited ─────────────────────────────────────────────
        const existing = await getDocs(
            query(collection(db, 'admins'), where('email', '==', email.toLowerCase()))
        );
        if (!existing.empty) {
            return NextResponse.json({ error: 'Este email ya fue invitado.' }, { status: 409 });
        }

        // ─── Create Firebase Auth user with random temp password ──────────────────
        const tempPassword = crypto.randomUUID().replace(/-/g, '').slice(0, 20) + 'Aa1!';
        const createRes = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password: tempPassword, returnSecureToken: false }),
            }
        );

        if (!createRes.ok) {
            const err = await createRes.json();
            const msg: string = err?.error?.message ?? 'ERROR';
            if (msg.includes('EMAIL_EXISTS')) {
                // User already exists in Auth but not in our DB — still send reset
            } else {
                return NextResponse.json({ error: `Error al crear usuario: ${msg}` }, { status: 400 });
            }
        }

        // ─── Send password reset email (acts as invitation) ───────────────────────
        const resetRes = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${FIREBASE_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requestType: 'PASSWORD_RESET', email }),
            }
        );

        if (!resetRes.ok) {
            const err = await resetRes.json();
            console.error('[invite] Failed to send reset email:', err);
            // Don't fail the invite — user was created, email can be resent
        }

        // ─── Save admin record to Firestore ───────────────────────────────────────
        await addDoc(collection(db, 'admins'), {
            email: email.toLowerCase(),
            invited_at: now(),
            status: 'invited', // 'invited' | 'active'
        });

        return NextResponse.json({ success: true });

    } catch (err: any) {
        console.error('[invite]', err);
        return NextResponse.json({ error: err.message ?? 'Error al invitar' }, { status: 500 });
    }
}

// ─── GET /api/users/invite ─────────────────────────────────────────────────────
// Lists all admin users from Firestore

export async function GET() {
    try {
        const snap = await getDocs(collection(db, 'admins'));
        const admins = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        return NextResponse.json({ admins });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
