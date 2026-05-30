#!/usr/bin/env python3
"""
Inventory the already-produced reels in the StoryHuntWeb repo so the weekly
plan can reuse them (origin = "created") instead of always requiring new
production. Critical for TikTok volume: we have 100+ reels ready to post.

Dedupes the " 2"/" 3"/" 4" render variants and the date-time prefixes down to
unique slugs, grouped by category folder.

Usage:  python3 pull_asset_inventory.py > .last-asset-inventory.json
"""
import json
import os
import re
import sys
from datetime import datetime, timezone

WEB_ROOT = "/Users/marianonoceti/Desktop/Antigravity/StoryHuntWeb"
# category folders worth surfacing to the planner
SCAN_DIRS = {
    "voicemail": "assets/reels/2w/produced/voicemail",
    "historical": "assets/reels/2w/produced/historical",
    "tip": "assets/reels/2w/produced/tip",
    "urgency": "assets/reels/2w/produced/urgency",
    "brand": "assets/reels/2w/produced/brand",
    "delivery": "assets/reels/2w/delivery",
    "organic": "assets/ads/videos/organic",
}

FEED_IMAGE_DIR = "assets/posts"

# strip leading "YYYY-MM-DD-HHMM-" and trailing " 2"/" 3" variant + extension
PREFIX_RE = re.compile(r"^\d{4}-\d{2}-\d{2}-\d{4}-")
VARIANT_RE = re.compile(r"(?:[ _-](?:final|v\d+))?(?: \d+)?\.(mp4|mov)$", re.I)

# feed post filenames look like "2026-05-28-am-mystery.png"
FEED_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}-")


def slug_of(fname):
    name = PREFIX_RE.sub("", fname)
    name = VARIANT_RE.sub("", name)
    name = re.sub(r"\.(mp4|mov)$", "", name, flags=re.I)
    return name.strip()


def feed_slug_of(fname):
    name = re.sub(r"\.png$", "", fname, flags=re.I)
    return name.strip()


def main():
    inventory = {}
    total_files = 0
    for category, rel in SCAN_DIRS.items():
        path = os.path.join(WEB_ROOT, rel)
        if not os.path.isdir(path):
            continue
        slugs = set()
        for f in os.listdir(path):
            if not f.lower().endswith((".mp4", ".mov")):
                continue
            total_files += 1
            slugs.add(slug_of(f))
        if slugs:
            inventory[category] = sorted(slugs)

    # Flatten a deduped master list of unique themes for the planner
    all_slugs = sorted({s for slugs in inventory.values() for s in slugs})

    # Feed images: pre-rendered single-image feed posts from StoryHuntWeb.
    # These are 1080-square static cards (mystery / data / quote / howitworks
    # templates). Listed separately so the planner can reuse them as
    # feed_image OR story media.
    feed_inventory = {}
    feed_total = 0
    feed_path = os.path.join(WEB_ROOT, FEED_IMAGE_DIR)
    if os.path.isdir(feed_path):
        for f in sorted(os.listdir(feed_path)):
            if not f.lower().endswith(".png"):
                continue
            # bucket by template type from filename suffix (mystery/data/quote/howitworks)
            slug = feed_slug_of(f)
            template = "other"
            for t in ("mystery", "data", "quote", "howitworks"):
                if slug.endswith(t):
                    template = t
                    break
            feed_inventory.setdefault(template, []).append(slug)
            feed_total += 1

    out = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "web_root": WEB_ROOT,
        "total_video_files": total_files,
        "unique_reel_count": len(all_slugs),
        "by_category": inventory,
        "feed_images": {
            "total": feed_total,
            "by_template": feed_inventory,
        },
        "note": (
            "Reels (by_category) and feed_images are ALREADY PRODUCED assets "
            "available to post immediately (origin=created). Reuse them for "
            "TikTok daily volume, IG reels, IG feed posts, and as story media. "
            "Render variants (' 2'/' 3') and date prefixes are deduped to slugs."
        ),
    }
    print(json.dumps(out, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
