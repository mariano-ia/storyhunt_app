import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { Resend } from 'resend';
import { welcomeEmail } from '@/lib/email-templates';

const ALLOWED_ORIGINS = ['https://storyhunt.city', 'https://www.storyhunt.city', 'http://localhost:3000'];
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': 'https://storyhunt.city',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
};

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const NOTIFICATION_EMAIL = process.env.NOTIFICATION_EMAIL || '';
const META_PIXEL_ID = '1719479962357595';
const META_TOKEN = process.env.META_ADS_ACCESS_TOKEN || '';

async function sendWelcomeEmail(contactEmail: string, lang: 'es' | 'en') {
    if (!resend) return;
    try {
        const { subject, html } = welcomeEmail(lang === 'en');
        await resend.emails.send({
            from: 'StoryHunt <hello@storyhunt.city>',
            to: contactEmail,
            subject,
            html,
        });
        console.log(`[contacts] Welcome email sent to ${contactEmail} (${lang})`);
    } catch (err) {
        console.error(`[contacts] Failed to send welcome email to ${contactEmail}:`, err);
    }
}

async function sendNotification(contactEmail: string) {
    if (!resend || !NOTIFICATION_EMAIL) return;
    try {
        await resend.emails.send({
            from: 'StoryHunt <hello@storyhunt.city>',
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

async function sendMetaConversion(contactEmail: string, source: string, request: Request) {
    if (!META_TOKEN) return;
    try {
        const crypto = await import('crypto');
        const hashedEmail = crypto.createHash('sha256').update(contactEmail.toLowerCase().trim()).digest('hex');
        const userAgent = request.headers.get('user-agent') || '';
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '';
        const sourceUrl = source.includes('secrets') ? 'https://storyhunt.city/secrets'
            : source.includes('intercepted') ? 'https://storyhunt.city/intercepted'
            : source.includes('voicemail') ? 'https://storyhunt.city/voicemail'
            : 'https://storyhunt.city';

        await fetch(`https://graph.facebook.com/v21.0/${META_PIXEL_ID}/events?access_token=${META_TOKEN}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                data: [{
                    event_name: 'Lead',
                    event_time: Math.floor(Date.now() / 1000),
                    action_source: 'website',
                    event_source_url: sourceUrl,
                    user_data: {
                        em: [hashedEmail],
                        client_ip_address: ip,
                        client_user_agent: userAgent,
                    },
                }],
            }),
        });
        console.log(`[contacts] Meta Conversion API Lead sent for ${contactEmail}`);
    } catch (err) {
        console.error('[contacts] Meta Conversion API error:', err);
    }
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

export async function POST(request: Request) {
    try {
        const contentType = request.headers.get('content-type') ?? '';
        let email: string | undefined;

        let source = 'website';

        if (contentType.includes('application/json')) {
            const body = await request.json();
            email = body.email;
            if (body.source) source = body.source;
        } else {
            // HTML form submission (application/x-www-form-urlencoded)
            const formData = await request.formData();
            email = formData.get('email') as string;
        }

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400, headers: CORS_HEADERS });
        }

        // Detect language from Accept-Language header (default: en for NYC market)
        const acceptLang = request.headers.get('accept-language') || '';
        const lang: 'es' | 'en' = acceptLang.toLowerCase().startsWith('es') ? 'es' : 'en';

        await getAdminDb().collection('contacts').add({
            email,
            lang,
            source,
            created_at: new Date().toISOString(),
            status: 'new',
            welcome_sent: true,
            welcome_sent_at: new Date().toISOString(),
        });

        // Send E1 welcome email + admin notification + Meta Conversions API (non-blocking)
        sendWelcomeEmail(email, lang);
        sendNotification(email);
        sendMetaConversion(email, source, request);

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
