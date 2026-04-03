'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Sparkles, Send, Loader2, ChevronDown, ChevronRight,
    MessageSquare, HelpCircle, GitFork, MoreHorizontal, PenLine,
    AlertCircle, Check, RotateCcw, Zap, Plus, Play, Image, Monitor,
} from 'lucide-react';
import { createExperienceFromAI } from '@/lib/firestore';
import { authFetch } from '@/lib/api';
import type { AIGeneratedExperience, AIGeneratedStep } from '@/lib/types';

const STEP_TYPE_CONFIG: Record<string, { label: string; color: string; icon: typeof MessageSquare }> = {
    narrative: { label: 'Narrativo', color: 'var(--info)', icon: MessageSquare },
    interactive: { label: 'Interactivo', color: 'var(--brand-primary)', icon: HelpCircle },
    typing: { label: 'Escribiendo...', color: 'var(--text-muted)', icon: MoreHorizontal },
    error_screen: { label: 'Pantalla Error', color: 'var(--danger)', icon: Monitor },
};

const PLACEHOLDER_SCRIPT = `Ejemplo de guión:

Experiencia: "El Misterio del Puerto"
Narrador: Un viejo marinero misterioso. Habla con jerga náutica, es enigmático y dramático.

ESCENA 1: El Encuentro
- El narrador dice: "Eh, vos... sí, vos. Acercate. Necesito ayuda con algo."
- Pausa dramática (efecto escribiendo)
- "Hace 30 años perdí algo en este puerto. Algo que cambió mi vida."
- Esperar que el usuario pregunte qué perdió
  - Pista: "Preguntale por el objeto"
  - Si responde mal: "No, no... escuchá bien. Preguntame QUÉ perdí."

ESCENA 2: La Revelación
- "Mi brújula. Pero no era una brújula común..."
- Preguntarle al usuario si quiere ayudar a buscarla
  - Si dice sí: continuar
  - Si dice no: "Bueno... supongo que el mar se la llevó para siempre."

ESCENA 3: La Búsqueda
- Darle a elegir:
  - "Buscar en el muelle viejo" → Escena 4
  - "Buscar en el faro" → Escena 5`;

type Phase = 'input' | 'generating' | 'preview' | 'saving';

export default function AIStoriesPage() {
    const router = useRouter();
    const [script, setScript] = useState('');
    const [phase, setPhase] = useState<Phase>('input');
    const [generated, setGenerated] = useState<AIGeneratedExperience | null>(null);
    const [error, setError] = useState('');
    const [expandedScenes, setExpandedScenes] = useState<Set<number>>(new Set());
    const [editingStep, setEditingStep] = useState<string | null>(null); // "sceneIdx-stepIdx"
    const [llmApiKey, setLlmApiKey] = useState('');
    const [narratorAvatar, setNarratorAvatar] = useState('');
    const [genCost, setGenCost] = useState<{ tokens: number; cost: number } | null>(null);

    // ─── Generate experience from script ──────────────────────────────────────
    const handleGenerate = async () => {
        if (!script.trim()) return;
        setPhase('generating');
        setError('');
        setGenerated(null);

        try {
            const res = await authFetch('/api/ai-stories/generate', {
                method: 'POST',
                body: JSON.stringify({ script }),
            });
            const data = await res.json();

            if (!res.ok) {
                const errMsg = data.raw
                    ? `${data.error}\n\nRaw LLM output (primeros 300 chars):\n${data.raw.slice(0, 300)}`
                    : (data.error ?? 'Error al generar la experiencia');
                setError(errMsg);
                setPhase('input');
                return;
            }

            setGenerated(data.experience);
            setGenCost({ tokens: data.tokens, cost: data.cost });
            // Expand all scenes by default
            const allScenes = new Set<number>(data.experience.scenes.map((_: unknown, i: number) => i));
            setExpandedScenes(allScenes);
            setPhase('preview');
        } catch {
            setError('Error de conexión. Intentá de nuevo.');
            setPhase('input');
        }
    };

    // ─── Save to Firestore ────────────────────────────────────────────────────
    const handleSave = async () => {
        if (!generated) return;
        setPhase('saving');
        setError('');

        try {
            const experienceId = await createExperienceFromAI(generated, llmApiKey, narratorAvatar);
            router.push(`/dashboard/experiences/${experienceId}`);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Error al guardar';
            setError(message);
            setPhase('preview');
        }
    };

    // ─── Toggle scene expand/collapse ─────────────────────────────────────────
    const toggleScene = (idx: number) => {
        setExpandedScenes(prev => {
            const next = new Set(prev);
            next.has(idx) ? next.delete(idx) : next.add(idx);
            return next;
        });
    };

    // ─── Inline edit helpers ──────────────────────────────────────────────────
    const updateStep = (sceneIdx: number, stepIdx: number, updates: Partial<AIGeneratedStep>) => {
        if (!generated) return;
        const updated = { ...generated };
        updated.scenes = updated.scenes.map((scene, si) => {
            if (si !== sceneIdx) return scene;
            return {
                ...scene,
                steps: scene.steps.map((step, sti) =>
                    sti === stepIdx ? { ...step, ...updates } : step
                ),
            };
        });
        setGenerated(updated);
    };

    const updateExperienceField = (field: string, value: string) => {
        if (!generated) return;
        setGenerated({ ...generated, [field]: value });
    };

    const addStep = (sceneIdx: number, atPosition?: number) => {
        if (!generated) return;
        const newStep: AIGeneratedStep = {
            step_type: 'narrative',
            message_to_send: '',
            requires_response: false,
            expected_answer: '',
            hints: [],
            wrong_answer_message: '',
            delay_seconds: 2,
        };
        const updated = { ...generated };
        updated.scenes = updated.scenes.map((scene, si) => {
            if (si !== sceneIdx) return scene;
            const newSteps = [...scene.steps];
            if (atPosition !== undefined) {
                newSteps.splice(atPosition, 0, newStep);
            } else {
                newSteps.push(newStep);
            }
            return { ...scene, steps: newSteps };
        });
        setGenerated(updated);
        setExpandedScenes(prev => new Set(prev).add(sceneIdx));
        const insertedIdx = atPosition ?? updated.scenes[sceneIdx].steps.length - 1;
        setEditingStep(`${sceneIdx}-${insertedIdx}`);
    };

    // ─── Count totals ─────────────────────────────────────────────────────────
    const totalSteps = generated?.scenes.reduce((acc, s) => acc + s.steps.length, 0) ?? 0;
    const totalScenes = generated?.scenes.length ?? 0;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, height: 'calc(100vh - var(--topbar-height) - 64px)' }}>
            {/* Header */}
            <div style={{ padding: '0 0 24px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                    <div style={{
                        width: 40, height: 40, borderRadius: 12,
                        background: 'linear-gradient(135deg, var(--brand-primary), var(--secondary))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <Sparkles size={20} color="#fff" />
                    </div>
                    <div>
                        <h1 style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-code)', color: 'var(--text-primary)', margin: 0 }}>
                            AI Story Generator
                        </h1>
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                            Escribí tu guión y la IA lo convierte en experiencia
                        </p>
                    </div>
                </div>
            </div>

            {/* Main content: 2 columns */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: phase === 'input' || phase === 'generating' ? '1fr' : '1fr 1fr',
                gap: 24,
                flex: 1,
                minHeight: 0,
            }}>
                {/* Left: Script input */}
                <div style={{
                    display: 'flex', flexDirection: 'column', gap: 16,
                    ...(phase === 'preview' || phase === 'saving' ? { maxHeight: '100%', overflow: 'auto' } : {}),
                }}>
                    <div className="card" style={{
                        flex: 1, display: 'flex', flexDirection: 'column', gap: 12,
                        padding: 20,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.01em' }}>
                                Guión editorial
                            </label>
                            {phase === 'preview' && (
                                <button
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => { setPhase('input'); setGenerated(null); setGenCost(null); }}
                                    style={{ gap: 6 }}
                                >
                                    <RotateCcw size={14} /> Nuevo guión
                                </button>
                            )}
                        </div>
                        <textarea
                            className="form-textarea"
                            value={script}
                            onChange={e => setScript(e.target.value)}
                            placeholder={PLACEHOLDER_SCRIPT}
                            disabled={phase === 'generating' || phase === 'saving'}
                            style={{
                                flex: 1, minHeight: phase === 'preview' ? 200 : 400,
                                resize: 'vertical', fontFamily: 'var(--font-body)', fontSize: 14,
                                lineHeight: 1.7,
                            }}
                        />

                        {/* Error display */}
                        {error && (
                            <div style={{
                                display: 'flex', alignItems: 'flex-start', gap: 8,
                                padding: '10px 14px', borderRadius: 8,
                                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                            }}>
                                <AlertCircle size={16} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 1 }} />
                                <span style={{ fontSize: 13, color: 'var(--danger)' }}>{error}</span>
                            </div>
                        )}

                        {/* Generate button */}
                        {(phase === 'input' || phase === 'generating') && (
                            <button
                                className="btn btn-primary"
                                onClick={handleGenerate}
                                disabled={!script.trim() || phase === 'generating'}
                                style={{ alignSelf: 'flex-end', gap: 8, minWidth: 200 }}
                            >
                                {phase === 'generating' ? (
                                    <><Loader2 size={16} className="spin" /> Generando experiencia...</>
                                ) : (
                                    <><Sparkles size={16} /> Generar experiencia</>
                                )}
                            </button>
                        )}

                        {/* Regenerate button in preview */}
                        {phase === 'preview' && (
                            <button
                                className="btn btn-secondary"
                                onClick={handleGenerate}
                                disabled={!script.trim()}
                                style={{ alignSelf: 'flex-end', gap: 8 }}
                            >
                                <RotateCcw size={14} /> Regenerar
                            </button>
                        )}
                    </div>
                </div>

                {/* Right: Preview panel */}
                {(phase === 'preview' || phase === 'saving') && generated && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '100%', overflow: 'auto' }}>
                        {/* Experience header card */}
                        <div className="card" style={{ padding: 20 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                <h2 style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-code)', color: 'var(--text-primary)', margin: 0 }}>
                                    Resultado
                                </h2>
                                {genCost && (
                                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
                                        {genCost.tokens} tokens &middot; ${genCost.cost.toFixed(4)}
                                    </span>
                                )}
                            </div>

                            {/* Editable experience fields */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <div>
                                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Nombre</label>
                                    <input
                                        className="form-input"
                                        value={generated.name}
                                        onChange={e => updateExperienceField('name', e.target.value)}
                                        style={{ fontSize: 15, fontWeight: 600 }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Slug</label>
                                    <input
                                        className="form-input"
                                        value={generated.slug}
                                        onChange={e => updateExperienceField('slug', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Personalidad del narrador</label>
                                    <textarea
                                        className="form-textarea"
                                        value={generated.narrator_personality}
                                        onChange={e => updateExperienceField('narrator_personality', e.target.value)}
                                        style={{ minHeight: 80, fontSize: 13, lineHeight: 1.6 }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>
                                        <Image size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                                        Avatar del narrador
                                    </label>
                                    <input
                                        className="form-input"
                                        value={narratorAvatar}
                                        onChange={e => setNarratorAvatar(e.target.value)}
                                        placeholder="URL de la imagen de perfil del narrador"
                                        style={{ fontSize: 13 }}
                                    />
                                    {narratorAvatar && (
                                        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <img
                                                src={narratorAvatar}
                                                alt="Avatar preview"
                                                style={{
                                                    width: 40, height: 40, borderRadius: '50%',
                                                    objectFit: 'cover', border: '2px solid var(--border-default)',
                                                }}
                                                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                            />
                                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Preview del avatar</span>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Contexto global</label>
                                    <textarea
                                        className="form-textarea"
                                        value={generated.context ?? ''}
                                        onChange={e => updateExperienceField('context', e.target.value)}
                                        placeholder="Ej: Esta experiencia es presencial en Midtown Manhattan. El usuario debe estar físicamente ahí para jugar."
                                        style={{ minHeight: 60, fontSize: 13, lineHeight: 1.6 }}
                                    />
                                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                                        Información que el narrador siempre tiene presente para guiar al usuario.
                                    </span>
                                </div>
                            </div>

                            {/* Stats */}
                            <div style={{
                                display: 'flex', gap: 16, marginTop: 16, padding: '12px 16px',
                                background: 'var(--bg-elevated)', borderRadius: 10,
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Zap size={14} style={{ color: 'var(--brand-primary)' }} />
                                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                        {totalScenes} escenas
                                    </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <MessageSquare size={14} style={{ color: 'var(--info)' }} />
                                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                        {totalSteps} pasos
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Scenes timeline */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {generated.scenes
                                .sort((a, b) => a.order - b.order)
                                .map((scene, sceneIdx) => (
                                    <div key={sceneIdx} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                                        {/* Scene header */}
                                        <button
                                            onClick={() => toggleScene(sceneIdx)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 10,
                                                width: '100%', padding: '14px 16px',
                                                background: 'none', border: 'none', cursor: 'pointer',
                                                borderBottom: expandedScenes.has(sceneIdx) ? '1px solid var(--border-subtle)' : 'none',
                                            }}
                                        >
                                            {expandedScenes.has(sceneIdx) ? <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />}
                                            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-code)' }}>
                                                {scene.name}
                                            </span>
                                            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                                                {scene.steps.length} pasos
                                            </span>
                                        </button>

                                        {/* Steps */}
                                        {expandedScenes.has(sceneIdx) && (
                                            <div style={{ padding: '8px 0' }}>
                                                {scene.steps.map((step, stepIdx) => {
                                                    const config = STEP_TYPE_CONFIG[step.step_type] || STEP_TYPE_CONFIG.narrative;
                                                    const Icon = config.icon;
                                                    const isEditing = editingStep === `${sceneIdx}-${stepIdx}`;

                                                    return (<div key={stepIdx}>
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
                                                                onClick={() => addStep(sceneIdx, stepIdx)}
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
                                                        <div>
                                                            {/* Step row */}
                                                            <div
                                                                onClick={() => setEditingStep(isEditing ? null : `${sceneIdx}-${stepIdx}`)}
                                                                style={{
                                                                    display: 'flex', alignItems: 'flex-start', gap: 10,
                                                                    padding: '10px 16px', cursor: 'pointer',
                                                                    transition: 'background 0.15s',
                                                                    background: isEditing ? 'var(--bg-elevated)' : 'transparent',
                                                                }}
                                                                onMouseEnter={e => { if (!isEditing) e.currentTarget.style.background = 'var(--bg-card-hover)'; }}
                                                                onMouseLeave={e => { if (!isEditing) e.currentTarget.style.background = 'transparent'; }}
                                                            >
                                                                {/* Type badge */}
                                                                <div style={{
                                                                    display: 'flex', alignItems: 'center', gap: 4,
                                                                    padding: '2px 8px', borderRadius: 6, flexShrink: 0,
                                                                    background: `${config.color}18`, marginTop: 2,
                                                                }}>
                                                                    <Icon size={12} style={{ color: config.color }} />
                                                                    <span style={{ fontSize: 11, fontWeight: 600, color: config.color, whiteSpace: 'nowrap' }}>
                                                                        {config.label}
                                                                    </span>
                                                                </div>

                                                                {/* Message preview */}
                                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                                    <p style={{
                                                                        fontSize: 13, color: 'var(--text-primary)', margin: 0,
                                                                        lineHeight: 1.5,
                                                                        ...(isEditing ? {} : {
                                                                            overflow: 'hidden', textOverflow: 'ellipsis',
                                                                            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
                                                                        }),
                                                                    }}>
                                                                        {step.message_to_send || (step.step_type === 'typing' ? '(efecto escribiendo...)' : '(sin mensaje)')}
                                                                    </p>
                                                                    {step.requires_response && (
                                                                        <span style={{ fontSize: 11, color: 'var(--brand-primary-light, var(--brand-primary))', opacity: 0.8 }}>
                                                                            Espera: {step.expected_answer}
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                {/* Play preview from this step */}
                                                                <button
                                                                    className="btn btn-ghost btn-icon btn-sm"
                                                                    title="Preview desde este paso"
                                                                    onClick={e => {
                                                                        e.stopPropagation();
                                                                        // Calculate global step index across all scenes
                                                                        let globalIdx = 0;
                                                                        for (let si = 0; si < sceneIdx; si++) {
                                                                            globalIdx += generated!.scenes[si].steps.length;
                                                                        }
                                                                        globalIdx += stepIdx;
                                                                        // Open preview in new tab (will work once experience is saved)
                                                                        alert(`Preview desde paso ${globalIdx + 1} — disponible después de crear la experiencia.`);
                                                                    }}
                                                                    style={{ flexShrink: 0, marginTop: -2 }}
                                                                >
                                                                    <Play size={13} style={{ color: 'var(--info)' }} />
                                                                </button>
                                                                {/* Edit indicator */}
                                                                <PenLine size={13} style={{ color: 'var(--text-muted)', opacity: 0.5, flexShrink: 0, marginTop: 3 }} />
                                                            </div>

                                                            {/* Inline edit form */}
                                                            {isEditing && (
                                                                <div style={{
                                                                    padding: '12px 16px 16px 44px',
                                                                    background: 'var(--bg-elevated)',
                                                                    borderTop: '1px solid var(--border-subtle)',
                                                                    display: 'flex', flexDirection: 'column', gap: 10,
                                                                }}
                                                                    onClick={e => e.stopPropagation()}
                                                                >
                                                                    <div>
                                                                        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 3, display: 'block' }}>Mensaje</label>
                                                                        <textarea
                                                                            className="form-textarea"
                                                                            value={step.message_to_send}
                                                                            onChange={e => updateStep(sceneIdx, stepIdx, { message_to_send: e.target.value })}
                                                                            style={{ minHeight: 60, fontSize: 13 }}
                                                                        />
                                                                    </div>
                                                                    {step.requires_response && (
                                                                        <div>
                                                                            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 3, display: 'block' }}>
                                                                                Intención esperada
                                                                            </label>
                                                                            <input
                                                                                className="form-input"
                                                                                value={step.expected_answer}
                                                                                onChange={e => updateStep(sceneIdx, stepIdx, { expected_answer: e.target.value })}
                                                                                placeholder="Ej: que el usuario confirme, que mencione el lugar, cualquier respuesta"
                                                                                style={{ fontSize: 13 }}
                                                                            />
                                                                            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, display: 'block' }}>
                                                                                El narrador guía al usuario automáticamente si la respuesta no cumple esta intención.
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                    <div style={{ display: 'flex', gap: 12 }}>
                                                                        <div style={{ flex: 1 }}>
                                                                            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 3, display: 'block' }}>Delay (seg)</label>
                                                                            <input
                                                                                className="form-input"
                                                                                type="number"
                                                                                min={0}
                                                                                value={step.delay_seconds ?? 1}
                                                                                onChange={e => updateStep(sceneIdx, stepIdx, { delay_seconds: Number(e.target.value) })}
                                                                                style={{ fontSize: 13, width: 80 }}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>);
                                                })}
                                                {/* Add step button */}
                                                <button
                                                    className="btn btn-ghost btn-sm"
                                                    onClick={() => addStep(sceneIdx)}
                                                    style={{
                                                        margin: '4px 16px 8px',
                                                        gap: 6, fontSize: 12,
                                                        color: 'var(--text-muted)',
                                                        border: '1px dashed var(--border-default)',
                                                        borderRadius: 8,
                                                        justifyContent: 'center',
                                                    }}
                                                >
                                                    <Plus size={14} /> Nuevo paso
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                        </div>

                        {/* Save button */}
                        <div className="card" style={{
                            padding: 16, display: 'flex', alignItems: 'center',
                            justifyContent: 'space-between', position: 'sticky', bottom: 0,
                        }}>
                            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                <span></span>
                            </span>
                            <button
                                className="btn btn-primary"
                                onClick={handleSave}
                                disabled={phase === 'saving'}
                                style={{ gap: 8, minWidth: 200 }}
                            >
                                {phase === 'saving' ? (
                                    <><Loader2 size={16} className="spin" /> Creando experiencia...</>
                                ) : (
                                    <><Check size={16} /> Crear experiencia</>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
