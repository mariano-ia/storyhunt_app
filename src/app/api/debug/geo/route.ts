import { NextRequest, NextResponse } from 'next/server';

// ─── GET /api/debug/geo ──────────────────────────────────────────────────────
// Returns Meta Ads insights broken down by country + region for each active
// campaign over the last N days. Diagnostic — remove when no longer needed.

const AD_ACCOUNT = 'act_1614086746553655';
const META_TOKEN = process.env.META_ADS_ACCESS_TOKEN || '';

async function fetchInsights(level: 'campaign' | 'adset', breakdown: 'country' | 'region', datePreset: string) {
    const url = new URL(`https://graph.facebook.com/v19.0/${AD_ACCOUNT}/insights`);
    url.searchParams.set('level', level);
    url.searchParams.set('breakdowns', breakdown);
    url.searchParams.set('date_preset', datePreset);
    url.searchParams.set('fields', 'campaign_name,adset_name,impressions,clicks,ctr,spend,actions');
    url.searchParams.set('limit', '200');
    url.searchParams.set('access_token', META_TOKEN);
    const res = await fetch(url.toString());
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Meta API ${res.status}: ${text}`);
    }
    const json = await res.json() as { data?: any[] };
    return json.data || [];
}

export async function GET(req: NextRequest) {
    const secret = req.nextUrl.searchParams.get('secret');
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    if (!META_TOKEN) {
        return NextResponse.json({ error: 'META_ADS_ACCESS_TOKEN not configured' }, { status: 500 });
    }

    const datePreset = req.nextUrl.searchParams.get('date_preset') || 'last_7d';

    try {
        const [byCountry, byRegion] = await Promise.all([
            fetchInsights('campaign', 'country', datePreset),
            fetchInsights('campaign', 'region', datePreset),
        ]);

        // Aggregate by country across all campaigns
        const countryTotals: Record<string, { impressions: number; clicks: number; spend: number; landingViews: number }> = {};
        for (const row of byCountry) {
            const c = row.country || 'unknown';
            if (!countryTotals[c]) countryTotals[c] = { impressions: 0, clicks: 0, spend: 0, landingViews: 0 };
            countryTotals[c].impressions += Number(row.impressions || 0);
            countryTotals[c].clicks += Number(row.clicks || 0);
            countryTotals[c].spend += Number(row.spend || 0);
            const lpv = (row.actions || []).find((a: any) => a.action_type === 'landing_page_view');
            countryTotals[c].landingViews += Number(lpv?.value || 0);
        }

        // Top regions (US state or equivalent)
        const regionTotals: Record<string, { impressions: number; clicks: number; spend: number; landingViews: number }> = {};
        for (const row of byRegion) {
            const r = row.region || 'unknown';
            if (!regionTotals[r]) regionTotals[r] = { impressions: 0, clicks: 0, spend: 0, landingViews: 0 };
            regionTotals[r].impressions += Number(row.impressions || 0);
            regionTotals[r].clicks += Number(row.clicks || 0);
            regionTotals[r].spend += Number(row.spend || 0);
            const lpv = (row.actions || []).find((a: any) => a.action_type === 'landing_page_view');
            regionTotals[r].landingViews += Number(lpv?.value || 0);
        }

        const topCountries = Object.entries(countryTotals)
            .map(([country, v]) => ({ country, ...v, cpc: v.clicks > 0 ? v.spend / v.clicks : 0 }))
            .sort((a, b) => b.impressions - a.impressions);

        const topRegions = Object.entries(regionTotals)
            .map(([region, v]) => ({ region, ...v, cpc: v.clicks > 0 ? v.spend / v.clicks : 0 }))
            .sort((a, b) => b.impressions - a.impressions)
            .slice(0, 20);

        return NextResponse.json({
            date_preset: datePreset,
            by_country: topCountries,
            top_regions: topRegions,
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error fetching geo insights';
        console.error('[debug/geo]', err);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
