#!/usr/bin/env python3
"""
Create the FOUNDERS campaign in Meta Ads (paused) via Marketing API.

Pipeline:
  1) Upload video to ad account
  2) Wait for video to be ready (poll status)
  3) Pick auto-generated thumbnail
  4) Create Campaign (PAUSED, OUTCOME_LEADS)
  5) Create Ad Set (PAUSED, NYC 25mi, age 25-45, AddPaymentInfo conversion,
                    daily budget $5, ends in 6 days)
  6) Create Ad Creative (video + headline + body + CTA Learn More + /founders)
  7) Create Ad (PAUSED)
  8) Print Ads Manager URLs for review

Safety: everything is created with status=PAUSED. Even if a parameter is
wrong, no money is spent. Review and activate manually in Ads Manager.

Reads env from ../.env.local (META_ADS_TOKEN + META_AD_ACCOUNT_ID).
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
from datetime import datetime, timedelta, timezone

try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()

API_VERSION = "v25.0"
BASE = f"https://graph.facebook.com/{API_VERSION}"

# Known IDs (from project memory)
PAGE_ID = "1027712467099764"
IG_ACTOR_ID = "17841444079999050"  # @storyhunt.city
PIXEL_ID = "1719479962357595"  # from the noscript pixel tag in the site HTML

VIDEO_PATH = "/Users/marianonoceti/Desktop/Antigravity/StoryHuntWeb/assets/ads/videos/founders/founders-nyc-skyline.mp4"
DESTINATION_URL = "https://storyhunt.city/founders"

CAMPAIGN_NAME = "StoryHunt Founders Free — Warm"
ADSET_NAME = "Founders — NYC 25mi · 25-45"
AD_NAME = "Founders — NYC Skyline Anti-Tour"

HEADLINE = "NYC opens 100 doors."
PRIMARY_TEXT = (
    "The city is tired of tourists. 100 free hunters this week. "
    "The city texts you. Step through before the doors close."
)

DAILY_BUDGET_CENTS = 500  # $5.00/day — conservative; user can scale after review
DURATION_DAYS = 6


def load_env():
    here = os.path.dirname(os.path.abspath(__file__))
    env_path = os.path.join(here, "..", ".env.local")
    env = {}
    if not os.path.exists(env_path):
        sys.exit(f"ERROR: .env.local not found at {env_path}")
    with open(env_path, "r") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def api_post(endpoint, token, data, retries=2):
    """POST JSON-encoded form data to Meta Graph API."""
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
    last_err = None
    for attempt in range(retries + 1):
        try:
            with urllib.request.urlopen(req, timeout=60, context=SSL_CTX) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            last_err = e.read().decode("utf-8", errors="replace")
            if attempt < retries and e.code >= 500:
                time.sleep(2 ** attempt)
                continue
            raise SystemExit(f"FAIL POST /{endpoint}\n  HTTP {e.code}: {last_err[:600]}")
        except Exception as e:
            raise SystemExit(f"FAIL POST /{endpoint}\n  {e}")


def api_get(endpoint, token, params=None):
    qs = dict(params or {})
    qs["access_token"] = token
    url = f"{BASE}/{endpoint}?{urllib.parse.urlencode(qs)}"
    try:
        with urllib.request.urlopen(url, timeout=30, context=SSL_CTX) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        raise SystemExit(f"FAIL GET /{endpoint}\n  HTTP {e.code}: {body[:600]}")


def upload_video(account_id, token, path):
    """Simple multipart upload via curl (urllib multipart is painful)."""
    url = f"{BASE}/{account_id}/advideos?access_token={token}"
    result = subprocess.run(
        ["curl", "-s", "-X", "POST", url, "-F", f"source=@{path}", "-F", "name=founders-nyc-skyline"],
        capture_output=True, text=True, timeout=300,
    )
    if result.returncode != 0:
        sys.exit(f"FAIL video upload curl: {result.stderr[:600]}")
    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError:
        sys.exit(f"FAIL video upload response: {result.stdout[:600]}")
    if "error" in data:
        sys.exit(f"FAIL video upload: {data['error']}")
    return data["id"]


def wait_for_video_ready(video_id, token, max_wait_sec=180):
    """Poll until video processing status == 'ready'."""
    start = time.time()
    while time.time() - start < max_wait_sec:
        data = api_get(video_id, token, {"fields": "status"})
        status = (data.get("status") or {}).get("video_status")
        if status == "ready":
            return True
        if status == "error":
            sys.exit(f"FAIL video processing error: {data}")
        time.sleep(5)
    sys.exit("FAIL video did not become ready within timeout")


def get_video_thumbnail(video_id, token):
    """Pick a preferred Meta-generated thumbnail for the creative."""
    data = api_get(f"{video_id}/thumbnails", token)
    thumbs = data.get("data", [])
    if not thumbs:
        sys.exit("FAIL no thumbnails generated yet")
    preferred = next((t for t in thumbs if t.get("is_preferred")), thumbs[0])
    return preferred["uri"]


def main():
    env = load_env()
    token = env.get("META_ADS_TOKEN")
    account_id = env.get("META_AD_ACCOUNT_ID")
    if not token or not account_id:
        sys.exit("ERROR: META_ADS_TOKEN and META_AD_ACCOUNT_ID must be set in .env.local")
    if not os.path.exists(VIDEO_PATH):
        sys.exit(f"ERROR: video not found at {VIDEO_PATH}")

    print("=" * 60)
    print(f"Account: {account_id}")
    print(f"Video:   {VIDEO_PATH} ({os.path.getsize(VIDEO_PATH) / 1_000_000:.2f} MB)")
    print(f"Budget:  ${DAILY_BUDGET_CENTS/100:.2f}/day × {DURATION_DAYS} days  (=${DAILY_BUDGET_CENTS/100*DURATION_DAYS:.2f} max)")
    print("=" * 60)
    print()

    # Step 1: upload video
    print("[1/7] Uploading video...")
    video_id = upload_video(account_id, token, VIDEO_PATH)
    print(f"      video_id = {video_id}")

    # Step 2: wait for processing
    print("[2/7] Waiting for video to finish processing...")
    wait_for_video_ready(video_id, token)
    print(f"      ready ✓")

    # Step 3: thumbnail
    print("[3/7] Fetching auto-generated thumbnail...")
    thumb_url = get_video_thumbnail(video_id, token)
    print(f"      thumb = {thumb_url[:80]}...")

    # Step 4: create campaign
    print("[4/7] Creating campaign (PAUSED)...")
    campaign = api_post(f"{account_id}/campaigns", token, {
        "name": CAMPAIGN_NAME,
        "objective": "OUTCOME_TRAFFIC",
        "special_ad_categories": [],
        "buying_type": "AUCTION",
        "is_adset_budget_sharing_enabled": "false",
        "status": "PAUSED",
    })
    campaign_id = campaign["id"]
    print(f"      campaign_id = {campaign_id}")

    # Step 5: create ad set
    print("[5/7] Creating ad set (PAUSED)...")
    start_time = datetime.now(timezone.utc) + timedelta(minutes=5)
    end_time = start_time + timedelta(days=DURATION_DAYS)
    adset = api_post(f"{account_id}/adsets", token, {
        "name": ADSET_NAME,
        "campaign_id": campaign_id,
        "daily_budget": DAILY_BUDGET_CENTS,
        "billing_event": "IMPRESSIONS",
        "optimization_goal": "LANDING_PAGE_VIEWS",
        "bid_strategy": "LOWEST_COST_WITHOUT_CAP",
        "destination_type": "WEBSITE",
        "targeting": {
            # HARD RULE per project memory: every ad set must have geo_locations,
            # and StoryHunt does not spend outside NYC 25mi.
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
        },
        "start_time": start_time.isoformat(),
        "end_time": end_time.isoformat(),
        "status": "PAUSED",
    })
    adset_id = adset["id"]
    print(f"      adset_id = {adset_id}")
    print(f"      runs {start_time.date()} → {end_time.date()}")

    # Step 6: create ad creative
    print("[6/7] Creating ad creative...")
    creative = api_post(f"{account_id}/adcreatives", token, {
        "name": f"{AD_NAME} — creative",
        "object_story_spec": {
            "page_id": PAGE_ID,
            "instagram_user_id": IG_ACTOR_ID,
            "video_data": {
                "video_id": video_id,
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
    creative_id = creative["id"]
    print(f"      creative_id = {creative_id}")

    # Step 7: create ad
    print("[7/7] Creating ad (PAUSED)...")
    ad = api_post(f"{account_id}/ads", token, {
        "name": AD_NAME,
        "adset_id": adset_id,
        "creative": {"creative_id": creative_id},
        "status": "PAUSED",
    })
    ad_id = ad["id"]
    print(f"      ad_id = {ad_id}")
    print()

    # Summary
    bm = "https://business.facebook.com"
    print("=" * 60)
    print("DONE — review in Ads Manager and ACTIVATE manually:")
    print("=" * 60)
    print(f"  Campaign:  {bm}/adsmanager/manage/campaigns?act={account_id.replace('act_','')}&selected_campaign_ids={campaign_id}")
    print(f"  Ad set:    {bm}/adsmanager/manage/adsets?act={account_id.replace('act_','')}&selected_adset_ids={adset_id}")
    print(f"  Ad:        {bm}/adsmanager/manage/ads?act={account_id.replace('act_','')}&selected_ad_ids={ad_id}")
    print()
    print("Activation checklist:")
    print("  [ ] Preview the video in Ads Manager — looks right?")
    print("  [ ] Confirm geo says 'New York, NY (+25 mi)'")
    print("  [ ] Confirm budget says $5.00 daily")
    print("  [ ] Confirm end date is 6 days out")
    print("  [ ] Toggle Campaign → Ad set → Ad to ACTIVE in that order")
    print()

    # Persist IDs
    out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".last-created.json")
    with open(out_path, "w") as f:
        json.dump({
            "created_at": datetime.now(timezone.utc).isoformat(),
            "campaign_id": campaign_id,
            "adset_id": adset_id,
            "creative_id": creative_id,
            "ad_id": ad_id,
            "video_id": video_id,
        }, f, indent=2)
    print(f"  IDs saved to: {out_path}")


if __name__ == "__main__":
    main()
