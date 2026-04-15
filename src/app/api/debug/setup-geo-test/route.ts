import { NextRequest, NextResponse } from 'next/server';

// ─── POST /api/debug/setup-geo-test ──────────────────────────────────────────
// One-shot migration that restructures the Lead Magnets (3 ad sets) and
// Conversion V2 (5 ad sets) campaigns into a 3-way geo split:
//   _A  — US only
//   _B  — US + CA + GB + AU (international travel intent)
//   _C  — 25mi radius around Manhattan (NYC Locals)
//
// All edits preserve ad set IDs for reporting continuity. Same winning
// creatives are used across all 3 variants:
//   - Lead Magnets: Voicemail (14.85% CTR pre-test winner)
//   - Conversion:   Underground (only V2 video that actually delivered)
//
// Protected by ?secret=CRON_SECRET. Supports ?dry_run=1 to read current
// state without writing. Remove this file after the test is launched.

const META_TOKEN = process.env.META_ADS_ACCESS_TOKEN || '';
const AD_ACCOUNT = 'act_1614086746553655';
const GRAPH = 'https://graph.facebook.com/v19.0';

// Known ad set IDs
const LM_A_ID = '120243822503360770'; // was A3 Urban Explorers — becomes US-only
const LM_B_ID = '120243822495390770'; // was A1 Trip Planners — becomes US+INTL Travel Intent
const LM_C_ID = '120243822502980770'; // was A2 NYC Locals — becomes NYC Locals Pure

const CV_A_ID = '120244026413870770'; // was Conv V2 POV Walking × NYC Locals
const CV_B_ID = '120244026415720770'; // was Conv V2 Phone Cafe × NYC Locals
const CV_C_ID = '120244026416180770'; // was Conv V2 Underground × NYC Locals
const CV_HIDDEN_DOOR_ID = '120244026414800770';
const CV_COUPLE_ID = '120244026416670770';

// Budgets in cents (Meta expects daily_budget as string of minor currency units)
const LM_BUDGET = '500'; // $5/day
const CV_BUDGET = '700'; // $7/day

const GEO_US_ONLY = { countries: ['US'] };
const GEO_INTL = { countries: ['US', 'CA', 'GB', 'AU'] };
// NYC Locals (25mi Manhattan) targeting left untouched — whatever LM_C / CV_C
// currently have in geo_locations is already what we want.

type OpResult = { step: number; op: string; ok: boolean; result?: unknown; error?: string };

async function metaGet(path: string, params?: Record<string, string>): Promise<any> {
    const url = new URL(`${GRAPH}${path}`);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    url.searchParams.set('access_token', META_TOKEN);
    const res = await fetch(url.toString());
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.error) {
        throw new Error(`GET ${path}: ${JSON.stringify(json.error || json || res.statusText)}`);
    }
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
        // Retry transient errors up to 4 times with backoff
        if (attempt < 5 && (err.is_transient || err.code === 2 || err.code === 1 || err.code === 17)) {
            await new Promise(r => setTimeout(r, 1000 * attempt));
            return metaPost(path, body, attempt + 1);
        }
        throw new Error(`POST ${path}: ${JSON.stringify(err || json || res.statusText)}`);
    }
    return json;
}

export async function POST(req: NextRequest) {
    const secret = req.nextUrl.searchParams.get('secret');
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    if (!META_TOKEN) {
        return NextResponse.json({ error: 'META_ADS_ACCESS_TOKEN not configured' }, { status: 500 });
    }

    const dryRun = req.nextUrl.searchParams.get('dry_run') === '1';
    const log: OpResult[] = [];
    let step = 0;

    const run = async (op: string, fn: () => Promise<any>): Promise<any> => {
        step += 1;
        try {
            const result = await fn();
            log.push({ step, op, ok: true, result });
            return result;
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            log.push({ step, op, ok: false, error: message });
            throw err;
        }
    };

    const runSkippable = async (op: string, fn: () => Promise<any>): Promise<any> => {
        step += 1;
        try {
            const result = await fn();
            log.push({ step, op, ok: true, result });
            return result;
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            log.push({ step, op: `${op} (non-fatal)`, ok: false, error: message });
            return null;
        }
    };

    const write = async (op: string, fn: () => Promise<any>): Promise<any> => {
        if (dryRun) {
            step += 1;
            log.push({ step, op: `[dry-run] ${op}`, ok: true });
            return null;
        }
        return run(op, fn);
    };

    try {
        // ─── PHASE 1: READ current state ────────────────────────────────────────

        // Read all 6 ad sets' current targeting and budget
        const adSetFields = 'name,targeting,daily_budget,status,campaign_id';
        const lmA = await run('read LM_A ad set', () => metaGet(`/${LM_A_ID}`, { fields: adSetFields }));
        const lmB = await run('read LM_B ad set', () => metaGet(`/${LM_B_ID}`, { fields: adSetFields }));
        const lmC = await run('read LM_C ad set', () => metaGet(`/${LM_C_ID}`, { fields: adSetFields }));
        const cvA = await run('read CV_A ad set', () => metaGet(`/${CV_A_ID}`, { fields: adSetFields }));
        const cvB = await run('read CV_B ad set', () => metaGet(`/${CV_B_ID}`, { fields: adSetFields }));
        const cvC = await run('read CV_C ad set', () => metaGet(`/${CV_C_ID}`, { fields: adSetFields }));

        // Read the ads in each ad set to find creative IDs we'll reuse
        const adFields = 'id,name,status,creative{id,name}';
        const lmAAdsResp = await run('read LM_A ads', () => metaGet(`/${LM_A_ID}/ads`, { fields: adFields, limit: '50' }));
        const lmBAdsResp = await run('read LM_B ads', () => metaGet(`/${LM_B_ID}/ads`, { fields: adFields, limit: '50' }));
        const lmCAdsResp = await run('read LM_C ads', () => metaGet(`/${LM_C_ID}/ads`, { fields: adFields, limit: '50' }));
        const cvAAdsResp = await run('read CV_A ads', () => metaGet(`/${CV_A_ID}/ads`, { fields: adFields, limit: '50' }));
        const cvBAdsResp = await run('read CV_B ads', () => metaGet(`/${CV_B_ID}/ads`, { fields: adFields, limit: '50' }));
        const cvCAdsResp = await run('read CV_C ads', () => metaGet(`/${CV_C_ID}/ads`, { fields: adFields, limit: '50' }));

        const lmAAds: any[] = lmAAdsResp.data || [];
        const lmBAds: any[] = lmBAdsResp.data || [];
        const lmCAds: any[] = lmCAdsResp.data || [];
        const cvAAds: any[] = cvAAdsResp.data || [];
        const cvBAds: any[] = cvBAdsResp.data || [];
        const cvCAds: any[] = cvCAdsResp.data || [];

        // The winning creatives — find them by name in their home ad sets
        const voicemailAd = lmAAds.find((a: any) => /voicemail/i.test(a.name || '')) || lmAAds[0];
        if (!voicemailAd?.creative?.id) {
            throw new Error(`Could not find Voicemail creative in LM_A. Ads: ${lmAAds.map((a: any) => a.name).join(', ')}`);
        }
        const VOICEMAIL_CREATIVE_ID: string = voicemailAd.creative.id;
        log.push({ step: ++step, op: `resolved Voicemail creative_id = ${VOICEMAIL_CREATIVE_ID}`, ok: true });

        const undergroundAd = cvCAds.find((a: any) => /underground/i.test(a.name || '')) || cvCAds[0];
        if (!undergroundAd?.creative?.id) {
            throw new Error(`Could not find Underground creative in CV_C. Ads: ${cvCAds.map((a: any) => a.name).join(', ')}`);
        }
        const UNDERGROUND_CREATIVE_ID: string = undergroundAd.creative.id;
        log.push({ step: ++step, op: `resolved Underground creative_id = ${UNDERGROUND_CREATIVE_ID}`, ok: true });

        // Helper: build a modified targeting object with a new geo_locations
        const withGeo = (targeting: any, geo: any): any => {
            return { ...targeting, geo_locations: geo };
        };

        // ─── PHASE 2: EDIT Lead Magnets ad sets ─────────────────────────────────

        // LM_A: rename + change geo to US-only. Keep existing interests/behaviors.
        await write(`rename + geo-update LM_A → "LM_A — US Northeast Intensive"`, () =>
            metaPost(`/${LM_A_ID}`, {
                name: 'LM_A — US Northeast Intensive',
                targeting: withGeo(lmA.targeting, GEO_US_ONLY),
                daily_budget: LM_BUDGET,
            }),
        );

        // LM_B: rename only. Targeting already US+UK+CA+AU which is what LM_B needs.
        await write(`rename LM_B → "LM_B — US+INTL Travel Intent"`, () =>
            metaPost(`/${LM_B_ID}`, {
                name: 'LM_B — US+INTL Travel Intent',
                daily_budget: LM_BUDGET,
            }),
        );

        // LM_C: rename only. Targeting is already 25mi Manhattan which is what LM_C needs.
        await write(`rename LM_C → "LM_C — NYC Locals Pure"`, () =>
            metaPost(`/${LM_C_ID}`, {
                name: 'LM_C — NYC Locals Pure',
                daily_budget: LM_BUDGET,
            }),
        );

        // ─── PHASE 3: Swap creative in LM_B and LM_C to Voicemail ──────────────

        // Idempotent: pause every ad in the ad set that doesn't already use the
        // target creative, then create a new ad only if none exists for that creative.
        const reconcileAds = async (
            adSetName: string,
            adSetId: string,
            existingAds: any[],
            targetCreativeId: string,
            newAdName: string,
        ) => {
            const existingWithTarget = existingAds.find(
                (a: any) => a.creative?.id === targetCreativeId,
            );
            for (const ad of existingAds) {
                if (ad.creative?.id === targetCreativeId) {
                    if (ad.status !== 'ACTIVE') {
                        await write(`re-activate ${adSetName} target ad ${ad.id}`, () =>
                            metaPost(`/${ad.id}`, { status: 'ACTIVE' }),
                        );
                    }
                    continue;
                }
                if (ad.status !== 'PAUSED') {
                    await write(`pause old ${adSetName} ad ${ad.id} (${ad.name})`, () =>
                        metaPost(`/${ad.id}`, { status: 'PAUSED' }),
                    );
                }
            }
            if (!existingWithTarget) {
                await write(`create new ${adSetName} ad → ${newAdName}`, () =>
                    metaPost(`/${AD_ACCOUNT}/ads`, {
                        name: newAdName,
                        adset_id: adSetId,
                        creative: { creative_id: targetCreativeId },
                        status: 'ACTIVE',
                    }),
                );
            } else {
                log.push({ step: ++step, op: `${adSetName} already has target ad ${existingWithTarget.id} — skip create`, ok: true });
            }
        };

        // LM_A: already has Voicemail ad. Ensure nothing else is active there.
        await reconcileAds('LM_A', LM_A_ID, lmAAds, VOICEMAIL_CREATIVE_ID, 'LM_A — Voicemail × US Northeast Intensive');
        // LM_B: had Secrets ad. Pause it, create Voicemail ad.
        await reconcileAds('LM_B', LM_B_ID, lmBAds, VOICEMAIL_CREATIVE_ID, 'LM_B — Voicemail × US+INTL Travel Intent');
        // LM_C: had Intercepted ad. Pause it, create Voicemail ad.
        await reconcileAds('LM_C', LM_C_ID, lmCAds, VOICEMAIL_CREATIVE_ID, 'LM_C — Voicemail × NYC Locals Pure');

        // ─── PHASE 4: EDIT Conversion V2 ad sets ───────────────────────────────

        // CV_A: rename + geo US-only + budget bump
        await write(`rename + geo-update CV_A → "CV_A — US Northeast Intensive"`, () =>
            metaPost(`/${CV_A_ID}`, {
                name: 'CV_A — US Northeast Intensive',
                targeting: withGeo(cvA.targeting, GEO_US_ONLY),
                daily_budget: CV_BUDGET,
            }),
        );

        // CV_B: rename + geo US+INTL + budget bump
        await write(`rename + geo-update CV_B → "CV_B — US+INTL Travel Intent"`, () =>
            metaPost(`/${CV_B_ID}`, {
                name: 'CV_B — US+INTL Travel Intent',
                targeting: withGeo(cvB.targeting, GEO_INTL),
                daily_budget: CV_BUDGET,
            }),
        );

        // CV_C: rename only + budget bump (geo already NYC Locals)
        await write(`rename CV_C → "CV_C — NYC Locals Pure"`, () =>
            metaPost(`/${CV_C_ID}`, {
                name: 'CV_C — NYC Locals Pure',
                daily_budget: CV_BUDGET,
            }),
        );

        // ─── PHASE 5: Swap creative in CV_A and CV_B to Underground ────────────

        // CV_A: had POV Walking. Pause, create Underground ad.
        await reconcileAds('CV_A', CV_A_ID, cvAAds, UNDERGROUND_CREATIVE_ID, 'CV_A — Underground × US Northeast Intensive');
        // CV_B: had Phone Cafe. Pause, create Underground ad.
        await reconcileAds('CV_B', CV_B_ID, cvBAds, UNDERGROUND_CREATIVE_ID, 'CV_B — Underground × US+INTL Travel Intent');
        // CV_C: already has Underground ad. Keep as-is.
        await reconcileAds('CV_C', CV_C_ID, cvCAds, UNDERGROUND_CREATIVE_ID, 'CV_C — Underground × NYC Locals Pure');

        // ─── PHASE 6: Pause the 2 ad sets we're not using ──────────────────────

        await write(`pause ad set Hidden Door (${CV_HIDDEN_DOOR_ID})`, () =>
            metaPost(`/${CV_HIDDEN_DOOR_ID}`, { status: 'PAUSED' }),
        );
        await write(`pause ad set Couple (${CV_COUPLE_ID})`, () =>
            metaPost(`/${CV_COUPLE_ID}`, { status: 'PAUSED' }),
        );

        return NextResponse.json({
            ok: true,
            dry_run: dryRun,
            total_steps: step,
            voicemail_creative_id: VOICEMAIL_CREATIVE_ID,
            underground_creative_id: UNDERGROUND_CREATIVE_ID,
            current_state: {
                lm_a: { name: lmA.name, status: lmA.status, daily_budget: lmA.daily_budget, ads: lmAAds.map((a: any) => ({ id: a.id, name: a.name, status: a.status })) },
                lm_b: { name: lmB.name, status: lmB.status, daily_budget: lmB.daily_budget, ads: lmBAds.map((a: any) => ({ id: a.id, name: a.name, status: a.status })) },
                lm_c: { name: lmC.name, status: lmC.status, daily_budget: lmC.daily_budget, ads: lmCAds.map((a: any) => ({ id: a.id, name: a.name, status: a.status })) },
                cv_a: { name: cvA.name, status: cvA.status, daily_budget: cvA.daily_budget, ads: cvAAds.map((a: any) => ({ id: a.id, name: a.name, status: a.status })) },
                cv_b: { name: cvB.name, status: cvB.status, daily_budget: cvB.daily_budget, ads: cvBAds.map((a: any) => ({ id: a.id, name: a.name, status: a.status })) },
                cv_c: { name: cvC.name, status: cvC.status, daily_budget: cvC.daily_budget, ads: cvCAds.map((a: any) => ({ id: a.id, name: a.name, status: a.status })) },
            },
            log,
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ ok: false, dry_run: dryRun, failed_at_step: step, error: message, log }, { status: 500 });
    }
}

// GET alias so it's easier to trigger dry-run from a browser
export async function GET(req: NextRequest) {
    return POST(req);
}
