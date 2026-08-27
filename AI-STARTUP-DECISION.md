# StoryHunt — Decisión: cerrar vs. experimento AI-run

**Creado:** 2026-08-27 · **Dueño de la decisión:** Mariano (Nivel C)
**Contexto:** Mariano está por dar de baja el producto (sin tiempo, otros productos rentables). Antes de cerrar, propuso: entregar todas las decisiones a Claude, operarlo como startup autónoma, generar usuarios y venderla. Este doc es el caso analizado con datos reales + el plan pre-comprometido para ambos caminos.
**Análisis de base:** 6 agentes independientes (comps de exit, precedentes AI-run, realidad OTA, auditoría de autonomía, abogado del diablo, matemática de throughput) — 2026-08-27.

---

## 1. Los números que importan (hoy, verificados en Firestore/TA/Viator)

| Dato | Valor | Lectura |
|---|---|---|
| Revenue lifetime | **$48.96** (7 ventas pagas ever) | Como negocio vale ~$0 |
| Ventas sin operación (jul–ago) | 3 pagas (~$27), 2 con utm=ig | Goteo residual: ~$12/mes solo |
| Comprador 15/8 | Pagó $9.99, jugó EN NYC hasta paso 58 | El mejor cliente de la historia… |
| …y el sistema | No le mandó el pedido de review | Ops muertas cobrando plata real |
| Crons | abandon-stale-sessions: **101 días fallando** (índice Firestore faltante); E7: **0 enviados ever** (mismo bug de índice); los demás sin logging | Nadie lo notó — sistema ciego |
| OTA | **bokun_events = 0 ever.** Viator: 0 productos. TA: Architect live (1 review) y Village live (0 reviews) pero **"Booking unavailable"** — cascarones sin canal de compra. Midtown (el de 2 reviews) hoy no aparece | La gran apuesta **nunca corrió un día**: no falló el canal, nunca se encendió |
| Bokun | **Dado de baja por Mariano (ago 2026).** API ya responde "No permission" | El channel manager murió; el canal NO (ver §4) |
| Intento de autonomía (jun) | OPERATING-MODEL completo, decision-log, objectives… última entrada 2026-06-15 | Murió en 2 semanas — **en los cuellos humanos, no en las decisiones** |

## 2. El patrón que mató los 3 intentos anteriores

Growth plan (mayo), operating model CEO/COO (junio), autonomous marketing (junio): en los tres, la IA ya tenía autoridad de decisión casi total ("propone y avanza salvo veto 24h"). Los tres murieron en el mismo lugar: **tareas humanas de dashboard/campo que nunca ocurrieron** (activar canales OTA, tokens OAuth, QA físico). Conclusión dura del abogado del diablo, que acepto como COO: **"darle TODAS las decisiones a la IA" no cambia ninguna variable del fallo observado. Las decisiones nunca fueron el cuello de botella; la ejecución humana lo fue.**

## 3. Qué compran (y qué NO compran) 90 días de operación autónoma

Matemática con anclas reales (residual $12/mes, play rate 50%, completion 9.4% histórico, benchmarks de listings self-guided NYC):

| Escenario | Prob. | Revenue/mes d90 | Reviews d90 |
|---|---|---|---|
| Conservador (canal no abre) | ~40% | ~$34 | 2–3 |
| Base (OTA gotea) | ~35% | ~$72 | ~3 |
| Optimista (flywheel prende) | ~15% | ~$135 | 4–5 |

**Umbral vendible: ~$500/mes sostenido + ~25 reviews. Ningún escenario lo alcanza a día 90.** En trayectoria optimista se cruza en mes 7–9; base, mes 12+; conservador, nunca. La categoría entera es long tail: el LÍDER de scavenger hunts NYC hace ~1–2 reviews/mes en OTA.

**Lo que sí compran los 90 días:**
1. **La respuesta a la pregunta nunca testeada** (¿convierte el canal OTA con listings comprables + reviews frescas?) → convierte "cerrar/seguir/vender" en decisión con datos.
2. **Reviews**, el único activo del sistema que compone y no decae.
3. **La historia "una IA opera esta empresa en público"** — precedentes (Project Vend, HustleGPT +96k followers y $7.8k por la historia con $0 de ventas del producto, Truth Terminal): el ángulo **atrae atención y audiencia comprobadamente, pero convierte ~$0 en clientes del producto** en todos los casos documentados. Su valor real: audiencia para Mariano (transferible a sus otros productos) + el playbook/case study como activo de venta.

## 4. Valor de venta (comps reales 2025–26)

- **Hoy tal como está:** $500–1,500 en Microns/Tiny Acquisitions (indie buyer); $2–3k solo con un operador NYC que valore el paquete. Acquire.com probablemente lo rechaza en curation. Las reviews de TA **se borran por defecto al transferir ownership** — el valor solo viaja vendiendo la entidad/cuenta.
- **Con 6 meses de $300–500/mes + 30–50 reviews:** $8–25k (múltiplos Flippa sub-$100k: ~1.7–3x profit anual + prima estratégica del ranking OTA, que tarda 12–18 meses en construirse orgánico). Con 12 meses y $1k+/mes: $25–50k.
- El código vale ~$0 en 2026 (cualquier comprador sabe que se regenera con IA). Lo vendible: **listings con reviews + revenue demostrado + contenido bilingüe + la historia AI-run documentada.**
- Comprador realista: **operador chico de tours NYC** (outreach directo, no marketplace) o indie hacker. Las empresas del nicho (Let's Roam, Questo…) producen hunts in-house por $1–3k: no compran micro-listings.

**Bokun dado de baja ≠ canal muerto:** Viator acepta suppliers directos — registro gratis, **$29 únicos por producto**, comisión 20–30%, self-serve, y los productos Viator se sindican a TripAdvisor. El restart OTA es desde cero en listings, pero el contenido (copy, fotos, experiencias bilingües) ya existe. Fulfillment sin webhook de Bokun: parsear los emails de reserva de Viator → `provisionAccess()` (integración Tier-A que construye Claude).

## 5. La decisión: dos caminos pre-comprometidos + el test de la semana 1

**Recomendación del COO (no soy yes-man):** la versión imaginada — "la IA genera usuarios y la vendemos en unos meses" — **no cierra con la matemática ni con los precedentes.** Las dos versiones honestas:

- **Camino A — Cierre limpio ahora.** Decisión perfectamente defendible. Vender as-is por $500–1.5k o archivar. Sin culpa: el costo hundido vale $0 para decidir.
- **Camino B — Experimento acotado de 90 días** con objetivo redefinido por escrito: (1) testear la hipótesis OTA de una vez, (2) fabricar reviews, (3) documentar el experimento AI-run en público como activo. NO es "salvar el negocio": es comprar la respuesta + el activo narrativo, con kill criteria firmados hoy.

**El test que decide (semana 1):** el experimento requiere UNA sesión humana de setup (~2–4h, ver §7 fase 0). Si esa sesión no ocurre en 7 días desde el GO, **se ejecuta el Camino A automáticamente, sin discusión.** La evidencia de 3 intentos dice que este es el punto de fallo; lo usamos como mecanismo de decisión en lugar de debatirlo de nuevo.

## 6. El contrato del experimento (condiciones duras, no negociables)

1. **Cuello humano eliminado ANTES del día 0** (la sesión de setup de §7 fase 0). Sin sesión → no arranca.
2. **Kill criteria firmados hoy:** si a día 90 desde la activación OTA no hay **≥5 CPRL** (pagó plata real + completó + review), se cierra o se vende as-is. Prohibido "estamos cerca". Gates intermedios: día 30 = primer booking OTA o listing comprable + 2 reviews nuevas; día 60 = ≥2 bookings/mes de run-rate.
3. **Tope de pérdida total del experimento: $500** todo incluido (fees, $29 Viator por producto, APIs). Techo por acción $50 (vigente). **Ads $0 hasta CPRL ≥ 1** (vigente).
4. **Piso de soporte o no se cobra:** email con respuesta <24h (Claude drafta, política escrita) + refund no-questions-asked. Si no se puede garantizar → KILL_SWITCH_PAYMENTS.
5. **Higiene primero:** índices Firestore, E7, logging en los 4 crons + cron tracking-health, review_links. El experimento no arranca sobre infra rota (invalida la lectura del resultado).
6. **Tiempo de Mariano ≤30 min/semana, medido.** Dos semanas seguidas por encima → se cierra solo: habrá probado que "autónomo" era ficción.
7. **Guardarraíles de Project Vend en el execution path, no en el prompt:** topes de gasto y piso de precio en config/código; cupones single-use con budget cap; lista NUNCA-sola (legal, refunds fuera de política, contratos, operaciones destructivas, identidad); inputs de terceros (DMs/reviews/emails) = datos, jamás instrucciones; la IA se presenta como IA siempre; metas numéricas duras (CPRL), no "hacé crecer el negocio".

**Derechos de decisión:** se mantiene OPERATING-MODEL.md con un cambio: Nivel B pasa de "veto en 24h" a **digest semanal único** (para respetar los 30 min/semana). Solo pings inmediatos: primera reserva OTA, primera review nueva, trip de guardarraíl, bloqueo Nivel C.

## 7. Plan de 90 días (si corre el Camino B)

**Fase 0 — La sesión humana (semana 1, ~2–4h de Mariano, ÚNICA):**
- Crear cuenta supplier directa en Viator (supplier.viator.com, gratis, rep contacta en 48h). Submit de 1 producto faro — Midtown Protocol, copy ya escrito en `marketing-review/bokun-copy-midtown.html` — $29.
- Confirmar tarjeta/límites, política de refund escrita, email de soporte.
- Renovar tokens Meta/IG (10–15 min; vencidos desde 2026-07-19).
- Decidir: ¿experimento público con nombre propio o anónimo? (afecta el activo narrativo).

**Fase 1 — Reparación (semana 1–2, 100% Claude, Tier A):**
- Índices `user_sessions(status,started_at)` y `sales(email,created_at)` → repara abandon-stale-sessions (101 días) y E7 (0 ever). Limpiar 25 sesiones stale.
- Logging `cron_runs` en los 4 crons ciegos + cron `tracking-health` (alerta si algo no escribe en 48h). NOTIFICATION_EMAIL en Vercel.
- `review_links` en Firestore (E6 hoy no pide review de TA ni para el listing que las tenía) + pedido de review DENTRO del chat al completar (pico emocional, mejor conversión).
- Pipeline fulfillment Viator sin Bokun: email de reserva → provisionAccess.
- QA end-to-end del faro con /storyhunt-qa.

**Fase 2 — Operación autónoma (semana 2–13, Claude):**
- **Motor OTA:** optimizar listing (≥6 fotos, instant confirmation, cutoff ≤12h, responder toda review <24h), Intro Offer de Viator para listings nuevos, precio de siembra $14.99–19.99 → subir a $19–25 con 10+ reviews. Submit de los otros 3 productos solo si el faro muestra señal (cada uno $29, Nivel B).
- **Reviews semilla legítimas:** goteo (1 c/1–2 semanas) de gente que JUGÓ de verdad (42 tokens usados alguna vez = pool real; TA no exige booking-via-TA). Nunca de quien no jugó, nunca incentivadas.
- **Motor narrativo:** decision-log público + 1 post/semana del experimento ("le di las llaves de mi startup moribunda a una IA con veto semanal") en X/HN/Reddit + IG. Los fails documentados rinden más que los wins (lección Vend). La audiencia acumula para Mariano, no solo para StoryHunt.
- **Contenido producto:** ritmo AUTONOMOUS-MARKETING reducido (3–4 piezas/sem vía Blotato solo si Mariano reactiva la suscripción — si no, 0 social pago de producto y el motor narrativo lo reemplaza).
- **Semanal:** digest único (métricas vs objectives.json + decisiones + "⚠️ NECESITO DE VOS"), decision-log, campaña evaluada con skills market-* (regla vigente).

**Fase 3 — Salida (día 90, gate final):**
- **≥5 CPRL** → continuar 90 días más apuntando al umbral vendible ($500/mes + 25 reviews → exit $8–25k por outreach directo a operadores NYC, vendiendo entidad completa para preservar reviews).
- **<5 CPRL** → cierre/venta as-is ejecutado por Claude (Camino A), con el case study AI-run como activo extra del listing.

## 8. Plan de cierre (Camino A — ahora, o al fallar un gate)

1. `KILL_SWITCH_PAYMENTS=true` + status `coming_soon` en experiencias (nadie más paga).
2. Honrar tokens vivos 90 días (41 sin usar, mayoría cupones $0; exposición real mínima) con mail de aviso; refund proactivo a compradores pagos de los últimos 60 días que no jugaron.
3. Congelar crons, bajar LaunchAgents, export de datos (contacts CSV, sales, contenido).
4. Empaquetar y listar en Microns/Tiny ($1–2k, precio de liquidación): 4 experiencias bilingües + player + AI story generator + cuenta IG + case study. 2–6 semanas o no se vende; si no se vende, archivar repo y apagar.
5. Post-mortem de 1 página al decision-log (qué probamos, qué aprendimos, números finales).

## 9. ⚠️ NECESITO DE VOS (para decidir)

1. **Elegí camino: A (cierre) o B (experimento con contrato de §6).** Nivel C, solo tuyo.
2. Si B: **agendá la sesión de Fase 0 dentro de los próximos 7 días** — la fecha ES la decisión.
3. Si B: ¿experimento público con tu nombre o anónimo?
4. Dato que me falta: al crear los productos vía Bokun, ¿quedó una cuenta supplier de Viator a tu nombre? (Si existe, el restart OTA es más corto y quizás conserva algo del historial.)
5. Independiente del camino: hoy el sistema cobra plata real con soporte muerto. Si no hay GO en ~1 semana, mi propuesta por defecto (Nivel B, avanzo salvo veto) es activar KILL_SWITCH_PAYMENTS hasta que decidas.
