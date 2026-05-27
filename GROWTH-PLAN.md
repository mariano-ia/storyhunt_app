# StoryHunt — Plan de Conversión (rumbo comprometido)

**Creado:** 2026-05-21
**Revisión:** 2026-06-18 (4 semanas — NO se cambia el rumbo antes de esa fecha)
**Dueño:** Mariano
**Marco:** market-funnel + market-ads (toda decisión de campaña se evalúa desde estas skills)

> Regla de oro de este documento: **un solo rumbo, sostenido 4 semanas.** Nada de
> proponer una estrategia nueva cada semana. Se mide, se aguanta, se revisa en la fecha.

---

## 1. Diagnóstico (con números, 2026-05-21)

| Capa del embudo | Dato real | Veredicto |
|---|---|---|
| Anuncios (Meta) | 250k impresiones, 7,3% CTR, $0,09 CPC | **Excelente** |
| Visitas a la landing | 7.658 lifetime / 1.377 últimos 7d | Llega tráfico |
| Ventas (Firestore) | 44 total · 12 en 7d = **1 paga + 11 gratis** | Casi todo $0 |
| **Sesiones de juego** | **21 EVER · 0 en 30 días** | **Roto** |
| Experiencias completadas | **1 en toda la historia** | **Roto** |
| Eventos al pixel | Purchase 7, InitiateCheckout 6, AddPaymentInfo 6 | Tracking OK |

**Conclusión:** el problema NO es la optimización de Meta ni que los eventos no
disparen (sí disparan). El problema es que **el embudo no transporta a nadie hasta
el producto.** La gente hace clic barato, llega y se evapora. Casi nadie juega; casi
nadie completa.

**Causas que se suman:**
1. El producto exige estar **en NYC ahora** (gate del paso 0). El público frío de IG mayormente NO está en NYC al hacer scroll.
2. Camino largo: anuncio → web de marketing → card → checkout → email → /play → jugar. Fuga en cada salto.
3. **Sin prueba social / reviews.** Productos parecidos convierten con cientos de reviews.
4. Las campañas optimizan por CLICKS, sin señal de compra/valor.
5. El pivote "founders gratis" hace que casi toda conversión sea $0 — choca de frente con "necesito ventas".

---

## 2. La decisión de fondo: VENDER (no acumular gratis)

Mariano necesita ventas, no signups gratis ni seguidores. Por lo tanto el rumbo es
**vender**, y el éxito se mide en **compradores de pago y experiencias jugadas/completadas**,
no en leads gratis ni en alcance.

---

## 3. Las 4 apuestas (en orden de prioridad)

### Apuesta 1 — Estar donde el comprador YA está: OTAs (Viator / TripAdvisor / GYG vía Bokun)
La integración con Bokun YA está hecha. En Viator/TripAdvisor la gente entra **a comprar
una actividad** en NYC, con intención y un checkout de confianza. Es el canal de mayor
ROI para vender, y choca de frente con el problema de "público frío que no compra".
- Acción: experiencias publicadas y visibles en Viator + TripAdvisor con precio, fotos, descripción.
- Acción: precio acorde al canal ($25–40, no $9,99 — en un marketplace $9,99 lee como "poco serio").

### Apuesta 2 — Construir prueba social (reviews)
Hoy ~0 reviews visibles. Es la palanca #1 de credibilidad para una experiencia de pago.
- Acción: conseguir los primeros 10–20 reviews (incluso de los founders gratis que ya jugaron) en TripAdvisor/Viator + landing.
- Esto ES "la historia" (track record visible), no branding.

### Apuesta 3 — Arreglar el camino al juego (throughput)
Que el embudo efectivamente lleve a jugar y completar.
- Acción: para pago, camino directo — anuncio → checkout de UNA experiencia faro → link de juego inmediato. Sin desvíos.
- Acción: separar dos públicos por oferta:
  - **En NYC ahora** → "jugá hoy".
  - **Planeando viaje** → "comprá ahora, jugá cuando llegues" (la activación diferida ya lo soporta). Desbloquea al turista sin que el gate lo mate.
- Acción: QA real de una experiencia faro de punta a punta (hoy 1 sola completada en la historia → si el que paga no puede terminarla, no hay reviews ni boca a boca).

### Apuesta 4 — Remarketing a los tibios (incluye founders)
Recién cuando hay oferta + reviews que mostrar.
- Acción: perseguir a quienes ya mostraron interés (vieron video, visitaron landing) y a los founders gratis, con la oferta DE PAGO + reviews + urgencia.
- Secuencia de 3 etapas (ver §5). Cap de frecuencia ~3–4/sem, creativo que progresa (no el mismo aviso 10 veces).

---

## 4. Qué se PAUSA / qué se sostiene

- **PAUSAR:** gasto de adquisición de "hunters" gratis / seguidores / awareness que no reporta ventas. (Instinto de Mariano correcto.)
- **SOSTENER:** la campaña que puede producir ventas (Conversion — Direct Sales), pero reorientada (Apuesta 3) y con presupuesto que alimente el remarketing.
- **REDIRIGIR** ese presupuesto liberado → empuje OTA + remarketing tibio.

---

## 5. La "secuencia de 3 etapas" explicada simple

No le vendés a un desconocido en el primer aviso. Es la misma persona, 3 mensajes
distintos a lo largo de días — eso es lo que significan los "7–10 contactos": 7–10
**empujones distintos**, no 10 veces el mismo aviso.

1. **Etapa 1 — Frío (te ve por primera vez):** captar atención / mostrar qué es. (Tus reels POV hacen esto.)
2. **Etapa 2 — Tibio (miró/clickeó):** generar confianza — reviews, "gente real lo hizo", responder "¿esto es en serio?".
3. **Etapa 3 — Caliente (llegó al checkout):** empujar a comprar — oferta, descuento, "jugá hoy", urgencia.

---

## 6. Sobre lookalikes y "copiar público" (respuesta directa)

- **Lookalike de compradores:** todavía NO viable — necesita ~100+ compradores semilla y hoy hay ~1 pago. Sale mal con semilla chica.
- **Lookalike viable ahora:** sobre tu lista de contactos/leads, video-viewers (¡43k lifetime!), visitantes de landing, engagers de IG. Y sobre "jugaron/completaron" cuando haya volumen. Es palanca de Fase 2 — primero arreglar throughput para tener semilla real.
- **Targetear como productos parecidos:** sí — intereses Atlas Obscura, escape rooms, teatro inmersivo (Sleep No More), scavenger hunts (Watson Adventures, Let's Roam), walking tours NYC, Secret NYC. Y copiar CÓMO convierten: venden en Viator/TripAdvisor, con reviews, a $25–40, como actividad agendable/regalable. Lección directa para Apuestas 1 y 2.

---

## 7. Métrica única (North Star) y revisión

- **North Star:** compradores de PAGO + experiencias completadas / semana. (No leads gratis, no alcance, no seguidores.)
- **Secundarias:** % landing→checkout, % checkout→jugó, % jugó→completó, primeras reviews publicadas.
- **Cadencia:** se mide semanal, se REVISA EL RUMBO recién 2026-06-18. No se pivota antes.

---

## 8. Decisiones pendientes de Mariano

- [ ] Confirmar: pausar la campaña de adquisición gratis ("hunters") y redirigir presupuesto.
- [ ] Confirmar precio de venta por canal (OTA $25–40 vs directo).
- [ ] Elegir la experiencia "faro" para el camino directo + QA end-to-end.
