# Ad Campaigns: StoryHunt — Lead Magnet Funnel
**Date:** 2026-04-09
**Objective:** Email capture (lead generation) via 3 interactive lead magnets
**Platform:** Instagram (Feed + Stories + Reels)
**Budget:** $10-15/day split across 3 ads
**Coupon:** DECODED25 (25% off first hunt)

---

## Audience Targeting

### Audience 1: NYC Trip Planners
- **Geo:** US, UK, Canada, Australia
- **Interests:** "New York City travel", "NYC tourism", "Things to do in New York", "Trip planning"
- **Behavior:** Frequent international travelers
- **Age:** 22-45
- **Exclusion:** People living in NYC metro area

### Audience 2: Experience Seekers (NYC Locals)
- **Geo:** NYC metro area (25 mi radius from Manhattan)
- **Interests:** "Escape rooms", "Immersive experiences", "Walking tours", "Scavenger hunts", "Date night ideas"
- **Age:** 24-40

### Audience 3: Urban Explorers / Curiosity
- **Geo:** US + UK + Canada + Australia
- **Interests:** "Atlas Obscura", "Hidden places", "Urban exploration", "Secret NYC", "History", "Mystery games"
- **Age:** 20-45

---

## Ad A: /secrets — "5 Secrets Hidden in Plain Sight"

### Primary Text (3 variations)

**Short:**
5 secrets are hidden in plain sight across New York City. Most people walk right past them. Can you find them?

**Medium:**
There's a wine cellar sealed inside the Brooklyn Bridge since 1876. A subway station so beautiful they closed it to the public. A whisper gallery where spies passed secrets across 30 feet of silence.

5 locations. All real. All hidden in plain sight. Can you decode them?

**Long:**
Most people visit New York and see exactly what everyone else sees. The same streets. The same landmarks. The same photos.

But underneath all of that, there's a city most people never find. Wine cellars sealed inside bridges. Subway stations too beautiful for daily use. Doors that haven't been opened since 1830.

We found 5 of them. Tap to decode.

### Headlines (5 variations)
1. NYC has secrets. Can you find them?
2. 5 secrets hidden in plain sight
3. What most tourists never see in NYC
4. The city underneath the city
5. Decode New York

### Description
Tap to decode 5 hidden NYC locations

### CTA Button
Learn More

### Visual Brief
- **Format:** 1080x1080 (feed) + 1080x1920 (stories)
- **Template:** template-mystery.html
- **Background:** Dark NYC street photo (overhead shot of a hidden alley or old door)
- **Overlay:** Dark 70% opacity
- **Top label:** `TRANSMISSION_INTERCEPTED` in cyan monospace
- **Main text:** `5 SECRETS` (large, white, glitch text-shadow) / `HIDDEN IN PLAIN SIGHT` (red)
- **Bottom strip:** `DECODE_THE_CITY → storyhunt.city/secrets` in monospace
- **Logo:** Top-right corner

---

## Ad B: /intercepted — "The Intercepted Conversation"

### Primary Text (3 variations)

**Short:**
We intercepted a conversation between two people exploring tunnels under Midtown Manhattan. The signal was cut short. Read what we recovered.

**Medium:**
Two people. 2:47 AM. Tunnels under Midtown Manhattan that connect 7 buildings.

One of them found a door with a symbol on it. The message cuts off mid-sentence.

We recovered the conversation. Read it before it's gone.

**Long:**
At 2:47 AM, two people were exchanging messages about something they found under Midtown Manhattan. Tunnels. Old prohibition routes. Markings on the walls that pointed runners to the right speakeasy.

Then one of them found a door. A symbol they didn't recognize. The message was cut off mid-sentence.

We intercepted the conversation. We don't know how long we can keep it public. Read it now.

### Headlines (5 variations)
1. A conversation you weren't meant to read
2. SIGNAL_INTERCEPTED // MIDTOWN
3. Two people. A tunnel. A door.
4. They found something under Manhattan
5. The signal was cut short

### Description
Read the intercepted conversation

### CTA Button
Learn More

### Visual Brief
- **Format:** 1080x1080 (feed) + 1080x1920 (stories)
- **Template:** Custom (chat bubble mockup)
- **Background:** Pure black (#050505)
- **Content:** 3-4 chat bubbles arranged like a real conversation:
  - Left bubble (gray): "there are tunnels down here. actual tunnels. under midtown"
  - Right bubble (cyan tint): "they connect 7 buildings. built during prohibition."
  - Left bubble (gray): "hold on. there is a door at the end of this tunnel. it has a symbol on it. like a"
  - System message (red): `SIGNAL_LOST // CONNECTION_TERMINATED`
- **Top label:** `CONVERSATION_INTERCEPTED // 02:47 AM` in red monospace
- **Bottom:** Logo + `storyhunt.city/intercepted`

---

## Ad C: /voicemail — "The Recovered Voicemail"

### Primary Text (3 variations)

**Short:**
A voicemail was recovered at 4:12 AM from an unknown number. It describes a location somewhere in New York City. No one has identified it yet.

**Medium:**
4:12 AM. Unknown number. A voicemail that describes a side door with no number. A sealed entrance under a faded awning. A corridor with green and white tiles from 1912. Coordinates written in chalk on a concrete wall.

The location has never been identified. Play the voicemail.

**Long:**
Someone left a voicemail at 4:12 AM from an unknown number. No name. No context. Just a voice describing a location somewhere in New York City.

A side door. Red brick. A sealed grate that's actually an entrance. A corridor that goes north for 200 feet. Coordinates written in chalk on a concrete wall that point to another door.

No one has identified the location. No one has opened that door.

Play the voicemail. See if you can figure out where it is.

### Headlines (5 variations)
1. 4:12 AM. Unknown number.
2. A voicemail no one can explain
3. VOICEMAIL_RECOVERED // NYC
4. Can you identify this location?
5. Someone found a door. They left a message.

### Description
Play the recovered voicemail

### CTA Button
Learn More

### Visual Brief — Option 1 (Image)
- **Format:** 1080x1080 (feed) + 1080x1920 (stories)
- **Template:** template-mystery.html
- **Background:** Dark NYC photo (empty street at night, moody lighting)
- **Overlay:** Heavy dark overlay (80%)
- **Center element:** Audio waveform visual (5 bars, red) + play button icon
- **Top label:** `VOICEMAIL_RECOVERED // 04:12 AM // UNKNOWN_NUMBER` in cyan
- **Main text:** `PLAY THE` (white) / `VOICEMAIL` (red, large)
- **Bottom:** Logo + `storyhunt.city/voicemail`

### Visual Brief — Option 2 (15s Video)
- **Audio:** First 15 seconds of voicemail.mp3 (cuts at "the one with the faded awning")
- **Visual:** Black screen with animated waveform bars + subtitles appearing in sync
- **Text overlay:** `VOICEMAIL_RECOVERED // 04:12 AM` at top
- **End card (last 3 seconds):** `PLAY THE FULL VOICEMAIL → storyhunt.city/voicemail`
- **Logo:** Throughout

---

## Testing Plan

### Week 1: Creative Test
- Run all 3 ads to all 3 audiences ($5/day per ad)
- After 5 days, identify winner by:
  1. CTR (click-through rate)
  2. CPL (cost per lead / email capture)
  3. Engagement rate

### Week 2: Scale Winner
- Take best-performing ad + audience combination
- Increase budget to $15-20/day
- Test 2-3 copy variations of the winner
- Add retargeting audience (website visitors)

### Retargeting
- Anyone who visited /secrets, /intercepted, or /voicemail but didn't leave email
- Show them a different lead magnet ad
- Budget: $5/day

---

## Pixel & Tracking Setup

### Required before launching:
1. Install Meta Pixel on storyhunt.city
2. Fire `fbq('track', 'Lead')` event when email is submitted on each lead magnet
3. Create Custom Conversions in Meta Business Manager for each landing page
4. Set up Custom Audiences:
   - Website visitors (all pages, 30 days)
   - Lead magnet visitors who didn't convert (7 days)
   - Email submitters (for exclusion + lookalike)
