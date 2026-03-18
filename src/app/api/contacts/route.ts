import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { Resend } from 'resend';

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,DELETE,PATCH,POST,PUT',
    'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version',
};

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const NOTIFICATION_EMAIL = process.env.NOTIFICATION_EMAIL || '';

async function sendNotification(contactEmail: string) {
    if (!resend || !NOTIFICATION_EMAIL) return;
    try {
        await resend.emails.send({
            from: 'StoryHunt <onboarding@resend.dev>',
            to: NOTIFICATION_EMAIL,
            subject: `New StoryHunt Signup: ${contactEmail}`,
            html: `
                <div style="font-family: monospace; background: #050505; color: #fff; padding: 40px; border-radius: 8px;">
                    <h2 style="color: #ff0033; margin: 0 0 20px;">NEW_HUNTER_DETECTED</h2>
                    <p style="color: #00d2ff; font-size: 18px; margin: 0 0 10px;">${contactEmail}</p>
                    <p style="color: #888; font-size: 14px; margin: 0 0 30px;">${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })}</p>
                    <a href="https://storyhunt-app.vercel.app/dashboard/contacts"
                       style="display: inline-block; background: #ff0033; color: #fff; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 4px;">
                        VIEW_ALL_CONTACTS
                    </a>
                </div>
            `,
        });
    } catch (err) {
        console.error('Failed to send notification email:', err);
    }
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

export async function POST(request: Request) {
    try {
        const contentType = request.headers.get('content-type') ?? '';
        let email: string | undefined;

        if (contentType.includes('application/json')) {
            const body = await request.json();
            email = body.email;
        } else {
            // HTML form submission (application/x-www-form-urlencoded)
            const formData = await request.formData();
            email = formData.get('email') as string;
        }

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400, headers: CORS_HEADERS });
        }

        await addDoc(collection(db, 'contacts'), {
            email,
            created_at: new Date().toISOString(),
            status: 'new',
        });

        // Send notification email (non-blocking, don't fail if it errors)
        sendNotification(email);

        // If it came from an HTML form, redirect to success page
        if (!contentType.includes('application/json')) {
            return NextResponse.redirect('https://storyhunt.city/success.html', 303);
        }

        return NextResponse.json({ success: true }, { headers: CORS_HEADERS });
    } catch (error: any) {
        console.error('Error adding contact:', error);
        return NextResponse.json({ error: error.message }, { status: 500, headers: CORS_HEADERS });
    }
}
