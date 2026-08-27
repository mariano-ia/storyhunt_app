# Viator — Paquete de submission: The Midtown Protocol (paste-and-go)

**Para la sesión Fase 0 de Mariano (deadline 2026-09-03).** Tiempo estimado: 60–90 min si no existe cuenta previa; ~40 min si existe. Todo el texto está listo para pegar. Lo que requiera decisión está marcado 🔶.

---

## Paso 0 — ¿Ya existe cuenta supplier de Viator? (5 min)

Buscá en tu email (todas las casillas): `from:viator` y `supplier.viator.com`. Si Bokun creó los productos contra una cuenta supplier tuya, ahí están las credenciales — **entrá por ahí y saltá a Paso 2** (posiblemente conserve los productos viejos). Si no hay nada: Paso 1.

## Paso 1 — Crear cuenta supplier (15 min)

- URL: https://supplier.viator.com/sign-up-info
- Gratis. Un rep contacta en ~48h — **respondé rápido** (los delays de onboarding vienen de ahí).
- Datos: Business name **StoryHunt** · Web **storyhunt.city** · Tipo: tour operator, self-guided activities · NYC, USA.
- 🔶 Email de la cuenta y de notificaciones de reserva: usar **hello@storyhunt.city** (Workspace) — necesito poder leer esa casilla (o forwarding a tu Gmail) para automatizar el fulfillment: email de reserva → token de acceso → email al cliente. Sin eso, cada reserva requiere acción manual tuya.

## Paso 2 — Submit del producto (30–40 min, fee $29 con tu tarjeta → ledger: queda $471 de $500)

**Título:** `The Midtown Protocol: Self-Guided Mystery Walk Through Hidden Midtown`

**Categoría:** Self-guided Tours / Scavenger Hunts · **Duración:** 2 hours · **Idiomas:** English, Spanish

**Descripción** (pegar tal cual — es la voz de marca ya escrita):
> [pegar el contenido completo de `marketing-review/bokun-copy-midtown.txt` — está en este mismo directorio]

**Itinerario / stops:** Grand Central Terminal (start) → Whispering Gallery → New York Public Library (Patience & Fortitude) → Bryant Park → Midtown side streets (end: Bryant Park area).

**Meeting/starting point:** Grand Central Terminal, Midtown Manhattan (el jugador arranca desde el link, sin encuentro físico — marcar como self-guided / no meeting required si el form lo permite).

**Qué incluye:** Interactive story experience on your phone (chat-based) · One access link for your whole group (up to 8 players) · Available in English and Spanish · Play at your own pace — pause and resume anytime.
**No incluye:** Transportation · Food and drinks · Mobile data.

**Logística (el algoritmo premia esto):**
- Instant confirmation: **ON** · Mobile ticket: **ON**
- Cutoff: el mínimo que permita (0–12h) — producto digital, sin capacidad física
- Disponibilidad: todos los días, todo horario (self-guided)
- Cancelación: standard 24h full refund

**Precio:** 🔶 recomendación COO: **$19.99 por grupo (hasta 8)** de arranque (siembra de volumen → reviews), subir a $25–29 al llegar a 10+ reviews. A $9.99 con comisión 20–30% el neto es ~$7 y "lee barato" en marketplace. Decisión tuya en la sesión; quede la que quede, la logueo.

**Fotos (mínimo 6 horizontales — convierte ~40% mejor):** gritty, street-level, NUNCA postal/Times Square/skyline. Fuentes: assets de StoryHuntWeb (`assets/`), feed de @storyhunt.city, o stock Unsplash/Pexels ("Grand Central interior", "Bryant Park dusk", "NYPL lions", "Manhattan side street"). Si me decís GO las curo yo y te dejo carpeta lista antes de tu sesión.

## Paso 3 — Mientras estás logueado (10 min)

- Anotar/pasarme: **supplier ID** y cualquier API/notification setting que ofrezca el panel (para el pipeline de fulfillment).
- Si el panel ofrece **Intro Offer / new product promo**: activarla (placement especial para listings nuevos).

## Paso 4 — Tokens y decisiones (15 min, en la misma sesión)

1. **Renovar INSTAGRAM_ACCESS_TOKEN** (vencido 2026-07-19): Meta Business Suite → generar token con `instagram_content_publish` + `instagram_manage_insights` → pegarlo en Vercel env + `.env.local`. Habilita publicación IG gratis vía el pipeline existente (sin Blotato).
2. 🔶 **¿Experimento público con tu nombre o anónimo?** (bloquea el motor narrativo O4).
3. 🔶 **Delegación de refunds ≤$20:** política escrita no-questions-asked; yo la ejecuto vía Stripe y la logueo, vos solo ves el digest. ¿Autorizás?

---
*Preparado por Claude (COO) 2026-08-27 · Contrato: AI-STARTUP-DECISION.md §6 · Al completar Fase 0 se marca KR2.1 en company-os/objectives.json*
