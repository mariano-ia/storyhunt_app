#!/usr/bin/env python3
"""
Circular QR sticker (print-ready SVG) for StoryHunt /scan. Brand fonts (Inter +
Space Mono), brand red #ff0033 + terminal green #00ff41. Two styles:

  STYLE=manhole (default) — dark NYC manhole cover, camouflages on the street
  STYLE=alert             — "intercepted signal": flat red + CRT scanlines, black
                            transmission bar with glowing "NYC IS TALKING TO YOU"

Usage:
  PYTHONPATH=/tmp/pylibs python3 stickers/generate-sticker.py                  # manhole
  STYLE=alert PYTHONPATH=/tmp/pylibs python3 stickers/generate-sticker.py      # alert
  STYLE=alert PYTHONPATH=/tmp/pylibs python3 stickers/generate-sticker.py soho # alert ?z=soho

Output: stickers/<style>-sticker[-<zone>].svg · print at 4" (100mm) · QR ecc H
Outline fonts before print (SVG @imports them from Google Fonts otherwise).
"""
import os, sys, segno

STYLE = os.environ.get("STYLE", "manhole")
zone = sys.argv[1] if len(sys.argv) > 1 else ""
url = "https://storyhunt.city/scan" + (f"?z={zone}" if zone else "")
out = f"stickers/{STYLE}-sticker{('-' + zone) if zone else ''}.svg"

# ── Geometry (mm) ──────────────────────────────────────────────────────────────
BLEED_R, CUT_R = 41.1, 38.1
SIZE = BLEED_R * 2
CX = CY = BLEED_R
TEXT_R = 33.2

F_DISPLAY = "'Inter','Arial Black',sans-serif"   # weight 900 — the hero face
F_MONO = "'Space Mono','Courier New',monospace"  # weight 700

qr = segno.make(url, error="h")
matrix = list(qr.matrix)
n = len(matrix)

def arc(rad, sweep):
    return f"M {CX-rad:.3f},{CY} A {rad},{rad} 0 0,{sweep} {CX+rad:.3f},{CY}"

def qr_block(cy_tile, plate, qr_size, tile, border, inner, tab_fill, tab_txt, qr_col, label):
    """Central QR tile (rounded square) + SCAN tab banner above it."""
    mm_ = qr_size / n
    qx, qy = CX - qr_size / 2, cy_tile - qr_size / 2
    rects = "\n      ".join(
        f'<rect x="{qx + c*mm_:.3f}" y="{qy + r*mm_:.3f}" width="{mm_+0.02:.3f}" height="{mm_+0.02:.3f}"/>'
        for r, row in enumerate(matrix) for c, val in enumerate(row) if val
    )
    ty = cy_tile - plate / 2
    return f'''
  <rect x="{CX-plate/2:.2f}" y="{ty:.2f}" width="{plate}" height="{plate}" rx="3.4" ry="3.4"
        fill="{tile}" stroke="{border}" stroke-width="1.3"/>
  <rect x="{CX-plate/2+1.1:.2f}" y="{ty+1.1:.2f}" width="{plate-2.2}" height="{plate-2.2}" rx="2.5" ry="2.5"
        fill="none" stroke="{inner}" stroke-width="0.3" opacity="0.4"/>
  <g fill="{qr_col}" shape-rendering="crispEdges">
      {rects}
  </g>
  <rect x="{CX-10:.2f}" y="{ty-5.8:.2f}" width="20" height="5.8" rx="2.9" ry="2.9" fill="{tab_fill}"/>
  <text x="{CX}" y="{ty-1.55:.2f}" text-anchor="middle" font-family="{F_MONO}" font-weight="700"
        font-size="3.4" letter-spacing="0.25" fill="{tab_txt}">{label}</text>'''

# ── Bodies ─────────────────────────────────────────────────────────────────────
if STYLE == "alert":
    BAR_TOP = CY + 13.5          # straight top edge of the black transmission bar
    body = f'''
  <!-- flat red field + CRT scanline texture -->
  <circle cx="{CX}" cy="{CY}" r="{BLEED_R}" fill="#ff0033"/>
  <rect x="0" y="0" width="{SIZE}" height="{SIZE}" fill="url(#scan)" clip-path="url(#disc)" opacity="0.45"/>

  <!-- black transmission bar (lower segment) -->
  <g clip-path="url(#disc)">
    <rect x="0" y="{BAR_TOP:.2f}" width="{SIZE}" height="{SIZE}" fill="#0a0a0a"/>
    <rect x="0" y="{BAR_TOP:.2f}" width="{SIZE}" height="0.5" fill="#ffffff" opacity="0.5"/>
  </g>

  <!-- top hook: Inter 900, solid black -->
  <g font-family="{F_DISPLAY}" font-weight="900" font-size="5.4" letter-spacing="0.02" text-anchor="middle" fill="#0a0a0a">
    <text><textPath href="#arcBot" startOffset="50%" dy="4.0">NOT A TOUR · NOT A GAME</textPath></text>
  </g>

  <!-- ominous transmission line: glowing terminal green on black -->
  <g font-family="{F_MONO}" font-weight="700" text-anchor="middle">
    <text x="{CX}" y="{CY+22.0:.2f}" font-size="4.0" letter-spacing="0.12" fill="#ffffff">NYC IS TALKING TO YOU</text>
    <text x="{CX}" y="{CY+28.5:.2f}" font-size="2.4" letter-spacing="0.45" fill="#ff0033">STORYHUNT · NYC</text>
  </g>
{qr_block(CY-5.0, 33, 26, "#ffffff", "#0a0a0a", "#0a0a0a", "#0a0a0a", "#ffffff", "#141110", "▶ SCAN")}'''
else:  # manhole
    body = f'''
  <circle cx="{CX}" cy="{CY}" r="{BLEED_R}" fill="url(#steel)"/>
  <circle cx="{CX}" cy="{CY}" r="{CUT_R-0.4}" fill="url(#steel)" stroke="#08090c" stroke-width="1.2"/>
  <circle cx="{CX}" cy="{CY}" r="{CUT_R-2.0}" fill="none" stroke="#3c424b" stroke-width="0.5" opacity="0.4"/>
  <circle cx="{CX}" cy="{CY}" r="29.2" fill="none" stroke="#08090c" stroke-width="0.9" opacity="0.85"/>
  <circle cx="{CX}" cy="{CY}" r="28.0" fill="none" stroke="#3c424b" stroke-width="0.4" opacity="0.4"/>
  <g font-family="{F_MONO}" font-weight="700" font-size="5.5" letter-spacing="0.06" text-anchor="middle">
    <text fill="#08090c" opacity="0.95"><textPath href="#arcBot" startOffset="50.4%" dy="4.15">NOT A TOUR · NOT A GAME</textPath></text>
    <text fill="#eef1f5"><textPath href="#arcBot" startOffset="50%" dy="3.95">NOT A TOUR · NOT A GAME</textPath></text>
    <text fill="#08090c" opacity="0.95"><textPath href="#arcTop" startOffset="50.4%" dy="-2.7">SCAN THE STREET</textPath></text>
    <text fill="#ff0033"><textPath href="#arcTop" startOffset="50%" dy="-2.95">SCAN THE STREET</textPath></text>
  </g>
  <text x="{CX}" y="{CY+35.6:.2f}" text-anchor="middle" font-family="{F_MONO}" font-weight="700"
        font-size="2.5" letter-spacing="0.2" fill="#eef1f5" opacity="0.8">STORYHUNT · NYC</text>
{qr_block(CY, 35, 27, "#efece4", "#ff0033", "#08090c", "#ff0033", "#ffffff", "#141110", "SCAN")}'''

svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="{SIZE}mm" height="{SIZE}mm" viewBox="0 0 {SIZE} {SIZE}">
  <title>StoryHunt {STYLE} sticker — {url}</title>
  <defs>
    <style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@700;900&amp;family=Space+Mono:wght@700&amp;display=swap');</style>
    <radialGradient id="steel" cx="42%" cy="36%" r="68%">
      <stop offset="0%" stop-color="#3c424b"/><stop offset="55%" stop-color="#23272d"/><stop offset="100%" stop-color="#121419"/>
    </radialGradient>
    <clipPath id="disc"><circle cx="{CX}" cy="{CY}" r="{CUT_R}"/></clipPath>
    <pattern id="scan" width="6" height="1.5" patternUnits="userSpaceOnUse">
      <rect width="6" height="0.7" fill="#9e001f"/>
    </pattern>
    <filter id="glow" x="-40%" y="-60%" width="180%" height="220%">
      <feGaussianBlur stdDeviation="0.75" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="b"/></feMerge>
    </filter>
    <path id="arcTop" d="{arc(TEXT_R, 0)}"/>
    <path id="arcBot" d="{arc(TEXT_R, 1)}"/>
  </defs>
{body}
  <circle id="cut-line" cx="{CX}" cy="{CY}" r="{CUT_R}" fill="none" stroke="#ff00ff" stroke-width="0.2" stroke-dasharray="1.2 1.2" opacity="0.0"/>
</svg>
'''

with open(out, "w") as f:
    f.write(svg)
print(f"wrote {out}  [{STYLE}]  ({url})  QR {n}x{n}")
