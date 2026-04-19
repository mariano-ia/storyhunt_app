import { NextRequest, NextResponse } from 'next/server';

const META_TOKEN = process.env.META_ADS_ACCESS_TOKEN || '';
const GRAPH = 'https://graph.facebook.com/v21.0';

export async function GET(req: NextRequest) {
    const secret = req.nextUrl.searchParams.get('secret');
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    const adsetId = req.nextUrl.searchParams.get('adset_id');
    const datePreset = req.nextUrl.searchParams.get('date_preset') || 'last_7d';
    if (!adsetId) return NextResponse.json({ error: 'adset_id required' }, { status: 400 });

    const url = new URL(`${GRAPH}/${adsetId}/insights`);
    url.searchParams.set('fields', 'spend,clicks,impressions,ctr');
    url.searchParams.set('breakdowns', 'country');
    url.searchParams.set('date_preset', datePreset);
    url.searchParams.set('access_token', META_TOKEN);
    const res = await fetch(url.toString());
    const json = await res.json();
    return NextResponse.json(json);
}
