import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';

export async function OPTIONS() {
    const headers = new Headers();
    headers.set('Access-Control-Allow-Origin', '*'); // Allow all origins for the landing page
    headers.set('Access-Control-Allow-Methods', 'GET,DELETE,PATCH,POST,PUT');
    headers.set(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );
    return new NextResponse(null, { status: 200, headers });
}

export async function POST(request: Request) {
    try {
        const { email } = await request.json();

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        const docRef = await addDoc(collection(db, 'contacts'), {
            email,
            created_at: new Date().toISOString(),
            status: 'new',
        });

        const response = NextResponse.json({ success: true, id: docRef.id });

        // Set CORS headers
        response.headers.set('Access-Control-Allow-Origin', '*');

        return response;
    } catch (error: any) {
        console.error('Error adding contact:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
