import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

// GET /api/debug/audit-steps?secret=X&exp=EXPERIENCE_ID
// Returns all interactive steps with their expected_answer for QA audit.

export async function GET(req: NextRequest) {
    const secret = req.nextUrl.searchParams.get('secret');
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const expId = req.nextUrl.searchParams.get('exp') || '';
    if (!expId) return NextResponse.json({ error: 'exp required' }, { status: 400 });

    const db = getAdminDb();
    const [scenesSnap, stepsSnap, expSnap] = await Promise.all([
        db.collection('experiences').doc(expId).collection('scenes').orderBy('order').get(),
        db.collection('experiences').doc(expId).collection('steps').orderBy('order').get(),
        db.collection('experiences').doc(expId).get(),
    ]);

    const expName = expSnap.data()?.name || expId;
    const scenes = scenesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
    const allSteps = stepsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

    const ordered: any[] = [];
    for (const scene of scenes) {
        const sceneSteps = allSteps.filter(s => s.scene_id === scene.id).sort((a, b) => a.order - b.order);
        for (const step of sceneSteps) {
            ordered.push({ ...step, scene_name: scene.name, global_index: ordered.length });
        }
    }

    const interactive = ordered
        .filter(s => s.step_type === 'interactive' || s.requires_response)
        .map(s => ({
            index: s.global_index,
            scene: s.scene_name,
            message: s.message_to_send,
            expected_answer: s.expected_answer,
            hints: s.hints || [],
            wrong_answer_message: s.wrong_answer_message || '',
        }));

    return NextResponse.json({
        experience: expName,
        total_steps: ordered.length,
        interactive_count: interactive.length,
        steps: interactive,
    });
}
