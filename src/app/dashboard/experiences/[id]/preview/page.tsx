'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    ArrowLeft, Send, RotateCcw, CheckCircle, XCircle,
    MessageCircle, Zap, AlertTriangle, BookOpen
} from 'lucide-react';
import { getExperience, getSteps } from '@/lib/firestore';
import type { Experience, Step, PreviewMessage } from '@/lib/types';

// ─── Chat Bubble ──────────────────────────────────────────────────────────────
function ChatBubble({ msg }: { msg: PreviewMessage }) {
    const isSystem = msg.role === 'system';
    const EVAL_COLORS: Record<string, string> = {
        correct: '#34D399',
        incorrect: '#FCA5A5',
        narrative: '#A78BFA',
        off_topic: '#FCD34D',
    };
    const evalColor = msg.evaluation ? EVAL_COLORS[msg.evaluation] : undefined;

    return (
        <div style={{
            display: 'flex',
            justifyContent: isSystem ? 'flex-start' : 'flex-end',
            marginBottom: 10,
            alignItems: 'flex-end',
            gap: 8,
        }}>
            {isSystem && (
                <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'white',
                }}>N</div>
            )}
            <div style={{
                maxWidth: '72%',
                background: isSystem ? 'var(--bg-card)' : 'rgba(124,58,237,0.2)',
                border: `1px solid ${isSystem ? 'var(--border-subtle)' : 'rgba(124,58,237,0.35)'}`,
                borderRadius: isSystem ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
                padding: '10px 14px',
            }}>
                <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.55, margin: 0 }}>{msg.content}</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, gap: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {new Date(msg.timestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {msg.evaluation && (
                        <span style={{ fontSize: 11, fontWeight: 600, color: evalColor }}>
                            {msg.evaluation === 'correct' ? '✓ Correcto' :
                                msg.evaluation === 'incorrect' ? '✗ Incorrecto' :
                                    msg.evaluation === 'narrative' ? '📖 Narrativo' : '↗ Fuera de contexto'}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Step Progress ────────────────────────────────────────────────────────────
function StepProgress({ steps, currentIndex }: { steps: Step[]; currentIndex: number }) {
    return (
        <div style={{
            padding: '12px 16px',
            background: 'var(--bg-elevated)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto',
        }}>
            {steps.map((step, i) => (
                <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <div style={{
                        width: 24, height: 24, borderRadius: '50%', fontSize: 11, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: i < currentIndex ? 'var(--brand-primary)' : i === currentIndex ? 'rgba(124,58,237,0.2)' : 'var(--bg-card)',
                        color: i < currentIndex ? 'white' : i === currentIndex ? 'var(--brand-primary-light)' : 'var(--text-muted)',
                        border: i === currentIndex ? '2px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
                    }}>
                        {i < currentIndex ? '✓' : i + 1}
                    </div>
                    {i < steps.length - 1 && (
                        <div style={{
                            width: 20, height: 1,
                            background: i < currentIndex ? 'var(--brand-primary)' : 'var(--border-subtle)',
                        }} />
                    )}
                </div>
            ))}
            <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-secondary)', flexShrink: 0 }}>
                {currentIndex >= steps.length ? '¡Completada!' : `Paso ${currentIndex + 1} de ${steps.length}`}
            </span>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PreviewPage() {
    const { id } = useParams() as { id: string };
    const router = useRouter();
    const [experience, setExperience] = useState<Experience | null>(null);
    const [steps, setSteps] = useState<Step[]>([]);
    const [messages, setMessages] = useState<PreviewMessage[]>([]);
    const [input, setInput] = useState('');
    const [stepIndex, setStepIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [completed, setCompleted] = useState(false);
    const [hasApiKey, setHasApiKey] = useState(true);
    const chatRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });

    // ─── Load experience & start conversation
    useEffect(() => {
        Promise.all([getExperience(id), getSteps(id)]).then(([exp, stps]) => {
            setExperience(exp);
            setSteps(stps);
            setLoading(false);
            if (!exp?.llm_api_key) setHasApiKey(false);

            if (stps.length > 0) {
                // Send the first step automatically
                const firstStep = stps[0];
                const firstMsg: PreviewMessage = {
                    role: 'system',
                    content: firstStep.message_to_send,
                    timestamp: new Date().toISOString(),
                    evaluation: firstStep.requires_response ? undefined : 'narrative',
                };
                setMessages([firstMsg]);

                // If first step also doesn't require a response, auto-advance
                if (!firstStep.requires_response) {
                    advanceNarrativeSteps(stps, 1, [firstMsg]);
                }
            }
        });
    }, [id]);

    useEffect(() => { scrollToBottom(); }, [messages]);

    // ─── Auto-advance through consecutive narrative steps
    const advanceNarrativeSteps = (allSteps: Step[], fromIndex: number, currentMsgs: PreviewMessage[]) => {
        if (fromIndex >= allSteps.length) return;
        const next = allSteps[fromIndex];
        if (!next.requires_response) {
            const delayMs = typeof next.delay_seconds === 'number' ? next.delay_seconds * 1000 : 1200;
            setTimeout(() => {
                const msg: PreviewMessage = {
                    role: 'system',
                    content: next.message_to_send,
                    timestamp: new Date().toISOString(),
                    evaluation: 'narrative',
                };
                const updated = [...currentMsgs, msg];
                setMessages(updated);
                setStepIndex(fromIndex);
                advanceNarrativeSteps(allSteps, fromIndex + 1, updated);
            }, delayMs);
        } else {
            const delayMs = typeof next.delay_seconds === 'number' ? next.delay_seconds * 1000 : 1200;
            setTimeout(() => {
                const msg: PreviewMessage = {
                    role: 'system',
                    content: next.message_to_send,
                    timestamp: new Date().toISOString(),
                    evaluation: undefined,
                };
                const updated = [...currentMsgs, msg];
                setMessages(updated);
                setStepIndex(fromIndex);
            }, delayMs);
        }
    };

    // ─── Send user message
    const handleSend = async () => {
        if (!input.trim() || sending || completed) return;
        const userMsg: PreviewMessage = { role: 'user', content: input.trim(), timestamp: new Date().toISOString() };
        const withUser = [...messages, userMsg];
        setMessages(withUser);
        setInput('');
        setSending(true);

        try {
            const res = await fetch(`/api/experiences/${id}/preview`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userMessage: userMsg.content, stepIndex }),
            });
            const data = await res.json();

            const systemMsg: PreviewMessage = {
                role: 'system',
                content: data.response ?? data.error ?? 'Error desconocido',
                timestamp: new Date().toISOString(),
                evaluation: data.evaluation,
            };
            const withSystem = [...withUser, systemMsg];
            setMessages(withSystem);

            if (data.completed) {
                setCompleted(true);
                setStepIndex(steps.length);
            } else if (data.evaluation === 'correct') {
                const nextIdx = data.nextStepIndex;
                setStepIndex(nextIdx); // Hide input if next is narrative
                // Check if the next step(s) are narrative — auto-advance them
                // Add a small delay so the confirmation bubble is visible before the next step appears
                if (nextIdx < steps.length && !steps[nextIdx].requires_response) {
                    const delayMs = typeof steps[nextIdx].delay_seconds === 'number' ? steps[nextIdx].delay_seconds! * 1000 : 800;
                    setTimeout(() => advanceNarrativeSteps(steps, nextIdx, withSystem), delayMs);
                }
            }
            // If incorrect or off_topic, stepIndex stays the same
        } catch {
            setMessages(prev => [...prev, {
                role: 'system', content: 'Error al conectar con el servidor. Revisá la consola.', timestamp: new Date().toISOString(),
            }]);
        }
        setSending(false);
    };

    const handleReset = () => {
        setMessages([]);
        setStepIndex(0);
        setCompleted(false);
        setInput('');
        if (steps.length > 0) {
            const firstMsg: PreviewMessage = { role: 'system', content: steps[0].message_to_send, timestamp: new Date().toISOString(), evaluation: steps[0].requires_response ? undefined : 'narrative' };
            setMessages([firstMsg]);
            if (!steps[0].requires_response) advanceNarrativeSteps(steps, 1, [firstMsg]);
        }
    };

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh', color: 'var(--text-muted)' }}>
            Cargando experiencia...
        </div>
    );

    if (!experience) return (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Experiencia no encontrada.</div>
    );

    const currentStep = steps[stepIndex];
    const waitingForResponse = !completed && currentStep?.requires_response;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - var(--topbar-height))' }}>
            {/* Header */}
            <div style={{
                padding: '16px 24px',
                background: 'var(--bg-elevated)',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button className="btn btn-ghost btn-icon" onClick={() => router.push(`/dashboard/experiences/${id}`)}>
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <div style={{ fontSize: 15, fontWeight: 700 }}>Vista previa — {experience.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Probá la experiencia antes de conectarla a Twilio</div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    {!hasApiKey && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: 'var(--warning)' }}>
                            <AlertTriangle size={13} /> Sin API key — respuestas simuladas
                        </div>
                    )}
                    <button className="btn btn-secondary btn-sm" onClick={handleReset} id="preview-reset-btn">
                        <RotateCcw size={14} /> Reiniciar
                    </button>
                </div>
            </div>

            {/* Step progress bar */}
            {steps.length > 0 && <StepProgress steps={steps} currentIndex={stepIndex} />}

            {/* Chat area */}
            <div
                ref={chatRef}
                style={{
                    flex: 1, overflowY: 'auto', padding: '20px 24px',
                    background: 'var(--bg-base)',
                    backgroundImage: 'radial-gradient(ellipse at 80% 20%, rgba(124,58,237,0.04) 0%, transparent 60%)',
                }}
            >
                {messages.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon"><MessageCircle size={26} /></div>
                        <div className="empty-state-title">Iniciando experiencia…</div>
                    </div>
                ) : (
                    messages.map((msg, i) => <ChatBubble key={i} msg={msg} />)
                )}

                {sending && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                            {[0, 1, 2].map(i => <div key={i} className="animate-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--brand-primary-light)', animationDelay: `${i * 0.15}s` }} />)}
                        </div>
                        El narrador está respondiendo…
                    </div>
                )}

                {completed && (
                    <div style={{ textAlign: 'center', padding: '24px 0' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 100, padding: '8px 20px', fontSize: 14, fontWeight: 700, color: '#34D399' }}>
                            <CheckCircle size={16} /> ¡Experiencia completada!
                        </div>
                    </div>
                )}
            </div>

            {/* Current step info bar */}
            {currentStep && !completed && (
                <div style={{ padding: '8px 24px', background: 'var(--bg-elevated)', borderTop: '1px solid var(--border-subtle)', fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {currentStep.requires_response ? (
                        <>
                            <Zap size={12} style={{ color: 'var(--brand-primary-light)' }} />
                            <span>Esperando respuesta para: <em style={{ color: 'var(--text-secondary)' }}>{currentStep.expected_answer}</em></span>
                            {currentStep.hints.length > 0 && <span>· {currentStep.hints.length} pista(s) disponible(s)</span>}
                        </>
                    ) : (
                        <>
                            <BookOpen size={12} style={{ color: 'var(--brand-primary-light)' }} />
                            <span>Paso narrativo — avanzando automáticamente…</span>
                        </>
                    )}
                </div>
            )}

            {/* Input area */}
            <div style={{
                padding: '16px 24px',
                background: 'var(--bg-elevated)',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex', gap: 10,
            }}>
                <input
                    className="form-input"
                    style={{ flex: 1 }}
                    placeholder={
                        completed ? 'Experiencia terminada. Reiniciá para probar de nuevo.' :
                            !waitingForResponse ? 'El sistema está procesando pasos narrativos…' :
                                'Escribí tu respuesta…'
                    }
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    disabled={sending || completed || !waitingForResponse}
                    id="preview-input"
                    autoFocus
                />
                <button
                    className="btn btn-primary"
                    onClick={handleSend}
                    disabled={sending || !input.trim() || completed || !waitingForResponse}
                    id="preview-send-btn"
                    style={{ padding: '10px 16px' }}
                >
                    {sending ? '…' : <Send size={16} />}
                </button>
            </div>
        </div>
    );
}
