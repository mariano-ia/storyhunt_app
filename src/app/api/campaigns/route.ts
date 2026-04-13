import { NextResponse } from 'next/server';

const META_TOKEN = process.env.META_ADS_ACCESS_TOKEN || '';
const AD_ACCOUNT_ID = 'act_1614086746553655';

type MetaAction = { action_type: string; value: string };

type InsightRow = {
  campaign_name?: string;
  campaign_id?: string;
  adset_name?: string;
  ad_name?: string;
  impressions: string;
  reach: string;
  clicks: string;
  ctr: string;
  cpc: string;
  spend: string;
  actions?: MetaAction[];
  date_start: string;
  date_stop: string;
};

async function fetchMeta(path: string, params: Record<string, string> = {}): Promise<any> {
  const qs = new URLSearchParams({ access_token: META_TOKEN, ...params });
  const res = await fetch(`https://graph.facebook.com/v21.0/${path}?${qs}`, { next: { revalidate: 300 } });
  return res.json();
}

export async function GET() {
  if (!META_TOKEN) {
    return NextResponse.json({ error: 'META_ADS_ACCESS_TOKEN not configured' }, { status: 500 });
  }

  try {
    // Get all campaigns
    const campaignsRes = await fetchMeta(`${AD_ACCOUNT_ID}/campaigns`, {
      fields: 'name,status,effective_status,objective,daily_budget,lifetime_budget',
      limit: '50',
    });

    const campaigns = campaignsRes.data || [];

    // Get insights for each campaign (lifetime + today + daily)
    const results = await Promise.all(
      campaigns.map(async (campaign: any) => {
        const [lifetime, today, daily, adInsights] = await Promise.all([
          fetchMeta(`${campaign.id}/insights`, {
            fields: 'impressions,reach,clicks,ctr,cpc,spend,actions',
            date_preset: 'maximum',
          }),
          fetchMeta(`${campaign.id}/insights`, {
            fields: 'impressions,reach,clicks,ctr,cpc,spend,actions',
            date_preset: 'today',
          }),
          fetchMeta(`${campaign.id}/insights`, {
            fields: 'impressions,clicks,ctr,spend,actions',
            time_increment: '1',
            date_preset: 'last_7d',
          }),
          fetchMeta(`${campaign.id}/insights`, {
            fields: 'ad_name,impressions,reach,clicks,ctr,cpc,spend,actions',
            level: 'ad',
            date_preset: 'maximum',
          }),
        ]);

        const getLeads = (row: InsightRow | undefined) => {
          if (!row?.actions) return 0;
          const lead = row.actions.find((a: MetaAction) => a.action_type === 'lead' || a.action_type === 'offsite_conversion.fb_pixel_lead');
          return lead ? parseInt(lead.value) : 0;
        };

        const getLandingViews = (row: InsightRow | undefined) => {
          if (!row?.actions) return 0;
          const view = row.actions.find((a: MetaAction) => a.action_type === 'landing_page_view');
          return view ? parseInt(view.value) : 0;
        };

        const getLinkClicks = (row: InsightRow | undefined) => {
          if (!row?.actions) return 0;
          const click = row.actions.find((a: MetaAction) => a.action_type === 'link_click');
          return click ? parseInt(click.value) : 0;
        };

        const lifetimeData = lifetime.data?.[0] as InsightRow | undefined;
        const todayData = today.data?.[0] as InsightRow | undefined;

        return {
          id: campaign.id,
          name: campaign.name,
          status: campaign.effective_status,
          objective: campaign.objective,
          lifetime: lifetimeData ? {
            impressions: parseInt(lifetimeData.impressions),
            reach: parseInt(lifetimeData.reach),
            clicks: getLinkClicks(lifetimeData),
            ctr: parseFloat(lifetimeData.ctr),
            cpc: parseFloat(lifetimeData.cpc),
            spend: parseFloat(lifetimeData.spend),
            leads: getLeads(lifetimeData),
            landingViews: getLandingViews(lifetimeData),
          } : null,
          today: todayData ? {
            impressions: parseInt(todayData.impressions),
            clicks: getLinkClicks(todayData),
            spend: parseFloat(todayData.spend),
            leads: getLeads(todayData),
          } : null,
          daily: (daily.data || []).map((d: InsightRow) => ({
            date: d.date_start,
            impressions: parseInt(d.impressions),
            clicks: parseInt(d.clicks),
            ctr: parseFloat(d.ctr),
            spend: parseFloat(d.spend),
          })),
          ads: (adInsights.data || []).map((ad: InsightRow) => ({
            name: ad.ad_name,
            impressions: parseInt(ad.impressions),
            clicks: getLinkClicks(ad),
            ctr: parseFloat(ad.ctr),
            cpc: parseFloat(ad.cpc),
            spend: parseFloat(ad.spend),
            leads: getLeads(ad),
            landingViews: getLandingViews(ad),
          })).sort((a: any, b: any) => b.ctr - a.ctr),
        };
      })
    );

    const totalSpend = results.reduce((sum: number, c: any) => sum + (c.lifetime?.spend || 0), 0);

    return NextResponse.json({ campaigns: results, totalSpend });
  } catch (error) {
    console.error('Campaigns API error:', error);
    return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 });
  }
}
