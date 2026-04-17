import { NextRequest, NextResponse } from 'next/server';
// ─── GET /api/debug/list-active-creatives ────────────────────────────────────
// Returns all currently ACTIVE ads across all campaigns with their creative
// info (image_hash or video_id) mapped to known source filenames.

const META_TOKEN = process.env.META_ADS_ACCESS_TOKEN || '';
const AD_ACCOUNT = 'act_1614086746553655';
const GRAPH = 'https://graph.facebook.com/v21.0';

// Known mappings from Meta hashes/IDs to source filenames
const IMAGE_HASH_TO_FILE: Record<string, string> = {
    '679eddb707276bf642aeb34bda419f51': 'ad-voicemail.png',
    '82f8d04c5e9786b076586148d47dc09b': 'ad-secrets.png',
    '847cfd6ce4f233fea0529a53b27720e7': 'ad-intercepted.png',
    'a5b5cf8fe5fd31f9be0af98fe1189280': 'thumb-subway.jpg (thumbnail of reel-subway-raw.mp4)',
};

const VIDEO_ID_TO_FILE: Record<string, string> = {
    '958391193508563': 'reel-alley-raw.mp4 (NYC alley symbol — organic IG)',
    '972550711977782': 'reel-subway-raw.mp4 (subway mosaic — organic IG)',
    '1241888431259033': 'conv-pov-walking-final.mp4',
    '844570481255121': 'conv-hidden-door-final.mp4',
    '1294511489450670': 'conv-phone-cafe-final.mp4',
    '823616333543888': 'conv-underground-final.mp4',
    '1296543332436441': 'conv-couple-final.mp4',
};

async function metaGet(path: string, params?: Record<string, string>): Promise<any> {
    const url = new URL(`${GRAPH}${path}`);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    url.searchParams.set('access_token', META_TOKEN);
    const res = await fetch(url.toString());
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.error) throw new Error(`GET ${path}: ${JSON.stringify(json.error || json)}`);
    return json;
}

export async function GET(req: NextRequest) {
    const secret = req.nextUrl.searchParams.get('secret');
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    if (!META_TOKEN) {
        return NextResponse.json({ error: 'META_ADS_ACCESS_TOKEN not set' }, { status: 500 });
    }

    try {
        // Get all campaigns
        const campaignsRes = await metaGet(`/${AD_ACCOUNT}/campaigns`, {
            fields: 'name,effective_status,objective',
            limit: '100',
        });

        const campaigns = campaignsRes.data || [];
        const activeAds: any[] = [];

        for (const c of campaigns) {
            if (c.effective_status !== 'ACTIVE') continue;
            // Get all ads in this campaign
            const adsRes = await metaGet(`/${c.id}/ads`, {
                fields: 'name,effective_status,adset{name,daily_budget},creative{name,object_story_spec,image_hash,video_id}',
                limit: '100',
            });
            for (const ad of adsRes.data || []) {
                if (ad.effective_status !== 'ACTIVE') continue;
                const creative = ad.creative || {};
                const oss = creative.object_story_spec || {};
                const linkData = oss.link_data || {};
                const videoData = oss.video_data || {};
                const imageHash = creative.image_hash || linkData.image_hash || videoData.image_hash;
                const videoId = creative.video_id || videoData.video_id;

                const sourceFile = videoId
                    ? VIDEO_ID_TO_FILE[videoId] || `unknown video_id: ${videoId}`
                    : imageHash
                        ? IMAGE_HASH_TO_FILE[imageHash] || `unknown image_hash: ${imageHash}`
                        : 'NO CREATIVE INFO';

                activeAds.push({
                    campaign: c.name,
                    campaign_id: c.id,
                    ad_name: ad.name,
                    ad_id: ad.id,
                    ad_set: ad.adset?.name,
                    daily_budget: ad.adset?.daily_budget ? `$${(parseInt(ad.adset.daily_budget) / 100).toFixed(2)}/day` : '?',
                    source_file: sourceFile,
                    link: linkData.link || videoData.call_to_action?.value?.link || '(no link)',
                    copy: linkData.message || videoData.message || '(no copy)',
                });
            }
        }

        return NextResponse.json({
            ok: true,
            total_active_ads: activeAds.length,
            ads: activeAds,
        });
    } catch (err: unknown) {
        return NextResponse.json({
            ok: false,
            error: err instanceof Error ? err.message : String(err),
        }, { status: 500 });
    }
}
