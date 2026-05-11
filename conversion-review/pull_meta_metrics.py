#!/usr/bin/env python3
"""
Pull last 7 days of Meta Ads performance for the StoryHunt2026 ad account.
Outputs a JSON blob to stdout that analyze.py merges into the LLM prompt
alongside PostHog data.

Reads creds from ../.env.local. Run with:
    python3 pull_meta_metrics.py > meta-metrics.json

Required env vars:
    META_ADS_TOKEN          long-lived user token with ads_read scope
    META_AD_ACCOUNT_ID      e.g. act_1614086746553655

If the token is missing/expired, emits a structured warning and exits 0
so the pipeline keeps running (analyze.py treats missing data gracefully).
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


API_VERSION = "v25.0"
BASE = f"https://graph.facebook.com/{API_VERSION}"


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


def fetch(token, endpoint, params=None):
    """GET /endpoint with params, returns parsed JSON or {'error': ...}."""
    qs = dict(params or {})
    qs["access_token"] = token
    url = f"{BASE}/{endpoint}?{urllib.parse.urlencode(qs)}"
    try:
        with urllib.request.urlopen(url, context=SSL_CTX, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")[:500]
        return {"error": f"{e.code} {e.reason}: {body}"}
    except Exception as e:
        return {"error": str(e)}


def summarize_actions(actions):
    """Meta returns actions as [{action_type, value}, ...]. Pivot to a dict."""
    if not actions or not isinstance(actions, list):
        return {}
    return {a.get("action_type"): a.get("value") for a in actions if "action_type" in a}


def insights(token, account_id, since, until, level="account"):
    """Fetch insights for an account or campaign in a time range."""
    params = {
        "fields": "spend,impressions,clicks,ctr,cpc,cpm,reach,frequency,actions,unique_clicks",
        "time_range": json.dumps({"since": since, "until": until}),
        "level": level,
    }
    return fetch(token, f"{account_id}/insights", params)


def campaigns_with_insights(token, account_id, since, until):
    """List campaigns with status + last-7d performance attached."""
    raw = fetch(token, f"{account_id}/campaigns", {
        "fields": (
            "name,status,effective_status,objective,daily_budget,"
            f"insights.time_range({{\"since\":\"{since}\",\"until\":\"{until}\"}})"
            "{spend,impressions,clicks,ctr,cpc,actions}"
        ),
        "limit": 50,
    })
    if "error" in raw:
        return raw
    out = []
    for c in raw.get("data", []):
        ins_data = (c.get("insights") or {}).get("data") or []
        ins = ins_data[0] if ins_data else {}
        actions_pivot = summarize_actions(ins.get("actions", []))
        out.append({
            "id": c.get("id"),
            "name": c.get("name"),
            "status": c.get("status"),
            "effective_status": c.get("effective_status"),
            "objective": c.get("objective"),
            "daily_budget_usd": float(c.get("daily_budget", 0)) / 100 if c.get("daily_budget") else None,
            "spend": ins.get("spend"),
            "impressions": ins.get("impressions"),
            "clicks": ins.get("clicks"),
            "ctr": ins.get("ctr"),
            "cpc": ins.get("cpc"),
            "link_click": actions_pivot.get("link_click"),
            "landing_page_view": actions_pivot.get("landing_page_view"),
            "video_view": actions_pivot.get("video_view"),
            "post_engagement": actions_pivot.get("post_engagement"),
        })
    # Sort by spend desc so the active spenders surface first
    out.sort(key=lambda x: float(x.get("spend") or 0), reverse=True)
    return {"data": out}


def daily_breakdown(token, account_id, since, until):
    """Day-by-day account-level numbers for trend visibility."""
    return fetch(token, f"{account_id}/insights", {
        "fields": "spend,impressions,clicks,ctr,actions",
        "time_range": json.dumps({"since": since, "until": until}),
        "time_increment": 1,
        "level": "account",
    })


def main():
    env = load_env()
    token = env.get("META_ADS_TOKEN")
    account_id = env.get("META_AD_ACCOUNT_ID")

    now = datetime.now(timezone.utc)
    # Use yesterday as the cutoff — Meta's "today" data is incomplete
    week_end_dt = (now - timedelta(days=1)).date()
    week_start_dt = week_end_dt - timedelta(days=6)
    prev_end_dt = week_start_dt - timedelta(days=1)
    prev_start_dt = prev_end_dt - timedelta(days=6)

    week_start = week_start_dt.isoformat()
    week_end = week_end_dt.isoformat()
    prev_start = prev_start_dt.isoformat()
    prev_end = prev_end_dt.isoformat()

    if not token or not account_id:
        # Graceful exit — pipeline keeps running
        out = {
            "generated_at": now.isoformat(),
            "skipped": True,
            "reason": (
                "META_ADS_TOKEN and/or META_AD_ACCOUNT_ID not set. "
                "Add both to .env.local to enable Meta enrichment."
            ),
            "windows": {
                "current": {"since": week_start, "until": week_end},
                "previous": {"since": prev_start, "until": prev_end},
            },
        }
        print(json.dumps(out, indent=2))
        return

    current = insights(token, account_id, week_start, week_end)
    previous = insights(token, account_id, prev_start, prev_end)
    campaigns = campaigns_with_insights(token, account_id, week_start, week_end)
    daily = daily_breakdown(token, account_id, week_start, week_end)

    # Flatten account-level current/previous to a single row
    def first_row(insights_response):
        if not isinstance(insights_response, dict) or "error" in insights_response:
            return insights_response
        rows = insights_response.get("data") or []
        if not rows:
            return {"empty": True}
        r = rows[0]
        return {
            "spend": r.get("spend"),
            "impressions": r.get("impressions"),
            "clicks": r.get("clicks"),
            "ctr": r.get("ctr"),
            "cpc": r.get("cpc"),
            "cpm": r.get("cpm"),
            "reach": r.get("reach"),
            "frequency": r.get("frequency"),
            "unique_clicks": r.get("unique_clicks"),
            "actions": summarize_actions(r.get("actions", [])),
        }

    out = {
        "generated_at": now.isoformat(),
        "account_id": account_id,
        "windows": {
            "current": {"since": week_start, "until": week_end},
            "previous": {"since": prev_start, "until": prev_end},
        },
        "account_summary": {
            "current": first_row(current),
            "previous": first_row(previous),
        },
        "campaigns": campaigns,
        "daily": daily,
    }
    print(json.dumps(out, indent=2, default=str))


if __name__ == "__main__":
    main()
