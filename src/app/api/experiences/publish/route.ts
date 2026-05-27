import { NextRequest, NextResponse } from 'next/server';
import { callLLM, type LLMOptions } from '@/lib/llm';
import { getExperience, getSteps } from '@/lib/firestore';
import { verifyAuth, adminUpdateExperience, adminUpdateStep, adminSaveInteraction as saveInteraction } from '@/lib/firebase-admin';

// ─── POST /api/experiences/publish ───────────────────────────────────────────
// CHUNKED pipeline: normalize Spanish → translate to English → save _en fields.
// The full work (2 LLM calls per text × ~100+ steps) cannot finish inside one
// serverless request, so the client drives it in slices: it POSTs {offset,limit}
// repeatedly until {done:true}. Status flips to published only on the final slice.

export const maxDuration = 60; // each slice is sized to finish well under this

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

// Per-call guards: abort a stalled attempt at 20s and retry (intermittent
// gpt-4o-mini stalls of 50-65s would otherwise blow the 60s function budget).
const LLM_OPTS: LLMOptions = { temperature: 0.3, maxTokens: 2000, timeoutMs: 20000, retries: 2 };
const CHUNK_DEFAULT = 6; // texts per request, processed concurrently

type WorkItem =
    | { kind: 'exp'; field: 'narrator_personality'; text: string; writeNormalized: true }
    | { kind: 'exp'; field: 'web_tagline' | 'web_description'; text: string; writeNormalized: false }
    | { kind: 'step'; stepId: string; text: string };

export async function POST(req: NextRequest) {
    const user = await verifyAuth(req);
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    try {
        const { experience_id, offset = 0, limit = CHUNK_DEFAULT } = await req.json() as {
            experience_id: string; offset?: number; limit?: number;
        };
        if (!experience_id) return NextResponse.json({ error: 'experience_id requerido' }, { status: 400 });

        const apiKey = process.env.OPENAI_API_KEY || '';
        if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY no configurada' }, { status: 500 });

        const experience = await getExperience(experience_id);
        if (!experience) return NextResponse.json({ error: 'Experiencia no encontrada' }, { status: 404 });

        const exp = experience as unknown as Record<string, unknown>;

        // Steps in a fully deterministic order (order, then id) so the offset/limit
        // slice is identical on every request even when `order` values collide.
        const steps = (await getSteps(experience_id))
            .slice()
            .sort((a, b) => ((a.order || 0) - (b.order || 0)) || a.id.localeCompare(b.id));

        // Build the stable work list of non-empty texts to translate.
        const workList: WorkItem[] = [];
        const narr = typeof exp.narrator_personality === 'string' ? exp.narrator_personality : '';
        const tagline = typeof exp.web_tagline === 'string' ? exp.web_tagline : '';
        const desc = typeof exp.web_description === 'string' ? exp.web_description : '';
        if (narr.trim()) workList.push({ kind: 'exp', field: 'narrator_personality', text: narr, writeNormalized: true });
        if (tagline.trim()) workList.push({ kind: 'exp', field: 'web_tagline', text: tagline, writeNormalized: false });
        if (desc.trim()) workList.push({ kind: 'exp', field: 'web_description', text: desc, writeNormalized: false });
        for (const s of steps) {
            if (typeof s.message_to_send === 'string' && s.message_to_send.trim()) {
                workList.push({ kind: 'step', stepId: s.id, text: s.message_to_send });
            }
        }

        const total = workList.length;
        const slice = workList.slice(offset, offset + limit);

        let tokens = 0;
        let cost = 0;
        const processText = async (text: string): Promise<{ normalized: string; english: string }> => {
            const norm = await callLLM(apiKey, NORMALIZE_PROMPT, text, LLM_OPTS);
            tokens += norm.tokens; cost += norm.cost;
            const trans = await callLLM(apiKey, TRANSLATE_PROMPT, norm.text, LLM_OPTS);
            tokens += trans.tokens; cost += trans.cost;
            return { normalized: norm.text, english: trans.text };
        };

        // Process this slice concurrently (each item = 2 sequential calls).
        const expUpdate: Record<string, string> = {};
        await Promise.all(slice.map(async (item) => {
            const { normalized, english } = await processText(item.text);
            if (item.kind === 'step') {
                await adminUpdateStep(experience_id, item.stepId, {
                    message_to_send: normalized,
                    message_to_send_en: english,
                });
            } else if (item.writeNormalized) {
                expUpdate[item.field] = normalized;
                expUpdate[`${item.field}_en`] = english;
            } else {
                expUpdate[`${item.field}_en`] = english;
            }
        }));
        if (Object.keys(expUpdate).length > 0) {
            await adminUpdateExperience(experience_id, expUpdate);
        }

        const nextOffset = offset + slice.length;
        const done = nextOffset >= total;

        // Flip to published only once everything is translated.
        if (done) {
            await adminUpdateExperience(experience_id, {
                status: 'published',
                mode: 'production',
                published_at: new Date().toISOString(),
            });
        }

        saveInteraction({
            session_id: 'publish-pipeline',
            experience_id,
            user_message: `Publish ${nextOffset}/${total}: ${experience.name}`,
            system_response: done ? 'published' : 'chunk processed',
            tokens_consumed: tokens,
            estimated_cost: cost,
        });

        return NextResponse.json({
            success: true,
            done,
            offset: nextOffset,
            total,
            processed: slice.length,
            tokens,
            cost,
        });

    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error en publicación';
        console.error('[publish]', err);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
