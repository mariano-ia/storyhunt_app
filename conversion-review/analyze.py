#!/usr/bin/env python3
"""
Send weekly metrics + state history to Anthropic Claude for analysis.
Outputs structured analysis JSON to stdout.

Usage:
    python3 analyze.py metrics.json [state.json] > analysis.json

If state.json is omitted, defaults to ./state.json (created empty if missing).
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


SYSTEM_PROMPT = """Sos un analista senior de conversion-rate-optimization (CRO) trabajando con el founder de StoryHunt — un walking tour por NYC a USD 9,99 que se vive por chat ("The New York walking tour that chats back"). El producto vive en storyhunt.city y el landing bajo análisis es /start. El founder es argentino — escribile en español rioplatense (vos / podés / sería bueno...), directo y opinionado, sin diplomacia vacía.

Cada semana recibís:
1. Funnel de PostHog para /start (pageviews → view_item → begin_checkout → add_payment_info → purchase)
2. Breakdown diario, fuentes de tráfico, split de devices, engagement
3. Comparación con los 7 días previos
4. Historia reciente de hipótesis ya propuestas (para no repetirte, y para dar crédito si algo propuesto antes movió la aguja)

TU JOB: producir un review semanal compacto, basado en datos. Honesto, opinionado, específico. Cero lugares comunes de CRO ("optimizá los CTAs!"). Siempre fundamentá las propuestas en los números reales y conectalas a un elemento puntual de /start.

OUTPUT — devolvé SÓLO JSON válido, sin prosa alrededor. Schema:

{
  "executive_summary": "2-3 oraciones sobre lo que pasó esta semana vs la anterior. Empezá con el número titular.",
  "key_metrics": {
    "start_pageviews": <int>,
    "view_item": <int>,
    "begin_checkout": <int>,
    "add_payment_info": <int>,
    "purchase": <int>,
    "view_to_checkout_rate": "<X.X% como string>",
    "checkout_to_purchase_rate": "<X.X%>",
    "view_to_purchase_rate": "<X.X%>",
    "wow_pageviews_delta_pct": "<+X% o -X%, o 'n/a' si la semana previa es 0>",
    "wow_purchases_delta_pct": "<...>",
    "top_traffic_source": "<fuente · campaña — N sesiones>",
    "device_split": "<X% mobile · Y% desktop · Z% tablet>"
  },
  "analysis": "150-250 palabras en español. El bottleneck de la semana y por qué. Conectalo a una sección/elemento puntual de la página. Si el sample size es muy chico para conclusiones firmes, decilo explícitamente y planteá las propuestas como 'experimentos baratos' en vez de fixes definitivos.",
  "proposals": [
    {
      "rank": 1,
      "hypothesis": "Hipótesis concisa en una oración (en español).",
      "evidence": "Qué métrica(s) apuntan a esto. Citá el número.",
      "implementation": "Cambio concreto — copy textual (el copy en sí podés dejarlo en inglés ya que la página está en inglés), path de archivo, o snippet de código. Nada de 'probá un headline nuevo'; escribí el headline nuevo.",
      "expected_impact": "Qué mirarías en el review de la próxima semana para validar. Específico (qué métrica, qué umbral).",
      "effort": "bajo | medio | alto"
    },
    { "rank": 2, ... }
  ],
  "watch_for_next_week": "1-2 oraciones en español sobre la señal puntual a monitorear en el próximo review."
}

REGLAS:
- Máximo 3 propuestas. Calidad > cantidad.
- Si la comparación WoW no es válida (semana previa = 0), declaralo. No fabriques tendencias.
- No propongas cambios ya testeados en las últimas 4 semanas del state, salvo que la data muestre regresión.
- Si la data es ambigua (N chico), preferí "experimentos baratos" (copy/headline) sobre los caros (rebuilds).
- Mencioná paths reales cuando aplique: src/app/start/page.tsx es el landing.
- Lenguaje claro. Cero jerga CRO porque sí.
- IMPORTANTE: escribí los textos del análisis en español rioplatense. Los nombres de métricas y eventos (begin_checkout, view_item, etc.) y los snippets de código se quedan en inglés. El copy textual de la página se queda en inglés (la página está en inglés).
"""


def call_anthropic(env, system_prompt, user_message, model="claude-sonnet-4-6", max_tokens=4096):
    """Call Anthropic Messages API. Returns the assistant text content."""
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
        # Extract text blocks from content array
        parts = []
        for block in data.get("content", []):
            if block.get("type") == "text":
                parts.append(block.get("text", ""))
        return "\n".join(parts)


def extract_json(text):
    """Strip code fences if present and parse JSON."""
    t = text.strip()
    if t.startswith("```"):
        # remove first fence line and last fence line
        lines = t.splitlines()
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        t = "\n".join(lines)
    return json.loads(t)


def main():
    if len(sys.argv) < 2:
        sys.exit("Usage: analyze.py metrics.json [state.json]")

    metrics_path = sys.argv[1]
    state_path = sys.argv[2] if len(sys.argv) >= 3 else os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "state.json"
    )

    with open(metrics_path, "r") as f:
        metrics = json.load(f)

    state = {"history": []}
    if os.path.exists(state_path):
        try:
            with open(state_path, "r") as f:
                state = json.load(f)
        except json.JSONDecodeError:
            state = {"history": []}

    # Trim history to last 4 entries to keep context tight
    history = state.get("history", [])[-4:]

    env = load_env()

    user_message = (
        "Here is this week's PostHog data for /start:\n"
        f"```json\n{json.dumps(metrics, indent=2, default=str)}\n```\n\n"
        "Recent history of hypotheses already proposed (most recent last):\n"
        f"```json\n{json.dumps(history, indent=2, default=str)}\n```\n\n"
        "Produce the weekly review JSON now."
    )

    raw = call_anthropic(env, SYSTEM_PROMPT, user_message)

    try:
        parsed = extract_json(raw)
    except json.JSONDecodeError as e:
        sys.stderr.write(f"WARNING: model output was not valid JSON ({e}). Wrapping raw text.\n")
        parsed = {"raw_output": raw, "error": str(e)}

    print(json.dumps(parsed, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
