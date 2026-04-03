import { NextResponse } from 'next/server';
import { getExperiences, getSales } from '@/lib/firestore';
import type { Sale } from '@/lib/types';

// ─── GET /api/public/experiences ─────────────────────────────────────────────
// Returns published and coming_soon experiences with web info only.
// No auth required — consumed by StoryHuntWeb to render cards.
// Order: published first (sorted by sales count desc), then coming_soon.

export async function GET() {
    try {
        const [all, sales] = await Promise.all([
            getExperiences(),
            getSales().catch(() => [] as Sale[]),
        ]);

        // Count sales per experience
        const salesCount: Record<string, number> = {};
        for (const sale of sales) {
            salesCount[sale.experience_id] = (salesCount[sale.experience_id] || 0) + 1;
        }

        const publicExperiences = all
            .filter(exp => exp.status === 'published' || exp.status === 'coming_soon')
            .map(exp => ({
                id: exp.id,
                name: exp.name,
                slug: exp.slug,
                status: exp.status,
                web_tagline: (exp as any).web_tagline || '',
                web_description: (exp as any).web_description || exp.description,
                web_image: (exp as any).web_image || '',
                price: (exp as any).price || 0,
                distance: (exp as any).distance || '',
                duration: (exp as any).duration || '',
                difficulty: (exp as any).difficulty || '',
                location: (exp as any).location || '',
                narrator_avatar: exp.narrator_avatar || '',
            }))
            .sort((a, b) => {
                // Published first, coming_soon last
                if (a.status !== b.status) {
                    return a.status === 'published' ? -1 : 1;
                }
                // Within published, most sales first
                if (a.status === 'published') {
                    return (salesCount[b.id] || 0) - (salesCount[a.id] || 0);
                }
                return 0;
            });

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
