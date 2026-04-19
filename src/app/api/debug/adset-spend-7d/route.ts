import { NextRequest, NextResponse } from 'next/server';
// Lists every ad set that spent money in the last 7d with its current status
// and geo, no matter whether it's ACTIVE/PAUSED/ARCHIVED/etc.

const META_TOKEN = process.env.META_ADS_ACCESS_TOKEN || '';
const AD_ACCOUNT = 'act_1614086746553655';
const GRAPH = 'https://graph.facebook.com/v21.0';

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

    try {
        // Get insights at adset level for last 7d
        const insights = await metaGet(`/${AD_ACCOUNT}/insights`, {
            level: 'adset',
            fields: 'adset_id,adset_name,campaign_name,spend,impressions,clicks',
            date_preset: 'last_7d',
            limit: '200',
        });

        const rows = insights.data || [];
        // For each adset with spend, fetch its current status + targeting
        const enriched = await Promise.all(rows.map(async (r: any) => {
            const adset = await metaGet(`/${r.adset_id}`, {
                fields: 'status,effective_status,targeting',
            }).catch(() => ({}));

            const t = adset.targeting || {};
            const geo = t.geo_locations || {};
            const customLocs = geo.custom_locations || [];
            const countries = geo.countries || [];
            const cities = (geo.cities || []).map((c: any) => c.name).join(', ');

            let geoSummary = '';
            if (customLocs.length) {
                geoSummary = customLocs.map((l: any) => `${l.radius}${l.distance_unit}@${l.latitude},${l.longitude}`).join('|');
            } else if (countries.length) {
                geoSummary = `countries: ${countries.join(',')}`;
            } else if (cities) {
                geoSummary = `cities: ${cities}`;
            } else {
                geoSummary = '⚠ NO GEO LIMIT';
            }

            return {
                adset_name: r.adset_name,
                adset_id: r.adset_id,
                campaign: r.campaign_name,
                spend_7d: parseFloat(r.spend || '0'),
                clicks_7d: parseInt(r.clicks || '0'),
                impressions_7d: parseInt(r.impressions || '0'),
                status: adset.status,
                effective_status: adset.effective_status,
                geo: geoSummary,
            };
        }));

        enriched.sort((a, b) => b.spend_7d - a.spend_7d);

        return NextResponse.json({ ok: true, adsets: enriched });
    } catch (err: unknown) {
        return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
}
