'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    ArrowLeft, Check, Plus, Trash2, Edit2, GripVertical, Clock, ChevronDown, ChevronRight, BookOpen,
    BarChart2, Save, Play, Share2, X, Copy, ExternalLink, Zap
} from 'lucide-react';
import {
    getExperience, updateExperience, getSteps, createStep, updateStep, deleteStep, reorderSteps,
    getScenes, createScene, updateScene, deleteScene, reorderScenes, ensureScenesExist
} from '@/lib/firestore';
import ConfirmModal from '@/components/ConfirmModal';
import type { Experience, ExperienceFormData, Step, StepFormData, Scene, SceneFormData, Choice } from '@/lib/types';

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
// ─── Step type config ─────────────────────────────────────────────────────────
const STEP_COLORS: Record<string, string> = {
    interactive: 'var(--brand-primary)',
    narrative: 'var(--info)',
    typing: 'var(--text-muted)',
    choice: 'var(--warning)',
    error_screen: 'var(--danger)',
};
const STEP_LABELS: Record<string, string> = {
    interactive: 'Interactivo',
    narrative: 'Narrativo',
    typing: 'Escribiendo...',
    choice: 'Decisión',
    error_screen: 'Pantalla Error',
};

function InlineStepEditor({ step, index, onSave, onDelete, isDragging, isDragOver, onDragStart, onDragOver, onDrop, onDragEnd, scenes, onPlayFrom, globalStepIndex }: {
    step: Step; index: number;
    onSave: (data: Partial<StepFormData>) => Promise<void>;
    onDelete: () => void;
    isDragging: boolean; isDragOver: boolean;
    onDragStart: () => void; onDragOver: (e: React.DragEvent) => void;
    onDrop: () => void; onDragEnd: () => void;
    scenes: Scene[];
    onPlayFrom?: (stepIndex: number) => void;
    globalStepIndex: number;
}) {
    const [editing, setEditing] = useState(false);
    const [localDelay, setLocalDelay] = useState(step.delay_seconds ?? 1.2);
    const resolvedType = step.step_type || (step.requires_response ? 'interactive' : (step.interrupted_typing && !step.message_to_send ? 'typing' : 'narrative'));
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
        step_type: resolvedType,
        choices: step.choices?.length ? step.choices : (step.step_type === 'choice' ? [{ label: '', condition: '', target_scene_id: '' }] : undefined),
    });
    const [autoSaveState, setAutoSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const borderColor = STEP_COLORS[form.step_type || 'narrative'] || 'var(--border-default)';
    const typeLabel = STEP_LABELS[form.step_type || 'narrative'] || 'Paso';

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

    const handleTypeChange = (val: StepFormData['step_type']) => {
        const newForm = {
            ...form,
            step_type: val,
            requires_response: val === 'interactive' || val === 'choice',
            interrupted_typing: val === 'typing',
            message_to_send: val === 'typing' ? '' : form.message_to_send,
            choices: val === 'choice' ? (form.choices?.length ? form.choices : [{ label: '', condition: '', target_scene_id: '' }]) : form.choices,
        };
        setForm(newForm);
        triggerAutoSave(newForm);
    };

    useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

    // ─── Collapsed view ───────────────────────────────────────────────────────
    if (!editing) {
        return (
            <div
                draggable onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop} onDragEnd={onDragEnd}
                style={{
                    border: `1.5px solid ${isDragOver ? 'var(--brand-primary)' : borderColor}`,
                    borderRadius: 10, opacity: isDragging ? 0.4 : 1,
                    cursor: 'grab', transition: 'opacity 0.15s, border-color 0.15s',
                    background: 'var(--bg-card)', overflow: 'hidden',
                }}
            >
                {/* Type selector bar (outside card body) */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '6px 12px', borderBottom: `1px solid ${borderColor}22`,
                    background: `${borderColor}08`,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <GripVertical size={14} style={{ color: 'var(--text-muted)' }} />
                        <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-code)', color: 'var(--text-muted)' }}>#{index + 1}</span>
                        <select
                            value={form.step_type || 'narrative'}
                            onChange={e => { e.stopPropagation(); handleTypeChange(e.target.value as StepFormData['step_type']); }}
                            onClick={e => e.stopPropagation()}
                            onDragStart={e => e.preventDefault()}
                            style={{
                                background: 'transparent', border: 'none', cursor: 'pointer',
                                fontSize: 12, fontWeight: 600, color: borderColor,
                                outline: 'none', padding: '2px 4px',
                            }}
                        >
                            <option value="interactive">Interactivo</option>
                            <option value="narrative">Narrativo</option>
                            <option value="choice">Decisión</option>
                            <option value="error_screen">Pantalla Error</option>
                        </select>
                    </div>
                    {autoSaveState === 'saving' && <span style={{ fontSize: 10, color: 'var(--text-muted)', opacity: 0.6 }}>Guardando...</span>}
                    {autoSaveState === 'saved' && <span style={{ fontSize: 10, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 3 }}><Check size={10} /> Guardado</span>}
                </div>

                {/* Card body: message */}
                <div style={{ padding: '10px 14px' }}>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                        {form.step_type === 'typing'
                            ? <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Efecto de escritura</span>
                            : form.step_type === 'error_screen'
                                ? <span style={{ fontFamily: 'var(--font-code)', color: 'var(--danger)' }}>{step.message_to_send || '(sin texto)'}</span>
                                : step.message_to_send
                                    ? <>{step.message_to_send.slice(0, 120)}{step.message_to_send.length > 120 ? '...' : ''}</>
                                    : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>(sin mensaje)</span>}
                    </div>
                    {step.requires_response && step.step_type === 'interactive' && step.expected_answer && (
                        <div style={{ fontSize: 11, color: borderColor, marginTop: 4, opacity: 0.8 }}>
                            Espera: {step.expected_answer}
                        </div>
                    )}
                    {step.step_type === 'choice' && step.choices && (
                        <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                            {step.choices.map((ch, ci) => (
                                <span key={ci} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                                    {ch.label || '...'}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* Action bar */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 2,
                    padding: '4px 8px', borderTop: '1px solid var(--border-subtle)',
                    background: 'var(--bg-elevated)',
                }}>
                    {/* Delay */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginRight: 'auto', paddingLeft: 4 }}
                        onClick={e => e.stopPropagation()} onDragStart={e => e.preventDefault()}>
                        <Clock size={12} style={{ color: 'var(--text-muted)' }} />
                        <input type="number" step="0.1" min="0" value={localDelay}
                            onChange={e => setLocalDelay(parseFloat(e.target.value) || 0)}
                            onBlur={() => { setForm(f => ({ ...f, delay_seconds: localDelay })); onSave({ delay_seconds: localDelay }); }}
                            style={{ width: 38, background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)', fontSize: 11, padding: '1px 3px', outline: 'none', textAlign: 'center' }}
                        />
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>s</span>
                    </div>
                    {/* Glitch */}
                    <button className="btn btn-ghost btn-icon btn-sm" data-tip="Efecto glitch"
                        onClick={e => { e.stopPropagation(); const val = !form.glitch_effect; setForm(f => ({ ...f, glitch_effect: val })); onSave({ glitch_effect: val }); }}
                        style={{
                            color: form.glitch_effect ? 'var(--brand-primary)' : 'var(--text-muted)',
                            background: form.glitch_effect ? 'rgba(124,58,237,0.15)' : undefined,
                        }}>
                        <Zap size={13} />
                    </button>
                    {/* Interrupted typing */}
                    <button className="btn btn-ghost btn-icon btn-sm" data-tip="Escribió y borró"
                        onClick={e => { e.stopPropagation(); const val = !form.interrupted_typing; setForm(f => ({ ...f, interrupted_typing: val })); onSave({ interrupted_typing: val }); }}
                        style={{
                            color: form.interrupted_typing ? 'var(--info)' : 'var(--text-muted)',
                            background: form.interrupted_typing ? 'rgba(6,182,212,0.15)' : undefined,
                        }}>
                        <BookOpen size={13} />
                    </button>
                    {/* Play */}
                    <button className="btn btn-ghost btn-icon btn-sm" data-tip="Preview"
                        onClick={e => { e.stopPropagation(); onPlayFrom?.(globalStepIndex); }}
                        style={{ color: 'var(--success)' }}>
                        <Play size={13} />
                    </button>
                    {/* Edit */}
                    <button className="btn btn-ghost btn-icon btn-sm" data-tip="Editar"
                        onClick={() => setEditing(true)}>
                        <Edit2 size={13} />
                    </button>
                    {/* Delete */}
                    <button className="btn btn-ghost btn-icon btn-sm" data-tip="Eliminar"
                        onClick={onDelete} style={{ color: 'var(--danger)' }}>
                        <Trash2 size={13} />
                    </button>
                </div>
            </div>
        );
    }

    // ─── Expanded/editing view ────────────────────────────────────────────────
    return (
        <div style={{
            border: `1.5px solid ${borderColor}`,
            borderRadius: 10, background: 'var(--bg-card)', overflow: 'hidden',
        }}>
            {/* Type bar */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 14px', borderBottom: `1px solid ${borderColor}22`, background: `${borderColor}08`,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-code)', color: 'var(--text-muted)' }}>#{index + 1}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: borderColor }}>{typeLabel}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {autoSaveState === 'saving' && <span style={{ fontSize: 11, color: 'var(--text-muted)', opacity: 0.6 }}>Guardando...</span>}
                    {autoSaveState === 'saved' && <span style={{ fontSize: 11, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 3 }}><Check size={11} /> Guardado</span>}
                    <button className="btn btn-secondary btn-sm" type="button" onClick={() => setEditing(false)} style={{ fontSize: 12, padding: '3px 12px' }}>Cerrar</button>
                </div>
            </div>

            <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Message */}
                {form.step_type !== 'typing' && (
                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: 12 }}>
                            {form.step_type === 'error_screen' ? 'Texto de la pantalla' : 'Mensaje'}
                        </label>
                        <textarea className="form-textarea" style={{ minHeight: 70, fontSize: 13 }} value={form.message_to_send} onChange={e => handleFormChange({ ...form, message_to_send: e.target.value })} />
                    </div>
                )}

                {/* Multimedia */}
                {form.step_type !== 'typing' && form.step_type !== 'error_screen' && (
                    <div style={{ display: 'grid', gridTemplateColumns: form.media_type ? '1fr 1fr' : '1fr', gap: 12 }}>
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label" style={{ fontSize: 12 }}>Multimedia</label>
                            <select className="form-input" style={{ fontSize: 13 }} value={form.media_type || ''} onChange={e => handleFormChange({ ...form, media_type: e.target.value as any || undefined, media_url: e.target.value ? form.media_url : undefined })}>
                                <option value="">Sin multimedia</option>
                                <option value="image">Imagen</option>
                                <option value="video">Video</option>
                                <option value="audio">Audio</option>
                            </select>
                        </div>
                        {form.media_type && (
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label" style={{ fontSize: 12 }}>URL</label>
                                <input className="form-input" style={{ fontSize: 13 }} placeholder="https://..." value={form.media_url || ''} onChange={e => handleFormChange({ ...form, media_url: e.target.value })} />
                            </div>
                        )}
                    </div>
                )}

                {/* Context + Delay */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: 12 }}>Contexto para el narrador</label>
                        <input className="form-input" style={{ fontSize: 13 }} placeholder="Ej: El jugador está en Grand Central." value={form.context} onChange={e => handleFormChange({ ...form, context: e.target.value })} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: 12 }}>Delay</label>
                        <input className="form-input" type="number" step="0.1" min="0" value={form.delay_seconds} onChange={e => handleFormChange({ ...form, delay_seconds: parseFloat(e.target.value) || 0 })} style={{ width: 70, fontSize: 13 }} />
                    </div>
                </div>

                {/* Choice options */}
                {form.step_type === 'choice' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <label className="form-label" style={{ fontSize: 12 }}>Opciones</label>
                        {(form.choices || []).map((ch, ci) => (
                            <div key={ci} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 6, alignItems: 'end' }}>
                                <input className="form-input" style={{ fontSize: 12 }} placeholder="Etiqueta" value={ch.label} onChange={e => {
                                    const choices = [...(form.choices || [])]; choices[ci] = { ...choices[ci], label: e.target.value }; handleFormChange({ ...form, choices });
                                }} />
                                <input className="form-input" style={{ fontSize: 12 }} placeholder="Condición LLM" value={ch.condition} onChange={e => {
                                    const choices = [...(form.choices || [])]; choices[ci] = { ...choices[ci], condition: e.target.value }; handleFormChange({ ...form, choices });
                                }} />
                                <select className="form-input" style={{ fontSize: 12 }} value={ch.target_scene_id || ''} onChange={e => {
                                    const choices = [...(form.choices || [])]; choices[ci] = { ...choices[ci], target_scene_id: e.target.value || undefined }; handleFormChange({ ...form, choices });
                                }}>
                                    <option value="">Escena destino</option>
                                    {scenes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => {
                                    handleFormChange({ ...form, choices: (form.choices || []).filter((_, i) => i !== ci) });
                                }}><Trash2 size={12} /></button>
                            </div>
                        ))}
                        <button className="btn btn-ghost btn-sm" type="button" style={{ color: 'var(--text-brand)', alignSelf: 'flex-start', fontSize: 12 }} onClick={() => handleFormChange({ ...form, choices: [...(form.choices || []), { label: '', condition: '', target_scene_id: '' }] })}>
                            <Plus size={12} /> Agregar opción
                        </button>
                    </div>
                )}

                {/* Interactive: expected answer */}
                {form.requires_response && form.step_type !== 'choice' && (
                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: 12 }}>Intención esperada</label>
                        <input className="form-input" style={{ fontSize: 13 }} placeholder="Ej: que confirme, que mencione el lugar, cualquier respuesta" value={form.expected_answer} onChange={e => handleFormChange({ ...form, expected_answer: e.target.value })} />
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3, display: 'block' }}>El narrador guía al usuario si la respuesta no cumple esta intención.</span>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── New Step Form ────────────────────────────────────────────────────────────
function NewStepForm({ data, onChange, onSave, onCancel, scenes }: {
    data: StepFormData;
    onChange: (d: StepFormData) => void;
    onSave: () => void;
    onCancel: () => void;
    scenes: Scene[];
}) {
    const d = data;
    const set = (patch: Partial<StepFormData>) => onChange({ ...d, ...patch });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Tipo de Paso</label>
                <select
                    className="form-input"
                    value={d.step_type || 'interactive'}
                    onChange={e => {
                        const val = e.target.value as StepFormData['step_type'];
                        set({
                            step_type: val,
                            requires_response: val === 'interactive' || val === 'choice',
                            interrupted_typing: val === 'typing',
                            message_to_send: val === 'typing' ? '' : d.message_to_send,
                            choices: val === 'choice' ? (d.choices?.length ? d.choices : [{ label: '', condition: '', target_scene_id: '' }]) : undefined,
                        });
                    }}
                >
                    <option value="interactive">Interactivo (espera respuesta)</option>
                    <option value="narrative">Narrativo (avanza automáticamente)</option>
                    <option value="choice">Elección / Condicional (bifurca el flujo)</option>
                    <option value="error_screen">Pantalla de Error (terminal glitch)</option>
                </select>
            </div>

            {d.step_type !== 'typing' && (
                <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Mensaje a enviar <span className="required">*</span></label>
                    <textarea className="form-textarea" style={{ minHeight: 80 }} value={d.message_to_send} onChange={e => set({ message_to_send: e.target.value })} />
                </div>
            )}

            {d.step_type !== 'typing' && d.step_type !== 'choice' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Multimedia (Opcional)</label>
                        <select className="form-input" value={d.media_type || ''} onChange={e => set({ media_type: (e.target.value as any) || undefined, media_url: e.target.value ? d.media_url : undefined })}>
                            <option value="">Sin multimedia</option>
                            <option value="image">Imagen</option>
                            <option value="video">Video</option>
                            <option value="audio">Audio</option>
                        </select>
                    </div>
                    {d.media_type && (
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">URL del archivo</label>
                            <input className="form-input" placeholder="https://..." value={d.media_url || ''} onChange={e => set({ media_url: e.target.value })} />
                        </div>
                    )}
                </div>
            )}

            {d.step_type !== 'typing' && d.step_type !== 'choice' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                        <input type="checkbox" checked={d.interrupted_typing || false} onChange={e => set({ interrupted_typing: e.target.checked })} style={{ width: 16, height: 16, accentColor: 'var(--brand-primary)' }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Efecto "Escribió y borró" antes del mensaje</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                        <input type="checkbox" checked={d.glitch_effect || false} onChange={e => set({ glitch_effect: e.target.checked })} style={{ width: 16, height: 16, accentColor: 'var(--brand-primary)' }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}><Zap size={13} /> Efecto glitch — Falla de la matrix</span>
                    </div>
                </div>
            )}

            {/* Choice step: options editor */}
            {d.step_type === 'choice' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <label className="form-label">Opciones</label>
                    {(d.choices || []).map((ch, ci) => (
                        <div key={ci} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
                            <div className="form-group" style={{ margin: 0 }}>
                                {ci === 0 && <label className="form-label" style={{ fontSize: 11 }}>Etiqueta</label>}
                                <input className="form-input" placeholder="Ej: Seguir" value={ch.label} onChange={e => {
                                    const choices = [...(d.choices || [])]; choices[ci] = { ...choices[ci], label: e.target.value }; set({ choices });
                                }} />
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                {ci === 0 && <label className="form-label" style={{ fontSize: 11 }}>Condición (para el LLM)</label>}
                                <input className="form-input" placeholder="Ej: el usuario quiere seguir" value={ch.condition} onChange={e => {
                                    const choices = [...(d.choices || [])]; choices[ci] = { ...choices[ci], condition: e.target.value }; set({ choices });
                                }} />
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                {ci === 0 && <label className="form-label" style={{ fontSize: 11 }}>Escena destino</label>}
                                <select className="form-input" value={ch.target_scene_id || ''} onChange={e => {
                                    const choices = [...(d.choices || [])]; choices[ci] = { ...choices[ci], target_scene_id: e.target.value || undefined }; set({ choices });
                                }}>
                                    <option value="">(seleccionar)</option>
                                    {scenes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => {
                                const choices = (d.choices || []).filter((_, i) => i !== ci); set({ choices });
                            }}><Trash2 size={13} /></button>
                        </div>
                    ))}
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--text-brand)', alignSelf: 'flex-start' }} onClick={() => set({ choices: [...(d.choices || []), { label: '', condition: '', target_scene_id: '' }] })}>
                        <Plus size={13} /> Agregar opción
                    </button>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Contexto heredable (Opcional)</label>
                    <input className="form-input" placeholder="Ej: Usa un tono urgente..." value={d.context || ''} onChange={e => set({ context: e.target.value })} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Delay (segundos)</label>
                    <input className="form-input" type="number" step="0.1" min="0" value={d.delay_seconds} onChange={e => set({ delay_seconds: parseFloat(e.target.value) || 0 })} />
                </div>
            </div>

            {d.requires_response && d.step_type !== 'choice' && (
                <>
                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Respuesta esperada <span className="required">*</span></label>
                        <input className="form-input" value={d.expected_answer} onChange={e => set({ expected_answer: e.target.value })} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Mensaje si respuesta incorrecta</label>
                        <input className="form-input" value={d.wrong_answer_message} onChange={e => set({ wrong_answer_message: e.target.value })} />
                    </div>
                </>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary btn-sm" onClick={onCancel}>Cancelar</button>
                <button
                    className="btn btn-primary btn-sm"
                    onClick={onSave}
                    disabled={(d.step_type !== 'typing' && !d.message_to_send) || (d.requires_response && d.step_type !== 'choice' && !d.expected_answer)}
                >
                    <Check size={13} /> Guardar paso
                </button>
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
    const [scenes, setScenes] = useState<Scene[]>([]);
    const [steps, setSteps] = useState<Step[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('general');
    const [formData, setFormData] = useState<Partial<ExperienceFormData>>({});
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [newStep, setNewStep] = useState<{ sceneId: string; data: StepFormData } | null>(null);
    const [toDeleteStep, setToDeleteStep] = useState<Step | null>(null);
    const [deletingStep, setDeletingStep] = useState(false);
    const [showShare, setShowShare] = useState(false);
    const [collapsedScenes, setCollapsedScenes] = useState<Set<string>>(new Set());
    const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
    const [dragState, setDragState] = useState<{ sceneId: string; index: number } | null>(null);
    const [dragOverState, setDragOverState] = useState<{ sceneId: string; index: number } | null>(null);
    const [previewFromStep, setPreviewFromStep] = useState<number | null>(null);

    const load = async () => {
        setLoading(true);
        const e = await getExperience(id);
        if (e) { setExp(e); setFormData(e); }
        const { scenes: sc } = await ensureScenesExist(id);
        setScenes(sc);
        const s = await getSteps(id);
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

    const handleDrop = async (sceneId: string, dropIdx: number) => {
        if (!dragState || dragState.sceneId !== sceneId || dragState.index === dropIdx) {
            setDragState(null); setDragOverState(null); return;
        }
        const sceneSteps = steps.filter(s => s.scene_id === sceneId);
        const [removed] = sceneSteps.splice(dragState.index, 1);
        sceneSteps.splice(dropIdx, 0, removed);
        const reordered = sceneSteps.map((st, idx) => ({ ...st, order: idx + 1 }));
        setSteps(prev => [...prev.filter(s => s.scene_id !== sceneId), ...reordered].sort((a, b) => a.order - b.order));
        setDragState(null); setDragOverState(null);
        await reorderSteps(id, reordered);
    };

    const handleAddStep = async () => {
        if (!newStep) return;
        const sceneSteps = steps.filter(s => s.scene_id === newStep.sceneId);
        const order = sceneSteps.length + 1;
        const newId = await createStep(id, { ...newStep.data, scene_id: newStep.sceneId, order });
        // Optimistic update: add to local state without full reload
        setSteps(prev => [...prev, {
            ...newStep.data,
            id: newId,
            experience_id: id,
            scene_id: newStep.sceneId,
            order,
        } as Step]);
        setNewStep(null);
    };

    const handleInsertStepAt = async (sceneId: string, atOrder: number) => {
        // Optimistic: shift local steps, then persist
        setSteps(prev => prev.map(s =>
            s.scene_id === sceneId && s.order >= atOrder ? { ...s, order: s.order + 1 } : s
        ));
        const sceneSteps = steps.filter(s => s.scene_id === sceneId && s.order >= atOrder);
        for (const s of sceneSteps) {
            await updateStep(id, s.id, { order: s.order + 1 } as Partial<StepFormData>);
        }
        const newId = await createStep(id, {
            scene_id: sceneId, order: atOrder,
            step_type: 'narrative', message_to_send: '', requires_response: false,
            expected_answer: '', hints: [], wrong_answer_message: '', delay_seconds: 1.2,
        });
        setSteps(prev => [...prev, {
            id: newId, experience_id: id, scene_id: sceneId, order: atOrder,
            step_type: 'narrative', message_to_send: '', requires_response: false,
            expected_answer: '', hints: [], wrong_answer_message: '', delay_seconds: 1.2,
        } as Step]);
    };

    const handleAddScene = async () => {
        await createScene(id, { name: `Escena ${scenes.length + 1}`, order: scenes.length + 1 });
        load();
    };

    const handleDeleteScene = async (sceneId: string) => {
        const sceneSteps = steps.filter(s => s.scene_id === sceneId);
        if (sceneSteps.length > 0) {
            alert('No podés eliminar una escena que tiene pasos. Mové o eliminá los pasos primero.');
            return;
        }
        await deleteScene(id, sceneId);
        load();
    };

    const handleSceneRename = async (sceneId: string, name: string) => {
        await updateScene(id, sceneId, { name });
        setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, name } : s));
        setEditingSceneId(null);
    };

    const handleSceneLink = async (sceneId: string, nextSceneId: string | undefined) => {
        await updateScene(id, sceneId, { next_scene_id: nextSceneId || undefined });
        setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, next_scene_id: nextSceneId || undefined } : s));
    };

    const stepsForScene = (sceneId: string) => steps.filter(s => s.scene_id === sceneId);

    const toggleSceneCollapse = (sceneId: string) => {
        setCollapsedScenes(prev => {
            const next = new Set(prev);
            next.has(sceneId) ? next.delete(sceneId) : next.add(sceneId);
            return next;
        });
    };

    const newStepDefault = (sceneId: string): { sceneId: string; data: StepFormData } => ({
        sceneId,
        data: { order: 0, message_to_send: '', requires_response: true, step_type: 'interactive', expected_answer: '', hints: [], wrong_answer_message: '', context: '', delay_seconds: 1.2, interrupted_typing: false, glitch_effect: false },
    });

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
                    <button className="btn btn-secondary btn-sm" onClick={handleSaveGeneral} disabled={saving} data-tip="Guardar cambios">
                        {saved ? <><Check size={14} /> Guardado</> : saving ? 'Guardando...' : <><Save size={14} /> Guardar</>}
                    </button>
                    <button className="btn btn-secondary btn-sm" data-tip="Publicar"
                        onClick={() => { if (!exp.slug) { alert("Configurá un slug primero."); return; } window.open(`/${exp.slug}`, '_blank'); }}>
                        <ExternalLink size={14} />
                    </button>
                    <button className="btn btn-secondary btn-sm" data-tip="Compartir" onClick={() => setShowShare(true)}>
                        <Share2 size={14} />
                    </button>
                    <button className="btn btn-primary btn-sm" data-tip="Preview" onClick={() => router.push(`/dashboard/experiences/${id}/preview`)}>
                        <Play size={14} />
                    </button>
                    <button className="btn btn-secondary btn-sm" data-tip="Métricas" onClick={() => router.push(`/dashboard/experiences/${id}/metrics`)}>
                        <BarChart2 size={14} />
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
                </div>
            )}

            {/* Steps Tab — Scenes-based with preview panel */}
            {tab === 'pasos' && (
                <div style={{ display: 'flex', gap: 20 }}>
                <div style={{ flex: '1 1 0', minWidth: 0 }}>
                    {scenes.map(scene => {
                        const scSteps = stepsForScene(scene.id);
                        const isCollapsed = collapsedScenes.has(scene.id);
                        const isEditing = editingSceneId === scene.id;

                        return (
                            <div key={scene.id} style={{ marginBottom: 24, border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden' }}>
                                {/* Scene header */}
                                <div style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '12px 16px', background: 'var(--bg-elevated)', borderBottom: isCollapsed ? 'none' : '1px solid var(--border-subtle)',
                                    cursor: 'pointer',
                                }} onClick={() => toggleSceneCollapse(scene.id)}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                                        {isEditing ? (
                                            <input
                                                className="form-input"
                                                autoFocus
                                                defaultValue={scene.name}
                                                onClick={e => e.stopPropagation()}
                                                onBlur={e => handleSceneRename(scene.id, e.target.value || scene.name)}
                                                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                                style={{ padding: '4px 8px', fontSize: 14, fontWeight: 700, width: 200 }}
                                            />
                                        ) : (
                                            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{scene.name}</span>
                                        )}
                                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>({scSteps.length} pasos)</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={e => e.stopPropagation()}>
                                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setEditingSceneId(scene.id)} title="Renombrar"><Edit2 size={13} /></button>
                                        <button className="btn btn-danger btn-icon btn-sm" onClick={() => handleDeleteScene(scene.id)} title="Eliminar escena"><Trash2 size={13} /></button>
                                    </div>
                                </div>

                                {/* Scene body (steps + link) */}
                                {!isCollapsed && (
                                    <div style={{ padding: '12px 16px' }}>
                                        {scSteps.length === 0 && !(newStep?.sceneId === scene.id) && (
                                            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                                                Sin pasos en esta escena.
                                            </div>
                                        )}

                                        {scSteps.map((step, i) => {
                                            const globalIdx = steps.findIndex(s => s.id === step.id);
                                            return (
                                            <div key={step.id}>
                                                {/* Insert step button between steps */}
                                                <div
                                                    style={{
                                                        display: 'flex', justifyContent: 'center',
                                                        padding: '2px 0', opacity: 0, transition: 'opacity 0.15s',
                                                    }}
                                                    onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.opacity = '0'; }}
                                                >
                                                    <button
                                                        onClick={() => handleInsertStepAt(scene.id, step.order)}
                                                        style={{
                                                            background: 'none', border: '1px dashed var(--border-default)',
                                                            borderRadius: 6, cursor: 'pointer', padding: '1px 12px',
                                                            color: 'var(--text-muted)', fontSize: 11, display: 'flex',
                                                            alignItems: 'center', gap: 4,
                                                        }}
                                                    >
                                                        <Plus size={11} /> insertar paso
                                                    </button>
                                                </div>
                                                <InlineStepEditor
                                                    step={step} index={i}
                                                    onSave={async (data) => { await updateStep(id, step.id, data); }}
                                                    onDelete={() => setToDeleteStep(step)}
                                                    isDragging={dragState?.sceneId === scene.id && dragState.index === i}
                                                    isDragOver={dragOverState?.sceneId === scene.id && dragOverState.index === i}
                                                    onDragStart={() => setDragState({ sceneId: scene.id, index: i })}
                                                    onDragOver={(e) => { e.preventDefault(); setDragOverState({ sceneId: scene.id, index: i }); }}
                                                    onDrop={() => handleDrop(scene.id, i)}
                                                    onDragEnd={() => { setDragState(null); setDragOverState(null); }}
                                                    scenes={scenes}
                                                    onPlayFrom={(idx) => setPreviewFromStep(idx)}
                                                    globalStepIndex={globalIdx}
                                                />
                                            </div>
                                            );
                                        })}

                                        {/* New step form for this scene */}
                                        {newStep?.sceneId === scene.id ? (
                                            <div className="step-item" style={{ borderColor: 'var(--border-brand)' }}>
                                                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: 'var(--text-brand)' }}>Nuevo paso #{scSteps.length + 1}</div>
                                                <NewStepForm
                                                    data={newStep.data}
                                                    onChange={(d) => setNewStep({ sceneId: scene.id, data: d })}
                                                    onSave={handleAddStep}
                                                    onCancel={() => setNewStep(null)}
                                                    scenes={scenes}
                                                />
                                            </div>
                                        ) : (
                                            <button className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={() => setNewStep(newStepDefault(scene.id))}>
                                                <Plus size={14} /> Agregar paso
                                            </button>
                                        )}

                                        {/* Scene link */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border-subtle)', fontSize: 13 }}>
                                            <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Siguiente escena:</span>
                                            <select
                                                className="form-input"
                                                style={{ fontSize: 13, padding: '4px 8px', flex: 1 }}
                                                value={scene.next_scene_id || ''}
                                                onChange={e => handleSceneLink(scene.id, e.target.value || undefined)}
                                            >
                                                <option value="">(siguiente por orden)</option>
                                                {scenes.filter(s => s.id !== scene.id).map(s => (
                                                    <option key={s.id} value={s.id}>{s.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    <button className="btn btn-secondary" onClick={handleAddScene} style={{ marginTop: 8 }}>
                        <Plus size={16} /> Nueva escena
                    </button>
                </div>

                {/* Preview panel — always visible */}
                <div style={{ flex: '0 0 340px', position: 'sticky', top: 'calc(var(--topbar-height) + 16px)', height: 'calc(90vh - var(--topbar-height))', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border-subtle)', background: '#fff', alignSelf: 'flex-start' }}>
                    {previewFromStep !== null ? (
                        <iframe
                            key={previewFromStep}
                            src={`/play/${id}?from=${previewFromStep}`}
                            style={{ width: '100%', height: '100%', border: 'none' }}
                        />
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', gap: 12, padding: 32, textAlign: 'center' }}>
                            <Play size={32} style={{ opacity: 0.2 }} />
                            <span style={{ fontSize: 13 }}>Tocá ▶ en cualquier paso para previsualizar desde ahí</span>
                        </div>
                    )}
                </div>
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
