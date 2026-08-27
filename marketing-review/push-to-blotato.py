#!/usr/bin/env python3
"""Upload all week-of-2026-06-08 media to Blotato and schedule the full week.
storyhunt.city accounts ONLY (IG 48407 / TikTok 43287 / Threads 6850).

Re-runnable: uploads cached in .week-uploads.json, scheduled posts recorded in
.week-posts-done.json so a re-run skips finished work (posts are NOT idempotent —
this guard prevents double-scheduling). The Monday reel-01 TikTok post was already
scheduled by the canary and is skipped here.
"""
import json, os, ssl, sys, time, urllib.request, urllib.error
import certifi

HERE = os.path.dirname(os.path.abspath(__file__))
CTX = ssl.create_default_context(cafile=certifi.where())
BASE = "https://backend.blotato.com"

def load_key():
    with open(os.path.join(HERE, "..", ".env.local")) as f:
        for line in f:
            line = line.strip()
            if line.startswith("BLOTATO_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit("no BLOTATO_API_KEY")

KEY = load_key()
HDR = {"blotato-api-key": KEY, "Content-Type": "application/json"}

PLATFORM = {"48407": "instagram", "43287": "tiktok", "6850": "threads"}
SKIP_IDS = {"mon-reel01-tt"}  # already scheduled by canary

UPLOADS_CACHE = os.path.join(HERE, ".week-uploads.json")
DONE_CACHE = os.path.join(HERE, ".week-posts-done.json")


def jget(path):
    return json.load(open(path)) if os.path.exists(path) else {}

def jsave(path, obj):
    json.dump(obj, open(path, "w"), indent=2)

def api_post(path, body):
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode(), headers=HDR, method="POST")
    try:
        with urllib.request.urlopen(req, context=CTX, timeout=60) as r:
            return r.getcode(), json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, {"error": e.read().decode("utf-8", "replace")[:300]}

def put_file(presigned, filepath):
    ct = "video/mp4" if filepath.endswith(".mp4") else "image/png"
    data = open(filepath, "rb").read()
    req = urllib.request.Request(presigned, data=data, headers={"Content-Type": ct}, method="PUT")
    with urllib.request.urlopen(req, context=CTX, timeout=300) as r:
        return r.getcode()


def upload(filepath, uploads):
    if filepath in uploads:
        return uploads[filepath]
    if not os.path.exists(filepath):
        raise FileNotFoundError(filepath)
    fn = os.path.basename(filepath).replace(" ", "-")
    code, res = api_post("/v2/media/uploads", {"filename": fn})
    if code not in (200, 201) or "presignedUrl" not in res:
        raise RuntimeError(f"presign failed {code}: {res}")
    put_code = put_file(res["presignedUrl"], filepath)
    if put_code not in (200, 201):
        raise RuntimeError(f"PUT failed {put_code} for {filepath}")
    uploads[filepath] = res["publicUrl"]
    jsave(UPLOADS_CACHE, uploads)
    print(f"  uploaded {fn} -> {res['publicUrl'].split('/')[-1]}", flush=True)
    return res["publicUrl"]


def build_target(plat, asset):
    if plat == "tiktok":
        return {"targetType": "tiktok", "privacyLevel": "PUBLIC_TO_EVERYONE",
                "disabledComments": False, "disabledDuet": False, "disabledStitch": False,
                "isBrandedContent": False, "isYourBrand": True, "isAiGenerated": True}
    if plat == "instagram":
        t = {"targetType": "instagram"}
        if asset == "reel":
            t["mediaType"] = "reel"
        elif asset == "story":
            t["mediaType"] = "story"
        return t
    if plat == "threads":
        return {"targetType": "threads"}
    raise ValueError(plat)


def build_text(plat, post):
    cap = post.get("caption")
    tags = post.get("tags")
    tx = post.get("threads_text")
    if plat == "threads":
        return tx or (cap or "").split("\n\nstoryhunt.city")[0]
    if post["asset"] == "story":
        return cap or ""
    base = cap or ""
    if tags:
        tag_list = tags.split()
        if plat == "instagram":   # IG rejects >5 hashtags per post
            tag_list = tag_list[:5]
        base = f"{base}\n\n{' '.join(tag_list)}"
    return base


def main():
    sched = json.load(open(os.path.join(HERE, ".week-2026-06-08-schedule.json")))
    uploads = jget(UPLOADS_CACHE)
    done = jget(DONE_CACHE)

    posts = sched["posts"]
    # Pre-upload all unique local media
    print("=== UPLOADS ===", flush=True)
    for p in posts:
        for fp in (p.get("media_paths") or []):
            if fp not in uploads:
                upload(fp, uploads)

    print("\n=== SCHEDULING ===", flush=True)
    ok = fail = skip = 0
    for p in posts:
        for acct in p["platforms"]:
            key = f"{p['id']}::{acct}"
            if p["id"] in SKIP_IDS or key in done:
                skip += 1
                continue
            plat = PLATFORM[acct]
            media_urls = [uploads[fp] for fp in (p.get("media_paths") or [])]
            body = {"post": {
                "accountId": acct,
                "target": build_target(plat, p["asset"]),
                "content": {"platform": plat, "text": build_text(plat, p), "mediaUrls": media_urls},
            }, "scheduledTime": p["scheduled_utc"]}
            code, res = api_post("/v2/posts", body)
            if code == 429:  # rate limited — back off and retry once
                time.sleep(50)
                code, res = api_post("/v2/posts", body)
            time.sleep(2)  # space calls to stay under the rate limit
            if code in (200, 201) and "postSubmissionId" in res:
                done[key] = res["postSubmissionId"]
                jsave(DONE_CACHE, done)
                ok += 1
                print(f"  OK   {p['day']} {p['time_nyc']} {plat:9} {p['asset']:11} {p['id']}", flush=True)
            else:
                fail += 1
                print(f"  FAIL {p['day']} {p['time_nyc']} {plat:9} {p['asset']:11} {p['id']} -> {code} {res}", flush=True)

    print(f"\n=== DONE: {ok} scheduled, {fail} failed, {skip} skipped ===")


if __name__ == "__main__":
    main()
