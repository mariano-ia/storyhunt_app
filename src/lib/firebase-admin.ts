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
