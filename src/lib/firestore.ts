import {
    collection, doc, addDoc, getDoc, getDocs, updateDoc,
    deleteDoc, query, where, orderBy, Timestamp, writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Experience, ExperienceFormData, Step, StepFormData, Scene, SceneFormData, UserSession, Interaction, ExperienceMetrics, Contact, AIGeneratedExperience, DiscountCoupon, DiscountCouponFormData, AccessToken, Sale } from './types';

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

// ─── AI Story: Batch Creation ────────────────────────────────────────────────

export async function createExperienceFromAI(
    generated: AIGeneratedExperience,
    llmApiKey: string,
    narratorAvatar?: string
): Promise<string> {
    // 1. Create the experience document
    const experienceId = await createExperience({
        name: generated.name,
        description: generated.description,
        narrator_personality: generated.narrator_personality,
        narrator_avatar: narratorAvatar ?? '',
        llm_api_key: llmApiKey,
        slug: generated.slug,
        mode: 'test',
        activation_keyword: generated.activation_keyword,
        status: 'inactive',
    });

    // 2. Create scenes and collect their IDs
    const sceneIdMap: Record<string, string> = {}; // scene name → Firestore ID
    for (const scene of generated.scenes) {
        const sceneId = await createScene(experienceId, {
            name: scene.name,
            order: scene.order,
        });
        sceneIdMap[scene.name] = sceneId;
    }

    // 3. Link scenes linearly (next_scene_id)
    const sortedScenes = [...generated.scenes].sort((a, b) => a.order - b.order);
    for (let i = 0; i < sortedScenes.length - 1; i++) {
        const currentId = sceneIdMap[sortedScenes[i].name];
        const nextId = sceneIdMap[sortedScenes[i + 1].name];
        if (currentId && nextId) {
            await updateScene(experienceId, currentId, { next_scene_id: nextId } as Partial<SceneFormData>);
        }
    }

    // 4. Create steps with scene references
    let globalOrder = 1;
    for (const scene of sortedScenes) {
        const sceneId = sceneIdMap[scene.name];
        for (const step of scene.steps) {
            // Resolve choice target_scene_name → target_scene_id
            const choices = step.choices?.map(ch => ({
                label: ch.label,
                condition: ch.condition,
                target_scene_id: ch.target_scene_name ? sceneIdMap[ch.target_scene_name] : undefined,
            }));

            await createStep(experienceId, {
                scene_id: sceneId,
                order: globalOrder,
                step_type: step.step_type,
                message_to_send: step.message_to_send,
                requires_response: step.requires_response,
                expected_answer: step.expected_answer ?? '',
                hints: step.hints ?? [],
                wrong_answer_message: step.wrong_answer_message ?? '',
                delay_seconds: step.delay_seconds,
                glitch_effect: step.glitch_effect,
                interrupted_typing: step.interrupted_typing,
                context: step.context,
                choices,
            });
            globalOrder++;
        }
    }

    return experienceId;
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

// ─── Discount Coupons ────────────────────────────────────────────────────────

export async function getCoupons(): Promise<DiscountCoupon[]> {
    const q = query(collection(db, 'discount_coupons'), orderBy('created_at', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as DiscountCoupon));
}

export async function getCoupon(id: string): Promise<DiscountCoupon | null> {
    const snap = await getDoc(doc(db, 'discount_coupons', id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as DiscountCoupon;
}

export async function getCouponByCode(code: string): Promise<DiscountCoupon | null> {
    const q = query(collection(db, 'discount_coupons'), where('code', '==', code.toUpperCase()));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() } as DiscountCoupon;
}

export async function createCoupon(data: DiscountCouponFormData & { stripe_coupon_id?: string; stripe_promo_id?: string }): Promise<string> {
    const ref = await addDoc(collection(db, 'discount_coupons'), {
        ...data,
        code: data.code.toUpperCase(),
        times_redeemed: 0,
        created_at: now(),
    });
    return ref.id;
}

export async function updateCoupon(id: string, data: Partial<DiscountCoupon>): Promise<void> {
    await updateDoc(doc(db, 'discount_coupons', id), data);
}

export async function deleteCoupon(id: string): Promise<void> {
    await deleteDoc(doc(db, 'discount_coupons', id));
}

// ─── Access Tokens ───────────────────────────────────────────────────────────

function generateToken(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I for readability
    let token = 'SH-';
    for (let i = 0; i < 6; i++) token += chars[Math.floor(Math.random() * chars.length)];
    return token;
}

export async function createAccessToken(data: {
    experience_id: string;
    lang: 'es' | 'en';
    email: string;
    max_uses?: number;
    expires_hours?: number;
    stripe_session_id?: string;
}): Promise<AccessToken> {
    const token = generateToken();
    const expiresAt = new Date(Date.now() + (data.expires_hours ?? 48) * 60 * 60 * 1000).toISOString();
    const tokenData = {
        token,
        experience_id: data.experience_id,
        lang: data.lang,
        email: data.email,
        max_uses: data.max_uses ?? 2,
        times_used: 0,
        status: 'active' as const,
        expires_at: expiresAt,
        stripe_session_id: data.stripe_session_id,
        created_at: now(),
    };
    const ref = await addDoc(collection(db, 'access_tokens'), tokenData);
    return { id: ref.id, ...tokenData };
}

export async function getAccessToken(token: string): Promise<AccessToken | null> {
    const q = query(collection(db, 'access_tokens'), where('token', '==', token));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() } as AccessToken;
}

export async function getAccessTokens(): Promise<AccessToken[]> {
    const q = query(collection(db, 'access_tokens'), orderBy('created_at', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as AccessToken));
}

export async function useAccessToken(id: string): Promise<void> {
    const snap = await getDoc(doc(db, 'access_tokens', id));
    if (!snap.exists()) return;
    const data = snap.data() as AccessToken;
    const newTimesUsed = (data.times_used ?? 0) + 1;
    const updates: Partial<AccessToken> = {
        times_used: newTimesUsed,
        used_at: now(),
    };
    if (newTimesUsed >= (data.max_uses ?? 2)) {
        updates.status = 'used';
    }
    await updateDoc(doc(db, 'access_tokens', id), updates);
}

// ─── Sales ───────────────────────────────────────────────────────────────────

export async function createSale(data: Omit<Sale, 'id' | 'created_at'>): Promise<string> {
    const ref = await addDoc(collection(db, 'sales'), {
        ...data,
        created_at: now(),
    });
    return ref.id;
}

export async function getSales(): Promise<Sale[]> {
    const q = query(collection(db, 'sales'), orderBy('created_at', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Sale));
}

export async function getTotalRevenue(): Promise<number> {
    const sales = await getSales();
    return sales.reduce((sum, s) => sum + (s.amount ?? 0), 0);
}
