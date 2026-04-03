import { getApps, initializeApp, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

let adminApp: App;

function getAdminApp(): App {
    if (getApps().length === 0) {
        // In Vercel, Firebase Admin can auto-discover credentials via
        // GOOGLE_APPLICATION_CREDENTIALS or we initialize with project ID only
        // (sufficient for verifyIdToken when using Firebase Auth)
        adminApp = initializeApp({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        });
    }
    return adminApp || getApps()[0];
}

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
