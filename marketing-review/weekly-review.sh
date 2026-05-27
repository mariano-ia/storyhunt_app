#!/bin/bash
# StoryHunt Marketing Review — weekly orchestrator
# - Pulls product snapshot (Firestore: experiences, sales, sessions, tokens)
# - Pulls social metrics (IG now; TikTok/YT graceful-skip until tokens exist)
# - Sends both to Anthropic → structured weekly CONTENT PLAN
# - Emails the plan via Resend
# - Appends entry to state.json so next run has context
#
# Mirrors conversion-review/weekly-review.sh conventions (set -e, trap, log,
# macOS notify, last-12 history). Runs Monday 10 AM NYC via LaunchAgent.

PIPELINE_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_FILE="$PIPELINE_DIR/review.log"
PRODUCT_FILE="$PIPELINE_DIR/.last-product-snapshot.json"
SOCIAL_FILE="$PIPELINE_DIR/.last-social-metrics.json"
INVENTORY_FILE="$PIPELINE_DIR/.last-asset-inventory.json"
STATUS_FILE="$PIPELINE_DIR/.last-blotato-status.json"
ANALYSIS_FILE="$PIPELINE_DIR/.last-analysis.json"
STATE_FILE="$PIPELINE_DIR/state.json"

cd "$PIPELINE_DIR" || exit 1

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

notify() {
    local title="$1"; local message="$2"; local sound="${3:-default}"
    osascript -e "display notification \"$message\" with title \"StoryHunt MKT\" subtitle \"$title\" sound name \"$sound\"" 2>/dev/null || true
}

on_error() {
    local exit_code=$?; local line_no=$1
    log "ERROR at line $line_no (exit $exit_code)"
    notify "FAILED" "Marketing review crashed at line $line_no — check review.log" "Basso"
    exit $exit_code
}

trap 'on_error $LINENO' ERR
set -e

log "=== Starting weekly marketing review ==="

# 1) Pull product snapshot (Node + firebase-admin)
log "Pulling product snapshot (Firestore)..."
node pull_product_snapshot.js > "$PRODUCT_FILE"
log "Product snapshot: $(wc -c < "$PRODUCT_FILE" | tr -d ' ') bytes"

# 2) Pull social metrics (IG; TikTok/YT graceful-skip)
log "Pulling social metrics..."
python3 pull_social_metrics.py > "$SOCIAL_FILE"
log "Social metrics: $(wc -c < "$SOCIAL_FILE" | tr -d ' ') bytes"

# 2b) Inventory already-produced reels (for reuse / volume)
log "Inventorying produced reels..."
python3 pull_asset_inventory.py > "$INVENTORY_FILE"
log "Asset inventory: $(wc -c < "$INVENTORY_FILE" | tr -d ' ') bytes"

# 2c) Last week's publishing status (green label / red alert in the email)
log "Checking last week's Blotato publishing status..."
python3 pull_blotato_status.py > "$STATUS_FILE"
log "Blotato status: $(wc -c < "$STATUS_FILE" | tr -d ' ') bytes"

# 3) Analyze → weekly content plan
log "Calling Anthropic for the weekly plan..."
python3 analyze.py "$PRODUCT_FILE" "$SOCIAL_FILE" "$STATE_FILE" "$INVENTORY_FILE" > "$ANALYSIS_FILE"
log "Analysis: $(wc -c < "$ANALYSIS_FILE" | tr -d ' ') bytes"

# 4) Send email
log "Sending plan email..."
python3 send_review.py "$ANALYSIS_FILE" "$PRODUCT_FILE" "$SOCIAL_FILE" "$STATUS_FILE" 2>&1 | tee -a "$LOG_FILE"

# 5) Append to state for next run's context
log "Updating state.json..."
python3 - "$STATE_FILE" "$ANALYSIS_FILE" "$PRODUCT_FILE" <<'PYEOF'
import json, sys
from datetime import datetime, timezone

state_path, analysis_path, product_path = sys.argv[1], sys.argv[2], sys.argv[3]
try:
    with open(state_path) as f:
        state = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    state = {"history": []}
with open(analysis_path) as f:
    analysis = json.load(f)
with open(product_path) as f:
    product = json.load(f)

state.setdefault("history", []).append({
    "run_at": datetime.now(timezone.utc).isoformat(),
    "window": product.get("windows", {}).get("current"),
    "product_state": analysis.get("product_state"),
    "decision_framework": analysis.get("decision_framework"),
    "new_production": [
        {"type": p.get("type"), "category": p.get("category"), "concept": p.get("concept"), "hook": p.get("hook")}
        for p in analysis.get("new_production", [])
    ],
    "experiment": (analysis.get("experiment") or {}).get("hypothesis"),
})
state["history"] = state["history"][-12:]
with open(state_path, "w") as f:
    json.dump(state, f, indent=2, default=str, ensure_ascii=False)
PYEOF

log "=== Done ==="
notify "OK" "Weekly marketing plan sent"
