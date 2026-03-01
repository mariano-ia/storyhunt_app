'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, TrendingUp, Users, CheckCircle, XCircle, DollarSign, Zap, AlertTriangle } from 'lucide-react';
import { getExperience, getMetrics } from '@/lib/firestore';
import type { Experience, ExperienceMetrics } from '@/lib/types';

export default function MetricsPage() {
    const { id } = useParams() as { id: string };
    const router = useRouter();
    const [exp, setExp] = useState<Experience | null>(null);
    const [metrics, setMetrics] = useState<ExperienceMetrics | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([getExperience(id), getMetrics(id)]).then(([e, m]) => {
            setExp(e); setMetrics(m); setLoading(false);
        });
    }, [id]);

    const fmt = (n: number) => n.toLocaleString('es-AR');
    const fmtUSD = (n: number) => `$${n.toFixed(4)}`;
    const fmtPct = (n: number) => `${Math.round(n * 100)}%`;

    if (loading) return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 12 }} />)}
        </div>
    );

    return (
        <div>
            <div className="page-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button className="btn btn-ghost btn-icon" onClick={() => router.push(`/dashboard/experiences/${id}`)}><ArrowLeft size={18} /></button>
                    <div>
                        <h1 className="page-title">Métricas</h1>
                        <p className="page-subtitle">{exp?.name}</p>
                    </div>
                </div>
            </div>

            {metrics && metrics.total_sessions === 0 ? (
                <div className="empty-state" style={{ marginTop: 40 }}>
                    <div className="empty-state-icon" style={{ background: 'rgba(245,158,11,0.1)', color: 'var(--warning)' }}>
                        <TrendingUp size={26} />
                    </div>
                    <div className="empty-state-title">Aún no hay datos</div>
                    <p className="empty-state-text">Las métricas aparecerán cuando los usuarios empiecen a usar esta experiencia por WhatsApp.</p>
                </div>
            ) : (
                <>
                    <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
                        <div className="stat-card">
                            <div className="stat-card-icon purple"><Users size={18} /></div>
                            <div className="stat-card-value">{fmt(metrics?.total_sessions ?? 0)}</div>
                            <div className="stat-card-label">Sesiones iniciadas</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-card-icon green"><CheckCircle size={18} /></div>
                            <div className="stat-card-value">{fmt(metrics?.completed_sessions ?? 0)}</div>
                            <div className="stat-card-label">Completadas</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-card-icon cyan"><TrendingUp size={18} /></div>
                            <div className="stat-card-value">{fmtPct(metrics?.completion_rate ?? 0)}</div>
                            <div className="stat-card-label">Tasa de finalización</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-card-icon amber"><DollarSign size={18} /></div>
                            <div className="stat-card-value">{fmtUSD(metrics?.total_cost_usd ?? 0)}</div>
                            <div className="stat-card-label">Costo total LLM</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-card-icon amber"><Zap size={18} /></div>
                            <div className="stat-card-value">{fmt(metrics?.total_tokens ?? 0)}</div>
                            <div className="stat-card-label">Tokens consumidos</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-card-icon red"><AlertTriangle size={18} /></div>
                            <div className="stat-card-value">{metrics?.highest_drop_step != null ? `Paso ${metrics.highest_drop_step}` : '—'}</div>
                            <div className="stat-card-label">Mayor abandono</div>
                        </div>
                    </div>

                    {/* Completion Rate Bar */}
                    <div className="card" style={{ maxWidth: 560, marginTop: 8 }}>
                        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Tasa de finalización</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <div className="progress-bar-container" style={{ flex: 1 }}>
                                <div className="progress-bar-fill" style={{ width: `${(metrics?.completion_rate ?? 0) * 100}%` }} />
                            </div>
                            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', minWidth: 48 }}>
                                {fmtPct(metrics?.completion_rate ?? 0)}
                            </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 13, color: 'var(--text-muted)' }}>
                            <span><CheckCircle size={12} style={{ display: 'inline', marginRight: 4, color: 'var(--success)' }} />{metrics?.completed_sessions} completadas</span>
                            <span><XCircle size={12} style={{ display: 'inline', marginRight: 4, color: 'var(--danger)' }} />{(metrics?.total_sessions ?? 0) - (metrics?.completed_sessions ?? 0)} no completadas</span>
                        </div>
                    </div>

                    {/* Cost breakdown */}
                    <div className="card" style={{ maxWidth: 560, marginTop: 16 }}>
                        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Costo del LLM</h3>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                            <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Costo total</span>
                            <span style={{ fontSize: 14, fontWeight: 600 }}>{fmtUSD(metrics?.total_cost_usd ?? 0)} USD</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                            <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Costo promedio por sesión</span>
                            <span style={{ fontSize: 14, fontWeight: 600 }}>{fmtUSD(metrics?.avg_cost_per_session ?? 0)} USD</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0' }}>
                            <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Tokens totales</span>
                            <span style={{ fontSize: 14, fontWeight: 600 }}>{fmt(metrics?.total_tokens ?? 0)}</span>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
