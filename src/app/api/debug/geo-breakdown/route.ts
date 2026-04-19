import { NextRequest, NextResponse } from 'next/server';
// ─── GET /api/debug/geo-breakdown ────────────────────────────────────────────
// Pulls ad-delivery breakdown by region + country for every ACTIVE campaign.
// Answers: are we actually respecting the NYC 25mi geo, or is Meta spilling?

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

    const datePreset = req.nextUrl.searchParams.get('date_preset') || 'maximum';
    try {
        const campaignsRes = await metaGet(`/${AD_ACCOUNT}/campaigns`, {
            fields: 'name,effective_status',
            limit: '100',
        });

        const campaigns = (campaignsRes.data || []).filter(
            (c: any) => c.effective_status === 'ACTIVE',
        );

        const results = await Promise.all(campaigns.map(async (c: any) => {
            const [byRegion, byCountry, totalRow] = await Promise.all([
                metaGet(`/${c.id}/insights`, {
                    fields: 'spend,impressions,clicks,ctr',
                    breakdowns: 'region',
                    date_preset: datePreset,
                    limit: '50',
                }).catch(() => ({ data: [] })),
                metaGet(`/${c.id}/insights`, {
                    fields: 'spend,impressions,clicks,ctr',
                    breakdowns: 'country',
                    date_preset: datePreset,
                    limit: '50',
                }).catch(() => ({ data: [] })),
                metaGet(`/${c.id}/insights`, {
                    fields: 'spend,impressions,clicks,ctr',
                    date_preset: datePreset,
                }).catch(() => ({ data: [] })),
            ]);

            const total = totalRow.data?.[0] || {};
            const totalSpend = parseFloat(total.spend || '0');
            const totalImpr = parseInt(total.impressions || '0');

            const regions = (byRegion.data || []).map((r: any) => ({
                region: r.region,
                spend: parseFloat(r.spend || '0'),
                impressions: parseInt(r.impressions || '0'),
                clicks: parseInt(r.clicks || '0'),
                pct_spend: totalSpend > 0 ? ((parseFloat(r.spend) / totalSpend) * 100).toFixed(1) + '%' : '0%',
                pct_impr: totalImpr > 0 ? ((parseInt(r.impressions) / totalImpr) * 100).toFixed(1) + '%' : '0%',
            })).sort((a: any, b: any) => b.spend - a.spend);

            const countries = (byCountry.data || []).map((r: any) => ({
                country: r.country,
                spend: parseFloat(r.spend || '0'),
                impressions: parseInt(r.impressions || '0'),
                clicks: parseInt(r.clicks || '0'),
                pct_spend: totalSpend > 0 ? ((parseFloat(r.spend) / totalSpend) * 100).toFixed(1) + '%' : '0%',
            })).sort((a: any, b: any) => b.spend - a.spend);

            return {
                campaign: c.name,
                campaign_id: c.id,
                total: { spend: totalSpend, impressions: totalImpr, clicks: parseInt(total.clicks || '0') },
                by_country: countries,
                by_region_top10: regions.slice(0, 10),
            };
        }));

        return NextResponse.json({ ok: true, campaigns: results });
    } catch (err: unknown) {
        return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
}
