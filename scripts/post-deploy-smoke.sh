#!/usr/bin/env bash
# StoryHunt — post-deploy smoke test.
# Hits the deployed surfaces and verifies expected behavior. Exit code is the
# number of failed checks (0 = all green).
#
# Run manually: bash scripts/post-deploy-smoke.sh
# Run from CI:  uses ABM_URL + WEB_URL + CRON_SECRET env vars.

# Note: not using `set -u` — macOS ships bash 3.x where empty-array
# expansion under -u is buggy.

ABM_URL="${ABM_URL:-https://storyhunt-app.vercel.app}"
WEB_URL="${WEB_URL:-https://storyhunt.city}"
PROJECT="${FIREBASE_PROJECT:-storyhunt-platform-961ec}"

# Pull CRON_SECRET from .env.local if not set in env (local dev convenience).
if [ -z "${CRON_SECRET:-}" ] && [ -f ".env.local" ]; then
    CRON_SECRET=$(grep '^CRON_SECRET=' .env.local | head -1 | cut -d'=' -f2- | tr -d '"' | tr -d "'")
fi

# Counters.
PASS=0
FAIL=0
FAILED_CHECKS=()

# Print result row.
result() {
    local status="$1" name="$2" detail="$3"
    if [ "$status" = "PASS" ]; then
        printf "  \033[32m✓\033[0m  %-55s  %s\n" "$name" "$detail"
        PASS=$((PASS+1))
    else
        printf "  \033[31m✗\033[0m  %-55s  %s\n" "$name" "$detail"
        FAIL=$((FAIL+1))
        FAILED_CHECKS+=("$name — $detail")
    fi
}

# HTTP status code assertion. Variadic — all args after `want` are passed
# verbatim to curl (e.g. -X POST -H "Content-Type: application/json" -d '...').
assert_status() {
    local name="$1" url="$2" want="$3"
    shift 3

    local code
    code=$(curl -sS -o /dev/null -w "%{http_code}" "$@" "$url" 2>/dev/null || echo "ERR")
    if [ "$code" = "$want" ]; then
        result PASS "$name" "$code"
    else
        result FAIL "$name" "expected $want, got $code"
    fi
}

# Header assertion (substring match on a header value).
assert_header() {
    local name="$1" url="$2" header="$3" expect="$4"
    local val
    val=$(curl -sI "$url" 2>/dev/null | grep -i "^$header:" | head -1 | tr -d '\r')
    if echo "$val" | grep -qi "$expect"; then
        result PASS "$name" "${val:0:80}"
    else
        result FAIL "$name" "missing or wrong: '$val'"
    fi
}

echo ""
echo "──────────────────────────────────────────────────────────────────────────"
echo "  StoryHunt — post-deploy smoke"
echo "  ABM:  $ABM_URL"
echo "  Web:  $WEB_URL"
echo "  $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "──────────────────────────────────────────────────────────────────────────"

echo ""
echo "── ABM public endpoints ─────────────────────────────────────────────────"
assert_status "/api/public/experiences"               "$ABM_URL/api/public/experiences"  200
assert_status "/api/access/verify (bad token = 404)"  "$ABM_URL/api/access/verify"       404  -X POST  -H "Content-Type: application/json"  -d '{"token":"SH-DOESNTEXIST99"}'
assert_status "/api/checkout (valid request)"         "$ABM_URL/api/checkout"            200  -X POST  -H "Content-Type: application/json"  -d '{"experience_id":"4qtIlakWYLhoCJzzMWQT","lang":"en"}'

echo ""
echo "── ABM lockdown — these MUST require auth (regression guard) ───────────"
assert_status "/api/dashboard/funnel rejects anon"    "$ABM_URL/api/dashboard/funnel?days=7"  401
assert_status "/api/campaigns rejects anon"           "$ABM_URL/api/campaigns"                401
assert_status "/api/sessions rejects anon"            "$ABM_URL/api/sessions"                 401

echo ""
echo "── Firestore rules — PII collections must reject anonymous reads ───────"
for COL in access_tokens discount_coupons events stripe_events sales user_sessions interactions admins; do
    assert_status "Firestore $COL → 403"               "https://firestore.googleapis.com/v1/projects/$PROJECT/databases/(default)/documents/$COL?pageSize=1"  403
done
assert_status "Firestore experiences → 200 (player)"  "https://firestore.googleapis.com/v1/projects/$PROJECT/databases/(default)/documents/experiences?pageSize=1"  200

echo ""
echo "── Security headers on /play/* ─────────────────────────────────────────"
PLAY_URL="$ABM_URL/play/4qtIlakWYLhoCJzzMWQT"
assert_header "X-Frame-Options DENY"                  "$PLAY_URL"  "X-Frame-Options"          "DENY"
assert_header "X-Content-Type-Options nosniff"        "$PLAY_URL"  "X-Content-Type-Options"   "nosniff"
assert_header "Referrer-Policy strict-origin"         "$PLAY_URL"  "Referrer-Policy"          "strict-origin"
assert_header "Permissions-Policy present"            "$PLAY_URL"  "Permissions-Policy"       "camera"
assert_header "Strict-Transport-Security max-age"     "$PLAY_URL"  "Strict-Transport-Security" "max-age"
assert_header "X-Robots-Tag noindex on /play/*"       "$PLAY_URL"  "X-Robots-Tag"             "noindex"

echo ""
echo "── Web landings ────────────────────────────────────────────────────────"
for P in secrets intercepted voicemail start founders privacy terms refund-policy; do
    assert_status "/$P"                                "$WEB_URL/$P"  200
done

echo ""
echo "── Email auth (DNS) ────────────────────────────────────────────────────"
if command -v dig >/dev/null; then
    SPF=$(dig TXT storyhunt.city +short @8.8.8.8 2>/dev/null | grep -c 'v=spf1')
    if [ "$SPF" -ge 1 ]; then
        result PASS "Apex SPF record present"  "v=spf1 found"
    else
        result FAIL "Apex SPF record present"  "no v=spf1 TXT at apex"
    fi
    DKIM=$(dig TXT resend._domainkey.storyhunt.city +short @8.8.8.8 2>/dev/null | grep -c 'p=')
    if [ "$DKIM" -ge 1 ]; then
        result PASS "Resend DKIM record present"  "p=... found"
    else
        result FAIL "Resend DKIM record present"  "no DKIM at resend._domainkey"
    fi
else
    echo "  (dig not installed — skipping DNS checks)"
fi

echo ""
echo "── Stripe webhook + diagnostic endpoint ────────────────────────────────"
if [ -n "${CRON_SECRET:-}" ]; then
    assert_status "/api/debug/reconcile (with CRON_SECRET)"  "$ABM_URL/api/debug/reconcile?secret=$CRON_SECRET&days=7"  200
else
    echo "  (CRON_SECRET not set — skipping debug reconcile)"
fi

echo ""
echo "──────────────────────────────────────────────────────────────────────────"
TOTAL=$((PASS + FAIL))
if [ "$FAIL" -eq 0 ]; then
    printf "  \033[32m✓ ALL CHECKS PASSED\033[0m  (%d/%d)\n" "$PASS" "$TOTAL"
    echo "──────────────────────────────────────────────────────────────────────────"
    exit 0
else
    printf "  \033[31m✗ %d FAILED\033[0m  (out of %d)\n" "$FAIL" "$TOTAL"
    echo ""
    echo "  Failed checks:"
    for c in "${FAILED_CHECKS[@]}"; do echo "    - $c"; done
    echo "──────────────────────────────────────────────────────────────────────────"
    exit "$FAIL"
fi
