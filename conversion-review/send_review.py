#!/usr/bin/env python3
"""
Render analysis.json into an HTML email and send via Resend.

Usage:
    python3 send_review.py analysis.json [metrics.json] [meta-metrics.json]

If meta-metrics.json is provided and not skipped, a "Ads (Meta)" section is
added between the PostHog metrics and the analysis text.
"""
import html as html_lib
import json
import os
import ssl
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone

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


def render_html(analysis, metrics_window, meta_skipped=False):
    km = analysis.get("key_metrics", {})
    mm = analysis.get("meta_metrics", {}) or {}
    proposals = analysis.get("proposals", [])

    metrics_rows = "".join(
        f"<tr><td style='padding:8px 12px;color:#6b7280;font-size:13px;border-bottom:1px solid #f1f5f9;'>{esc(label)}</td>"
        f"<td style='padding:8px 12px;font-weight:600;color:#0f172a;font-size:14px;text-align:right;border-bottom:1px solid #f1f5f9;font-variant-numeric:tabular-nums;'>{esc(value)}</td></tr>"
        for label, value in [
            ("Visitas /start", km.get("start_pageviews")),
            ("view_item", km.get("view_item")),
            ("begin_checkout", km.get("begin_checkout")),
            ("add_payment_info", km.get("add_payment_info")),
            ("purchase", km.get("purchase")),
            ("Visita → checkout", km.get("view_to_checkout_rate")),
            ("Checkout → compra", km.get("checkout_to_purchase_rate")),
            ("Visita → compra", km.get("view_to_purchase_rate")),
            ("Δ visitas vs sem. ant.", km.get("wow_pageviews_delta_pct")),
            ("Δ compras vs sem. ant.", km.get("wow_purchases_delta_pct")),
            ("Fuente de tráfico top", km.get("top_traffic_source")),
            ("Split de devices", km.get("device_split")),
        ] if value is not None
    )

    meta_rows_html = ""
    if mm and not meta_skipped:
        meta_rows = "".join(
            f"<tr><td style='padding:8px 12px;color:#6b7280;font-size:13px;border-bottom:1px solid #f1f5f9;'>{esc(label)}</td>"
            f"<td style='padding:8px 12px;font-weight:600;color:#0f172a;font-size:14px;text-align:right;border-bottom:1px solid #f1f5f9;font-variant-numeric:tabular-nums;'>{esc(value)}</td></tr>"
            for label, value in [
                ("Spend (USD)", mm.get("spend_usd")),
                ("Δ spend vs sem. ant.", mm.get("spend_wow_delta_pct")),
                ("Impressions", mm.get("impressions")),
                ("Clicks", mm.get("clicks")),
                ("CTR", mm.get("ctr")),
                ("CPC", mm.get("cpc")),
                ("Landing page views", mm.get("landing_page_views")),
                ("Campañas activas", mm.get("active_campaigns")),
                ("Top campaña", mm.get("top_campaign")),
                ("CAC implícito (spend / compras)", mm.get("implicit_cac")),
            ] if value is not None
        )
        if meta_rows:
            meta_rows_html = (
                "<div style=\"font-size:11px;font-family:'SF Mono',Menlo,monospace;color:#94a3b8;letter-spacing:.1em;margin:0 0 8px;\">"
                "ADS · META</div>"
                "<table style='width:100%;border-collapse:collapse;margin-bottom:24px;'>"
                f"{meta_rows}"
                "</table>"
            )
    elif meta_skipped:
        meta_rows_html = (
            "<div style='font-size:12px;color:#94a3b8;font-style:italic;margin-bottom:20px;padding:10px 14px;"
            "background:#fef9c3;border-left:3px solid #ca8a04;border-radius:0 4px 4px 0;'>"
            "Meta Ads data no incluida — META_ADS_TOKEN no configurado o expirado. "
            "El análisis solo cubre PostHog esta semana.</div>"
        )

    effort_translate = {"low": "BAJO", "medium": "MEDIO", "high": "ALTO",
                        "bajo": "BAJO", "medio": "MEDIO", "alto": "ALTO"}
    effort_colors = {"BAJO": "#16a34a", "MEDIO": "#ca8a04", "ALTO": "#dc2626"}

    scope_colors = {
        "landing": "#0ea5e9",
        "ads": "#dc2626",
        "tracking": "#a855f7",
    }

    def proposal_card(p):
        rank = p.get("rank", "·")
        effort_raw = str(p.get("effort", "")).lower()
        effort_label = effort_translate.get(effort_raw, effort_raw.upper())
        effort_color = effort_colors.get(effort_label, "#6b7280")
        scope_raw = str(p.get("scope", "")).lower()
        scope_badge = (
            f"<span style=\"font-family:'SF Mono',Menlo,monospace;font-size:10px;"
            f"background:{scope_colors.get(scope_raw,'#64748b')};color:#fff;"
            "padding:2px 7px;border-radius:3px;letter-spacing:.08em;text-transform:uppercase;margin-right:8px;\">"
            f"{esc(scope_raw.upper())}</span>"
            if scope_raw else ""
        )
        return f"""
        <div style="border:1px solid #e2e8f0;border-radius:8px;padding:16px 18px;margin-bottom:14px;background:#fafafa;">
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;">
            <span>{scope_badge}<span style="font-family:'SF Mono',Menlo,monospace;font-size:11px;color:#94a3b8;letter-spacing:.08em;">PROPUESTA #{esc(rank)}</span></span>
            <span style="font-family:'SF Mono',Menlo,monospace;font-size:10px;color:{effort_color};letter-spacing:.08em;text-transform:uppercase;">ESFUERZO: {esc(effort_label)}</span>
          </div>
          <div style="font-size:15px;color:#0f172a;font-weight:600;margin-bottom:10px;line-height:1.4;">{esc(p.get('hypothesis',''))}</div>
          <div style="margin-bottom:8px;"><span style="font-family:'SF Mono',Menlo,monospace;font-size:10px;color:#64748b;letter-spacing:.08em;">EVIDENCIA</span>
            <div style="font-size:13px;color:#334155;line-height:1.55;margin-top:2px;">{esc(p.get('evidence',''))}</div></div>
          <div style="margin-bottom:8px;"><span style="font-family:'SF Mono',Menlo,monospace;font-size:10px;color:#64748b;letter-spacing:.08em;">IMPLEMENTACIÓN</span>
            <div style="font-size:13px;color:#334155;line-height:1.55;margin-top:2px;">{esc(p.get('implementation',''))}</div></div>
          <div><span style="font-family:'SF Mono',Menlo,monospace;font-size:10px;color:#64748b;letter-spacing:.08em;">VALIDAR CON</span>
            <div style="font-size:13px;color:#334155;line-height:1.55;margin-top:2px;">{esc(p.get('expected_impact',''))}</div></div>
        </div>
        """

    proposals_html = "".join(proposal_card(p) for p in proposals) or "<div style='color:#94a3b8;font-style:italic;'>Sin propuestas.</div>"

    window = metrics_window or {}
    period_label = f"{window.get('start','')[:10]} → {window.get('end','')[:10]}"

    return f"""<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;-webkit-font-smoothing:antialiased;">
<div style="max-width:640px;margin:0 auto;padding:32px 20px;">
  <div style="background:#0f172a;color:#fff;padding:20px 24px;border-radius:10px 10px 0 0;">
    <div style="font-family:'SF Mono',Menlo,monospace;font-size:11px;color:#22d3ee;letter-spacing:.14em;margin-bottom:6px;">// CONVERSION_REVIEW</div>
    <div style="font-size:18px;font-weight:600;letter-spacing:-.01em;">/start landing — semana {esc(period_label)}</div>
  </div>

  <div style="background:#fff;padding:24px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
    <div style="font-size:11px;font-family:'SF Mono',Menlo,monospace;color:#94a3b8;letter-spacing:.1em;margin-bottom:8px;">RESUMEN EJECUTIVO</div>
    <div style="font-size:15px;line-height:1.6;color:#0f172a;margin-bottom:24px;">{esc(analysis.get('executive_summary',''))}</div>

    <div style="font-size:11px;font-family:'SF Mono',Menlo,monospace;color:#94a3b8;letter-spacing:.1em;margin-bottom:8px;">FUNNEL · POSTHOG</div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      {metrics_rows}
    </table>

    {meta_rows_html}

    <div style="font-size:11px;font-family:'SF Mono',Menlo,monospace;color:#94a3b8;letter-spacing:.1em;margin-bottom:8px;">ANÁLISIS</div>
    <div style="font-size:14px;line-height:1.65;color:#1e293b;background:#f8fafc;padding:14px 16px;border-left:3px solid #22d3ee;border-radius:0 6px 6px 0;margin-bottom:24px;white-space:pre-wrap;">{esc(analysis.get('analysis',''))}</div>

    <div style="font-size:11px;font-family:'SF Mono',Menlo,monospace;color:#94a3b8;letter-spacing:.1em;margin-bottom:10px;">PROPUESTAS</div>
    {proposals_html}

    <div style="font-size:11px;font-family:'SF Mono',Menlo,monospace;color:#94a3b8;letter-spacing:.1em;margin:24px 0 8px;">A MIRAR LA PRÓXIMA SEMANA</div>
    <div style="font-size:13px;line-height:1.6;color:#475569;border-top:1px dashed #e2e8f0;padding-top:14px;">{esc(analysis.get('watch_for_next_week',''))}</div>
  </div>

  <div style="background:#0f172a;color:#94a3b8;padding:14px 24px;border-radius:0 0 10px 10px;font-family:'SF Mono',Menlo,monospace;font-size:10px;letter-spacing:.08em;text-align:center;">
    Generado por conversion-review · enviado {esc(datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC'))}
  </div>
</div>
</body></html>"""


def send_email(env, subject, html, to):
    api_key = env.get("RESEND_API_KEY")
    if not api_key:
        sys.exit("ERROR: RESEND_API_KEY not set")
    body = json.dumps({
        "from": "StoryHunt CRO <hello@storyhunt.city>",
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
            "User-Agent": "storyhunt-conversion-review/1.0",
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
        sys.exit("Usage: send_review.py analysis.json [metrics.json] [meta-metrics.json]")

    with open(sys.argv[1], "r") as f:
        analysis = json.load(f)

    metrics_window = None
    if len(sys.argv) >= 3 and os.path.exists(sys.argv[2]):
        with open(sys.argv[2], "r") as f:
            metrics = json.load(f)
        metrics_window = metrics.get("windows", {}).get("current", {})

    meta_skipped = False
    if len(sys.argv) >= 4 and os.path.exists(sys.argv[3]):
        try:
            with open(sys.argv[3], "r") as f:
                mm = json.load(f)
            meta_skipped = bool(mm.get("skipped"))
        except json.JSONDecodeError:
            pass

    env = load_env()
    to = env.get("NOTIFICATION_EMAIL", "marianonoceti@gmail.com")

    km = analysis.get("key_metrics", {})
    mm_subj = analysis.get("meta_metrics", {}) or {}
    period = ""
    if metrics_window:
        period = f" · semana del {metrics_window.get('start','')[:10]}"
    spend_part = ""
    if mm_subj.get("spend_usd"):
        spend_part = f" · Meta {mm_subj['spend_usd']}"
    subject = f"StoryHunt /start{period} · {km.get('start_pageviews','?')} visitas · {km.get('purchase','?')} compras{spend_part}"

    html = render_html(analysis, metrics_window, meta_skipped=meta_skipped)

    result = send_email(env, subject, html, to)
    print(json.dumps({"sent_to": to, "subject": subject, "resend_response": result}, indent=2))


if __name__ == "__main__":
    main()
