import { NextRequest, NextResponse } from 'next/server';
// ─── POST /api/debug/swap-retargeting-creatives ──────────────────────────────
// Swaps the retargeting creatives to bold variants:
//  - RT Leads: reel-bold-847.mp4 → storyhunt.city/start
//  - RT Followers: reel-bold-liberty-underground.mp4 → @storyhunt.city
// Pauses old ads, reuses existing ad sets, creates new creatives + ads.
// Video IDs + image_hashes fetched from existing IG Bold creatives.

const META_TOKEN = process.env.META_ADS_ACCESS_TOKEN || '';
const AD_ACCOUNT = 'act_1614086746553655';
const PAGE_ID = '1027712467099764';
const GRAPH = 'https://graph.facebook.com/v21.0';

// Existing retargeting ads to pause
const RT_LEADS_OLD_AD_ID = '120244242440130770';
const RT_FOLLOWERS_OLD_AD_ID = '120244242582760770';

// Existing retargeting ad sets (reused for new ads)
const RT_LEADS_ADSET_ID = '120244242439630770';
const RT_FOLLOWERS_ADSET_ID = '120244242581940770';

// Known Meta video IDs for the bold reels (from active IG Followers ads)
const VIDEO_847 = '1977537213134944';
const VIDEO_LIBERTY_UNDERGROUND = '1668015987662884';

// Source ads to fetch image_hash from (IG Bold active ads)
const AD_847 = '120244239802000770';
const AD_LIBERTY_UNDERGROUND = '120244239800350770';

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

// Fetch image_hash from a specific ad's creative
async function getImageHashFromAd(adId: string): Promise<string> {
    const ad = await metaGet(`/${adId}`, {
        fields: 'creative{object_story_spec}',
    });
    const vd = ad?.creative?.object_story_spec?.video_data;
    if (vd?.image_hash) return vd.image_hash;
    throw new Error(`image_hash not found in ad ${adId}`);
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
        // ─── Resolve image hashes ──────────────────────────────────────────
        const hash847 = dryRun ? 'dry' : await run(`fetch image_hash from ad ${AD_847}`, () => getImageHashFromAd(AD_847));
        const hashLiberty = dryRun ? 'dry' : await run(`fetch image_hash from ad ${AD_LIBERTY_UNDERGROUND}`, () => getImageHashFromAd(AD_LIBERTY_UNDERGROUND));

        // ─── Pause old ads ──────────────────────────────────────────────────
        await write(`pause old RT Leads ad ${RT_LEADS_OLD_AD_ID}`, () =>
            metaPost(`/${RT_LEADS_OLD_AD_ID}`, { status: 'PAUSED' }),
        );
        await write(`pause old RT Followers ad ${RT_FOLLOWERS_OLD_AD_ID}`, () =>
            metaPost(`/${RT_FOLLOWERS_OLD_AD_ID}`, { status: 'PAUSED' }),
        );

        // ─── New creative + ad for RT Leads (847 Tours → /start) ───────────
        const leadsCreative = await write('create creative "RT Bold 847 — Talks Back"', () =>
            metaPost(`/${AD_ACCOUNT}/adcreatives`, {
                name: 'RT Bold 847 — Talks Back',
                object_story_spec: {
                    page_id: PAGE_ID,
                    video_data: {
                        video_id: VIDEO_847,
                        image_hash: hash847,
                        message: 'you already heard something about us. 847 walking tours exist in NYC. this is the only one that talks back. start a hunt — $9.99.',
                        call_to_action: {
                            type: 'LEARN_MORE',
                            value: { link: 'https://storyhunt.city/start' },
                        },
                    },
                },
            }),
        );
        const leadsCreativeId = leadsCreative?.id;

        const leadsAd = await write('create ad "RT Bold 847 — Talks Back"', () =>
            metaPost(`/${AD_ACCOUNT}/ads`, {
                name: 'RT Bold 847 — Talks Back',
                adset_id: RT_LEADS_ADSET_ID,
                creative: { creative_id: leadsCreativeId },
                status: 'ACTIVE',
            }),
        );

        // ─── New creative + ad for RT Followers (Liberty Underground → IG) ─
        const followersCreative = await write('create creative "RT Bold Liberty — Forget It"', () =>
            metaPost(`/${AD_ACCOUNT}/adcreatives`, {
                name: 'RT Bold Liberty — Forget It',
                object_story_spec: {
                    page_id: PAGE_ID,
                    video_data: {
                        video_id: VIDEO_LIBERTY_UNDERGROUND,
                        image_hash: hashLiberty,
                        message: 'you saw us once. still thinking about it. forget the statue of liberty — we post one real NYC secret every week. no ads, no fluff.',
                        call_to_action: {
                            type: 'LEARN_MORE',
                            value: { link: 'https://www.instagram.com/storyhunt.city/' },
                        },
                    },
                },
            }),
        );
        const followersCreativeId = followersCreative?.id;

        const followersAd = await write('create ad "RT Bold Liberty — Forget It"', () =>
            metaPost(`/${AD_ACCOUNT}/ads`, {
                name: 'RT Bold Liberty — Forget It',
                adset_id: RT_FOLLOWERS_ADSET_ID,
                creative: { creative_id: followersCreativeId },
                status: 'ACTIVE',
            }),
        );

        return NextResponse.json({
            ok: true,
            dry_run: dryRun,
            total_steps: step,
            new_leads_ad: leadsAd?.id,
            new_followers_ad: followersAd?.id,
            paused_ads: [RT_LEADS_OLD_AD_ID, RT_FOLLOWERS_OLD_AD_ID],
            log,
        });
    } catch (err: unknown) {
        return NextResponse.json({
            ok: false,
            failed_at_step: step,
            error: err instanceof Error ? err.message : String(err),
            log,
        }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    return POST(req);
}
