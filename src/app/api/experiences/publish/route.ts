import { NextRequest, NextResponse } from 'next/server';
import { callLLM } from '@/lib/llm';
import { getExperience, getSteps, getScenes, updateExperience, updateStep } from '@/lib/firestore';
import { verifyAuth } from '@/lib/firebase-admin';
import { saveInteraction } from '@/lib/firestore';

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

        await updateExperience(experience_id, {
            narrator_personality: narratorResult.normalized,
            narrator_personality_en: narratorResult.english,
            web_tagline_en: taglineResult.english,
            web_description_en: descResult.english,
            status: 'published',
            published_at: new Date().toISOString(),
        } as any);

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

            // Normalize choice labels and conditions
            if (step.choices?.length) {
                const translatedChoices = [];
                for (const ch of step.choices) {
                    const labelResult = await processText(ch.label);
                    const condResult = await processText(ch.condition);
                    translatedChoices.push({
                        ...ch,
                        label: labelResult.normalized,
                        label_en: labelResult.english,
                        condition: condResult.normalized,
                        condition_en: condResult.english,
                    });
                }
                updates.choices = translatedChoices;
            }

            await updateStep(experience_id, step.id, updates);
            processedSteps++;
        }

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
        });

    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error en publicación';
        console.error('[publish]', err);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
