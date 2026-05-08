#!/bin/bash
# StoryHunt Conversion Review — weekly orchestrator
# - Pulls last 7d from PostHog
# - Sends to Anthropic for analysis
# - Emails the report via Resend
# - Appends entry to state.json so next run has context

PIPELINE_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_FILE="$PIPELINE_DIR/review.log"
METRICS_FILE="$PIPELINE_DIR/.last-metrics.json"
ANALYSIS_FILE="$PIPELINE_DIR/.last-analysis.json"
STATE_FILE="$PIPELINE_DIR/state.json"

cd "$PIPELINE_DIR" || exit 1

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

notify() {
    local title="$1"
    local message="$2"
    local sound="${3:-default}"
    osascript -e "display notification \"$message\" with title \"StoryHunt CRO\" subtitle \"$title\" sound name \"$sound\"" 2>/dev/null || true
}

on_error() {
    local exit_code=$?
    local line_no=$1
    log "ERROR at line $line_no (exit $exit_code)"
    notify "FAILED" "Review crashed at line $line_no — check review.log" "Basso"
    exit $exit_code
}

trap 'on_error $LINENO' ERR
set -e

log "=== Starting weekly conversion review ==="

# 1) Pull metrics
log "Pulling PostHog metrics..."
python3 pull_metrics.py > "$METRICS_FILE"
log "Metrics written: $(wc -c < "$METRICS_FILE" | tr -d ' ') bytes"

# 2) Analyze
log "Calling Anthropic for analysis..."
python3 analyze.py "$METRICS_FILE" "$STATE_FILE" > "$ANALYSIS_FILE"
log "Analysis written: $(wc -c < "$ANALYSIS_FILE" | tr -d ' ') bytes"

# 3) Send email
log "Sending review email..."
python3 send_review.py "$ANALYSIS_FILE" "$METRICS_FILE" 2>&1 | tee -a "$LOG_FILE"

# 4) Append to state for next run's context
log "Updating state.json..."
python3 - "$STATE_FILE" "$ANALYSIS_FILE" "$METRICS_FILE" <<'PYEOF'
import json
import sys
from datetime import datetime, timezone

state_path, analysis_path, metrics_path = sys.argv[1], sys.argv[2], sys.argv[3]

try:
    with open(state_path) as f:
        state = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    state = {"history": []}

with open(analysis_path) as f:
    analysis = json.load(f)
with open(metrics_path) as f:
    metrics = json.load(f)

state.setdefault("history", []).append({
    "run_at": datetime.now(timezone.utc).isoformat(),
    "window": metrics.get("windows", {}).get("current"),
    "key_metrics": analysis.get("key_metrics"),
    "executive_summary": analysis.get("executive_summary"),
    "proposals": [
        {"rank": p.get("rank"), "hypothesis": p.get("hypothesis"), "implementation": p.get("implementation")}
        for p in analysis.get("proposals", [])
    ],
})
# Keep last 12 entries
state["history"] = state["history"][-12:]

with open(state_path, "w") as f:
    json.dump(state, f, indent=2, default=str)
PYEOF

log "=== Done ==="
notify "OK" "Weekly review sent"
