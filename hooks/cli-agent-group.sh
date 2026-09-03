#!/usr/bin/env bash
# CLI Agent Team Room — agents discuss a topic in sequence, shared transcript.
# Usage:
#   echo 'topic' | hooks/cli-agent-group.sh [agents] [cwd] [mode] [delivery]
#   agents: comma-separated kimi,gemini,codex,grok,claude (default: kimi,gemini,codex)
#   mode: readonly|auto|plan
#   delivery: headless|terminal (terminal opens live team-room tail)
set -euo pipefail

AGENTS_CSV="${1:-kimi,gemini,codex}"
case "$(printf '%s' "$AGENTS_CSV" | tr '[:upper:]' '[:lower:]')" in
  none|noop|null) AGENTS_CSV="" ;;
esac
CWD="${2:-/Users/owner/miscsubjects-pages}"
MODE="${3:-readonly}"
DELIVERY="${4:-headless}"
TRACE="${TRACE_ID:-}"
REPO="$(cd "$(dirname "$0")/.." && pwd)"

RAW_TOPIC_TMP="$(mktemp "${TMPDIR:-/tmp}/cli-group-topic.XXXXXX")"
cat > "$RAW_TOPIC_TMP"
if ! grep -q '[^[:space:]]' "$RAW_TOPIC_TMP"; then
  rm -f "$RAW_TOPIC_TMP"
  echo "GROUP_JSON:{\"error\":\"empty topic\"}" >&2
  exit 2
fi

GROUP_ID="group_$(date +%s)_$$"
GROUP_DIR="$HOME/.miscsubjects/cli-groups/$GROUP_ID"
TRANSCRIPT="$GROUP_DIR/transcript.md"
META="$GROUP_DIR/meta.json"
SPAWN="$REPO/hooks/cli-agent-spawn.sh"
WATCH="$REPO/hooks/cli-agent-group-watch.sh"
CONTEXT_CHARS="${CLI_GROUP_CONTEXT_CHARS:-14000}"
RESPONSE_CHARS="${CLI_GROUP_RESPONSE_CHARS:-9000}"
TOPIC_CHARS="${CLI_GROUP_TOPIC_CHARS:-4000}"

mkdir -p "$GROUP_DIR"
TOPIC_FILE="$GROUP_DIR/topic.full.txt"
mv "$RAW_TOPIC_TMP" "$TOPIC_FILE"

AGENTS=()
if [ -n "$AGENTS_CSV" ]; then
  IFS=',' read -ra AGENTS <<< "$(echo "$AGENTS_CSV" | tr -s ' ' | tr ' ' ',')"
fi
# trim
for i in "${!AGENTS[@]}"; do AGENTS[$i]="$(echo "${AGENTS[$i]}" | tr '[:upper:]' '[:lower:]' | xargs)"; done
AGENTS_LABEL="${AGENTS[*]-}"

TOPIC_PREVIEW="$(python3 - "$TOPIC_FILE" "$TOPIC_CHARS" <<'PY'
import sys
path, max_s = sys.argv[1:3]
max_chars = max(800, int(max_s or "4000"))
body = open(path, encoding="utf-8", errors="replace").read()
if len(body) <= max_chars:
    print(body, end="")
else:
    head = max_chars // 2
    tail = max_chars - head
    print(
        body[:head].rstrip()
        + "\n\n...[truncated for team-room prompt; full topic: "
        + path
        + "]...\n\n"
        + body[-tail:].lstrip(),
        end="",
    )
PY
)"

GROUP_ID="$GROUP_ID" TOPIC_FILE="$TOPIC_FILE" AGENTS_CSV="$AGENTS_CSV" CWD="$CWD" MODE="$MODE" DELIVERY="$DELIVERY" TRACE="$TRACE" META="$META" node -e '
const fs=require("fs");
const e=process.env;
const topic=fs.readFileSync(e.TOPIC_FILE,"utf8");
const agents=e.AGENTS_CSV.split(",").map((a)=>a.trim()).filter(Boolean);
const o={group_id:e.GROUP_ID,topic:topic.slice(0,8000),topic_chars:topic.length,topic_path:e.TOPIC_FILE,agents,cwd:e.CWD,mode:e.MODE,delivery:e.DELIVERY,trace_id:e.TRACE||null,started_at:new Date().toISOString(),status:"running"};
fs.writeFileSync(e.META,JSON.stringify(o,null,2));
'

cat > "$TRANSCRIPT" <<HDR
# CLI Agent Team Room

**Group:** \`$GROUP_ID\`
**Topic:** $TOPIC_PREVIEW
**Full topic path:** ${TOPIC_FILE}
**Team:** ${AGENTS_LABEL}
**Mode:** $MODE
**Started:** $(date -u '+%Y-%m-%d %H:%M:%S UTC')

---

HDR

agent_label() {
  case "$1" in
    kimi) echo "Kimi" ;;
    gemini) echo "Gemini" ;;
    codex) echo "Codex" ;;
    grok) echo "Grok" ;;
    grok-sa) echo "Grok SA" ;;
    claude) echo "Claude" ;;
    aider) echo "Aider" ;;
    *) echo "$1" ;;
  esac
}

build_turn_prompt() {
  local agent="$1"
  local label
  label="$(agent_label "$agent")"
  local transcript_body
  transcript_body="$(tail -c "$CONTEXT_CHARS" "$TRANSCRIPT")"
  cat <<PROMPT
You are ${label} (${agent}) in the **CLI Agent Team Room** — a standing group of coding agents debating superior solutions for miscsubjects-pages.

**TOPIC:** ${TOPIC_PREVIEW}
Full topic path: ${TOPIC_FILE}

**RULES:**
- Read the full transcript below. Do NOT repeat what prior agents said verbatim.
- Push the discussion forward: concrete architecture wins, risks, disagreements, better patterns.
- Build on prior agents — agree, challenge, or synthesize.
- $( [ "$MODE" = "readonly" ] || [ "$MODE" = "plan" ] && echo "READ ONLY — audit and propose only; no writes, edits, or mutating shell/git commands." || echo "Propose actionable changes; mutating work only if clearly justified." )
- Be concise but sharp (under 900 words).
- End with **Your top 3 recommendations** as a numbered list.

**TRANSCRIPT SO FAR:**
Full transcript path: ${TRANSCRIPT}
Bounded recent transcript tail follows (${CONTEXT_CHARS} chars max). If older context matters, read the full path directly instead of relying on this prompt.

${transcript_body}

---
**Your turn (${label}):**
PROMPT
}

compact_turn() {
  local full="$1"
  local compact="$2"
  local max="$3"
  python3 - "$full" "$compact" "$max" <<'PY'
import sys
full_path, compact_path, max_s = sys.argv[1:4]
max_chars = max(1200, int(max_s or "9000"))
body = open(full_path, encoding="utf-8", errors="replace").read().strip()
if len(body) <= max_chars:
    out = body
else:
    head = max_chars * 2 // 3
    tail = max_chars - head
    out = (
        body[:head].rstrip()
        + "\n\n...[truncated for team-room prompt; full turn: "
        + full_path
        + "]...\n\n"
        + body[-tail:].lstrip()
    )
open(compact_path, "w", encoding="utf-8").write(out)
PY
}

run_group_loop() {
  local agent out label section ts response
  if [ "${#AGENTS[@]}" -gt 0 ]; then
    for agent in "${AGENTS[@]}"; do
      [ -n "$agent" ] || continue
      label="$(agent_label "$agent")"
      ts="$(date '+%H:%M:%S')"
      {
        echo ""
        echo "## ${label} · ${ts}"
        echo ""
        echo "_${label} is thinking..._"
        echo ""
      } >> "$TRANSCRIPT"

      out=""
      if out="$(build_turn_prompt "$agent" | TRACE_ID="$TRACE" bash "$SPAWN" "$agent" "$CWD" "$MODE" headless 2>&1)"; then
        :
      fi

      response=""
      log_file="$(printf '%s' "$out" | grep 'AGENT_SPAWN_JSON:' | tail -1 | node -e '
        let s=""; process.stdin.on("data",d=>s+=d); process.stdin.on("end",()=>{
          try { const j=JSON.parse(s.replace(/^.*AGENT_SPAWN_JSON:/,"")); process.stdout.write(j.log_file||""); } catch {}
        });
      ' 2>/dev/null || true)"
      if [ -n "$log_file" ] && [ -f "$log_file" ]; then
        response="$(cat "$log_file")"
      fi
      if [ -z "${response// }" ]; then
        response="$(printf '%s' "$out" | awk '/^AGENT_SPAWN_JSON:/{exit} {print}')"
      fi
      if [ -z "${response// }" ]; then
        response="$(printf '%s' "$out" | tail -80)"
      fi

      section_full="$GROUP_DIR/turn_${agent}.full.md"
      section="$GROUP_DIR/turn_${agent}.md"
      printf '%s\n' "$response" > "$section_full"
      compact_turn "$section_full" "$section" "$RESPONSE_CHARS"

      # Replace thinking placeholder with response
      python3 - "$TRANSCRIPT" "$label" "$ts" "$section" <<'PY'
import sys
path, label, ts, body_path = sys.argv[1:5]
body = open(body_path, encoding='utf-8', errors='replace').read().strip()
text = open(path, encoding='utf-8', errors='replace').read()
needle = f"## {label} · {ts}\n\n_{label} is thinking..._\n"
replacement = f"## {label} · {ts}\n\n{body}\n"
if needle in text:
    text = text.replace(needle, replacement, 1)
else:
    text += f"\n## {label} · {ts}\n\n{body}\n"
open(path, 'w', encoding='utf-8').write(text)
PY

      echo "[group] ${label} done" >&2
    done
  fi

  {
    echo ""
    echo "---"
    echo ""
    echo "## Session complete"
    echo ""
    echo "Team: ${AGENTS_LABEL}"
    echo "Transcript: \`$TRANSCRIPT\`"
    echo ""
  } >> "$TRANSCRIPT"

  node -e '
    const fs=require("fs");
    const p=process.argv[1];
    const m=JSON.parse(fs.readFileSync(p,"utf8"));
    m.status="complete"; m.finished_at=new Date().toISOString();
    fs.writeFileSync(p,JSON.stringify(m,null,2));
  ' "$META"

  GROUP_POST="$GROUP_DIR/agent_turn.json"
  GROUP_TAIL="$GROUP_DIR/transcript.tail.md"
  tail -c 12000 "$TRANSCRIPT" > "$GROUP_TAIL"
  TRACE="$TRACE" CWD="$CWD" GROUP_ID="$GROUP_ID" TOPIC_FILE="$TOPIC_FILE" GROUP_TAIL="$GROUP_TAIL" TRANSCRIPT="$TRANSCRIPT" GROUP_POST="$GROUP_POST" node -e '
const fs = require("fs");
const crypto = require("crypto");
const e = process.env;
const topic = fs.readFileSync(e.TOPIC_FILE, "utf8");
const tail = fs.readFileSync(e.GROUP_TAIL, "utf8");
const transcript = fs.readFileSync(e.TRANSCRIPT, "utf8");
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
fs.writeFileSync(e.GROUP_POST, JSON.stringify({
  agent: "cli-group",
  source: "group",
  trace_id: e.TRACE || "",
  cwd: e.CWD,
  user_input: topic.slice(0, 8000),
  user_input_chars: topic.length,
  user_input_sha256: sha(topic),
  prompt_path: e.TOPIC_FILE,
  assistant_text: tail.slice(0, 12000),
  assistant_sha256: sha(transcript),
  assistant_path: e.TRANSCRIPT,
  transcript_tail_path: e.GROUP_TAIL,
  dispatch_key: "CLI_GROUP",
  input_kind: "group",
  session: e.GROUP_ID,
  turn_key: "group:" + e.GROUP_ID,
}));
'
  node "$REPO/hooks/agent-turn-post.js" --file "$GROUP_POST"
}

if [ "$DELIVERY" = "terminal" ]; then
  WATCH_FILE="$GROUP_DIR/watch.command"
  cat > "$WATCH_FILE" <<WEOF
#!/bin/bash
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:\$HOME/.kimi-code/bin:\$HOME/.grok/bin:\$PATH"
exec $(printf '%q' "$WATCH") $(printf '%q' "$GROUP_DIR")
WEOF
  chmod +x "$WATCH_FILE"
  open -a Terminal "$WATCH_FILE"
  ( run_group_loop; echo "GROUP_JSON:$(node -e 'const fs=require("fs");const m=JSON.parse(fs.readFileSync(process.argv[1]));const t=fs.readFileSync(process.argv[2],"utf8");console.log(JSON.stringify({ok:true,...m,transcript_path:process.argv[2],transcript_chars:t.length}))' "$META" "$TRANSCRIPT")" ) &
  echo "Opened CLI Agent Team Room (live transcript). Group: $GROUP_ID"
  echo "GROUP_JSON:$(node -e 'const fs=require("fs");const topic=fs.readFileSync(process.argv[5],"utf8");const agents=process.argv[4].split(",").map((a)=>a.trim()).filter(Boolean);console.log(JSON.stringify({ok:true,status:"running",group_id:process.argv[1],group_dir:process.argv[2],transcript_path:process.argv[3],agents,topic:topic.slice(0,8000),topic_chars:topic.length,topic_path:process.argv[5],delivery:"terminal"}))' "$GROUP_ID" "$GROUP_DIR" "$TRANSCRIPT" "$AGENTS_CSV" "$TOPIC_FILE")"
else
  run_group_loop
  echo "GROUP_JSON:$(node -e 'const fs=require("fs");const m=JSON.parse(fs.readFileSync(process.argv[1]));const t=fs.readFileSync(process.argv[2],"utf8");console.log(JSON.stringify({ok:true,...m,transcript_path:process.argv[2],transcript_chars:t.length,transcript_preview:t.slice(-4000)}))' "$META" "$TRANSCRIPT")"
fi
