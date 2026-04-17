# StoryHuntABM — CRM/Dashboard de gestión de experiencias narrativas interactivas

## Stack
- Next.js 16 + React 19 + TypeScript
- Tailwind CSS v4
- Firebase (Auth + Firestore)
- Resend (emails transaccionales)
- OpenAI GPT-4o-mini (generación AI + evaluación de respuestas)
- Lucide React (iconos SVG)

## Comandos
```bash
npm run dev       # Dev server (localhost:3000)
npm run build     # Build producción
npm start         # Servidor producción
npm run lint      # ESLint
```

## Arquitectura

### Modelo de datos (Firestore)
```
Experience
  ├── Scenes (subcollection, ordered)
  │     └── Steps (subcollection, ordered, linked by scene_id)
  ├── Steps (all steps flat, filtered by scene_id)
  └── fields: name, description, narrator_personality, narrator_avatar,
              llm_api_key, slug, mode (test/production), activation_keyword,
              status (inactive/coming_soon/published)

Access Tokens (post-payment):
  - token: "SH-XXXXXX", experience_id, lang (es/en), email
  - max_uses: 20, expires in 30 days
  - Created by Stripe webhook or /api/access/verify fallback
  - Increment happens on /play/[id] (after paywall passes), NOT on /play/t/[token] —
    this avoids email scanners (Gmail, Outlook Safe Links, etc.) consuming uses on pre-fetch

Sales:
  - Tracks purchases per experience (used for card sorting on web)

Step types:
  - interactive: espera respuesta del usuario, evalúa con LLM
  - narrative: avanza automáticamente, no espera respuesta
  - typing: solo efecto visual de "escribiendo..."
  - error_screen: pantalla negra fullscreen estilo terminal con texto glitch verde

Step features:
  - media (image/video/audio)
  - glitch_effect (animación CSS de falla)
  - interrupted_typing (efecto escribió y borró — es un toggle, NO un tipo de paso)
  - delay_seconds (pausa antes de enviar; en error_screen define la duración)
  - next_step_id (saltar a un paso específico en vez del siguiente por orden)
```

### Evaluación LLM (dual-stage)
1. **Respuesta narrativa**: el LLM responde in-character al usuario
2. **Evaluación binaria**: segundo call que evalúa si la respuesta cumple la intención esperada
- Soporta OpenAI (keys con prefijo `sk-`) y Google Gemini
- `expected_answer` es semántico/intencional, no literal (ej: "que el usuario confirme")
- `hints` y `wrong_answer_message` NO se generan desde el editor AI — el narrador los genera dinámicamente
- API key global en `.env.local` (OPENAI_API_KEY) como fallback si la experiencia no tiene key propia

### AI Story Generator (Pipeline Híbrido)
```
[Textarea: guión editorial] → [POST /api/ai-stories/generate] → [Preview editable] → [Firestore]
```
- El usuario pega un guión en lenguaje natural
- GPT-4o-mini lo convierte en JSON estructurado (Experience + Scenes + Steps)
- Preview editable: campos de experiencia + timeline de escenas/pasos con click-to-edit
- Botón "Crear experiencia" persiste todo a Firestore en batch
- Costo de generación trackeado en Firestore (interactions collection)

### Rutas principales
```
/dashboard                          → Home con stats y resumen
/dashboard/experiences              → Listado de experiencias
/dashboard/experiences/[id]         → Editor (escenas, pasos, preview inline)
/dashboard/experiences/[id]/preview → Preview completo con debug info
/dashboard/experiences/[id]/metrics → Métricas y analytics
/dashboard/ai-stories               → AI Story Generator (guión → experiencia)
/dashboard/contacts                 → Gestión de contactos (con export CSV)
/play/[id]                          → Player público (con paywall para experiencias pagas)
/play/t/[token]                     → Entrada por token (verifica y redirige a /play/[id])
/[slug]                             → Player por slug (con paywall)
/api/ai-stories/generate            → Convierte guión editorial → JSON estructurado
/api/experiences/publish             → Pipeline: normalizar + traducir + publicar
/api/experiences/[id]/preview       → Endpoint de evaluación LLM
/api/public/experiences             → API pública (published first, sorted by sales)
/api/checkout                       → Crea Stripe Checkout Session
/api/stripe/webhook                 → Webhook Stripe (crea access token + sale)
                                      Stripe Dashboard MUST point to https://storyhunt.city/api/stripe/webhook
                                      (NO www. — the www subdomain does not have Vercel rewrites)
/api/access/verify                  → Verifica access token (fallback si webhook falla)
/api/contacts                       → Recibe formulario web (JSON y form-urlencoded)
/api/cron/publish-instagram         → Vercel Cron: publica posts pendientes en Instagram
/api/cron/post-experience-email     → Vercel Cron: envía review email + cupón 24h post-experiencia
/api/cron/nurturing                 → Vercel Cron: nurturing cycle (E2 teaser, E3 social proof, E5 reminder, E7 last call)
/api/contacts                       → Recibe formulario web (JSON y form-urlencoded) + envía welcome email
```

### Transactional Emails (Resend) — Nurturing Cycle
- From: `hello@storyhunt.city` (domain verified: DKIM + SPF + DMARC)
- **E1 Welcome** (signup): welcome email sent immediately from /api/contacts
- **E2 Mystery Teaser** (+3 days): curiosity hook with NYC secrets, only if not converted
- **E3 Social Proof** (+7 days): hunter count + satisfaction %, only if not converted
- **E4 Access Link** (post-purchase): access email sent from Stripe webhook (already existed)
- **E5 Mission Pending** (+7 days post-purchase): reminder for unused tokens
- **E6 Review + Coupon** (+24h post-play): review request + THANKYOU40 40% off (already existed)
- **E7 Last Call** (+14 days post-review): final coupon reminder, then silence
- Max 7 emails per person. Purchase at any point skips pre-purchase nurturing.
- Templates in `src/lib/email-templates.ts`
- Env vars: RESEND_API_KEY, NOTIFICATION_EMAIL

### Publish Pipeline (/api/experiences/publish)
```
[Publicar y traducir] → normalize Spanish → translate to English → save _en fields → set status=published + mode=production
```
- Uses Firebase Admin SDK (bypasses Firestore rules)
- Requires env var: FIREBASE_SERVICE_ACCOUNT_KEY (full JSON service account)
- Can re-run on already published experiences to re-translate after edits
- Sets both `status: 'published'` and `mode: 'production'`

### Paywall (play routes)
- /play/[id] and /[slug] check if experience has `price > 0`
- If paid, requires `?token=SH-XXXXX` query param with valid access token
- Token verified via /api/access/verify
- Test mode (`mode === 'test'`) bypasses paywall
- Free experiences (price === 0 or no price) work without token

### Deploy
- Vercel: storyhunt-app.vercel.app
- Auto-deploy desde GitHub main branch
- Env vars requeridas: OPENAI_API_KEY, FIREBASE_SERVICE_ACCOUNT_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, RESEND_API_KEY, INSTAGRAM_ACCESS_TOKEN, CRON_SECRET

### Vercel Crons (vercel.json)
- `/api/cron/publish-instagram` — Mon-Fri 11:15 AM NYC — publica TODOS los posts pendientes hasta hoy
- `/api/cron/post-experience-email` — Daily 10 AM NYC — review email + THANKYOU40 coupon
- `/api/cron/nurturing` — Daily 10:30 AM NYC — nurturing emails (E2, E3, E5, E7)
- Lee social-calendar.json del repo StoryHuntWeb en GitHub
- Env vars requeridas: INSTAGRAM_ACCESS_TOKEN, CRON_SECRET
- Repo: github.com/mariano-ia/storyhunt_app
- Repo: github.com/mariano-ia/storyhunt_app

## Estructura de archivos
```
src/
  app/
    dashboard/
      ai-stories/            → AI Story Generator (guión → experiencia)
      contacts/              → Gestión de contactos desde la web (export CSV)
      experiences/           → CRUD experiencias
      experiences/[id]/      → Editor con escenas, pasos, preview inline
      experiences/[id]/preview/ → Preview completo
      experiences/[id]/metrics/ → Métricas y analytics
      sessions/              → Sesiones activas de usuarios
      interactions/          → Historial de interacciones IA
      settings/              → Configuración
      users/                 → Gestión de usuarios admin
    api/
      ai-stories/generate/   → Endpoint de generación AI
      contacts/              → API contactos (web form + JSON)
      experiences/           → API experiencias
      experiences/[id]/preview/ → Evaluación LLM
      cron/nurturing/         → Nurturing cycle cron (E2, E3, E5, E7)
      sessions/              → API sesiones
      users/invite/          → Invitación de usuarios
    play/[id]/               → Player público
    [slug]/                  → Player por slug
    login/                   → Login con Firebase Auth
  components/
    Sidebar.tsx              → Navegación lateral (colapsable, tooltips, underline active)
    Topbar.tsx               → Barra superior (breadcrumbs, theme toggle)
    ConfirmModal.tsx         → Modal de confirmación reutilizable
  lib/
    firebase.ts              → Configuración Firebase client
    firebase-admin.ts        → Admin SDK (auth + Firestore admin writes)
    auth.tsx                 → Context de autenticación
    firestore.ts             → Queries a Firestore (CRUD + createExperienceFromAI batch)
    email-templates.ts       → Templates HTML del ciclo de nurturing (E1-E7)
    llm.ts                   → Módulo LLM compartido (OpenAI + Gemini, JSON mode)
    types.ts                 → Tipos TypeScript (incluye AIGeneratedExperience)
```

## Proyecto relacionado
- **StoryHuntWeb** (../StoryHuntWeb): sitio estático de marketing en storyhunt.city
- El formulario de contacto de la web POST a /api/contacts de este ABM
- La web consume /api/public/experiences para las cards (proxy via vercel.json rewrites)
- Checkout: card → modal idioma (EN/ES) → Stripe → webhook crea token → email con link
- Son repos separados con deploys independientes

## Convenciones
- UI: Fira Code (headings) + Fira Sans (body)
- Iconos: Lucide React (nunca emojis como iconos funcionales)
- Tema: light/dark mode con toggle, light mode debe cumplir WCAG AA (4.5:1 contraste mínimo)
- Preview inline: usar ruta /play/[id] en iframes (fuera del layout del dashboard)
- Sidebar: colapsada por defecto, se expande con hover, iconos centrados con underline violeta
- Tooltips: usar `data-tip` attribute (CSS custom tooltips, no `title` nativo)
- Step cards: borde de color según tipo (purple=interactive, cyan=narrative, red=error_screen)
- Acciones de paso: barra inferior con iconos + tooltips (glitch, escribió-y-borró, play, editar, eliminar)
- "Costo IA" en vez de "Costo LLM" en toda la UI
- activation_keyword: campo legacy, removido de la UI (se controlará por Stripe/acceso)
- Crear pasos: optimistic update sin recarga de página
- Mostrar cambios en localhost antes de pushear
