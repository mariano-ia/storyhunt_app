#!/usr/bin/env python3
"""Build the executable posting schedule for week of 2026-06-08 from the approved
plan (.last-analysis.json). Defines per-platform copy, resolves media file paths,
converts NYC local times to UTC ISO 8601, and writes .week-2026-06-08-schedule.json
for the Blotato scheduling step. storyhunt.city accounts ONLY.
"""
import json, os
from datetime import datetime
from zoneinfo import ZoneInfo

NYC = ZoneInfo("America/New_York")
UTC = ZoneInfo("UTC")
WEB = "/Users/marianonoceti/Desktop/Antigravity/StoryHuntWeb"

# storyhunt.city Blotato account ids
IG, TT, TH = "48407", "43287", "6850"

# Week dates (Mon=Jun 8 .. Sun=Jun 14, 2026)
DATE = {"mon": "2026-06-08", "tue": "2026-06-09", "wed": "2026-06-10",
        "thu": "2026-06-11", "fri": "2026-06-12", "sat": "2026-06-13", "sun": "2026-06-14"}

R = f"{WEB}/assets/reels/2w/produced"
MEDIA = {
    "reel-01": f"{R}/voicemail/reel-01-missed-call-1883.mp4",
    "reel-19": f"{R}/voicemail/reel-19-emily-roebling.mp4",
    "reel-03": f"{R}/price/reel-03-bus-tour-vs-storyhunt.mp4",
    "reel-10": f"{R}/tip/reel-10-bridge-wine-cellar.mp4",
    "reel-07": f"{R}/voicemail/reel-07-she-said-my-name.mp4",
    "reel-22": f"{R}/tip/reel-22-minetta-creek.mp4",
    "reel-06": f"{R}/urgency/reel-06-48h-weekend.mp4",
    "reel-04": f"{R}/historical/reel-04-roebling-erased.mp4",
    "reel-14": f"{R}/brand/reel-14-confessions.mp4",
    "reel-11": f"{R}/voicemail/reel-11-watching-midtown.mp4",
    "reel-27": f"{R}/tip/reel-27-dakota-name.mp4",
    "testimonial-v4": f"{WEB}/assets/reels/2w/delivery/2026-05-16-1900-testimonial-v4-ten-bucks-nobrainer 2.mp4",
    "feed-0605": f"{WEB}/assets/posts/2026-06-05-pm-mystery.png",
    "feed-0604": f"{WEB}/assets/posts/2026-06-04-am-data.png",
    "feed-0603": f"{WEB}/assets/posts/2026-06-03-pm-mystery.png",
    "NEW-1": "/tmp/new-videos/NEW-1-pov-brooklyn-bridge-final.mp4",
    "NEW-2": "/tmp/new-videos/NEW-2-reactivation-final.mp4",
    "NEW-4": "/tmp/new-videos/stories/NEW-4-story-1883-notification.png",
    "NEW-5": "/tmp/new-videos/stories/NEW-5-story-emily-voicemail.png",
    "NEW-6": "/tmp/new-videos/stories/NEW-6-story-pov-softcta.png",
    "NEW-3-carousel": [f"/tmp/new-videos/carousel-buildings/buildings-{i}.png" for i in range(1, 8)],
}

TAGS_NYC = "#nyc #newyorkcity #nyctravel #thingstodoinnyc #brooklynbridge #nychistory #hiddennyc"
TAGS_BK = "#nyc #brooklynbridge #brooklyn #nychistory #hiddennyc #nyctravel #nyctok"
TAGS_VILLAGE = "#nyc #westvillage #greenwichvillage #nychistory #hiddennyc #nyctravel"
TAGS_MIDTOWN = "#nyc #midtownmanhattan #grandcentral #nychistory #hiddennyc #nyctravel"

# ---- POSTS ----------------------------------------------------------------
# Each: id, day, time (NYC HH:MM), platforms[], asset, media key, caption (IG/TT),
# threads_text (for threads variant), story link, note
POSTS = [
    # ============ MONDAY (Jun 8) ============
    {  # reel-01 — Monday TikTok 08:00 PASSED -> rescheduled to 13:00
     "id": "mon-reel01-tt", "day": "mon", "time": "13:00", "platforms": [TT],
     "asset": "reel", "media": "reel-01", "ai": True, "tags": TAGS_BK,
     "caption": "A voicemail from 1883 just landed on your phone.\n\nThe Brooklyn Bridge has been trying to reach you. Most people walk across it and never hear a thing.\n\nNot a tour. Not a game. The city, talking.\n\nstoryhunt.city"},
    {  # feed mystery — Monday IG 12:00
     "id": "mon-feed-ig", "day": "mon", "time": "12:00", "platforms": [IG],
     "asset": "feed_image", "media": "feed-0605", "tags": TAGS_NYC,
     "caption": "Some blocks keep a secret on purpose.\n\nMost people walk straight past it. You don't have to.\n\nNot a tour. Not a game. NYC, talking to you. → link in bio."},
    {  # NEW-2 re-activation reel — Monday IG+TT+Threads 19:00
     "id": "mon-new2", "day": "mon", "time": "19:00", "platforms": [IG, TT, TH],
     "asset": "reel", "media": "NEW-2", "ai": True, "tags": TAGS_BK,
     "caption": "You paid. You never showed.\n\nHe's still standing at the Brooklyn Bridge, waiting for you to open the message. Your link still works.\n\nThe hunt doesn't expire just because you got busy. Finish what you started.\n\nstoryhunt.city",
     "threads_text": "You paid. You never showed.\n\nHe's still at the Brooklyn Bridge. Your link still works — the hunt doesn't expire because you got busy.\n\nFinish what you started. storyhunt.city"},

    # ============ TUESDAY (Jun 9) ============
    {  # reel-19 emily — Tue TikTok 08:00
     "id": "tue-reel19-tt", "day": "tue", "time": "08:00", "platforms": [TT],
     "asset": "reel", "media": "reel-19", "ai": True, "tags": TAGS_BK,
     "caption": "Her name isn't on the bridge. It should be.\n\nEmily Warren Roebling finished the Brooklyn Bridge when the men who started it couldn't. The city remembers. The plaques don't.\n\nstoryhunt.city"},
    {  # NEW-1 POV flagship — Tue IG+TT+Threads 19:00
     "id": "tue-new1", "day": "tue", "time": "19:00", "platforms": [IG, TT, TH],
     "asset": "reel", "media": "NEW-1", "ai": True, "tags": TAGS_BK,
     "caption": "The bridge is texting you. Everyone else is taking selfies.\n\nWalk across the Brooklyn Bridge and it has 140 years of secrets to tell — if you know how to listen. Most people never do.\n\nNot a tour. Not a game. NYC, talking to you.\n\nstoryhunt.city",
     "threads_text": "The bridge is texting you. Everyone else is taking selfies.\n\n140 years of secrets, and most people walk across without hearing one. storyhunt.city"},
    {  # NEW-4 story reactivation #1 — Tue IG story 20:00
     "id": "tue-new4-story", "day": "tue", "time": "20:00", "platforms": [IG],
     "asset": "story", "media": "NEW-4", "link": "https://storyhunt.city/play/architect",
     "caption": "1 unread message from 1883. Your hunt is still open."},

    # ============ WEDNESDAY (Jun 10) ============
    {  # reel-03 bus tour vs — Wed TikTok 08:00
     "id": "wed-reel03-tt", "day": "wed", "time": "08:00", "platforms": [TT],
     "asset": "reel", "media": "reel-03", "ai": True, "tags": TAGS_NYC,
     "caption": "A bus tour talks AT you through a microphone.\n\nStoryHunt lets the city talk TO you, through your phone. Same two hours. Completely different NYC.\n\nstoryhunt.city"},
    {  # reel-10 bridge wine cellar — Wed TikTok 17:00
     "id": "wed-reel10-tt", "day": "wed", "time": "17:00", "platforms": [TT],
     "asset": "reel", "media": "reel-10", "ai": True, "tags": TAGS_BK,
     "caption": "There's a wine cellar hidden inside the Brooklyn Bridge.\n\nThe anchorage held champagne for decades. You've walked over it and never knew.\n\nstoryhunt.city"},
    {  # NEW-3 carousel buildings — Wed IG carousel 12:00
     "id": "wed-new3-carousel", "day": "wed", "time": "12:00", "platforms": [IG],
     "asset": "carousel", "media": "NEW-3-carousel", "tags": TAGS_NYC,
     "caption": "5 NYC buildings hiding something inside — and you've walked past all of them.\n\nGrand Central's backwards sky. Catacombs under Old St. Patrick's. A bomber in the Empire State. The city is full of doors most people never open.\n\nSwipe through. Then let it tell you the rest. → link in bio.\n\nNot a tour. Not a game. NYC, talking to you."},
    {  # NEW-6 story POV soft CTA — Wed IG story 19:00
     "id": "wed-new6-story", "day": "wed", "time": "19:00", "platforms": [IG],
     "asset": "story", "media": "NEW-6", "link": "https://storyhunt.city/play/architect",
     "caption": "The bridge talks. Tap to listen."},
    {  # NEW-3 Threads founder text — Wed Threads 13:00
     "id": "wed-new3-threads", "day": "wed", "time": "13:00", "platforms": [TH],
     "asset": "text", "media": None,
     "threads_text": "Spent the morning digging into 5 NYC buildings that are hiding something inside.\n\nGrand Central's ceiling is painted backwards. There are catacombs under a cathedral on Mulberry St. A B-25 bomber flew into the Empire State in 1945 and the lights stayed on.\n\nYou've walked past all of them. The city just never told you. Posted the full carousel — go look."},

    # ============ THURSDAY (Jun 11) ============
    {  # reel-07 she said my name — Thu TikTok 08:00
     "id": "thu-reel07-tt", "day": "thu", "time": "08:00", "platforms": [TT],
     "asset": "reel", "media": "reel-07", "ai": True, "tags": TAGS_BK,
     "caption": "She said my name. I never told her my name.\n\nThat's the moment people realize StoryHunt isn't a recording. The Brooklyn Bridge knows who's walking across it.\n\nstoryhunt.city"},
    {  # reel-22 minetta village — Thu IG+TT+Threads 19:00
     "id": "thu-reel22", "day": "thu", "time": "19:00", "platforms": [IG, TT, TH],
     "asset": "reel", "media": "reel-22", "ai": True, "tags": TAGS_VILLAGE,
     "caption": "There's a creek still running under the West Village.\n\nMinetta Brook never left — it just went underground. The streets bend around water nobody can see anymore.\n\nNot a tour. Not a game. NYC, talking to you.\n\nstoryhunt.city",
     "threads_text": "There's a creek still running under the West Village. Minetta Brook never left — it went underground, and the streets still bend around water nobody can see. storyhunt.city"},
    {  # NEW-5 story reactivation #2 emily — Thu IG story 20:00
     "id": "thu-new5-story", "day": "thu", "time": "20:00", "platforms": [IG],
     "asset": "story", "media": "NEW-5", "link": "https://storyhunt.city/play/architect",
     "caption": "Emily's still trying to reach you. She finished the bridge. You bought the story — finish it."},

    # ============ FRIDAY (Jun 12) ============
    {  # reel-06 48h weekend — Fri TikTok 08:00
     "id": "fri-reel06-tt", "day": "fri", "time": "08:00", "platforms": [TT],
     "asset": "reel", "media": "reel-06", "ai": True, "tags": TAGS_NYC,
     "caption": "You've got 48 hours in NYC this weekend.\n\nDon't spend them behind glass on a bus. Let the city talk to you instead. Two hours, one walk, the New York nobody else sees.\n\nstoryhunt.city"},
    {  # reel-04 roebling erased — Fri IG+TT+Threads 18:00
     "id": "fri-reel04", "day": "fri", "time": "18:00", "platforms": [IG, TT, TH],
     "asset": "reel", "media": "reel-04", "ai": True, "tags": TAGS_BK,
     "caption": "They almost erased her from the bridge she built.\n\nEmily Warren Roebling ran the Brooklyn Bridge to completion for 11 years. History nearly forgot. The city didn't.\n\nNot a tour. Not a game. NYC, talking to you.\n\nstoryhunt.city",
     "threads_text": "They almost erased Emily Warren Roebling from the bridge she built. 11 years running the Brooklyn Bridge to completion, and history nearly forgot her. The city didn't. storyhunt.city"},
    {  # feed data — Fri IG 12:00
     "id": "fri-feed-ig", "day": "fri", "time": "12:00", "platforms": [IG],
     "asset": "feed_image", "media": "feed-0604", "tags": TAGS_NYC,
     "caption": "The numbers most New Yorkers never learn about their own city.\n\nNot a tour. Not a game. NYC, talking to you. → link in bio."},
    {  # NEW-2 Threads founder text — Fri Threads 15:00
     "id": "fri-new2-threads", "day": "fri", "time": "15:00", "platforms": [TH],
     "asset": "text", "media": None,
     "threads_text": "Honest founder moment: 27 people bought a StoryHunt for the Brooklyn Bridge and never opened it.\n\nThey paid. They got busy. The link's still sitting in an inbox somewhere.\n\nI keep thinking about that — a story bought and never heard. So this week I'm just going to say it plainly: if that's you, your link still works. The bridge is still there. Go finish it."},

    # ============ SATURDAY (Jun 13) ============
    {  # testimonial v4 — Sat TikTok 10:00
     "id": "sat-testimonial-tt", "day": "sat", "time": "10:00", "platforms": [TT],
     "asset": "reel", "media": "testimonial-v4", "ai": True, "tags": TAGS_NYC,
     "caption": "\"Ten bucks for two hours of NYC talking to me? No-brainer.\"\n\nLess than a bus tour ticket. None of the bus. storyhunt.city"},
    {  # reel-14 confessions — Sat IG+TT+Threads 19:00
     "id": "sat-reel14", "day": "sat", "time": "19:00", "platforms": [IG, TT, TH],
     "asset": "reel", "media": "reel-14", "ai": True, "tags": TAGS_NYC,
     "caption": "The city has been keeping things from you.\n\nEvery block you've rushed through has a confession. StoryHunt is the first time NYC gets to say it out loud — to you, through your phone.\n\nNot a tour. Not a game. NYC, talking to you.\n\nstoryhunt.city",
     "threads_text": "Every block you've rushed through has a confession. StoryHunt is the first time the city gets to say it out loud — to you, through your phone. storyhunt.city"},
    {  # feed mystery — Sat IG 13:00
     "id": "sat-feed-ig", "day": "sat", "time": "13:00", "platforms": [IG],
     "asset": "feed_image", "media": "feed-0603", "tags": TAGS_NYC,
     "caption": "You've walked past it a hundred times. It's been waiting.\n\nNot a tour. Not a game. NYC, talking to you. → link in bio."},

    # ============ SUNDAY (Jun 14) ============
    {  # reel-11 watching midtown — Sun TikTok 11:00
     "id": "sun-reel11-tt", "day": "sun", "time": "11:00", "platforms": [TT],
     "asset": "reel", "media": "reel-11", "ai": True, "tags": TAGS_MIDTOWN,
     "caption": "Something in Midtown has been watching you.\n\nGrand Central isn't just a station. The protocol runs deeper than the tracks. storyhunt.city"},
    {  # reel-27 dakota — Sun TikTok 18:00
     "id": "sun-reel27-tt", "day": "sun", "time": "18:00", "platforms": [TT],
     "asset": "reel", "media": "reel-27", "ai": True, "tags": TAGS_NYC,
     "caption": "Why is it called the Dakota?\n\nBecause in 1884 the Upper West Side felt as far away as the frontier. The name was a joke. It stuck.\n\nstoryhunt.city"},
    {  # NEW-1 Threads founder close — Sun Threads 20:00
     "id": "sun-new1-threads", "day": "sun", "time": "20:00", "platforms": [TH],
     "asset": "text", "media": None,
     "threads_text": "Sunday night thought:\n\nWalked the Brooklyn Bridge at golden hour today. Everyone around me was filming themselves. Not one person was looking up at the cables.\n\nThere are 140 years of stories in that thing. You can hear them if you stop performing for a second.\n\nThat's the whole idea behind what we're building. The city's been talking the whole time."},
]


def iso_utc(day, hhmm):
    h, m = map(int, hhmm.split(":"))
    dt = datetime.fromisoformat(DATE[day]).replace(hour=h, minute=m, tzinfo=NYC)
    return dt.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


out = []
for p in POSTS:
    media_key = p.get("media")
    media_paths = None
    if media_key:
        mv = MEDIA[media_key]
        media_paths = mv if isinstance(mv, list) else [mv]
    out.append({
        "id": p["id"], "day": p["day"], "date": DATE[p["day"]],
        "time_nyc": p["time"], "scheduled_utc": iso_utc(p["day"], p["time"]),
        "platforms": p["platforms"], "asset": p["asset"],
        "media_key": media_key, "media_paths": media_paths,
        "caption": p.get("caption"), "threads_text": p.get("threads_text"),
        "tags": p.get("tags"), "link": p.get("link"), "ai": p.get("ai", False),
    })

dest = "/Users/marianonoceti/Desktop/Antigravity/StoryHuntABM/marketing-review/.week-2026-06-08-schedule.json"
with open(dest, "w") as f:
    json.dump({"week_start": DATE["mon"], "accounts": {"ig": IG, "tiktok": TT, "threads": TH},
               "posts": out}, f, indent=2, ensure_ascii=False)

# Summary
plat = {IG: "IG", TT: "TT", TH: "TH"}
n_calls = sum(len(p["platforms"]) for p in out)
print(f"{len(out)} schedule rows -> {n_calls} platform-posts")
for p in out:
    pl = "+".join(plat[x] for x in p["platforms"])
    print(f"  {p['day']} {p['time_nyc']} [{pl:8}] {p['asset']:11} {p['media_key'] or '(text)'}")
print(f"\nwrote {dest}")
