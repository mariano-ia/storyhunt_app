'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Edit2, Trash2, BarChart2, Zap, Search, CheckCircle, XCircle, DollarSign, Play, Share2, Check } from 'lucide-react';
import { getExperiences, deleteExperience, getCostByExperience } from '@/lib/firestore';
import ConfirmModal from '@/components/ConfirmModal';
import type { Experience } from '@/lib/types';

export default function ExperiencesPage() {
    const router = useRouter();
    const [experiences, setExperiences] = useState<Experience[]>([]);
    const [costMap, setCostMap] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [toDelete, setToDelete] = useState<Experience | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const handleShare = (expId: string) => {
        const url = `${window.location.origin}/play/${expId}`;
        navigator.clipboard.writeText(url);
        setCopiedId(expId);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const load = async () => {
        setLoading(true);
        const [data, costs] = await Promise.all([getExperiences(), getCostByExperience()]);
        setExperiences(data);
        setCostMap(costs);
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const filtered = experiences.filter(e =>
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        e.description.toLowerCase().includes(search.toLowerCase())
    );

    const handleDelete = async () => {
        if (!toDelete) return;
        setDeleting(true);
        await deleteExperience(toDelete.id);
        setToDelete(null);
        setDeleting(false);
        load();
    };

    const statusLabel = (s: string) => s === 'active' ? 'Activa' : 'Inactiva';
    const modeLabel = (m: string) => m === 'test' ? 'Prueba' : 'Producción';
    const fmtCost = (c: number) => c > 0 ? `$${c.toFixed(4)}` : '—';

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Experiencias</h1>
                    <p className="page-subtitle">Administrá todas tus experiencias interactivas</p>
                </div>
                <button className="btn btn-primary" onClick={() => router.push('/dashboard/experiences/new')} id="new-experience-btn">
                    <Plus size={16} /> Nueva Experiencia
                </button>
            </div>

            {/* Search */}
            <div style={{ position: 'relative', marginBottom: 24, maxWidth: 400 }}>
                <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                    className="form-input"
                    style={{ paddingLeft: 36 }}
                    placeholder="Buscar experiencias..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    id="experiences-search"
                />
            </div>

            {loading ? (
                <div className="table-wrapper">
                    <table>
                        <thead><tr><th>Nombre</th><th>Estado</th><th>Modo</th><th>Keyword</th><th>Costo LLM</th><th>Creada</th><th>Acciones</th></tr></thead>
                        <tbody>
                            {[1, 2, 3].map(i => (
                                <tr key={i}>
                                    {[1, 2, 3, 4, 5, 6, 7].map(j => (
                                        <td key={j}><div className="skeleton" style={{ height: 16, borderRadius: 4, width: j === 1 ? 140 : 80 }} /></td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : filtered.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon"><Zap size={26} /></div>
                    <div className="empty-state-title">{search ? 'Sin resultados' : 'Aún no hay experiencias'}</div>
                    <p className="empty-state-text">
                        {search
                            ? 'Intentá con otro término de búsqueda.'
                            : 'Creá tu primera experiencia interactiva por WhatsApp.'}
                    </p>
                    {!search && (
                        <button className="btn btn-primary" onClick={() => router.push('/dashboard/experiences/new')}>
                            <Plus size={16} /> Crear primera experiencia
                        </button>
                    )}
                </div>
            ) : (
                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Nombre</th>
                                <th>Estado</th>
                                <th>Modo</th>
                                <th>Palabra clave</th>
                                <th>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <DollarSign size={13} /> Costo LLM
                                    </span>
                                </th>
                                <th>Creada</th>
                                <th style={{ textAlign: 'right' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(exp => (
                                <tr key={exp.id}>
                                    <td>
                                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{exp.name}</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{exp.description.slice(0, 60)}{exp.description.length > 60 ? '…' : ''}</div>
                                    </td>
                                    <td>
                                        <span className={`badge badge-${exp.status}`}>
                                            {exp.status === 'active' ? <CheckCircle size={11} /> : <XCircle size={11} />}
                                            {statusLabel(exp.status)}
                                        </span>
                                    </td>
                                    <td><span className={`badge badge-${exp.mode}`}>{modeLabel(exp.mode)}</span></td>
                                    <td><code style={{ fontSize: 12, background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: 4, color: 'var(--text-brand)' }}>{exp.activation_keyword}</code></td>
                                    <td>
                                        <span style={{
                                            fontSize: 13,
                                            color: costMap[exp.id] > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
                                            fontVariantNumeric: 'tabular-nums',
                                        }}>
                                            {fmtCost(costMap[exp.id] ?? 0)}
                                        </span>
                                    </td>
                                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(exp.created_at).toLocaleDateString('es-AR')}</td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                            <button className="btn btn-ghost btn-icon btn-sm" title="Preview" onClick={() => router.push(`/dashboard/experiences/${exp.id}/preview`)} id={`preview-btn-${exp.id}`}>
                                                <Play size={15} />
                                            </button>
                                            <button
                                                className="btn btn-ghost btn-icon btn-sm"
                                                title={copiedId === exp.id ? '¡Link copiado!' : 'Compartir'}
                                                onClick={() => handleShare(exp.id)}
                                                id={`share-btn-${exp.id}`}
                                                style={{ color: copiedId === exp.id ? 'var(--success)' : undefined }}
                                            >
                                                {copiedId === exp.id ? <Check size={15} /> : <Share2 size={15} />}
                                            </button>
                                            <button className="btn btn-ghost btn-icon btn-sm" title="Métricas" onClick={() => router.push(`/dashboard/experiences/${exp.id}/metrics`)} id={`metrics-btn-${exp.id}`}>
                                                <BarChart2 size={15} />
                                            </button>
                                            <button className="btn btn-ghost btn-icon btn-sm" title="Editar" onClick={() => router.push(`/dashboard/experiences/${exp.id}`)} id={`edit-btn-${exp.id}`}>
                                                <Edit2 size={15} />
                                            </button>
                                            <button className="btn btn-danger btn-icon btn-sm" title="Eliminar" onClick={() => setToDelete(exp)} id={`delete-btn-${exp.id}`}>
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {toDelete && (
                <ConfirmModal
                    title="Eliminar experiencia"
                    message={`¿Estás seguro que querés eliminar "${toDelete.name}"? Se eliminarán también todos sus pasos. Esta acción no se puede deshacer.`}
                    onConfirm={handleDelete}
                    onCancel={() => setToDelete(null)}
                    loading={deleting}
                />
            )}
        </div>
    );
}
