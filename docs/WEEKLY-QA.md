# StoryHunt — QA cadence

This is the schedule for how often each QA phase should run, who/what runs it,
and what to do when it fails.

## TL;DR

| When | What runs | How |
|---|---|---|
| **Every push to main** | Phase 3 smoke (32 checks) | GitHub Action — automatic |
| **Mon 9 AM NYC** | Phases 1-7 (full audit) | `Skill: storyhunt-qa` via Claude or `bash scripts/post-deploy-smoke.sh` |
| **Before campaign launch** | Phase 4 end-to-end | Manual via Claude `Skill: storyhunt-qa` with depth (c) |
| **After incident** | Targeted phases | `Skill: storyhunt-qa` then add a check to the skill itself |

---

## 1. Per-deploy smoke (automated)

**Trigger:** Push to `main` on this repo.
**Where it runs:** GitHub Actions → `.github/workflows/post-deploy-smoke.yml`
**Wait time:** 90s for Vercel deploy, then runs the smoke script.
**What it checks:** 32 assertions across:

- ABM public endpoints (`/api/public/experiences`, `/api/checkout`, `/api/access/verify` with bad token)
- Lockdown regression guard (`/api/dashboard/funnel`, `/api/campaigns`, `/api/sessions` all 401 to anon)
- Firestore rules (8 collections must 403, `experiences` must still 200)
- 6 security headers on `/play/*`
- 8 web landings (`/secrets`, `/start`, `/privacy`, `/terms`, etc.)
- DNS auth (SPF apex, DKIM at `resend._domainkey`)
- `/api/debug/reconcile` reachable with CRON_SECRET

**Required GH secret:** `CRON_SECRET` — set in repo Settings → Secrets and variables → Actions.

**On failure:**
- GitHub Actions tab shows the failed check
- Default GH behavior emails the repo owner
- Re-run manually via the Actions tab if it's a transient

**Run it locally before pushing risky changes:**
```bash
bash scripts/post-deploy-smoke.sh
# or against a Vercel preview:
ABM_URL=https://your-preview.vercel.app bash scripts/post-deploy-smoke.sh
```

---

## 2. Weekly full audit (Mon 9 AM NYC)

**Who runs it:** Mariano via Claude — `/storyhunt-qa` skill.
**Depth:** Option (b) — Static + runtime smoke, ~5 min.
**Why Monday morning:** Catches anything that drifted over the weekend.
Aligns with the conversion-review LaunchAgent that already runs Mon 9 AM.

The skill walks through:

- **Phase 1** — Static code audit (client SDK in API, silent catches, TypeScript, ESLint)
- **Phase 2** — Env + config (Vercel crons, Stripe webhook URL, rules file in sync)
- **Phase 3** — Runtime smoke (same as the automated GitHub Action)
- **Phase 5** — Data reconciliation (sales vs sessions, unused tokens, contacts vs CAPI)
- **Phase 6** — Observability (cron last-run, error rates)
- **Phase 7** — Geographic ad delivery (Meta breakdown vs targeting)

(Phase 4 — end-to-end with real Stripe test session — runs only before major
launches because it writes test data to production.)

**Output:** Structured 🟢🟡🔴 table. Any 🔴 = stop ad spend and fix first.

---

## 3. Pre-campaign launch — end-to-end (Phase 4)

**When:** Before any meaningful spike in traffic (new ad campaign, OTA listing
going live, influencer push, press feature).
**Depth:** Option (c). ~15 min.
**Writes test data:** Yes — creates a real contact + Stripe test session.
**Cleanup:** Listed in the final report.

Run it via Claude:
> "Run QA depth (c) — about to launch <campaign name>."

---

## 4. Post-incident

When something breaks in prod:

1. Identify the failing surface (logs, customer report, dashboard).
2. Add a check for it in `scripts/post-deploy-smoke.sh` (catches the regression
   next time).
3. Add the check to the QA skill at
   `.claude/skills/storyhunt-qa/SKILL.md` under the appropriate Phase.
4. Bump the "Log of additions" section at the bottom of the skill.

Goal: **every past pain becomes a future warning.**

---

## Manual commands cheatsheet

```bash
# Full local smoke (32 checks against prod)
bash scripts/post-deploy-smoke.sh

# Smoke against a Vercel preview URL
ABM_URL=https://abm-git-feature-x.vercel.app bash scripts/post-deploy-smoke.sh

# Check who's in the admin allowlist
node scripts/check-admins.js

# Add an admin
node scripts/add-admin.js someone@example.com

# Reconcile sales vs sessions (last 14d)
curl "https://storyhunt-app.vercel.app/api/debug/reconcile?secret=$CRON_SECRET&days=14" | jq

# Deploy firestore.rules from local file
node scripts/deploy-firestore-rules.js

# Look up a specific user across collections + Resend
node scripts/lookup-user.js user@email.com

# Clean up legacy April sessions (already done; kept for posterity)
node scripts/cleanup-april-sessions.js   # dry run
node scripts/cleanup-april-sessions.js --delete

# Send the founders follow-up emails (DRY RUN by default)
node scripts/send-followup.js            # dry run
node scripts/send-followup.js --send     # actually sends
```

---

## What this whole setup is for

StoryHunt's history of bugs has a pattern: silent failures running for days
before someone notices (the 37-vs-1 PostHog count, the 100% no-email April
sessions, the 59-email Firestore leak). The QA cadence above is the
forcing function: every silent failure category gets a loud assertion.

The smoke script + GitHub Action means: if a future deploy breaks
`/api/dashboard/funnel`'s auth gate, or accidentally opens up the Firestore
rules, or removes the security headers — the smoke fails within 2 minutes of
the push, before any real user sees the regression.

The weekly skill keeps the slower things (data integrity, ad-delivery geo,
LLM cost drift) on a regular cadence.
