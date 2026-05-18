import { getApps, initializeApp, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

let adminApp: App;

function parseServiceAccount(raw: string): Record<string, unknown> {
    try {
        return JSON.parse(raw);
    } catch {
        // dotenv may convert \n escape sequences inside string values (like private_key) to actual newlines,
        // which is invalid JSON. Walk the string and re-escape literal control chars inside string literals.
        let out = '';
        let inStr = false;
        let escaped = false;
        for (const c of raw) {
            if (escaped) { out += c; escaped = false; continue; }
            if (c === '\\') { out += c; escaped = true; continue; }
            if (c === '"') { inStr = !inStr; out += c; continue; }
            if (inStr) {
                if (c === '\n') { out += '\\n'; continue; }
                if (c === '\r') { out += '\\r'; continue; }
                if (c === '\t') { out += '\\t'; continue; }
            }
            out += c;
        }
        return JSON.parse(out);
    }
}

function getAdminApp(): App {
    if (getApps().length === 0) {
        const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
        if (serviceAccount) {
            // Full credentials — needed for Firestore admin writes
            const parsed = parseServiceAccount(serviceAccount);
            adminApp = initializeApp({ credential: cert(parsed as Parameters<typeof cert>[0]) });
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
    access_token?: string;
}): Promise<string> {
    const ref = await getAdminDb().collection('user_sessions').add({
        experience_id: data.experience_id,
        email: data.email || '',
        lang: data.lang || 'es',
        current_step: 0,
        total_steps: data.total_steps,
        status: 'in_progress',
        started_at: new Date().toISOString(),
        ...(data.access_token ? { access_token: data.access_token } : {}),
    });
    return ref.id;
}

export async function adminUpdateSession(sessionId: string, data: Record<string, any>): Promise<void> {
    const cleanData = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
    await getAdminDb().collection('user_sessions').doc(sessionId).update(cleanData);
}

// ─── Auth ────────────────────────────────────────────────────────────────────

// verifyAuth validates the bearer token AND verifies the caller is in the
// `admins` collection. Without the allowlist check, any Firebase user (and
// since email/password sign-up is enabled by default, anyone on the internet
// can self-mint one) would have admin privileges — the bug discovered in the
// 2026-05-18 audit. The admin allowlist is the authoritative gate.
//
// Admin docs are keyed by lowercase email with shape { email, status, ... }.
// A doc with status === 'invited' is also considered active (post-invite flow).
export async function verifyAuth(request: Request): Promise<{ uid: string; email?: string } | null> {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;

    const token = authHeader.slice(7);
    try {
        const app = getAdminApp();
        const auth = getAuth(app);
        const decoded = await auth.verifyIdToken(token);
        const email = decoded.email?.toLowerCase();
        if (!email) return null;

        const allowed = await isAdmin(email);
        if (!allowed) {
            console.warn(`[verifyAuth] Reject non-admin user: ${email}`);
            return null;
        }
        return { uid: decoded.uid, email };
    } catch {
        return null;
    }
}

export async function isAdmin(email: string): Promise<boolean> {
    if (!email) return false;
    const snap = await getAdminDb()
        .collection('admins')
        .where('email', '==', email.toLowerCase())
        .limit(1)
        .get();
    if (snap.empty) return false;
    const status = snap.docs[0].data().status;
    // Treat both 'active' and 'invited' as admin (invitee accepted via password reset).
    return status === 'active' || status === 'invited';
}
