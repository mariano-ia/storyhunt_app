#!/usr/bin/env python3
"""
Pull recent organic social performance for StoryHunt.

Currently implemented:
    - Instagram (Graph API v25, INSTAGRAM_ACCESS_TOKEN): last ~30d of media
      with per-post insights (reach, saved, shares, likes, comments, views) and
      a computed engagement_rate. Flags which posts fall in the current 7d window.

Gracefully skipped until tokens exist:
    - TikTok  (needs TIKTOK_ACCESS_TOKEN — TikTok Display API)
    - YouTube (needs YOUTUBE_ACCESS_TOKEN — YouTube Data API; also needs a
      channel created on the Workspace account)

Each platform emits {"skipped": true, "reason": "..."} when its token is absent,
mirroring conversion-review/pull_meta_metrics.py so the pipeline never breaks.

Usage:  python3 pull_social_metrics.py > .last-social-metrics.json
"""
import json
import os
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()

GRAPH_VERSION = "v25.0"
GRAPH_BASE = f"https://graph.facebook.com/{GRAPH_VERSION}"
IG_ACCOUNT_ID = "17841444079999050"  # same id used by /api/cron/publish-instagram


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


def graph_get(endpoint, params):
    url = f"{GRAPH_BASE}/{endpoint}?{urllib.parse.urlencode(params)}"
    try:
        with urllib.request.urlopen(url, context=SSL_CTX, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")[:300]
        return {"error": f"{e.code} {e.reason}: {body}"}
    except Exception as e:
        return {"error": str(e)}


def media_insights(media_id, token, media_type):
    """Fetch per-post insights. Metric availability varies by media type, so we
    request a superset and tolerate partial failures."""
    # 'views' supersedes plays/impressions in v22+. saved/shares/reach are the
    # signals that matter for content strategy (intent > vanity likes).
    metrics = "reach,saved,shares,views,total_interactions"
    res = graph_get(f"{media_id}/insights", {"metric": metrics, "access_token": token})
    out = {}
    if isinstance(res, dict) and "data" in res:
        for row in res["data"]:
            name = row.get("name")
            values = row.get("values") or [{}]
            out[name] = values[0].get("value")
    elif isinstance(res, dict) and "error" in res:
        # Retry with the most universal subset if the superset was rejected
        res2 = graph_get(f"{media_id}/insights",
                         {"metric": "reach,saved,shares", "access_token": token})
        if isinstance(res2, dict) and "data" in res2:
            for row in res2["data"]:
                out[row.get("name")] = (row.get("values") or [{}])[0].get("value")
        else:
            out["_insights_error"] = res.get("error")
    return out


def pull_instagram(token, cur_start):
    if not token:
        return {"skipped": True, "reason": "INSTAGRAM_ACCESS_TOKEN not set"}

    since_30d = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
    media = graph_get(f"{IG_ACCOUNT_ID}/media", {
        "fields": "id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count",
        "since": since_30d,
        "limit": 50,
        "access_token": token,
    })
    if "error" in media:
        return {"skipped": True, "reason": f"IG media fetch failed: {media['error']}"}

    items = media.get("data", [])

    # Probe insights once. The current token only has publish scope, not
    # instagram_manage_insights — so reach/saved/shares come back as a (#10)
    # permission error. Detect that up front and skip the 47 wasted calls;
    # we still return captions + likes + comments (those come from the media
    # endpoint, which the publish token CAN read).
    insights_available = False
    insights_error = None
    if items:
        probe = media_insights(items[0]["id"], token, items[0].get("media_type"))
        if probe.get("_insights_error"):
            insights_error = probe["_insights_error"]
        elif probe:
            insights_available = True

    posts = []
    for m in items:
        ts = m.get("timestamp")
        try:
            posted = datetime.fromisoformat(ts.replace("Z", "+00:00")) if ts else None
        except (ValueError, AttributeError):
            posted = None
        likes = m.get("like_count") or 0
        comments = m.get("comments_count") or 0
        caption = (m.get("caption") or "").replace("\n", " ")
        row = {
            "id": m["id"],
            "permalink": m.get("permalink"),
            "media_type": m.get("media_product_type") or m.get("media_type"),
            "posted_at": ts,
            "in_current_window": bool(posted and posted >= cur_start),
            "caption_preview": caption[:140],
            "likes": likes,
            "comments": comments,
        }
        if insights_available:
            ins = media_insights(m["id"], token, m.get("media_type"))
            reach = ins.get("reach") or 0
            saved = ins.get("saved") or 0
            shares = ins.get("shares") or 0
            interactions = ins.get("total_interactions")
            if interactions is None:
                interactions = likes + comments + saved + shares
            row.update({
                "reach": reach,
                "views": ins.get("views"),
                "saved": saved,
                "shares": shares,
                "total_interactions": interactions,
                "engagement_rate_pct": round(100 * interactions / reach, 2) if reach else None,
            })
        posts.append(row)

    if insights_available:
        posts.sort(key=lambda p: (p.get("engagement_rate_pct") or 0), reverse=True)
    else:
        # No reach data — best available proxy is likes+comments
        posts.sort(key=lambda p: (p.get("likes", 0) + p.get("comments", 0)), reverse=True)

    return {
        "account": "storyhunt.city",
        "lookback_days": 30,
        "post_count": len(posts),
        "insights_available": insights_available,
        "insights_note": (
            None if insights_available else
            "Reach/saves/shares unavailable — INSTAGRAM_ACCESS_TOKEN lacks "
            "instagram_manage_insights scope. Regenerate the token with that "
            "scope to unlock full metrics. Only likes+comments shown for now."
        ),
        "insights_error": insights_error,
        "posts": posts,
    }


def main():
    env = load_env()
    now = datetime.now(timezone.utc)
    cur_start = now - timedelta(days=7)

    out = {
        "generated_at": now.isoformat(),
        "windows": {
            "current": {"since": cur_start.isoformat(), "until": now.isoformat()},
        },
        "instagram": pull_instagram(env.get("INSTAGRAM_ACCESS_TOKEN"), cur_start),
        "tiktok": (
            {"skipped": True, "reason": "TIKTOK_ACCESS_TOKEN not set — connect TikTok Display API"}
            if not env.get("TIKTOK_ACCESS_TOKEN")
            else {"skipped": True, "reason": "TikTok puller not yet implemented"}
        ),
        "youtube": (
            {"skipped": True, "reason": "YOUTUBE_ACCESS_TOKEN not set — channel pending on Workspace"}
            if not env.get("YOUTUBE_ACCESS_TOKEN")
            else {"skipped": True, "reason": "YouTube puller not yet implemented"}
        ),
    }
    print(json.dumps(out, indent=2, ensure_ascii=False, default=str))


if __name__ == "__main__":
    main()
