#!/usr/bin/env python3
"""
Pull last 7 days of conversion metrics from PostHog for /start landing.
Outputs a JSON blob to stdout that analyze.py consumes.

Reads creds from ../.env.local. Run with:
    python3 pull_metrics.py > metrics.json
"""
import json
import os
import ssl
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()


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


def hogql(env, query, label):
    """Run a HogQL query against PostHog and return rows + columns."""
    host = env["POSTHOG_HOST"].rstrip("/")
    pid = env["POSTHOG_PROJECT_ID"]
    key = env["POSTHOG_PERSONAL_API_KEY"]
    url = f"{host}/api/projects/{pid}/query/"
    body = json.dumps({
        "query": {"kind": "HogQLQuery", "query": query}
    }).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, context=SSL_CTX, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return {"label": label, "columns": data.get("columns", []), "rows": data.get("results", [])}
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")[:500]
        return {"label": label, "error": f"{e.code} {e.reason}: {body}"}
    except Exception as e:
        return {"label": label, "error": str(e)}


def main():
    env = load_env()

    now = datetime.now(timezone.utc)
    week_end = now.replace(hour=23, minute=59, second=59, microsecond=0).strftime("%Y-%m-%d %H:%M:%S")
    week_start = (now - timedelta(days=7)).replace(hour=0, minute=0, second=0, microsecond=0).strftime("%Y-%m-%d %H:%M:%S")
    prev_end = (now - timedelta(days=7)).replace(hour=23, minute=59, second=59, microsecond=0).strftime("%Y-%m-%d %H:%M:%S")
    prev_start = (now - timedelta(days=14)).replace(hour=0, minute=0, second=0, microsecond=0).strftime("%Y-%m-%d %H:%M:%S")

    # --- Funnel queries (current week and previous week) ---
    # Stage 1: pageview on /start
    # Stage 2: view_item (fires when hunts list loads — proxy for "scrolled to offer")
    # Stage 3: begin_checkout (clicked a hunt card)
    # Stage 4: add_payment_info
    # Stage 5: purchase

    def funnel_query(start, end):
        return f"""
        SELECT
            countIf(event = '$pageview' AND properties.$pathname = '/start') AS start_pageviews,
            countIf(event = 'view_item') AS view_item,
            countIf(event = 'begin_checkout') AS begin_checkout,
            countIf(event = 'add_payment_info') AS add_payment_info,
            countIf(event = 'purchase') AS purchase
        FROM events
        WHERE timestamp >= toDateTime('{start}')
          AND timestamp <= toDateTime('{end}')
        """

    funnel_now = hogql(env, funnel_query(week_start, week_end), "funnel_last_7d")
    funnel_prev = hogql(env, funnel_query(prev_start, prev_end), "funnel_prev_7d")

    # --- Daily breakdown of /start pageviews + purchases ---
    daily_query = f"""
    SELECT
        toDate(timestamp) AS day,
        countIf(event = '$pageview' AND properties.$pathname = '/start') AS start_views,
        countIf(event = 'view_item') AS view_item,
        countIf(event = 'begin_checkout') AS begin_checkout,
        countIf(event = 'purchase') AS purchase
    FROM events
    WHERE timestamp >= toDateTime('{week_start}')
      AND timestamp <= toDateTime('{week_end}')
    GROUP BY day
    ORDER BY day ASC
    """
    daily = hogql(env, daily_query, "daily_breakdown_7d")

    # --- Top traffic sources to /start ---
    sources_query = f"""
    SELECT
        coalesce(properties.utm_source, properties.$referring_domain, 'direct') AS source,
        coalesce(properties.utm_campaign, '') AS campaign,
        count() AS sessions
    FROM events
    WHERE event = '$pageview'
      AND properties.$pathname = '/start'
      AND timestamp >= toDateTime('{week_start}')
      AND timestamp <= toDateTime('{week_end}')
    GROUP BY source, campaign
    ORDER BY sessions DESC
    LIMIT 15
    """
    sources = hogql(env, sources_query, "traffic_sources_7d")

    # --- Page depth: events fired per session on /start (rough engagement) ---
    engagement_query = f"""
    SELECT
        avg(events_per_session) AS avg_events_per_session,
        median(events_per_session) AS median_events_per_session,
        count() AS sessions_total
    FROM (
        SELECT
            properties.$session_id AS sid,
            count() AS events_per_session
        FROM events
        WHERE timestamp >= toDateTime('{week_start}')
          AND timestamp <= toDateTime('{week_end}')
          AND properties.$session_id IS NOT NULL
        GROUP BY sid
    )
    """
    engagement = hogql(env, engagement_query, "engagement_7d")

    # --- Device split for /start visitors ---
    device_query = f"""
    SELECT
        properties.$device_type AS device,
        count() AS views
    FROM events
    WHERE event = '$pageview'
      AND properties.$pathname = '/start'
      AND timestamp >= toDateTime('{week_start}')
      AND timestamp <= toDateTime('{week_end}')
    GROUP BY device
    ORDER BY views DESC
    """
    devices = hogql(env, device_query, "device_split_7d")

    out = {
        "generated_at": now.isoformat(),
        "windows": {
            "current": {"start": week_start, "end": week_end},
            "previous": {"start": prev_start, "end": prev_end},
        },
        "queries": {
            "funnel_last_7d": funnel_now,
            "funnel_prev_7d": funnel_prev,
            "daily_breakdown_7d": daily,
            "traffic_sources_7d": sources,
            "engagement_7d": engagement,
            "device_split_7d": devices,
        },
    }
    print(json.dumps(out, indent=2, default=str))


if __name__ == "__main__":
    main()
