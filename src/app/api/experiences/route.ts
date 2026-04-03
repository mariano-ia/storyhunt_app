import { NextRequest, NextResponse } from 'next/server';
import { getExperiences, createExperience } from '@/lib/firestore';
import { verifyAuth } from '@/lib/firebase-admin';
import type { ExperienceFormData, Experience } from '@/lib/types';

// Fields safe to return (strip sensitive data)
function sanitizeExperience(exp: Experience) {
    const { llm_api_key, narrator_personality, ...safe } = exp;
    return safe;
}

export async function GET(req: NextRequest) {
    const user = await verifyAuth(req);
    try {
        const data = await getExperiences();
        // Authenticated users get full data, anonymous get sanitized
        return NextResponse.json(user ? data : data.map(sanitizeExperience));
    } catch {
        return NextResponse.json({ error: 'Error al obtener experiencias' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const user = await verifyAuth(req);
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    try {
        const body = await req.json() as ExperienceFormData;
        const id = await createExperience(body);
        return NextResponse.json({ id }, { status: 201 });
    } catch {
        return NextResponse.json({ error: 'Error al crear experiencia' }, { status: 500 });
    }
}
