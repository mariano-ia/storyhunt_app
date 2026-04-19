import { NextRequest, NextResponse } from 'next/server';
// One-shot budget rebalance 2026-04-19:
//   - Pause "StoryHunt IG Followers — NYC" campaign (-$15/day, cold)
//   - Bump LM_C ad set to $15/day (+$8/day on working cold lead funnel)
// Net: $40/day unchanged, reallocated from non-performer to new winner.

const META_TOKEN = process.env.META_ADS_ACCESS_TOKEN || '';
const GRAPH = 'https://graph.facebook.com/v21.0';

const IG_FOLLOWERS_COLD_CAMPAIGN = '120244174034890770';
const LM_C_ADSET = '120243822502980770';

async function metaPost(path: string, body: Record<string, unknown>): Promise<any> {
    const url = new URL(`${GRAPH}${path}`);
    url.searchParams.set('access_token', META_TOKEN);
    const form = new URLSearchParams();
    for (const [k, v] of Object.entries(body)) {
        if (v === undefined || v === null) continue;
        form.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
    }
    const res = await fetch(url.toString(), { method: 'POST', body: form });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.error) throw new Error(JSON.stringify(json.error || json));
    return json;
}

export async function POST(req: NextRequest) {
    const secret = req.nextUrl.searchParams.get('secret');
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const log: any[] = [];
    try {
        log.push({ op: `pause IG Followers cold campaign ${IG_FOLLOWERS_COLD_CAMPAIGN}`, result: await metaPost(`/${IG_FOLLOWERS_COLD_CAMPAIGN}`, { status: 'PAUSED' }) });
        log.push({ op: `bump LM_C ad set to $15/day`, result: await metaPost(`/${LM_C_ADSET}`, { daily_budget: '1500' }) });
        return NextResponse.json({ ok: true, log });
    } catch (err: unknown) {
        return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err), log }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    return POST(req);
}
