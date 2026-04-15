import { getApps, initializeApp, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

let adminApp: App;

function getAdminApp(): App {
    if (getApps().length === 0) {
        const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
        if (serviceAccount) {
            // Full credentials — needed for Firestore admin writes
            const parsed = JSON.parse(serviceAccount);
            adminApp = initializeApp({ credential: cert(parsed) });
        } else {
            // Fallback: project ID only (sufficient for verifyIdToken)
            adminApp = initializeApp({
                projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            });
        }
    }
    return adminApp || getApps()[0];
}

// ─── Admin Firestore (bypasses security rules) ──────────────────────────��───

export function getAdminDb() {
    return getFirestore(getAdminApp());
}

export async function adminUpdateExperience(experienceId: string, data: Record<string, any>): Promise<void> {
    await getAdminDb().collection('experiences').doc(experienceId).update(data);
}

export async function adminUpdateStep(experienceId: string, stepId: string, data: Record<string, any>): Promise<void> {
    await getAdminDb().collection('experiences').doc(experienceId).collection('steps').doc(stepId).update(data);
}

// ─── Fire-and-forget interaction logger (cost tracking) ─────────────────────

export async function adminSaveInteraction(data: {
    session_id: string;
    experience_id: string;
    user_message: string;
    system_response: string;
    tokens_consumed: number;
    estimated_cost: number;
}): Promise<void> {
    try {
        await getAdminDb().collection('interactions').add({
            ...data,
            timestamp: new Date().toISOString(),
        });
    } catch (e) {
        console.warn('[adminSaveInteraction] Failed to save cost data:', e);
    }
}

// ─── User sessions (player) ─────────────────────────────────────────────────

export async function adminCreateSession(data: {
    experience_id: string;
    email?: string;
    lang?: 'es' | 'en';
    total_steps: number;
}): Promise<string> {
    const ref = await getAdminDb().collection('user_sessions').add({
        experience_id: data.experience_id,
        email: data.email || '',
        lang: data.lang || 'es',
        current_step: 0,
        total_steps: data.total_steps,
        status: 'in_progress',
        started_at: new Date().toISOString(),
    });
    return ref.id;
}

export async function adminUpdateSession(sessionId: string, data: Record<string, any>): Promise<void> {
    const cleanData = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
    await getAdminDb().collection('user_sessions').doc(sessionId).update(cleanData);
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function verifyAuth(request: Request): Promise<{ uid: string; email?: string } | null> {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;

    const token = authHeader.slice(7);
    try {
        const app = getAdminApp();
        const auth = getAuth(app);
        const decoded = await auth.verifyIdToken(token);
        return { uid: decoded.uid, email: decoded.email };
    } catch {
        return null;
    }
}
