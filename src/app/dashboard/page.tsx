'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Zap, Users, MessageSquare, TrendingUp, Plus, ArrowRight, Activity, DollarSign } from 'lucide-react';
import { getExperiences, getSessions, getTotalCost } from '@/lib/firestore';
import type { Experience, UserSession } from '@/lib/types';

export default function DashboardPage() {
    const router = useRouter();
    const [experiences, setExperiences] = useState<Experience[]>([]);
    const [sessions, setSessions] = useState<UserSession[]>([]);
    const [totalCost, setTotalCost] = useState<number>(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([getExperiences(), getSessions(), getTotalCost()])
            .then(([exp, sess, cost]) => { setExperiences(exp); setSessions(sess); setTotalCost(cost); })
            .finally(() => setLoading(false));
    }, []);

    const activeExps = experiences.filter(e => e.status === 'active').length;
    const activeSessions = sessions.filter(s => s.status === 'in_progress').length;
    const completedSessions = sessions.filter(s => s.status === 'completed').length;
    const completionRate = sessions.length > 0
        ? Math.round((completedSessions / sessions.length) * 100)
        : 0;

    const recentExperiences = [...experiences]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 5);

    const recentSessions = [...sessions]
        .sort((a, b) => b.started_at.localeCompare(a.started_at))
        .slice(0, 5);

    const StatSkeleton = () => (
        <div className="stat-card">
            <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 8, marginBottom: 8 }} />
            <div className="skeleton" style={{ width: 60, height: 32, borderRadius: 4, marginBottom: 4 }} />
            <div className="skeleton" style={{ width: 100, height: 16, borderRadius: 4 }} />
        </div>
    );

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Dashboard</h1>
                    <p className="page-subtitle">Resumen general de tu plataforma de experiencias</p>
                </div>
                <button className="btn btn-primary" onClick={() => router.push('/dashboard/experiences/new')} id="dashboard-new-experience-btn">
                    <Plus size={16} /> Nueva Experiencia
                </button>
            </div>

            {/* Stats */}
            <div className="stats-grid">
                {loading ? (
                    [1, 2, 3, 4, 5].map(i => <StatSkeleton key={i} />)
                ) : (
                    <>
                        <div className="stat-card">
                            <div className="stat-card-icon purple"><Zap size={18} /></div>
                            <div className="stat-card-value">{experiences.length}</div>
                            <div className="stat-card-label">Experiencias totales</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-card-icon green"><Activity size={18} /></div>
                            <div className="stat-card-value">{activeExps}</div>
                            <div className="stat-card-label">Experiencias activas</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-card-icon cyan"><Users size={18} /></div>
                            <div className="stat-card-value">{sessions.length}</div>
                            <div className="stat-card-label">Sesiones totales</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-card-icon amber"><TrendingUp size={18} /></div>
                            <div className="stat-card-value">{completionRate}%</div>
                            <div className="stat-card-label">Tasa de finalización</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-card-icon" style={{ background: 'rgba(16,185,129,0.1)', color: '#34D399' }}><DollarSign size={18} /></div>
                            <div className="stat-card-value">${totalCost.toFixed(4)}</div>
                            <div className="stat-card-label">Costo LLM (USD)</div>
                        </div>
                    </>
                )}
            </div>

            {/* Two-column grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

                {/* Recent Experiences */}
                <div className="card">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700 }}>Experiencias Recientes</h3>
                        <button className="btn btn-ghost btn-sm" onClick={() => router.push('/dashboard/experiences')}>
                            Ver todas <ArrowRight size={14} />
                        </button>
                    </div>
                    {loading ? (
                        [1, 2, 3].map(i => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                                <div className="skeleton" style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0 }} />
                                <div style={{ flex: 1 }}>
                                    <div className="skeleton" style={{ width: '60%', height: 14, borderRadius: 4, marginBottom: 4 }} />
                                    <div className="skeleton" style={{ width: '40%', height: 12, borderRadius: 4 }} />
                                </div>
                            </div>
                        ))
                    ) : recentExperiences.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
                            <Zap size={32} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                            <p style={{ fontSize: 13 }}>Aún no hay experiencias</p>
                        </div>
                    ) : (
                        recentExperiences.map(exp => (
                            <div
                                key={exp.id}
                                style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, cursor: 'pointer', padding: '8px', borderRadius: 8, transition: 'background 0.1s' }}
                                onClick={() => router.push(`/dashboard/experiences/${exp.id}`)}
                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >
                                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(124,58,237,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-primary-light)', flexShrink: 0 }}>
                                    <Zap size={15} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{exp.name}</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{exp.mode === 'test' ? 'Modo prueba' : 'Producción'}</div>
                                </div>
                                <span className={`badge badge-${exp.status}`}>{exp.status === 'active' ? 'Activa' : 'Inactiva'}</span>
                            </div>
                        ))
                    )}
                </div>

                {/* Recent Sessions */}
                <div className="card">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700 }}>Sesiones Recientes</h3>
                        <button className="btn btn-ghost btn-sm" onClick={() => router.push('/dashboard/sessions')}>
                            Ver todas <ArrowRight size={14} />
                        </button>
                    </div>
                    {loading ? (
                        [1, 2, 3].map(i => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                                <div className="skeleton" style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0 }} />
                                <div style={{ flex: 1 }}>
                                    <div className="skeleton" style={{ width: '55%', height: 14, borderRadius: 4, marginBottom: 4 }} />
                                    <div className="skeleton" style={{ width: '35%', height: 12, borderRadius: 4 }} />
                                </div>
                            </div>
                        ))
                    ) : recentSessions.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
                            <Users size={32} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                            <p style={{ fontSize: 13 }}>Aún no hay sesiones</p>
                        </div>
                    ) : (
                        recentSessions.map(sess => (
                            <div key={sess.id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, padding: 8, borderRadius: 8 }}>
                                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(6,182,212,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--info)', flexShrink: 0 }}>
                                    <MessageSquare size={15} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sess.whatsapp_number}</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Paso {sess.current_step} · {new Date(sess.started_at).toLocaleDateString('es-AR')}</div>
                                </div>
                                <span className={`badge badge-${sess.status}`}>{
                                    sess.status === 'in_progress' ? 'En curso' :
                                        sess.status === 'completed' ? 'Completada' : 'Abandonada'
                                }</span>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
