import { NextRequest, NextResponse } from 'next/server';
import { addDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { verifyAuth } from '@/lib/firebase-admin';

const FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY!;
const now = () => new Date().toISOString();

export async function POST(req: NextRequest) {
    const user = await verifyAuth(req);
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    try {
        const { email } = await req.json() as { email: string };

        if (!email || !email.includes('@')) {
            return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
        }

        const existing = await getDocs(
            query(collection(db, 'admins'), where('email', '==', email.toLowerCase()))
        );
        if (!existing.empty) {
            return NextResponse.json({ error: 'Este email ya fue invitado.' }, { status: 409 });
        }

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
            if (!msg.includes('EMAIL_EXISTS')) {
                return NextResponse.json({ error: `Error al crear usuario: ${msg}` }, { status: 400 });
            }
        }

        await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${FIREBASE_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requestType: 'PASSWORD_RESET', email }),
            }
        );

        await addDoc(collection(db, 'admins'), {
            email: email.toLowerCase(),
            invited_at: now(),
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
        const snap = await getDocs(collection(db, 'admins'));
        const admins = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        return NextResponse.json({ admins });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
