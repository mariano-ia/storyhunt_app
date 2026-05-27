#!/usr/bin/env python3
"""
Pull the publishing status of last week's scheduled posts from Blotato, so the
weekly email can show a green "Todo publicado" label or a red alert listing any
posts that failed to publish.

Window: last 7 days (the week that just ran). Groups by state type
(published / failed / scheduled) and surfaces every failure with its error.

Usage:  python3 pull_blotato_status.py > .last-blotato-status.json
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

BASE = "https://backend.blotato.com/v2/posts"


def load_env():
    here = os.path.dirname(os.path.abspath(__file__))
    env_path = os.path.join(here, "..", ".env.local")
    env = {}
    if not os.path.exists(env_path):
        sys.exit(f"ERROR: .env.local not found at {env_path}")
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def fetch_posts(key, since, until):
    """Fetch all posts in the window, following pagination cursors."""
    items = []
    cursor = None
    for _ in range(10):  # safety cap
        params = {"since": since, "until": until, "limit": "50"}
        if cursor:
            params["cursor"] = cursor
        url = f"{BASE}?{urllib.parse.urlencode(params)}"
        req = urllib.request.Request(url, headers={"blotato-api-key": key, "Accept": "application/json"})
        try:
            with urllib.request.urlopen(req, context=SSL_CTX, timeout=30) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            return {"error": f"{e.code}: {e.read().decode('utf-8', 'replace')[:200]}"}
        batch = data.get("items", []) if isinstance(data, dict) else (data or [])
        items.extend(batch)
        cursor = data.get("cursor") if isinstance(data, dict) else None
        if not cursor:
            break
    return {"items": items}


def main():
    env = load_env()
    key = env.get("BLOTATO_API_KEY")
    now = datetime.now(timezone.utc)
    since = (now - timedelta(days=7)).strftime("%Y-%m-%dT%H:%M:%SZ")
    until = now.strftime("%Y-%m-%dT%H:%M:%SZ")

    if not key:
        print(json.dumps({"skipped": True, "reason": "BLOTATO_API_KEY not set"}))
        return

    res = fetch_posts(key, since, until)
    if "error" in res:
        print(json.dumps({"skipped": True, "reason": f"Blotato API error: {res['error']}"}))
        return

    published, failed, scheduled = [], [], []
    for p in res["items"]:
        state = (p.get("state") or {})
        t = state.get("type")
        row = {
            "platform": p.get("platform"),
            "text_preview": (p.get("text") or "")[:80],
            "post_time": p.get("postTime"),
        }
        if t == "published":
            row["url"] = state.get("postUrl")
            published.append(row)
        elif t == "failed":
            row["error"] = state.get("errorMessage")
            failed.append(row)
        elif t == "scheduled":
            scheduled.append(row)

    out = {
        "generated_at": now.isoformat(),
        "window": {"since": since, "until": until},
        "counts": {"published": len(published), "failed": len(failed), "scheduled": len(scheduled)},
        "all_published": len(failed) == 0 and len(published) > 0,
        "failed": failed,
    }
    print(json.dumps(out, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
