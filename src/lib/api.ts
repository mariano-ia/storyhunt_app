import { getAuth } from 'firebase/auth';
import app from './firebase';

// Authenticated fetch wrapper for admin API calls
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const auth = getAuth(app);
    const user = auth.currentUser;
    const token = user ? await user.getIdToken() : null;

    return fetch(url, {
        ...options,
        headers: {
            ...options.headers,
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
    });
}
