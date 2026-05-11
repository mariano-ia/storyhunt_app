# 2026-05-11 — Founders Campaign Launch + Meta Ads Integration

Day-0 of the **100 Founders Free** campaign. After ~1 month of $9.99 promo
ads delivering 4.74% CTR but 0 sales, pivoted to FREE acquisition to
manufacture proof-of-life before paid scale.

## Shipped

### Landing
- **`/founders`** new page in StoryHuntABM (Next.js) — single conversion
  surface, no email capture (Stripe captures at checkout). Hero "100 FREE.
  THIS WEEK." with code STORYHUNT auto-applied via URL param. Cards link
  directly to `/[slug]?code=STORYHUNT`.
- **`/api/checkout`** unchanged; coupon flow already supported.
- **Tracking**: `trackViewContent` + `trackInitiateCheckout` +
  `trackAddPaymentInfo` wired to PostHog + Meta Pixel + GA4 + CAPI with
  tags `source=founders_landing`, `campaign=founders_100_doors`.
- **`/founders` rewrite** added to StoryHuntWeb `vercel.json` (storyhunt.city
  → storyhunt-app.vercel.app/founders).

### Conversion Review Pipeline (Monday cron)
- New `pull_meta_metrics.py` fetches last 7d + previous 7d Meta Ads
  insights from the StoryHunt2026 ad account using `META_ADS_TOKEN`.
  Graceful degradation if token absent.
- `analyze.py` accepts 3rd positional arg for meta-metrics.json.
  SYSTEM_PROMPT instructs cross-correlation between PostHog funnel and
  Meta spend. Proposals carry `scope: landing | ads | tracking`.
- `send_review.py` renders an "ADS · META" section in the email and
  scope-colored badges on proposal cards.
- **Validated end-to-end**: Opus 4.7 caught a real ~650-session tracking
  gap between PostHog Instagram source and Meta link_click totals on
  first integrated run.

### Meta Ads (LIVE)
- **Campaign** `120245497380450770` — "StoryHunt Founders Free — Warm"
  - Objective: OUTCOME_TRAFFIC, Status: **ACTIVE**
- **Ad set** `120245497381360770`
  - NYC 25mi (HARD RULE ✓), age 25-45, Instagram only
  - LANDING_PAGE_VIEWS optimization, $5/day, runs to 2027-05-10
- **Ad** `120245498760560770` — "Founders — Copy A v2 — Top Text"
  - ACTIVE (IN_PROCESS pending Meta review)
  - Creative: 1080×1920 NYC skyline at twilight, "100 FREE. THIS WEEK."
    top-left, subtext "NYC's best self-guided walking tour. After Sunday:
    $15.", CTA "Learn More" → storyhunt.city/founders
- Existing **Direct Sales** campaign continues in parallel, untouched.

### Custom Audiences (created but NOT in use yet)
- `SH_Web_Visitors_90d` (Pixel-based) — 20 people. Populating.
- `SH_LA1pct_WebVisitors` (Lookalike 1% US) — 1.000 people, flagged
  "too small" by Meta. Waiting for seed to grow.
- Will re-attach to ad set targeting once seed hits ~500+ (expected
  2-4 weeks of organic traffic).

### Infrastructure / Bug Fixes
- `firebase-admin.ts` `parseServiceAccount()` fallback: tolerates
  `FIREBASE_SERVICE_ACCOUNT_KEY` dotenv-corrupted in local dev (Next.js
  converts `\n` escape sequences inside quoted JSON to literal newlines,
  breaking JSON.parse). Vercel prod unaffected.
- `META_ADS_TOKEN` (long-lived, exp 2027-05-10) saved in .env.local.

## What I expect to see in the next Monday review

- /founders pageviews start counting in PostHog
- /start funnel unchanged (existing campaign continues)
- Meta ADS section showing the NEW founders ad set spend + CTR
- Cross-correlation: did founders ad clicks convert better than Direct Sales
- Probable signal: founders ad delivers ~50-200 landing page views in
  first 7 days; conversion-to-claim rate is the key new datapoint

## Known debt

- Warm engagers audiences too small to use; cold NYC fallback for v1.
- IG/Page engagement Custom Audiences couldn't be created (event names
  rejected by API v25 — `ig_business_profile_all`, `page_engaged` etc.).
  Pivoted to Pixel-based. Event-source audiences may need a different
  approach (`engagement_specs` format?) — documented in `meta-ads/README.md`.
- Many Meta API v25 gotchas documented in `meta-ads/README.md` (subtype
  deprecation, advantage_audience age cap, instagram_user_id vs actor_id,
  end_time 1yr max, etc.).
