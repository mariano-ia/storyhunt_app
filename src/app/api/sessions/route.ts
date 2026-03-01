import { NextRequest, NextResponse } from 'next/server';
import { getSessions } from '@/lib/firestore';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const experienceId = searchParams.get('experienceId') ?? undefined;
        const sessions = await getSessions(experienceId);
        return NextResponse.json(sessions);
    } catch {
        return NextResponse.json({ error: 'Error al obtener sesiones' }, { status: 500 });
    }
}
