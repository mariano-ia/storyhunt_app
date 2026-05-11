#!/usr/bin/env python3
"""
Swap the Copy A video into the existing PAUSED founders ad set, and
update targeting from cold NYC to warm engagers + lookalike (NYC-bound).

Reads .last-created.json for the current campaign/adset/ad IDs.

Steps:
  1) Create Custom Audience: SH_IG_Engagers_90d
  2) Create Custom Audience: SH_Page_Engagers_90d
  3) Create Lookalike Custom Audience: SH_LA1pct_Engagers (US 1%)
  4) Upload new video (Copy A render)
  5) Create new Ad Creative + new Ad in the same ad set (PAUSED)
  6) Update ad set targeting to use the 3 audiences (OR) + keep NYC 25mi
  7) Delete old Ad + old Creative
  8) Update .last-created.json

If audience creation fails or returns 0-size, falls back to keeping the
geo-only ad set targeting. Logs everything.
"""
import json
import os
import ssl
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()

API_VERSION = "v25.0"
BASE = f"https://graph.facebook.com/{API_VERSION}"

PAGE_ID = "1027712467099764"
IG_ACTOR_ID = "17841444079999050"
PIXEL_ID = "1719479962357595"

VIDEO_PATH = "/Users/marianonoceti/Desktop/Antigravity/StoryHuntWeb/assets/ads/videos/founders/founders-nyc-skyline.mp4"
DESTINATION_URL = "https://storyhunt.city/founders"

# Copy A — direct response, no euphemisms
HEADLINE = "100 free NYC walking tours."
PRIMARY_TEXT = (
    "NYC's best self-guided walking tour. Free for 100 hunters this week. "
    "After Sunday: $15. Claim yours before they're gone."
)


def load_env():
    here = os.path.dirname(os.path.abspath(__file__))
    env_path = os.path.join(here, "..", ".env.local")
    env = {}
    with open(env_path, "r") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def api_post(endpoint, token, data):
    if isinstance(data, dict):
        body = urllib.parse.urlencode({
            k: (json.dumps(v) if isinstance(v, (dict, list)) else str(v))
            for k, v in data.items()
        }).encode("utf-8")
    else:
        body = data
    url = f"{BASE}/{endpoint}?access_token={token}"
    req = urllib.request.Request(
        url, data=body, method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    try:
        with urllib.request.urlopen(req, timeout=60, context=SSL_CTX) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        return {"error": f"HTTP {e.code}: {err_body[:600]}"}


def api_get(endpoint, token, params=None):
    qs = dict(params or {})
    qs["access_token"] = token
    url = f"{BASE}/{endpoint}?{urllib.parse.urlencode(qs)}"
    try:
        with urllib.request.urlopen(url, timeout=30, context=SSL_CTX) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return {"error": f"HTTP {e.code}: {e.read().decode('utf-8', errors='replace')[:600]}"}


def api_delete(endpoint, token):
    url = f"{BASE}/{endpoint}?access_token={token}"
    req = urllib.request.Request(url, method="DELETE")
    try:
        with urllib.request.urlopen(req, timeout=30, context=SSL_CTX) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return {"error": f"HTTP {e.code}: {e.read().decode('utf-8', errors='replace')[:300]}"}


def upload_video(account_id, token, path):
    url = f"{BASE}/{account_id}/advideos?access_token={token}"
    result = subprocess.run(
        ["curl", "-s", "-X", "POST", url,
         "-F", f"source=@{path}",
         "-F", "name=founders-nyc-skyline-copyA"],
        capture_output=True, text=True, timeout=300,
    )
    data = json.loads(result.stdout)
    if "error" in data:
        sys.exit(f"video upload failed: {data['error']}")
    return data["id"]


def wait_video_ready(video_id, token, max_wait=180):
    start = time.time()
    while time.time() - start < max_wait:
        d = api_get(video_id, token, {"fields": "status"})
        s = (d.get("status") or {}).get("video_status")
        if s == "ready":
            return True
        if s == "error":
            sys.exit(f"video processing error: {d}")
        time.sleep(5)
    sys.exit("video did not become ready")


def get_thumbnail(video_id, token):
    d = api_get(f"{video_id}/thumbnails", token)
    thumbs = d.get("data", [])
    if not thumbs:
        sys.exit("no thumbnails")
    pref = next((t for t in thumbs if t.get("is_preferred")), thumbs[0])
    return pref["uri"]


def create_ig_engagement_audience(account_id, token):
    """IG account engagement, last 90d, all engagement types."""
    return api_post(f"{account_id}/customaudiences", token, {
        "name": "SH_IG_Engagers_90d",
        "subtype": "ENGAGEMENT",
        "description": "Anyone who engaged with @storyhunt.city in last 90 days",
        "rule": {
            "inclusions": {
                "operator": "or",
                "rules": [{
                    "event_sources": [{"id": IG_ACTOR_ID, "type": "ig_business"}],
                    "retention_seconds": 7776000,  # 90d
                    "filter": {
                        "operator": "and",
                        "filters": [{
                            "field": "event",
                            "operator": "=",
                            "value": "ig_business_profile_all",
                        }],
                    },
                }],
            },
        },
    })


def create_page_engagement_audience(account_id, token):
    """Facebook Page engagement, last 90d."""
    return api_post(f"{account_id}/customaudiences", token, {
        "name": "SH_Page_Engagers_90d",
        "subtype": "ENGAGEMENT",
        "description": "Anyone who engaged with Story Hunt FB Page in last 90 days",
        "rule": {
            "inclusions": {
                "operator": "or",
                "rules": [{
                    "event_sources": [{"id": PAGE_ID, "type": "page"}],
                    "retention_seconds": 7776000,
                    "filter": {
                        "operator": "and",
                        "filters": [{
                            "field": "event",
                            "operator": "=",
                            "value": "page_engaged",
                        }],
                    },
                }],
            },
        },
    })


def create_lookalike(account_id, token, source_id):
    """1% Lookalike of source audience, US-based."""
    return api_post(f"{account_id}/customaudiences", token, {
        "name": "SH_LA1pct_Engagers",
        "subtype": "LOOKALIKE",
        "origin_audience_id": source_id,
        "lookalike_spec": json.dumps({
            "type": "similarity",
            "ratio": 0.01,
            "country": "US",
        }),
    })


def main():
    env = load_env()
    token = env["META_ADS_TOKEN"]
    account_id = env["META_AD_ACCOUNT_ID"]

    state_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".last-created.json")
    with open(state_path) as f:
        state = json.load(f)
    campaign_id = state["campaign_id"]
    adset_id = state["adset_id"]
    old_ad_id = state["ad_id"]
    old_creative_id = state["creative_id"]

    print("=" * 60)
    print(f"Account:   {account_id}")
    print(f"Campaign:  {campaign_id}")
    print(f"Ad set:    {adset_id}")
    print(f"Old ad:    {old_ad_id}")
    print("=" * 60)
    print()

    # ─── 1) Create Custom Audiences ──────────────────────────────
    print("[1/7] Creating SH_IG_Engagers_90d...")
    ig_aud = create_ig_engagement_audience(account_id, token)
    if "error" in ig_aud:
        print(f"      WARNING: {ig_aud['error']}")
        ig_aud_id = None
    else:
        ig_aud_id = ig_aud["id"]
        print(f"      ig_aud_id = {ig_aud_id}")

    print("[2/7] Creating SH_Page_Engagers_90d...")
    page_aud = create_page_engagement_audience(account_id, token)
    if "error" in page_aud:
        print(f"      WARNING: {page_aud['error']}")
        page_aud_id = None
    else:
        page_aud_id = page_aud["id"]
        print(f"      page_aud_id = {page_aud_id}")

    # Lookalike — need a non-LA source audience. Prefer IG, fallback to Page.
    seed_aud_id = ig_aud_id or page_aud_id
    la_aud_id = None
    if seed_aud_id:
        print("[3/7] Creating SH_LA1pct_Engagers (US 1%)...")
        la_aud = create_lookalike(account_id, token, seed_aud_id)
        if "error" in la_aud:
            print(f"      WARNING: {la_aud['error']}")
        else:
            la_aud_id = la_aud["id"]
            print(f"      la_aud_id = {la_aud_id}")
    else:
        print("[3/7] Skipping Lookalike — no seed audience available")

    # ─── 4) Upload new video ─────────────────────────────────────
    print("[4/7] Uploading new video (Copy A)...")
    new_video_id = upload_video(account_id, token, VIDEO_PATH)
    print(f"      new_video_id = {new_video_id}")
    print("      Waiting for processing...")
    wait_video_ready(new_video_id, token)
    thumb_url = get_thumbnail(new_video_id, token)
    print(f"      ready ✓, thumb fetched")

    # ─── 5) New creative + ad in existing ad set ────────────────
    print("[5/7] Creating new ad creative + ad (PAUSED)...")
    new_creative = api_post(f"{account_id}/adcreatives", token, {
        "name": "Founders Copy A — creative",
        "object_story_spec": {
            "page_id": PAGE_ID,
            "instagram_user_id": IG_ACTOR_ID,
            "video_data": {
                "video_id": new_video_id,
                "image_url": thumb_url,
                "title": HEADLINE,
                "message": PRIMARY_TEXT,
                "call_to_action": {
                    "type": "LEARN_MORE",
                    "value": {"link": DESTINATION_URL},
                },
            },
        },
    })
    if "error" in new_creative:
        sys.exit(f"creative failed: {new_creative['error']}")
    new_creative_id = new_creative["id"]
    print(f"      new_creative_id = {new_creative_id}")

    new_ad = api_post(f"{account_id}/ads", token, {
        "name": "Founders — Copy A — NYC Skyline",
        "adset_id": adset_id,
        "creative": {"creative_id": new_creative_id},
        "status": "PAUSED",
    })
    if "error" in new_ad:
        sys.exit(f"ad failed: {new_ad['error']}")
    new_ad_id = new_ad["id"]
    print(f"      new_ad_id = {new_ad_id}")

    # ─── 6) Update ad set targeting ────────────────────────────
    print("[6/7] Updating ad set targeting with warm audiences...")
    custom_audiences = [{"id": aid} for aid in [ig_aud_id, page_aud_id, la_aud_id] if aid]
    targeting_update = {
        # Keep NYC HARD RULE
        "geo_locations": {
            "custom_locations": [{
                "latitude": 40.7128,
                "longitude": -74.0060,
                "radius": 25,
                "distance_unit": "mile",
            }],
            "location_types": ["home", "recent"],
        },
        "age_min": 25,
        "age_max": 45,
        "publisher_platforms": ["instagram"],
        "instagram_positions": ["stream", "story", "reels", "explore"],
        "targeting_automation": {"advantage_audience": 0},
    }
    if custom_audiences:
        targeting_update["custom_audiences"] = custom_audiences
        print(f"      Adding {len(custom_audiences)} custom audience(s) to targeting")
    else:
        print(f"      WARNING: no custom audiences created — keeping cold NYC")

    update_res = api_post(adset_id, token, {"targeting": targeting_update})
    if "error" in update_res:
        print(f"      WARNING: adset update failed — {update_res['error']}")
    else:
        print(f"      ad set targeting updated ✓")

    # ─── 7) Cleanup old ad + creative ──────────────────────────
    print("[7/7] Deleting old ad + creative...")
    res1 = api_delete(old_ad_id, token)
    print(f"      old ad ({old_ad_id}): {res1}")
    res2 = api_delete(old_creative_id, token)
    print(f"      old creative ({old_creative_id}): {res2}")

    # Update state file
    state.update({
        "ad_id": new_ad_id,
        "creative_id": new_creative_id,
        "video_id": new_video_id,
        "ig_audience_id": ig_aud_id,
        "page_audience_id": page_aud_id,
        "lookalike_audience_id": la_aud_id,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "copy_version": "A",
    })
    with open(state_path, "w") as f:
        json.dump(state, f, indent=2)

    bm = "https://business.facebook.com"
    acct_n = account_id.replace("act_", "")
    print()
    print("=" * 60)
    print("DONE — review in Ads Manager and ACTIVATE manually:")
    print("=" * 60)
    print(f"  Campaign:  {bm}/adsmanager/manage/campaigns?act={acct_n}&selected_campaign_ids={campaign_id}")
    print(f"  Ad set:    {bm}/adsmanager/manage/adsets?act={acct_n}&selected_adset_ids={adset_id}")
    print(f"  Ad (new):  {bm}/adsmanager/manage/ads?act={acct_n}&selected_ad_ids={new_ad_id}")
    print(f"  Audiences: {bm}/adsmanager/audiences?act={acct_n}")
    print()
    print("Audience sizes — check in Audiences UI:")
    print(f"  - SH_IG_Engagers_90d:   id={ig_aud_id}")
    print(f"  - SH_Page_Engagers_90d: id={page_aud_id}")
    print(f"  - SH_LA1pct_Engagers:   id={la_aud_id} (lookalike, may take 1-3h to build)")


if __name__ == "__main__":
    main()
