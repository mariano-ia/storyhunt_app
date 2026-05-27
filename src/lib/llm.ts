// ─── Shared LLM utility ──────────────────────────────────────────────────────
// Reusable across preview evaluation and AI story generation.

export interface LLMResult {
    text: string;
    tokens: number;
    cost: number;
}

export interface LLMOptions {
    temperature?: number;
    maxTokens?: number;
    jsonMode?: boolean;
    timeoutMs?: number; // abort a single attempt that stalls past this (then retry)
    retries?: number;   // max retries on transient failure / stall
}

// ─── Retry wrapper ─────────────────────────────────────────────────────────
// OpenAI/Gemini occasionally return transient 429 (rate limit) or 5xx (server)
// errors, OR a single call stalls for tens of seconds while eventually returning
// 200 (observed: occasional 50-65s hangs on gpt-4o-mini). A single transient
// failure/stall should NOT abort a multi-call pipeline (e.g. publish). We abort
// any attempt that exceeds timeoutMs and retry with exponential backoff — a
// retry almost always returns fast, so an intermittent stall costs ~timeoutMs
// instead of >60s.

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

async function fetchWithRetry(
    url: string,
    init: RequestInit,
    retries = 4,
    timeoutMs = 30000
): Promise<Response> {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), timeoutMs);
        try {
            const res = await fetch(url, { ...init, signal: ctrl.signal });
            clearTimeout(timer);
            if (res.ok || !RETRYABLE_STATUS.has(res.status) || attempt === retries) {
                return res;
            }
        } catch (err) {
            // Network failure, or our own AbortController firing on a stall — retry
            clearTimeout(timer);
            lastErr = err;
            if (attempt === retries) throw err;
        }
        // Exponential backoff with jitter: ~0.5s, 1s, 2s, 4s
        const delay = 500 * 2 ** attempt + Math.random() * 250;
        await new Promise((r) => setTimeout(r, delay));
    }
    // Unreachable in practice, but satisfies the type checker
    throw lastErr ?? new Error('fetchWithRetry exhausted retries');
}

// ─── LLM Router ──────────────────────────────────────────────────────────────

export async function callLLM(
    apiKey: string,
    systemPrompt: string,
    userMessage: string,
    options?: LLMOptions
): Promise<LLMResult> {
    if (!apiKey) {
        return { text: '[Sin API key configurada]', tokens: 0, cost: 0 };
    }
    const isOpenAI = apiKey.startsWith('sk-');
    return isOpenAI
        ? callOpenAI(apiKey, systemPrompt, userMessage, options)
        : callGemini(apiKey, systemPrompt, userMessage, options);
}

// ─── OpenAI Call ─────────────────────────────────────────────────────────────
// Pricing: gpt-4o-mini — Input $0.15/1M tokens, Output $0.60/1M tokens

async function callOpenAI(
    apiKey: string,
    systemPrompt: string,
    userMessage: string,
    options?: LLMOptions
): Promise<LLMResult> {
    const body: Record<string, unknown> = {
        model: 'gpt-4o-mini',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
        ],
        temperature: options?.temperature ?? 0.75,
        max_tokens: options?.maxTokens ?? 350,
    };

    if (options?.jsonMode) {
        body.response_format = { type: 'json_object' };
    }

    const res = await fetchWithRetry('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
    }, options?.retries ?? 4, options?.timeoutMs ?? 30000);

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

// ─── Gemini Call ─────────────────────────────────────────────────────────────
// Pricing: gemini-2.0-flash — Input $0.10/1M tokens, Output $0.40/1M tokens

async function callGemini(
    apiKey: string,
    systemPrompt: string,
    userMessage: string,
    options?: LLMOptions
): Promise<LLMResult> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const body: Record<string, unknown> = {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        generationConfig: {
            temperature: options?.temperature ?? 0.75,
            maxOutputTokens: options?.maxTokens ?? 350,
            ...(options?.jsonMode ? { responseMimeType: 'application/json' } : {}),
        },
    };

    const res = await fetchWithRetry(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    }, options?.retries ?? 4, options?.timeoutMs ?? 30000);

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
