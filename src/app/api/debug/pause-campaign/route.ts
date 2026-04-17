import { NextRequest, NextResponse } from 'next/server';
// ─── POST /api/debug/pause-campaign?campaign_id=XXX ──────────────────────────
// Pauses a campaign (which cascades to all its ad sets and ads).
// Protected by CRON_SECRET.

const META_TOKEN = process.env.META_ADS_ACCESS_TOKEN || '';
const GRAPH = 'https://graph.facebook.com/v21.0';

export async function POST(req: NextRequest) {
    const secret = req.nextUrl.searchParams.get('secret');
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    if (!META_TOKEN) {
        return NextResponse.json({ error: 'META_ADS_ACCESS_TOKEN not set' }, { status: 500 });
    }

    const campaignId = req.nextUrl.searchParams.get('campaign_id');
    if (!campaignId) {
        return NextResponse.json({ error: 'campaign_id required' }, { status: 400 });
    }

    const url = new URL(`${GRAPH}/${campaignId}`);
    url.searchParams.set('access_token', META_TOKEN);
    const form = new URLSearchParams();
    form.append('status', 'PAUSED');

    const res = await fetch(url.toString(), { method: 'POST', body: form });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.error) {
        return NextResponse.json({ ok: false, error: json.error || json }, { status: 500 });
    }
    return NextResponse.json({ ok: true, campaign_id: campaignId, result: json });
}

export async function GET(req: NextRequest) {
    return POST(req);
}
