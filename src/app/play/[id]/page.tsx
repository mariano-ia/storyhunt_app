'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Send, RotateCcw, CheckCircle } from 'lucide-react';
import { getExperience, getSteps } from '@/lib/firestore';
import type { Experience, Step, PreviewMessage } from '@/lib/types';

// ─── Chat Bubble ──────────────────────────────────────────────────────────────
function ChatBubble({ msg, narratorInitial }: { msg: PreviewMessage; narratorInitial: string }) {
    const isSystem = msg.role === 'system';
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
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                    background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700, color: 'white',
                    boxShadow: '0 2px 8px rgba(124,58,237,0.25)',
                }}>{narratorInitial}</div>
            )}
            <div style={{
                maxWidth: '78%',
                background: isSystem
                    ? 'white'
                    : 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
                color: isSystem ? '#1a1a2e' : 'white',
                borderRadius: isSystem ? '4px 18px 18px 18px' : '18px 4px 18px 18px',
                padding: '10px 16px',
                boxShadow: isSystem
                    ? '0 1px 4px rgba(0,0,0,0.08)'
                    : '0 2px 8px rgba(124,58,237,0.3)',
            }}>
                <p style={{ fontSize: 14.5, lineHeight: 1.6, margin: 0 }}>{msg.content}</p>
                <span style={{
                    fontSize: 11, opacity: 0.55, display: 'block', textAlign: 'right', marginTop: 4,
                }}>
                    {new Date(msg.timestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                </span>
            </div>
        </div>
    );
}

// ─── Step dots ────────────────────────────────────────────────────────────────
function ProgressDots({ total, current }: { total: number; current: number }) {
    return (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
            {Array.from({ length: total }).map((_, i) => (
                <div key={i} style={{
                    width: i === current ? 20 : 8, height: 8, borderRadius: 4,
                    background: i < current ? '#7c3aed' : i === current ? '#a855f7' : 'rgba(255,255,255,0.25)',
                    transition: 'all 0.3s ease',
                }} />
            ))}
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PlayPage() {
    const { id } = useParams() as { id: string };
    const [experience, setExperience] = useState<Experience | null>(null);
    const [steps, setSteps] = useState<Step[]>([]);
    const [messages, setMessages] = useState<PreviewMessage[]>([]);
    const [input, setInput] = useState('');
    const [stepIndex, setStepIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [sending, setSending] = useState(false);
    const [completed, setCompleted] = useState(false);
    const chatRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = () =>
        chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });

    const advanceNarrativeSteps = (allSteps: Step[], fromIndex: number, currentMsgs: PreviewMessage[]) => {
        if (fromIndex >= allSteps.length) { setStepIndex(allSteps.length); return; }
        const next = allSteps[fromIndex];
        if (!next.requires_response) {
            const delayMs = typeof next.delay_seconds === 'number' ? next.delay_seconds * 1000 : 1200;
            setTimeout(() => {
                const msg: PreviewMessage = {
                    role: 'system', content: next.message_to_send,
                    timestamp: new Date().toISOString(), evaluation: 'narrative',
                };
                const updated = [...currentMsgs, msg];
                setMessages(updated);
                setStepIndex(fromIndex);
                advanceNarrativeSteps(allSteps, fromIndex + 1, updated);
            }, delayMs);
        } else {
            // Reached an interactive step after a narrative chain. Print it!
            const delayMs = typeof next.delay_seconds === 'number' ? next.delay_seconds * 1000 : 1200;
            setTimeout(() => {
                const msg: PreviewMessage = {
                    role: 'system', content: next.message_to_send,
                    timestamp: new Date().toISOString(), evaluation: undefined,
                };
                const updated = [...currentMsgs, msg];
                setMessages(updated);
                setStepIndex(fromIndex); // This reveals the input to the user
            }, delayMs);
        }
    };

    useEffect(() => {
        Promise.all([getExperience(id), getSteps(id)]).then(([exp, stps]) => {
            if (!exp) { setNotFound(true); setLoading(false); return; }
            setExperience(exp);
            setSteps(stps);
            setLoading(false);

            if (stps.length > 0) {
                const firstMsg: PreviewMessage = {
                    role: 'system', content: stps[0].message_to_send,
                    timestamp: new Date().toISOString(),
                    evaluation: stps[0].requires_response ? undefined : 'narrative',
                };
                setMessages([firstMsg]);
                if (!stps[0].requires_response) advanceNarrativeSteps(stps, 1, [firstMsg]);
            }
        });
    }, [id]);

    useEffect(() => { scrollToBottom(); }, [messages]);
    useEffect(() => { if (!sending) inputRef.current?.focus(); }, [sending]);

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
                setStepIndex(nextIdx); // Hide input immediately if next is narrative
                if (nextIdx < steps.length && !steps[nextIdx].requires_response) {
                    const delayMs = typeof steps[nextIdx].delay_seconds === 'number' ? steps[nextIdx].delay_seconds! * 1000 : 800;
                    setTimeout(() => advanceNarrativeSteps(steps, nextIdx, withSystem), delayMs);
                }
            }
        } catch {
            setMessages(prev => [...prev, {
                role: 'system', content: 'Error de conexión. Por favor recargá la página.', timestamp: new Date().toISOString(),
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
            const firstMsg: PreviewMessage = {
                role: 'system', content: steps[0].message_to_send,
                timestamp: new Date().toISOString(),
                evaluation: steps[0].requires_response ? undefined : 'narrative',
            };
            setMessages([firstMsg]);
            if (!steps[0].requires_response) advanceNarrativeSteps(steps, 1, [firstMsg]);
        }
    };

    // ─── States ────────────────────────────────────────────────────────────────

    if (loading) return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, #1a0a2e 0%, #0f0a1e 60%, #0a0a14 100%)',
        }}>
            <div style={{
                width: 40, height: 40, borderRadius: '50%',
                border: '3px solid rgba(124,58,237,0.3)',
                borderTopColor: '#7c3aed',
                animation: 'spin 0.8s linear infinite',
            }} />
        </div>
    );

    if (notFound) return (
        <div style={{
            minHeight: '100vh', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 12,
            background: 'linear-gradient(135deg, #1a0a2e 0%, #0f0a1e 60%, #0a0a14 100%)',
            color: 'rgba(255,255,255,0.6)', fontFamily: 'Inter, sans-serif',
        }}>
            <div style={{ fontSize: 48 }}>🗺️</div>
            <h2 style={{ color: 'white', margin: 0 }}>Experiencia no encontrada</h2>
            <p style={{ margin: 0 }}>Este link puede haber expirado o ser inválido.</p>
        </div>
    );

    const narratorInitial = experience?.name?.[0]?.toUpperCase() ?? 'N';
    const currentStep = steps[stepIndex];
    const waitingForResponse = !completed && currentStep?.requires_response;

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(160deg, #1a0a2e 0%, #0f0a1e 50%, #0a0a14 100%)',
            display: 'flex', flexDirection: 'column',
            fontFamily: "'Inter', sans-serif",
        }}>
            {/* Ambient glow */}
            <div style={{
                position: 'fixed', inset: 0, pointerEvents: 'none',
                background: 'radial-gradient(ellipse 70% 50% at 50% -5%, rgba(124,58,237,0.2) 0%, transparent 70%)',
            }} />

            {/* Header */}
            <div style={{
                padding: '16px 20px',
                background: 'rgba(255,255,255,0.04)',
                backdropFilter: 'blur(12px)',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                position: 'sticky', top: 0, zIndex: 10,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, fontWeight: 800, color: 'white',
                    }}>SH</div>
                    <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>{experience?.name}</div>
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                            {completed ? '¡Completada!' : steps.length > 0 ? `Paso ${Math.min(stepIndex + 1, steps.length)} de ${steps.length}` : ''}
                        </div>
                    </div>
                </div>

                {/* Progress dots */}
                <ProgressDots total={steps.length} current={stepIndex} />

                <button
                    onClick={handleReset}
                    style={{
                        background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: 'rgba(255,255,255,0.5)',
                        display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
                        transition: 'all 0.15s',
                    }}
                    title="Reiniciar"
                >
                    <RotateCcw size={13} /> Reiniciar
                </button>
            </div>

            {/* Chat area */}
            <div
                ref={chatRef}
                style={{
                    flex: 1, overflowY: 'auto', padding: '20px 16px',
                    maxWidth: 640, width: '100%', margin: '0 auto',
                    scrollbarWidth: 'thin',
                    scrollbarColor: 'rgba(124,58,237,0.3) transparent',
                }}
            >
                {messages.map((msg, i) => (
                    <ChatBubble key={i} msg={msg} narratorInitial={narratorInitial} />
                ))}

                {sending && (
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 10 }}>
                        <div style={{
                            width: 32, height: 32, borderRadius: '50%',
                            background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 13, fontWeight: 700, color: 'white',
                        }}>{narratorInitial}</div>
                        <div style={{
                            background: 'white', borderRadius: '4px 18px 18px 18px',
                            padding: '12px 16px', display: 'flex', gap: 5,
                        }}>
                            {[0, 1, 2].map(i => (
                                <div key={i} style={{
                                    width: 7, height: 7, borderRadius: '50%',
                                    background: '#a78bfa',
                                    animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                                }} />
                            ))}
                        </div>
                    </div>
                )}

                {completed && (
                    <div style={{
                        textAlign: 'center', padding: '32px 20px',
                        background: 'rgba(124,58,237,0.1)',
                        border: '1px solid rgba(124,58,237,0.25)',
                        borderRadius: 20, margin: '16px 0',
                    }}>
                        <CheckCircle size={40} style={{ color: '#a78bfa', marginBottom: 12 }} />
                        <h3 style={{ color: 'white', margin: '0 0 8px', fontSize: 22 }}>¡Experiencia completada!</h3>
                        <p style={{ color: 'rgba(255,255,255,0.5)', margin: 0, fontSize: 14 }}>
                            Llegaste hasta el final. Gracias por participar.
                        </p>
                        <button
                            onClick={handleReset}
                            style={{
                                marginTop: 20, padding: '10px 24px',
                                background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
                                border: 'none', borderRadius: 12, cursor: 'pointer',
                                color: 'white', fontWeight: 600, fontSize: 14,
                            }}
                        >
                            Volver a empezar
                        </button>
                    </div>
                )}
            </div>

            {/* Input area */}
            {!completed && (
                <div style={{
                    padding: '12px 16px',
                    background: 'rgba(255,255,255,0.04)',
                    backdropFilter: 'blur(12px)',
                    borderTop: '1px solid rgba(255,255,255,0.08)',
                }}>
                    <div style={{
                        maxWidth: 640, margin: '0 auto',
                        display: 'flex', gap: 10, alignItems: 'flex-end',
                    }}>
                        {waitingForResponse ? (
                            <>
                                <input
                                    ref={inputRef}
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                                    placeholder="Escribí tu respuesta..."
                                    disabled={sending}
                                    style={{
                                        flex: 1, padding: '12px 16px',
                                        background: 'rgba(255,255,255,0.08)',
                                        border: '1px solid rgba(255,255,255,0.15)',
                                        borderRadius: 24, outline: 'none',
                                        color: 'white', fontSize: 14,
                                        fontFamily: 'inherit',
                                        transition: 'border-color 0.15s',
                                    }}
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={!input.trim() || sending}
                                    style={{
                                        width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                                        background: !input.trim() || sending
                                            ? 'rgba(124,58,237,0.3)'
                                            : 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
                                        border: 'none', cursor: !input.trim() || sending ? 'not-allowed' : 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: 'white', transition: 'all 0.15s',
                                        boxShadow: !input.trim() || sending ? 'none' : '0 4px 12px rgba(124,58,237,0.4)',
                                    }}
                                >
                                    <Send size={18} />
                                </button>
                            </>
                        ) : (
                            <div style={{
                                flex: 1, padding: '12px 16px',
                                background: 'rgba(255,255,255,0.04)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: 24, fontSize: 13,
                                color: 'rgba(255,255,255,0.3)', textAlign: 'center',
                            }}>
                                {sending ? 'Procesando...' : 'Esperá mientras el narrador continúa la historia...'}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Animations */}
            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes bounce {
                    0%, 80%, 100% { transform: translateY(0); }
                    40% { transform: translateY(-6px); }
                }
            `}</style>
        </div>
    );
}
