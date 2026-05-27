# Auditoría de Flujo + Experiencias — StoryHunt

**Fecha:** 2026-05-21
**Alcance:** anuncio → landing → checkout → email → /play → juego → completar. Técnico + UX + las 4 experiencias.
**Regla:** este informe NO cambia nada. Solo diagnostica y recomienda.
**Datos:** extraídos en vivo de Firestore + auditoría del código del player.

---

## 0. El número que manda

| Capa | Real |
|---|---|
| Impresiones (lifetime) | 250.000 |
| Visitas a landing | 7.658 |
| **Sesiones de juego (EVER)** | **21** |
| **Completadas (EVER)** | **1** (Village Sessions) |
| Gasto | $1.105 |

**Dónde mueren las 21 sesiones:** la enorme mayoría en **`step = 0`**, que es el gate sintético "¿estás en NYC ahora?". Las que avanzaron tienen `in_nyc = yes`. Las que dijeron "no" quedaron en `awaiting_arrival`. **El cuello no es el juego — es la puerta de entrada.** Casi nadie cruza el step 0.

---

## 1. Dónde se rompe el flujo (técnico + UX, priorizado)

### BLOCKERS (mata silencioso)
- **Spinner infinito.** `play/[id]/page.tsx:559` — el `Promise.all([getExperience, getSteps, getScenes])` NO tiene `.catch()`. Si una sola lectura de Firestore falla (red móvil inestable, navegador in-app de Instagram, bloqueadores), el usuario queda en spinner para siempre, sin error ni reintento. Tráfico IG móvil = justo donde esto pasa.
- **El gate de NYC corre ANTES de cualquier valor, para TODOS** (`page.tsx:735-749`), incluido el que ya pagó. Lo primero que vive un comprador es un interrogatorio ("¿estás acá ahora?"), no el producto. Para tráfico frío (mayoría no está en NYC) = rebote garantizado en step 0 sin ver una sola línea de historia. **Es la fuga estructural #1.**
- **Paywall negro sin salida.** `page.tsx:579-587, 907-955` — abrir una experiencia paga sin token (card, link directo, o si el redirect pierde el `?token=`) cae en pantalla negra "Access required". Curioso o comprador con link viejo = dead-end, sin muestra gratis ni recuperación.

### ALTO
- **Input confuso en el gate.** En el primer turno del gate hay botones Sí/No, pero la caja de texto sigue editable y **lo que tipeás se descarta** (`handleSend` corta para la fase `'asking'`, `page.tsx:763-768`). El que escribe "yes" y manda, no pasa nada. Parte del cementerio de step 0 puede ser esto.
- **Camino largo multi-pantalla.** email → pantalla "Verifying access" → interstitial "Your hunt is ready" + botón START → activación → spinner → gate NYC (con animación de tipeo) → respuesta narrador → recién ahí la historia. ~4 pantallas + 2 taps obligatorios + varias pausas artificiales antes del primer contenido. Cada salto pierde gente.
- **"No" sin vuelta atrás.** Responder "no" (o unclear→no) cierra la sesión a `awaiting_arrival` sin botón de recuperación: si tocaste mal, o estás "a punto de llegar", quedaste afuera (`page.tsx:343-358`).
- **Lockout de token.** A las 20 usos el token muestra dead-end con solo un mailto; el incremento corre en cada entrada a `/play/[id]`, y si la sesión no matchea por email se consume rápido (`page.tsx:628-632`).
- **Activación diferida se dispara en el link de email**, no solo en el botón Start (`api/access/verify/route.ts:157-167`): el reloj de 30 días puede arrancar sin que el usuario lo decida — rompe la promesa "el reloj arranca cuando empezás".

### MEDIO
- **Delays artificiales de tipeo** (1–1.5s+ por mensaje, 3s en interrupted) encadenados en la apertura → se siente "lento/colgado" justo cuando hay que enganchar.
- **Input fijo abajo + teclado iOS:** sin manejo de `visualViewport`; el teclado puede tapar la caja al responder.
- **Media sin `playsInline`/`muted`:** en iOS el video puede irse a pantalla completa al tocar o no autoreproducir.
- **Errores hardcodeados en español** en chat inglés ("Ups, no se pudo enviar el mensaje", "Chat no encontrado") y, peor, el fallo de conexión del LLM NO avanza el paso → soft dead-end a mitad de historia (`page.tsx:851-854`).
- **Métrica de "completado" subcontada:** completar exige responder un paso final de rating; quien cierra antes no cuenta. Parte del "1 completada" es artefacto de medición.

### Verificado y DESCARTADO (no es un problema)
- **Orden de la narrativa en el player:** el player ordena por escena (`order` de escena) y dentro por paso (`page.tsx:413-424, 564`). Las experiencias se juegan en el orden correcto. (El editor/preview puede mostrarlas desordenadas — cosmético, no afecta al jugador.)

---

## 2. Las 4 experiencias

| Experiencia | Estado | Pasos | Escenas | EN | Bokun | Veredicto |
|---|---|---|---|---|---|---|
| **Brooklyn Bridge's Architect** (`architect`) | published | **38** | 6 | sí | 1218431 | **Faro.** La más corta y redonda. Recorrido coherente Bowling Green → Charging Bull → Standard Oil → Trinity (tumba Hamilton) → Federal Hall → Puente. Apertura fuerte (Emily Roebling narradora). |
| **The Village Sessions** (`the-village-sessions`) | published | 63 | 7 | sí | 1218444 | La **única completada**. Narrativa atmosférica (músico fantasma del Village). Buena, algo más larga. |
| **The Midtown Protocol** (`the-midtown-protocol`) | published | **122** | 6 | sí | 1218385 | **Demasiado larga** para formato chat — alto riesgo de abandono por fatiga. Apertura conceptual/abstracta (IA urbana) menos enganchadora que Architect. |
| **The Central Park Shepherd** (`central-park-shepherd`) | **coming_soon / test** | 117 | 8 | **no** | — | Sin terminar, sin traducir, no publicada. Decidir: terminar o archivar. |

### Recomendaciones de producto (sin tocar nada)
1. **Tu instinto es correcto: el faro es el Architect.** Es la más corta (38 pasos ≈ caminata real de ~1.5-2h), la más redonda y con mejor hook. Apuntá TODO ahí (ad, ficha OTA, reviews, influencers).
2. **Demasiados pasos "interactivos" que aceptan cualquier respuesta** ("no importa la respuesta, avanzamos" / "que confirme que llegó"). Obligan a tipear algo vacío para avanzar = fricción sin recompensa. *Recomendación:* convertir los "confirmá que llegaste" / "cualquier respuesta" en auto-avance o botón, y reservar la evaluación LLM para observaciones reales (contar columnas, leer la lápida). Hace el juego más fluido.
3. **Doble portería al inicio.** El gate del player ya pregunta "¿estás en NYC?" y enseguida el paso 1 del Architect vuelve a pedir "confirmá que llegaste a Bowling Green". Dos confirmaciones de ubicación antes del primer gancho. *Recomendación:* fusionar — que el primer beat sea historia/gancho, no otra portería.
4. **Notas de evaluación en español, experiencia en inglés.** `expected_answer`, `hints`, `wrong_answer_message` están en español aunque se vende en inglés. Funciona (el LLM es bilingüe) pero conviene revisar consistencia para que la evaluación no se vuelva errática.
5. **`review_links` vacío en las 4.** Sin esto, el email E6 va en modo cupón y las fichas OTA no enlazan reviews. *Cargar apenas haya reviews.*
6. **Midtown:** si se mantiene, recortarla fuerte (122→~50). Es la menos lista para mostrar a un influencer.

---

## 3. Conversión y ads (respuestas concretas)

### "¿Cómo hago que el click sea más caro pero convierta?"
Un click que convierte = **(intención de la persona) × (claridad + confianza del destino).** Hoy comprás el click más barato (= menor intención) y el destino termina en pared. Soluciones concretas:
1. **El creativo pre-filtra.** Poné en el aviso: precio + "tenés que estar en NYC" + "caminata de 2 horas por calles reales". Espanta al scroller ocioso y atrae al calificado → menos clicks, más caros, mejores.
2. **Cambiar la optimización** (cuando el flujo esté arreglado): de CLICKS baratos → a **InitiateCheckout** (el evento ya dispara). Meta sale a buscar gente de mayor intención, click más caro pero comprador.
3. **Cambiar de canal a intención:** Google Search (long-tail) + Viator (compradores in-market). Clicks más caros que convierten porque la persona está comprando.
4. **Audiencia:** intención de viaje / interés en escape rooms+tours; lookalike de video-viewers (43k); excluir engagers puros de contenido.
5. **No regalar el premio emocional en el feed:** dejar un loop abierto que obligue a entrar. Y en el destino: reviews + "qué hacés exactamente" + un CTA + una **muestra gratis de 60s** para el curioso (paso de bajo compromiso).
6. **Verdad de secuencia:** un click caro que convierte se DESPERDICIA hasta arreglar el gate de step 0 + el spinner + el paywall. **Arreglar flujo PRIMERO, después comprar intención.**

### ¿Por qué pausar también "Direct Sales"?
Porque meter tráfico pago a un embudo que rebota a casi todos en step 0 es tirar plata a un balde agujereado, y peor: optimizar sobre eso le enseña a Meta a buscar gente que NO convierte. *Recomendación:* pausarla también hasta que (a) estén los fixes del flujo y (b) lleguen las primeras reviews. Después relanzar con objetivo de conversión + creativo calificado + landing arreglada.

### Google Search con presupuesto bajo — a priori
- Términos cabeza ("things to do in NYC") = caros y competidos → con presupuesto chico, invisible. **No.**
- Long-tail ("nyc scavenger hunt", "interactive nyc walking tour", "unusual nyc date") = más baratos y ultra-calificados → test chico ($5-10/día) **viable, pero DESPUÉS de que la landing convierta.** No ahora.

### Seguidores como social proof
Válido: una cuenta con muchos seguidores ES prueba social. Los reels orgánicos (serie POV) + eventualmente un empuje chico de seguidores construyen ese activo **en paralelo** a las reviews. Complementa, no reemplaza.

---

## 4. Plan de acción ANTES de los influencers (prioridad)

El influencer llega en ~1 semana y el producto tiene que estar perfecto. Orden:

1. **Arreglar el gate de step 0** (la fuga #1): que el comprador NO sea interrogado antes de ver valor; arreglar el input que descarta texto; dar salida al "no"/"me equivoqué".
2. **Arreglar el spinner infinito** (`.catch` + estado de error con reintento).
3. **Acortar el camino email→juego** (sacar pantallas/pasos intermedios; arrancar la historia más rápido).
4. **QA real del Architect de punta a punta en celular**, como usuario desde un ad, en NYC.
5. **Suavizar el paywall** (muestra gratis / recuperación de link).
6. Recién entonces: definir presupuesto y reactivar / relanzar ads con intención.

---

## 5. Decisiones pendientes de Mariano
- [ ] ¿Pauso también "Direct Sales" hasta tener los fixes + primeras reviews?
- [ ] ¿Confirmás el Architect como faro único?
- [ ] Central Park Shepherd: ¿terminar o archivar?
- [ ] Tras los fixes: definir presupuesto (Meta reactivada / Google long-tail test / empuje de seguidores).
