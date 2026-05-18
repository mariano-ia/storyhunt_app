import { NextRequest, NextResponse } from 'next/server';
import { getExperience, getSteps, getScenes } from '@/lib/firestore';
import { adminSaveInteraction as saveInteraction } from '@/lib/firebase-admin';

// ─── Player Connector Endpoint ────────────────────────────────────────────────
// POST /api/experiences/[id]/preview
// Body: { userMessage: string; stepIndex: number; stepId?: string; lang?: 'es' | 'en' }
//
// The product is a walkthrough — the user always advances, regardless of what
// they answer. The LLM's only job is to produce a SHORT in-character connector
// (2-8 words) between the user's reply and the next narrative beat that the
// player displays right after. No gating, no retries, no anticipation of
// downstream content.

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const { userMessage, stepIndex: rawStepIndex = 0, stepId, lang, ratingEvaluation } = body as {
            userMessage: string; stepIndex?: number; stepId?: string; lang?: 'es' | 'en'; ratingEvaluation?: boolean;
        };

        // ─── Rating evaluation mode ──────────────────────────────────────────────
        if (ratingEvaluation) {
            const experience = await getExperience(id);
            const apiKey = (experience?.llm_api_key ?? '').trim() || process.env.OPENAI_API_KEY || '';
            const isOpenAI = apiKey.startsWith('sk-');

            const ratingPrompt = [
                'You are a sentiment classifier. Classify the following user feedback about an experience into exactly one of: positive, neutral, negative.',
                '',
                'Rules:',
                '- "positive" = the user enjoyed it, is grateful, enthusiastic, or satisfied',
                '- "neutral" = the user is indifferent, gives mixed feedback, or is vague',
                '- "negative" = the user is unhappy, disappointed, or critical',
                '- Respond with ONLY one word: positive, neutral, or negative',
            ].join('\n');

            const result = await callLLM(apiKey, isOpenAI, ratingPrompt, userMessage);
            const word = result.text.trim().toLowerCase();
            const rating = word.includes('positive') ? 'positive' : word.includes('negative') ? 'negative' : 'neutral';

            saveInteraction({
                session_id: `rating-${id}`,
                experience_id: id,
                user_message: userMessage,
                system_response: rating,
                tokens_consumed: result.tokens,
                estimated_cost: result.cost,
            });

            return NextResponse.json({ rating });
        }

        // ─── Connector mode (single LLM call, always advance) ────────────────────
        const [experience, rawSteps, scenes] = await Promise.all([getExperience(id), getSteps(id), getScenes(id)]);

        if (!experience) return NextResponse.json({ error: 'Experiencia no encontrada' }, { status: 404 });
        if (!rawSteps.length) return NextResponse.json({ error: 'La experiencia no tiene pasos' }, { status: 400 });

        // ─── Sort steps by scene order, then step order within scene ──────────────
        const sceneOrder: Record<string, number> = {};
        scenes.forEach(s => { sceneOrder[s.id] = s.order; });
        const steps = [...rawSteps].sort((a, b) => {
            const scA = sceneOrder[a.scene_id ?? ''] ?? 999;
            const scB = sceneOrder[b.scene_id ?? ''] ?? 999;
            if (scA !== scB) return scA - scB;
            return (a.order ?? 0) - (b.order ?? 0);
        });

        // ─── Find the current step by ID (reliable) or fallback to index ──────────
        let currentStep = stepId ? steps.find(s => s.id === stepId) : undefined;
        let stepIndex = currentStep ? steps.indexOf(currentStep) : rawStepIndex;

        if (!currentStep) {
            stepIndex = rawStepIndex;
            while (stepIndex < steps.length && !(steps[stepIndex]?.requires_response ?? true)) {
                stepIndex++;
            }
            currentStep = steps[stepIndex];
        }
        if (!currentStep) {
            // All remaining steps are narrative — experience is effectively complete
            return NextResponse.json({ evaluation: 'correct', nextStepIndex: steps.length, completed: true, response: '¡Llegaste al final de la experiencia!' });
        }

        // ─── Detect LLM provider from key prefix ──────────────────────────────────
        const expKey = (experience.llm_api_key ?? '').trim();
        const apiKey = expKey || process.env.OPENAI_API_KEY || '';
        if (!apiKey) console.warn('[preview] No API key available (experience nor env)');
        const isOpenAI = apiKey.startsWith('sk-');
        const sessionId = `preview-${id}`;

        // ─── Language-aware narrator + step prompt fields ─────────────────────────
        const narratorPersonality = lang === 'en' && (experience as any).narrator_personality_en
            ? (experience as any).narrator_personality_en
            : experience.narrator_personality;
        const stepMessage = lang === 'en' && (currentStep as any).message_to_send_en
            ? (currentStep as any).message_to_send_en
            : currentStep.message_to_send;
        const langInstruction = lang === 'en'
            ? 'Respond in English.'
            : 'Hablá en español, con el tono y vocabulario de tu personalidad.';

        const nextIndex = stepIndex + 1;
        const isLast = nextIndex >= steps.length;

        // ─── Build the connector prompt ───────────────────────────────────────────
        const task = isLast
            ? 'El jugador acaba de cerrar la última interacción de la experiencia. Despedite en personaje en máximo 2 oraciones. NO agregues datos, fechas ni historia nueva — solo cerrá con tu voz.'
            : 'Generá un conector MUY corto en personaje, entre 2 y 8 palabras, una sola oración breve. Tu respuesta es un puente verbal entre lo que el jugador dijo y el próximo mensaje que el sistema mostrará INMEDIATAMENTE después. Nada más.';

        const systemPrompt = `
${narratorPersonality}

---

CONTEXTO (invisible para el jugador):
- Le acabás de preguntar: "${stepMessage}"
- El jugador respondió. El sistema YA decidió avanzar al siguiente paso. No estás evaluando, no estás corrigiendo, no estás guiando. Solo enlazás.

REGLAS ABSOLUTAS (estas mandan sobre cualquier instinto del personaje):
- ${langInstruction}
- Tu respuesta debe tener entre 2 y 8 palabras. UNA sola oración breve. Nunca más.
- PROHIBIDO hacerle una pregunta al jugador. Ya respondió. El producto avanza.
- PROHIBIDO pedirle que vuelva, repita, reformule, aclare o piense de nuevo. El sistema avanza igual.
- PROHIBIDO agregar información, datos, fechas, historia, contexto del lugar o cualquier dato narrativo. El próximo mensaje del sistema ya trae eso.
- PROHIBIDO anticipar, resumir, parafrasear ni presentar el paso siguiente.

ESTILO:
- Variá la elección — no repitas siempre la misma muletilla. El narrador suena natural cuando alterna.
- Banco de referencia (no son los únicos válidos — usalos como guía de estilo, longitud y registro; mezclá, adaptá al personaje):
  · Afirmativos: "Exacto.", "Ahí está.", "Eso mismo.", "Bien visto.", "Sabía que lo notarías.", "Justo eso.", "Tal cual.", "Lo viste."
  · Neutros / continuación: "Mhm.", "Anotado.", "Sigamos.", "Bueno.", "Bien.", "Avancemos.", "Vamos."
  · Si la respuesta es off-topic: tirá uno neutro de continuación, sin regañar.

TAREA: ${task}
`.trim();

        const result = await callLLM(apiKey, isOpenAI, systemPrompt, userMessage);
        saveInteraction({
            session_id: sessionId,
            experience_id: id,
            user_message: userMessage,
            system_response: result.text,
            tokens_consumed: result.tokens,
            estimated_cost: result.cost,
        });

        return NextResponse.json({
            evaluation: 'correct',
            nextStepIndex: nextIndex,
            response: result.text,
            completed: isLast,
        });

    } catch (err: any) {
        console.error('[preview]', err);
        return NextResponse.json({ error: err.message ?? 'Error en preview' }, { status: 500 });
    }
}

// ─── LLM Response type ────────────────────────────────────────────────────────
interface LLMResult { text: string; tokens: number; cost: number; }

// ─── LLM Router ───────────────────────────────────────────────────────────────
async function callLLM(apiKey: string, isOpenAI: boolean, systemPrompt: string, userMessage: string): Promise<LLMResult> {
    if (!apiKey) {
        return { text: `[Sin API key configurada] El sistema evaluaría: "${userMessage.slice(0, 60)}"`, tokens: 0, cost: 0 };
    }
    return isOpenAI
        ? callOpenAI(apiKey, systemPrompt, userMessage)
        : callGemini(apiKey, systemPrompt, userMessage);
}

// ─── Gemini Call ──────────────────────────────────────────────────────────────
// Pricing: gemini-2.0-flash — Input $0.10/1M tokens, Output $0.40/1M tokens
async function callGemini(apiKey: string, systemPrompt: string, userMessage: string): Promise<LLMResult> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const body = {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        generationConfig: { temperature: 0.75, maxOutputTokens: 350 },
    };

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini API ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '(sin respuesta del LLM)';
    const inputTokens: number = data.usageMetadata?.promptTokenCount ?? 0;
    const outputTokens: number = data.usageMetadata?.candidatesTokenCount ?? 0;
    const tokens = inputTokens + outputTokens;
    const cost = (inputTokens * 0.10 + outputTokens * 0.40) / 1_000_000;

    return { text, tokens, cost };
}

// ─── OpenAI Call ──────────────────────────────────────────────────────────────
// Pricing: gpt-4o-mini — Input $0.15/1M tokens, Output $0.60/1M tokens
async function callOpenAI(apiKey: string, systemPrompt: string, userMessage: string): Promise<LLMResult> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage },
            ],
            temperature: 0.75,
            max_tokens: 350,
        }),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`OpenAI API ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content ?? '(sin respuesta del LLM)';
    const inputTokens: number = data.usage?.prompt_tokens ?? 0;
    const outputTokens: number = data.usage?.completion_tokens ?? 0;
    const tokens = inputTokens + outputTokens;
    const cost = (inputTokens * 0.15 + outputTokens * 0.60) / 1_000_000;

    return { text, tokens, cost };
}
