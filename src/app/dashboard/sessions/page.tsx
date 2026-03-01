'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, MessageSquare, Search, ExternalLink, CheckCircle, XCircle, Clock } from 'lucide-react';
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

    const filtered = sessions.filter(s => {
        const matchesSearch = s.whatsapp_number.includes(search);
        const matchesExp = filterExp ? s.experience_id === filterExp : true;
        const matchesStatus = filterStatus ? s.status === filterStatus : true;
        return matchesSearch && matchesExp && matchesStatus;
    });

    const statusIcon = (s: string) => s === 'completed' ? <CheckCircle size={12} /> : s === 'abandoned' ? <XCircle size={12} /> : <Clock size={12} />;
    const statusLabel = (s: string) => s === 'in_progress' ? 'En curso' : s === 'completed' ? 'Completada' : 'Abandonada';

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Sesiones</h1>
                    <p className="page-subtitle">Historial de todas las sesiones por WhatsApp</p>
                </div>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 200 }}>
                    <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input className="form-input" style={{ paddingLeft: 34 }} placeholder="Buscar por número..." value={search} onChange={e => setSearch(e.target.value)} id="sessions-search" />
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
                        <thead><tr><th>WhatsApp</th><th>Experiencia</th><th>Paso actual</th><th>Estado</th><th>Inicio</th><th>Fin</th></tr></thead>
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
                    <div className="empty-state-title">{sessions.length === 0 ? 'Sin sesiones aún' : 'Sin resultados'}</div>
                    <p className="empty-state-text">
                        {sessions.length === 0
                            ? 'Las sesiones aparecerán aquí cuando los usuarios interactúen con tus experiencias por WhatsApp.'
                            : 'Probá con otros filtros de búsqueda.'}
                    </p>
                </div>
            ) : (
                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>WhatsApp</th>
                                <th>Experiencia</th>
                                <th>Paso actual</th>
                                <th>Estado</th>
                                <th>Inicio</th>
                                <th>Fin</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(sess => (
                                <tr key={sess.id}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(6,182,212,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--info)', flexShrink: 0 }}>
                                                <MessageSquare size={13} />
                                            </div>
                                            <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{sess.whatsapp_number}</span>
                                        </div>
                                    </td>
                                    <td style={{ color: 'var(--text-secondary)' }}>
                                        <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px', fontWeight: 500 }} onClick={() => router.push(`/dashboard/experiences/${sess.experience_id}`)}>
                                            {expMap[sess.experience_id] ?? 'Desconocida'}
                                        </button>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <span style={{ background: 'var(--bg-elevated)', padding: '2px 10px', borderRadius: 100, fontSize: 12, fontWeight: 700 }}>{sess.current_step}</span>
                                    </td>
                                    <td>
                                        <span className={`badge badge-${sess.status}`}>
                                            {statusIcon(sess.status)} {statusLabel(sess.status)}
                                        </span>
                                    </td>
                                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(sess.started_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                        {sess.finished_at ? new Date(sess.finished_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                                    </td>
                                    <td>
                                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => router.push(`/dashboard/experiences/${sess.experience_id}/metrics`)} title="Ver métricas">
                                            <ExternalLink size={13} />
                                        </button>
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
