import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const CRON_SECRET = process.env.CRON_SECRET || '';
const NOTIFICATION_EMAIL = process.env.NOTIFICATION_EMAIL || '';

// Accept either env var name. Vercel/.env.local use META_ADS_TOKEN; the original
// code read META_ADS_ACCESS_TOKEN (which was never set → cron returned "not configured").
const META_TOKEN = process.env.META_ADS_ACCESS_TOKEN || process.env.META_ADS_TOKEN || '';
// Report at the AD ACCOUNT level so it always covers whatever campaigns are LIVE.
// (The old code hard-coded a single campaign ID that went stale the moment that
// campaign was paused — the report then showed an empty/dead campaign.)
const AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID || 'act_1614086746553655';
const GRAPH = 'https://graph.facebook.com/v21.0';

// ─── GET /api/cron/campaign-report ──────────────────────────────────────────
// Runs daily at 9 AM NYC. Pulls live Meta account metrics (today / 7d / lifetime)
// and emails a report. Always reflects whatever is actually delivering.

type MetaAction = { action_type: string; value: string };

type InsightData = {
  ad_name?: string;
  campaign_name?: string;
  impressions: string;
  reach?: string;
  clicks: string;
  ctr: string;
  cpc: string;
  spend: string;
  actions?: MetaAction[];
  cost_per_action_type?: MetaAction[];
};

async function fetchInsights(level: 'account' | 'campaign' | 'ad', datePreset: string): Promise<InsightData[]> {
  const nameField = level === 'ad' ? 'ad_name' : level === 'campaign' ? 'campaign_name' : '';
  const fields = [nameField, 'impressions', 'reach', 'clicks', 'ctr', 'cpc', 'spend', 'actions', 'cost_per_action_type']
    .filter(Boolean)
    .join(',');

  const url = `${GRAPH}/${AD_ACCOUNT_ID}/insights?fields=${fields}&level=${level}&date_preset=${datePreset}&limit=200&access_token=${META_TOKEN}`;
  const res = await fetch(url);
  const json = await res.json();
  if (json.error) {
    console.error('Meta insights error:', json.error.message);
    return [];
  }
  return json.data || [];
}

// First matching action type wins (avoids double-counting omni vs pixel purchases).
function actionValue(actions: MetaAction[] | undefined, ...types: string[]): number {
  for (const type of types) {
    const hit = actions?.find(a => a.action_type === type);
    if (hit) return parseInt(hit.value) || 0;
  }
  return 0;
}

function purchases(row?: InsightData): number {
  return actionValue(row?.actions, 'purchase', 'omni_purchase', 'offsite_conversion.fb_pixel_purchase', 'onsite_web_purchase');
}

const metricBox = (label: string, value: string, color = '#fff') => `
  <td style="padding:14px 8px;text-align:center">
    <div style="font-family:'Fira Code',monospace;font-size:10px;color:#64748b;letter-spacing:0.05em;margin-bottom:6px">${label}</div>
    <div style="font-size:22px;font-weight:700;color:${color}">${value}</div>
  </td>`;

function totalsBlock(label: string, labelColor: string, row?: InsightData): string {
  if (!row) return `<div style="margin-bottom:28px"><div style="font-family:'Fira Code',monospace;font-size:12px;color:${labelColor};margin-bottom:12px">${label}</div><p style="color:#64748b;font-size:13px">No data.</p></div>`;
  const cv = purchases(row);
  const spend = parseFloat(row.spend) || 0;
  const cpp = cv > 0 ? '$' + (spend / cv).toFixed(2) : '—';
  return `
    <div style="margin-bottom:28px">
      <div style="font-family:'Fira Code',monospace;font-size:12px;color:${labelColor};letter-spacing:0.05em;margin-bottom:12px">${label}</div>
      <table style="width:100%;border-collapse:collapse">
        <tr>
          ${metricBox('SPEND', '$' + spend.toFixed(2), '#ff0033')}
          ${metricBox('IMPRESSIONS', parseInt(row.impressions).toLocaleString())}
          ${metricBox('LINK CLICKS', actionValue(row.actions, 'link_click').toLocaleString(), '#00d2ff')}
          ${metricBox('CTR', parseFloat(row.ctr).toFixed(1) + '%')}
        </tr>
        <tr>
          ${metricBox('LANDING VIEWS', actionValue(row.actions, 'landing_page_view').toLocaleString())}
          ${metricBox('CPC', '$' + parseFloat(row.cpc).toFixed(3))}
          ${metricBox('PURCHASES', String(cv), cv > 0 ? '#22c55e' : '#64748b')}
          ${metricBox('COST / PURCHASE', cpp, cv > 0 ? '#22c55e' : '#64748b')}
        </tr>
      </table>
    </div>`;
}

function buildReportHtml(today?: InsightData, last7?: InsightData, lifetime?: InsightData, last7Ads: InsightData[] = []): string {
  const tableHeader = `
    <tr>
      ${['Ad', 'Impr', 'Clicks', 'CTR', 'CPC', 'Views', 'Buys', 'Spend'].map((h, i) => `
        <th style="padding:8px 10px;text-align:${i === 0 ? 'left' : 'right'};color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;border-bottom:2px solid #1a1a2e">${h}</th>`).join('')}
    </tr>`;

  const adRows = last7Ads
    .filter(a => parseInt(a.impressions) > 0)
    .sort((a, b) => parseFloat(b.spend) - parseFloat(a.spend))
    .slice(0, 12)
    .map(ad => {
      const cv = purchases(ad);
      return `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid #1a1a2e;color:#e0e0e0;font-size:12px">${ad.ad_name || '—'}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #1a1a2e;color:#fff;text-align:right">${parseInt(ad.impressions).toLocaleString()}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #1a1a2e;color:#00d2ff;text-align:right">${actionValue(ad.actions, 'link_click')}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #1a1a2e;color:#fff;text-align:right">${parseFloat(ad.ctr).toFixed(1)}%</td>
        <td style="padding:8px 10px;border-bottom:1px solid #1a1a2e;color:#fff;text-align:right">$${parseFloat(ad.cpc).toFixed(3)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #1a1a2e;color:#fff;text-align:right">${actionValue(ad.actions, 'landing_page_view')}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #1a1a2e;color:${cv > 0 ? '#22c55e' : '#374151'};text-align:right">${cv}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #1a1a2e;color:#ff0033;text-align:right">$${parseFloat(ad.spend).toFixed(2)}</td>
      </tr>`;
    }).join('');

  return `
    <div style="background:#0a0a0f;color:#fff;font-family:'Fira Sans',Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto;padding:32px 24px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:32px">
        <div>
          <div style="font-family:'Fira Code',monospace;font-size:12px;color:#ff0033;letter-spacing:0.08em;margin-bottom:4px">CAMPAIGN_REPORT</div>
          <div style="font-size:20px;font-weight:700">StoryHunt — All Live Campaigns</div>
        </div>
        <div style="font-family:'Fira Code',monospace;font-size:12px;color:#64748b">${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
      </div>

      ${totalsBlock('TODAY', '#00d2ff', today)}
      ${totalsBlock('LAST 7 DAYS', '#a855f7', last7)}

      <div style="margin-bottom:28px">
        <div style="font-family:'Fira Code',monospace;font-size:12px;color:#a855f7;letter-spacing:0.05em;margin-bottom:12px">LAST 7 DAYS — TOP ADS BY SPEND</div>
        <table style="width:100%;border-collapse:collapse">${tableHeader}${adRows || `<tr><td colspan="8" style="padding:12px;color:#64748b;font-size:13px">No delivering ads in the last 7 days.</td></tr>`}</table>
      </div>

      ${totalsBlock('LIFETIME', '#ff0033', lifetime)}

      <div style="border-top:1px solid #1a1a2e;padding-top:20px;font-family:'Fira Code',monospace;font-size:11px;color:#374151;text-align:center">
        StoryHunt Campaign Report — account-level, auto-generated
      </div>
    </div>
  `;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!META_TOKEN) {
    return NextResponse.json({ error: 'Meta token not configured (set META_ADS_TOKEN or META_ADS_ACCESS_TOKEN)' }, { status: 500 });
  }

  try {
    const [today, last7, lifetime, last7Ads] = await Promise.all([
      fetchInsights('account', 'today'),
      fetchInsights('account', 'last_7d'),
      fetchInsights('account', 'maximum'),
      fetchInsights('ad', 'last_7d'),
    ]);

    const html = buildReportHtml(today[0], last7[0], lifetime[0], last7Ads);

    if (resend && NOTIFICATION_EMAIL) {
      await resend.emails.send({
        from: 'StoryHunt <hello@storyhunt.city>',
        to: NOTIFICATION_EMAIL,
        subject: `Campaign Report — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        html,
      });
    }

    return NextResponse.json({
      success: true,
      account: AD_ACCOUNT_ID,
      today: today[0] || null,
      last7: last7[0] || null,
      lifetime: lifetime[0] || null,
      last7Ads: last7Ads.length,
      purchases7d: purchases(last7[0]),
      emailSent: !!(resend && NOTIFICATION_EMAIL),
    });
  } catch (error) {
    console.error('Campaign report error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
