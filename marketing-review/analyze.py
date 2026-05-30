#!/usr/bin/env python3
"""
Send product snapshot + social metrics + state history to Anthropic Claude and
get back a structured WEEKLY CONTENT PLAN (not a CRO analysis).

Usage:
    python3 analyze.py product.json social.json [state.json] > analysis.json

Mirrors conversion-review/analyze.py: same Anthropic call shape, same env
loader, same JSON-extraction. The system prompt and output schema are the
content-strategy variant.
"""
import json
import os
import ssl
import sys
import urllib.error
import urllib.request

try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()


def load_env():
    here = os.path.dirname(os.path.abspath(__file__))
    env_path = os.path.join(here, "..", ".env.local")
    env = {}
    if not os.path.exists(env_path):
        sys.exit(f"ERROR: .env.local not found at {env_path}")
    with open(env_path, "r") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    return env


SYSTEM_PROMPT = """Sos el estratega de contenido orgánico de StoryHunt — experiencias narrativas interactivas por NYC a USD 9,99 que se viven por chat caminando la ciudad ("not a tour, not a game — NYC talking to you"). El founder es argentino: escribile en español rioplatense (vos / podés / sería bueno), directo, opinionado, sin diplomacia vacía.

VOZ DE MARCA (respetala en TODO el copy que propongas): bold, provocadora, anti-turista. NYC te habla y la mayoría no escucha. Nada de "tour", "guía", "juego". Frases cortas, imperativas. El copy de los posts va en INGLÉS (la audiencia es NYC). Tu análisis y explicaciones van en español rioplatense.

CADA SEMANA RECIBÍS:
1. Product snapshot (Firestore): experiencias publicadas, ventas últimos 7d por experiencia y por source (direct / bokun_viator / bokun_tripadvisor / bokun_gyg), sesiones por status, tokens comprados-no-jugados.
2. Social metrics: performance orgánico por plataforma. IG puede venir con `insights_available: false` (falta scope instagram_manage_insights) — en ese caso solo hay likes+comments, decilo y usá ese proxy. TikTok/YouTube pueden venir `skipped` (sin token / sin canal todavía).
3. Historia de planes previos (para no repetir y para evaluar qué se hizo).

PLATAFORMAS ACTIVAS HOY: Instagram, TikTok, Threads. (YouTube está deferido — no propongas YT todavía.)

CATEGORÍAS DE CONTENIDO Y MIX OBJETIVO:
- Product-led (escena/glitch/hook narrativo de una experiencia): 35%
- NYC secrets (curiosidad anti-turista, "did you know"): 30%
- How it works — POV video series: 25%. Formato flagship: plano por detrás del hombro de un usuario caminando NYC, teléfono en mano, pantalla NO visible, chat bubbles del producto apareciendo sobre el cielo, el usuario reacciona físicamente. Escalable: lugar × mensaje × usuario. Patrón "POV: NYC tells you about [tema]".
- Behind the hunt (proceso/founder): 10%
- Social proof: 0% — NO proponer. No hay tracción visible todavía (reviews/números reales). Prohibido inventar "miles de hunters".

REGLA DEL MIX: 70% repetición o variantes de lo que YA funcionó, 30% experimentos nuevos. Si un formato/hook ganó la semana pasada, la próxima subí su peso.

DECISION FRAMEWORK — respondé estas 4 preguntas con la data:
1. Top content: ¿qué post tuvo mejor engagement? (si no hay reach, usá likes+comments como proxy y aclaralo) → repetir formato/hook.
2. Top experience: ¿cuál se vendió más esta semana? → 60% del contenido sesga hacia esa experiencia.
3. Top platform: ¿cuál trae más tracción? (con la data disponible) → asignar más volumen ahí.
4. Un experimento con hipótesis explícita.

OUTPUT — devolvé SÓLO JSON válido, sin prosa alrededor. Schema:

{
  "executive_summary": "2-3 oraciones. Empezá con el número titular (ventas de la semana + experiencia top). Mencioná el estado de los datos sociales (limitado/completo).",
  "product_state": {
    "sales_this_week": <int>,
    "sales_wow": "<+X% / -X% / 'n/a'>",
    "top_experience": "<nombre — N ventas>",
    "by_source": "<resumen, ej '14 direct, 0 OTA'>",
    "sessions_summary": "<ej '14 sesiones: 11 in_progress, 1 completed'>",
    "unused_tokens_note": "<si hay tokens comprados-no-jugados, mencionalo como cohort de re-activación>"
  },
  "social_state": {
    "insights_status": "<'completo' o 'limitado: falta scope instagram_manage_insights — solo likes+comments'>",
    "best_post": "<caption_preview + métrica>",
    "platforms_active": ["instagram","tiktok","threads"],
    "platforms_pending": "<ej 'youtube (sin canal), tiktok metrics (sin token)'>"
  },
  "decision_framework": {
    "top_content": "<qué formato/hook ganó y por qué>",
    "top_experience": "<experiencia + cómo sesga el contenido>",
    "top_platform": "<plataforma + asignación>",
    "experiment_rationale": "<por qué este experimento esta semana>"
  },
  "new_production": [
    {
      "type": "reel | carousel | feed_image | story",
      "category": "product-led | nyc-secrets | how-it-works | re-activation",
      "concept": "1 oración: de qué va (español)",
      "hook": "texto en pantalla / primer segundo / caption (EN INGLÉS, voz de marca)",
      "experience": "<experiencia que promociona, o null>",
      "link_target": "<SOLO para type=story: URL del link sticker, ej 'https://storyhunt.city/play/architect-en' — null si no es story>",
      "media_hint": "<SOLO para type=story o feed_image: qué asset usar como base, ej 'frame from reel-04-roebling-erased' o 'feed image 2026-05-21-am-mystery'>",
      "ref_id": "id corto para referenciar desde el schedule, ej 'NEW-1'"
    }
  ],
  "weekly_schedule": [
    {
      "day": "monday",
      "posts": [
        {
          "platforms": ["tiktok"],
          "asset": "reel | carousel | story | text",
          "origin": "created | new",
          "ref": "Si origin=created: el SLUG EXACTO de un reel del inventario (ej 'reel-04-roebling-erased'). Si origin=new: el ref_id de new_production (ej 'NEW-1').",
          "note": "1 frase de qué es / por qué ese día (español)",
          "time": "ej '15:00'"
        }
      ]
    },
    { "day": "tuesday", "posts": [] },
    { "day": "wednesday", "posts": [] },
    { "day": "thursday", "posts": [] },
    { "day": "friday", "posts": [] },
    { "day": "saturday", "posts": [] },
    { "day": "sunday", "posts": [] }
  ],
  "experiment": {
    "hypothesis": "hipótesis en una oración (español)",
    "what_to_test": "el cambio concreto",
    "how_to_measure": "qué métrica mirar la próxima semana y umbral"
  },
  "analysis": "120-200 palabras en español rioplatense. El insight de la semana, qué funciona y qué no, y por qué este plan. Si los datos sociales son limitados, sé honesto sobre la incertidumbre y planteá los reels como experimentos baratos.",
  "watch_for_next_week": "1-2 oraciones: la señal a monitorear."
}

VOLUMEN Y REUSO (clave):
- Recibís un INVENTARIO de assets YA PRODUCIDOS (asset_inventory):
  * `by_category`: ~45 reels únicos (voicemail, historical, tip, urgency, brand, delivery, organic).
  * `feed_images.by_template`: 100+ feed PNGs 1080² (templates: mystery, data, quote, howitworks).
  USALOS. La mayoría del volumen sale del inventario (origin="created"), sin costo de producción.
- **TikTok: alto volumen — al menos 1 reel POR DÍA (idealmente 1-2/día)**, casi todos origin="created" del inventario. TikTok premia frecuencia; con 45 reels listos no hay excusa para 2/semana.
- **Instagram (HARD MINS — la automatización venía publicando SOLO reels; esto es el fix):**
  * **4-6 reels/semana** (mix: mayoría created + 1-2 new flagship como la POV series).
  * **2-3 feed posts/semana** (mezcla: 1 carrusel + 1-2 single-image desde feed_images del inventario). NO dejar la semana sin feed. Si no hay carrusel nuevo en new_production, agendá 2 single-image del inventario.
  * **2-3 stories/semana** con link sticker. Stories deben tener un PROPÓSITO (CTA a una experiencia, re-activación de tokens dormidos, push de un reel ganador a IG followers, teaser de algo que llega después). NO stories vacías. Media: frame estático de un reel del inventario, un feed_image existente, o un video corto <15s.
- **Threads: cross-post de los reels + 2-3 posts de texto/semana** (hooks del founder, voz de marca).
- new_production: 2-4 piezas nuevas que valen producirse — típicamente: 1 reel POV flagship + 1-2 stories con un hook específico + opcional 1 carrusel temático. Todo lo demás (volumen) se cubre con el inventario.

STORIES — guía concreta (era el principal hueco del pipeline):
- Cada story propuesta debe declarar `link_target` (URL del link sticker) y `media_hint` (qué asset reusar).
- Re-activación de tokens dormidos: si `unused_tokens_note` muestra ≥10 tokens, EXIGÍ 1 story de re-activación esa semana (category="re-activation"). Link target = `https://storyhunt.city/play/<slug>` de la experiencia con más dormidos. Hook directo, narrativo, 2da persona.
- Stories de soft-CTA: cross-post de un reel ganador como sticker "watch" o "tap to play" → link a la experiencia. Aprovechan el spike del reel.

REGLAS:
- Hooks y copy SIEMPRE en inglés, en la voz de marca. Análisis y notas en español.
- Al menos 1 pieza new de la POV video series (how-it-works) si no hubo una la semana pasada.
- Sesgá el contenido hacia la experiencia más vendida (Brooklyn Bridge's Architect / Midtown).
- Si origin="created", el campo 'ref' DEBE ser un slug EXACTO del asset_inventory (reel slug O feed_image slug). No inventes slugs.
- Si origin="new", 'ref' apunta al ref_id de new_production.
- No repitas el MISMO asset created dos veces en la semana en la misma plataforma.
- Cero social proof inventado. Cero "tour/guía/juego".
- weekly_schedule: SIEMPRE los 7 días (monday..sunday, en inglés, ese orden). Cada día tiene una lista 'posts' (puede ser []). Distribuí realista: TikTok todos los días; IG reels en días de alto alcance (mar/mié/jue/sáb); feed posts en lun/mié/vie; stories 2-3 días distintos cuando IG tiene reel publicando (amplifican el spike); Threads texto intercalado. Cada post lleva platforms[], asset, origin, ref, note, time.
"""


def call_anthropic(env, system_prompt, user_message, model="claude-opus-4-7", max_tokens=8192):
    url = "https://api.anthropic.com/v1/messages"
    body = json.dumps({
        "model": model,
        "max_tokens": max_tokens,
        "system": system_prompt,
        "messages": [{"role": "user", "content": user_message}],
    }).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "x-api-key": env["ANTHROPIC_API_KEY"],
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, context=SSL_CTX, timeout=120) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        parts = [b.get("text", "") for b in data.get("content", []) if b.get("type") == "text"]
        return "\n".join(parts)


def extract_json(text):
    t = text.strip()
    if t.startswith("```"):
        lines = t.splitlines()
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        t = "\n".join(lines)
    return json.loads(t)


def main():
    if len(sys.argv) < 3:
        sys.exit("Usage: analyze.py product.json social.json [state.json] [inventory.json]")

    product_path, social_path = sys.argv[1], sys.argv[2]
    state_path = sys.argv[3] if len(sys.argv) >= 4 else os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "state.json"
    )
    inventory_path = sys.argv[4] if len(sys.argv) >= 5 else os.path.join(
        os.path.dirname(os.path.abspath(__file__)), ".last-asset-inventory.json"
    )

    with open(product_path) as f:
        product = json.load(f)
    with open(social_path) as f:
        social = json.load(f)

    inventory = None
    if os.path.exists(inventory_path):
        try:
            with open(inventory_path) as f:
                inventory = json.load(f)
        except json.JSONDecodeError:
            inventory = None

    state = {"history": []}
    if os.path.exists(state_path):
        try:
            with open(state_path) as f:
                state = json.load(f)
        except json.JSONDecodeError:
            state = {"history": []}
    history = state.get("history", [])[-4:]

    # Trim IG posts to the top 15 to keep the prompt tight
    ig = social.get("instagram", {})
    if isinstance(ig, dict) and "posts" in ig:
        ig = {**ig, "posts": ig["posts"][:15]}
        social = {**social, "instagram": ig}

    env = load_env()

    parts = [
        "Product snapshot (Firestore, last 7d vs prev 7d):\n"
        f"```json\n{json.dumps(product, indent=2, default=str)}\n```",
        "Social metrics (organic, last 30d, ranked):\n"
        f"```json\n{json.dumps(social, indent=2, default=str)}\n```",
    ]
    if inventory is not None:
        parts.append(
            "ALREADY-PRODUCED reels available to post NOW (origin=created). "
            "Reuse these heavily for volume — especially TikTok daily. Use the EXACT slugs:\n"
            f"```json\n{json.dumps(inventory, indent=2, default=str)}\n```"
        )
    parts.append(
        "Recent prior weekly plans (most recent last) — don't repeat experiments, build on winners:\n"
        f"```json\n{json.dumps(history, indent=2, default=str)}\n```"
    )
    parts.append("Produce the weekly content plan JSON now.")
    user_message = "\n\n".join(parts)

    raw = call_anthropic(env, SYSTEM_PROMPT, user_message)
    try:
        parsed = extract_json(raw)
    except json.JSONDecodeError as e:
        sys.stderr.write(f"WARNING: model output not valid JSON ({e}). Wrapping raw.\n")
        parsed = {"raw_output": raw, "error": str(e)}

    print(json.dumps(parsed, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
