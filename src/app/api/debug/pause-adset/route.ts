import { NextRequest, NextResponse } from 'next/server';

const META_TOKEN = process.env.META_ADS_ACCESS_TOKEN || '';
const GRAPH = 'https://graph.facebook.com/v21.0';

export async function POST(req: NextRequest) {
    const secret = req.nextUrl.searchParams.get('secret');
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    const adsetId = req.nextUrl.searchParams.get('adset_id');
    if (!adsetId) return NextResponse.json({ error: 'adset_id required' }, { status: 400 });

    const url = new URL(`${GRAPH}/${adsetId}`);
    url.searchParams.set('access_token', META_TOKEN);
    const form = new URLSearchParams();
    form.append('status', 'PAUSED');
    const res = await fetch(url.toString(), { method: 'POST', body: form });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.error) {
        return NextResponse.json({ ok: false, error: json.error || json }, { status: 500 });
    }
    return NextResponse.json({ ok: true, result: json });
}

export async function GET(req: NextRequest) {
    return POST(req);
}
