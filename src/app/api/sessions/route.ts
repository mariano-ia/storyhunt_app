import { NextRequest, NextResponse } from 'next/server';
import { getSessions } from '@/lib/firestore';
import { verifyAuth } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
    const user = await verifyAuth(req);
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    try {
        const { searchParams } = new URL(req.url);
        const experienceId = searchParams.get('experienceId') ?? undefined;
        const sessions = await getSessions(experienceId);
        return NextResponse.json(sessions);
    } catch {
        return NextResponse.json({ error: 'Error al obtener sesiones' }, { status: 500 });
    }
}
