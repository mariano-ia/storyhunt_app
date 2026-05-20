# Bokun OTA Integration

**Shipped:** 2026-05-20
**Owner:** Mariano
**Status:** Live in production for 3 experiences (Midtown Protocol, Brooklyn Bridge's Architect, The Village Sessions). TA-review-mode gated per-experience by `review_links.tripadvisor` field — currently inactive (no TA approvals yet).

## What this does

Bokun is the OTA distribution layer for StoryHunt. When someone buys a hunt through Viator, TripAdvisor, GetYourGuide, or any other Bokun-connected channel, Bokun fires a webhook to us. We:

1. Verify the request (query-param shared token)
2. Map the Bokun `productId` → our StoryHunt `experience_id`
3. Generate an access token `SH-XXXXXXXX`
4. Record the sale with OTA attribution (`source: bokun_viator | bokun_tripadvisor | bokun_gyg | bokun_direct`)
5. Email the buyer with their play link
6. On cancellation, flip token + sale to `status: 'refunded'`

The same fulfillment helper (`src/lib/fulfillment.ts::provisionAccess`) is used by both Stripe (direct sales) and Bokun (OTA sales).

## How requests reach us

```
Customer buys on Viator
        │
        ▼
   Bokun (channel manager)
        │
        ▼ POST https://storyhunt.city/api/bokun/webhook?token=<BOKUN_WEBHOOK_SECRET>
        │
   /api/bokun/webhook
        │
        ├── verify ?token == BOKUN_WEBHOOK_SECRET (constant-time)
        ├── dedup via bokun_events/{action}:{bookingId}.create()
        ├── BOOKING_CONFIRMED → provisionAccess() → token + sale + email
        └── BOOKING_CANCELLED → markAccessRefunded()
```

## Auth model — IMPORTANT

Bokun's "HTTP Booking notification" **does not sign payloads with HMAC**. Auth is a shared secret passed as a URL query parameter. This is different from Stripe (which uses HMAC-SHA256 in a header).

```
URL configured in Bokun:    https://storyhunt.city/api/bokun/webhook
Query parameters in Bokun:  token=<BOKUN_WEBHOOK_SECRET>
```

The endpoint rejects any request whose `?token` doesn't match `BOKUN_WEBHOOK_SECRET` with HTTP 401.

## Environment variables

| Var | Where | What |
|---|---|---|
| `BOKUN_WEBHOOK_SECRET` | Vercel (production) + `.env.local` | Shared token verified against `?token` query param on incoming webhooks |
| `BOKUN_ACCESS_KEY` | `.env.local` only | Bokun API public identifier — used by local scripts to list products / fetch booking details |
| `BOKUN_SECRET_KEY` | `.env.local` only | Bokun API HMAC signing secret — used by local scripts only |

`BOKUN_ACCESS_KEY` and `BOKUN_SECRET_KEY` are **never** read by the deployed app. They're tools for local admin scripts (e.g., re-mapping products after a Bokun account change).

## Onboarding a new experience to Bokun

**Order matters:** StoryHunt first, Bokun second, binding third.

1. **In StoryHunt dashboard**: create the experience as usual (AI Story Generator → scenes/steps → publish). The narrative content lives only here.

2. **In Bokun dashboard**: create the matching activity. Price, meeting point, schedule, photos, cancellation policy — all Bokun-side.

3. **Bind them**: copy the Bokun product ID, open the experience in StoryHunt dashboard → Edit → "Distribución OTA" section → paste into `Bokun Product ID` field → Save.

That's it. From the next Bokun booking onward, the webhook will create access tokens for this experience.

### Once TripAdvisor approves the listing

1. Open the experience editor → "Distribución OTA"
2. Paste the TA review URL in `TripAdvisor — Review URL`
3. Save

From the next E6 review email cycle, that experience switches automatically to "TA mode" (CTA = TripAdvisor review + THANKYOU40 coupon).

## Bokun dashboard config (one-time setup)

This was done on 2026-05-20. Reference for if it ever needs reconfiguring:

**Settings → Connections → Integrated systems → New → HTTP Booking notification**

| Field | Value |
|---|---|
| Type | `HTTP Booking notification` (locked) |
| Title | `StoryHunt Webhook` |
| Description | `Notifies StoryHunt API of booking events` |
| Active | ✓ |
| URL | `https://storyhunt.city/api/bokun/webhook` |
| Data format | `json` |
| Query parameters | `token=<BOKUN_WEBHOOK_SECRET>` |
| Notify on booking confirmed | ✓ |
| Notify on booking updated | ☐ |
| Notify on booking cancelled | ✓ |

## Reseller handling

Mariano has agreements with third-party tour operators whose products appear in his Bokun catalog (NYC tours by other companies that he resells via storyhunt.city — e.g., Niagara Falls day trips, Boston/Harvard tours). Their Bokun product IDs are in the `27xxxx` range (vs StoryHunt's `1218xxx`).

When a customer buys a reseller product on an OTA, Bokun still fires our webhook. Our endpoint queries `experiences.where('bokun_product_id', '==', productId)` and finds nothing. It logs `skipped: unmapped_product` and returns 200. **No fake access token is created.** Bokun + the reseller handle fulfillment normally.

If StoryHunt ever wants to issue access tokens for reseller products (unlikely — they're regular guided tours, not chat-based mysteries), that experience would need to be created in Firestore with the corresponding `bokun_product_id`.

## Source attribution

The webhook resolves a `source` string from the Bokun payload's `salesChannel` / `bookingChannel.title` / `vendor.title` / `affiliate.title` fields:

| Match | Resolved source |
|---|---|
| Contains "viator" | `bokun_viator` |
| Contains "tripadvisor" / "trip advisor" | `bokun_tripadvisor` |
| Contains "getyourguide" / "gyg" / "get your guide" | `bokun_gyg` |
| Anything else | `bokun_direct` |

This `source` is written to both `access_tokens.source` and `sales.source`. Use it for OTA-specific analytics (`SELECT * FROM sales WHERE source LIKE 'bokun_%'`).

## Testing

### Smoke (automatic, every deploy)
The GitHub Action `post-deploy-smoke.yml` polls `/api/bokun/webhook` until it returns 401 (canary for "new code is live"), then asserts:
- Endpoint rejects missing `?token` with 401
- Endpoint rejects wrong `?token` with 401
- Firestore `bokun_events` blocks anon reads with 403

### Manual end-to-end test
```bash
SECRET=$(grep "^BOKUN_WEBHOOK_SECRET=" .env.local | cut -d= -f2)
curl -X POST "https://storyhunt.city/api/bokun/webhook?token=$SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "TEST-MANUAL-001",
    "action": "BOOKING_CONFIRMED",
    "product": { "id": 1218385 },
    "customer": { "email": "you+bokuntest@gmail.com", "language": "EN" },
    "salesChannel": "VIATOR",
    "totalPrice": 9.99,
    "currency": "USD"
  }'
# Expected: {"received":true,"token":"SH-XXXXX..."}
```

Cancel + clean up:
```bash
curl -X POST "https://storyhunt.city/api/bokun/webhook?token=$SECRET" \
  -H "Content-Type: application/json" \
  -d '{"id":"TEST-MANUAL-001","action":"BOOKING_CANCELLED"}'
# Expected: {"received":true,"tokensRefunded":1,"salesRefunded":1}
```

To delete test data afterwards:
```bash
node /tmp/bokun-cleanup-tests.js   # filters bokun_booking_id LIKE 'TEST-%'
```

## Troubleshooting

**Webhook returns 401 for legitimate Bokun bookings**
- Verify `BOKUN_WEBHOOK_SECRET` in Vercel matches the `token=` value in Bokun's Query parameters field.
- Rotate: update Bokun first, then Vercel env, then redeploy.

**Webhook returns 503 "webhook not configured"**
- `BOKUN_WEBHOOK_SECRET` is missing in the Vercel environment. Add it and redeploy.

**Webhook returns 200 but token isn't created**
Check response body:
- `skipped: missing_booking_id` → payload missing `id`/`bookingId`/`confirmationCode`. Bokun config issue.
- `skipped: missing_product_id` → payload missing `product.id`. Bokun config issue.
- `skipped: unmapped_product` → product not mapped to a StoryHunt experience. Add `bokun_product_id` in the experience editor.
- `duplicate: true` → idempotency dedup. The booking was already processed.

**Booking lands in Firestore but no email arrives**
- Resend logs (Resend dashboard): check for delivery failures.
- The webhook does NOT fail if email send fails — it fire-and-forgets. Look at server logs for `[fulfillment] Failed to send access email`.

**Refund webhook fires but tokens aren't flipped**
- Verify the Bokun `id`/`bookingId` in the cancellation payload matches the original confirmation. We join on `bokun_booking_id`.

## Files

- `src/app/api/bokun/webhook/route.ts` — entry point + auth + event routing
- `src/lib/fulfillment.ts` — shared `provisionAccess` + `markAccessRefunded` (used by both Stripe and Bokun)
- `src/lib/types.ts` — `Experience.bokun_product_id`, `Experience.review_links`, `AccessToken.source`, `AccessToken.bokun_booking_id`
- `src/app/api/cron/post-experience-email/route.ts` — branches on `experience.review_links.tripadvisor`
- `src/lib/email-templates.ts::reviewWithTAEmail()` — TA review + cupón template
- `src/app/dashboard/experiences/[id]/page.tsx` — "Distribución OTA" editor section
- `firestore.rules` — `bokun_events` server-only

## What's NOT here (intentional)

- **No auto-create Bokun activity from StoryHunt.** Bokun has 20+ commercial fields (pricing models, schedules, cancellation policies) we don't capture in StoryHunt. Bokun's UI is where the commercial wrapper lives. We only bind via product ID.
- **No "Fetch from Bokun" dropdown in editor.** Manual paste of `bokun_product_id` is the current UX. A future enhancement could add a dropdown that lists unmapped Bokun activities. Skipped because: (a) manual paste is ~30s per experience, (b) experiences are created infrequently.
- **No outbound calls to Bokun API from the deployed app.** The deployed app only receives webhooks. The `BOKUN_ACCESS_KEY`/`SECRET_KEY` are for local admin scripts only (e.g., re-running the auto-mapping if Mariano's Bokun account gets new products).
- **No periodic polling fallback if webhooks fail.** We rely on Bokun's webhook retries. If a webhook is permanently lost, the user can recover via `/api/access/verify` with the booking confirmation.

## Decisions log

- **2026-05-20**: Chose query-param token auth over HMAC because Bokun's HTTP Booking notification feature doesn't sign payloads. Trade-off: secret travels in the URL (visible to intermediate logs), but TLS + secret rotation contain the blast radius.
- **2026-05-20**: Chose to fire webhook events through a shared `provisionAccess()` helper rather than duplicating logic between Stripe and Bokun handlers. Both call sites now produce identical schemas (access_tokens, sales) with only the `source` field differentiating them.
- **2026-05-20**: Chose to gate TA-review email mode on per-experience `review_links.tripadvisor` rather than on `access_tokens.source`. Reason: the decision of "should we ask for a TA review?" depends on whether the experience HAS a TA listing, not on which channel the buyer came from. A direct Stripe buyer of Midtown should still be pushed to leave a TA review — that's how we maximize review volume on the only-approved listing.
- **2026-05-20**: User decided OTA buyers should also receive THANKYOU40 in the review email (to drive next purchase to direct channel = better margin).
