import { NextResponse } from 'next/server';
import { getExperiences } from '@/lib/firestore';

// ─── GET /api/public/experiences ─────────────────────────────────────────────
// Returns published and coming_soon experiences with web info only.
// No auth required — consumed by StoryHuntWeb to render cards.

export async function GET() {
    try {
        const all = await getExperiences();

        const publicExperiences = all
            .filter(exp => exp.status === 'published' || exp.status === 'coming_soon')
            .map(exp => ({
                id: exp.id,
                name: exp.name,
                slug: exp.slug,
                status: exp.status,
                web_description: (exp as any).web_description || exp.description,
                web_image: (exp as any).web_image || '',
                price: (exp as any).price || 0,
                distance: (exp as any).distance || '',
                duration: (exp as any).duration || '',
                difficulty: (exp as any).difficulty || '',
                location: (exp as any).location || '',
                narrator_avatar: exp.narrator_avatar || '',
            }));

        return NextResponse.json(publicExperiences, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
            },
        });
    } catch (err) {
        console.error('[public/experiences]', err);
        return NextResponse.json({ error: 'Error fetching experiences' }, { status: 500 });
    }
}
