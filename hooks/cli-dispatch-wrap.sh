#!/usr/bin/env bash
# Wrap a one-shot CLI agent invocation and POST a dispatch-shaped turn to /api/agent_log.
# Used when an agent has no native Stop hook (codex, gemini, grok -p, etc.).
# EX: hooks/cli-dispatch-wrap.sh grok "explain dispatch.js" /Users/owner/miscsubjects-pages
set -euo pipefail
AGENT="${1:?agent id (grok|codex|gemini|...)}"
PROMPT="${2:?prompt}"
CWD="${3:-$HOME}"
TRACE="${TRACE_ID:-}"
KEY="${DISPATCH_KEY:-CLI_$(echo "$AGENT" | tr '[:lower:]' '[:upper:]')}"
CMD=("${@:4}")

mkdir -p "$HOME/.miscsubjects"
RUN_ID="wrap_$(date +%s)_$$"
PROMPT_FILE="$HOME/.miscsubjects/${RUN_ID}.prompt"
MAX_ARG_CHARS="${CLI_WRAP_ARG_CHARS:-8000}"
printf '%s' "$PROMPT" > "$PROMPT_FILE"

prompt_arg() {
  if [ "${#PROMPT}" -le "$MAX_ARG_CHARS" ]; then
    printf '%s' "$PROMPT"
    return 0
  fi
  local excerpt
  excerpt="$(printf '%s' "$PROMPT" | tail -c 4000)"
  cat <<PROMPT
The full task prompt is too large to pass through shell argv safely.
Read it from this local file, then answer the task:

${PROMPT_FILE}

Recent bounded excerpt:
${excerpt}
PROMPT
}

EP="$(prompt_arg)"

if [ "${#CMD[@]}" -eq 0 ]; then
  case "$AGENT" in
    grok) CMD=("$HOME/.grok/bin/grok" -p "$EP") ;;
    codex) CMD=(codex exec --full-auto "$EP") ;;
    gemini) CMD=(gemini --skip-trust -p "$EP") ;;
    kimi) CMD=(kimi -p "$EP") ;;
    claude) CMD=(claude -p "$EP" --output-format text --dangerously-skip-permissions) ;;
    *) echo "cli-dispatch-wrap: no default cmd for $AGENT" >&2; exit 2 ;;
  esac
else
  # Custom command passed by caller. If the prompt is large, the caller is
  # responsible for reading $PROMPT_FILE. We export it for convenience.
  export PROMPT_FILE
  if [ "${#PROMPT}" -gt "$MAX_ARG_CHARS" ]; then
    echo "cli-dispatch-wrap: prompt is ${#PROMPT} chars (> $MAX_ARG_CHARS). Custom CMD must read \$PROMPT_FILE." >&2
  fi
fi

OUT_FILE="$HOME/.miscsubjects/${RUN_ID}.out"
OUT="$(cd "$CWD" 2>/dev/null && "${CMD[@]}" 2>&1 || true)"
printf '%s' "$OUT" > "$OUT_FILE"
export PROMPT_FILE OUT_FILE
export WRAP_AGENT="$AGENT" WRAP_TRACE="$TRACE" WRAP_CWD="$CWD" WRAP_KEY="$KEY"
RECORD_FILE="$HOME/.miscsubjects/${RUN_ID}.record.json"
export RECORD_FILE
node -e '
const fs = require("fs");
const prompt = fs.readFileSync(process.env.PROMPT_FILE, "utf8");
const out = fs.readFileSync(process.env.OUT_FILE, "utf8");
const record = {
  agent: process.env.WRAP_AGENT,
  source: "hook",
  trace_id: process.env.WRAP_TRACE,
  cwd: process.env.WRAP_CWD,
  user_input: prompt,
  assistant_text: out,
  dispatch_key: process.env.WRAP_KEY,
  input_kind: "cli-wrap"
};
fs.writeFileSync(process.env.RECORD_FILE, JSON.stringify(record));
'
node "$(dirname "$0")/agent-turn-post.js" --file "$RECORD_FILE"
