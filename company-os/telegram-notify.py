#!/usr/bin/env python3
"""
company-os Telegram bridge — outbound notifications.

The reusable notify() slot for the weekly OS loop, monthly board report, and
guardrail alerts. Reads TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID from the env or
from StoryHuntABM/.env.local (gitignored). No third-party deps.

Transport: tries urllib with verified TLS first (correct for a production
cron). If TLS verification fails (e.g. an intercepting proxy with a self-signed
root, as in some sandboxes), falls back to curl, which uses the system trust
store. Either path works.

Usage:
    python3 telegram-notify.py "your message"          # message as arg
    echo "your message" | python3 telegram-notify.py   # message via stdin
    python3 telegram-notify.py --test                  # bridge health check

Exit codes: 0 ok · 1 telegram error · 2 missing creds · 3 no message.
"""
import json
import os
import shutil
import ssl
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_LOCAL = os.path.join(REPO_ROOT, ".env.local")


def _load_env_local(path: str) -> None:
    """Populate os.environ from .env.local without overriding real env."""
    if not os.path.exists(path):
        return
    with open(path, "r", encoding="utf-8") as fh:
        for raw in fh:
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            key, val = key.strip(), val.strip().strip('"').strip("'")
            os.environ.setdefault(key, val)


def _send_via_curl(url: str, fields: dict) -> dict:
    curl = shutil.which("curl")
    if not curl:
        raise RuntimeError("curl not available for TLS fallback")
    cmd = [curl, "-s", url]
    for key, val in fields.items():
        cmd += ["--data-urlencode", f"{key}={val}"]
    out = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    return json.loads(out.stdout) if out.stdout else {"ok": False, "description": out.stderr.strip()}


def send(text: str, *, silent: bool = False) -> dict:
    _load_env_local(ENV_LOCAL)
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID")
    if not token or not chat_id:
        raise SystemExit(2)
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    fields = {
        "chat_id": chat_id,
        "text": text,
        "disable_notification": "true" if silent else "false",
        "disable_web_page_preview": "true",
    }
    try:
        data = urllib.parse.urlencode(fields).encode()
        with urllib.request.urlopen(urllib.request.Request(url, data=data), timeout=20) as resp:
            return json.loads(resp.read().decode())
    except (urllib.error.URLError, ssl.SSLError):
        return _send_via_curl(url, fields)


def main() -> int:
    args = sys.argv[1:]
    if args and args[0] == "--test":
        text = "company-os bridge test — if you see this, telegram-notify.py works."
    elif args:
        text = " ".join(args)
    elif not sys.stdin.isatty():
        text = sys.stdin.read().strip()
    else:
        sys.stderr.write("no message provided\n")
        return 3
    if not text:
        return 3
    try:
        res = send(text)
    except SystemExit:
        sys.stderr.write("missing TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID\n")
        return 2
    if not res.get("ok"):
        sys.stderr.write(f"telegram error: {res}\n")
        return 1
    print("sent")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
