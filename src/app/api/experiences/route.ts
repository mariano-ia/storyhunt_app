import { NextRequest, NextResponse } from 'next/server';
import { getExperiences, createExperience } from '@/lib/firestore';
import type { ExperienceFormData } from '@/lib/types';

export async function GET() {
    try {
        const data = await getExperiences();
        return NextResponse.json(data);
    } catch (err) {
        return NextResponse.json({ error: 'Error al obtener experiencias' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json() as ExperienceFormData;
        const id = await createExperience(body);
        return NextResponse.json({ id }, { status: 201 });
    } catch (err) {
        return NextResponse.json({ error: 'Error al crear experiencia' }, { status: 500 });
    }
}
