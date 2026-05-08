# conversion-review

Weekly autonomous CRO analysis of the `/start` landing. Pulls 7-day PostHog data, sends to Anthropic for analysis, emails the report via Resend. Runs every Monday 9 AM NYC via local macOS LaunchAgent on Mariano's Mac.

## Architecture

```
[ Mon 9 AM NYC ]
        |
        v
~/Library/LaunchAgents/com.storyhunt.conversion-review.plist  (schedule)
        |
        v
~/Library/Scripts/storyhunt/conversion-cron.sh                (TCC-safe wrapper)
        |
        v
StoryHuntABM/conversion-review/weekly-review.sh               (orchestrator)
        |
        +--> pull_metrics.py   → PostHog HogQL queries → metrics.json
        +--> analyze.py        → Anthropic Opus 4.7    → analysis.json
        +--> send_review.py    → Resend HTML email     → inbox
        +--> updates state.json with this run's proposals (last 12 kept)
```

## Files

| File | Purpose |
|---|---|
| `pull_metrics.py` | HogQL queries: funnel, daily breakdown, traffic sources, devices, engagement. Compares last 7d vs prior 7d. Outputs JSON. |
| `analyze.py` | Posts metrics + state history to Anthropic. System prompt enforces Spanish, structured JSON, max 3 proposals, no repeats from last 4 weeks. |
| `send_review.py` | Renders analysis as HTML email (dark header, metrics table, ranked proposal cards) and POSTs to Resend. |
| `weekly-review.sh` | Bash orchestrator with `trap` error handling + macOS notifications. |
| `state.json` | Last 12 runs' proposals + key metrics. Gitignored. Used as context so the model doesn't repeat already-tested hypotheses. |
| `review.log` | Timestamped pipeline log. Gitignored. |
| `.last-metrics.json` / `.last-analysis.json` | Per-run intermediate artifacts. Gitignored. |

## Required env vars (in `../.env.local`)

```
ANTHROPIC_API_KEY=sk-ant-...
POSTHOG_PERSONAL_API_KEY=phx_...     # NOT the project key — that's write-only
POSTHOG_PROJECT_ID=412804
POSTHOG_HOST=https://us.posthog.com  # NOT us.i.posthog.com (that's ingestion)
RESEND_API_KEY=re_...
NOTIFICATION_EMAIL=marianonoceti@gmail.com  # optional, falls back to this
```

## Manual trigger

```bash
bash conversion-review/weekly-review.sh
```

## Logs

- Wrapper: `~/Library/Logs/storyhunt-conversion-cron.log`
- launchd stdout/stderr: `~/Library/Logs/storyhunt-conversion-cron-stdout.log` / `-stderr.log`
- Pipeline: `conversion-review/review.log`

## Common adjustments

**Change cadence**: edit `~/Library/LaunchAgents/com.storyhunt.conversion-review.plist` → `StartCalendarInterval` (Weekday 0=Sun…6=Sat, plus Hour/Minute), then:
```bash
launchctl unload ~/Library/LaunchAgents/com.storyhunt.conversion-review.plist
launchctl load   ~/Library/LaunchAgents/com.storyhunt.conversion-review.plist
```

**Switch model**: edit `analyze.py` → `model="claude-opus-4-7"` (currently Opus 4.7). Sonnet 4.6 is ~5x cheaper, slightly less sharp.

**Tweak the analysis voice / output structure**: edit `SYSTEM_PROMPT` in `analyze.py`. Output schema is enforced by the prompt — if you change schema, also update the renderers in `send_review.py`.

**Change recipient**: set `NOTIFICATION_EMAIL` in `.env.local`.

**Add new metrics**: extend the HogQL queries in `pull_metrics.py`. The metrics blob flows opaquely through analyze.py to the model — no schema changes needed there. To surface a new metric in the email, add a row in `send_review.py:render_html` `metrics_rows`.

## Troubleshooting

**Email never arrives** → check `~/Library/Logs/storyhunt-conversion-cron-stderr.log`. Common issues:
- `403 error code: 1010` from Resend → User-Agent header missing (Cloudflare bot block). Already handled in `send_review.py`.
- Resend `from` domain not verified → `from` is hardcoded to `hello@storyhunt.city` (verified). If the domain ever loses verification, expect 422.

**Analysis returns `raw_output` + `error`** → max_tokens hit. Currently 4096 in `analyze.py:call_anthropic`. Bump if needed.

**PostHog returns empty rows** → verify `POSTHOG_PROJECT_ID` and that events are flowing. Snippet's `api_host` (`us.i.posthog.com`) and the API host (`us.posthog.com`) are different — make sure `.env.local` has the API one.

**Cron never fires** → `launchctl list | grep storyhunt` should show `com.storyhunt.conversion-review`. If missing, `launchctl load ...plist`. If present but never runs, check `StartCalendarInterval` weekday/hour values and confirm the Mac is awake at trigger time.

## Why local LaunchAgent and not Vercel cron

Mirrors the existing SEO pipeline pattern. Lives on Mariano's Mac, reads creds from `.env.local`, no Vercel deploy needed for prompt/query iteration. The cron runs only when the Mac is awake — fine for weekly cadence, not fine for sub-hour critical jobs.

## Cost (Anthropic)

- Opus 4.7 (current): ~$0.30 per run = ~$1.50/month
- Sonnet 4.6 (alternative): ~$0.06 per run = ~$0.30/month
