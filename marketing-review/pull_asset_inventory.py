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

# strip leading "YYYY-MM-DD-HHMM-" and trailing " 2"/" 3" variant + extension
PREFIX_RE = re.compile(r"^\d{4}-\d{2}-\d{2}-\d{4}-")
VARIANT_RE = re.compile(r"(?:[ _-](?:final|v\d+))?(?: \d+)?\.(mp4|mov)$", re.I)


def slug_of(fname):
    name = PREFIX_RE.sub("", fname)
    name = VARIANT_RE.sub("", name)
    name = re.sub(r"\.(mp4|mov)$", "", name, flags=re.I)
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

    out = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "web_root": WEB_ROOT,
        "total_video_files": total_files,
        "unique_reel_count": len(all_slugs),
        "by_category": inventory,
        "note": (
            "These are ALREADY PRODUCED reels available to post immediately "
            "(origin=created). Reuse them for TikTok daily volume and IG. "
            "Render variants (' 2'/' 3') and date prefixes are deduped to slugs."
        ),
    }
    print(json.dumps(out, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
