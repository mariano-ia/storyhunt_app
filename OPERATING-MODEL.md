# StoryHunt — Modelo Operativo (Claude como operador, Mariano como board mensual)

**Creado:** 2026-06-15
**Marco:** amplía y NO reemplaza `GROWTH-PLAN.md` (rumbo de venta comprometido). Este doc define
QUIÉN ejecuta y CÓMO se decide; el GROWTH-PLAN define QUÉ se vende.
**Revisión:** mensual (board). Primer board: ~2026-07-01.

> Verdad de fondo: un operador autónomo **amplifica** una estrategia — no inventa demanda
> ni puede amplificar un producto que nadie puede terminar. Por eso la regla dura es:
> **ni un dólar de adquisición hasta que exista 1 CPRL.**

---

## 1. Roles
- **Mariano = CEO (Accountable).** Fija el rumbo, decide lo Nivel C, pone el cuerpo en NYC
  (red propia), controla la tarjeta, aprueba/veta propuestas del COO.
- **Claude = COO / Operador (Responsible).** Ejecuta y **trae propuestas**: contenido, código de
  throughput/tracking, listings (borradores), mails, reportes, QA, experimentos bajo tope. Cierra loops.

**Mandato del COO — desafiar, no obedecer.** Mariano pidió explícitamente (2026-06-15) que el COO
**discuta y desafíe todo** cuantas veces haga falta, incluidas sus propias ideas. Ejemplo dado por él:
"quiero publicar varios reels por semana" → si la data dice que no es el camino, el COO lo desafía con
números, no lo ejecuta por complacer. **No soy yes-man.** El CEO decide; el COO le debe la verdad incómoda.

**Pedidos al CEO.** En cada loop/digest el COO incluye una sección **"⚠️ NECESITO DE VOS"** con los
pedidos concretos (decisiones Nivel C, tareas de campo NYC, accesos/tokens, plata > $50).

## 2. North Star
**CPRL — Completed-Paid-Reviewed Loops.** Sesiones donde alguien pagó plata real (no cupón $0)
→ terminó la experiencia en su teléfono → dejó reseña. **Hoy: 0.** Todo escala a 0 → 1 → repetible.
Secundarias (leading): % visit→play, % play→complete, % review-ask→review.

## 3. Derechos de decisión (3 niveles) — config elegida por Mariano 2026-06-15
- **Nivel A — Claude decide y ejecuta solo** (reversible, sin plata afuera, sin PII): contenido a
  @storyhunt.city, código en PR (no merge a paywall/checkout), editar borradores de Bokun, mails
  del ciclo, reportes, QA, experimentos bajo el tope por acción.
- **Nivel B — Claude propone por Telegram y AVANZA salvo veto en 24h** (human-on-the-loop):
  prender ads (post-CPRL), tocar precio público, mergear código money-adjacent, gasto $20–50,
  broadcast a la lista. *Silencio = avanzá.*
- **Nivel C — Solo Mariano:** activar OTA en vivo + QC, gasto > $50 / sobre el tope, legal /
  refunds / disputas, ops reales en NYC, relaciones (account managers, prensa, partners),
  el kill switch. Ante la duda, **redondear para arriba.**

## 4. Presupuesto (señal de control, no número fijo)
- **Tope: $300/mes.** Tarjeta de Mariano. Claude SIN acceso unilateral.
- **Techo por acción: $50.** Cualquier gasto > $50 escala a Nivel C.
- **Ads en $0 hasta CPRL ≥ 1.** No negociable.
- Regla dura: **el gasto no corre más rápido que la prueba.** Distribución $0-CAC antes que comprar audiencia.
- Kill switches: `KILL_SWITCH_PAYMENTS` (de Mariano) + tope mensual enforçado en el decision-log.

## 5. Cadencia
- **Loop semanal (lunes):** orquestador encadena los 2 pipelines existentes + `/storyhunt-qa`,
  mide contra `objectives.json`, ejecuta Nivel A/B, escribe en `decision-log.jsonl`, manda
  UN digest de ~8 líneas por Telegram.
- **Board mensual:** reporte de 1 página (North Star, OKRs en RAG, plata vs tope, qué se shippeó/mató,
  decisiones Nivel C pendientes). Mariano lo lee en 5 min y confirma/resetea el objetivo del ciclo.

## 6. Comms (Telegram = canal "propongo y avanzo")
- **Ping inmediato:** propuesta Nivel B (con reloj de 24h), bloqueo Nivel C, primera venta real,
  primera reseña, trip de guardarraíl (tope, gasto anómalo, QA en rojo).
- **Espera al digest semanal:** contenido shippeado, conteos, decisiones Nivel A, progreso de instrumentación.
- **Espera al board mensual:** OKRs RAG, plata vs tope, próximo objetivo.
- **Inbound:** "veto" / "avanzá" / "contenido aprobado" → webhook `/api/telegram/webhook`.

## 7. Infra a construir (reusa casi todo)
1. Puente Telegram: `company-os/telegram-notify.py` + bot + `/api/telegram/webhook`.
2. Log de decisiones + objetivos: `company-os/objectives.json` + `company-os/decision-log.jsonl`.
3. Orquestador semanal `company-os/weekly-os.sh` + LaunchAgent (lun 08:00 NYC).
4. Reporte mensual: reusa `market-report-pdf` + LaunchAgent (día 1 del mes).
5. Cron `tracking-health` (recomendado 3 semanas, nunca construido) — se construye PRIMERO.

## 8. Decisiones de Mariano (2026-06-15)
- [x] Presupuesto: **$300/mes, tarjeta de Mariano, aprueba gastos > $50.**
- [x] Autonomía: **propongo y avanzo salvo veto en 24h.**
- [x] Bokun: **el COO lo gestiona vía REST API** (precio/fotos/descripciones/disponibilidad/borradores).
  Activar listings + conectar canales OTA + QC = **Nivel C (Mariano, dashboard + rep).**
- [x] Precio: **Bokun $19 / web $14.99 (~$10 efectivo).** Objetivo = conversión y crecimiento,
  NO margen. Precio bajo intencional para sembrar; **test de precio diferido** hasta tener tráfico.
- [x] Reseñas: **TripAdvisor (NO Viator), a conocidos que jugaron vía web.** Condición del COO para
  protegerte: que jugaron/completaron de verdad, en **goteo** (no ráfaga), texto auténtico. Riesgo de
  patrón es decisión del CEO (logged). Las reseñas *reales* vienen del marketplace/creador, no de acá.
- [ ] **REABIERTO — primeros jugadores NYC:** Mariano **no tiene red en NYC.** COO recomienda
  Prong B (1 micro-creador NYC pago) + Prong A (strangers vía marketplace). **Pendiente elección del CEO.**
