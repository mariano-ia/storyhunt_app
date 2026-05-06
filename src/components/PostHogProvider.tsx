'use client';

import { useEffect } from 'react';
import posthog from 'posthog-js';

export default function PostHogProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
        if (!key || posthog.__loaded) return;

        posthog.init(key, {
            api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
            person_profiles: 'identified_only', // anon traffic doesn't create person records (cheaper)
            capture_pageview: true,
            capture_pageleave: true,
            session_recording: {
                maskAllInputs: true,    // never record user typing in inputs (privacy)
                maskTextSelector: '[data-private]', // any element with data-private gets masked
            },
            autocapture: true,
            persistence: 'localStorage+cookie',
        });
    }, []);

    return <>{children}</>;
}
