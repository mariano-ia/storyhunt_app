import { NextRequest, NextResponse } from 'next/server';
// ─── POST /api/debug/launch-nyc-focus ────────────────────────────────────────
// One-shot migration:
// 1. Pause 4 international ad sets (LM_A, LM_B, CV_A, CV_B)
// 2. Bump LM_C to $7/day, CV_C to $10/day
// 3. Upload 2 organic videos to Meta ad account
// 4. Create IG Followers campaign + 1 ad set (NYC 25mi, $15/day) + 2 ads
//
// Protected by CRON_SECRET. Supports dry_run=1. Remove after launch.

const META_TOKEN = process.env.META_ADS_ACCESS_TOKEN || '';
const AD_ACCOUNT = 'act_1614086746553655';
const PAGE_ID = '1027712467099764'; // Story Hunt Facebook page
// IG account ID resolved dynamically from FB page, fallback below
const GRAPH = 'https://graph.facebook.com/v21.0';

// Ad set IDs
const LM_A_ID = '120243822503360770';
const LM_B_ID = '120243822495390770';
const CV_A_ID = '120244026413870770';
const CV_B_ID = '120244026415720770';
const LM_C_ID = '120243822502980770';
const CV_C_ID = '120244026416180770';

type OpResult = { step: number; op: string; ok: boolean; result?: unknown; error?: string };

async function metaGet(path: string, params?: Record<string, string>): Promise<any> {
    const url = new URL(`${GRAPH}${path}`);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    url.searchParams.set('access_token', META_TOKEN);
    const res = await fetch(url.toString());
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.error) throw new Error(`GET ${path}: ${JSON.stringify(json.error || json)}`);
    return json;
}

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

// Upload video to ad account via URL (Meta fetches it)
async function uploadVideoFromUrl(videoUrl: string, title: string): Promise<string> {
    const res = await metaPost(`/${AD_ACCOUNT}/advideos`, {
        file_url: videoUrl,
        title,
    });
    return res.id;
}

export async function POST(req: NextRequest) {
    const secret = req.nextUrl.searchParams.get('secret');
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    if (!META_TOKEN) {
        return NextResponse.json({ error: 'META_ADS_ACCESS_TOKEN not set' }, { status: 500 });
    }

    const dryRun = req.nextUrl.searchParams.get('dry_run') === '1';
    // video_urls OR pre-uploaded video_ids
    const videoUrl1 = req.nextUrl.searchParams.get('video1') || '';
    const videoUrl2 = req.nextUrl.searchParams.get('video2') || '';
    const existingVideoId1 = req.nextUrl.searchParams.get('vid1') || '';
    const existingVideoId2 = req.nextUrl.searchParams.get('vid2') || '';

    if (!dryRun && !existingVideoId1 && (!videoUrl1 || !videoUrl2)) {
        return NextResponse.json({
            error: 'Pass video1=<url>&video2=<url> OR vid1=<id>&vid2=<id> for pre-uploaded videos.',
        }, { status: 400 });
    }

    const log: OpResult[] = [];
    let step = 0;

    const run = async (op: string, fn: () => Promise<any>): Promise<any> => {
        step++;
        try {
            const result = await fn();
            log.push({ step, op, ok: true, result });
            return result;
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            log.push({ step, op, ok: false, error: msg });
            throw err;
        }
    };

    const write = async (op: string, fn: () => Promise<any>): Promise<any> => {
        if (dryRun) { step++; log.push({ step, op: `[dry-run] ${op}`, ok: true }); return null; }
        return run(op, fn);
    };

    try {
        // ─── PHASE 1: Pause international ad sets ───────────────────────
        await write('pause LM_A (US Northeast)', () => metaPost(`/${LM_A_ID}`, { status: 'PAUSED' }));
        await write('pause LM_B (US+INTL Travel)', () => metaPost(`/${LM_B_ID}`, { status: 'PAUSED' }));
        await write('pause CV_A (US Northeast)', () => metaPost(`/${CV_A_ID}`, { status: 'PAUSED' }));
        await write('pause CV_B (US+INTL Travel)', () => metaPost(`/${CV_B_ID}`, { status: 'PAUSED' }));

        // ─── PHASE 2: Bump NYC budgets ──────────────────────────────────
        await write('bump LM_C to $7/day', () => metaPost(`/${LM_C_ID}`, { daily_budget: '700' }));
        await write('bump CV_C to $10/day', () => metaPost(`/${CV_C_ID}`, { daily_budget: '1000' }));

        // ─── PHASE 3: Upload videos to Meta ─────────────────────────────
        let video1Id = '';
        let video2Id = '';

        if (!dryRun) {
            if (existingVideoId1 && existingVideoId2) {
                video1Id = existingVideoId1;
                video2Id = existingVideoId2;
                log.push({ step: ++step, op: `reusing pre-uploaded video1=${video1Id}`, ok: true });
                log.push({ step: ++step, op: `reusing pre-uploaded video2=${video2Id}`, ok: true });
            } else {
                const v1 = await run('upload video 1 (NYC alley symbol)', () =>
                    uploadVideoFromUrl(videoUrl1, 'IG Followers — NYC Alley Symbol'),
                );
                video1Id = v1;

                const v2 = await run('upload video 2 (subway symbol)', () =>
                    uploadVideoFromUrl(videoUrl2, 'IG Followers — Subway Symbol'),
                );
                video2Id = v2;
            }
        } else {
            step++;
            log.push({ step, op: '[dry-run] upload video 1', ok: true });
            step++;
            log.push({ step, op: '[dry-run] upload video 2', ok: true });
        }

        // ─── PHASE 4: Resolve Instagram Account ID ─────────────────────
        let igAccountId = '';
        try {
            const pageInfo = await run('resolve IG account from FB page', () =>
                metaGet(`/${PAGE_ID}`, { fields: 'instagram_business_account' }),
            );
            igAccountId = pageInfo?.instagram_business_account?.id || '';
        } catch {
            // fallback to hardcoded
        }
        if (!igAccountId) {
            igAccountId = '17841473040831498';
            log.push({ step: ++step, op: `using fallback IG account ID: ${igAccountId}`, ok: true });
        }

        // ─── PHASE 5: Create IG Followers campaign ──────────────────────
        // Campaign — already created in previous run, reuse ID
        const existingCampaignId = req.nextUrl.searchParams.get('campaign_id') || '';
        let campaignId = existingCampaignId;
        if (!campaignId) {
            const campaignResult = await write('create campaign "StoryHunt IG Followers — NYC"', () =>
                metaPost(`/${AD_ACCOUNT}/campaigns`, {
                    name: 'StoryHunt IG Followers — NYC',
                    objective: 'OUTCOME_ENGAGEMENT',
                    status: 'ACTIVE',
                    special_ad_categories: [],
                    is_adset_budget_sharing_enabled: false,
                }),
            );
            campaignId = campaignResult?.id || 'dry-run';
        } else {
            log.push({ step: ++step, op: `reusing existing campaign ${campaignId}`, ok: true });
        }

        // Ad Set — NYC 25mi, $15/day
        const targeting = {
            geo_locations: {
                custom_locations: [{
                    latitude: 40.7128,
                    longitude: -74.006,
                    radius: 25,
                    distance_unit: 'mile',
                }],
                location_types: ['home', 'recent'],
            },
            age_min: 22,
            age_max: 45,
            targeting_automation: {
                advantage_audience: 0,
            },
            publisher_platforms: ['instagram'],
            instagram_positions: ['stream', 'story', 'reels', 'explore'],
        };

        const adSetResult = await write('create ad set "IG Followers — NYC Locals" ($15/day)', () =>
            metaPost(`/${AD_ACCOUNT}/adsets`, {
                name: 'IG Followers — NYC Locals',
                campaign_id: campaignId,
                daily_budget: '1500',
                billing_event: 'IMPRESSIONS',
                optimization_goal: 'REACH',
                targeting,
                status: 'ACTIVE',
                bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
                start_time: new Date().toISOString(),
                promoted_object: { page_id: PAGE_ID },
            }),
        );
        const adSetId = adSetResult?.id || 'dry-run';

        // Ad 1 — NYC alley symbol
        await write('create ad 1 (NYC alley symbol)', () =>
            metaPost(`/${AD_ACCOUNT}/ads`, {
                name: 'IG — NYC Alley Symbol',
                adset_id: adSetId,
                creative: {
                    object_story_spec: {
                        instagram_actor_id: igAccountId,
                        video_data: {
                            video_id: video1Id,
                            message: 'found this in a side street off Bleecker. anyone know what this symbol means?',
                            call_to_action: { type: 'LEARN_MORE', value: { link: 'https://www.instagram.com/storyhunt.city/' } },
                        },
                    },
                },
                status: 'ACTIVE',
            }),
        );

        // Ad 2 — Subway symbol
        await write('create ad 2 (subway symbol)', () =>
            metaPost(`/${AD_ACCOUNT}/ads`, {
                name: 'IG — Subway Symbol',
                adset_id: adSetId,
                creative: {
                    object_story_spec: {
                        instagram_actor_id: igAccountId,
                        video_data: {
                            video_id: video2Id,
                            message: 'has anyone seen this before? it was on the wall at an old subway station. the tiles look original, like from 1904.',
                            call_to_action: { type: 'LEARN_MORE', value: { link: 'https://www.instagram.com/storyhunt.city/' } },
                        },
                    },
                },
                status: 'ACTIVE',
            }),
        );

        return NextResponse.json({
            ok: true,
            dry_run: dryRun,
            total_steps: step,
            campaign_id: campaignId,
            ad_set_id: adSetId,
            video_ids: { video1: video1Id, video2: video2Id },
            ig_account_id: igAccountId,
            log,
        });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ ok: false, dry_run: dryRun, failed_at_step: step, error: msg, log }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    return POST(req);
}
