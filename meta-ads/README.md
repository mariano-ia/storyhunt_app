# meta-ads/

Scripts to manage StoryHunt's Meta Ads campaigns programmatically via the
Marketing API. Built to bypass the click-heavy Ads Manager UI when launching
or iterating on campaigns.

Lives in this folder because it manages production ad spend — review every
script before running.

## Files

| File | Purpose |
|------|---------|
| `create-founders-campaign.py` | Create the full Founders Free campaign from scratch (campaign + ad set + creative + ad), all PAUSED. Idempotent only if you delete the orphans first. |
| `swap-creative-and-targeting.py` | After a campaign exists in `.last-created.json`, re-render + swap the creative and optionally attach Custom Audiences. Deletes the old ad + creative. |
| `.last-created.json` | State file with the IDs of the currently active campaign/adset/ad/creative/video/audiences. Read by both scripts. |

## Pre-flight

These env vars must be set in `../.env.local`:

- `META_ADS_TOKEN` — long-lived token (60 days) with `ads_read` +
  `ads_management` + `business_management` scopes. Refresh via
  Graph API Explorer when expired (see `project_meta_token_scopes.md` in
  user memory).
- `META_AD_ACCOUNT_ID` — `act_1614086746553655` (StoryHunt2026, USD).

The scripts also assume these are valid (hard-coded in script constants,
update if they change):

- `PAGE_ID` — `1027712467099764` (Story Hunt FB Page)
- `IG_ACTOR_ID` — `17841444079999050` (@storyhunt.city)
- `PIXEL_ID` — `1719479962357595`

## How to launch a fresh campaign

```bash
# 1. Render the video (in StoryHuntWeb)
cd ../../StoryHuntWeb
python3 render-founders-ad.py

# 2. Launch the Meta campaign (in StoryHuntABM)
cd ../StoryHuntABM
python3 meta-ads/create-founders-campaign.py
```

Output: campaign created in PAUSED state. Review in Ads Manager (URL
printed at the end), then activate via Ads Manager toggle OR by running:

```bash
python3 -c "
import json, os, urllib.parse, urllib.request
# ... (or use the activation snippet from the README)
"
```

## How to iterate the creative

After the initial creation, to swap the video + copy without rebuilding the
ad set:

```bash
# 1. Edit overlay copy / video in StoryHuntWeb/render-founders-ad.py, re-render
cd ../StoryHuntWeb && python3 render-founders-ad.py

# 2. Swap the creative + ad inside the existing ad set
cd ../StoryHuntABM && python3 meta-ads/swap-creative-and-targeting.py
```

This uploads the new video, creates a new creative + new ad in the same
ad set, then deletes the old ad and old creative. Targeting can also be
updated in this step (see script for the targeting block).

## Meta API gotchas hit during initial build (so you don't waste an hour)

These are documented because Meta's docs are sparse / outdated for v25.0:

### 1. `subtype` is partially deprecated in v25

- For **website**-based Custom Audiences: do NOT pass `subtype`. The API
  infers the type from the rule's event_sources.
- For **lookalike** audiences: `subtype: LOOKALIKE` IS still required.

### 2. IG/Page engagement Custom Audiences are broken via API

- Event names like `ig_business_profile_all`, `ig_business_profile_engaged`,
  `page_engaged`, `page_engagement` all return error 2654 ("nombre de
  evento no válido") regardless of format.
- Workaround: use a **Pixel-based** Custom Audience instead, or
  pre-create engagement audiences in the Ads Manager UI and reference
  their IDs.

### 3. Campaign needs `is_adset_budget_sharing_enabled` explicit

- When using ad-set-level budget (not Campaign Budget Optimization),
  the campaign creation API requires `is_adset_budget_sharing_enabled: false`
  explicitly. Otherwise it 400s.

### 4. Ad set needs `bid_strategy` explicit

- Default bid strategy is no longer assumed. Pass
  `bid_strategy: LOWEST_COST_WITHOUT_CAP` (or another) explicitly.

### 5. Ad set needs `targeting_automation.advantage_audience`

- Either `0` (manual targeting — respects your age/geo as-is) or
  `1` (Meta auto-finds audience — but forces age_max ≥ 65).
- For age-restricted targeting like 25-45: must use `advantage_audience: 0`.

### 6. Creative uses `instagram_user_id`, not `instagram_actor_id`

- `instagram_actor_id` was deprecated. The valid field name in v25 is
  `instagram_user_id`. Same value (the IG Business Account ID).

### 7. `end_time` cannot be more than 1 year out

- Meta caps the ad set end_time at exactly 1 year from today. To run
  "indefinitely", set end_time to ~364 days from now and renew before
  expiry (or just leave it — you'll get notified before it ends).

### 8. SSL certs

- `urllib.request.urlopen` on macOS Python can fail SSL verify without
  certifi. Always pass `context=ssl.create_default_context(cafile=certifi.where())`.

### 9. Video upload is multipart/form-data

- Easiest done via `subprocess` + `curl -F source=@file.mp4` rather than
  hand-rolling multipart in `urllib`.
- After upload, poll `/<video_id>?fields=status` until `video_status: ready`
  before referencing it in a creative (typically 5-30s for short videos).

## Cleanup

If a script run fails midway and leaves orphans (paused campaigns from
retries), the easiest cleanup is via Ads Manager (filter by campaign name,
multi-select, delete). Or via API:

```bash
python3 -c "
import json, ssl, urllib.request, urllib.parse
# ... DELETE /<id> for each orphan
"
```

See git log for the inline cleanup snippet used on 2026-05-11.
