import { NextRequest, NextResponse } from 'next/server';
import { getExperience, getSteps, getScenes, saveInteraction } from '@/lib/firestore';

// ─── Preview Evaluation Endpoint ──────────────────────────────────────────────
// POST /api/experiences/[id]/preview
// Body: { userMessage: string; stepIndex: number }

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { userMessage, stepIndex: rawStepIndex, stepId, lang } = await req.json() as { userMessage: string; stepIndex: number; stepId?: string; lang?: 'es' | 'en' };
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

        // Fallback: if no stepId or not found, use index with narrative skip
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

        const totalSteps = steps.length;
        const stepNumber = stepIndex + 1;

        // ─── Detect LLM provider from key prefix ──────────────────────────────────
        const expKey = (experience.llm_api_key ?? '').trim();
        const apiKey = expKey || process.env.OPENAI_API_KEY || '';
        // Key source logged without exposing prefix
        if (!apiKey) console.warn('[preview] No API key available (experience nor env)');
        const isOpenAI = apiKey.startsWith('sk-');
        const sessionId = `preview-${id}`;

        // ─── Compute effective context: use own context, fallback to most recent non-empty ──
        let effectiveContext = '';
        for (let i = 0; i <= stepIndex; i++) {
            const c = steps[i]?.context?.trim();
            if (c) effectiveContext = c;  // last non-empty wins
        }

        // ─── Build a context-aware system prompt ───────────────────────────────────
        const narratorPersonality = lang === 'en' && (experience as any).narrator_personality_en
            ? (experience as any).narrator_personality_en
            : experience.narrator_personality;
        const stepMessage = lang === 'en' && (currentStep as any).message_to_send_en
            ? (currentStep as any).message_to_send_en
            : currentStep.message_to_send;
        const stepExpectedAnswer = lang === 'en' && (currentStep as any).expected_answer_en
            ? (currentStep as any).expected_answer_en
            : currentStep.expected_answer;
        const langInstruction = lang === 'en' ? '- IMPORTANT: Respond in English.' : '- Hablá en español, con el tono y vocabulario de tu personalidad.';

        const buildSystemPrompt = (task: string) => `
${narratorPersonality}

---

CONTEXTO DEL JUEGO (invisible para el jugador):
- El jugador está en el PASO ${stepNumber} de ${totalSteps}.
- Mensaje que le enviaste al jugador en este paso: "${stepMessage}"
${currentStep.requires_response
                ? `- La respuesta esperada es (semánticamente): "${stepExpectedAnswer}"
- Pistas disponibles si el jugador está trabado: ${currentStep.hints.length ? currentStep.hints.join(' | ') : '(sin pistas)'}
- Mensaje de reintento configurado: "${currentStep.wrong_answer_message || '(no configurado, inventá uno en personaje)'}"
${effectiveContext ? `- Contexto adicional del creador de la experiencia: "${effectiveContext}"` : ''}`
                : '- Este es un paso narrativo, el jugador NO necesita responder nada.'}

REGLAS:
- Nunca salgas del personaje.
- Nunca des la respuesta correcta directamente.
- Podés parafrasear el mensaje del paso sin repetirlo textualmente.
${langInstruction}
- Respuestas cortas: 1-3 oraciones máximo.
${effectiveContext ? `- Usá el contexto adicional para guiar al jugador si está trabado, sin saltearse los pasos definidos.` : ''}

TAREA ACTUAL: ${task}
`.trim();

        // Helper: call LLM + save interaction cost to Firestore
        const llmAndSave = async (systemPrompt: string, userMsg: string) => {
            const result = await callLLM(apiKey, isOpenAI, systemPrompt, userMsg);
            saveInteraction({
                session_id: sessionId,
                experience_id: id,
                user_message: userMsg,
                system_response: result.text,
                tokens_consumed: result.tokens,
                estimated_cost: result.cost,
            });
            return result.text;
        };

        // ─── Choice step: evaluate which option the player chose ─────────────────
        if (currentStep.step_type === 'choice' && currentStep.choices?.length) {
            const choicesList = currentStep.choices.map((ch, i) => `${i + 1}. "${ch.label}" (condición: ${ch.condition})`).join('\n');
            const choiceEvalSystem = [
                'Sos un evaluador para un juego interactivo.',
                'El jugador recibió una pregunta con múltiples opciones.',
                'Tu tarea: determinar cuál opción eligió el jugador basándote en su respuesta.',
                'Respondé ÚNICAMENTE con el número de la opción (1, 2, 3, etc).',
                'Si la respuesta no coincide con ninguna opción, respondé NINGUNA.',
            ].join('\n');
            const choiceEvalUser = [
                `Pregunta que recibió el jugador: "${currentStep.message_to_send}"`,
                `Opciones:\n${choicesList}`,
                `Respuesta del jugador: "${userMessage}"`,
                '¿Cuál opción eligió?',
            ].join('\n');

            const choiceResult = await callLLM(apiKey, isOpenAI, choiceEvalSystem, choiceEvalUser);
            saveInteraction({ session_id: sessionId, experience_id: id, user_message: choiceEvalUser, system_response: choiceResult.text, tokens_consumed: choiceResult.tokens, estimated_cost: choiceResult.cost });

            const choiceNum = parseInt(choiceResult.text.trim(), 10);
            const chosenOption = (choiceNum >= 1 && choiceNum <= currentStep.choices.length) ? currentStep.choices[choiceNum - 1] : null;

            if (chosenOption) {
                // Found a matching choice — generate in-character acknowledgment
                const ackTask = `El jugador eligió: "${chosenOption.label}". Respondé brevemente en personaje (1-2 oraciones) reconociendo su elección y generando anticipación para lo que viene.`;
                const response = await llmAndSave(buildSystemPrompt(ackTask), userMessage);
                return NextResponse.json({
                    evaluation: 'choice',
                    chosenIndex: choiceNum - 1,
                    target_scene_id: chosenOption.target_scene_id,
                    target_step_id: chosenOption.target_step_id,
                    nextStepIndex: stepIndex + 1,
                    response,
                });
            } else {
                // Ambiguous — ask player to clarify
                const clarifyTask = `El jugador respondió algo ambiguo: "${userMessage}". Las opciones son: ${currentStep.choices.map(c => c.label).join(', ')}. Pedile amablemente que aclare qué quiere hacer, en personaje.`;
                const response = await llmAndSave(buildSystemPrompt(clarifyTask), userMessage);
                return NextResponse.json({ evaluation: 'incorrect', nextStepIndex: stepIndex, response });
            }
        }

        // ─── Evaluate if the answer satisfies the expected intent ──────────────────
        const evalSystemPrompt = [
            'Sos un evaluador de respuestas para un juego interactivo.',
            'Tu tarea: decidir si la respuesta del jugador satisface el criterio de evaluación.',
            '',
            'IMPORTANTE: El criterio de evaluación puede ser:',
            '  a) Una respuesta literal (ej: "Grand Central Terminal") — el jugador debe decir algo equivalente.',
            '  b) Una DESCRIPCIÓN de qué tipo de respuesta es válida (ej: "que el usuario confirme", "que diga un lugar de NYC").',
            '     En este caso, evaluá si la respuesta del jugador CUMPLE con lo descrito, no la compares literalmente con el texto del criterio.',
            '',
            'Criterios de CORRECTO:',
            '  - Expresa la misma intención o idea central que el criterio.',
            '  - Una respuesta más corta o informal que capture la esencia es válida (ej: "sí" ≈ "sí, claro").',
            '  - Sinónimos, variantes ortográficas y equivalentes semánticos cuentan.',
            '  - Una respuesta afirmativa simple ("sí", "si", "yes", "claro", "dale", "ok") equivale a una confirmación.',
            'Criterios de INCORRECTO:',
            '  - La respuesta es claramente equivocada, contradictoria o completamente fuera de tema.',
            '  - El jugador no respondió la pregunta en absoluto.',
            'Respondé ÚNICAMENTE con la palabra SÍ o NO, sin ningún otro texto.',
        ].join('\n');

        const evalUserPrompt = [
            `Pregunta/instrucción que recibió el jugador: "${currentStep.message_to_send}"`,
            `Criterio de evaluación: "${currentStep.expected_answer}"`,
            `Respuesta real del jugador: "${userMessage}"`,
            '¿La respuesta del jugador es correcta según el criterio?',
        ].join('\n');

        const evalResult = await callLLM(apiKey, isOpenAI, evalSystemPrompt, evalUserPrompt);
        saveInteraction({
            session_id: sessionId,
            experience_id: id,
            user_message: evalUserPrompt,
            system_response: evalResult.text,
            tokens_consumed: evalResult.tokens,
            estimated_cost: evalResult.cost,
        });

        const upper = evalResult.text.trim().toUpperCase();
        const isCorrect = upper.startsWith('SÍ') || upper.startsWith('SI') || upper.startsWith('YES');

        // ─── Correct answer ───────────────────────────────────────────────────────
        if (isCorrect) {
            const nextIndex = stepIndex + 1;
            const isLast = nextIndex >= steps.length;

            if (isLast) {
                const response = await llmAndSave(
                    buildSystemPrompt('¡El jugador completó TODA la experiencia! Enviá un mensaje de cierre épico y felicitación en personaje.'),
                    '¡Lo logré!',
                );
                return NextResponse.json({ evaluation: 'correct', nextStepIndex: nextIndex, response, completed: true });
            }

            const nextStep = steps[nextIndex];
            const confirmTask = nextStep.requires_response
                ? `El jugador respondió correctamente. Celebrá brevemente en personaje (1 oración) y luego presentá el siguiente mensaje al jugador: "${nextStep.message_to_send}". Podés adaptarlo a tu tono sin cambiar el contenido esencial.`
                : `El jugador respondió correctamente. Confirmá brevemente en personaje con una sola oración de celebración. NO añadas más información ni anticipes el siguiente paso; el sistema lo hará automáticamente.`;

            const response = await llmAndSave(buildSystemPrompt(confirmTask), userMessage);
            return NextResponse.json({ evaluation: 'correct', nextStepIndex: nextIndex, response });
        }

        // ─── Incorrect answer ─────────────────────────────────────────────────────
        const response = await llmAndSave(
            buildSystemPrompt(`El jugador respondió incorrectamente con: "${userMessage}". Usá el mensaje de reintento y las pistas disponibles para guiarlo sin revelar la respuesta. Si hay contexto adicional, usalo para orientarlo mejor sin saltearse pasos.`),
            userMessage,
        );
        return NextResponse.json({ evaluation: 'incorrect', nextStepIndex: stepIndex, response });

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
