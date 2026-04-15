---
name: storyhunt-qa
description: Use when the user asks to run QA, verify the platform works end-to-end, audit the stack, or check "everything". Performs an exhaustive 8-phase audit covering code patterns, environment, runtime smoke tests, end-to-end funnel, data reconciliation, observability, geographic delivery, and a final pass/fail report.
---

# StoryHunt — Deep QA

## When to use

Invoke when the user says any of:
- "run QA", "correr QA", "auditar todo", "revisá todo"
- "verify the platform works", "chequear que todo funciona"
- "did anything break", "se rompió algo"
- Before a major launch, campaign change, or after a big refactor
- After any incident — to confirm the fix holds and no regression surfaced

This skill performs EVERY check below. **Do not skip phases.** Every phase catches a different class of failure. Skipping one means the next incident is silently waiting in that gap.

## Core principle

**Silent failures are the enemy.** Every bug StoryHunt has hit in production was a silent failure that ran for days or weeks before anyone noticed: client Firestore SDK writes swallowed by `.catch(() => {})`, rules deployed out of sync, cron jobs that stopped firing, pixel events missing, geo targeting leaking. A good QA run converts silent failures into loud ones.

**Output a clear report at the end.** Not a pass/fail boolean — a structured table: 🟢 Green (passing), 🟡 Yellow (suspicious, investigate), 🔴 Red (broken, fix now). The user needs to be able to glance at it and know what to do next.

---

## Before you start

Confirm with the user:
- **"Qué tan profundo querés el QA? (a) Estáticas solamente — 2 min, (b) Estáticas + runtime smoke — 5 min, (c) Completo con end-to-end funnel real — 15 min pero toca producción creando contacts/sessions de prueba."**
- If no answer, default to **(b)**.
- Option (c) requires explicit consent because it writes test data to Firestore and Stripe (test mode).

## Prerequisites (verify before starting)

- [ ] `CRON_SECRET` available locally (`.env.local`) — needed for `/api/debug/*` endpoints
- [ ] `STRIPE_SECRET_KEY` available locally — needed for Stripe API queries
- [ ] The deployed site `https://storyhunt-app.vercel.app` responds to `/api/public/experiences` with 200
- [ ] Current git branch is clean or has expected changes

If any prerequisite fails, stop and ask the user to fix before continuing.

---

## PHASE 1 — Static code audit

Purpose: catch the exact bug patterns that have bitten StoryHunt before they ship.

### 1.1 Server-side Firestore client-SDK usage (CRITICAL)

Every StoryHunt production outage so far came from an API route using `firebase/firestore` client SDK server-side against rules that require auth. Find all of them.

```
Grep pattern: "from '@/lib/firebase'|from 'firebase/firestore'"
Path: src/app/api
Expected: NO matches except inside files that also import getAdminDb
```

Then check which `@/lib/firestore` functions use the client SDK and are called from API routes:

```
Grep pattern: "from '@/lib/firestore'"
Path: src/app/api
For every hit, open the file and check which firestore.ts function is imported.
Cross-reference with src/lib/firestore.ts — if the function does addDoc/setDoc/updateDoc/deleteDoc, it's a server-side client-SDK write = RED.
```

Known safe reads (rules allow `read: if true` for these collections): `experiences`, `scenes`, `steps` (subcollections of experiences). Reads of other collections server-side are suspect.

**Anything found here = 🔴 RED. Report immediately and stop the phase to discuss remediation.**

### 1.2 Silent error swallowing

```
Grep pattern: "\.catch\(\(\) => \{\}\)|\.catch\(\(\) => null\)|\.catch\(\(\) => undefined\)"
Path: src/
Expected: Zero in API routes. Allowed in client code only if the failure is truly non-critical AND there is a user-visible fallback.
```

For each hit, classify:
- 🔴 RED: swallow in API route or hot code path with no fallback
- 🟡 YELLOW: swallow in client code with a fallback
- 🟢 GREEN: swallow in a fire-and-forget side effect (analytics, cost logging) with a TODO and console.warn

### 1.3 Unhandled async in event handlers

```
Grep pattern: "onClick=\{[^}]*async"
Path: src/app
```

Async handlers without try/catch = uncaught rejection = potentially silent. Verify each has error handling.

### 1.4 Hardcoded language strings in shared components

After the `/play/t/[token]` i18n bug, check for hardcoded Spanish or English in files that serve both languages.

```
Grep pattern: "(Volver|Cargando|Verificando|Error|Invalid|Loading|Back to)"
Path: src/app/play src/app/[slug] src/app/start
```

For each match, confirm the string is gated by the `lang` variable. If not = 🟡 YELLOW.

### 1.5 Environment variable usage consistency

```
Grep pattern: "process\.env\."
Path: src/
```

For every env var referenced, confirm:
- It exists in `.env.local.example` (so other devs know it's needed)
- It has a safe default or explicit 500 error if missing
- It's NOT logged to console

Missing from `.env.local.example` = 🟡 YELLOW.

### 1.6 TypeScript errors

```
Run: node_modules/.bin/tsc --noEmit -p tsconfig.json
Expected: Zero errors.
```

Any TS error = 🔴 RED. Stop and fix before continuing.

### 1.7 ESLint

```
Run: npm run lint
Expected: Zero errors and zero warnings (or documented exceptions).
```

---

## PHASE 2 — Environment and config audit

Purpose: confirm the deployed runtime has what it needs.

### 2.1 Local vs deployed env vars

Read `.env.local.example`. For every variable listed, verify:
- Present in `.env.local` (locally)
- Present in Vercel env vars — no direct API access, but test by hitting an endpoint that uses it:
  - `FIREBASE_SERVICE_ACCOUNT_KEY` → hit `/api/debug/reconcile?secret=...&days=1`, expect 200 with counts
  - `STRIPE_SECRET_KEY` → hit Stripe API from local with the key, expect 200
  - `OPENAI_API_KEY` → check recent `interactions` collection writes exist
  - `RESEND_API_KEY` → check welcome_email_sent flags on recent contacts
  - `META_ADS_ACCESS_TOKEN` → hit `/api/debug/geo?secret=...`, expect 200
  - `CRON_SECRET` → hit any `/api/debug/*` endpoint, expect 200 (403 means wrong secret)
  - `STRIPE_WEBHOOK_SECRET` → no direct test, but verify Stripe webhook delivery in phase 4

### 2.2 firestore.rules deployment status

The repo's `firestore.rules` can diverge from what's actually deployed. There is NO direct API to diff. Proxy checks:
- `rules_version = '2'` in repo file
- Check git log for recent rules changes: `git log --oneline -5 firestore.rules`
- If the repo rules allow `create: if true` for `contacts` but `/api/contacts` uses Admin SDK (it does, as of this writing), that's fine — Admin bypasses rules.
- Any server-side code using client SDK for writes to collections the repo rules restrict = 🔴 RED (rules mismatch risk).

Flag this: **"Rules may not be deployed; Admin SDK usage is the safety net. Verify every server write goes through Admin SDK (Phase 1.1 already covers this)."**

### 2.3 Vercel crons active

```
Read: vercel.json
```

Confirm each cron entry:
- Has a valid cron expression
- Points to an existing route
- The route checks `CRON_SECRET` via Authorization header

Expected crons:
- `/api/cron/publish-instagram` — Mon-Fri 11:15 AM NYC
- `/api/cron/post-experience-email` — Daily 10 AM NYC
- `/api/cron/nurturing` — Daily 10:30 AM NYC
- `/api/cron/campaign-report` — Daily 9 AM NYC

Any cron in vercel.json without a corresponding route = 🔴 RED.
Any route matching `/api/cron/*` not in vercel.json = 🟡 YELLOW.

### 2.4 Stripe webhook URL

Query Stripe for registered webhook endpoints:

```
curl -s https://api.stripe.com/v1/webhook_endpoints -u "${STRIPE_SECRET_KEY}:" | python3 -m json.tool
```

Verify one exists pointing to `https://storyhunt-app.vercel.app/api/stripe/webhook` with events `checkout.session.completed` (minimum). If missing = 🔴 RED, manual sales will not create access tokens.

---

## PHASE 3 — Runtime smoke tests (deployed endpoints)

Purpose: every public route returns the expected shape with known-good input.

Hit each in sequence. Expected: 200 + valid JSON shape.

### 3.1 Public API

```
curl -s https://storyhunt-app.vercel.app/api/public/experiences | python3 -c "import json, sys; d=json.load(sys.stdin); assert isinstance(d, list), 'expected list'; print(f'{len(d)} experiences')"
```

Expected: non-empty array with each item having `id, name, slug, web_tagline, web_description, price`. Empty = 🔴 RED (home page broken).

### 3.2 Checkout endpoint (without coupon)

```
curl -s -X POST https://storyhunt-app.vercel.app/api/checkout \
  -H "Content-Type: application/json" \
  -d '{"experience_id":"<pick a real one>","lang":"en"}'
```

Expected: 200 with `{url: "https://checkout.stripe.com/..."}`. Any 4xx/5xx = 🔴 RED.

Then do it again with `lang: "es"` and verify the resulting Stripe session has the description in Spanish (query `/v1/checkout/sessions/{id}` and inspect `line_items.data[0].price_data.product_data.description`).

### 3.3 Access verify endpoint

```
curl -s -X POST https://storyhunt-app.vercel.app/api/access/verify \
  -H "Content-Type: application/json" \
  -d '{"token":"SH-NONEXISTENT"}'
```

Expected: 404 with `{error: "Token not found"}`. If 500 = 🔴 RED (route or Admin SDK broken).

### 3.4 Contacts endpoint

```
curl -s -X POST https://storyhunt-app.vercel.app/api/contacts \
  -H "Content-Type: application/json" \
  -d '{"email":"qa-test@example.com","source":"qa-skill-smoke"}'
```

Expected: 200 with `{success: true}`. Then verify the row appears in Firestore (next phase). If 500 = 🔴 RED (lead magnet funnel is broken).

**This write is a side effect of the QA run.** The user should be warned and the test contact should be flagged in the report for cleanup.

### 3.5 Diagnostic endpoints

```
curl -s "https://storyhunt-app.vercel.app/api/debug/reconcile?secret=${CRON_SECRET}&days=7"
curl -s "https://storyhunt-app.vercel.app/api/debug/geo?secret=${CRON_SECRET}&date_preset=last_7d"
```

Both must return 200 with valid JSON. Any 403 = secret mismatch (not necessarily broken but blocks QA). 500 = 🔴 RED.

### 3.6 Landing pages render

```
curl -s -o /dev/null -w "%{http_code}" https://storyhunt.city/secrets
curl -s -o /dev/null -w "%{http_code}" https://storyhunt.city/intercepted
curl -s -o /dev/null -w "%{http_code}" https://storyhunt.city/voicemail
curl -s -o /dev/null -w "%{http_code}" https://storyhunt.city/start
```

All must return 200. Any 404/500 = 🔴 RED.

### 3.7 Dashboard auth-gate

```
curl -s -o /dev/null -w "%{http_code}" https://storyhunt-app.vercel.app/dashboard
```

Expected: 200 (page shell loads, client-side auth redirects). If 500 = 🔴 RED (build broken).

---

## PHASE 4 — End-to-end funnel test (requires user consent)

Purpose: simulate a real user going through the entire journey and verify EVERY side effect fires.

**Only run if the user confirmed Option (c).** This writes real test data to Firestore and creates a real (test-mode) Stripe session.

### 4.1 Lead magnet submission

1. POST to `/api/contacts` with `{email: "qa-e2e-${timestamp}@storyhunt-qa.test", source: "qa-e2e-secrets"}`
2. Hit `/api/debug/reconcile?days=1` and confirm:
   - The contact exists in `contacts` collection
   - `welcome_sent: true` flag is set
3. Verify Resend dashboard (manual — provide user with link) that the welcome email went out
4. Verify Meta Events Manager received a `Lead` event from CAPI for that source URL

Any missing side effect = 🟡 YELLOW (something in the chain is flaky) or 🔴 RED (broken).

### 4.2 Checkout → webhook → access token

1. POST to `/api/checkout` with a real experience and `lang: en`
2. Grab the session URL, extract session ID (`cs_...`)
3. Use Stripe test card `4242 4242 4242 4242` in the Checkout page (manual step unless automated with Playwright)
4. Hit `/api/debug/reconcile?days=1` and confirm:
   - A row in `sales` with that session_id
   - A row in `access_tokens` with that session_id
   - The access token has `times_used: 0` and `status: active`
5. Verify the access link email went out (Resend dashboard)

**If the Stripe webhook doesn't fire** but the row appears via `/api/access/verify` fallback, flag as 🟡 YELLOW — the fallback is the safety net but the webhook being broken means future emails won't send.

### 4.3 Play flow

1. Hit `/play/t/{cs_session_id}` — verify the page loads without error
2. Confirm it redirects to `/play/{experience_id}?token=SH-...&lang=en`
3. On the player page, send one message to progress through the story
4. Hit `/api/debug/reconcile?days=1` and confirm:
   - A row in `user_sessions` with `status: in_progress`
   - `times_used: 1` on the access token
   - A row in `interactions` if the first step was interactive

Missing user_session row = 🔴 RED (the exact bug from 2026-04-14 has regressed).

### 4.4 Paywall enforcement (fail-closed check)

1. Hit `/play/{paid_experience_id}` WITHOUT a token
2. Verify the paywall blocks with the "Access Required" message
3. Hit the same URL with a known-invalid token `SH-INVALID99`
4. Verify the paywall blocks with "Invalid Access"

Either case failing open = 🔴 RED (massive exposure — free play of paid content).

### 4.5 Cleanup

Delete the test contact, sale, access token, and user_session created in 4.1–4.3 via `/api/debug/cleanup-qa-test` (if it exists) OR list them in the final report for manual deletion.

---

## PHASE 5 — Data reconciliation

Purpose: catch orphans, dangling records, and counter drift that suggest silent data loss.

### 5.1 Sales vs sessions

```
curl -s "https://storyhunt-app.vercel.app/api/debug/reconcile?secret=${CRON_SECRET}&days=14"
```

Check `sales_without_matching_session`:
- 0 = 🟢 GREEN
- 1-3 = 🟡 YELLOW (investigate — may be legitimate no-show buyers)
- 4+ in the last 14 days = 🔴 RED (session tracking likely broken)

### 5.2 Access tokens without usage

Check `unused_access_tokens`:
- >50% unused in last 14 days = 🟡 YELLOW (buyers aren't using their tickets — email deliverability issue? UX issue?)
- >80% unused = 🔴 RED (something is preventing play)

### 5.3 Contacts vs Meta Lead events

Meta Events Manager records `Lead` events from the Conversions API. Count should match contacts created. If Meta count < contacts count by more than 10% = 🟡 YELLOW (CAPI is flaky). If zero = 🔴 RED (CAPI broken).

This check can't be fully automated without Meta API scope. Provide the user with the Events Manager URL and ask them to verify.

---

## PHASE 6 — Observability audit

Purpose: confirm we can see what's happening.

### 6.1 Recent error log review

Vercel logs can't be queried without a token, but we can infer errors from 500 response counts. Query a few deployed endpoints and count 500s over a window. If any endpoint consistently returns 500 for known-good input = 🔴 RED.

### 6.2 Cron execution history

Query each cron endpoint's last successful execution timestamp. Most crons write a log marker. If `/api/cron/nurturing` hasn't run in >36h, 🔴 RED.

### 6.3 Pixel fire rate

For each landing, verify the Meta Pixel loads and the `PageView` event fires. Use `curl -s <url> | grep -c "fbevents.js"` as a proxy. Any landing without pixel = 🔴 RED.

---

## PHASE 7 — Geographic delivery audit (ads)

Purpose: confirm Meta isn't leaking impressions to unintended geos (the 43%-to-Canada incident from 2026-04-15).

```
curl -s "https://storyhunt-app.vercel.app/api/debug/geo?secret=${CRON_SECRET}&date_preset=last_7d"
```

For each campaign, compare actual `by_country` breakdown against the intended targeting (read from `/api/debug/setup-geo-test?dry_run=1` to see current targeting spec).

Rules:
- Ad set says US only → US should be >90% of impressions, any non-US >5% = 🟡 YELLOW, >15% = 🔴 RED
- Ad set says US+CA+GB+AU → US should be >40%, Canada <40%, UK <20%, AU <20% — otherwise = 🟡 YELLOW
- Ad set says NYC Locals → New York region should be >70% of impressions, anything else in non-adjacent regions (not NJ/CT/PA) = 🔴 RED

Also check `top_regions` to confirm the NYC Locals ad set isn't delivering to Ontario or England.

---

## PHASE 8 — Final report

Output ONE table for the user. Group by severity. Each row has: check name, status (🟢🟡🔴), what was observed, and next action.

Format:

```
## QA Report — <ISO timestamp>

### 🔴 Critical (fix now)
| Check | Observed | Action |
|---|---|---|
| Phase X.Y | ... | ... |

### 🟡 Watch (investigate)
| Check | Observed | Action |
|---|---|---|

### 🟢 Passing
| Check | Observed |
|---|---|
| Phase 1.1 Server-side SDK audit | 0 matches |
| Phase 1.2 Silent catches | 0 in API routes |
| ... |

### Side effects of this QA run
- Test contact created: qa-test@example.com (Firestore id: ...)
- Test Stripe session: cs_test_... (status: unpaid, safe to ignore)
- Test user_session: ... (cleanup recommended)

### Recommended cadence
- Run Phase 1 + 2 (static + config) — every commit to main
- Run Phase 3 (runtime smoke) — every deploy
- Run Phase 4 (end-to-end) — weekly or before major launches
- Run Phase 5 + 6 + 7 — weekly or after incidents
```

If any 🔴 appears, recommend stopping all ad spend until fixed. Phrase it bluntly. StoryHunt has already paid $80 for 0 leads because a 🔴 bug was running silently — the habit of "yeah we'll fix it later" is expensive.

---

## Known blind spots

This skill does NOT cover:
- Email deliverability content (spam score, inbox placement) — use `mail-tester.com` manually
- Front-end visual regressions — use Playwright with screenshot diffs
- Performance / Core Web Vitals — use PageSpeed Insights manually
- Third-party JS dependencies security — use `npm audit`
- Firebase security rules semantic correctness beyond "does it match the code" — use Firebase rules unit tests
- Accessibility — use axe-core or Lighthouse

When the user cares about these, tell them explicitly and point at the right tool.

## Maintenance

Every time a new class of incident happens at StoryHunt, add a check for it here. The skill grows with the scars. The goal is: every past pain becomes a future warning.

Log of additions:
- 2026-04-15 (v1): initial skill covering the 3 days of incidents around client-SDK server writes, silent catches, Stripe locale, i18n hardcoding, Meta geo leakage.
