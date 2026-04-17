import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

// GET /api/debug/step-at?secret=X&exp=EXPERIENCE_ID&index=78
// Returns the step at a given index (ordered by scene order + step order).

export async function GET(req: NextRequest) {
    const secret = req.nextUrl.searchParams.get('secret');
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const expId = req.nextUrl.searchParams.get('exp') || '';
    const index = Number(req.nextUrl.searchParams.get('index') || '0');
    if (!expId) return NextResponse.json({ error: 'exp required' }, { status: 400 });

    const db = getAdminDb();
    const [scenesSnap, stepsSnap] = await Promise.all([
        db.collection('experiences').doc(expId).collection('scenes').orderBy('order').get(),
        db.collection('experiences').doc(expId).collection('steps').orderBy('order').get(),
    ]);

    const scenes = scenesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
    const allSteps = stepsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

    // Build ordered list: scene by scene, steps within each scene
    const ordered: any[] = [];
    for (const scene of scenes) {
        const sceneSteps = allSteps.filter(s => s.scene_id === scene.id).sort((a, b) => a.order - b.order);
        for (const step of sceneSteps) {
            ordered.push({ ...step, scene_name: scene.name, global_index: ordered.length });
        }
    }

    const target = ordered[index];
    const context = ordered.slice(Math.max(0, index - 2), index + 3);

    return NextResponse.json({
        total_steps: ordered.length,
        requested_index: index,
        step: target ? {
            global_index: index,
            scene_name: target.scene_name,
            step_type: target.step_type,
            message: target.message_to_send?.slice(0, 200),
            expected_answer: target.expected_answer?.slice(0, 100),
            order: target.order,
        } : null,
        context: context.map((s: any) => ({
            index: s.global_index,
            scene: s.scene_name,
            type: s.step_type,
            message: s.message_to_send?.slice(0, 120),
        })),
    });
}
