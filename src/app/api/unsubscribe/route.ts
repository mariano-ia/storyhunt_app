import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

// ─── POST /api/unsubscribe ────────────────────────────────────────────────
// Marks a contact as unsubscribed so the nurturing cron skips them. Wired
// from the List-Unsubscribe email header (one-click) and the /unsubscribe
// landing page.
//
// Accepts JSON `{ email }` (one-click POST from Gmail/Outlook) or form-urlencoded.
// CAN-SPAM compliance: must work without auth, fast acknowledgement.

export async function POST(req: NextRequest) {
    try {
        let email = '';
        const contentType = req.headers.get('content-type') || '';
        if (contentType.includes('application/x-www-form-urlencoded')) {
            const form = await req.formData();
            email = String(form.get('email') || form.get('List-Unsubscribe') || '');
        } else {
            const body = await req.json().catch(() => ({}));
            email = body.email || '';
        }
        const normalized = email.trim().toLowerCase();
        if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
            return NextResponse.json({ error: 'email required' }, { status: 400 });
        }

        const db = getAdminDb();
        const snap = await db.collection('contacts').where('email', '==', normalized).get();
        const nowIso = new Date().toISOString();
        if (snap.empty) {
            // Create a row so future contact creates respect the unsubscribe.
            await db.collection('contacts').add({
                email: normalized,
                source: 'unsubscribe',
                unsubscribed: true,
                unsubscribed_at: nowIso,
                created_at: nowIso,
            });
        } else {
            for (const doc of snap.docs) {
                await doc.ref.update({ unsubscribed: true, unsubscribed_at: nowIso });
            }
        }

        return NextResponse.json({ ok: true });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    // Accept GET ?email=... for plain mailto: unsubscribe links that wrap
    // into a fetch.
    const email = req.nextUrl.searchParams.get('email') || '';
    const normalized = email.trim().toLowerCase();
    if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
        return NextResponse.json({ error: 'email required' }, { status: 400 });
    }
    const db = getAdminDb();
    const snap = await db.collection('contacts').where('email', '==', normalized).get();
    const nowIso = new Date().toISOString();
    if (snap.empty) {
        await db.collection('contacts').add({
            email: normalized,
            source: 'unsubscribe',
            unsubscribed: true,
            unsubscribed_at: nowIso,
            created_at: nowIso,
        });
    } else {
        for (const doc of snap.docs) {
            await doc.ref.update({ unsubscribed: true, unsubscribed_at: nowIso });
        }
    }
    return NextResponse.json({ ok: true });
}
