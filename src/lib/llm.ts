// ─── Shared LLM utility ──────────────────────────────────────────────────────
// Reusable across preview evaluation and AI story generation.

export interface LLMResult {
    text: string;
    tokens: number;
    cost: number;
}

// ─── LLM Router ──────────────────────────────────────────────────────────────

export async function callLLM(
    apiKey: string,
    systemPrompt: string,
    userMessage: string,
    options?: { temperature?: number; maxTokens?: number; jsonMode?: boolean }
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
    options?: { temperature?: number; maxTokens?: number; jsonMode?: boolean }
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

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
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

// ─── Gemini Call ─────────────────────────────────────────────────────────────
// Pricing: gemini-2.0-flash — Input $0.10/1M tokens, Output $0.40/1M tokens

async function callGemini(
    apiKey: string,
    systemPrompt: string,
    userMessage: string,
    options?: { temperature?: number; maxTokens?: number; jsonMode?: boolean }
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
