#!/usr/bin/env bash
# Cross-agent CLI spawn — read prompt from stdin; start headless or Terminal session.
# Usage:
#   echo 'audit the build read-only' | hooks/cli-agent-spawn.sh kimi /path/to/repo readonly headless
#   echo 'fix the bug' | hooks/cli-agent-spawn.sh codex /path/to/repo auto terminal
# Args: agent cwd mode delivery
#   mode: readonly|auto|plan  (readonly = plan/sandbox read-only where supported)
#   delivery: headless|terminal
set -euo pipefail

AGENT="${1:?agent (kimi|gemini|codex|grok|grok-sa|claude|aider)}"
CWD="${2:-/Users/owner/miscsubjects-pages}"
MODE="${3:-auto}"
DELIVERY="${4:-headless}"
TRACE="${TRACE_ID:-}"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
PROMPT="$(cat)"

if [ -z "${PROMPT// }" ]; then echo "AGENT_SPAWN_JSON:{\"error\":\"empty prompt\"}" >&2; exit 2; fi

mkdir -p "$HOME/.miscsubjects"
RUN_ID="spawn_$(date +%s)_$$"
LOG_DIR="$HOME/.miscsubjects/spawns"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/${RUN_ID}.log"
RUNNER="$LOG_DIR/${RUN_ID}.sh"
RUNNER_CMD="$LOG_DIR/${RUN_ID}.command"
PROMPT_FILE="$LOG_DIR/${RUN_ID}.prompt"
MAX_ARG_CHARS="${CLI_SPAWN_ARG_CHARS:-60000}"

agent_bin() {
  local name="$1"
  local p c
  p="$(command -v "$name" 2>/dev/null || true)"
  if [ -n "$p" ]; then printf '%s' "$p"; return 0; fi
  # The bridge runs under launchd with a minimal PATH: nvm, pipx and grok live outside it.
  for c in \
    "/opt/homebrew/bin/$name" \
    "/usr/local/bin/$name" \
    "$HOME/.local/bin/$name" \
    "$HOME/.grok/bin/$name" \
    "$HOME/.kimi-code/bin/$name" \
    "$HOME/.nvm/versions/node/v24.16.0/bin/$name"
  do
    [ -x "$c" ] && printf '%s' "$c" && return 0
  done
  # Any nvm version, newest first.
  for c in $(ls -1dr "$HOME"/.nvm/versions/node/*/bin/"$name" 2>/dev/null); do
    [ -x "$c" ] && printf '%s' "$c" && return 0
  done
  return 1
}

# Absolute binary or a hard failure the caller can read. Never emit a bare name.
require_bin() {
  local b
  b="$(agent_bin "$1" 2>/dev/null || true)"
  if [ -z "$b" ]; then
    echo "AGENT_SPAWN_JSON:{\"ok\":false,\"error\":\"binary not found: $1\",\"agent\":\"$AGENT\"}" >&2
    echo "SPAWN_ERROR: $1 not installed or not executable on this Mac" >&2
    return 2
  fi
  printf '%s' "$b"
}

# Effective prompt (readonly prefix for agents without native read-only headless flags).
effective_prompt() {
  if [ "$MODE" = "readonly" ] || [ "$MODE" = "plan" ]; then
    case "$AGENT" in
      kimi)
        printf '%s' "READ ONLY - do not write, edit, delete, or run mutating shell/git commands. Audit and report only. ${PROMPT}"
        ;;
      *)
        printf '%s' "$PROMPT"
        ;;
    esac
  else
    printf '%s' "$PROMPT"
  fi
}

prompt_arg() {
  local ep excerpt
  ep="$(effective_prompt)"
  printf '%s' "$ep" > "$PROMPT_FILE"
  if [ "${#ep}" -le "$MAX_ARG_CHARS" ]; then
    printf '%s' "$ep"
    return 0
  fi
  excerpt="$(printf '%s' "$ep" | tail -c 12000)"
  cat <<PROMPT
The full task prompt is too large to pass through shell argv safely.
Read it from this local file, then answer the task:

${PROMPT_FILE}

Recent bounded excerpt:
${excerpt}
PROMPT
}

build_headless_cmd() {
  local -a CMD=()
  local EP BIN
  EP="$(prompt_arg)"
  case "$AGENT" in
    kimi) BIN="$(require_bin kimi)" || return 2; CMD=("$BIN" -p "$EP") ;;
    gemini)
      BIN="$(require_bin gemini)" || return 2
      if [ "$MODE" = "readonly" ] || [ "$MODE" = "plan" ]; then
        CMD=("$BIN" --skip-trust --approval-mode plan -p "$EP")
      else
        CMD=("$BIN" --skip-trust --yolo -p "$EP")
      fi
      ;;
    codex)
      BIN="$(require_bin codex)" || return 2
      if [ "$MODE" = "readonly" ] || [ "$MODE" = "plan" ]; then
        CMD=("$BIN" exec --sandbox read-only "$EP")
      else
        CMD=("$BIN" exec --dangerously-bypass-approvals-and-sandbox "$EP")
      fi
      ;;
    grok) BIN="$(require_bin grok)" || return 2; CMD=("$BIN" -p "$EP") ;;
    grok-sa) BIN="$(require_bin bun)" || return 2; CMD=("$BIN" "$HOME/.superagent-grok/bin/grok" --prompt "$EP") ;;
    claude) BIN="$(require_bin claude)" || return 2; CMD=("$BIN" -p "$EP" --output-format text --dangerously-skip-permissions) ;;
    aider) BIN="$(require_bin aider)" || return 2; CMD=("$BIN" --message "$EP" --yes-always --no-auto-commits) ;;
    *) echo "unknown agent: $AGENT" >&2; return 2 ;;
  esac
  # node/npx-based CLIs need their own runtime dir on PATH even under launchd.
  local NODE_BIN
  NODE_BIN="$(dirname "$BIN")"
  (cd "$CWD" && PATH="$NODE_BIN:/opt/homebrew/bin:$HOME/.local/bin:$PATH" "${CMD[@]}" >>"$1" 2>&1) || true
}

run_headless() {
  : >"$LOG_FILE"
  build_headless_cmd "$LOG_FILE"
  cat "$LOG_FILE"
}

run_async_headless() {
  echo "=== AGENT SPAWN (async headless): $AGENT ($MODE) ===" >"$LOG_FILE"
  echo "cwd: $CWD" >>"$LOG_FILE"
  build_headless_cmd "$LOG_FILE"
  echo "[spawn] complete $RUN_ID" >>"$LOG_FILE"
}

# Interactive CLI command only (no -p). Terminal flow: new window -> agent -> paste task.
terminal_agent_cmd() {
  case "$AGENT" in
    kimi) printf '%s' "kimi" ;;
    gemini) printf '%s' "gemini --skip-trust" ;;
    codex) printf '%s' "codex" ;;
    grok) printf '%s' "$HOME/.grok/bin/grok" ;;
    grok-sa) printf '%s' "bun $HOME/.superagent-grok/bin/grok" ;;
    claude) printf '%s' "claude" ;;
    aider) printf '%s' "aider" ;;
    *) echo "unknown agent for terminal: $AGENT" >&2; return 2 ;;
  esac
}

applescript_quote() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

# Terminal = new window, start interactive agent TUI, paste prompt (user hotkeys mode, then Return).
run_terminal() {
  local EP BIN AGENT_CMD LAUNCH_CMD PROMPT_POSIX STARTUP_DELAY
  EP="$(effective_prompt)"
  printf '%s' "$EP" > "$PROMPT_FILE"
  AGENT_CMD="$(terminal_agent_cmd)" || return $?
  BIN="$(agent_bin "$AGENT" 2>/dev/null || true)"
  case "$AGENT" in
    grok) BIN="${BIN:-$HOME/.grok/bin/grok}" ;;
    grok-sa) BIN="bun $HOME/.superagent-grok/bin/grok" ;;
  esac
  [ -n "$BIN" ] || { echo "$AGENT not found in PATH" >&2; return 2; }
  [ "$AGENT" = "grok-sa" ] || [ -x "${BIN%% *}" ] 2>/dev/null || command -v "${BIN%% *}" >/dev/null 2>&1 || {
    echo "$AGENT not found in PATH" >&2; return 2
  }

  if [ "$AGENT" = "kimi" ] || [ "$AGENT" = "codex" ] || [ "$AGENT" = "claude" ]; then
    LAUNCH_CMD="$BIN"
  else
    LAUNCH_CMD="$AGENT_CMD"
  fi
  PROMPT_POSIX="$(applescript_quote "$PROMPT_FILE")"
  STARTUP_DELAY=5

  cat > "$RUNNER_CMD" <<CMDEOF
#!/bin/bash
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:\$HOME/.kimi-code/bin:\$HOME/.grok/bin:\$PATH"
cd $(printf '%q' "$CWD")
$(printf '%q' "$LAUNCH_CMD")
CMDEOF
  chmod +x "$RUNNER_CMD"

  {
    echo "=== AGENT SPAWN (terminal interactive): $AGENT ($MODE) ==="
    echo "cwd: $CWD"
    echo "shell: $AGENT_CMD"
    echo "launcher: $RUNNER_CMD"
    echo "prompt_file: $PROMPT_FILE"
    echo "flow: new Terminal window -> $AGENT_CMD -> paste task (hotkey mode, then Return)"
    echo "--- prompt ---"
    printf '%s\n' "$EP"
  } > "$LOG_FILE"

  open -a Terminal "$RUNNER_CMD"
  bash "$REPO/hooks/terminal-paste-send.sh" "$PROMPT_FILE" "$STARTUP_DELAY" || true

  echo "Launched $AGENT in new Terminal window: $AGENT_CMD (prompt pasted and sent). Log: $LOG_FILE"
}

OUT=""
if [ "$DELIVERY" = "async" ]; then
  run_async_headless &
  OUT="AGENT_SPAWN_ASYNC: started $RUN_ID log=$LOG_FILE"
elif [ "$DELIVERY" = "terminal" ]; then
  OUT="$(run_terminal)"
else
  OUT="$(run_headless)"
fi

SESSION=""
if [[ "$OUT" =~ [Tt]o\ resume\ this\ session:\ kimi\ -r\ (session_[a-f0-9-]+) ]]; then
  SESSION="${BASH_REMATCH[1]}"
elif [[ "$OUT" =~ session_([a-f0-9-]{8,}) ]]; then
  SESSION="session_${BASH_REMATCH[1]}"
fi

DISPATCH_KEY="CLI_$(echo "$AGENT" | tr '[:lower:]' '[:upper:]' | tr '-' '_')"
[ "$AGENT" = "grok" ] && DISPATCH_KEY="CLI_GROK_XAI"
[ "$AGENT" = "grok-sa" ] && DISPATCH_KEY="CLI_GROK_SA"
[ "$AGENT" = "claude" ] && DISPATCH_KEY="CLI_CLAUDE_CODE"

if [ "$DELIVERY" != "async" ]; then
  # File-based payload — passing huge spawn output via argv hits ARG_MAX ("Argument list too long").
  ASSIST_FILE="$LOG_DIR/${RUN_ID}.assistant.txt"
  TURN_JSON="$LOG_DIR/${RUN_ID}.turn.json"
  [ -f "$PROMPT_FILE" ] || printf '%s' "$PROMPT" > "$PROMPT_FILE"
  printf '%s' "$OUT" > "$ASSIST_FILE"
  AGENT="$AGENT" TRACE="$TRACE" CWD="$CWD" DISPATCH_KEY="$DISPATCH_KEY" SESSION="$SESSION" RUN_ID="$RUN_ID" \
    PROMPT_FILE="$PROMPT_FILE" ASSIST_FILE="$ASSIST_FILE" OUT_JSON="$TURN_JSON" \
    node -e '
const fs = require("fs");
const crypto = require("crypto");
const e = process.env;
const prompt = fs.readFileSync(e.PROMPT_FILE, "utf8");
const assistant = fs.readFileSync(e.ASSIST_FILE, "utf8");
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const rec = {
  agent: e.AGENT,
  source: "spawn",
  trace_id: e.TRACE || "",
  cwd: e.CWD,
  user_input: prompt.slice(0, 8000),
  user_input_chars: prompt.length,
  user_input_sha256: sha(prompt),
  prompt_path: e.PROMPT_FILE,
  assistant_text: assistant.slice(0, 6000),
  assistant_sha256: sha(assistant),
  assistant_path: e.ASSIST_FILE,
  dispatch_key: e.DISPATCH_KEY,
  input_kind: "spawn",
  session: e.SESSION || "",
  turn_key: "spawn:" + e.RUN_ID,
};
fs.writeFileSync(e.OUT_JSON, JSON.stringify(rec));
'
  node "$REPO/hooks/agent-turn-post.js" --file "$TURN_JSON"
fi

META=$(node -e 'console.log(JSON.stringify({
  ok:true, agent:process.argv[1], cwd:process.argv[2], mode:process.argv[3], delivery:process.argv[4],
  session:process.argv[5]||null, run_id:process.argv[6], log_file:process.argv[7], prompt_file:process.argv[8]||null, assistant_file:process.argv[9]||null,
  status:process.argv[4]==="async"?"running":"done"
}))' "$AGENT" "$CWD" "$MODE" "$DELIVERY" "$SESSION" "$RUN_ID" "$LOG_FILE" "$PROMPT_FILE" "${ASSIST_FILE:-}")

echo "AGENT_SPAWN_JSON:$META"
