'use client';
import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronRight, ChevronLeft, Plus, Trash2, GripVertical, AlertCircle } from 'lucide-react';
import { createExperience, createStep } from '@/lib/firestore';
import type { ExperienceFormData, StepFormData } from '@/lib/types';

// ─── Step 1: Datos generales ────────────────────────────────────────
function Step1({ data, onChange }: { data: Partial<ExperienceFormData>; onChange: (d: Partial<ExperienceFormData>) => void }) {
    return (
        <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Información General</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 28 }}>Definí el nombre, descripción y la personalidad del narrador de tu experiencia.</p>

            <div className="form-group">
                <label className="form-label">Nombre de la experiencia <span className="required">*</span></label>
                <input className="form-input" placeholder="Ej: Misterio en el Barrio Norte" value={data.name || ''} onChange={e => onChange({ ...data, name: e.target.value })} id="exp-name" />
            </div>
            <div className="form-group">
                <label className="form-label">Descripción <span className="required">*</span></label>
                <textarea className="form-textarea" placeholder="Descripción breve de la experiencia para el panel admin" value={data.description || ''} onChange={e => onChange({ ...data, description: e.target.value })} id="exp-description" style={{ minHeight: 80 }} />
            </div>
            <div className="form-group">
                <label className="form-label">Personalidad del narrador <span className="required">*</span></label>
                <textarea
                    className="form-textarea"
                    placeholder={'Ej: Sos Ignacio, un detective porteño de los años 40. Tu tono es irónico y misterioso. Usás lunfardo con moderación. Nunca rompes el personaje. Sos exigente pero justo con los jugadores.'}
                    value={data.narrator_personality || ''}
                    onChange={e => onChange({ ...data, narrator_personality: e.target.value })}
                    id="exp-narrator"
                    style={{ minHeight: 140 }}
                />
                <span className="form-hint">Este texto se usará como system prompt en cada interacción con el LLM.</span>
            </div>
            <div className="form-group">
                <label className="form-label">Palabra clave de activación <span className="required">*</span></label>
                <input className="form-input" placeholder="Ej: DETECTIVE, INICIO, JUGAR" value={data.activation_keyword || ''} onChange={e => onChange({ ...data, activation_keyword: e.target.value.toUpperCase() })} id="exp-keyword" />
                <span className="form-hint">El usuario debe enviar esta palabra para iniciar la experiencia.</span>
            </div>
        </div>
    );
}

// ─── Step 2: Pasos / Steps ────────────────────────────────────────
function HintsList({ hints, onChange }: { hints: string[]; onChange: (h: string[]) => void }) {
    const add = () => onChange([...hints, '']);
    const remove = (i: number) => onChange(hints.filter((_, idx) => idx !== i));
    const update = (i: number, val: string) => onChange(hints.map((h, idx) => idx === i ? val : h));
    return (
        <div>
            <div className="hints-list">
                {hints.map((h, i) => (
                    <div className="hint-row" key={i}>
                        <input className="form-input" placeholder={`Pista ${i + 1}`} value={h} onChange={e => update(i, e.target.value)} />
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => remove(i)} type="button"><Trash2 size={14} /></button>
                    </div>
                ))}
            </div>
            <button className="btn btn-ghost btn-sm" type="button" onClick={add} style={{ marginTop: 8, color: 'var(--text-brand)' }}>
                <Plus size={14} /> Agregar pista
            </button>
        </div>
    );
}

function StepEditor({ step, index, total, onChange, onDelete, onMoveUp, onMoveDown }: {
    step: StepFormData; index: number; total: number;
    onChange: (s: StepFormData) => void; onDelete: () => void;
    onMoveUp: () => void; onMoveDown: () => void;
}) {
    const [expanded, setExpanded] = useState(true);
    const isNarrative = !step.requires_response;
    return (
        <div className="step-item" style={{ borderColor: isNarrative ? 'rgba(167,139,250,0.3)' : undefined }}>
            <div className="step-item-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, cursor: 'grab' }}>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={onMoveUp} disabled={index === 0} type="button" title="Subir"><ChevronLeft size={13} style={{ transform: 'rotate(90deg)' }} /></button>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={onMoveDown} disabled={index === total - 1} type="button" title="Bajar"><ChevronRight size={13} style={{ transform: 'rotate(90deg)' }} /></button>
                    </div>
                    <div className="step-item-number">{index + 1}</div>
                    <div>
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>
                            {step.message_to_send ? step.message_to_send.slice(0, 50) + (step.message_to_send.length > 50 ? '…' : '') : `Paso ${index + 1}`}
                        </span>
                        {isNarrative && (
                            <span style={{ marginLeft: 8, fontSize: 11, background: 'rgba(124,58,237,0.15)', color: 'var(--brand-primary-light)', padding: '1px 7px', borderRadius: 100, fontWeight: 600 }}>📖 Narrativo</span>
                        )}
                    </div>
                </div>
                <div className="step-item-actions">
                    <button className="btn btn-ghost btn-icon btn-sm" type="button" onClick={() => setExpanded(!expanded)}>{expanded ? '−' : '+'}</button>
                    <button className="btn btn-danger btn-icon btn-sm" type="button" onClick={onDelete} title="Eliminar paso" id={`delete-step-${index}`}><Trash2 size={14} /></button>
                </div>
            </div>
            {expanded && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {/* requires_response toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                        <input
                            type="checkbox"
                            id={`requires-resp-${index}`}
                            checked={step.requires_response}
                            onChange={e => onChange({ ...step, requires_response: e.target.checked })}
                            style={{ width: 16, height: 16, accentColor: 'var(--brand-primary)', cursor: 'pointer' }}
                        />
                        <label htmlFor={`requires-resp-${index}`} style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}>
                            Requiere respuesta del usuario
                        </label>
                        {isNarrative && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>— Paso narrativo: el sistema avanza automáticamente al siguiente</span>}
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Mensaje a enviar <span className="required">*</span></label>
                        <textarea className="form-textarea" style={{ minHeight: 80 }} placeholder="Texto que recibe el usuario al llegar a este paso" value={step.message_to_send} onChange={e => onChange({ ...step, message_to_send: e.target.value })} />
                    </div>

                    {/* These fields only matter for interactive steps */}
                    {step.requires_response && (
                        <>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label">Respuesta esperada <span className="required">*</span></label>
                                <input className="form-input" placeholder="Respuesta correcta que el LLM evaluará semánticamente" value={step.expected_answer} onChange={e => onChange({ ...step, expected_answer: e.target.value })} />
                                <span className="form-hint">No hace falta que sea exacta — el LLM detecta equivalencias semánticas.</span>
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label">Mensaje si respuesta incorrecta</label>
                                <input className="form-input" placeholder="Ej: ¡Casi! Seguí buscando..." value={step.wrong_answer_message} onChange={e => onChange({ ...step, wrong_answer_message: e.target.value })} />
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label">Pistas de ayuda</label>
                                <HintsList hints={step.hints} onChange={hints => onChange({ ...step, hints })} />
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

function Step2({ steps, onChange }: { steps: StepFormData[]; onChange: (s: StepFormData[]) => void }) {
    const addStep = () => onChange([...steps, {
        order: steps.length + 1,
        message_to_send: '',
        requires_response: true,
        expected_answer: '',
        hints: [],
        wrong_answer_message: '',
    }]);

    const updateStep = (i: number, s: StepFormData) => {
        const next = steps.map((st, idx) => idx === i ? s : st);
        onChange(next);
    };

    const deleteStep = (i: number) => {
        const next = steps.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, order: idx + 1 }));
        onChange(next);
    };

    const moveUp = (i: number) => {
        if (i === 0) return;
        const s = [...steps];
        [s[i - 1], s[i]] = [s[i], s[i - 1]];
        onChange(s.map((st, idx) => ({ ...st, order: idx + 1 })));
    };

    const moveDown = (i: number) => {
        if (i === steps.length - 1) return;
        const s = [...steps];
        [s[i], s[i + 1]] = [s[i + 1], s[i]];
        onChange(s.map((st, idx) => ({ ...st, order: idx + 1 })));
    };

    return (
        <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Pasos de la Experiencia</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 28 }}>Definí cada paso del recorrido. El orden importa: el usuario los recibirá en secuencia.</p>
            {steps.map((step, i) => (
                <StepEditor
                    key={step.order}
                    step={step}
                    index={i}
                    total={steps.length}
                    onChange={s => updateStep(i, s)}
                    onDelete={() => deleteStep(i)}
                    onMoveUp={() => moveUp(i)}
                    onMoveDown={() => moveDown(i)}
                />
            ))}
            {steps.length === 0 && (
                <div style={{ textAlign: 'center', padding: '32px', background: 'var(--bg-elevated)', borderRadius: 12, border: '1px dashed var(--border-default)', marginBottom: 16, color: 'var(--text-muted)' }}>
                    <GripVertical size={28} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                    <p style={{ fontSize: 14 }}>Aún no hay pasos. Agregá el primero.</p>
                </div>
            )}
            <button className="btn btn-secondary" type="button" onClick={addStep} id="add-step-btn">
                <Plus size={16} /> Agregar paso
            </button>
        </div>
    );
}

// ─── Step 3: Configuración técnica ─────────────────────────────────
function Step3({ data, onChange }: { data: Partial<ExperienceFormData>; onChange: (d: Partial<ExperienceFormData>) => void }) {
    return (
        <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Configuración Técnica</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 28 }}>Configurá las APIs y el modo de operación de la experiencia.</p>

            <div className="form-group">
                <label className="form-label">API Key del LLM <span className="required">*</span></label>
                <input className="form-input" type="password" placeholder="sk-... o AIzaSy..." value={data.llm_api_key || ''} onChange={e => onChange({ ...data, llm_api_key: e.target.value })} id="exp-llm-key" />
                <span className="form-hint">Clave de API de Gemini u OpenAI para evaluar respuestas.</span>
            </div>
            <div className="form-group">
                <label className="form-label">Número / Trigger de Twilio</label>
                <input className="form-input" placeholder="Ej: +5491123456789 o whatsapp:+14155238886" value={data.twilio_trigger || ''} onChange={e => onChange({ ...data, twilio_trigger: e.target.value })} id="exp-twilio" />
                <span className="form-hint">Número de Twilio asociado a esta experiencia (para Fase 2).</span>
            </div>

            <div className="form-group">
                <label className="form-label">Modo de operación</label>
                <div className="toggle-group" style={{ maxWidth: 300 }}>
                    <button type="button" className={`toggle-option ${data.mode === 'test' ? 'active' : ''}`} onClick={() => onChange({ ...data, mode: 'test' })} id="mode-test">🧪 Prueba</button>
                    <button type="button" className={`toggle-option ${data.mode === 'production' ? 'active' : ''}`} onClick={() => onChange({ ...data, mode: 'production' })} id="mode-production">🚀 Producción</button>
                </div>
                <span className="form-hint" style={{ marginTop: 6, display: 'block' }}>En modo prueba el trigger es la palabra clave. En producción se activa via webhook de pago.</span>
            </div>

            <div className="form-group">
                <label className="form-label">Estado inicial</label>
                <div className="toggle-group" style={{ maxWidth: 300 }}>
                    <button type="button" className={`toggle-option ${data.status === 'active' ? 'active' : ''}`} onClick={() => onChange({ ...data, status: 'active' })} id="status-active">✅ Activa</button>
                    <button type="button" className={`toggle-option ${data.status === 'inactive' ? 'active' : ''}`} onClick={() => onChange({ ...data, status: 'inactive' })} id="status-inactive">⏸ Inactiva</button>
                </div>
            </div>

            <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start', marginTop: 8 }}>
                <AlertCircle size={16} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>La integración completa con Twilio se configura en la Fase 2. Por ahora podés dejar el número vacío.</p>
            </div>
        </div>
    );
}

// ─── Wizard principal ──────────────────────────────────────────────
const WIZARD_STEPS = ['Información general', 'Pasos', 'Configuración'];

const defaultFormData: Partial<ExperienceFormData> = {
    mode: 'test',
    status: 'active',
};

export default function NewExperiencePage() {
    const router = useRouter();
    const [currentStep, setCurrentStep] = useState(0);
    const [formData, setFormData] = useState<Partial<ExperienceFormData>>(defaultFormData);
    const [steps, setSteps] = useState<StepFormData[]>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const isStep1Valid = formData.name && formData.description && formData.narrator_personality && formData.activation_keyword;
    // Narrative steps (requires_response=false) don't need expected_answer
    const isStep2Valid = steps.length > 0 && steps.every(s => s.message_to_send && (!s.requires_response || s.expected_answer));
    const isStep3Valid = formData.llm_api_key;

    const canProceed = [isStep1Valid, isStep2Valid, isStep3Valid][currentStep];

    const handleSave = async () => {
        if (!isStep1Valid || !isStep3Valid) { setError('Completá todos los campos requeridos.'); return; }
        setSaving(true);
        setError('');
        try {
            const expId = await createExperience(formData as ExperienceFormData);
            for (const step of steps) {
                await createStep(expId, step);
            }
            router.push(`/dashboard/experiences/${expId}`);
        } catch (e) {
            setError('Error al guardar. Revisá tu conexión y los datos.');
            setSaving(false);
        }
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Nueva Experiencia</h1>
                    <p className="page-subtitle">Seguí los pasos para configurar tu experiencia interactiva</p>
                </div>
                <button className="btn btn-secondary" onClick={() => router.push('/dashboard/experiences')}>Cancelar</button>
            </div>

            <div className="wizard-container">
                {/* Progress */}
                <div className="wizard-progress">
                    {WIZARD_STEPS.map((label, i) => (
                        <div key={i} className={`wizard-step-indicator ${i < currentStep ? 'completed' : ''}`}>
                            <div className={`wizard-step-dot ${i === currentStep ? 'active' : i < currentStep ? 'completed' : ''}`}>
                                {i < currentStep ? <Check size={14} /> : i + 1}
                            </div>
                            <span className={`wizard-step-label ${i === currentStep ? 'active' : i < currentStep ? 'completed' : ''}`}>{label}</span>
                        </div>
                    ))}
                </div>

                {/* Step content */}
                <div className="card" style={{ marginBottom: 24 }}>
                    {currentStep === 0 && <Step1 data={formData} onChange={setFormData} />}
                    {currentStep === 1 && <Step2 steps={steps} onChange={setSteps} />}
                    {currentStep === 2 && <Step3 data={formData} onChange={setFormData} />}
                </div>

                {error && (
                    <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '12px 16px', fontSize: 14, color: '#FCA5A5', marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
                        <AlertCircle size={15} style={{ flexShrink: 0 }} />{error}
                    </div>
                )}

                {/* Navigation */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button className="btn btn-secondary" onClick={() => setCurrentStep(s => s - 1)} disabled={currentStep === 0}>
                        <ChevronLeft size={16} /> Anterior
                    </button>
                    {currentStep < WIZARD_STEPS.length - 1 ? (
                        <button className="btn btn-primary" onClick={() => setCurrentStep(s => s + 1)} disabled={!canProceed} id="wizard-next-btn">
                            Siguiente <ChevronRight size={16} />
                        </button>
                    ) : (
                        <button className="btn btn-primary" onClick={handleSave} disabled={saving || !isStep1Valid || !isStep3Valid} id="wizard-save-btn">
                            {saving ? 'Guardando...' : <><Check size={16} /> Crear Experiencia</>}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
