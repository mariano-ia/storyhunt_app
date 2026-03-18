import {
    collection, doc, addDoc, getDoc, getDocs, updateDoc,
    deleteDoc, query, where, orderBy, Timestamp, writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Experience, ExperienceFormData, Step, StepFormData, Scene, SceneFormData, UserSession, Interaction, ExperienceMetrics, Contact } from './types';

const now = () => new Date().toISOString();

// ─── Experiences ──────────────────────────────────────────────────────────────

export async function getExperiences(): Promise<Experience[]> {
    const snap = await getDocs(collection(db, 'experiences'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Experience));
}

export async function getExperience(id: string): Promise<Experience | null> {
    const snap = await getDoc(doc(db, 'experiences', id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Experience;
}

export async function getExperienceBySlug(slug: string): Promise<Experience | null> {
    const q = query(collection(db, 'experiences'), where('slug', '==', slug));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() } as Experience;
}

export async function createExperience(data: ExperienceFormData): Promise<string> {
    const ref = await addDoc(collection(db, 'experiences'), {
        ...data,
        created_at: now(),
        updated_at: now(),
    });
    return ref.id;
}

export async function updateExperience(id: string, data: Partial<ExperienceFormData>): Promise<void> {
    await updateDoc(doc(db, 'experiences', id), { ...data, updated_at: now() });
}

export async function deleteExperience(id: string): Promise<void> {
    // Also delete all steps in the subcollection
    const stepsSnap = await getDocs(collection(db, 'experiences', id, 'steps'));
    const batch = writeBatch(db);
    stepsSnap.docs.forEach(d => batch.delete(d.ref));
    batch.delete(doc(db, 'experiences', id));
    await batch.commit();
}

// ─── Scenes ──────────────────────────────────────────────────────────────────

export async function getScenes(experienceId: string): Promise<Scene[]> {
    const q = query(
        collection(db, 'experiences', experienceId, 'scenes'),
        orderBy('order', 'asc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Scene));
}

export async function createScene(experienceId: string, data: SceneFormData): Promise<string> {
    const ref = await addDoc(collection(db, 'experiences', experienceId, 'scenes'), {
        ...data,
        experience_id: experienceId,
    });
    return ref.id;
}

export async function updateScene(experienceId: string, sceneId: string, data: Partial<SceneFormData>): Promise<void> {
    await updateDoc(doc(db, 'experiences', experienceId, 'scenes', sceneId), data);
}

export async function deleteScene(experienceId: string, sceneId: string): Promise<void> {
    await deleteDoc(doc(db, 'experiences', experienceId, 'scenes', sceneId));
}

export async function reorderScenes(experienceId: string, scenes: Scene[]): Promise<void> {
    const batch = writeBatch(db);
    scenes.forEach((scene, idx) => {
        batch.update(doc(db, 'experiences', experienceId, 'scenes', scene.id), { order: idx + 1 });
    });
    await batch.commit();
}

/** Auto-migration: if no scenes exist, create a default one and assign all steps to it */
export async function ensureScenesExist(experienceId: string): Promise<{ scenes: Scene[]; migrated: boolean }> {
    const scenes = await getScenes(experienceId);
    if (scenes.length > 0) return { scenes, migrated: false };

    // Create default scene
    const sceneId = await createScene(experienceId, { name: 'Escena 1', order: 1 });

    // Assign all existing steps to this scene
    const steps = await getSteps(experienceId);
    if (steps.length > 0) {
        const batch = writeBatch(db);
        steps.forEach(step => {
            batch.update(doc(db, 'experiences', experienceId, 'steps', step.id), { scene_id: sceneId });
        });
        await batch.commit();
    }

    const newScenes = await getScenes(experienceId);
    return { scenes: newScenes, migrated: true };
}

// ─── Steps ────────────────────────────────────────────────────────────────────

export async function getSteps(experienceId: string, sceneId?: string): Promise<Step[]> {
    const q = query(
        collection(db, 'experiences', experienceId, 'steps'),
        orderBy('order', 'asc')
    );
    const snap = await getDocs(q);
    const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as Step));
    if (sceneId) return all.filter(s => s.scene_id === sceneId);
    return all;
}

export async function createStep(experienceId: string, data: StepFormData): Promise<string> {
    const cleanData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined));
    const ref = await addDoc(collection(db, 'experiences', experienceId, 'steps'), {
        ...cleanData,
        experience_id: experienceId,
    });
    return ref.id;
}

export async function updateStep(experienceId: string, stepId: string, data: Partial<StepFormData>): Promise<void> {
    const cleanData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined));
    await updateDoc(doc(db, 'experiences', experienceId, 'steps', stepId), cleanData);
}

export async function deleteStep(experienceId: string, stepId: string): Promise<void> {
    await deleteDoc(doc(db, 'experiences', experienceId, 'steps', stepId));
}

export async function reorderSteps(experienceId: string, steps: Step[]): Promise<void> {
    const batch = writeBatch(db);
    steps.forEach((step, idx) => {
        batch.update(doc(db, 'experiences', experienceId, 'steps', step.id), { order: idx + 1 });
    });
    await batch.commit();
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export async function getSessions(experienceId?: string): Promise<UserSession[]> {
    let q = experienceId
        ? query(collection(db, 'user_sessions'), where('experience_id', '==', experienceId))
        : query(collection(db, 'user_sessions'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as UserSession));
}

// ─── Metrics ──────────────────────────────────────────────────────────────────

export async function getMetrics(experienceId: string): Promise<ExperienceMetrics> {
    const sessions = await getSessions(experienceId);
    const total = sessions.length;
    const completed = sessions.filter(s => s.status === 'completed').length;

    // Find the step with the most abandonments
    const abandonedSessions = sessions.filter(s => s.status === 'abandoned');
    const stepCounts: Record<number, number> = {};
    abandonedSessions.forEach(s => {
        stepCounts[s.current_step] = (stepCounts[s.current_step] || 0) + 1;
    });
    const highestDropStep = Object.keys(stepCounts).length
        ? Number(Object.entries(stepCounts).sort((a, b) => b[1] - a[1])[0][0])
        : null;

    // Aggregate interaction costs
    const interactionsSnap = await getDocs(collection(db, 'interactions'));
    const sessionIds = new Set(sessions.map(s => s.id));
    let totalTokens = 0;
    let totalCost = 0;
    interactionsSnap.docs.forEach(d => {
        const i = d.data() as Interaction;
        if (sessionIds.has(i.session_id)) {
            totalTokens += i.tokens_consumed ?? 0;
            totalCost += i.estimated_cost ?? 0;
        }
    });

    return {
        experience_id: experienceId,
        total_sessions: total,
        completed_sessions: completed,
        completion_rate: total > 0 ? completed / total : 0,
        highest_drop_step: highestDropStep,
        total_tokens: totalTokens,
        total_cost_usd: totalCost,
        avg_cost_per_session: total > 0 ? totalCost / total : 0,
    };
}

// ─── Platform-wide total LLM cost ─────────────────────────────────────────────

export async function getTotalCost(): Promise<number> {
    const snap = await getDocs(collection(db, 'interactions'));
    let total = 0;
    snap.docs.forEach(d => { total += (d.data() as Interaction).estimated_cost ?? 0; });
    return total;
}

// ─── Save a single LLM interaction (for cost tracking) ────────────────────────

export async function saveInteraction(data: {
    session_id: string;        // Use 'preview-{experienceId}' for previews
    experience_id: string;
    user_message: string;
    system_response: string;
    tokens_consumed: number;
    estimated_cost: number;
}): Promise<void> {
    try {
        await addDoc(collection(db, 'interactions'), {
            ...data,
            timestamp: now(),
        });
    } catch (e) {
        // Non-critical — don't throw, just log
        console.warn('[saveInteraction] Failed to save cost data:', e);
    }
}

// ─── Cost aggregated per experience (for experience list) ─────────────────────

export async function getCostByExperience(): Promise<Record<string, number>> {
    const snap = await getDocs(collection(db, 'interactions'));
    const map: Record<string, number> = {};
    snap.docs.forEach(d => {
        const { experience_id, estimated_cost } = d.data() as Interaction & { experience_id: string };
        if (experience_id) {
            map[experience_id] = (map[experience_id] ?? 0) + (estimated_cost ?? 0);
        }
    });
    return map;
}

// ─── Contacts ─────────────────────────────────────────────────────────────────

export async function getContacts(): Promise<Contact[]> {
    const q = query(collection(db, 'contacts'), orderBy('created_at', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Contact));
}

export async function updateContactStatus(id: string, status: Contact['status']): Promise<void> {
    await updateDoc(doc(db, 'contacts', id), { status });
}
