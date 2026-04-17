import { NextRequest, NextResponse } from 'next/server';
// ─── POST /api/debug/launch-retargeting ──────────────────────────────────────
// One-shot: create two retargeting campaigns (Leads + Followers) targeting
// the Lead Magnet Visitors custom audience (14d), $4/day each = $8/day total.
// Both campaigns + ad sets + ads created ACTIVE.
//
// Reuses existing image_hashes (adimages upload lost app capability).
// Protected by CRON_SECRET. Supports:
//   - dry_run=1
//   - skip_leads=1 (if leads campaign was already created in a prior run)
//   - followers_campaign_id=XXX (reuse empty followers campaign from failed run)

const META_TOKEN = process.env.META_ADS_ACCESS_TOKEN || '';
const AD_ACCOUNT = 'act_1614086746553655';
const PAGE_ID = '1027712467099764';
const GRAPH = 'https://graph.facebook.com/v21.0';

const AUD_LEAD_MAGNET_VISITORS = '120243989905400770';
const AUD_LEADS = '120243989905550770';
const VIDEO_SUBWAY_ID = '972550711977782';
const VOICEMAIL_HASH = '679eddb707276bf642aeb34bda419f51';

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

async function findSubwayHash(): Promise<string> {
    const creatives = await metaGet(`/${AD_ACCOUNT}/adcreatives`, {
        fields: 'name,object_story_spec',
        limit: '100',
    });
    for (const c of creatives.data || []) {
        const name = String(c.name || '').toLowerCase();
        if (name.includes('subway')) {
            const vd = c?.object_story_spec?.video_data;
            if (vd?.image_hash) return vd.image_hash;
        }
    }
    throw new Error('Subway image_hash not found in existing creatives');
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
    const skipLeads = req.nextUrl.searchParams.get('skip_leads') === '1';
    const existingFollowersCampaignId = req.nextUrl.searchParams.get('followers_campaign_id') || '';

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
        const voicemailHash = VOICEMAIL_HASH;
        log.push({ step: ++step, op: `use voicemail hash: ${voicemailHash}`, ok: true });

        const subwayHash = dryRun
            ? 'dry-run-hash'
            : await run('fetch subway image_hash from existing creative', () => findSubwayHash());

        // ─── Leads campaign ─────────────────────────────────────────────────
        let leadsCampaignId = 'skipped';
        let leadsAdSetId = 'skipped';
        let leadsCreativeId: string | undefined = 'skipped';

        if (!skipLeads) {
            const leadsCampaign = await write('create campaign "StoryHunt Retargeting — Leads"', () =>
                metaPost(`/${AD_ACCOUNT}/campaigns`, {
                    name: 'StoryHunt Retargeting — Leads',
                    objective: 'OUTCOME_TRAFFIC',
                    status: 'ACTIVE',
                    special_ad_categories: [],
                    is_adset_budget_sharing_enabled: false,
                }),
            );
            leadsCampaignId = leadsCampaign?.id || 'dry-run';

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
            leadsAdSetId = leadsAdSet?.id || 'dry-run';

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
            leadsCreativeId = leadsCreative?.id;

            await write('create ad "RT Voicemail — Second Chance"', () =>
                metaPost(`/${AD_ACCOUNT}/ads`, {
                    name: 'RT Voicemail — Second Chance',
                    adset_id: leadsAdSetId,
                    creative: { creative_id: leadsCreativeId },
                    status: 'ACTIVE',
                }),
            );
        } else {
            log.push({ step: ++step, op: 'skip leads campaign (already created)', ok: true });
        }

        // ─── Followers campaign ─────────────────────────────────────────────
        let followersCampaignId = existingFollowersCampaignId;
        if (!followersCampaignId) {
            const followersCampaign = await write('create campaign "StoryHunt Retargeting — Followers"', () =>
                metaPost(`/${AD_ACCOUNT}/campaigns`, {
                    name: 'StoryHunt Retargeting — Followers',
                    objective: 'OUTCOME_ENGAGEMENT',
                    status: 'ACTIVE',
                    special_ad_categories: [],
                    is_adset_budget_sharing_enabled: false,
                }),
            );
            followersCampaignId = followersCampaign?.id || 'dry-run';
        } else {
            log.push({ step: ++step, op: `reusing followers campaign ${followersCampaignId}`, ok: true });
        }

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
                optimization_goal: 'POST_ENGAGEMENT',
                targeting: followersTargeting,
                status: 'ACTIVE',
                bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
                start_time: new Date().toISOString(),
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
            leads: { campaign_id: leadsCampaignId, ad_set_id: leadsAdSetId, creative_id: leadsCreativeId },
            followers: { campaign_id: followersCampaignId, ad_set_id: followersAdSetId, creative_id: followersCreativeId },
            daily_spend_added: skipLeads ? '$4' : '$8',
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
