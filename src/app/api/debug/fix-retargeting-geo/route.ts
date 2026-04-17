import { NextRequest, NextResponse } from 'next/server';
// ─── POST /api/debug/fix-retargeting-geo ─────────────────────────────────────
// Adds NYC 25mi geo_locations to the 2 live retargeting ad sets and pauses
// the orphan ad set from the first failed run.

const META_TOKEN = process.env.META_ADS_ACCESS_TOKEN || '';
const GRAPH = 'https://graph.facebook.com/v21.0';

const AUD_LEAD_MAGNET_VISITORS = '120243989905400770';
const AUD_LEADS = '120243989905550770';

const RT_LEADS_ADSET = '120244242439630770';
const RT_FOLLOWERS_ADSET = '120244242581940770';
const ORPHAN_FOLLOWERS_ADSET = '120244242459100770';

const NYC_GEO = {
    custom_locations: [{
        latitude: 40.7128,
        longitude: -74.006,
        radius: 25,
        distance_unit: 'mile',
    }],
    location_types: ['home', 'recent'],
};

async function metaPost(path: string, body: Record<string, unknown>, attempt = 1): Promise<any> {
    const url = new URL(`${GRAPH}${path}`);
    url.searchParams.set('access_token', META_TOKEN);
    const form = new URLSearchParams();
    for (const [k, v] of Object.entries(body)) {
        if (v === undefined || v === null) continue;
        form.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
    }
    const res = await fetch(url.toString(), { method: 'POST', body: form });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.error) {
        const err = json.error || {};
        if (attempt < 5 && (err.is_transient || err.code === 2 || err.code === 1 || err.code === 17)) {
            await new Promise(r => setTimeout(r, 1500 * attempt));
            return metaPost(path, body, attempt + 1);
        }
        throw new Error(`POST ${path}: ${JSON.stringify(err || json)}`);
    }
    return json;
}

export async function POST(req: NextRequest) {
    const secret = req.nextUrl.searchParams.get('secret');
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const log: any[] = [];

    try {
        // Leads targeting (with exclude)
        const leadsTargeting = {
            geo_locations: NYC_GEO,
            custom_audiences: [{ id: AUD_LEAD_MAGNET_VISITORS }],
            excluded_custom_audiences: [{ id: AUD_LEADS }],
            age_min: 22,
            age_max: 45,
            targeting_automation: { advantage_audience: 0 },
            publisher_platforms: ['facebook', 'instagram'],
            facebook_positions: ['feed', 'story'],
            instagram_positions: ['stream', 'story', 'reels'],
        };

        log.push({ op: `update RT Leads adset geo → NYC 25mi`, result: await metaPost(`/${RT_LEADS_ADSET}`, { targeting: leadsTargeting }) });

        // Followers targeting
        const followersTargeting = {
            geo_locations: NYC_GEO,
            custom_audiences: [{ id: AUD_LEAD_MAGNET_VISITORS }],
            age_min: 22,
            age_max: 45,
            targeting_automation: { advantage_audience: 0 },
            publisher_platforms: ['instagram'],
            instagram_positions: ['stream', 'story', 'reels', 'explore'],
        };

        log.push({ op: `update RT Followers adset geo → NYC 25mi`, result: await metaPost(`/${RT_FOLLOWERS_ADSET}`, { targeting: followersTargeting }) });

        // Pause orphan
        log.push({ op: `pause orphan adset ${ORPHAN_FOLLOWERS_ADSET}`, result: await metaPost(`/${ORPHAN_FOLLOWERS_ADSET}`, { status: 'PAUSED' }) });

        return NextResponse.json({ ok: true, log });
    } catch (err: unknown) {
        return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err), log }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    return POST(req);
}
