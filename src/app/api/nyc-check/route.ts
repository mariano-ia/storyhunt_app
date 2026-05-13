import { NextRequest, NextResponse } from 'next/server';
import { callLLM } from '@/lib/llm';

// ─── POST /api/nyc-check ─────────────────────────────────────────────────────
// Classifies a user's free-text reply to "Are you in NYC right now?" into
// one of: 'yes' | 'no' | 'unclear'. Used by the synthetic Step 0 of the player
// to decide whether to start the walk or save for later.
//
// Uses the global OPENAI_API_KEY (env) — this is a product-level check, not a
// narrative evaluation, so it doesn't use the experience's own API key.

const SYSTEM_PROMPT = `You classify whether a user is physically in New York City RIGHT NOW based on their short reply to the question "Are you in NYC right now?".

Output strict JSON: {"in_nyc": "yes" | "no" | "unclear", "narrator_reply": string}

Classification rules:
- "yes": user clearly states they are currently in NYC (Manhattan, Brooklyn, Queens, Bronx, Staten Island) or a clear synonym ("I'm here", "just landed at JFK", "estoy en manhattan", "sí", "yes", "in the city now", "ya llegué").
- "no": user clearly states they are NOT in NYC right now ("I'm in Buenos Aires", "next month", "still at home", "no todavía", "estoy en Madrid", "planning my trip", "just checking it out from home").
- "unclear": ambiguous, off-topic, OR confused-about-the-question. Treat the following as "unclear" even if the reply contains the word "no" — they are NOT negative answers about location:
  • Confusion about the question itself ("no entiendo qué tengo que responder", "what do you mean?", "I don't get it", "what should I say?", "como???", "?")
  • Hedged location ("I live in NY but I'm away", "I'm in NJ", "kind of", "soon", "in a bit")
  • Random text, emojis only, gibberish

The narrator_reply field MUST be in the user's language ("es" or "en", inferred from their message — default "en" if unclear). Style: short (1-2 sentences), warm, conversational, in-character as a mysterious NYC guide.
- If "yes": confirm and prepare them to start. Example EN: "Good. Then we begin." / ES: "Perfecto. Empezamos."
- If "no": tell them you'll wait, mention you'll save the link, and that the 30-day clock only starts when they tap Start in NYC. Example EN: "I'll wait. Your link is saved — the 30-day clock only starts when you tap Start here in the city." / ES: "Te espero. Te guardo el link — el reloj de 30 días arranca cuando toques Empezar acá en la ciudad."
- If "unclear": ask once more with more context, hinting at the physical reality of the walk. Example EN: "I mean physically — are you in New York right now, or somewhere else?" / ES: "Físicamente, digo — ¿estás en Nueva York ahora, o en otro lado?"

Return ONLY the JSON object. No prose, no markdown.`;

export async function POST(req: NextRequest) {
    try {
        const { userMessage, lang } = await req.json() as {
            userMessage?: string;
            lang?: 'es' | 'en';
        };
        if (!userMessage || typeof userMessage !== 'string') {
            return NextResponse.json({ error: 'userMessage required' }, { status: 400 });
        }

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            console.error('[nyc-check] OPENAI_API_KEY not configured');
            // Fail-open as 'unclear' so the player can re-ask or fallback gracefully
            return NextResponse.json({
                in_nyc: 'unclear',
                narrator_reply: lang === 'es'
                    ? '¿Estás en Nueva York ahora, o no?'
                    : 'Are you in New York right now, or not?',
            });
        }

        const userPrompt = `User message: ${JSON.stringify(userMessage)}\nUser language hint (may be wrong): ${lang || 'unknown'}`;
        const result = await callLLM(apiKey, SYSTEM_PROMPT, userPrompt, {
            temperature: 0.2,
            maxTokens: 200,
            jsonMode: true,
        });

        let parsed: { in_nyc?: string; narrator_reply?: string } = {};
        try {
            parsed = JSON.parse(result.text);
        } catch {
            console.warn('[nyc-check] LLM returned non-JSON:', result.text.slice(0, 200));
        }

        const validClasses = new Set(['yes', 'no', 'unclear']);
        const classification = validClasses.has(parsed.in_nyc || '') ? parsed.in_nyc! : 'unclear';
        const reply = parsed.narrator_reply?.trim() || (lang === 'es'
            ? '¿Estás en Nueva York ahora, o no?'
            : 'Are you in New York right now, or not?');

        return NextResponse.json({
            in_nyc: classification,
            narrator_reply: reply,
            cost: result.cost,
            tokens: result.tokens,
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error in nyc-check';
        console.error('[nyc-check]', err);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
