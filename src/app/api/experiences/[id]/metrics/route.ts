import { NextRequest, NextResponse } from 'next/server';
import { getMetrics } from '@/lib/firestore';

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const metrics = await getMetrics(id);
        return NextResponse.json(metrics);
    } catch {
        return NextResponse.json({ error: 'Error al obtener métricas' }, { status: 500 });
    }
}
