# StoryHunt — Autonomous Marketing System

**Owner:** Claude (COO). **Accountable:** Mariano (CEO).
**Frame:** amplía `GROWTH-PLAN.md` (qué se vende) y opera bajo `OPERATING-MODEL.md` (quién decide). No reemplaza a ninguno.
**Creado:** 2026-06-15 · **Congelado hasta:** CPRL ≥ 1 (único evento que reabre el tier de ads).

> **Verdad de fondo:** un sistema de marketing autónomo **amplifica una estrategia — no inventa demanda.** No puede hacer que un scroller global frío viaje a NYC, ni amplificar un producto que nadie puede terminar. La auditoría probó que ya corrimos un motor industrial (265 assets, ~30 posts/sem) y fue **estéril**: 32 likes en 38 posts en 30 días, ciegos de tracking, audiencia cruzada. Más volumen de lo mismo es el fracaso repetido más rápido. Este sistema cambia volumen por **menos piezas, más filosas, medidas y apuntadas a NYC — cada una atada a CPRL.**

---

## 1. El principio — qué SÍ y qué NO hace

**North Star: CPRL** (Completed-Paid-Reviewed Loops). Hoy: **0.** Un dólar real (no cupón $0) → experiencia terminada en el teléfono → reseña. El único trabajo del marketing pre-CPRL es **distribución $0-CAC que mete a gente PRESENTE en NYC a una jugada paga.** Métricas líderes esta fase: **saves + visitas al perfil + clicks al link de viewers NYC** — no likes, no impresiones.

| SÍ hace | NO hace |
|---|---|
| ~7-9 piezas filosas/semana, pesadas hacia formatos probados | Volver al firehose de 30/sem |
| Medir reach → save → click → checkout por post | Optimizar por likes (la auditoría probó que son ruido) |
| Apuntar cada post a gente EN o yendo a NYC | Transmitir a scrollers globales fríos por reach vanidoso |
| Matar formatos muertos y duplicar ganadores solo (Tier-A) | Inventar demanda que el producto no absorbe |
| Correr el motor de canje (jugadas + reseñas reales a ~$0) | Gastar en ads antes de CPRL ≥ 1 |
| Publicar solo a @storyhunt.city vía Blotato | Postear fuera de las 3 cuentas |
| Mantener el **ángulo** de info oculta / datos NYC | Mantener el **formato** muerto (placas DATA_/SIGNAL_) |
| Usar stock gritty + UGC real | Generar escenas/caras NYC falsas con IA |

**La dependencia honesta:** hasta arreglar el scope de insights de IG, optimizamos sobre likes (ruido). Regenerar el token es el movimiento de mayor palanca del documento. Nada aguas abajo es confiable sin eso.

---

## 2. KILL / KEEP / START

**KILL:** placas estáticas DATA_/SIGNAL_ (32 likes/38 posts) · imágenes postal/skyline/Times Square/Estatua · escenas/caras NYC con IA · scheduling de volumen-por-volumen (~30/sem) · cualquier post sin CTA a acción comprable.
**KEEP:** el ángulo de info oculta/datos NYC · reels POV (flagship) · los 4 pipelines de `marketing-review/` · programa de canje + 1 UGC pago · Blotato → @storyhunt.city solo.
**START:** regenerar `INSTAGRAM_ACCESS_TOKEN` con `instagram_manage_insights` · trendline de followers → `.follower-history.json` · UTM por post en el link · sourcing de stock (`pull_stock_images.py`, Unsplash/Pexels) · scoring por formato en `analyze.py` (saves, no likes).

---

## 3. Content engine (~7-9 posts/semana)

Cada asset resuelve a una **acción comprable** (link de juego, reseña OTA, QR /scan).

1. **Reels POV — flagship (2/sem).** Persona de espaldas caminando NYC real, manos arriba texteando, burbujas = un dato oculto de NYC. El ángulo en *movimiento*. (Regla Veo: nunca la palabra "POV" → selfie stick; validar cada clip con grilla de 8 frames.)
2. **Carruseles "declassified-NYC" (2-3/sem).** Mismo ángulo, otro vehículo. Slide 1 = foto stock gritty + hook de archivo redactado. Slides 2-4 = el dato + micro-historia. Último = CTA producto. Reemplaza las placas muertas.
3. **Reels de creador/UGC (1-2/sem, creciendo).** Nano-creadores jugando un hunt real. Auténtico > pulido; prueba social hacia primeras reseñas. **El formato que compone.**
4. **Threads / hooks de texto (1-2/sem, barato).** Un dato oculto como texto, NYC-targeted. Testea qué dato tracciona antes de invertir un reel.

**Stock (on-brand):** Unsplash/Pexels vía `pull_stock_images.py`. Términos anti-turista ("NYC subway platform night", "Chinatown alley", "fire escape Manhattan"…), NUNCA Times Square/skyline/Estatua. Gritty, street-level. Sin IA falsa.

---

## 4. Medición & atribución

Las ventas ya capturan `utm_source/medium/campaign` (checkout → Stripe → doc `sales`, vivo en `src/app/api/checkout/route.ts`). Pero los posts no llevan tag por pieza, IG sin scope de insights, sin trendline de followers. Ciegos en 3 capas: ¿llega a alguien → se vuelve follower → clickea al checkout?

**Arreglar en este orden:** (1) scope `instagram_manage_insights` — desbloquea reach/saves/shares; (2) `followers_count` → `.follower-history.json`; (3) UTM por post en el link del bio → `sales.utm_campaign` cierra el loop reel → dólar.

**5 KPIs (atados a CPRL, cero vanidad):** reach→visita-perfil · Δ followers/sem · save rate % · link-clicks→checkout · posts→ventas pagas atribuidas. Likes = solo desempate.

**Regla semanal:** doblar formatos top en save-rate con Δ followers+ ; matar reach>500 con save-rate<0.5% y 0 visitas; el primer post con checkout-start atribuido = trigger CPRL≥1 para abrir ads detrás de ESE creativo.

---

## 5. Distribución & programa de creadores

**Roles de canal (Blotato → @storyhunt.city solo):** TikTok = descubrimiento (mejor reach orgánico en frío, 1/día NYC-tagged) · Instagram = credibilidad + hub de creadores (1 reel + 1 carrusel/día) · Threads = conversación + infiltración en comunidad NYC (reply-first, no broadcast).

**El motor: canje + 1 UGC pago.** Nano-gifting (CREATOR-SOURCING §1) = 4-6 jugadas comped/mes = jugadas + contenido + reseñas a ~$0. Loop: Mariano manda 10-15 DMs/sem a nano NYC vetados → en "sí" el COO emite token comped + agenda el pedido de reseña (disclosure FTC "gifted" en reseña TA; sus reels son orgánicos) → repost desde @storyhunt.city → nuestro feed se llena de caras NYC reales jugando. 1 UGC pago (~$200, Tier-B/C) = activo hero propio. Cada creador = un tiro a CPRL.

**$0-CAC (ads off hasta CPRL≥1):** newsletters/comunidades NYC (Secret NYC, Time Out, The Skint, r/nyc, r/AskNYC — responder, no dropear link) · co-brand con cuentas chicas NYC · **fix de geo-relevancia (la palanca real):** todo NYC-geotagged, hashtags NYC en "Recientes", captions a quien está parado HOY en NYC. Dejar de transmitir a scrollers globales.

---

## 6. Loop semanal + tiers de decisión

**Lunes, una corrida** (sobre el cron existente de `marketing-review/`): `pull_social_metrics.py` → `analyze.py` → `build-schedule.py` → `push-to-blotato.py` → `/storyhunt-qa` → escribe `decision-log.jsonl` + 1 digest Telegram de ~8 líneas. Pasos: MEDIR primero → SCOREAR por saves+shares → PRODUCIR pesado a ganadores → PUBLICAR @storyhunt.city → LOG + DIGEST (con sección "⚠️ NECESITO DE VOS").

**Tiers (de OPERATING-MODEL §3):**
- **Tier-A (COO solo, sin ping):** qué imágenes/formatos/copy, scheduling, matar formatos muertos, reasignar producción a ganadores, arreglar scopes de tracking, sourcing nano (canje $0), emitir tokens comped.
- **Tier-B (propongo Telegram, avanzo salvo veto 24h):** gasto $20-50, nuevo canal/cuenta, broadcast a la lista, primer cross-post fuera de las 3 cuentas.
- **Tier-C (solo CEO):** ads ON (gated por CPRL≥1), gasto >$50 (incl. UGC ~$200), ops de campo NYC, partners/prensa.

**Auto-corrección:** matar formato bajo mediana de saves 2 semanas seguidas; duplicar el top; si 0 posts pasan 5 saves en 2 semanas → **parar de escalar volumen, correr UN experimento** (el volumen fue el fracaso original); primer venta paga atribuida = CPRL≥1 → reabre ads.

---

## 7. Primeros 30 días

- **Sem 1 — instrumentar antes de producir:** regenerar token IG con insights (Tier-C, necesita tu login) · followers→`.follower-history.json` · UTM por post · `pull_stock_images.py` · capear a 8/sem · frenar placas DATA_/SIGNAL_.
- **Sem 2 — primer ciclo medido:** ~8 posts (2 POV, 2-3 carruseles stock, 1-2 Threads), todo NYC-geo · CEO manda primeros 10-15 DMs de canje (COO emite tokens en "sí").
- **Sem 3 — scorear, matar, duplicar:** primera decisión kill/double por save-rate · primer reel UGC si entró una jugada comped · pitch a 2-3 newsletters/comunidades NYC.
- **Sem 4 — roll-up + trigger:** board 1-pager · cazar el primer checkout-start atribuido (y el primer CPRL vía reseñas del canje).

**La vara honesta a 30 días:** NO vamos a fabricar demanda. Éxito = (a) dejar de estar ciegos, (b) saber qué formato/ángulo saca saves de viewers NYC, (c) al menos 1 jugada real + 1 reseña del motor de canje. Si 0 posts pasan 5 saves y 0 jugadas de canje entran, el sistema dice **parar de escalar y correr un experimento** — no postear más.
