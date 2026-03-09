'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ArrowUp, RotateCcw, AlertTriangle, BookOpen, Zap, CheckCircle } from 'lucide-react';
import { getExperience, getSteps } from '@/lib/firestore';
import type { Experience, Step, PreviewMessage } from '@/lib/types';

// ─── Message Renderer ─────────────────────────────────────────────────────────
function renderMessage(content: string): React.ReactNode {
    const lines = content.split('\n');
    return lines.map((line, lineIdx) => {
        const parts: React.ReactNode[] = [];
        const boldRegex = /\*\*(.*?)\*\*/g;
        let lastIndex = 0;
        let match;
        while ((match = boldRegex.exec(line)) !== null) {
            if (match.index > lastIndex) parts.push(line.slice(lastIndex, match.index));
            parts.push(<strong key={`b-${match.index}`}>{match[1]}</strong>);
            lastIndex = match.index + match[0].length;
        }
        if (lastIndex < line.length) parts.push(line.slice(lastIndex));
        return (
            <span key={lineIdx}>
                {parts.length > 0 ? parts : line}
                {lineIdx < lines.length - 1 && <br />}
            </span>
        );
    });
}

// ─── Chat Bubble ──────────────────────────────────────────────────────────────
function ChatMedia({ type, url }: { type: 'image' | 'video' | 'audio'; url: string }) {
    if (type === 'image') return <img src={url} alt="Media" style={{ width: '100%', borderRadius: 12, marginBottom: 4 }} />;
    if (type === 'video') return <video src={url} controls style={{ width: '100%', borderRadius: 12, marginBottom: 4 }} />;
    if (type === 'audio') return <audio src={url} controls style={{ width: '100%', marginBottom: 4 }} />;
    return null;
}

function ChatBubble({ msg, isLastSequence, isFirstSequence, narratorInitial, narratorAvatar }: { msg: PreviewMessage; isLastSequence: boolean; isFirstSequence: boolean; narratorInitial: string; narratorAvatar?: string }) {
    const isSystem = msg.role === 'system';

    const EVAL_COLORS: Record<string, string> = {
        correct: '#34D399',
        incorrect: '#EF4444',
        narrative: '#A78BFA',
        off_topic: '#F59E0B',
    };
    const evalColor = msg.evaluation ? EVAL_COLORS[msg.evaluation] : undefined;

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: isSystem ? 'flex-start' : 'flex-end',
            marginBottom: isLastSequence ? 16 : 4,
            width: '100%',
        }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', width: '100%', justifyContent: isSystem ? 'flex-start' : 'flex-end' }}>
                {isSystem && (
                    <div style={{
                        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                        background: isFirstSequence
                            ? (narratorAvatar ? `url(${narratorAvatar}) center/cover no-repeat` : 'linear-gradient(135deg, #A2AAAD 0%, #8E8E93 100%)')
                            : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, fontWeight: 500, color: 'white',
                        visibility: isFirstSequence ? 'visible' : 'hidden',
                        marginBottom: 2
                    }}>
                        {!narratorAvatar && isFirstSequence && narratorInitial}
                    </div>
                )}
                <div style={{
                    maxWidth: '75%',
                    background: isSystem ? '#E5E5EA' : '#0B84FF',
                    color: isSystem ? 'black' : 'white',
                    borderRadius: isSystem
                        ? (isLastSequence ? '18px 18px 18px 4px' : '18px')
                        : (isLastSequence ? '18px 18px 4px 18px' : '18px'),
                    padding: '8px 14px',
                    fontSize: 15,
                    lineHeight: 1.4,
                    wordBreak: 'break-word',
                }}>
                    {msg.media_url && msg.media_type && <ChatMedia type={msg.media_type} url={msg.media_url} />}
                    {renderMessage(msg.content)}
                </div>
            </div>
            {msg.evaluation && isLastSequence && (
                <span style={{ fontSize: 11, fontWeight: 600, color: evalColor, marginTop: 4, marginLeft: isSystem ? 40 : 0, marginRight: isSystem ? 0 : 4 }}>
                    {msg.evaluation === 'correct' ? '✓ Correcto' :
                        msg.evaluation === 'incorrect' ? '✗ Incorrecto' :
                            msg.evaluation === 'narrative' ? '📖 Narrativo' : '↗ Fuera de contexto'}
                </span>
            )}
        </div>
    );
}

function TypingIndicator({ narratorInitial, narratorAvatar }: { narratorInitial: string; narratorAvatar?: string }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 16, gap: 8, alignItems: 'flex-end' }}>
            <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: narratorAvatar ? `url(${narratorAvatar}) center/cover no-repeat` : 'linear-gradient(135deg, #A2AAAD 0%, #8E8E93 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 500, color: 'white',
                marginBottom: 2
            }}>
                {!narratorAvatar && narratorInitial}
            </div>
            <div style={{
                background: '#E5E5EA',
                borderRadius: '18px 18px 18px 18px',
                padding: '12px 14px',
                display: 'flex',
                gap: 4,
                width: 'fit-content',
                alignItems: 'center',
                height: 38
            }}>
                {[0, 1, 2].map(i => (
                    <div key={i} style={{
                        width: 7, height: 7, borderRadius: '50%', background: '#8E8E93',
                        animation: `iosBounce 1.4s infinite ease-in-out both`,
                        animationDelay: `${i * 0.16}s`
                    }} />
                ))}
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ExperiencePreview() {
    const { id } = useParams() as { id: string };
    const router = useRouter();
    const [experience, setExperience] = useState<Experience | null>(null);
    const [steps, setSteps] = useState<Step[]>([]);
    const [messages, setMessages] = useState<PreviewMessage[]>([]);
    const [input, setInput] = useState('');
    const [stepIndex, setStepIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    const [hasApiKey, setHasApiKey] = useState(true);

    // Status states
    const [sending, setSending] = useState(false);
    const [completed, setCompleted] = useState(false);
    const [systemTyping, setSystemTyping] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);
    const chatRef = useRef<HTMLDivElement>(null);
    const initialized = useRef(false);

    const scrollToBottom = () => {
        if (chatRef.current) {
            chatRef.current.scrollTop = chatRef.current.scrollHeight;
        }
    };

    const pushMessageWithEffects = async (msg: PreviewMessage | null, stepOptions: { interrupted_typing?: boolean; delay_seconds?: number } = {}) => {
        const { interrupted_typing, delay_seconds } = stepOptions;

        // Let React render current state before blocking with async sleep
        await new Promise(r => setTimeout(r, 50));

        const finalDelay = typeof delay_seconds === 'number' ? delay_seconds * 1000 : 1200;

        if (interrupted_typing) {
            setSystemTyping(true);
            await new Promise(r => setTimeout(r, 1500));
            setSystemTyping(false);
            await new Promise(r => setTimeout(r, 1500));
            setSystemTyping(true);
            await new Promise(r => setTimeout(r, finalDelay > 0 ? finalDelay : 1000));
        } else {
            setSystemTyping(true);
            await new Promise(r => setTimeout(r, finalDelay));
        }

        setSystemTyping(false);
        if (msg) {
            setMessages(prev => [...prev, msg]);
        }
    };

    const advanceNarrativeSteps = async (allSteps: Step[], fromIndex: number) => {
        if (fromIndex >= allSteps.length) {
            setStepIndex(allSteps.length);
            setCompleted(true);
            return;
        }

        const next = allSteps[fromIndex];

        if (next.step_type === 'typing') {
            await pushMessageWithEffects(null, { ...next, interrupted_typing: true });

            // Advance directly to next step without pause
            await advanceNarrativeSteps(allSteps, fromIndex + 1);
        } else if (next.step_type === 'narrative' || !next.requires_response) {
            const msg: PreviewMessage = {
                role: 'system', content: next.message_to_send,
                timestamp: new Date().toISOString(), evaluation: 'narrative',
                media_type: next.media_type, media_url: next.media_url
            };

            await pushMessageWithEffects(msg, next);

            // recurse to next step
            await advanceNarrativeSteps(allSteps, fromIndex + 1);
        } else {
            // Reached an interactive step
            setStepIndex(fromIndex);

            // Render it, and then STOP advancing
            const msg: PreviewMessage = {
                role: 'system', content: next.message_to_send,
                timestamp: new Date().toISOString(), evaluation: undefined,
                media_type: next.media_type, media_url: next.media_url
            };
            await pushMessageWithEffects(msg, next);
        }
    };

    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;

        Promise.all([getExperience(id), getSteps(id)]).then(([exp, stps]) => {
            if (!exp) { setNotFound(true); setLoading(false); return; }
            setExperience(exp);
            setSteps(stps);
            setLoading(false);
            if (!exp.llm_api_key) setHasApiKey(false);

            if (stps.length > 0) {
                const init = async () => {
                    // Kick off narrative steps starting from index 0
                    // Our recursive function will handle both the typing/narrative steps 
                    // and correctly stop + display the first interactive step.
                    // Doing pushMessage + advance was causing duplicates.
                    await advanceNarrativeSteps(stps, 0);
                };
                init();
            }
        });
    }, [id]);

    useEffect(() => { scrollToBottom(); }, [messages, systemTyping]);

    // Auto-focus input when the system finishes sending and it's an interactive step
    useEffect(() => {
        if (!sending && !systemTyping && !completed && steps[stepIndex]?.requires_response) {
            inputRef.current?.focus();
        }
    }, [sending, systemTyping, completed, stepIndex, steps]);

    const handleSend = async () => {
        if (!input.trim() || sending || completed || systemTyping) return;

        const userMsg: PreviewMessage = { role: 'user', content: input.trim(), timestamp: new Date().toISOString() };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setSending(true);

        try {
            const res = await fetch(`/api/experiences/${id}/preview`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userMessage: userMsg.content, stepIndex }),
            });
            const data = await res.json();

            const isCorrect = data.evaluation === 'correct';
            const nextIdx = data.nextStepIndex;
            const nextStepObj = (steps && nextIdx < steps.length) ? steps[nextIdx] : undefined;

            const systemMsg: PreviewMessage = {
                role: 'system',
                content: data.response ?? data.error ?? 'Error desconocido',
                timestamp: new Date().toISOString(),
                evaluation: data.evaluation,
                media_type: isCorrect && nextStepObj ? nextStepObj.media_type : undefined,
                media_url: isCorrect && nextStepObj ? nextStepObj.media_url : undefined
            };

            await pushMessageWithEffects(systemMsg, {
                delay_seconds: 1.0,
                interrupted_typing: isCorrect && nextStepObj ? nextStepObj.interrupted_typing : false
            });

            if (data.completed) {
                setCompleted(true);
                setStepIndex(steps.length);
            } else if (isCorrect) {
                // Since this interactive step is passed, we advance starting from the next
                if (nextIdx < steps.length) {
                    await advanceNarrativeSteps(steps, nextIdx);
                }
            }
        } catch {
            setMessages(prev => [...prev, {
                role: 'system', content: 'Ups, no se pudo enviar el mensaje.', timestamp: new Date().toISOString(),
            }]);
        }
        setSending(false);
    };

    const handleReset = () => {
        setMessages([]);
        setStepIndex(0);
        setCompleted(false);
        setInput('');
        setSystemTyping(false);

        if (steps.length > 0) {
            const init = async () => {
                await advanceNarrativeSteps(steps, 0);
            };
            init();
        }
    };

    if (loading) return (
        <div style={{ height: 'calc(100vh - 64px)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF' }}>
            <div style={{ width: 30, height: 30, border: '3px solid #E5E5EA', borderTopColor: '#8E8E93', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );

    if (notFound || !experience) return (
        <div style={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF', color: '#8E8E93', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <h2 style={{ fontSize: 18, color: 'black', margin: 0, fontWeight: 600 }}>Vista Previa no encontrada</h2>
        </div>
    );

    const narratorInitial = experience?.name?.[0]?.toUpperCase() ?? 'N';
    const currentStep = steps[stepIndex];
    const waitingForResponse = !completed && currentStep?.requires_response;

    const isSystemDisable = sending || systemTyping || completed || !waitingForResponse;

    return (
        <div style={{
            height: 'calc(100vh - var(--topbar-height))',
            background: '#FFFFFF',
            display: 'flex', flexDirection: 'column',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
            WebkitFontSmoothing: 'antialiased',
        }}>
            {/* Header */}
            <div style={{
                background: 'rgba(249,249,249,0.85)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderBottom: '0.5px solid rgba(0,0,0,0.15)',
                padding: '12px 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                position: 'sticky', top: 0, zIndex: 10,
                color: 'black'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button
                        onClick={() => router.push(`/dashboard/experiences/${id}`)}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#0B84FF', display: 'flex', alignItems: 'center' }}
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                            width: 40, height: 40, borderRadius: '50%',
                            background: 'linear-gradient(135deg, #A2AAAD 0%, #8E8E93 100%)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 18, fontWeight: 500, color: 'white',
                        }}>
                            {narratorInitial}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: 17, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                                {experience?.name}
                            </span>
                            <span style={{ fontSize: 12, color: '#8E8E93', fontWeight: 500 }}>
                                {stepIndex >= steps.length ? '¡Completada!' : `Paso ${stepIndex + 1} de ${steps.length}`}
                            </span>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    {!hasApiKey && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#F59E0B', fontWeight: 500 }}>
                            <AlertTriangle size={14} /> Sin API key
                        </div>
                    )}
                    <button
                        onClick={handleReset}
                        style={{
                            background: '#E5E5EA', border: 'none', cursor: 'pointer',
                            color: '#0B84FF', padding: '6px 12px', borderRadius: '14px',
                            display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500
                        }}
                    >
                        <RotateCcw size={14} /> Reiniciar
                    </button>
                </div>
            </div>

            {/* Chat area */}
            <div
                ref={chatRef}
                style={{
                    flex: 1, overflowY: 'auto', padding: '24px 16px 16px',
                    display: 'flex', flexDirection: 'column',
                    maxWidth: 720, margin: '0 auto', width: '100%',
                }}
            >
                <div style={{ fontSize: 11, color: '#8E8E93', textAlign: 'center', margin: '0 0 24px', fontWeight: 500 }}>
                    Hoy {new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                </div>

                {messages.map((msg, i) => {
                    const nextMsg = messages[i + 1];
                    const prevMsg = messages[i - 1];
                    const isLastInSequence = !nextMsg || nextMsg.role !== msg.role;
                    const isFirstInSequence = !prevMsg || prevMsg.role !== msg.role;
                    return <ChatBubble key={i} msg={msg} isLastSequence={isLastInSequence} isFirstSequence={isFirstInSequence} narratorInitial={narratorInitial} narratorAvatar={experience?.narrator_avatar} />
                })}

                {systemTyping && <TypingIndicator narratorInitial={narratorInitial} narratorAvatar={experience?.narrator_avatar} />}

                {completed && (
                    <div style={{ textAlign: 'center', margin: '24px 0', fontSize: 13, color: '#8E8E93' }}>
                        Experiencia Completada.
                    </div>
                )}

                <div style={{ flexShrink: 0, height: 8 }} />
            </div>

            {/* Optional Current step info bar for creator debugging */}
            {currentStep && !completed && (
                <div style={{ padding: '8px 16px', background: '#F9F9F9', borderTop: '0.5px solid rgba(0,0,0,0.15)', fontSize: 12, color: '#8E8E93', display: 'flex', alignItems: 'center', gap: 8, maxWidth: 720, margin: '0 auto', width: '100%' }}>
                    {currentStep.requires_response ? (
                        <>
                            <Zap size={14} style={{ color: '#0B84FF' }} />
                            <span>Esperando: <strong style={{ color: 'black', fontWeight: 500 }}>{currentStep.expected_answer}</strong></span>
                            {currentStep.hints.length > 0 && <span>· {currentStep.hints.length} pista(s)</span>}
                        </>
                    ) : (
                        <>
                            <BookOpen size={14} style={{ color: '#0B84FF' }} />
                            <span>Narrativo — avanzando...</span>
                        </>
                    )}
                </div>
            )}

            {/* Input area */}
            <div style={{
                background: 'rgba(249,249,249,0.85)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderTop: '0.5px solid rgba(0,0,0,0.15)',
                padding: '8px 16px 24px',
            }}>
                <div style={{
                    maxWidth: 720, margin: '0 auto',
                    display: 'flex', gap: 12, alignItems: 'flex-end',
                }}>
                    <div style={{
                        flex: 1,
                        background: '#FFFFFF',
                        border: '1px solid #E5E5EA',
                        borderRadius: 20,
                        padding: '6px 6px 6px 14px',
                        display: 'flex', alignItems: 'center',
                    }}>
                        <input
                            ref={inputRef}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                            placeholder={isSystemDisable ? (completed ? 'Chat terminado' : 'Escribiendo...') : 'Mensaje iMessage'}
                            disabled={isSystemDisable}
                            style={{
                                flex: 1, border: 'none', background: 'transparent',
                                outline: 'none', color: 'black', fontSize: 16,
                                padding: '6px 0', fontFamily: 'inherit'
                            }}
                        />
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || isSystemDisable}
                            style={{
                                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                                background: !input.trim() || isSystemDisable ? '#E5E5EA' : '#0B84FF',
                                border: 'none', padding: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: !input.trim() || isSystemDisable ? '#C7C7CC' : 'white',
                                transition: 'all 0.2s', cursor: !input.trim() || isSystemDisable ? 'default' : 'pointer'
                            }}
                        >
                            <ArrowUp size={16} strokeWidth={3} />
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes iosBounce {
                    0%, 100% { transform: scale(1); opacity: 0.3; }
                    50% { transform: scale(1.4); opacity: 1; }
                }
            `}</style>
        </div>
    );
}
