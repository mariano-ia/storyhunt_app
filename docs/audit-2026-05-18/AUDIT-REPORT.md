# StoryHunt — Pre-OTA Launch Audit

**Date:** 2026-05-18
**Trigger:** TripAdvisor approval + OTA digital campaign about to launch
**Verdict:** 🔴 **NOT READY**. Multiple P0 blockers around security, OTA integration, legal, and monitoring.
**Findings:** ~130 across 4 deep audits (Security, Funnel/UX, Operational, Data/Tracking).

---

## TL;DR — 3 things that MUST be fixed before any external traffic

1. **Public Firestore exposure** — `access_tokens` collection is world-readable. 59 customer emails confirmed dumped via direct REST call. Any visitor can scrape the full customer base, hijack tokens, lock buyers out, inject fake sales/sessions.
2. **No OTA integration code exists** — there is no `/api/ota/voucher`, no Bókun/Viator webhook. TripAdvisor buyers will arrive with a code and no way to redeem it.
3. **No legal pages** — `/privacy`, `/terms`, `/refund-policy` don't exist. TripAdvisor and Stripe require these.

Without #1 fixed, this is currently a privacy incident waiting to surface.
Without #2 fixed, OTA traffic literally cannot complete fulfillment.
Without #3, the OTA listing application will be rejected.

---

## CRITICAL P0 — block-launch (must fix this week)

### Security (auditor: deep agent)

| # | Issue | File / evidence | Fix |
|---|---|---|---|
| S1 | `access_tokens` world-readable + writable. **CONFIRMED EXPLOITABLE — 59 emails dumped via curl.** | `firestore.rules:35-37` | Deny client SDK; route everything through Admin SDK API |
| S2 | `user_sessions` writable (anyone can mark session=completed) | `firestore.rules:51-55` | Same |
| S3 | `sales` writable (fake revenue injection, sort-order hijack on /api/public/experiences) | `firestore.rules:42` | Same |
| S4 | `interactions` writable (LLM-cost dashboard poisoning) | `firestore.rules:46-49` | Same |
| S5 | `discount_coupons` publicly readable. **CONFIRMED — codes THANKYOU40, DECODED25, STORYHUNT visible to anyone.** | `firestore.rules:29-30` | Deny client read |
| S6 | `llm_api_key` field on experiences leaks to browser via public read on `experiences` | `lib/firestore.ts:17-21` + `play/[id]/page.tsx:554` | Strip from client payload via API |
| S7 | **Any random Firebase signup = admin.** `verifyAuth()` doesn't check the `admins` collection. Anyone can `accounts:signUp` (open by default) → grant themselves access to every dashboard API. | `lib/firebase-admin.ts:111-124` | Add `admins` collection check; disable email/password signup in Firebase Console |
| S8 | **/api/users/invite uses Client SDK** against auth-required collection — broken pattern from past outages | `api/users/invite/route.ts:2-3` | Migrate to Admin SDK |
| S9 | `/api/dashboard/funnel` no auth. **CONFIRMED — returns revenue, sales count, recent events with masked emails publicly.** | `api/dashboard/funnel/route.ts:25` | Add `verifyAuth` + admin check |
| S10 | `/api/campaigns` no auth. **CONFIRMED — returns $1,027.50 Meta spend + 8 campaigns publicly.** | `api/campaigns/route.ts:33` | Add `verifyAuth` + admin check |
| S11 | Stripe webhook has NO idempotency check. Retries → duplicate tokens + sales + emails + coupon increments. **Likely root cause of PostHog 37-vs-1 sale discrepancy.** | `api/stripe/webhook/route.ts:136-263` | Use `db.collection('sales').doc(event.id).create()` for atomic dedup |
| S12 | Webhook returns 500 on processing errors → Stripe retries for 3 days → multiplies the duplication | `api/stripe/webhook/route.ts:259-262` | Always return 200 after signature passes; log internally |
| S13 | Access token format = 32^6 ≈ 30 bits + uses `Math.random()` (not crypto-secure) | `webhook/route.ts:184` + `verify/route.ts:123` | Use `crypto.randomBytes(8)` base32 |
| S14 | No rate limit ANYWHERE. `/api/access/verify`, `/api/contacts`, `/api/nyc-check`, `/api/checkout`, all `/api/sessions/*` | All routes | Add Upstash/Vercel KV rate limiter |
| S15 | All `/api/debug/*` routes (22 of them) gated only by `?secret=` in URL query. Secret in logs/referers. | `api/debug/**/route.ts` | Move to admin-auth header; remove deprecated one-shots |
| S16 | `/api/access/verify` returns full token object including email — enables session-id oracle for spear phishing | `api/access/verify/route.ts:161` | Strip email for unauth callers |
| S17 | No security headers (CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy) | `next.config.ts` | Add `headers()` |
| S18 | Email templates interpolate Firestore fields (`experienceName`, `startingPoint`) into HTML without escaping — XSS via authenticated user modifying experience name | `webhook/route.ts:43-68`, multiple | Escape HTML entities |
| S19 | `renderMessage.tsx` accepts `javascript:` URLs in markdown links | `lib/renderMessage.tsx:30` | Whitelist `http(s)://`, `/` and `mailto:` |
| S20 | Webhook only handles `checkout.session.completed`. **Refunds + disputes do not revoke tokens.** | `api/stripe/webhook/route.ts:136` | Add `charge.refunded`, `charge.dispute.created`, `async_payment_*` |
| S21 | `?from=N` URL param bypasses NYC gate | `play/[id]/page.tsx:723-725` | Validate server-side or only honor when resuming an existing session |

### Operational / Launch readiness

| # | Issue | Fix |
|---|---|---|
| O1 | **NO privacy policy / terms / refund policy pages.** Stripe ToS + TripAdvisor listing + GDPR require these. | Create `/privacy`, `/terms`, `/refund-policy` on StoryHuntWeb |
| O2 | DNS: apex `storyhunt.city` has NO SPF record (only `send.storyhunt.city` has it). Mail from `hello@` will go to spam at scale. | Add apex TXT: `v=spf1 include:amazonses.com ~all` |
| O3 | DMARC is `p=none` (monitoring only). After 2 weeks of reports, move to `p=quarantine`. | DNS update |
| O4 | DMARC `rua=mailto:mariano@yacare.io` — old email; verify it's still monitored or change to `mariano@storyhunt.city` | DNS update |
| O5 | **ZERO error monitoring.** No Sentry/Datadog/LogRocket. Webhook 500s only land in Vercel logs; no alerts. | `npm i @sentry/nextjs && npx @sentry/wizard` |
| O6 | **All emails missing `reply_to`.** Replies from customers go to Resend bounce-only. | Add `reply_to: 'hello@storyhunt.city'` to every `resend.emails.send` |
| O7 | **No customer-support contact visible in player** when something breaks mid-experience | Add `mailto:` help link in `/play/[id]` header |
| O8 | **No `List-Unsubscribe` header or unsubscribe link** in marketing emails (CAN-SPAM violation) | Add header + `/unsubscribe?email=` endpoint |
| O9 | **NO OTA integration code at all.** Grep for tripadvisor/viator/bokun/gyg = zero matches in code. Buyers via OTA arrive with no fulfillment path. | Build `/api/ota/voucher` (HMAC-signed booking ingest) + voucher redemption page |
| O10 | Sales schema has no `source` / `utm_source` / `attribution` fields — won't know which sales came from OTA vs Meta | Add fields to sales schema NOW, before data starts flowing |
| O11 | **No UTM capture anywhere in the funnel.** No `utm_source`, `fbclid`, `gclid`, `referrer` persisted on contacts, sales, or sessions. | Add UTMCapture client component + propagate through checkout metadata |
| O12 | Stripe checkout has no `automatic_tax`, no `billing_address_collection`. NYC sales tax applicable at scale; OTA listings expect tax-inclusive | Enable Stripe Tax |

### Funnel / UX P0s (will produce 1-star reviews)

| # | Issue | Fix |
|---|---|---|
| U1 | Default lang in `/play/[id]` and `/play/t/` falls back to **Spanish for English-speaking tourists** when query param missing | Default to `'en'` everywhere; let token's `lang` override |
| U2 | Paywall blocked screen is English-only + harsh + no support contact + `Get your ticket` sends to homepage instead of experience | Localize, add support link, recover gracefully |
| U3 | `/api/access/verify` fetch has no AbortController, no retry, no timeout — hangs forever on flaky NYC cellular (subway, Central Park dead zones) | 8s timeout + 1 retry + localized error CTA |
| U4 | Network errors mid-experience are silently swallowed (`'Ups, no se pudo enviar'`); subway/bandwidth drop looks like "narrator broke" | Detect offline; surface "Lost signal — tap to retry"; queue messages |
| U5 | No "skip rating" path; session never marks `completed` if user closes tab on rating screen → blocks the 24h review email cron | Auto-complete after 60s idle + explicit Skip link |
| U6 | NYC gate has no "imminent / on my way" branch — "landing in 2 hours" → marked awaiting_arrival when they ARE in NYC | Soften gate to "in or near NYC?" since paid token has 30-day clock anyway |
| U7 | No in-app browser detection (Gmail iOS, Outlook iOS, WhatsApp, IG). Apple Pay fails inside these; chat history can crash | Detect FBAN/FBAV/Instagram/Gmail UA → "open in Safari" overlay |
| U8 | Refund policy says "if broken, email us" — no SLA stated. OTAs require 24h response SLA in writing | Update FAQ + post-purchase screen with explicit SLA |

---

## P1 — high priority before scale (week 1-2)

### Data integrity

- **D1** `converted: true` is never set on contacts after purchase → paying customers get nurturing spam (E2/E3/E5/E7) for weeks. Fix in webhook + verify.
- **D2** No transaction wrapping access_token + sale + coupon writes. Partial failures = orphan rows.
- **D3** Sessions stuck `in_progress` forever (no abandonment cron). Inflates funnel denominator permanently.
- **D4** Resume logic in `/api/sessions/find` picks any in_progress row by `(experience_id, email)` — can pick wrong session if two exist.
- **D5** `times_used` increment is read-then-write (race condition on simultaneous requests). Use `FieldValue.increment(1)`.
- **D6** Coupon redemption count is non-atomic. Trust Stripe's counter; treat ours as informational.
- **D7** `valid_until` on coupons is NOT enforced in `/api/checkout`. Expired codes still apply if status is active.
- **D8** `coupon_code` stored mixed-case → fragile reporting.

### Tracking (will inflate or break attribution at OTA scale)

- **T1** **No `fbp`/`fbc`/`ga_client_id` ever sent to Meta CAPI** → every Purchase double-counts (CAPI + Pixel both fire, no dedup match). This + S11 likely explains "37 vs 1".
- **T2** PostHog server-side captures use `email-hash-...` distinct_id; client uses `$device_id`. Same Purchase = 2 PostHog persons = inflated funnel.
- **T3** PostHog `capture_pageview: true` + Next.js client routing = duplicate or missed pageviews.
- **T4** `MetaPixel.tsx:trackLead` standalone fires without `eventID` → won't dedup with CAPI Lead.
- **T5** `/secrets`, `/intercepted`, `/voicemail` call `trackLead()` with no email → Pixel Lead has no `em` → won't dedup with CAPI.
- **T6** Webhook Purchase event has empty `client_ip_address` + `client_user_agent` → poor match quality. Capture at checkout, propagate via metadata.
- **T7** Server-side `sourceUrl` for CAPI = `'/play/t/' + session.id` (not a real URL) — breaks Meta URL attribution.
- **T8** `events` collection unbounded, will balloon at scale.

### Email deliverability

- **E1** Welcome email writes `welcome_sent: true` BEFORE send completes (fire-and-forget). If Resend fails, nothing retries.
- **E2** Resend free tier = 100/day. At 200 paid bookings × 2 emails = 400/day. Upgrade to Pro ($20/mo) BEFORE launch.
- **E3** Emails are HTML-only (no `text` part) → spam score hit.
- **E4** No bounce/complaint handling. Bounced emails stay in nurturing cycle.

### Cron reliability

- **C1** Nurturing cron rescans every contact every day (no range query) — will hit Firestore limits at 100k contacts.
- **C2** Nurturing cron's "skip if converted" never works (D1).
- **C3** Post-experience review cron filters by `created_at` (purchase date) not `first_used_at` (play date) → tourists who buy ahead never get review email.
- **C4** Post-experience cron sends email BEFORE marking `review_email_sent: true` — crash mid-flight → email resent.
- **C5** No `cron_runs` log collection → silent cron failures invisible.

### Mobile / Perf

- **M1** `loading="eager"` on all card images + heavy hero animations kill mobile LCP on 3G/LTE-A.
- **M2** `maximumScale: 1, userScalable: false` in viewport → accessibility violation + iOS WCAG audit fail.
- **M3** Player ships ~120KB+ minified before Firebase SDK (single 1200-line client component). Split with `next/dynamic`.
- **M4** Stripe `payment_method_configuration` relies on Dashboard default — could be silently toggled off, killing Apple Pay/Google Pay conversion.

### Auth/Stripe edge cases

- **A1** `/api/checkout` accepts unlimited body size, arbitrary `coupon_code`, no length cap on `email`.
- **A2** `/api/checkout` triggers OpenAI translation on cache miss — burnable cost vector. Add rate limit.
- **A3** `/api/nyc-check` unauthenticated, no rate limit → OpenAI cost drain ($86/day at 10 RPS).
- **A4** `/api/contacts` no captcha → Resend spam vector. Drains free tier in ~7 hours sustained.
- **A5** PII logged to Vercel logs (emails + tokens in same line). E.g. `webhook/route.ts:257`.
- **A6** Currency hardcoded USD → EU/UK tourists pay FX fees, see "why was I charged more?"
- **A7** Only ES + EN supported. TripAdvisor traffic from EU = FR/DE/IT/PT.
- **A8** "30-day clock starts on first /play/t open" — Apple Mail / corporate scanners can hit /play/t and start clock prematurely.
- **A9** CSRF: cross-origin POSTs with `Content-Type: text/plain` skip preflight; can mutate sessions/contacts.

### Brand / OTA-specific

- **B1** Brand voice ("Bold, provocative, anti-tourist") may convert worse on TripAdvisor cold traffic. A/B test friendlier OTA-landing variant after first 50 bookings.
- **B2** Review email's coupon CTA goes back to storyhunt.city — for OTA bookings, should steer to "rate us on TripAdvisor" instead.
- **B3** No pricing parity strategy. If Bókun lists $13 (OTA commission) and storyhunt.city shows $9.99, chargebacks ensue.
- **B4** No cookie consent banner before Pixel/GA4/PostHog fire → GDPR exposure on EU TripAdvisor traffic.

---

## P2 — week 2-3 polish

- Image URL validation (`narrator_avatar`, `web_image`, `media_url`) — currently accepts arbitrary URLs.
- `experience.starting_point` rendered without fallback — missing field = silent UX failure.
- Browser timezone leak — chat header uses `'es-AR'` always (Buenos Aires time, not NYC).
- Hero animations heavy on low-end Android (40%+ CPU on Galaxy A).
- `error_screen` step has no skip — misconfigured `delay_seconds: 120` traps user.
- Browser back-button mid-experience is lossy SPA.
- `decodeURIComponent` not used on `?from=` query param.
- `robots: noindex` not set on `/play/*` routes.
- Hardcoded `stripe_coupon_id: 'nOh4AMZw'` in cron — if deleted in Stripe, silent failure.
- Bus factor = 1 (Mariano). All credentials tied to one person.
- LLM cost ceiling not set on OpenAI key dashboard.

---

## What's missing entirely (must build)

1. **OTA integration**: `/api/ota/voucher` endpoint (HMAC-signed Bókun/Viator hook), voucher redemption page, sales attribution.
2. **Privacy / Terms / Refund policy pages** on StoryHuntWeb.
3. **Cookie consent banner** with EU detection.
4. **Sentry / error monitoring** with Slack alerts on webhook errors.
5. **Unsubscribe endpoint** + `List-Unsubscribe` header.
6. **Abandonment cron** (flips stuck in_progress → abandoned at 4h).
7. **Refund flow** — Stripe Refund button in dashboard + `charge.refunded` webhook handler that revokes tokens.
8. **Customer support inbox** — `hello@storyhunt.city` needs to be a real monitored inbox, not just Mariano's personal mail.
9. **UTMCapture client component** propagating attribution through to sales.
10. **Webhook idempotency log** — `stripe_events` collection.

---

## Recommended sequencing

### Today (4 hours)
- DNS: add apex SPF for storyhunt.city.
- DNS: change DMARC `rua` to verified address.
- OpenAI dashboard: set $50/day hard cap.
- Resend: upgrade to Pro ($20/mo).
- All Resend `.emails.send` calls: add `reply_to`.

### This week (P0 priority order)
1. **Rewrite `firestore.rules`** — deny public read/write on access_tokens, user_sessions, sales, interactions, discount_coupons. Force every write through Admin SDK API.
2. **Strip `llm_api_key` from client experience reads** — return via API, never via direct Firestore SDK.
3. **Add admin check in `verifyAuth()`** — verify caller is in `admins` collection. Disable Firebase email/password signup in console.
4. **Stripe webhook idempotency** — `.doc(session.id).create()` pattern.
5. **Auth-protect `/api/dashboard/funnel`, `/api/campaigns`** — confirmed publicly accessible right now.
6. **Move debug routes behind admin auth** — replace `?secret=` query with auth header.
7. **Create `/privacy`, `/terms`, `/refund-policy`** on StoryHuntWeb.
8. **Add Sentry**.
9. **Add KILL_SWITCH_PAYMENTS env var** in `/api/checkout`.
10. **Build OTA voucher endpoint + redemption page** — or document manual SOP.

### Before OTA listing goes live
- Default lang to `en` everywhere.
- Add support email contact in player header.
- Add rating-screen skip path.
- Cookie consent banner.
- UTMCapture component.
- Add `source` field to sales schema.
- Fix `converted: true` write on purchase.
- Handle `charge.refunded` and `async_payment_succeeded` webhook events.
- Test end-to-end as a fresh TripAdvisor buyer.

---

## Confirmed exploits (PoC data captured during audit)

1. **59 customer emails dumped via Firestore REST** without auth:
   ```
   curl https://firestore.googleapis.com/v1/projects/storyhunt-platform-961ec/databases/(default)/documents/access_tokens?pageSize=100
   ```
   → 59 emails including `mariano@yacare.io`, `ojrana@gmail.com`, `eddiecantu85@gmail.com`, `mividaennyc@gmail.com`, `nasrullah.cmn@gmail.com`, plus all SH-XXXXXX token strings.

2. **Coupon codes dumped** without auth — same REST URL on `discount_coupons` returns `THANKYOU40`, `DECODED25`, `STORYHUNT`.

3. **`/api/dashboard/funnel?days=30` returns publicly**: $9.99 revenue, 22 sales, 6 signups, masked emails of recent events.

4. **`/api/campaigns` returns publicly**: $1,027.50 total Meta spend, 8 campaigns with names + IDs.

5. **`/api/access/verify` has no rate limit**: 5 sequential POSTs all 404 in 150-300ms each.

---

## Audit method

4 specialized agents run in parallel + manual deep checks on critical files. Agents covered:
- **Security** — Firestore rules, API auth, secrets, tokens, XSS, CSRF, headers, Stripe (40 findings)
- **Funnel + UX** — `/start` → checkout → email → play → completion, mobile, i18n, OTA (34 findings)
- **Operational readiness** — legal, deliverability, refunds, monitoring, support, bus factor, OTA gap (21 findings)
- **Data integrity + tracking** — webhook, sessions, tokens, CAPI/Pixel/GA4/PostHog dedup, coupons, OTA attribution (35 findings)

Total ≈130 distinct findings.
