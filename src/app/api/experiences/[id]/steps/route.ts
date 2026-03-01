import { NextRequest, NextResponse } from 'next/server';
import { getSteps, createStep } from '@/lib/firestore';
import type { StepFormData } from '@/lib/types';

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const steps = await getSteps(id);
        return NextResponse.json(steps);
    } catch {
        return NextResponse.json({ error: 'Error al obtener pasos' }, { status: 500 });
    }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json() as StepFormData;
        const stepId = await createStep(id, body);
        return NextResponse.json({ id: stepId }, { status: 201 });
    } catch {
        return NextResponse.json({ error: 'Error al crear paso' }, { status: 500 });
    }
}
