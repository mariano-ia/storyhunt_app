import { NextRequest, NextResponse } from 'next/server';
import { getExperience, updateExperience, deleteExperience } from '@/lib/firestore';
import { verifyAuth } from '@/lib/firebase-admin';
import type { ExperienceFormData } from '@/lib/types';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await verifyAuth(req);
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    try {
        const { id } = await params;
        const data = await getExperience(id);
        if (!data) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });
        return NextResponse.json(data);
    } catch {
        return NextResponse.json({ error: 'Error al obtener experiencia' }, { status: 500 });
    }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await verifyAuth(req);
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    try {
        const { id } = await params;
        const body = await req.json() as Partial<ExperienceFormData>;
        await updateExperience(id, body);
        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await verifyAuth(req);
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    try {
        const { id } = await params;
        await deleteExperience(id);
        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 });
    }
}
