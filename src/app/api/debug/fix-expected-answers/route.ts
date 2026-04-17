import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

// POST /api/debug/fix-expected-answers?secret=X
// One-shot: updates restrictive expected_answer values to be more lenient.
// Supports dry_run=1.

const FIXES: { expId: string; stepId: string; label: string; newExpectedAnswer: string }[] = [];

// These will be populated after reading the step IDs

export async function POST(req: NextRequest) {
    const secret = req.nextUrl.searchParams.get('secret');
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const dryRun = req.nextUrl.searchParams.get('dry_run') === '1';
    const db = getAdminDb();

    // Brooklyn Bridge: 4qtIlakWYLhoCJzzMWQT
    // Midtown Protocol: 4QUIaf13dnrqVJ3qzw1y
    const experiences = [
        { id: '4qtIlakWYLhoCJzzMWQT', name: 'Brooklyn Bridge' },
        { id: '4QUIaf13dnrqVJ3qzw1y', name: 'Midtown Protocol' },
    ];

    const log: { step: string; old: string; new: string; ok: boolean }[] = [];

    for (const exp of experiences) {
        const scenesSnap = await db.collection('experiences').doc(exp.id).collection('scenes').orderBy('order').get();
        const stepsSnap = await db.collection('experiences').doc(exp.id).collection('steps').orderBy('order').get();

        const scenes = scenesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
        const allSteps = stepsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

        // Build ordered list
        const ordered: any[] = [];
        for (const scene of scenes) {
            const sceneSteps = allSteps.filter(s => s.scene_id === scene.id).sort((a, b) => a.order - b.order);
            for (const step of sceneSteps) {
                ordered.push({ ...step, scene_name: scene.name, global_index: ordered.length });
            }
        }

        // Define fixes by global index
        const fixes: Record<number, string> = exp.id === '4qtIlakWYLhoCJzzMWQT' ? {
            // Brooklyn Bridge fixes
            2: 'El usuario debe decir un número. La respuesta correcta es 2, pero si dice cualquier número o respuesta aproximada, aceptarlo y continuar. No es importante que acierte exactamente.',
            7: 'El usuario observa los cuernos del toro. Cualquier observación es válida. Si menciona que son iguales o diferentes, aceptar. Si dice cualquier otra cosa sobre el toro, también aceptar y avanzar.',
            16: 'El usuario describe lo que las águilas tienen entre las garras. La respuesta es un globo/hemisferio/mundo, pero cualquier descripción del elemento es aceptable. Si dice algo relacionado como "una bola", "una esfera", "algo redondo", aceptar.',
            21: 'El usuario lee lo que dice arriba del nombre en la lápida. La palabra es "General", pero si dice cualquier otra palabra que haya leído de la lápida, aceptar y aclarar que dice General. Lo importante es que miró la lápida.',
            28: 'El usuario describe la posición de la mano de la estatua de Washington. La mano está extendida en gesto de juramento, pero cualquier descripción de la mano o del brazo es válida. Si dice "levantada", "extendida", "hacia arriba", "como jurando", todo es correcto.',
        } : {
            // Midtown Protocol fixes
            52: 'Que el usuario diga cuántas gárgolas ve. No importa el número exacto. Cualquier número es válido, aceptar y avanzar al siguiente paso.',
            68: 'El usuario debe elegir entre los dos leones. Se llaman Patience y Fortitude, pero el usuario puede decir "el de la izquierda", "el de la derecha", "el primero", o cualquier forma de elegir uno. Aceptar cualquier elección.',
            94: 'Cualquier reflexión del usuario es válida. No hay respuesta incorrecta. Aceptar y avanzar.',
        };

        for (const [globalIdx, newAnswer] of Object.entries(fixes)) {
            const idx = Number(globalIdx);
            const step = ordered[idx];
            if (!step) continue;

            const label = `${exp.name} [${idx}] "${step.message_to_send?.slice(0, 50)}..."`;
            const oldAnswer = step.expected_answer || '';

            if (!dryRun) {
                try {
                    await db.collection('experiences').doc(exp.id).collection('steps').doc(step.id).update({
                        expected_answer: newAnswer,
                    });
                    log.push({ step: label, old: oldAnswer.slice(0, 80), new: newAnswer.slice(0, 80), ok: true });
                } catch (err: any) {
                    log.push({ step: label, old: oldAnswer.slice(0, 80), new: newAnswer.slice(0, 80), ok: false });
                }
            } else {
                log.push({ step: label, old: oldAnswer.slice(0, 80), new: newAnswer.slice(0, 80), ok: true });
            }
        }
    }

    return NextResponse.json({ ok: true, dry_run: dryRun, fixes: log.length, log });
}
