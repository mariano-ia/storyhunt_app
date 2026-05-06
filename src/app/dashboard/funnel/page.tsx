'use client';
import { useEffect, useState } from 'react';
import { TrendingDown, DollarSign, Users, Activity, RefreshCw } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface FunnelData {
    period: { days: number; cutoff: string };
    funnel: Record<string, number>;
    dropoffs: Record<string, number | null>;
    stats: {
        total_revenue: number;
        total_sales: number;
        total_signups: number;
        total_events: number;
        conversion_rate: number;
    };
    recent_events: Array<{
        timestamp: string;
        event_name: string;
        email: string | null;
        value: number | null;
        sent_to_meta: boolean;
        sent_to_ga4: boolean;
        sent_to_posthog: boolean;
    }>;
}

const FUNNEL_STEPS = ['Lead', 'InitiateCheckout', 'AddPaymentInfo', 'Purchase'];
const STEP_LABELS: Record<string, string> = {
    Lead: 'Email captured',
    InitiateCheckout: 'Opened checkout',
    AddPaymentInfo: 'Reached Stripe',
    Purchase: 'Paid',
};

// ─── Funnel page ────────────────────────────────────────────────────────────

export default function FunnelPage() {
    const [data, setData] = useState<FunnelData | null>(null);
    const [loading, setLoading] = useState(true);
    const [days, setDays] = useState(7);

    const load = async (d: number) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/dashboard/funnel?days=${d}`);
            if (res.ok) setData(await res.json());
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(days); }, [days]);

    const maxFunnelCount = data
        ? Math.max(...FUNNEL_STEPS.map(s => data.funnel[s] || 0), 1)
        : 1;

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Funnel</h1>
                    <p className="page-subtitle">Server-side events log — independent of platform API quotas</p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select
                        value={days}
                        onChange={(e) => setDays(parseInt(e.target.value))}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '6px 12px' }}
                    >
                        <option value={7}>Last 7 days</option>
                        <option value={30}>Last 30 days</option>
                        <option value={0}>All time</option>
                    </select>
                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => load(days)}
                        disabled={loading}
                    >
                        <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
                    </button>
                </div>
            </div>

            {/* Stats cards */}
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 24 }}>
                <div className="stat-card">
                    <div className="stat-card-icon green"><DollarSign size={18} /></div>
                    <div className="stat-card-value">${data?.stats.total_revenue.toFixed(2) ?? '–'}</div>
                    <div className="stat-card-label">Revenue (paid)</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-icon purple"><Users size={18} /></div>
                    <div className="stat-card-value">{data?.stats.total_signups ?? '–'}</div>
                    <div className="stat-card-label">Email signups</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-icon blue"><Activity size={18} /></div>
                    <div className="stat-card-value">{data?.stats.total_events ?? '–'}</div>
                    <div className="stat-card-label">Server events logged</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-icon orange"><TrendingDown size={18} /></div>
                    <div className="stat-card-value">
                        {data ? `${(data.stats.conversion_rate * 100).toFixed(1)}%` : '–'}
                    </div>
                    <div className="stat-card-label">Signup → paid</div>
                </div>
            </div>

            {/* Funnel visualization */}
            <div className="card" style={{ padding: 20, marginBottom: 24 }}>
                <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Funnel</h2>
                {loading && !data ? (
                    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading...</div>
                ) : data ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {FUNNEL_STEPS.map((step, i) => {
                            const count = data.funnel[step] || 0;
                            const widthPct = (count / maxFunnelCount) * 100;
                            const dropoff = i > 0 ? data.dropoffs[`${FUNNEL_STEPS[i - 1]}_to_${step}`] : null;
                            return (
                                <div key={step}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                                        <span style={{
                                            fontFamily: "'Fira Code', monospace",
                                            fontSize: 11,
                                            color: 'var(--text-muted)',
                                            minWidth: 110,
                                        }}>{step.toUpperCase()}</span>
                                        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                            {STEP_LABELS[step]}
                                        </span>
                                        <span style={{ marginLeft: 'auto', fontWeight: 600, fontSize: 18 }}>
                                            {count}
                                        </span>
                                        {dropoff !== null && (
                                            <span style={{
                                                fontFamily: "'Fira Code', monospace",
                                                fontSize: 11,
                                                color: dropoff < 0.3 ? '#ef4444' : dropoff < 0.6 ? '#f59e0b' : '#10b981',
                                                minWidth: 60,
                                                textAlign: 'right',
                                            }}>
                                                {(dropoff * 100).toFixed(1)}% kept
                                            </span>
                                        )}
                                    </div>
                                    <div style={{
                                        height: 8,
                                        background: 'var(--surface-2)',
                                        borderRadius: 4,
                                        overflow: 'hidden',
                                    }}>
                                        <div style={{
                                            width: `${widthPct}%`,
                                            height: '100%',
                                            background: 'linear-gradient(90deg, var(--brand-primary), #a855f7)',
                                            transition: 'width 0.4s ease',
                                        }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : null}

                <p style={{
                    marginTop: 16,
                    fontSize: 12,
                    color: 'var(--text-muted)',
                    fontFamily: "'Fira Code', monospace",
                }}>
                    Source: Firestore <code>events</code> collection (server-side logged from CAPI/GA4 MP/PostHog server).
                    PageView / ViewContent are client-only — see PostHog or GA4 for those.
                </p>
            </div>

            {/* Recent events */}
            <div className="card" style={{ padding: 20 }}>
                <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
                    Recent events {data ? `(${data.recent_events.length})` : ''}
                </h2>
                {loading && !data ? (
                    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading...</div>
                ) : data && data.recent_events.length > 0 ? (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left' }}>
                                    <th style={{ padding: '8px 6px', color: 'var(--text-muted)', fontWeight: 500 }}>Time</th>
                                    <th style={{ padding: '8px 6px', color: 'var(--text-muted)', fontWeight: 500 }}>Event</th>
                                    <th style={{ padding: '8px 6px', color: 'var(--text-muted)', fontWeight: 500 }}>Email</th>
                                    <th style={{ padding: '8px 6px', color: 'var(--text-muted)', fontWeight: 500, textAlign: 'right' }}>Value</th>
                                    <th style={{ padding: '8px 6px', color: 'var(--text-muted)', fontWeight: 500, textAlign: 'center' }} title="Meta CAPI">M</th>
                                    <th style={{ padding: '8px 6px', color: 'var(--text-muted)', fontWeight: 500, textAlign: 'center' }} title="GA4 Measurement Protocol">G</th>
                                    <th style={{ padding: '8px 6px', color: 'var(--text-muted)', fontWeight: 500, textAlign: 'center' }} title="PostHog">P</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.recent_events.map((e, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                        <td style={{ padding: '8px 6px', fontFamily: "'Fira Code', monospace", fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                                            {new Date(e.timestamp).toLocaleString('en-US', {
                                                month: 'short', day: 'numeric',
                                                hour: '2-digit', minute: '2-digit',
                                            })}
                                        </td>
                                        <td style={{ padding: '8px 6px' }}>
                                            <span style={{
                                                padding: '2px 8px',
                                                borderRadius: 4,
                                                fontFamily: "'Fira Code', monospace",
                                                fontSize: 11,
                                                background: e.event_name === 'Purchase' ? 'rgba(16,185,129,0.15)'
                                                    : e.event_name === 'Lead' ? 'rgba(59,130,246,0.15)'
                                                    : 'rgba(168,85,247,0.15)',
                                                color: e.event_name === 'Purchase' ? '#10b981'
                                                    : e.event_name === 'Lead' ? '#3b82f6'
                                                    : '#a855f7',
                                            }}>{e.event_name}</span>
                                        </td>
                                        <td style={{ padding: '8px 6px', fontFamily: "'Fira Code', monospace", fontSize: 11, color: 'var(--text-secondary)' }}>
                                            {e.email || '–'}
                                        </td>
                                        <td style={{ padding: '8px 6px', textAlign: 'right', fontFamily: "'Fira Code', monospace", fontSize: 11 }}>
                                            {e.value != null ? `$${e.value.toFixed(2)}` : '–'}
                                        </td>
                                        <td style={{ padding: '8px 6px', textAlign: 'center' }}>{e.sent_to_meta ? '✓' : <span style={{ color: 'var(--text-muted)' }}>–</span>}</td>
                                        <td style={{ padding: '8px 6px', textAlign: 'center' }}>{e.sent_to_ga4 ? '✓' : <span style={{ color: 'var(--text-muted)' }}>–</span>}</td>
                                        <td style={{ padding: '8px 6px', textAlign: 'center' }}>{e.sent_to_posthog ? '✓' : <span style={{ color: 'var(--text-muted)' }}>–</span>}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                        No events in this period. Once traffic flows + events fire, they'll show up here.
                    </div>
                )}
            </div>

            <style>{`
                .spin { animation: spin 0.8s linear infinite; }
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
