import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const CRON_SECRET = process.env.CRON_SECRET || '';
const NOTIFICATION_EMAIL = process.env.NOTIFICATION_EMAIL || '';
const META_TOKEN = process.env.META_ADS_ACCESS_TOKEN || '';
const CAMPAIGN_ID = '120243822478790770';

// ─── GET /api/cron/campaign-report ──────────────────────────────────────────
// Runs daily at 9 AM NYC. Pulls Meta campaign metrics and emails a report.

type MetaAction = { action_type: string; value: string };
type MetaCostAction = { action_type: string; value: string };

type InsightData = {
  ad_name?: string;
  adset_name?: string;
  impressions: string;
  reach: string;
  clicks: string;
  ctr: string;
  cpc: string;
  spend: string;
  actions?: MetaAction[];
  cost_per_action_type?: MetaCostAction[];
};

async function fetchInsights(level: string, datePreset: string): Promise<InsightData[]> {
  const fields = level === 'campaign'
    ? 'impressions,reach,clicks,ctr,spend,actions,cost_per_action_type,cpc'
    : `${level === 'ad' ? 'ad_name' : 'adset_name'},impressions,reach,clicks,ctr,spend,actions,cpc`;

  const url = `https://graph.facebook.com/v21.0/${CAMPAIGN_ID}/insights?fields=${fields}&level=${level}&date_preset=${datePreset}&access_token=${META_TOKEN}`;
  const res = await fetch(url);
  const json = await res.json();
  return json.data || [];
}

function getAction(actions: MetaAction[] | undefined, type: string): string {
  return actions?.find(a => a.action_type === type)?.value || '0';
}

function getCostAction(costs: MetaCostAction[] | undefined, type: string): string {
  const val = costs?.find(a => a.action_type === type)?.value;
  return val ? `$${parseFloat(val).toFixed(2)}` : '—';
}

function buildReportHtml(
  today: InsightData[],
  todayAds: InsightData[],
  lifetime: InsightData[],
  lifetimeAds: InsightData[],
): string {
  const t = today[0];
  const l = lifetime[0];

  const adRows = (ads: InsightData[]) => ads
    .sort((a, b) => parseFloat(b.ctr) - parseFloat(a.ctr))
    .map(ad => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #1a1a2e;color:#e0e0e0;font-size:13px">${ad.ad_name || '—'}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #1a1a2e;color:#fff;text-align:right">${parseInt(ad.impressions).toLocaleString()}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #1a1a2e;color:#00d2ff;text-align:right">${getAction(ad.actions, 'link_click')}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #1a1a2e;color:#fff;text-align:right">${parseFloat(ad.ctr).toFixed(1)}%</td>
        <td style="padding:8px 12px;border-bottom:1px solid #1a1a2e;color:#fff;text-align:right">$${parseFloat(ad.cpc).toFixed(3)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #1a1a2e;color:#fff;text-align:right">${getAction(ad.actions, 'landing_page_view')}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #1a1a2e;color:#ff0033;text-align:right">$${parseFloat(ad.spend).toFixed(2)}</td>
      </tr>
    `).join('');

  const tableHeader = `
    <tr>
      <th style="padding:8px 12px;text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;border-bottom:2px solid #1a1a2e">Ad</th>
      <th style="padding:8px 12px;text-align:right;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;border-bottom:2px solid #1a1a2e">Impr</th>
      <th style="padding:8px 12px;text-align:right;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;border-bottom:2px solid #1a1a2e">Clicks</th>
      <th style="padding:8px 12px;text-align:right;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;border-bottom:2px solid #1a1a2e">CTR</th>
      <th style="padding:8px 12px;text-align:right;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;border-bottom:2px solid #1a1a2e">CPC</th>
      <th style="padding:8px 12px;text-align:right;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;border-bottom:2px solid #1a1a2e">Views</th>
      <th style="padding:8px 12px;text-align:right;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;border-bottom:2px solid #1a1a2e">Spend</th>
    </tr>`;

  const metricBox = (label: string, value: string, color = '#fff') => `
    <td style="padding:16px;text-align:center">
      <div style="font-family:'Fira Code',monospace;font-size:11px;color:#64748b;letter-spacing:0.05em;margin-bottom:6px">${label}</div>
      <div style="font-size:24px;font-weight:700;color:${color}">${value}</div>
    </td>`;

  return `
    <div style="background:#0a0a0f;color:#fff;font-family:'Fira Sans',Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto;padding:32px 24px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:32px">
        <div>
          <div style="font-family:'Fira Code',monospace;font-size:12px;color:#ff0033;letter-spacing:0.08em;margin-bottom:4px">CAMPAIGN_REPORT</div>
          <div style="font-size:20px;font-weight:700">StoryHunt Lead Magnets</div>
        </div>
        <div style="font-family:'Fira Code',monospace;font-size:12px;color:#64748b">${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
      </div>

      ${t ? `
      <div style="margin-bottom:32px">
        <div style="font-family:'Fira Code',monospace;font-size:12px;color:#00d2ff;letter-spacing:0.05em;margin-bottom:12px">TODAY</div>
        <table style="width:100%;border-collapse:collapse"><tr>
          ${metricBox('IMPRESSIONS', parseInt(t.impressions).toLocaleString())}
          ${metricBox('CLICKS', getAction(t.actions, 'link_click'), '#00d2ff')}
          ${metricBox('CTR', parseFloat(t.ctr).toFixed(1) + '%')}
          ${metricBox('SPEND', '$' + parseFloat(t.spend).toFixed(2), '#ff0033')}
        </tr></table>
      </div>

      <div style="margin-bottom:32px">
        <div style="font-family:'Fira Code',monospace;font-size:12px;color:#00d2ff;letter-spacing:0.05em;margin-bottom:12px">TODAY — BY AD</div>
        <table style="width:100%;border-collapse:collapse">${tableHeader}${adRows(todayAds)}</table>
      </div>
      ` : '<p style="color:#64748b">No data for today yet.</p>'}

      ${l ? `
      <div style="margin-bottom:32px">
        <div style="font-family:'Fira Code',monospace;font-size:12px;color:#ff0033;letter-spacing:0.05em;margin-bottom:12px">LIFETIME</div>
        <table style="width:100%;border-collapse:collapse"><tr>
          ${metricBox('IMPRESSIONS', parseInt(l.impressions).toLocaleString())}
          ${metricBox('CLICKS', getAction(l.actions, 'link_click'), '#00d2ff')}
          ${metricBox('CTR', parseFloat(l.ctr).toFixed(1) + '%')}
          ${metricBox('SPEND', '$' + parseFloat(l.spend).toFixed(2), '#ff0033')}
        </tr></table>
      </div>

      <div style="margin-bottom:32px">
        <div style="font-family:'Fira Code',monospace;font-size:12px;color:#ff0033;letter-spacing:0.05em;margin-bottom:12px">LIFETIME — BY AD</div>
        <table style="width:100%;border-collapse:collapse">${tableHeader}${adRows(lifetimeAds)}</table>
      </div>
      ` : ''}

      <div style="border-top:1px solid #1a1a2e;padding-top:20px;font-family:'Fira Code',monospace;font-size:11px;color:#374151;text-align:center">
        StoryHunt Campaign Report — Auto-generated
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
    return NextResponse.json({ error: 'META_ADS_ACCESS_TOKEN not configured' }, { status: 500 });
  }

  try {
    const [today, todayAds, lifetime, lifetimeAds] = await Promise.all([
      fetchInsights('campaign', 'today'),
      fetchInsights('ad', 'today'),
      fetchInsights('campaign', 'maximum'),
      fetchInsights('ad', 'maximum'),
    ]);

    const html = buildReportHtml(today, todayAds, lifetime, lifetimeAds);

    // Send email if configured
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
      today: today[0] || null,
      todayAds,
      lifetime: lifetime[0] || null,
      lifetimeAds,
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
