'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Search, CheckCircle, XCircle, Clock, Star, ThumbsUp, ThumbsDown, Minus } from 'lucide-react';
import { getSessions, getExperiences } from '@/lib/firestore';
import type { UserSession, Experience } from '@/lib/types';

export default function SessionsPage() {
    const router = useRouter();
    const [sessions, setSessions] = useState<UserSession[]>([]);
    const [experiences, setExperiences] = useState<Experience[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterExp, setFilterExp] = useState('');
    const [filterStatus, setFilterStatus] = useState('');

    useEffect(() => {
        Promise.all([getSessions(), getExperiences()]).then(([s, e]) => {
            setSessions(s); setExperiences(e); setLoading(false);
        });
    }, []);

    const expMap: Record<string, string> = Object.fromEntries(experiences.map(e => [e.id, e.name]));

    const filtered = sessions
        .filter(s => {
            const matchesSearch = (s.email || '').toLowerCase().includes(search.toLowerCase());
            const matchesExp = filterExp ? s.experience_id === filterExp : true;
            const matchesStatus = filterStatus ? s.status === filterStatus : true;
            return matchesSearch && matchesExp && matchesStatus;
        })
        .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());

    const statusIcon = (s: string) => s === 'completed' ? <CheckCircle size={12} /> : s === 'abandoned' ? <XCircle size={12} /> : <Clock size={12} />;
    const statusLabel = (s: string) => s === 'in_progress' ? 'En curso' : s === 'completed' ? 'Completada' : 'Abandonada';

    const ratingIcon = (r?: string) => {
        if (r === 'positive') return <ThumbsUp size={13} style={{ color: 'var(--success)' }} />;
        if (r === 'negative') return <ThumbsDown size={13} style={{ color: 'var(--danger)' }} />;
        if (r === 'neutral') return <Minus size={13} style={{ color: 'var(--warning)' }} />;
        return <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>;
    };

    const progressBar = (current: number, total: number) => {
        const pct = total > 0 ? Math.round((current / total) * 100) : 0;
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, height: 6, background: 'var(--bg-elevated)', borderRadius: 3, minWidth: 50 }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? 'var(--success)' : 'var(--brand-primary)', borderRadius: 3, transition: 'width 0.3s' }} />
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', minWidth: 32 }}>{pct}%</span>
            </div>
        );
    };

    // Stats
    const totalSessions = sessions.length;
    const completedSessions = sessions.filter(s => s.status === 'completed').length;
    const inProgressSessions = sessions.filter(s => s.status === 'in_progress').length;
    const ratedSessions = sessions.filter(s => s.rating);
    const positiveCount = ratedSessions.filter(s => s.rating === 'positive').length;
    const satisfactionPct = ratedSessions.length > 0 ? Math.round((positiveCount / ratedSessions.length) * 100) : 0;

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Sesiones</h1>
                    <p className="page-subtitle">Sesiones de jugadores en todas las experiencias</p>
                </div>
            </div>

            {/* Stats cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
                <div className="card" style={{ padding: 16, textAlign: 'center' }}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)' }}>{totalSessions}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Total sesiones</div>
                </div>
                <div className="card" style={{ padding: 16, textAlign: 'center' }}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--success)' }}>{completedSessions}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Completadas</div>
                </div>
                <div className="card" style={{ padding: 16, textAlign: 'center' }}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--info)' }}>{inProgressSessions}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>En curso</div>
                </div>
                <div className="card" style={{ padding: 16, textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        <Star size={18} style={{ color: 'var(--warning)' }} />
                        <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)' }}>{satisfactionPct}%</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Satisfaccion ({ratedSessions.length} votos)</div>
                </div>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 200 }}>
                    <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input className="form-input" style={{ paddingLeft: 34 }} placeholder="Buscar por email..." value={search} onChange={e => setSearch(e.target.value)} id="sessions-search" />
                </div>
                <select className="form-select" style={{ flex: '0 1 200px' }} value={filterExp} onChange={e => setFilterExp(e.target.value)} id="filter-experience">
                    <option value="">Todas las experiencias</option>
                    {experiences.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
                <select className="form-select" style={{ flex: '0 1 160px' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)} id="filter-status">
                    <option value="">Todos los estados</option>
                    <option value="in_progress">En curso</option>
                    <option value="completed">Completadas</option>
                    <option value="abandoned">Abandonadas</option>
                </select>
            </div>

            {loading ? (
                <div className="table-wrapper">
                    <table>
                        <thead><tr><th>Email</th><th>Experiencia</th><th>Progreso</th><th>Estado</th><th>Rating</th><th>Inicio</th></tr></thead>
                        <tbody>
                            {[1, 2, 3, 4].map(i => (
                                <tr key={i}>{[1, 2, 3, 4, 5, 6].map(j => <td key={j}><div className="skeleton" style={{ height: 14, borderRadius: 4, width: j === 2 ? 120 : 80 }} /></td>)}</tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : filtered.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon"><Users size={26} /></div>
                    <div className="empty-state-title">{sessions.length === 0 ? 'Sin sesiones aun' : 'Sin resultados'}</div>
                    <p className="empty-state-text">
                        {sessions.length === 0
                            ? 'Las sesiones apareceran aqui cuando los usuarios jueguen tus experiencias.'
                            : 'Proba con otros filtros de busqueda.'}
                    </p>
                </div>
            ) : (
                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Email</th>
                                <th>Experiencia</th>
                                <th>Progreso</th>
                                <th>Estado</th>
                                <th>Rating</th>
                                <th>Feedback</th>
                                <th>Inicio</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(sess => (
                                <tr key={sess.id}>
                                    <td>
                                        <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{sess.email || '—'}</span>
                                    </td>
                                    <td style={{ color: 'var(--text-secondary)' }}>
                                        <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px', fontWeight: 500 }} onClick={() => router.push(`/dashboard/experiences/${sess.experience_id}`)}>
                                            {expMap[sess.experience_id] ?? 'Desconocida'}
                                        </button>
                                    </td>
                                    <td style={{ minWidth: 120 }}>
                                        {progressBar(sess.current_step, sess.total_steps)}
                                    </td>
                                    <td>
                                        <span className={`badge badge-${sess.status}`}>
                                            {statusIcon(sess.status)} {statusLabel(sess.status)}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        {ratingIcon(sess.rating)}
                                    </td>
                                    <td style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={sess.rating_comment || ''}>
                                        {sess.rating_comment || '—'}
                                    </td>
                                    <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                        {new Date(sess.started_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
