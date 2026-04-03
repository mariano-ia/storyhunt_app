'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowUp, RotateCcw, AlertTriangle, BookOpen, Zap, CheckCircle } from 'lucide-react';
import { getExperience, getSteps, getScenes } from '@/lib/firestore';
import type { Experience, Step, Scene, PreviewMessage } from '@/lib/types';

import { renderMessage } from '@/lib/renderMessage';

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
                    animation: msg.glitch_effect ? 'matrixGlitch 1.6s ease-out forwards' : undefined,
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
    const searchParams = useSearchParams();
    const fromStepParam = searchParams.get('from');
    const isEmbed = searchParams.get('embed') === '1';
    const [experience, setExperience] = useState<Experience | null>(null);
    const [steps, setSteps] = useState<Step[]>([]);
    const [scenes, setScenes] = useState<Scene[]>([]);
    const [currentSceneId, setCurrentSceneId] = useState<string | null>(null);
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
    const [errorScreen, setErrorScreen] = useState<{ text: string; active: boolean }>({ text: '', active: false });

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

    // Helper: get steps for a given scene, sorted by order
    const getSceneSteps = (allSteps: Step[], sceneId: string | null, allScenes: Scene[]): Step[] => {
        if (!allScenes.length || !sceneId) {
            // No scenes defined — treat all steps as a single flat list (backward compat)
            return [...allSteps].sort((a, b) => a.order - b.order);
        }
        return allSteps.filter(s => s.scene_id === sceneId).sort((a, b) => a.order - b.order);
    };

    // Helper: determine the next scene after the given one
    const getNextScene = (currentId: string, allScenes: Scene[]): Scene | null => {
        const current = allScenes.find(s => s.id === currentId);
        if (!current) return null;
        // Explicit next_scene_id takes precedence
        if (current.next_scene_id) {
            return allScenes.find(s => s.id === current.next_scene_id) ?? null;
        }
        // Otherwise fall through to next scene by order
        const sorted = [...allScenes].sort((a, b) => a.order - b.order);
        const idx = sorted.findIndex(s => s.id === currentId);
        return idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1] : null;
    };

    // Navigate to a scene and start advancing its narrative steps
    const navigateToScene = async (sceneId: string, allSteps: Step[], allScenes: Scene[]) => {
        setCurrentSceneId(sceneId);
        const sceneSteps = getSceneSteps(allSteps, sceneId, allScenes);
        await advanceNarrativeSteps(sceneSteps, 0, sceneId, allSteps, allScenes);
    };

    const advanceNarrativeSteps = async (
        sceneSteps: Step[],
        fromIndex: number,
        sceneId: string | null,
        allSteps: Step[],
        allScenes: Scene[],
    ) => {
        if (fromIndex >= sceneSteps.length) {
            // All steps in this scene are done — try to advance to next scene
            if (sceneId && allScenes.length > 0) {
                const nextScene = getNextScene(sceneId, allScenes);
                if (nextScene) {
                    await navigateToScene(nextScene.id, allSteps, allScenes);
                    return;
                }
            }
            // No more scenes — experience is completed
            setStepIndex(allSteps.length);
            setCompleted(true);
            return;
        }

        const next = sceneSteps[fromIndex];
        // Keep global stepIndex in sync (find index in allSteps)
        const globalIdx = allSteps.findIndex(s => s.id === next.id);

        if (next.step_type === 'error_screen') {
            setErrorScreen({ text: next.message_to_send, active: true });
            const duration = (next.delay_seconds ?? 4) * 1000;
            await new Promise(resolve => setTimeout(resolve, duration));
            setErrorScreen({ text: '', active: false });
            await advanceNarrativeSteps(sceneSteps, fromIndex + 1, sceneId, allSteps, allScenes);
        } else if (next.step_type === 'typing') {
            await pushMessageWithEffects(null, { ...next, interrupted_typing: true });
            await advanceNarrativeSteps(sceneSteps, fromIndex + 1, sceneId, allSteps, allScenes);
        } else if (next.step_type === 'narrative' || !next.requires_response) {
            const msg: PreviewMessage = {
                role: 'system', content: next.message_to_send,
                timestamp: new Date().toISOString(), evaluation: 'narrative',
                media_type: next.media_type, media_url: next.media_url,
                glitch_effect: next.glitch_effect,
            };

            await pushMessageWithEffects(msg, next);
            await advanceNarrativeSteps(sceneSteps, fromIndex + 1, sceneId, allSteps, allScenes);
        } else {
            // Reached an interactive step (interactive or choice) — stop and wait
            setStepIndex(globalIdx >= 0 ? globalIdx : fromIndex);

            const msg: PreviewMessage = {
                role: 'system', content: next.message_to_send,
                timestamp: new Date().toISOString(), evaluation: undefined,
                media_type: next.media_type, media_url: next.media_url,
                glitch_effect: next.glitch_effect,
            };
            await pushMessageWithEffects(msg, next);
        }
    };

    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;

        Promise.all([getExperience(id), getSteps(id), getScenes(id)]).then(([exp, stps, scns]) => {
            if (!exp) { setNotFound(true); setLoading(false); return; }
            setExperience(exp);
            setSteps(stps);
            const sortedScenes = [...scns].sort((a, b) => a.order - b.order);
            setScenes(sortedScenes);
            setLoading(false);
            // Global OPENAI_API_KEY is used as fallback, so no warning needed

            if (stps.length > 0) {
                const fromIdx = fromStepParam ? parseInt(fromStepParam, 10) : null;
                const init = async () => {
                    if (fromIdx !== null && fromIdx >= 0 && fromIdx < stps.length) {
                        // Start from a specific step (via ?from= param)
                        const targetStep = stps[fromIdx];
                        const targetSceneId = targetStep.scene_id || null;
                        if (targetSceneId) setCurrentSceneId(targetSceneId);
                        const sceneSteps = getSceneSteps(stps, targetSceneId, sortedScenes);
                        const localIdx = sceneSteps.findIndex(s => s.id === targetStep.id);
                        await advanceNarrativeSteps(sceneSteps, localIdx >= 0 ? localIdx : 0, targetSceneId, stps, sortedScenes);
                    } else if (sortedScenes.length > 0) {
                        // Start from the first scene
                        const firstScene = sortedScenes[0];
                        setCurrentSceneId(firstScene.id);
                        const sceneSteps = getSceneSteps(stps, firstScene.id, sortedScenes);
                        await advanceNarrativeSteps(sceneSteps, 0, firstScene.id, stps, sortedScenes);
                    } else {
                        // No scenes — flat list (backward compat)
                        const allStepsSorted = getSceneSteps(stps, null, []);
                        await advanceNarrativeSteps(allStepsSorted, 0, null, stps, []);
                    }
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
                body: JSON.stringify({ userMessage: userMsg.content, stepIndex, stepId: steps[stepIndex]?.id }),
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
                // Interactive step passed — advance within current scene
                const currentSceneSteps = getSceneSteps(steps, currentSceneId, scenes);
                const currentLocalIdx = currentSceneSteps.findIndex(s => s.id === steps[stepIndex]?.id);
                const nextLocalIdx = currentLocalIdx + 1;

                if (nextLocalIdx < currentSceneSteps.length) {
                    await advanceNarrativeSteps(currentSceneSteps, nextLocalIdx, currentSceneId, steps, scenes);
                } else {
                    // Scene is done — advance to next scene
                    if (currentSceneId && scenes.length > 0) {
                        const nextScene = getNextScene(currentSceneId, scenes);
                        if (nextScene) {
                            await navigateToScene(nextScene.id, steps, scenes);
                        } else {
                            setCompleted(true);
                            setStepIndex(steps.length);
                        }
                    } else {
                        setCompleted(true);
                        setStepIndex(steps.length);
                    }
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
                if (scenes.length > 0) {
                    const firstScene = scenes[0];
                    setCurrentSceneId(firstScene.id);
                    const sceneSteps = getSceneSteps(steps, firstScene.id, scenes);
                    await advanceNarrativeSteps(sceneSteps, 0, firstScene.id, steps, scenes);
                } else {
                    setCurrentSceneId(null);
                    const allStepsSorted = getSceneSteps(steps, null, []);
                    await advanceNarrativeSteps(allStepsSorted, 0, null, steps, []);
                }
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
    const currentScene = scenes.find(s => s.id === currentSceneId);
    const currentSceneSteps = getSceneSteps(steps, currentSceneId, scenes);
    const currentLocalStepIdx = currentStep ? currentSceneSteps.findIndex(s => s.id === currentStep.id) : -1;

    const isSystemDisable = sending || systemTyping || completed || !waitingForResponse;

    return (
        <div style={{
            height: 'calc(100vh - var(--topbar-height))',
            background: '#FFFFFF',
            display: 'flex', flexDirection: 'column',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
            WebkitFontSmoothing: 'antialiased',
        }}>
            {/* Error Screen Overlay */}
            {errorScreen.active && (
                <div className="error-screen-overlay">
                    <div className="error-screen-text">{errorScreen.text}</div>
                    <div className="error-screen-cursor" />
                </div>
            )}
            {/* Header — hidden in embed mode */}
            {!isEmbed && <div style={{
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
                                {stepIndex >= steps.length ? '¡Completada!' : (
                                    currentScene
                                        ? `${currentScene.name} · Paso ${currentLocalStepIdx + 1} de ${currentSceneSteps.length}`
                                        : `Paso ${stepIndex + 1} de ${steps.length}`
                                )}
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
            </div>}

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

            {/* Optional Current step info bar for creator debugging — hidden in embed */}
            {!isEmbed && currentStep && !completed && (
                <div style={{ padding: '8px 16px', background: '#F9F9F9', borderTop: '0.5px solid rgba(0,0,0,0.15)', fontSize: 12, color: '#8E8E93', display: 'flex', alignItems: 'center', gap: 8, maxWidth: 720, margin: '0 auto', width: '100%', flexWrap: 'wrap' }}>
                    {currentScene && (
                        <span style={{ color: '#6366F1', fontWeight: 600, marginRight: 4 }}>🎬 {currentScene.name}</span>
                    )}
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
                @keyframes matrixGlitch {
                    0%   { transform: translate(0); text-shadow: none; }
                    4%   { transform: translate(-4px, 0); text-shadow: 3px 0 rgba(255,0,60,0.9), -3px 0 rgba(0,255,180,0.9); }
                    8%   { transform: translate(4px, 1px); text-shadow: -3px 0 rgba(255,0,60,0.7), 3px 0 rgba(0,255,180,0.7); }
                    12%  { transform: translate(-2px, 0); text-shadow: 2px 0 rgba(255,0,60,0.4), -2px 0 rgba(0,255,180,0.4); }
                    16%  { transform: translate(0); text-shadow: none; }
                    55%  { transform: translate(0); text-shadow: none; }
                    58%  { transform: translate(-3px, 0) skewX(-2deg); text-shadow: 2px 0 rgba(255,0,60,0.8), -2px 0 rgba(0,255,180,0.8); }
                    62%  { transform: translate(3px, -1px) skewX(0); text-shadow: none; }
                    65%  { transform: translate(-1px, 0); text-shadow: 1px 0 rgba(255,0,60,0.4), -1px 0 rgba(0,255,180,0.4); }
                    68%  { transform: translate(0); text-shadow: none; }
                    100% { transform: translate(0); text-shadow: none; }
                }
            `}</style>
        </div>
    );
}
