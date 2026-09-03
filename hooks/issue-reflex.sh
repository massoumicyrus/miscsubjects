#!/usr/bin/env bash
# Issue reflex — background CLI agent team with scoped brief (fast return).
# Usage: echo 'brief' | hooks/issue-reflex.sh source agents cwd mode delivery
set -euo pipefail

SOURCE="${1:-reflex}"
AGENTS="${2:-kimi,codex}"
CWD="${3:-/Users/owner/miscsubjects-pages}"
MODE="${4:-readonly}"
DELIVERY="${5:-headless}"
TRACE="${TRACE_ID:-}"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
BRIEF="$(cat)"
GROUP="$REPO/hooks/cli-agent-group.sh"

if [ -z "${BRIEF// }" ]; then echo "REFLEX_JSON:{\"error\":\"empty brief\"}" >&2; exit 2; fi

REFLEX_ID="reflex_$(date +%s)_$$"
LOG_DIR="$HOME/.miscsubjects/reflex"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/${REFLEX_ID}.log"

{
  echo "=== ISSUE REFLEX ==="
  echo "id: $REFLEX_ID"
  echo "source: $SOURCE"
  echo "agents: $AGENTS"
  echo "mode: $MODE"
  echo "delivery: $DELIVERY"
  echo "--- brief ---"
  printf '%s\n' "$BRIEF"
} > "$LOG"

# Background the team room — caller gets immediate ack.
(
  printf '%s' "$BRIEF" | TRACE_ID="$TRACE" bash "$GROUP" "$AGENTS" "$CWD" "$MODE" "$DELIVERY" >>"$LOG" 2>&1
  echo "[reflex] complete $REFLEX_ID" >>"$LOG"
) &

echo "REFLEX_JSON:$(node -e 'console.log(JSON.stringify({
  ok:true, reflex_id:process.argv[1], source:process.argv[2], agents:process.argv[3].split(","),
  log_file:process.argv[4], status:"running", note:"CLI agent team started in background"
}))' "$REFLEX_ID" "$SOURCE" "$AGENTS" "$LOG")"
