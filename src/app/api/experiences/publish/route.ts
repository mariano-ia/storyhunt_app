import { NextRequest, NextResponse } from 'next/server';
import { callLLM } from '@/lib/llm';
import { getExperience, getSteps, getScenes } from '@/lib/firestore';
import { verifyAuth, adminUpdateExperience, adminUpdateStep, adminSaveInteraction as saveInteraction } from '@/lib/firebase-admin';

// ─── POST /api/experiences/publish ───────────────────────────────────────────
// Pipeline: normalize Spanish → translate to English → save _en fields → mark published

const NORMALIZE_PROMPT = `Sos un editor de texto profesional. Tu tarea es normalizar texto en español argentino a español neutro internacional.

Reglas:
- Reemplazá voseo por tuteo: "vos tenés" → "tú tienes", "mirá" → "mira", "andá" → "ve"
- Reemplazá modismos argentinos por equivalentes neutros: "re copado" → "muy bueno", "posta" → "de verdad", "boludo" → eliminar o reemplazar
- Mantené el tono y la personalidad del texto original
- No cambies nombres propios, lugares, ni datos factuales
- Si el texto ya está en español neutro, devolvelo sin cambios
- Respondé ÚNICAMENTE con el texto normalizado, sin explicaciones`;

const TRANSLATE_PROMPT = `You are a professional translator. Translate the following text from Spanish to English.

Rules:
- Maintain the tone, personality, and style of the original
- Keep proper nouns, place names, and factual data unchanged
- For narrative/storytelling text, keep it engaging and natural in English
- For short labels or conditions, keep them concise
- Respond ONLY with the translated text, no explanations`;

export async function POST(req: NextRequest) {
    const user = await verifyAuth(req);
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    try {
        const { experience_id } = await req.json() as { experience_id: string };
        if (!experience_id) return NextResponse.json({ error: 'experience_id requerido' }, { status: 400 });

        const apiKey = process.env.OPENAI_API_KEY || '';
        if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY no configurada' }, { status: 500 });

        const experience = await getExperience(experience_id);
        if (!experience) return NextResponse.json({ error: 'Experiencia no encontrada' }, { status: 404 });

        const steps = await getSteps(experience_id);
        const scenes = await getScenes(experience_id);

        let totalTokens = 0;
        let totalCost = 0;

        // Helper: normalize + translate a text
        const processText = async (text: string): Promise<{ normalized: string; english: string }> => {
            if (!text?.trim()) return { normalized: '', english: '' };

            // Step 1: Normalize to neutral Spanish
            const normResult = await callLLM(apiKey, NORMALIZE_PROMPT, text, { temperature: 0.3, maxTokens: 2000 });
            totalTokens += normResult.tokens;
            totalCost += normResult.cost;

            // Step 2: Translate to English
            const transResult = await callLLM(apiKey, TRANSLATE_PROMPT, normResult.text, { temperature: 0.3, maxTokens: 2000 });
            totalTokens += transResult.tokens;
            totalCost += transResult.cost;

            return { normalized: normResult.text, english: transResult.text };
        };

        // ─── Process experience-level fields ──────────────────────────────────────
        const narratorResult = await processText(experience.narrator_personality);
        const taglineResult = await processText((experience as any).web_tagline || '');
        const descResult = await processText((experience as any).web_description || '');

        await adminUpdateExperience(experience_id, {
            narrator_personality: narratorResult.normalized,
            narrator_personality_en: narratorResult.english,
            web_tagline_en: taglineResult.english,
            web_description_en: descResult.english,
        });

        // ─── Process steps ────────────────────────────────────────────────────────
        let processedSteps = 0;
        for (const step of steps) {
            const msgResult = await processText(step.message_to_send);
            const answerResult = step.expected_answer ? await processText(step.expected_answer) : { normalized: '', english: '' };

            const updates: Record<string, any> = {
                message_to_send: msgResult.normalized,
                message_to_send_en: msgResult.english,
            };

            if (step.expected_answer) {
                updates.expected_answer = answerResult.normalized;
                updates.expected_answer_en = answerResult.english;
            }

            await adminUpdateStep(experience_id, step.id, updates);
            processedSteps++;
        }

        // ─── Expected-answer quality check ───────────────────────────────────────
        interface AnswerWarning {
            index: number;
            rating: string;
            reason: string;
            message_preview: string;
            expected_answer_preview: string;
        }
        let expected_answer_warnings: AnswerWarning[] = [];

        const interactiveSteps = steps
            .map((s, i) => ({ index: i, step: s }))
            .filter(({ step }) => step.step_type === 'interactive' || step.requires_response);

        if (interactiveSteps.length > 0) {
            const qaPayload = interactiveSteps.map(({ index, step }) => ({
                index,
                message: step.message_to_send,
                expected_answer: step.expected_answer,
            }));

            const QA_SYSTEM_PROMPT = `You are a QA reviewer for interactive narrative experiences. Analyze each step's expected_answer and rate how likely it is to block a user unfairly.

For each step, rate:
- GREEN: answer is flexible, accepts approximations, or any response is valid
- YELLOW: answer requires specific knowledge but has some flexibility
- RED: answer requires an exact word, specific number, or precise vocabulary that could frustrate users

Respond as JSON array: [{"index": 0, "rating": "green|yellow|red", "reason": "brief explanation"}]
Only include YELLOW and RED items. If all are GREEN, return [].`;

            try {
                const qaResult = await callLLM(apiKey, QA_SYSTEM_PROMPT, JSON.stringify(qaPayload), {
                    temperature: 0.2,
                    maxTokens: 2000,
                    jsonMode: true,
                });
                totalTokens += qaResult.tokens;
                totalCost += qaResult.cost;

                const parsed = JSON.parse(qaResult.text);
                const items: { index: number; rating: string; reason: string }[] = Array.isArray(parsed) ? parsed : parsed.items ?? parsed.warnings ?? [];

                expected_answer_warnings = items
                    .filter((w) => w.rating === 'yellow' || w.rating === 'red')
                    .map((w) => {
                        const orig = interactiveSteps.find((s) => s.index === w.index);
                        return {
                            index: w.index,
                            rating: w.rating,
                            reason: w.reason,
                            message_preview: (orig?.step.message_to_send ?? '').slice(0, 80),
                            expected_answer_preview: (orig?.step.expected_answer ?? '').slice(0, 80),
                        };
                    });
            } catch (qaErr) {
                console.warn('[publish] QA check failed (non-blocking):', qaErr);
            }
        }

        // ─── Set published status ────────────────────────────────────────────────
        await adminUpdateExperience(experience_id, {
            status: 'published',
            mode: 'production',
            published_at: new Date().toISOString(),
        });

        // Track cost
        saveInteraction({
            session_id: 'publish-pipeline',
            experience_id,
            user_message: `Publish: ${experience.name}`,
            system_response: `Processed ${processedSteps} steps, ${scenes.length} scenes`,
            tokens_consumed: totalTokens,
            estimated_cost: totalCost,
        });

        return NextResponse.json({
            success: true,
            steps_processed: processedSteps,
            tokens: totalTokens,
            cost: totalCost,
            ...(expected_answer_warnings.length > 0 ? { expected_answer_warnings } : {}),
        });

    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error en publicación';
        console.error('[publish]', err);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
