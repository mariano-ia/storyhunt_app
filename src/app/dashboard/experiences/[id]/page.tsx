'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    ArrowLeft, Check, Plus, Trash2, Edit2, GripVertical, Clock,
    BarChart2, Save, Play, Share2, X, Copy, ExternalLink, Zap
} from 'lucide-react';
import {
    getExperience, updateExperience, getSteps, createStep, updateStep, deleteStep, reorderSteps
} from '@/lib/firestore';
import ConfirmModal from '@/components/ConfirmModal';
import type { Experience, ExperienceFormData, Step, StepFormData } from '@/lib/types';

// ─── Share Modal ──────────────────────────────────────────────────────────────
function ShareModal({ id, name, onClose }: { id: string; name: string; onClose: () => void }) {
    const [copied, setCopied] = useState(false);
    const url = typeof window !== 'undefined'
        ? `${window.location.origin}/play/${id}`
        : `/play/${id}`;

    const handleCopy = () => {
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }} onClick={onClose}>
            <div style={{
                background: 'var(--bg-card)', border: '1px solid var(--border-default)',
                borderRadius: 16, padding: 28, maxWidth: 480, width: '100%',
                boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
            }} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                            width: 40, height: 40, borderRadius: 10,
                            background: 'linear-gradient(135deg, var(--brand-primary) 0%, #a855f7 100%)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <Share2 size={18} style={{ color: '#fff' }} />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                                Compartir experiencia
                            </h3>
                            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                                {name}
                            </p>
                        </div>
                    </div>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}>
                        <X size={16} />
                    </button>
                </div>

                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
                    Compartí este link para que cualquier persona pueda vivir la experiencia desde el navegador, sin necesidad de WhatsApp ni cuenta.
                </p>

                {/* Link box */}
                <div style={{
                    display: 'flex', gap: 8, alignItems: 'center',
                    background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                    borderRadius: 10, padding: '10px 14px',
                    marginBottom: 16,
                }}>
                    <span style={{
                        flex: 1, fontSize: 13, color: 'var(--text-secondary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        fontFamily: 'monospace',
                    }}>
                        {url}
                    </span>
                    <button
                        className="btn btn-ghost btn-sm btn-icon"
                        onClick={handleCopy}
                        title="Copiar link"
                        style={{ flexShrink: 0, color: copied ? 'var(--success)' : undefined }}
                    >
                        {copied ? <Check size={15} /> : <Copy size={15} />}
                    </button>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        className="btn btn-primary"
                        onClick={handleCopy}
                        style={{ flex: 1 }}
                    >
                        {copied ? <><Check size={14} /> Copiado!</> : <><Copy size={14} /> Copiar link</>}
                    </button>
                    <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary"
                        title="Abrir en nueva pestaña"
                    >
                        <ExternalLink size={15} />
                    </a>
                </div>
            </div>
        </div>
    );
}

// ─── Inline Step Editor with Auto-Save ────────────────────────────────────────
function InlineStepEditor({ step, index, onSave, onDelete, isDragging, isDragOver, onDragStart, onDragOver, onDrop, onDragEnd }: {
    step: Step; index: number;
    onSave: (data: Partial<StepFormData>) => Promise<void>;
    onDelete: () => void;
    isDragging: boolean; isDragOver: boolean;
    onDragStart: () => void; onDragOver: (e: React.DragEvent) => void;
    onDrop: () => void; onDragEnd: () => void;
}) {
    const [editing, setEditing] = useState(false);
    const [localDelay, setLocalDelay] = useState(step.delay_seconds ?? 1.2);
    const [form, setForm] = useState<StepFormData>({
        order: step.order,
        message_to_send: step.message_to_send,
        requires_response: step.requires_response ?? true,
        expected_answer: step.expected_answer,
        hints: step.hints,
        wrong_answer_message: step.wrong_answer_message,
        context: step.context || '',
        delay_seconds: step.delay_seconds ?? 1.2,
        media_url: step.media_url || '',
        media_type: step.media_type || undefined,
        interrupted_typing: step.interrupted_typing || false,
        glitch_effect: step.glitch_effect || false,
        step_type: step.step_type || (step.requires_response ? 'interactive' : (step.interrupted_typing && !step.message_to_send ? 'typing' : 'narrative')),
    });
    const [autoSaveState, setAutoSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isFirstRender = useRef(true);

    // Auto-save with 1.5s debounce whenever form changes while editing
    const triggerAutoSave = useCallback((newForm: StepFormData) => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        setAutoSaveState('saving');
        debounceRef.current = setTimeout(async () => {
            await onSave(newForm);
            setAutoSaveState('saved');
            setTimeout(() => setAutoSaveState('idle'), 2000);
        }, 1500);
    }, [onSave]);

    const handleFormChange = (newForm: StepFormData) => {
        setForm(newForm);
        if (editing) triggerAutoSave(newForm);
    };

    // Cleanup on unmount
    useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

    if (!editing) {
        const isNarrative = !(step.requires_response ?? true);
        return (
            <div
                className="step-item"
                draggable
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDrop={onDrop}
                onDragEnd={onDragEnd}
                style={{
                    borderColor: isDragOver ? 'var(--brand-primary)' : isNarrative ? 'rgba(167,139,250,0.3)' : undefined,
                    opacity: isDragging ? 0.4 : 1,
                    cursor: 'grab',
                    transition: 'opacity 0.15s, border-color 0.15s',
                }}
            >
                <div className="step-item-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <GripVertical size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        <div className="step-item-number">{index + 1}</div>
                        <div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                                {step.message_to_send.slice(0, 70)}{step.message_to_send.length > 70 ? '…' : ''}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                                {step.step_type === 'typing' || (step.interrupted_typing && !step.message_to_send)
                                    ? <span style={{ color: 'var(--brand-primary-light)' }}>💬 Sólo efecto de escritura</span>
                                    : isNarrative
                                        ? <span style={{ color: 'var(--brand-primary-light)' }}>📖 Narrativo — sin respuesta</span>
                                        : <>Espera: {step.expected_answer} &middot; {step.hints?.length || 0} pista(s)</>}
                            </div>
                        </div>
                    </div>
                    <div className="step-item-actions" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {/* Inline delay editor */}
                        <div
                            style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'default' }}
                            onClick={e => e.stopPropagation()}
                            onDragStart={e => e.preventDefault()}
                        >
                            <Clock size={13} style={{ color: 'var(--text-muted)' }} />
                            <input
                                type="number" step="0.1" min="0"
                                value={localDelay}
                                onChange={e => setLocalDelay(parseFloat(e.target.value) || 0)}
                                onBlur={() => {
                                    setForm(f => ({ ...f, delay_seconds: localDelay }));
                                    onSave({ delay_seconds: localDelay });
                                }}
                                style={{
                                    width: 44, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                                    borderRadius: 6, color: 'var(--text-secondary)', fontSize: 12,
                                    padding: '2px 4px', outline: 'none', textAlign: 'center',
                                }}
                            />
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>s</span>
                        </div>
                        {/* Glitch toggle */}
                        <label
                            title="Efecto glitch"
                            style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 12, color: form.glitch_effect ? 'var(--brand-primary)' : 'var(--text-muted)' }}
                            onClick={e => e.stopPropagation()}
                        >
                            <input
                                type="checkbox"
                                checked={form.glitch_effect || false}
                                onChange={e => {
                                    const val = e.target.checked;
                                    setForm(f => ({ ...f, glitch_effect: val }));
                                    onSave({ glitch_effect: val });
                                }}
                                style={{ accentColor: 'var(--brand-primary)', width: 13, height: 13 }}
                            />
                            ⚡
                        </label>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setEditing(true)} id={`edit-step-${step.id}`}><Edit2 size={14} /></button>
                        <button className="btn btn-danger btn-icon btn-sm" onClick={onDelete} id={`del-step-${step.id}`}><Trash2 size={14} /></button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="step-item" style={{ borderColor: 'var(--border-brand)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Tipo de Paso</label>
                    <select
                        className="form-input"
                        value={form.step_type || (form.requires_response ? 'interactive' : (form.interrupted_typing && !form.message_to_send ? 'typing' : 'narrative'))}
                        onChange={e => {
                            const val = e.target.value as 'interactive' | 'narrative' | 'typing';
                            handleFormChange({
                                ...form,
                                step_type: val,
                                requires_response: val === 'interactive',
                                interrupted_typing: val === 'typing' ? true : false,
                                message_to_send: val === 'typing' ? '' : form.message_to_send
                            });
                        }}
                    >
                        <option value="interactive">Paso Interactivo (espera respuesta)</option>
                        <option value="narrative">Paso Narrativo (avanza automáticamente)</option>
                        <option value="typing">Efecto "Escribiendo" (solo genera intriga, sin mensaje)</option>
                    </select>
                </div>

                {form.step_type !== 'typing' && (
                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Mensaje a enviar <span className="required">*</span></label>
                        <textarea className="form-textarea" style={{ minHeight: 80 }} value={form.message_to_send} onChange={e => handleFormChange({ ...form, message_to_send: e.target.value })} />
                    </div>
                )}

                {form.step_type !== 'typing' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">Agregar Multimedia (Opcional)</label>
                            <select className="form-input" value={form.media_type || ''} onChange={e => handleFormChange({ ...form, media_type: e.target.value as any || undefined, media_url: e.target.value ? form.media_url : undefined })}>
                                <option value="">Sin multimedia</option>
                                <option value="image">Imagen</option>
                                <option value="video">Ver video</option>
                                <option value="audio">Audio</option>
                            </select>
                        </div>
                        {form.media_type && (
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label">URL del archivo</label>
                                <input className="form-input" placeholder="https://..." value={form.media_url || ''} onChange={e => handleFormChange({ ...form, media_url: e.target.value })} />
                            </div>
                        )}
                    </div>
                )}
                {form.step_type !== 'typing' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                            <input
                                type="checkbox"
                                id={`interrupted-typing-edit-${step.id}`}
                                checked={form.interrupted_typing || false}
                                onChange={e => handleFormChange({ ...form, interrupted_typing: e.target.checked })}
                                style={{ width: 16, height: 16, accentColor: 'var(--brand-primary)', cursor: 'pointer' }}
                            />
                            <label htmlFor={`interrupted-typing-edit-${step.id}`} style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}>
                                Agregar efecto "Escribió y borró" (Escribiendo...) antes del mensaje
                            </label>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>— Genera intriga</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                            <input
                                type="checkbox"
                                id={`glitch-effect-edit-${step.id}`}
                                checked={form.glitch_effect || false}
                                onChange={e => { handleFormChange({ ...form, glitch_effect: e.target.checked }); setLocalDelay(form.delay_seconds ?? 1.2); }}
                                style={{ width: 16, height: 16, accentColor: 'var(--brand-primary)', cursor: 'pointer' }}
                            />
                            <label htmlFor={`glitch-effect-edit-${step.id}`} style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}>
                                ⚡ Efecto glitch al aparecer el mensaje
                            </label>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>— Falla de la matrix</span>
                        </div>
                    </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Contexto heredable (Opcional)</label>
                        <input className="form-input" placeholder="Ej: Usa un tono muy urgente. El jugador está en Grand Central." value={form.context} onChange={e => handleFormChange({ ...form, context: e.target.value })} />
                        <span className="form-hint" style={{ fontSize: 11, marginTop: 4, display: 'block', color: 'var(--text-muted)' }}>Mantiene este contexto hasta el próximo paso con contexto.</span>
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Delay antes de enviar (segundos)</label>
                        <input className="form-input" type="number" step="0.1" min="0" value={form.delay_seconds} onChange={e => handleFormChange({ ...form, delay_seconds: parseFloat(e.target.value) || 0 })} />
                        <span className="form-hint" style={{ fontSize: 11, marginTop: 4, display: 'block', color: 'var(--text-muted)' }}>Tiempo de espera para enviar este mensaje.</span>
                    </div>
                </div>

                {form.requires_response && (
                    <>
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">Respuesta esperada <span className="required">*</span></label>
                            <input className="form-input" value={form.expected_answer} onChange={e => handleFormChange({ ...form, expected_answer: e.target.value })} />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">Mensaje si respuesta incorrecta</label>
                            <input className="form-input" value={form.wrong_answer_message} onChange={e => handleFormChange({ ...form, wrong_answer_message: e.target.value })} />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">Pistas</label>
                            {form.hints.map((h, i) => (
                                <div className="hint-row" key={i} style={{ marginBottom: 6 }}>
                                    <input className="form-input" value={h} onChange={e => handleFormChange({ ...form, hints: form.hints.map((hh, ii) => ii === i ? e.target.value : hh) })} />
                                    <button className="btn btn-ghost btn-icon btn-sm" type="button" onClick={() => handleFormChange({ ...form, hints: form.hints.filter((_, ii) => ii !== i) })}><Trash2 size={13} /></button>
                                </div>
                            ))}
                            <button className="btn btn-ghost btn-sm" type="button" onClick={() => handleFormChange({ ...form, hints: [...form.hints, ''] })} style={{ color: 'var(--text-brand)' }}><Plus size={13} /> Agregar pista</button>
                        </div>
                    </>
                )}

                <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
                    {/* Auto-save indicator */}
                    <span style={{
                        fontSize: 12,
                        color: autoSaveState === 'saved' ? 'var(--success)' : 'var(--text-muted)',
                        display: 'flex', alignItems: 'center', gap: 5,
                        transition: 'color 0.3s',
                    }}>
                        {autoSaveState === 'saving' && <span style={{ opacity: 0.6 }}>Guardando...</span>}
                        {autoSaveState === 'saved' && <><Check size={12} /> Auto-guardado</>}
                    </span>
                    <button
                        className="btn btn-secondary btn-sm"
                        type="button"
                        onClick={() => setEditing(false)}
                    >
                        Listo
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Tabs ──────────────────────────────────────────────────────────
function TabNav({ active, onChange }: { active: string; onChange: (t: string) => void }) {
    return (
        <div className="tab-nav">
            {['general', 'pasos', 'tecnico'].map(tab => (
                <button key={tab} className={`tab-btn ${active === tab ? 'active' : ''}`} onClick={() => onChange(tab)} id={`tab-${tab}`}>
                    {tab === 'general' ? 'Información General' : tab === 'pasos' ? 'Pasos' : 'Configuración Técnica'}
                </button>
            ))}
        </div>
    );
}

// ─── Main page ────────────────────────────────────────────────────
export default function ExperienceDetailPage() {
    const { id } = useParams() as { id: string };
    const router = useRouter();
    const [exp, setExp] = useState<Experience | null>(null);
    const [steps, setSteps] = useState<Step[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('general');
    const [formData, setFormData] = useState<Partial<ExperienceFormData>>({});
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [newStep, setNewStep] = useState<StepFormData | null>(null);
    const [toDeleteStep, setToDeleteStep] = useState<Step | null>(null);
    const [deletingStep, setDeletingStep] = useState(false);
    const [showShare, setShowShare] = useState(false);
    const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
    const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

    const load = async () => {
        setLoading(true);
        const [e, s] = await Promise.all([getExperience(id), getSteps(id)]);
        if (e) { setExp(e); setFormData(e); }
        setSteps(s);
        setLoading(false);
    };

    useEffect(() => { load(); }, [id]);

    const handleSaveGeneral = async () => {
        if (!exp) return;
        setSaving(true);
        await updateExperience(id, formData as ExperienceFormData);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
        setSaving(false);
    };

    const handleDrop = async (dropIdx: number) => {
        if (draggedIdx === null || draggedIdx === dropIdx) {
            setDraggedIdx(null); setDragOverIdx(null); return;
        }
        const s = [...steps];
        const [removed] = s.splice(draggedIdx, 1);
        s.splice(dropIdx, 0, removed);
        const reordered = s.map((st, idx) => ({ ...st, order: idx + 1 }));
        setSteps(reordered);
        setDraggedIdx(null); setDragOverIdx(null);
        await reorderSteps(id, reordered);
    };

    const handleAddStep = async () => {
        if (!newStep) return;
        await createStep(id, { ...newStep, order: steps.length + 1 });
        setNewStep(null);
        load();
    };

    const handleDeleteStep = async () => {
        if (!toDeleteStep) return;
        setDeletingStep(true);
        await deleteStep(id, toDeleteStep.id);
        setToDeleteStep(null);
        setDeletingStep(false);
        load();
    };

    if (loading) return (
        <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 12 }} />)}
            </div>
        </div>
    );

    if (!exp) return <div style={{ color: 'var(--text-secondary)', padding: 40, textAlign: 'center' }}>Experiencia no encontrada.</div>;

    return (
        <div>
            <div className="page-header" style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--bg-canvas)', borderBottom: '1px solid var(--border-subtle)', marginBottom: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button className="btn btn-ghost btn-icon" onClick={() => router.push('/dashboard/experiences')}><ArrowLeft size={18} /></button>
                    <div>
                        <h1 className="page-title">{exp.name}</h1>
                        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                            <span className={`badge badge-${exp.status}`}>{exp.status === 'active' ? 'Activa' : 'Inactiva'}</span>
                            <span className={`badge badge-${exp.mode}`}>{exp.mode === 'test' ? 'Prueba' : 'Producción'}</span>
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        className="btn btn-secondary"
                        onClick={() => {
                            if (!exp.slug) {
                                alert("Por favor, guardá un slug válido en la pestaña 'General' primero.");
                                return;
                            }
                            window.open(`/${exp.slug}`, '_blank');
                        }}
                        id="publish-btn"
                        title="Ver experiencia publicada"
                    >
                        <ExternalLink size={15} /> Publicar
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={() => setShowShare(true)}
                        id="share-btn"
                        title="Compartir experiencia"
                    >
                        <Share2 size={15} /> Compartir
                    </button>
                    <button className="btn btn-primary" onClick={() => router.push(`/dashboard/experiences/${id}/preview`)} id="preview-btn">
                        <Play size={15} /> Probar
                    </button>
                    <button className="btn btn-secondary" onClick={() => router.push(`/dashboard/experiences/${id}/metrics`)} id="view-metrics-btn">
                        <BarChart2 size={15} /> Métricas
                    </button>
                </div>
            </div>

            <TabNav active={tab} onChange={setTab} />

            {/* General Tab */}
            {tab === 'general' && (
                <div style={{ maxWidth: 640 }}>
                    <div className="section-header">
                        <h2>Información General</h2>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Nombre de la experiencia <span className="required">*</span></label>
                        <input className="form-input" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">URL pública (Slug) <span className="required">*</span></label>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <span style={{ padding: '0 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRight: 'none', borderRadius: '8px 0 0 8px', color: 'var(--text-muted)', fontSize: 14 }}>midominio.com/</span>
                            <input className="form-input" style={{ borderRadius: '0 8px 8px 0' }} placeholder="mi-experiencia" value={formData.slug || ''} onChange={e => {
                                const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
                                setFormData({ ...formData, slug: val });
                            }} />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Descripción <span className="required">*</span></label>
                        <textarea className="form-textarea" value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} style={{ minHeight: 80 }} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Personalidad del narrador</label>
                        <textarea className="form-textarea" style={{ minHeight: 140 }} value={formData.narrator_personality || ''} onChange={e => setFormData({ ...formData, narrator_personality: e.target.value })} />
                        <span className="form-hint">Este texto define la personalidad y objetivos del asistente que acompaña al jugador.</span>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Foto de perfil del narrador (Opcional)</label>
                        <input className="form-input" placeholder="https://ejemplo.com/foto.jpg" value={formData.narrator_avatar || ''} onChange={e => setFormData({ ...formData, narrator_avatar: e.target.value })} />
                        <span className="form-hint">URL de la imagen que se mostrará en el chat (avatar redondo).</span>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Palabra clave de activación <span className="required">*</span></label>
                        <input className="form-input" value={formData.activation_keyword || ''} onChange={e => setFormData({ ...formData, activation_keyword: e.target.value.toUpperCase() })} />
                        <span className="form-hint">El usuario envía esto para comenzar.</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-primary" onClick={handleSaveGeneral} disabled={saving} id="save-general-btn">
                            {saved ? <><Check size={15} /> Guardado</> : saving ? 'Guardando...' : <><Save size={15} /> Guardar cambios</>}
                        </button>
                    </div>
                </div>
            )}

            {/* Steps Tab */}
            {tab === 'pasos' && (
                <div>
                    {steps.length === 0 && !newStep && (
                        <div className="empty-state">
                            <div className="empty-state-icon"><GripVertical size={24} /></div>
                            <div className="empty-state-title">Sin pasos</div>
                            <p className="empty-state-text">Esta experiencia no tiene pasos. Agregá el primero.</p>
                        </div>
                    )}
                    {steps.map((step, i) => (
                        <InlineStepEditor
                            key={step.id} step={step} index={i}
                            onSave={async (data) => { await updateStep(id, step.id, data); }}
                            onDelete={() => setToDeleteStep(step)}
                            isDragging={draggedIdx === i}
                            isDragOver={dragOverIdx === i}
                            onDragStart={() => setDraggedIdx(i)}
                            onDragOver={(e) => { e.preventDefault(); setDragOverIdx(i); }}
                            onDrop={() => handleDrop(i)}
                            onDragEnd={() => { setDraggedIdx(null); setDragOverIdx(null); }}
                        />
                    ))}
                    {newStep ? (
                        <div className="step-item" style={{ borderColor: 'var(--border-brand)' }}>
                            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: 'var(--text-brand)' }}>Nuevo paso #{steps.length + 1}</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label">Tipo de Paso</label>
                                    <select
                                        className="form-input"
                                        value={newStep.step_type || (newStep.requires_response ? 'interactive' : (newStep.interrupted_typing && !newStep.message_to_send ? 'typing' : 'narrative'))}
                                        onChange={e => {
                                            const val = e.target.value as 'interactive' | 'narrative' | 'typing';
                                            setNewStep({
                                                ...newStep,
                                                step_type: val,
                                                requires_response: val === 'interactive',
                                                interrupted_typing: val === 'typing' ? true : false,
                                                message_to_send: val === 'typing' ? '' : newStep.message_to_send
                                            });
                                        }}
                                    >
                                        <option value="interactive">Paso Interactivo (espera respuesta)</option>
                                        <option value="narrative">Paso Narrativo (avanza automáticamente)</option>
                                        <option value="typing">Efecto "Escribiendo" (solo genera intriga, sin mensaje)</option>
                                    </select>
                                </div>

                                {newStep.step_type !== 'typing' && (
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label className="form-label">Mensaje a enviar <span className="required">*</span></label>
                                        <textarea className="form-textarea" style={{ minHeight: 80 }} value={newStep.message_to_send} onChange={e => setNewStep({ ...newStep, message_to_send: e.target.value })} />
                                    </div>
                                )}

                                {newStep.step_type !== 'typing' && (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                        <div className="form-group" style={{ margin: 0 }}>
                                            <label className="form-label">Agregar Multimedia (Opcional)</label>
                                            <select className="form-input" value={newStep.media_type || ''} onChange={e => setNewStep({ ...newStep, media_type: e.target.value as any || undefined, media_url: e.target.value ? newStep.media_url : undefined })}>
                                                <option value="">Sin multimedia</option>
                                                <option value="image">Imagen</option>
                                                <option value="video">Ver video</option>
                                                <option value="audio">Audio</option>
                                            </select>
                                        </div>
                                        {newStep.media_type && (
                                            <div className="form-group" style={{ margin: 0 }}>
                                                <label className="form-label">URL del archivo</label>
                                                <input className="form-input" placeholder="https://..." value={newStep.media_url || ''} onChange={e => setNewStep({ ...newStep, media_url: e.target.value })} />
                                            </div>
                                        )}
                                    </div>
                                )}

                                {newStep.step_type !== 'typing' && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                                        <input
                                            type="checkbox"
                                            id="interrupted-typing-new"
                                            checked={newStep.interrupted_typing || false}
                                            onChange={e => setNewStep({ ...newStep, interrupted_typing: e.target.checked })}
                                            style={{ width: 16, height: 16, accentColor: 'var(--brand-primary)', cursor: 'pointer' }}
                                        />
                                        <label htmlFor="interrupted-typing-new" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}>
                                            Agregar efecto "Escribió y borró" (Escribiendo...) antes del mensaje
                                        </label>
                                    </div>
                                )}
                                {newStep.step_type !== 'typing' && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                                        <input
                                            type="checkbox"
                                            id="glitch-effect-new"
                                            checked={newStep.glitch_effect || false}
                                            onChange={e => setNewStep({ ...newStep, glitch_effect: e.target.checked })}
                                            style={{ width: 16, height: 16, accentColor: 'var(--brand-primary)', cursor: 'pointer' }}
                                        />
                                        <label htmlFor="glitch-effect-new" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}>
                                            ⚡ Efecto glitch al aparecer el mensaje
                                        </label>
                                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>— Falla de la matrix</span>
                                    </div>
                                )}

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label className="form-label">Contexto heredable (Opcional)</label>
                                        <input className="form-input" placeholder="Ej: Usa un tono muy urgente..." value={newStep.context} onChange={e => setNewStep({ ...newStep, context: e.target.value })} />
                                    </div>

                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label className="form-label">Delay (segundos)</label>
                                        <input className="form-input" type="number" step="0.1" min="0" value={newStep.delay_seconds} onChange={e => setNewStep({ ...newStep, delay_seconds: parseFloat(e.target.value) || 0 })} />
                                    </div>
                                </div>
                                {newStep.requires_response && (
                                    <>
                                        <div className="form-group" style={{ margin: 0 }}>
                                            <label className="form-label">Respuesta esperada <span className="required">*</span></label>
                                            <input className="form-input" value={newStep.expected_answer} onChange={e => setNewStep({ ...newStep, expected_answer: e.target.value })} />
                                        </div>
                                        <div className="form-group" style={{ margin: 0 }}>
                                            <label className="form-label">Mensaje si respuesta incorrecta</label>
                                            <input className="form-input" value={newStep.wrong_answer_message} onChange={e => setNewStep({ ...newStep, wrong_answer_message: e.target.value })} />
                                        </div>
                                    </>
                                )}
                                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                    <button className="btn btn-secondary btn-sm" onClick={() => setNewStep(null)}>Cancelar</button>
                                    <button
                                        className="btn btn-primary btn-sm"
                                        onClick={handleAddStep}
                                        disabled={(newStep.step_type !== 'typing' && !newStep.message_to_send) || (newStep.requires_response && !newStep.expected_answer)}
                                        id="save-new-step-btn"
                                    >
                                        <Check size={13} /> Guardar paso
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <button className="btn btn-secondary" onClick={() => setNewStep({ order: steps.length + 1, message_to_send: '', requires_response: true, step_type: 'interactive', expected_answer: '', hints: [], wrong_answer_message: '', context: '', delay_seconds: 1.2, interrupted_typing: false, glitch_effect: false })} id="add-new-step-btn">
                            <Plus size={16} /> Agregar paso
                        </button>
                    )}
                </div>
            )}

            {/* Technical Tab */}
            {tab === 'tecnico' && (
                <div style={{ maxWidth: 640 }}>
                    <div className="form-group">
                        <label className="form-label">API Key del LLM</label>
                        <input className="form-input" type="password" value={formData.llm_api_key || ''} onChange={e => setFormData({ ...formData, llm_api_key: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Modo de operación</label>
                        <div className="toggle-group" style={{ maxWidth: 300 }}>
                            <button type="button" className={`toggle-option ${formData.mode === 'test' ? 'active' : ''}`} onClick={() => setFormData({ ...formData, mode: 'test' })}>🧪 Prueba</button>
                            <button type="button" className={`toggle-option ${formData.mode === 'production' ? 'active' : ''}`} onClick={() => setFormData({ ...formData, mode: 'production' })}>🚀 Producción</button>
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Estado</label>
                        <div className="toggle-group" style={{ maxWidth: 300 }}>
                            <button type="button" className={`toggle-option ${formData.status === 'active' ? 'active' : ''}`} onClick={() => setFormData({ ...formData, status: 'active' })}>✅ Activa</button>
                            <button type="button" className={`toggle-option ${formData.status === 'inactive' ? 'active' : ''}`} onClick={() => setFormData({ ...formData, status: 'inactive' })}>⏸ Inactiva</button>
                        </div>
                    </div>
                    <button className="btn btn-primary" onClick={handleSaveGeneral} disabled={saving} id="save-tech-btn">
                        {saved ? <><Check size={15} /> Guardado</> : saving ? 'Guardando...' : <><Save size={15} /> Guardar cambios</>}
                    </button>
                </div>
            )}

            {toDeleteStep && (
                <ConfirmModal
                    title="Eliminar paso"
                    message={`¿Eliminás el paso #${toDeleteStep.order}? Esta acción no se puede deshacer.`}
                    onConfirm={handleDeleteStep}
                    onCancel={() => setToDeleteStep(null)}
                    loading={deletingStep}
                />
            )}

            {showShare && exp && (
                <ShareModal id={id} name={exp.name} onClose={() => setShowShare(false)} />
            )}
        </div>
    );
}
