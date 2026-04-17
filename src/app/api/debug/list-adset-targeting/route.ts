import { NextRequest, NextResponse } from 'next/server';
// ─── GET /api/debug/list-adset-targeting ─────────────────────────────────────
// Reports geo + audience targeting for each active ad set. CRON_SECRET.

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
        const adsetsRes = await metaGet(`/${AD_ACCOUNT}/adsets`, {
            fields: 'name,effective_status,campaign{name},targeting',
            limit: '200',
        });

        const out = (adsetsRes.data || [])
            .filter((a: any) => a.effective_status === 'ACTIVE')
            .map((a: any) => {
                const t = a.targeting || {};
                const geo = t.geo_locations || {};
                const customLocs = geo.custom_locations || [];
                const countries = geo.countries || [];
                const cities = (geo.cities || []).map((c: any) => c.name || c.key).join(', ');

                let geoSummary = '';
                if (customLocs.length) {
                    geoSummary = customLocs.map((l: any) =>
                        `${l.radius}${l.distance_unit} around ${l.latitude},${l.longitude}`,
                    ).join(' | ');
                } else if (countries.length) {
                    geoSummary = `countries: ${countries.join(',')}`;
                } else if (cities) {
                    geoSummary = `cities: ${cities}`;
                } else {
                    geoSummary = '⚠ NO GEO LIMIT';
                }

                return {
                    adset: a.name,
                    campaign: a.campaign?.name,
                    geo: geoSummary,
                    custom_audiences: (t.custom_audiences || []).map((x: any) => x.id),
                    excluded_audiences: (t.excluded_custom_audiences || []).map((x: any) => x.id),
                };
            });

        return NextResponse.json({ ok: true, total: out.length, adsets: out });
    } catch (err: unknown) {
        return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
}
