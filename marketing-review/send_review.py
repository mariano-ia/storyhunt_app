#!/usr/bin/env python3
"""
Render the weekly content plan (analysis.json) into an HTML email and send via
Resend. Layout: exec summary, product/sales, social, decision framework,
"to produce" cards, a dated weekly calendar (one row per post, with platform
chips + created/new chips), experiment, analysis.

Usage:
    python3 send_review.py analysis.json [product.json] [social.json]
"""
import html as html_lib
import json
import os
import ssl
import sys
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta, timezone

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


def esc(s):
    return html_lib.escape(str(s) if s is not None else "")


PLATFORM_STYLE = {
    "instagram": ("IG", "#d6296b"),
    "tiktok": ("TikTok", "#111827"),
    "threads": ("Threads", "#374151"),
    "linkedin": ("LinkedIn", "#0a66c2"),
    "facebook": ("FB", "#1877f2"),
}
DAY_ES = {
    "monday": "Lun", "tuesday": "Mar", "wednesday": "Mié", "thursday": "Jue",
    "friday": "Vie", "saturday": "Sáb", "sunday": "Dom",
}


def chip(text, color, filled=True):
    if filled:
        return (f"<span style=\"font-family:'SF Mono',Menlo,monospace;font-size:10px;"
                f"background:{color};color:#fff;padding:2px 6px;border-radius:3px;"
                f"margin-right:4px;letter-spacing:.03em;\">{esc(text)}</span>")
    return (f"<span style=\"font-family:'SF Mono',Menlo,monospace;font-size:10px;"
            f"border:1px solid {color};color:{color};padding:1px 5px;border-radius:3px;"
            f"margin-right:4px;letter-spacing:.03em;\">{esc(text)}</span>")


def platform_chips(platforms):
    out = ""
    for p in platforms or []:
        label, color = PLATFORM_STYLE.get(str(p).lower(), (str(p), "#64748b"))
        out += chip(label, color)
    return out


def origin_chip(origin):
    if str(origin).lower() == "created":
        return chip("✓ ya creado", "#16a34a")
    return chip("⊕ a crear", "#f59e0b")


def render_status_banner(status):
    """Green 'Todo publicado' label, or red alert listing failed posts."""
    if not status or status.get("skipped"):
        return ""
    counts = status.get("counts", {})
    failed = status.get("failed", [])
    if status.get("all_published"):
        return (
            "<div style='background:#dcfce7;border:1px solid #16a34a;border-radius:8px;"
            "padding:12px 16px;margin-bottom:20px;'>"
            "<span style='font-size:15px;font-weight:700;color:#15803d;'>✓ Todo publicado</span>"
            f"<span style='font-size:13px;color:#166534;'> &nbsp;— {counts.get('published',0)} "
            "publicaciones de la semana pasada salieron sin errores.</span></div>"
        )
    if failed:
        rows = ""
        for f in failed:
            rows += (
                "<div style='font-size:13px;color:#7f1d1d;margin-top:6px;'>"
                f"<b>{esc(f.get('platform','?'))}</b> · {esc(f.get('text_preview',''))}<br>"
                f"<span style='font-size:12px;color:#b91c1c;'>{esc((f.get('error') or '')[:160])}</span></div>"
            )
        return (
            "<div style='background:#fef2f2;border:1px solid #dc2626;border-radius:8px;"
            "padding:12px 16px;margin-bottom:20px;'>"
            f"<span style='font-size:15px;font-weight:700;color:#b91c1c;'>⚠️ {len(failed)} "
            f"publicaci{'ón' if len(failed)==1 else 'ones'} fall{'ó' if len(failed)==1 else 'aron'} "
            "la semana pasada</span>"
            f"<span style='font-size:13px;color:#7f1d1d;'> &nbsp;({counts.get('published',0)} OK)</span>"
            f"{rows}</div>"
        )
    return ""


def kv_table(rows):
    body = "".join(
        f"<tr><td style='padding:8px 12px;color:#6b7280;font-size:13px;border-bottom:1px solid #f1f5f9;'>{esc(label)}</td>"
        f"<td style='padding:8px 12px;font-weight:600;color:#0f172a;font-size:14px;text-align:right;border-bottom:1px solid #f1f5f9;'>{esc(value)}</td></tr>"
        for label, value in rows if value is not None
    )
    return f"<table style='width:100%;border-collapse:collapse;margin-bottom:24px;'>{body}</table>"


def production_cards(items):
    if not items:
        return ""
    cards = ""
    for it in items:
        cat = esc(it.get("category", ""))
        ref = esc(it.get("ref_id", ""))
        cards += f"""
        <div style="border:1px dashed #f59e0b;border-radius:8px;padding:13px 15px;margin-bottom:10px;background:#fffbeb;">
          <div style="margin-bottom:6px;">{origin_chip('new')}
            <span style="font-family:'SF Mono',Menlo,monospace;font-size:10px;color:#b45309;">{esc(it.get('type',''))} · {cat} · {ref}</span></div>
          <div style="font-size:14px;color:#0f172a;margin-bottom:8px;line-height:1.5;">{esc(it.get('concept',''))}</div>
          <div style="background:#0f172a;color:#f1f5f9;font-family:'SF Mono',Menlo,monospace;font-size:13px;padding:9px 12px;border-radius:6px;line-height:1.5;">
            <span style="color:#22d3ee;font-size:10px;">HOOK</span><br>{esc(it.get('hook',''))}</div>
          {f'<div style="font-size:12px;color:#64748b;margin-top:6px;">→ {esc(it.get("experience"))}</div>' if it.get('experience') else ''}
        </div>"""
    return (
        "<div style=\"font-size:11px;font-family:'SF Mono',Menlo,monospace;color:#94a3b8;letter-spacing:.1em;margin-bottom:10px;\">"
        "A PRODUCIR (nuevo)</div>" + cards
    )


def render_schedule(schedule):
    """One row per day; each day lists its posts with platform + origin chips.
    Day 1 = upcoming Monday (today if Monday) — the week the content runs."""
    if not schedule:
        return ""
    today = date.today()
    days_ahead = (0 - today.weekday()) % 7
    week_start = today + timedelta(days=days_ahead)
    order = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    by_day = {str(s.get("day", "")).lower(): s for s in schedule}

    rows = ""
    for i, dname in enumerate(order):
        d = week_start + timedelta(days=i)
        date_label = f"{DAY_ES.get(dname, dname[:3])} {d.day:02d}/{d.month:02d}"
        posts = (by_day.get(dname, {}) or {}).get("posts", []) or []
        if not posts:
            cell = "<span style='color:#cbd5e1;font-size:12px;font-style:italic;'>—</span>"
        else:
            blocks = ""
            for p in posts:
                t = (p.get("time") or "").strip()
                blocks += (
                    "<div style='margin-bottom:6px;'>"
                    f"{platform_chips(p.get('platforms'))}{origin_chip(p.get('origin'))}"
                    f"<span style='font-size:13px;color:#334155;'>{esc(p.get('note',''))}</span>"
                    + (f"<span style='font-size:11px;color:#94a3b8;'> · {esc(p.get('ref'))}</span>" if p.get('ref') else "")
                    + (f"<span style='font-size:11px;color:#94a3b8;'> · {esc(t)}</span>" if t else "")
                    + "</div>"
                )
            cell = blocks
        rows += (
            "<tr>"
            f"<td style='padding:10px 12px;border-bottom:1px solid #f1f5f9;vertical-align:top;white-space:nowrap;'>"
            f"<span style='font-family:\"SF Mono\",Menlo,monospace;font-size:12px;font-weight:700;color:#0f172a;'>{esc(date_label)}</span></td>"
            f"<td style='padding:10px 12px;border-bottom:1px solid #f1f5f9;'>{cell}</td>"
            "</tr>"
        )
    week_label = f"{week_start.day:02d}/{week_start.month:02d}"
    return (
        "<div style=\"font-size:11px;font-family:'SF Mono',Menlo,monospace;color:#94a3b8;letter-spacing:.1em;margin:8px 0 4px;\">"
        f"CALENDARIO · SEMANA DEL {esc(week_label)}</div>"
        "<table style='width:100%;border-collapse:collapse;margin-bottom:8px;'>"
        f"{rows}</table>"
        "<div style='font-size:11px;color:#94a3b8;margin-bottom:24px;'>"
        f"{chip('✓ ya creado', '#16a34a')} = reel ya producido (listo para publicar) &nbsp; "
        f"{chip('⊕ a crear', '#f59e0b')} = pieza nueva a producir.<br>"
        "Para activar: respondé <b>“contenido aprobado”</b> y cargo todo en Blotato programado a estas fechas.</div>"
    )


def render_html(analysis, period_label, status=None):
    status_banner = render_status_banner(status)
    ps = analysis.get("product_state", {}) or {}
    ss = analysis.get("social_state", {}) or {}
    dfw = analysis.get("decision_framework", {}) or {}
    exp = analysis.get("experiment", {}) or {}

    product_tbl = kv_table([
        ("Ventas esta semana", ps.get("sales_this_week")),
        ("Δ vs semana anterior", ps.get("sales_wow")),
        ("Experiencia top", ps.get("top_experience")),
        ("Por source", ps.get("by_source")),
        ("Sesiones", ps.get("sessions_summary")),
        ("Tokens sin usar", ps.get("unused_tokens_note")),
    ])
    social_tbl = kv_table([
        ("Estado de métricas", ss.get("insights_status")),
        ("Mejor post", ss.get("best_post")),
        ("Plataformas activas", " · ".join(ss.get("platforms_active", []) or []) or None),
        ("Pendientes", ss.get("platforms_pending")),
    ])
    df_tbl = kv_table([
        ("Top content", dfw.get("top_content")),
        ("Top experience", dfw.get("top_experience")),
        ("Top platform", dfw.get("top_platform")),
        ("Por qué este experimento", dfw.get("experiment_rationale")),
    ])

    prod_html = production_cards(analysis.get("new_production", []))
    schedule_html = render_schedule(analysis.get("weekly_schedule", []))

    exp_html = ""
    if exp:
        exp_html = f"""
        <div style="border:1px dashed #f59e0b;border-radius:8px;padding:14px 16px;margin-bottom:20px;background:#fffbeb;">
          <div style="font-family:'SF Mono',Menlo,monospace;font-size:10px;color:#b45309;letter-spacing:.08em;margin-bottom:6px;">EXPERIMENTO DE LA SEMANA</div>
          <div style="font-size:14px;color:#0f172a;font-weight:600;margin-bottom:6px;">{esc(exp.get('hypothesis',''))}</div>
          <div style="font-size:13px;color:#334155;margin-bottom:4px;"><b>Probar:</b> {esc(exp.get('what_to_test',''))}</div>
          <div style="font-size:13px;color:#334155;"><b>Medir:</b> {esc(exp.get('how_to_measure',''))}</div>
        </div>"""

    return f"""<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;-webkit-font-smoothing:antialiased;">
<div style="max-width:660px;margin:0 auto;padding:32px 20px;">
  <div style="background:#0f172a;color:#fff;padding:20px 24px;border-radius:10px 10px 0 0;">
    <div style="font-family:'SF Mono',Menlo,monospace;font-size:11px;color:#f59e0b;letter-spacing:.14em;margin-bottom:6px;">// MARKETING_REVIEW</div>
    <div style="font-size:18px;font-weight:600;letter-spacing:-.01em;">Plan de contenido — semana {esc(period_label)}</div>
  </div>

  <div style="background:#fff;padding:24px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
    {status_banner}
    <div style="font-size:11px;font-family:'SF Mono',Menlo,monospace;color:#94a3b8;letter-spacing:.1em;margin-bottom:8px;">RESUMEN EJECUTIVO</div>
    <div style="font-size:15px;line-height:1.6;color:#0f172a;margin-bottom:24px;">{esc(analysis.get('executive_summary',''))}</div>

    <div style="font-size:11px;font-family:'SF Mono',Menlo,monospace;color:#94a3b8;letter-spacing:.1em;margin-bottom:8px;">PRODUCTO · VENTAS</div>
    {product_tbl}
    <div style="font-size:11px;font-family:'SF Mono',Menlo,monospace;color:#94a3b8;letter-spacing:.1em;margin-bottom:8px;">SOCIAL · PERFORMANCE</div>
    {social_tbl}
    <div style="font-size:11px;font-family:'SF Mono',Menlo,monospace;color:#94a3b8;letter-spacing:.1em;margin-bottom:8px;">DECISIÓN DE LA SEMANA</div>
    {df_tbl}

    {prod_html}

    {schedule_html}

    {exp_html}

    <div style="font-size:11px;font-family:'SF Mono',Menlo,monospace;color:#94a3b8;letter-spacing:.1em;margin-bottom:8px;">ANÁLISIS</div>
    <div style="font-size:14px;line-height:1.65;color:#1e293b;background:#f8fafc;padding:14px 16px;border-left:3px solid #f59e0b;border-radius:0 6px 6px 0;margin-bottom:24px;white-space:pre-wrap;">{esc(analysis.get('analysis',''))}</div>

    <div style="font-size:11px;font-family:'SF Mono',Menlo,monospace;color:#94a3b8;letter-spacing:.1em;margin:0 0 8px;">A MIRAR LA PRÓXIMA SEMANA</div>
    <div style="font-size:13px;line-height:1.6;color:#475569;border-top:1px dashed #e2e8f0;padding-top:14px;">{esc(analysis.get('watch_for_next_week',''))}</div>
  </div>

  <div style="background:#0f172a;color:#94a3b8;padding:14px 24px;border-radius:0 0 10px 10px;font-family:'SF Mono',Menlo,monospace;font-size:10px;letter-spacing:.08em;text-align:center;">
    Generado por marketing-review · {esc(datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC'))} · respondé “contenido aprobado” para activar
  </div>
</div>
</body></html>"""


def send_email(env, subject, html, to):
    api_key = env.get("RESEND_API_KEY")
    if not api_key:
        sys.exit("ERROR: RESEND_API_KEY not set")
    body = json.dumps({
        "from": "StoryHunt Marketing <hello@storyhunt.city>",
        "to": [to],
        "subject": subject,
        "html": html,
    }).encode("utf-8")
    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "storyhunt-marketing-review/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, context=SSL_CTX, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        sys.stderr.write(f"Resend HTTP {e.code}: {body}\n")
        raise


def main():
    if len(sys.argv) < 2:
        sys.exit("Usage: send_review.py analysis.json [product.json] [social.json]")

    with open(sys.argv[1]) as f:
        analysis = json.load(f)

    period_label = ""
    if len(sys.argv) >= 3 and os.path.exists(sys.argv[2]):
        with open(sys.argv[2]) as f:
            product = json.load(f)
        win = product.get("windows", {}).get("current", {})
        period_label = f"{win.get('since','')[:10]} → {win.get('until','')[:10]}"

    # publishing status of last week (green label / red alert)
    status = None
    status_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".last-blotato-status.json")
    if len(sys.argv) >= 5 and os.path.exists(sys.argv[4]):
        status_path = sys.argv[4]
    if os.path.exists(status_path):
        try:
            with open(status_path) as f:
                status = json.load(f)
        except json.JSONDecodeError:
            status = None

    env = load_env()
    to = env.get("MARKETING_NOTIFICATION_EMAIL") or env.get("NOTIFICATION_EMAIL", "marianonoceti@gmail.com")

    ps = analysis.get("product_state", {}) or {}
    n_posts = sum(len((d or {}).get("posts", []) or []) for d in analysis.get("weekly_schedule", []))
    # surface failures in the subject line too
    fail_n = (status or {}).get("counts", {}).get("failed", 0) if status else 0
    status_tag = f" · ⚠️ {fail_n} fallaron" if fail_n else ""
    subject = (
        f"StoryHunt MKT · {ps.get('top_experience','?')} top "
        f"· {ps.get('sales_this_week','?')} ventas · {n_posts} posts esta semana{status_tag}"
    )

    html = render_html(analysis, period_label, status=status)
    result = send_email(env, subject, html, to)
    print(json.dumps({"sent_to": to, "subject": subject, "resend_response": result}, indent=2))


if __name__ == "__main__":
    main()
