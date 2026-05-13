'use client';
import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { getExperienceBySlug } from '@/lib/firestore';

// ─── Slug Player Redirect ────────────────────────────────────────────────────
// Resolves the slug → experience id, then forwards to /play/[id] with all query
// params preserved. This unifies every public player entry through a single
// route so the synthetic NYC gate, paywall, session resume and analytics all
// run from one place.
//
// The previous implementation of this file was a parallel (and outdated) copy
// of the player. Keeping that in sync with /play/[id] was a maintenance trap —
// missing the gate is what motivated the rewrite. If a future product need
// requires a distinct slug-specific render (e.g. richer OG metadata), do that
// at the layout/route level, not by duplicating the chat UI.

export default function SlugPlayerRedirect() {
    const { slug } = useParams() as { slug: string };
    const searchParams = useSearchParams();
    const router = useRouter();
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const exp = await getExperienceBySlug(slug);
            if (cancelled) return;
            if (!exp) { setNotFound(true); return; }
            const qs = searchParams.toString();
            const target = `/play/${exp.id}${qs ? `?${qs}` : ''}`;
            router.replace(target);
        })();
        return () => { cancelled = true; };
    }, [slug, searchParams, router]);

    if (notFound) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                color: '#8E8E93',
                fontSize: 14,
            }}>
                Not found.
            </div>
        );
    }

    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#FFFFFF',
        }}>
            <div style={{
                width: 30, height: 30,
                border: '3px solid #E5E5EA',
                borderTopColor: '#8E8E93',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
