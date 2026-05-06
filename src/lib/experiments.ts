// ─── Lightweight client-side experiments ────────────────────────────────────
//
// Cookie-based variant assignment (50/50 by default). Each visitor gets a stable
// variant for the lifetime of the cookie. The variant is included in every
// analytics event via the `experiment_variant` property so platforms (PostHog,
// GA4, Meta) can compare conversion by variant.
//
// To create a new experiment:
//   1. Add it to EXPERIMENTS below
//   2. Read it where needed: const variant = getVariant('hero-copy-v1')
//   3. PostHog/GA4/Meta will automatically include it in events

import posthog from 'posthog-js';

export interface ExperimentDefinition {
    id: string;
    description: string;
    variants: { name: string; weight: number }[]; // weights must sum to 1
}

export const EXPERIMENTS: Record<string, ExperimentDefinition> = {
    'hero-copy-v1': {
        id: 'hero-copy-v1',
        description: 'Hero headline on /start — control vs emotional framing',
        variants: [
            { name: 'control', weight: 0.5 },     // "A mystery experience through New York City"
            { name: 'emotional', weight: 0.5 },   // "Decode the NYC most tourists never see"
        ],
    },
};

const COOKIE_PREFIX = 'sh_exp_';
const COOKIE_DAYS = 90;

function readCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.split('; ').find(row => row.startsWith(name + '='));
    return match ? decodeURIComponent(match.split('=')[1]) : null;
}

function writeCookie(name: string, value: string, days: number) {
    if (typeof document === 'undefined') return;
    const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function pickWeightedVariant(variants: { name: string; weight: number }[]): string {
    const r = Math.random();
    let acc = 0;
    for (const v of variants) {
        acc += v.weight;
        if (r < acc) return v.name;
    }
    return variants[variants.length - 1].name;
}

/**
 * Get the variant assigned to this visitor for the given experiment.
 * Assigns one if not yet assigned. Persists in cookie + reports to PostHog.
 */
export function getVariant(experimentId: string): string {
    const exp = EXPERIMENTS[experimentId];
    if (!exp) {
        console.warn(`[experiments] Unknown experiment: ${experimentId}`);
        return 'control';
    }

    const cookieName = COOKIE_PREFIX + experimentId;
    const existing = readCookie(cookieName);
    if (existing) return existing;

    const assigned = pickWeightedVariant(exp.variants);
    writeCookie(cookieName, assigned, COOKIE_DAYS);

    // Tag every subsequent PostHog event with this variant via super properties
    try {
        if (posthog.__loaded) {
            posthog.register({ [`experiment_${experimentId}`]: assigned });
            posthog.capture('experiment_assigned', {
                experiment_id: experimentId,
                variant: assigned,
            });
        }
    } catch { /* posthog might not be ready yet */ }

    return assigned;
}

/**
 * Re-register experiment variants with PostHog after init. Call from a useEffect
 * inside a component that has access to PostHog already initialized.
 */
export function syncExperimentsToPostHog() {
    if (typeof document === 'undefined') return;
    if (!posthog.__loaded) return;
    const props: Record<string, string> = {};
    for (const expId of Object.keys(EXPERIMENTS)) {
        const variant = readCookie(COOKIE_PREFIX + expId);
        if (variant) props[`experiment_${expId}`] = variant;
    }
    if (Object.keys(props).length > 0) {
        posthog.register(props);
    }
}
