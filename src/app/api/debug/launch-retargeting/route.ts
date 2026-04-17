import { NextRequest, NextResponse } from 'next/server';
// ─── POST /api/debug/launch-retargeting ──────────────────────────────────────
// One-shot: create two retargeting campaigns (Leads + Followers) targeting
// the Lead Magnet Visitors custom audience (14d), $4/day each = $8/day total.
// Both campaigns + ad sets + ads created ACTIVE.
//
// Protected by CRON_SECRET. Supports dry_run=1. Remove after launch.

const META_TOKEN = process.env.META_ADS_ACCESS_TOKEN || '';
const AD_ACCOUNT = 'act_1614086746553655';
const PAGE_ID = '1027712467099764';
const GRAPH = 'https://graph.facebook.com/v21.0';

// Custom audiences
const AUD_LEAD_MAGNET_VISITORS = '120243989905400770'; // 14d
const AUD_LEADS = '120243989905550770'; // exclude from lead-capture retargeting

// Existing subway video (uploaded for cold IG Followers campaign)
const VIDEO_SUBWAY_ID = '972550711977782';

// URLs for creative assets
const THUMB_SUBWAY_URL = 'https://storyhunt.city/assets/ads/videos/organic/thumb-subway.jpg';
const IMG_VOICEMAIL_URL = 'https://storyhunt-app.vercel.app/ad-voicemail.png';

type OpResult = { step: number; op: string; ok: boolean; result?: unknown; error?: string };

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
    if (!META_TOKEN) {
        return NextResponse.json({ error: 'META_ADS_ACCESS_TOKEN not set' }, { status: 500 });
    }

    const dryRun = req.nextUrl.searchParams.get('dry_run') === '1';
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
        // ─── PHASE 1: Upload creative assets ────────────────────────────────
        const voicemailImg = await write('upload voicemail image', () =>
            metaPost(`/${AD_ACCOUNT}/adimages`, { url: IMG_VOICEMAIL_URL }),
        );
        const voicemailHash = voicemailImg?.images
            ? Object.values(voicemailImg.images as Record<string, any>)[0]?.hash
            : null;

        const subwayThumb = await write('upload subway thumbnail', () =>
            metaPost(`/${AD_ACCOUNT}/adimages`, { url: THUMB_SUBWAY_URL }),
        );
        const subwayHash = subwayThumb?.images
            ? Object.values(subwayThumb.images as Record<string, any>)[0]?.hash
            : null;

        // ─── PHASE 2: Campaign 1 — Retargeting Leads ────────────────────────
        const leadsCampaign = await write('create campaign "StoryHunt Retargeting — Leads"', () =>
            metaPost(`/${AD_ACCOUNT}/campaigns`, {
                name: 'StoryHunt Retargeting — Leads',
                objective: 'OUTCOME_TRAFFIC',
                status: 'ACTIVE',
                special_ad_categories: [],
                is_adset_budget_sharing_enabled: false,
            }),
        );
        const leadsCampaignId = leadsCampaign?.id || 'dry-run';

        const leadsTargeting = {
            custom_audiences: [{ id: AUD_LEAD_MAGNET_VISITORS }],
            excluded_custom_audiences: [{ id: AUD_LEADS }],
            age_min: 22,
            age_max: 45,
            targeting_automation: { advantage_audience: 0 },
            publisher_platforms: ['facebook', 'instagram'],
            facebook_positions: ['feed', 'story'],
            instagram_positions: ['stream', 'story', 'reels'],
        };

        const leadsAdSet = await write('create ad set "RT Leads — Warm Visitors" ($4/day)', () =>
            metaPost(`/${AD_ACCOUNT}/adsets`, {
                name: 'RT Leads — Warm Visitors',
                campaign_id: leadsCampaignId,
                daily_budget: '400',
                billing_event: 'IMPRESSIONS',
                optimization_goal: 'LANDING_PAGE_VIEWS',
                targeting: leadsTargeting,
                status: 'ACTIVE',
                bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
                start_time: new Date().toISOString(),
            }),
        );
        const leadsAdSetId = leadsAdSet?.id || 'dry-run';

        const leadsCreative = await write('create creative "RT Voicemail — Second Chance"', () =>
            metaPost(`/${AD_ACCOUNT}/adcreatives`, {
                name: 'RT Voicemail — Second Chance',
                object_story_spec: {
                    page_id: PAGE_ID,
                    link_data: {
                        image_hash: voicemailHash,
                        link: 'https://storyhunt.city/voicemail',
                        message: 'You walked past once. The voicemail is still there. Someone left it at 4:12 AM describing a location in NYC. No one has found it yet.',
                        name: 'Second chance. The voicemail is still unclaimed.',
                        call_to_action: {
                            type: 'LEARN_MORE',
                            value: { link: 'https://storyhunt.city/voicemail' },
                        },
                    },
                },
            }),
        );
        const leadsCreativeId = leadsCreative?.id;

        await write('create ad "RT Voicemail — Second Chance"', () =>
            metaPost(`/${AD_ACCOUNT}/ads`, {
                name: 'RT Voicemail — Second Chance',
                adset_id: leadsAdSetId,
                creative: { creative_id: leadsCreativeId },
                status: 'ACTIVE',
            }),
        );

        // ─── PHASE 3: Campaign 2 — Retargeting Followers ────────────────────
        const followersCampaign = await write('create campaign "StoryHunt Retargeting — Followers"', () =>
            metaPost(`/${AD_ACCOUNT}/campaigns`, {
                name: 'StoryHunt Retargeting — Followers',
                objective: 'OUTCOME_ENGAGEMENT',
                status: 'ACTIVE',
                special_ad_categories: [],
                is_adset_budget_sharing_enabled: false,
            }),
        );
        const followersCampaignId = followersCampaign?.id || 'dry-run';

        const followersTargeting = {
            custom_audiences: [{ id: AUD_LEAD_MAGNET_VISITORS }],
            age_min: 22,
            age_max: 45,
            targeting_automation: { advantage_audience: 0 },
            publisher_platforms: ['instagram'],
            instagram_positions: ['stream', 'story', 'reels', 'explore'],
        };

        const followersAdSet = await write('create ad set "RT Followers — Warm Visitors" ($4/day)', () =>
            metaPost(`/${AD_ACCOUNT}/adsets`, {
                name: 'RT Followers — Warm Visitors',
                campaign_id: followersCampaignId,
                daily_budget: '400',
                billing_event: 'IMPRESSIONS',
                optimization_goal: 'REACH',
                targeting: followersTargeting,
                status: 'ACTIVE',
                bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
                start_time: new Date().toISOString(),
                promoted_object: { page_id: PAGE_ID },
            }),
        );
        const followersAdSetId = followersAdSet?.id || 'dry-run';

        const followersCreative = await write('create creative "RT Subway — Second Look"', () =>
            metaPost(`/${AD_ACCOUNT}/adcreatives`, {
                name: 'RT Subway — Second Look',
                object_story_spec: {
                    page_id: PAGE_ID,
                    video_data: {
                        video_id: VIDEO_SUBWAY_ID,
                        image_hash: subwayHash,
                        message: 'if you\'re still thinking about it, we post one new NYC secret every week. no ads, no fluff — just the city talking.',
                        call_to_action: {
                            type: 'LEARN_MORE',
                            value: { link: 'https://www.instagram.com/storyhunt.city/' },
                        },
                    },
                },
            }),
        );
        const followersCreativeId = followersCreative?.id;

        await write('create ad "RT Subway — Second Look"', () =>
            metaPost(`/${AD_ACCOUNT}/ads`, {
                name: 'RT Subway — Second Look',
                adset_id: followersAdSetId,
                creative: { creative_id: followersCreativeId },
                status: 'ACTIVE',
            }),
        );

        return NextResponse.json({
            ok: true,
            dry_run: dryRun,
            total_steps: step,
            leads: {
                campaign_id: leadsCampaignId,
                ad_set_id: leadsAdSetId,
                creative_id: leadsCreativeId,
            },
            followers: {
                campaign_id: followersCampaignId,
                ad_set_id: followersAdSetId,
                creative_id: followersCreativeId,
            },
            daily_spend_added: '$8',
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
