'use client';

import { useEffect, useState } from 'react';
import { DollarSign, TrendingUp, MousePointerClick, Eye, Users, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

type Ad = {
  name: string;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  spend: number;
  leads: number;
  landingViews: number;
};

type DailyData = {
  date: string;
  impressions: number;
  clicks: number;
  ctr: number;
  spend: number;
};

type Campaign = {
  id: string;
  name: string;
  status: string;
  objective: string;
  lifetime: {
    impressions: number;
    reach: number;
    clicks: number;
    ctr: number;
    cpc: number;
    spend: number;
    leads: number;
    landingViews: number;
  } | null;
  today: {
    impressions: number;
    clicks: number;
    spend: number;
    leads: number;
  } | null;
  daily: DailyData[];
  ads: Ad[];
};

const statusColors: Record<string, string> = {
  ACTIVE: '#10B981',
  PAUSED: '#F59E0B',
  DELETED: '#EF4444',
  ARCHIVED: '#6B7280',
};

function StatCard({ icon: Icon, value, label, color = 'purple' }: {
  icon: any;
  value: string;
  label: string;
  color?: string;
}) {
  return (
    <div className="stat-card">
      <div className={`stat-card-icon ${color}`}><Icon size={18} /></div>
      <div className="stat-card-value">{value}</div>
      <div className="stat-card-label">{label}</div>
    </div>
  );
}

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const [expanded, setExpanded] = useState(false);
  const lt = campaign.lifetime;
  const td = campaign.today;

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 12,
      overflow: 'hidden',
      marginBottom: 16,
    }}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-primary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: statusColors[campaign.status] || '#6B7280',
          }} />
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{campaign.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {campaign.objective?.replace('OUTCOME_', '')} — {campaign.status}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {lt && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                ${lt.spend.toFixed(2)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>total spend</div>
            </div>
          )}
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>

      {expanded && lt && (
        <div style={{ padding: '0 20px 20px' }}>
          {/* Lifetime stats */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', marginBottom: 20, gap: 10 }}>
            <div style={{ textAlign: 'center', padding: 12, background: 'var(--bg-base)', borderRadius: 8 }}>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{lt.impressions.toLocaleString()}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Impressions</div>
            </div>
            <div style={{ textAlign: 'center', padding: 12, background: 'var(--bg-base)', borderRadius: 8 }}>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{lt.clicks.toLocaleString()}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Link clicks</div>
            </div>
            <div style={{ textAlign: 'center', padding: 12, background: 'var(--bg-base)', borderRadius: 8 }}>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{lt.ctr.toFixed(1)}%</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>CTR</div>
            </div>
            <div style={{ textAlign: 'center', padding: 12, background: 'var(--bg-base)', borderRadius: 8 }}>
              <div style={{ fontSize: 20, fontWeight: 700 }}>${lt.cpc.toFixed(3)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>CPC</div>
            </div>
            <div style={{ textAlign: 'center', padding: 12, background: 'var(--bg-base)', borderRadius: 8 }}>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{lt.landingViews.toLocaleString()}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Landing views</div>
            </div>
          </div>

          {/* Today */}
          {td && (
            <div style={{
              display: 'flex',
              gap: 16,
              padding: '12px 16px',
              background: 'var(--bg-base)',
              borderRadius: 8,
              marginBottom: 20,
              fontSize: 13,
            }}>
              <span style={{ color: 'var(--text-muted)' }}>Today:</span>
              <span>{td.impressions.toLocaleString()} impr</span>
              <span>{td.clicks} clicks</span>
              <span style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>${td.spend.toFixed(2)}</span>
              {td.leads > 0 && <span style={{ color: '#10B981', fontWeight: 600 }}>{td.leads} leads</span>}
            </div>
          )}

          {/* Ads breakdown */}
          {campaign.ads.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Ads breakdown
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <th style={{ textAlign: 'left', padding: '8px 0', color: 'var(--text-muted)', fontWeight: 500, fontSize: 11 }}>Ad</th>
                    <th style={{ textAlign: 'right', padding: '8px 0', color: 'var(--text-muted)', fontWeight: 500, fontSize: 11 }}>Impr</th>
                    <th style={{ textAlign: 'right', padding: '8px 0', color: 'var(--text-muted)', fontWeight: 500, fontSize: 11 }}>Clicks</th>
                    <th style={{ textAlign: 'right', padding: '8px 0', color: 'var(--text-muted)', fontWeight: 500, fontSize: 11 }}>CTR</th>
                    <th style={{ textAlign: 'right', padding: '8px 0', color: 'var(--text-muted)', fontWeight: 500, fontSize: 11 }}>CPC</th>
                    <th style={{ textAlign: 'right', padding: '8px 0', color: 'var(--text-muted)', fontWeight: 500, fontSize: 11 }}>Views</th>
                    <th style={{ textAlign: 'right', padding: '8px 0', color: 'var(--text-muted)', fontWeight: 500, fontSize: 11 }}>Spend</th>
                  </tr>
                </thead>
                <tbody>
                  {campaign.ads.map((ad, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '10px 0', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ad.name}</td>
                      <td style={{ textAlign: 'right', padding: '10px 0' }}>{ad.impressions.toLocaleString()}</td>
                      <td style={{ textAlign: 'right', padding: '10px 0' }}>{ad.clicks}</td>
                      <td style={{ textAlign: 'right', padding: '10px 0', color: ad.ctr > 10 ? '#10B981' : ad.ctr > 5 ? '#F59E0B' : '#EF4444' }}>
                        {ad.ctr.toFixed(1)}%
                      </td>
                      <td style={{ textAlign: 'right', padding: '10px 0' }}>${ad.cpc.toFixed(3)}</td>
                      <td style={{ textAlign: 'right', padding: '10px 0' }}>{ad.landingViews}</td>
                      <td style={{ textAlign: 'right', padding: '10px 0', fontWeight: 600 }}>${ad.spend.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Daily chart (simple bar) */}
          {campaign.daily.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Last 7 days — spend
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80 }}>
                {campaign.daily.map((d, i) => {
                  const maxSpend = Math.max(...campaign.daily.map(x => x.spend));
                  const height = maxSpend > 0 ? (d.spend / maxSpend) * 100 : 0;
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>${d.spend.toFixed(0)}</div>
                      <div style={{
                        width: '100%',
                        height: `${height}%`,
                        minHeight: 2,
                        background: 'var(--brand-primary)',
                        borderRadius: 4,
                        opacity: 0.7,
                      }} />
                      <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                        {new Date(d.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CampaignsPage() {
  const [data, setData] = useState<{ campaigns: Campaign[]; totalSpend: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/campaigns');
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError('Failed to load campaign data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const totalImpressions = data?.campaigns.reduce((sum, c) => sum + (c.lifetime?.impressions || 0), 0) || 0;
  const totalClicks = data?.campaigns.reduce((sum, c) => sum + (c.lifetime?.clicks || 0), 0) || 0;
  const totalLeads = data?.campaigns.reduce((sum, c) => sum + (c.lifetime?.leads || 0), 0) || 0;
  const activeCampaigns = data?.campaigns.filter(c => c.status === 'ACTIVE').length || 0;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Campaigns</h1>
          <p className="page-subtitle">Meta Ads performance and spend tracking</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchData} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spinning' : ''} /> Refresh
        </button>
      </div>

      {/* Global stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', marginBottom: 24 }}>
        <StatCard icon={DollarSign} value={`$${(data?.totalSpend || 0).toFixed(2)}`} label="Total spend" color="red" />
        <StatCard icon={Eye} value={totalImpressions.toLocaleString()} label="Impressions" color="blue" />
        <StatCard icon={MousePointerClick} value={totalClicks.toLocaleString()} label="Link clicks" color="purple" />
        <StatCard icon={Users} value={totalLeads.toString()} label="Leads" color="green" />
        <StatCard icon={TrendingUp} value={activeCampaigns.toString()} label="Active campaigns" color="yellow" />
      </div>

      {/* Campaigns list */}
      {loading && !data ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          Loading campaigns...
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#EF4444' }}>{error}</div>
      ) : (
        data?.campaigns.map(campaign => (
          <CampaignCard key={campaign.id} campaign={campaign} />
        ))
      )}
    </div>
  );
}
