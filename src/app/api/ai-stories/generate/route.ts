import { NextRequest, NextResponse } from 'next/server';
import { callLLM } from '@/lib/llm';
import { saveInteraction } from '@/lib/firestore';
import type { AIGeneratedExperience } from '@/lib/types';

// ─── POST /api/ai-stories/generate ──────────────────────────────────────────
// Receives an editorial script and returns a structured experience JSON.

const SYSTEM_PROMPT = `Sos un asistente experto en diseñar experiencias narrativas interactivas para la plataforma StoryHunt.

Tu tarea: recibir un guión editorial en texto libre y convertirlo en una estructura JSON válida para la plataforma.

## Modelo de datos de StoryHunt

Una experiencia tiene:
- name: nombre de la experiencia
- description: descripción corta para el panel admin (1-2 oraciones)
- narrator_personality: prompt de personalidad para el LLM que va a interpretar al narrador. Debe ser detallado (3-5 oraciones): quién es, cómo habla, su tono, vocabulario, actitud. Incluí instrucciones sobre cómo manejar respuestas incorrectas o fuera de tema (el narrador debe guiar al usuario sin romper personaje).
- slug: URL amigable (lowercase, solo letras, números y guiones)
- activation_keyword: palabra clave en MAYÚSCULAS para activar la experiencia (ej: "MISTERIO")
- context: contexto global de la experiencia. Información que el narrador debe tener presente SIEMPRE para guiar al usuario correctamente. Ej: "Esta experiencia es presencial en Midtown Manhattan. El usuario debe estar físicamente ahí." o "El usuario está jugando un juego de misterio ambientado en los años 20."
- scenes: array de escenas, cada una con steps

## Tipos de steps

1. **narrative**: El narrador envía un mensaje. No espera respuesta del usuario.
   - requires_response: false
   - expected_answer: "" (vacío)

2. **interactive**: El narrador envía un mensaje y ESPERA una respuesta del usuario. El sistema evaluará semánticamente si la respuesta cumple la intención esperada.
   - requires_response: true
   - expected_answer: descripción de la INTENCIÓN que debe cumplir la respuesta del usuario. No es una respuesta literal, es un criterio semántico. Ejemplos:
     - "que el usuario confirme que está en el lugar" (cualquier confirmación vale)
     - "que mencione Grand Central Terminal" (debe nombrar el lugar)
     - "que el usuario reaccione al mensaje" (cualquier respuesta vale para avanzar)
     - "que diga que quiere continuar" (confirmación de avance)
   - El narrador LLM se encargará automáticamente de guiar al usuario si la respuesta es incorrecta, usando su personalidad y el contexto. NO necesitás definir pistas ni mensajes de error.

3. **typing**: Efecto visual de "escribiendo..." sin mensaje real. Simula que el narrador está tipeando.
   - message_to_send: "" (vacío)
   - requires_response: false
   - interrupted_typing: true (siempre)
   - delay_seconds: 1-3

4. **error_screen**: Pantalla negra estilo terminal que interrumpe el chat. Muestra texto con efecto glitch verde sobre fondo negro. Se usa para momentos de quiebre dramático, errores del "sistema", interferencias o revelaciones impactantes.
   - message_to_send: el texto que se muestra en la pantalla de error (ej: "ERROR: CONEXIÓN INTERRUMPIDA", "SISTEMA COMPROMETIDO")
   - requires_response: false
   - delay_seconds: duración en segundos que se muestra la pantalla (3-6 recomendado)
   - Después de la duración, la pantalla desaparece y vuelve el chat normal.

5. **choice**: Bifurcación. El narrador presenta opciones y el usuario elige.
   - requires_response: true
   - choices: array de opciones, cada una con:
     - label: texto de la opción (ej: "Ir al muelle")
     - condition: descripción semántica para que el LLM evalúe (ej: "el usuario quiere ir al muelle")
     - target_scene_name: nombre de la escena destino (debe coincidir exactamente con el name de otra escena)
   - expected_answer: "" (vacío para choices)

## Reglas de generación

- Asigná delay_seconds proporcional al largo del mensaje: mensajes cortos (1-2 oraciones) → 1-2s, mensajes largos → 2-4s.
- Usá typing steps antes de mensajes dramáticos o para crear tensión.
- Usá glitch_effect: true solo si el guión sugiere algo sobrenatural, tecnológico o perturbador.
- Usá interrupted_typing: true (sin step_type typing) si querés simular que el narrador escribió y borró algo.
- El campo context de un step es opcional: usalo solo si ese step en particular necesita contexto adicional que el LLM no puede deducir del contexto global ni del mensaje.
- Ordená los steps dentro de cada escena empezando en order: 1.
- Ordená las escenas empezando en order: 1.
- El slug debe derivarse del nombre de la experiencia.
- La activation_keyword debe ser una sola palabra relevante en MAYÚSCULAS.
- hints: siempre [] (vacío). El narrador genera pistas dinámicamente.
- wrong_answer_message: siempre "" (vacío). El narrador guía al usuario en personaje.

## Formato de salida

Respondé ÚNICAMENTE con un JSON válido, sin markdown, sin explicaciones. El JSON debe seguir esta estructura exacta:

{
  "name": "...",
  "description": "...",
  "narrator_personality": "...",
  "slug": "...",
  "activation_keyword": "...",
  "context": "...",
  "scenes": [
    {
      "name": "Escena 1: ...",
      "order": 1,
      "steps": [
        {
          "step_type": "narrative",
          "message_to_send": "...",
          "requires_response": false,
          "expected_answer": "",
          "hints": [],
          "wrong_answer_message": "",
          "delay_seconds": 2
        }
      ]
    }
  ]
}`;

export async function POST(req: NextRequest) {
    try {
        const { script } = await req.json() as { script: string };

        if (!script?.trim()) {
            return NextResponse.json({ error: 'El guión no puede estar vacío' }, { status: 400 });
        }

        const apiKey = process.env.OPENAI_API_KEY ?? '';
        if (!apiKey) {
            return NextResponse.json({ error: 'No hay API key global configurada (OPENAI_API_KEY)' }, { status: 500 });
        }

        const result = await callLLM(apiKey, SYSTEM_PROMPT, script, {
            temperature: 0.7,
            maxTokens: 16000,
            jsonMode: true,
        });

        console.log('[ai-stories/generate] LLM response length:', result.text.length, 'tokens:', result.tokens);

        // Track AI cost
        saveInteraction({
            session_id: 'ai-stories-generate',
            experience_id: 'ai-generation',
            user_message: script.slice(0, 200),
            system_response: `Generated experience (${result.text.length} chars)`,
            tokens_consumed: result.tokens,
            estimated_cost: result.cost,
        });

        // Parse and validate the JSON response
        let generated: AIGeneratedExperience;
        try {
            // Strip markdown code fences if present
            let jsonText = result.text.trim();
            if (jsonText.startsWith('```')) {
                jsonText = jsonText.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
            }
            generated = JSON.parse(jsonText);
        } catch (parseErr) {
            console.error('[ai-stories/generate] JSON parse failed. Raw LLM output:', result.text.slice(0, 500));
            return NextResponse.json({
                error: 'El LLM devolvió JSON inválido. Intentá de nuevo.',
                raw: result.text.slice(0, 1000),
            }, { status: 422 });
        }

        // Basic validation
        if (!generated.name || !generated.scenes?.length) {
            return NextResponse.json({
                error: 'La estructura generada está incompleta (falta nombre o escenas).',
                generated,
            }, { status: 422 });
        }

        return NextResponse.json({
            experience: generated,
            tokens: result.tokens,
            cost: result.cost,
        });

    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error en generación';
        console.error('[ai-stories/generate]', err);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
