import { NextRequest, NextResponse } from 'next/server';

// POST /api/debug/swap-ig-ads — Swap IG Followers ads to bold branded reels V2
// 1. Upload 3 videos + thumbnails
// 2. Create 3 ad creatives
// 3. Pause old ads in the ad set
// 4. Create 3 new ads
// 5. Update campaign objective to OUTCOME_ENGAGEMENT

const META_TOKEN = process.env.META_ADS_ACCESS_TOKEN || '';
const AD_ACCOUNT = 'act_1614086746553655';
const PAGE_ID = '1027712467099764';
const CAMPAIGN_ID = '120244174034890770';
const AD_SET_ID = '120244174695840770';
const GRAPH = 'https://graph.facebook.com/v21.0';

type Op = { op: string; ok: boolean; result?: unknown; error?: string };

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
        if (attempt < 4 && (err.is_transient || err.code === 2 || err.code === 1)) {
            await new Promise(r => setTimeout(r, 1500 * attempt));
            return metaPost(path, body, attempt + 1);
        }
        throw new Error(`POST ${path}: ${JSON.stringify(err || json)}`);
    }
    return json;
}

async function metaGet(path: string, params?: Record<string, string>): Promise<any> {
    const url = new URL(`${GRAPH}${path}`);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    url.searchParams.set('access_token', META_TOKEN);
    const res = await fetch(url.toString());
    return res.json();
}

const VIDEOS = [
    {
        url: 'https://storyhunt.city/assets/ads/videos/organic/reel-bold-liberty-underground.mp4',
        thumb: 'https://storyhunt.city/assets/ads/videos/organic/thumb-alley.jpg',
        title: 'IG Bold — Forget the Statue of Liberty',
        caption: 'forget the statue of liberty. this is what NYC is actually about. // storyhunt.city',
        name: 'IG Bold — Liberty Underground',
    },
    {
        url: 'https://storyhunt.city/assets/ads/videos/organic/reel-bold-847.mp4',
        thumb: 'https://storyhunt.city/assets/ads/videos/organic/thumb-alley.jpg',
        title: 'IG Bold — 847 Walking Tours',
        caption: 'NYC has 847 walking tours. this is the only one that talks back. // storyhunt.city',
        name: 'IG Bold — 847 Tours',
    },
    {
        url: 'https://storyhunt.city/assets/ads/videos/organic/reel-bold-5times.mp4',
        thumb: 'https://storyhunt.city/assets/ads/videos/organic/thumb-alley.jpg',
        title: 'IG Bold — 5 Times',
        caption: "you've been to new york 5 times and you haven't seen any of it. // storyhunt.city",
        name: 'IG Bold — 5 Times',
    },
];

export async function POST(req: NextRequest) {
    const secret = req.nextUrl.searchParams.get('secret');
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    if (!META_TOKEN) return NextResponse.json({ error: 'no token' }, { status: 500 });

    const log: Op[] = [];
    const run = async (op: string, fn: () => Promise<any>): Promise<any> => {
        try {
            const result = await fn();
            log.push({ op, ok: true, result });
            return result;
        } catch (err: any) {
            log.push({ op, ok: false, error: err.message?.slice(0, 300) });
            throw err;
        }
    };

    try {
        // 1. Pause all existing ads in the ad set
        const existingAds = await run('read existing ads', () =>
            metaGet(`/${AD_SET_ID}/ads`, { fields: 'id,name,status' }),
        );
        for (const ad of (existingAds.data || [])) {
            if (ad.status !== 'PAUSED') {
                await run(`pause old ad ${ad.name}`, () =>
                    metaPost(`/${ad.id}`, { status: 'PAUSED' }),
                );
            }
        }

        // 2. Upload videos + thumbnails, create creatives + ads
        for (const video of VIDEOS) {
            const vid = await run(`upload video: ${video.title}`, () =>
                metaPost(`/${AD_ACCOUNT}/advideos`, { file_url: video.url, title: video.title }),
            );

            const img = await run(`upload thumbnail for ${video.title}`, () =>
                metaPost(`/${AD_ACCOUNT}/adimages`, { url: video.thumb }),
            );
            const hash = img?.images ? Object.values(img.images as Record<string, any>)[0]?.hash : null;

            const creative = await run(`create creative: ${video.title}`, () =>
                metaPost(`/${AD_ACCOUNT}/adcreatives`, {
                    name: video.title,
                    object_story_spec: {
                        page_id: PAGE_ID,
                        video_data: {
                            video_id: vid.id,
                            image_hash: hash,
                            message: video.caption,
                            call_to_action: { type: 'LEARN_MORE', value: { link: 'https://www.instagram.com/storyhunt.city/' } },
                        },
                    },
                }),
            );

            await run(`create ad: ${video.name}`, () =>
                metaPost(`/${AD_ACCOUNT}/ads`, {
                    name: video.name,
                    adset_id: AD_SET_ID,
                    creative: { creative_id: creative.id },
                    status: 'ACTIVE',
                }),
            );
        }

        // 3. Update campaign objective to ENGAGEMENT
        await run('update campaign to OUTCOME_ENGAGEMENT', () =>
            metaPost(`/${CAMPAIGN_ID}`, { objective: 'OUTCOME_ENGAGEMENT' }),
        );

        return NextResponse.json({ ok: true, log });
    } catch (err: any) {
        return NextResponse.json({ ok: false, error: err.message?.slice(0, 300), log }, { status: 500 });
    }
}
