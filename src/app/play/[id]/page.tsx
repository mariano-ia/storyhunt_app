'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { ArrowUp, RotateCcw } from 'lucide-react';
import { getExperience, getSteps, getScenes } from '@/lib/firestore';

// Session writes go through Admin-SDK-backed API endpoints so they work
// without client Firestore auth.
async function apiCreateSession(data: {
    experience_id: string;
    email?: string;
    lang?: 'es' | 'en';
    total_steps: number;
}): Promise<string | null> {
    try {
        const res = await fetch('/api/sessions/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!res.ok) return null;
        const json = await res.json() as { id?: string };
        return json.id || null;
    } catch {
        return null;
    }
}

async function apiUpdateSession(id: string, updates: Record<string, unknown>): Promise<void> {
    try {
        await fetch('/api/sessions/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, ...updates }),
        });
    } catch {
        /* non-blocking */
    }
}
import type { Experience, Step, PreviewMessage, Scene } from '@/lib/types';

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
    return (
        <div style={{
            display: 'flex',
            justifyContent: isSystem ? 'flex-start' : 'flex-end',
            marginBottom: isLastSequence ? 16 : 4,
            width: '100%',
            gap: 8,
            alignItems: 'flex-end'
        }}>
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
export default function PlayPage() {
    const { id } = useParams() as { id: string };
    const searchParams = useSearchParams();
    const fromStepParam = searchParams.get('from');
    const langParam = searchParams.get('lang') as 'es' | 'en' | null;
    const lang = langParam || 'es';
    const tokenParam = searchParams.get('token');
    const [experience, setExperience] = useState<Experience | null>(null);
    const [steps, setSteps] = useState<Step[]>([]);
    const [scenes, setScenes] = useState<Scene[]>([]);
    const [currentSceneId, setCurrentSceneId] = useState<string | null>(null);
    const [messages, setMessages] = useState<PreviewMessage[]>([]);
    const [input, setInput] = useState('');
    const [stepIndex, setStepIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    // Paywall states
    const [paywallStatus, setPaywallStatus] = useState<'none' | 'checking' | 'blocked' | 'invalid' | 'expired' | 'used'>('none');
    const [buyerEmail, setBuyerEmail] = useState('');
    const [paywallMessage, setPaywallMessage] = useState('');

    // Status states
    const [sending, setSending] = useState(false);
    const [completed, setCompleted] = useState(false);
    const [systemTyping, setSystemTyping] = useState(false);
    const [errorScreen, setErrorScreen] = useState<{ text: string; active: boolean }>({ text: '', active: false });

    // Session & rating states
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [ratingPhase, setRatingPhase] = useState<'none' | 'asking' | 'done'>('none');

    const chatRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const initialized = useRef(false);
    const sessionIdRef = useRef<string | null>(null);

    // Keep ref in sync with state (so async callbacks can access latest)
    useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);

    const trackStep = (step: number) => {
        if (sessionIdRef.current) {
            apiUpdateSession(sessionIdRef.current, { current_step: step });
        }
    };

    const trackCompletion = (rating?: 'positive' | 'neutral' | 'negative', comment?: string) => {
        if (sessionIdRef.current) {
            apiUpdateSession(sessionIdRef.current, {
                status: 'completed',
                completed_at: new Date().toISOString(),
                ...(rating && { rating }),
                ...(comment && { rating_comment: comment }),
            });
        }
    };

    const handleExperienceComplete = async () => {
        // Show closing message from narrator
        const closingMsg = lang === 'en'
            ? "That's it. You made it to the end. I hope the city showed you something you weren't expecting. Before you go... what did you think of this adventure?"
            : "Eso es todo. Llegaste hasta el final. Espero que la ciudad te haya mostrado algo que no esperabas. Antes de irte... ¿qué te pareció esta aventura?";

        await pushMessageWithEffects(
            { role: 'system', content: closingMsg, timestamp: new Date().toISOString() },
            { delay_seconds: 1.5 }
        );
        setRatingPhase('asking');
    };

    const handleRatingSend = async () => {
        if (!input.trim() || sending) return;

        const userComment = input.trim();
        const userMsg: PreviewMessage = { role: 'user', content: userComment, timestamp: new Date().toISOString() };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setSending(true);

        // Evaluate rating via LLM
        let rating: 'positive' | 'neutral' | 'negative' = 'neutral';
        try {
            const res = await fetch(`/api/experiences/${id}/preview`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userMessage: userComment,
                    ratingEvaluation: true,
                    lang,
                }),
            });
            const data = await res.json();
            if (data.rating) rating = data.rating;
        } catch {
            // fallback to neutral
        }

        // Thank the user
        const thankMsg = lang === 'en'
            ? "Thanks for playing. See you on the next hunt."
            : "Gracias por jugar. Nos vemos en la próxima aventura.";

        await pushMessageWithEffects(
            { role: 'system', content: thankMsg, timestamp: new Date().toISOString() },
            { delay_seconds: 1.0 }
        );

        trackCompletion(rating, userComment);
        setRatingPhase('done');
        setCompleted(true);
        setSending(false);
    };

    // Resolve message text based on language
    const getMsg = (step: Step) => lang === 'en' && (step as any).message_to_send_en ? (step as any).message_to_send_en : step.message_to_send;

    const scrollToBottom = () => {
        if (chatRef.current) {
            chatRef.current.scrollTop = chatRef.current.scrollHeight;
        }
    };

    // ─── Scene helpers ────────────────────────────────────────────────────────
    const getSceneSteps = (allSteps: Step[], sceneId: string | null): Step[] => {
        if (!sceneId) return allSteps; // no scenes — flat fallback
        return allSteps.filter(s => s.scene_id === sceneId).sort((a, b) => a.order - b.order);
    };

    const getNextSceneId = (allScenes: Scene[], currentId: string): string | null => {
        const current = allScenes.find(s => s.id === currentId);
        if (!current) return null;
        // Explicit next_scene_id takes priority
        if (current.next_scene_id) return current.next_scene_id;
        // Otherwise, next scene by order
        const sorted = [...allScenes].sort((a, b) => a.order - b.order);
        const idx = sorted.findIndex(s => s.id === currentId);
        if (idx >= 0 && idx < sorted.length - 1) return sorted[idx + 1].id;
        return null; // last scene
    };

    const pushMessageWithEffects = async (msg: PreviewMessage | null, stepOptions: { interrupted_typing?: boolean; delay_seconds?: number } = {}) => {
        const { interrupted_typing, delay_seconds } = stepOptions;

        // Let React render current state before blocking with async sleep
        await new Promise(r => setTimeout(r, 50));

        const finalDelay = typeof delay_seconds === 'number' ? delay_seconds * 1000 : 1200;

        if (interrupted_typing) {
            // Start typing
            setSystemTyping(true);
            await new Promise(r => setTimeout(r, 1500)); // Types for 1.5s
            // Stops typing
            setSystemTyping(false);
            await new Promise(r => setTimeout(r, 1500)); // Hesitates for 1.5s
            // Resume typing
            setSystemTyping(true);
            await new Promise(r => setTimeout(r, finalDelay > 0 ? finalDelay : 1000));
        } else {
            // Standard typing effect
            setSystemTyping(true);
            await new Promise(r => setTimeout(r, finalDelay));
        }

        setSystemTyping(false);
        if (msg) {
            setMessages(prev => [...prev, msg]);
        }
    };

    // Resolve the next step after a given step, respecting next_step_id
    const resolveNextAdvance = (
        currentStep: Step,
        sceneSteps: Step[],
        fromIndex: number,
        allScenes: Scene[],
        sceneId: string | null,
        allSteps: Step[],
    ): { sceneSteps: Step[]; nextIndex: number; sceneId: string | null } | null => {
        if (currentStep.next_step_id) {
            // Jump to a specific step by ID
            const targetStep = allSteps.find(s => s.id === currentStep.next_step_id);
            if (targetStep) {
                const targetSceneId = targetStep.scene_id || sceneId;
                const targetSceneSteps = getSceneSteps(allSteps, targetSceneId);
                const targetIdx = targetSceneSteps.findIndex(s => s.id === targetStep.id);
                return { sceneSteps: targetSceneSteps, nextIndex: targetIdx >= 0 ? targetIdx : 0, sceneId: targetSceneId };
            }
        }
        // Default: advance to next in sequence
        return { sceneSteps, nextIndex: fromIndex + 1, sceneId };
    };

    const advanceNarrativeSteps = async (
        sceneSteps: Step[],
        fromIndex: number,
        allScenes: Scene[],
        sceneId: string | null,
        allSteps: Step[],
    ) => {
        if (fromIndex >= sceneSteps.length) {
            // All steps in current scene are done — navigate to next scene
            if (sceneId && allScenes.length > 0) {
                const nextId = getNextSceneId(allScenes, sceneId);
                if (nextId) {
                    setCurrentSceneId(nextId);
                    const nextSceneSteps = getSceneSteps(allSteps, nextId);
                    if (nextSceneSteps.length > 0) {
                        await advanceNarrativeSteps(nextSceneSteps, 0, allScenes, nextId, allSteps);
                        return;
                    }
                }
            }
            // No next scene or no scenes at all — experience complete
            setStepIndex(allSteps.length);
            handleExperienceComplete();
            return;
        }

        const next = sceneSteps[fromIndex];
        // Keep stepIndex pointing to position in the full steps array
        const globalIndex = allSteps.findIndex(s => s.id === next.id);
        trackStep(globalIndex >= 0 ? globalIndex : fromIndex);

        if (next.step_type === 'error_screen') {
            setErrorScreen({ text: getMsg(next), active: true });
            const duration = (next.delay_seconds ?? 4) * 1000;
            await new Promise(resolve => setTimeout(resolve, duration));
            setErrorScreen({ text: '', active: false });
            const resolved = resolveNextAdvance(next, sceneSteps, fromIndex, allScenes, sceneId, allSteps);
            if (resolved) { if (resolved.sceneId !== sceneId) setCurrentSceneId(resolved.sceneId); await advanceNarrativeSteps(resolved.sceneSteps, resolved.nextIndex, allScenes, resolved.sceneId, allSteps); }
        } else if (next.step_type === 'typing') {
            await pushMessageWithEffects(null, { ...next, interrupted_typing: true });
            const resolved = resolveNextAdvance(next, sceneSteps, fromIndex, allScenes, sceneId, allSteps);
            if (resolved) { if (resolved.sceneId !== sceneId) setCurrentSceneId(resolved.sceneId); await advanceNarrativeSteps(resolved.sceneSteps, resolved.nextIndex, allScenes, resolved.sceneId, allSteps); }
        } else if (next.step_type === 'narrative' || !next.requires_response) {
            const msg: PreviewMessage = {
                role: 'system', content: getMsg(next),
                timestamp: new Date().toISOString(), evaluation: 'narrative',
                media_type: next.media_type, media_url: next.media_url,
                glitch_effect: next.glitch_effect,
            };

            await pushMessageWithEffects(msg, next);
            const resolved = resolveNextAdvance(next, sceneSteps, fromIndex, allScenes, sceneId, allSteps);
            if (resolved) { if (resolved.sceneId !== sceneId) setCurrentSceneId(resolved.sceneId); await advanceNarrativeSteps(resolved.sceneSteps, resolved.nextIndex, allScenes, resolved.sceneId, allSteps); }
        } else {
            // Interactive step: pause execution here
            setStepIndex(globalIndex >= 0 ? globalIndex : fromIndex);

            const msg: PreviewMessage = {
                role: 'system', content: getMsg(next),
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

        Promise.all([getExperience(id), getSteps(id), getScenes(id)]).then(async ([exp, stps, scns]) => {
            if (!exp) { setNotFound(true); setLoading(false); return; }
            setExperience(exp);
            setSteps(stps);

            const sortedScenes = [...scns].sort((a, b) => a.order - b.order);
            setScenes(sortedScenes);

            // Determine starting scene
            const firstSceneId = sortedScenes.length > 0 ? sortedScenes[0].id : null;
            setCurrentSceneId(firstSceneId);

            // ─── Paywall check: paid experiences require a valid token ─────
            const isPaid = typeof exp.price === 'number' && exp.price > 0;
            const isTestMode = exp.mode === 'test';
            const isPreview = searchParams.get('preview') === '1';

            if (isPaid && !isTestMode && !isPreview) {
                if (!tokenParam) {
                    setPaywallStatus('blocked');
                    setPaywallMessage('This experience requires a ticket to access.');
                    setLoading(false);
                    return;
                }

                setPaywallStatus('checking');
                setLoading(false);

                try {
                    const res = await fetch('/api/access/verify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ token: tokenParam }),
                    });

                    if (!res.ok) {
                        const data = await res.json();
                        if (res.status === 402) {
                            setPaywallStatus('invalid');
                            setPaywallMessage('Payment was not completed. Please try again.');
                        } else {
                            setPaywallStatus('invalid');
                            setPaywallMessage(data.error || 'This access link is not valid.');
                        }
                        return;
                    }

                    const { access_token: accessToken } = await res.json();

                    // Verify token belongs to this experience
                    if (accessToken.experience_id !== id) {
                        setPaywallStatus('invalid');
                        setPaywallMessage('This token is not valid for this experience.');
                        return;
                    }

                    // Check expiration
                    if (new Date(accessToken.expires_at) < new Date()) {
                        setPaywallStatus('expired');
                        setPaywallMessage('This access link has expired.');
                        return;
                    }

                    // Check usage
                    if (accessToken.times_used >= accessToken.max_uses) {
                        setPaywallStatus('used');
                        setPaywallMessage('This access link has already been used the maximum number of times.');
                        return;
                    }

                    // Valid — clear paywall and save buyer email for session tracking
                    setPaywallStatus('none');
                    if (accessToken.email) setBuyerEmail(accessToken.email);
                } catch {
                    setPaywallStatus('invalid');
                    setPaywallMessage('An error occurred while verifying your access. Please reload the page.');
                    return;
                }
            }
            // ─── End paywall check ────────────────────────────────────────

            setLoading(false);

            // Create session (skip for previews)
            if (!isPreview && stps.length > 0) {
                const sid = await apiCreateSession({
                    experience_id: id,
                    email: buyerEmail,
                    lang,
                    total_steps: stps.length,
                });
                if (sid) setSessionId(sid);
            }

            if (stps.length > 0) {
                const fromIdx = fromStepParam ? parseInt(fromStepParam, 10) : null;
                const init = async () => {
                    if (fromIdx !== null && fromIdx >= 0 && fromIdx < stps.length) {
                        // Start from a specific step (via ?from= param)
                        const targetStep = stps[fromIdx];
                        const targetSceneId = targetStep.scene_id || firstSceneId;
                        if (targetSceneId) setCurrentSceneId(targetSceneId);
                        const sceneSteps = getSceneSteps(stps, targetSceneId);
                        const localIdx = sceneSteps.findIndex(s => s.id === targetStep.id);
                        await advanceNarrativeSteps(sceneSteps, localIdx >= 0 ? localIdx : 0, sortedScenes, targetSceneId, stps);
                    } else {
                        const initialSceneSteps = getSceneSteps(stps, firstSceneId);
                        await advanceNarrativeSteps(initialSceneSteps, 0, sortedScenes, firstSceneId, stps);
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
        // If in rating phase, route to rating handler
        if (ratingPhase === 'asking') {
            await handleRatingSend();
            return;
        }
        if (!input.trim() || sending || completed || systemTyping) return;

        const userMsg: PreviewMessage = { role: 'user', content: input.trim(), timestamp: new Date().toISOString() };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setSending(true);

        try {
            const res = await fetch(`/api/experiences/${id}/preview`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userMessage: userMsg.content, stepIndex, stepId: steps[stepIndex]?.id, lang }),
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
                // Inherit media from the next step if we successfully advanced
                media_type: isCorrect && nextStepObj ? nextStepObj.media_type : undefined,
                media_url: isCorrect && nextStepObj ? nextStepObj.media_url : undefined
            };

            await pushMessageWithEffects(systemMsg, {
                delay_seconds: 1.0,
                // Only use interrupted typing on correct evaluation if the next step has it
                interrupted_typing: isCorrect && nextStepObj ? nextStepObj.interrupted_typing : false
            });

            if (data.completed) {
                setStepIndex(steps.length);
                handleExperienceComplete();
            } else if (isCorrect) {
                const currentStep = steps[stepIndex];
                // Check if current step has a next_step_id override
                if (currentStep?.next_step_id) {
                    const targetStep = steps.find(s => s.id === currentStep.next_step_id);
                    if (targetStep) {
                        const targetSceneId = targetStep.scene_id || currentSceneId;
                        if (targetSceneId !== currentSceneId) setCurrentSceneId(targetSceneId);
                        const targetSceneSteps = getSceneSteps(steps, targetSceneId);
                        const targetIdx = targetSceneSteps.findIndex(s => s.id === targetStep.id);
                        await advanceNarrativeSteps(targetSceneSteps, targetIdx >= 0 ? targetIdx : 0, scenes, targetSceneId, steps);
                        return;
                    }
                }
                // Default: advance +1 in scene
                const sceneSteps = currentSceneId
                    ? steps.filter(s => s.scene_id === currentSceneId).sort((a, b) => a.order - b.order)
                    : steps;
                const currentLocalIdx = sceneSteps.findIndex(s => s.id === steps[stepIndex]?.id);
                const nextLocalIdx = currentLocalIdx >= 0 ? currentLocalIdx + 1 : 0;
                if (nextLocalIdx < sceneSteps.length) {
                    await advanceNarrativeSteps(sceneSteps, nextLocalIdx, scenes, currentSceneId, steps);
                } else if (scenes.length > 0 && currentSceneId) {
                    // Scene ended, navigate to next
                    const currentScene = scenes.find(s => s.id === currentSceneId);
                    const nextScene = currentScene?.next_scene_id
                        ? scenes.find(s => s.id === currentScene.next_scene_id)
                        : scenes[scenes.findIndex(s => s.id === currentSceneId) + 1];
                    if (nextScene) {
                        setCurrentSceneId(nextScene.id);
                        const nextSceneSteps = steps.filter(s => s.scene_id === nextScene.id).sort((a, b) => a.order - b.order);
                        if (nextSceneSteps.length > 0) {
                            await advanceNarrativeSteps(nextSceneSteps, 0, scenes, nextScene.id, steps);
                        }
                    } else {
                        handleExperienceComplete();
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

        if (scenes.length > 0) {
            const firstScene = scenes[0];
            setCurrentSceneId(firstScene.id);
            const firstSceneSteps = steps.filter(s => s.scene_id === firstScene.id).sort((a, b) => a.order - b.order);
            if (firstSceneSteps.length > 0) {
                (async () => { await advanceNarrativeSteps(firstSceneSteps, 0, scenes, firstScene.id, steps); })();
            }
        } else if (steps.length > 0) {
            (async () => { await advanceNarrativeSteps(steps, 0, [], null, steps); })();
        }
    };

    // ─── States ────────────────────────────────────────────────────────────────

    if (loading) return (
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF' }}>
            <div style={{ width: 30, height: 30, border: '3px solid #E5E5EA', borderTopColor: '#8E8E93', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );

    if (notFound) return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF', color: '#8E8E93', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <h2 style={{ fontSize: 18, color: 'black', margin: 0, fontWeight: 600 }}>Chat no encontrado</h2>
            <p style={{ margin: '8px 0 0', fontSize: 15 }}>Esta experiencia no existe.</p>
        </div>
    );

    if (paywallStatus === 'checking') return (
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', fontFamily: "'Fira Code', monospace" }}>
            <div style={{ textAlign: 'center', color: '#00ff41' }}>
                <div style={{ fontSize: 18, marginBottom: 12 }}>Verifying access...</div>
                <div style={{ fontSize: 13, opacity: 0.6 }}>This may take a few seconds</div>
            </div>
        </div>
    );

    if (paywallStatus === 'blocked' || paywallStatus === 'invalid' || paywallStatus === 'expired' || paywallStatus === 'used') return (
        <div style={{
            height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#000', fontFamily: "'Fira Code', monospace",
        }}>
            <div style={{ textAlign: 'center', maxWidth: 420, padding: 32 }}>
                <div style={{
                    fontSize: 48, marginBottom: 20, opacity: 0.3,
                    color: paywallStatus === 'expired' ? '#F59E0B' : paywallStatus === 'blocked' ? '#7C3AED' : '#EF4444',
                }}>
                    {paywallStatus === 'blocked' ? '$' : paywallStatus === 'expired' ? '!' : 'X'}
                </div>
                <div style={{ fontSize: 16, color: '#fff', marginBottom: 12, fontWeight: 600 }}>
                    {paywallStatus === 'blocked' && 'Access Required'}
                    {paywallStatus === 'invalid' && 'Invalid Access'}
                    {paywallStatus === 'expired' && 'Link Expired'}
                    {paywallStatus === 'used' && 'Link Already Used'}
                </div>
                <div style={{ fontSize: 14, color: '#94A3B8', lineHeight: 1.6, marginBottom: 24 }}>
                    {paywallStatus === 'blocked'
                        ? 'This experience requires a ticket. Visit storyhunt.city to purchase access.'
                        : paywallMessage}
                </div>
                <a href="https://storyhunt.city" style={{
                    display: 'inline-block', padding: '10px 24px',
                    background: '#7C3AED', color: '#fff', borderRadius: 8,
                    textDecoration: 'none', fontSize: 14, fontWeight: 600,
                }}>
                    Get your ticket
                </a>
            </div>
        </div>
    );

    const narratorInitial = experience?.name?.[0]?.toUpperCase() ?? 'N';
    const currentStep = steps[stepIndex];
    const waitingForResponse = !completed && currentStep?.requires_response;

    const isRatingInput = ratingPhase === 'asking';
    const isSystemDisable = isRatingInput ? sending : (sending || systemTyping || completed || !waitingForResponse);

    return (
        <div style={{
            height: '100vh',
            background: '#FFFFFF',
            display: 'flex', flexDirection: 'column',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
            WebkitFontSmoothing: 'antialiased',
        }}>
            {/* Error Screen Overlay */}
            {errorScreen.active && (
                <div className="error-screen-overlay">
                    <div className="error-screen-text">
                        {errorScreen.text}
                    </div>
                    <div className="error-screen-cursor" />
                </div>
            )}

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
                        <span style={{ fontSize: 17, fontWeight: 600 }}>{experience?.name}</span>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                </div>
            </div>

            {/* Chat area */}
            <div
                ref={chatRef}
                style={{
                    flex: 1, overflowY: 'auto', padding: '16px 12px',
                    display: 'flex', flexDirection: 'column',
                    maxWidth: 720, margin: '0 auto', width: '100%',
                }}
            >
                <div style={{ fontSize: 11, color: '#8E8E93', textAlign: 'center', margin: '8px 0 24px', fontWeight: 500 }}>
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

                {completed && ratingPhase === 'done' && (
                    <div style={{ textAlign: 'center', margin: '24px 0', fontSize: 13, color: '#8E8E93' }}>
                        {lang === 'en' ? 'Experience completed.' : 'Experiencia completada.'}
                    </div>
                )}

                {/* Spacer to push input into view properly if needed */}
                <div style={{ flexShrink: 0, height: 8 }} />
            </div>

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
                            placeholder={isRatingInput ? (lang === 'en' ? 'Share your thoughts...' : 'Contanos qué te pareció...') : isSystemDisable ? (completed ? (lang === 'en' ? 'Chat ended' : 'Chat terminado') : 'iMessage') : 'iMessage'}
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
