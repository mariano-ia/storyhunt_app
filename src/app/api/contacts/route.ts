import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,DELETE,PATCH,POST,PUT',
    'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version',
};

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
