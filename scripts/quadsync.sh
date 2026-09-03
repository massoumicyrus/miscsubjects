#!/bin/bash
# QUADSYNC — local corner of the four-way sync (Cloudflare ↔ GitHub ↔ local ↔ Google Drive).
# Runs every 10 min via launchd (com.owner.miscsubjects.quadsync) and on demand.
#   1. fetch GitHub state without rebasing, stashing, checking out, committing, or pushing.
#   2. report branch divergence and dirty state; explicit ship owns source convergence.
#   3. mirror the working tree + latest ledger snapshot into Google Drive.
#   4. stamp sync state only after the corresponding operation succeeds.
set -u
REPO="/Users/owner/miscsubjects-pages"
DRIVE="$HOME/Google Drive/My Drive/miscsubjects-sync"
LOG="$HOME/.miscsubjects/quadsync.log"
KEYFILE="$HOME/.config/grok-bridge.env"
mkdir -p "$(dirname "$LOG")" "$DRIVE/repo"
exec >>"$LOG" 2>&1
echo "=== quadsync $(date '+%Y-%m-%d %H:%M:%S %Z') ==="
cd "$REPO" || exit 1

# The vault is the canonical credential store; the bridge keyfile is a fallback that
# has gone stale before (rotated TERMINAL_KEY, every stamp 401 for a day, unnoticed).
# shellcheck disable=SC1090
source "$HOME/.build-vault.env" 2>/dev/null
# shellcheck disable=SC1090
[ -z "${TERMINAL_KEY:-}" ] && source "$KEYFILE" 2>/dev/null
KEY="${TERMINAL_KEY:-${MISC_TERMINAL_KEY:-}}"

stamp() {
  local key="$1" code
  code=$(curl -s -o /dev/null -w '%{http_code}' -X PUT \
    "https://miscsubjects.com/api/kv?key=$key" -H "x-terminal-key: $KEY" -d "$NOW")
  if [ "$code" = "200" ]; then
    echo "stamped $key"
  else
    echo "STAMP FAILED $key http=$code — credential or endpoint defect, corner will read stale"
    return 1
  fi
}

# Owner-locked files (PROTECTED_WIDGETS.md + PROTECTED_FEATURES.md) — never auto-committed.
LOCKED=(
  "functions/a/[slug].js"
  "functions/_lib/widgets.js"
  "functions/_lib/widgets"
  "functions/_lib/vault_widgets.js"
  "functions/admin/ledger/index.js"
  "functions/admin/vault.js"
  "functions/api/vault/[[path]].js"
  ".githooks"
  ".github/workflows/vault-session-scan.yml"
  "functions/_lib/ledger_sync.js"
  "scripts/quadsync.sh"
  "PROTECTED_FEATURES.md"
  "PROTECTED_WIDGETS.md"
  "functions/api/protocol/[[path]].js"
  ".github/workflows"
)

# 1–2. Observe Git state without mutating an active coding-agent worktree.
FETCH_OK=0
if git fetch -q origin main; then FETCH_OK=1; fi
BRANCH=$(git branch --show-current 2>/dev/null || echo detached)
HEAD_SHA=$(git rev-parse HEAD 2>/dev/null || echo unknown)
MAIN_SHA=$(git rev-parse origin/main 2>/dev/null || echo unknown)
DIRTY_COUNT=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
LOCKED_DIRTY=$(git status --porcelain -- "${LOCKED[@]}" 2>/dev/null | wc -l | tr -d ' ')
echo "observed branch=$BRANCH head=$HEAD_SHA origin_main=$MAIN_SHA dirty=$DIRTY_COUNT fetch_ok=$FETCH_OK"
if [ "$LOCKED_DIRTY" != "0" ] && [ -n "$KEY" ]; then
  curl -s -X POST "https://miscsubjects.com/api/event_log_ingest" \
    -H "x-terminal-key: $KEY" -H "content-type: application/json" \
    -d "{\"kind\":\"quadsync_locked_dirty\",\"locked_dirty_files\":$LOCKED_DIRTY,\"note\":\"owner-locked files have uncommitted local changes; commit them manually with the approval token\"}" >/dev/null
  echo "locked-dirty reported: $LOCKED_DIRTY file(s)"
fi

# 2.5 Stranded-work detector. Every saved line of work that never rejoined the live line
# is surfaced in the ledger within one cycle; silent stranding is what lost the June and
# July work. A line is silenced only by an explicit disposition record at its exact tip
# (git config --add quadsync.dispositioned "<branch>:<tip>"); new commits on it re-alarm.
STRANDED_COUNT=0
STRANDED_SUMMARY=""
DISPOSITIONED=$(git config --get-all quadsync.dispositioned 2>/dev/null || true)
while IFS= read -r b; do
  [ "$b" = "main" ] && continue
  tip=$(git rev-parse "$b" 2>/dev/null) || continue
  case "$DISPOSITIONED" in *"$b:$tip"*) continue ;; esac
  n=$(git log --oneline "main..$b" --invert-grep --grep='quadsync' 2>/dev/null | wc -l | tr -d ' ')
  if [ "$n" != "0" ]; then
    last=$(git log -1 --format='%cs' "$b" 2>/dev/null)
    STRANDED_COUNT=$((STRANDED_COUNT+1))
    STRANDED_SUMMARY="${STRANDED_SUMMARY}${b}: ${n} change(s), last ${last}; "
  fi
done < <(git for-each-ref --format='%(refname:short)' refs/heads/)
echo "stranded-work: $STRANDED_COUNT undispositioned line(s) ${STRANDED_SUMMARY:+— $STRANDED_SUMMARY}"
FP=$(printf '%s' "$STRANDED_SUMMARY" | shasum -a 256 | cut -c1-16)
FPFILE="$HOME/.miscsubjects/stranded.fp"
PREV=$(cat "$FPFILE" 2>/dev/null || true)
if [ "$FP" != "$PREV" ] && [ -n "$KEY" ]; then
  if [ "$STRANDED_COUNT" = "0" ]; then
    NOTE="All saved lines of work are folded into the live line or explicitly dispositioned."
  else
    NOTE="Unfinished work exists outside the live line: ${STRANDED_SUMMARY}Fold it in or record its disposition."
  fi
  NOTE_JSON=$(printf '%s' "$NOTE" | head -c 900 | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')
  if curl -s -X POST "https://miscsubjects.com/api/event_log_ingest" \
    -H "x-terminal-key: $KEY" -H "content-type: application/json" \
    -d "{\"kind\":\"stranded_work\",\"count\":$STRANDED_COUNT,\"note\":$NOTE_JSON}" >/dev/null; then
    printf '%s' "$FP" > "$FPFILE"
    echo "stranded-work change reported to ledger"
  fi
fi

# 3. local → Google Drive (Drive for desktop syncs the folder up)
DRIVE_OK=0
if rsync -rlL --no-perms --no-owner --no-group --no-times --delete --exclude '.git' --exclude 'node_modules' --exclude '_worker.bundle' "$REPO/" "$DRIVE/repo/"; then DRIVE_OK=1; fi
LEDGER_LATEST="$HOME/.miscsubjects/ledger-latest.json"
if [ -n "$KEY" ]; then
  curl -s --max-time 60 "https://miscsubjects.com/api/events?limit=300" -H "x-terminal-key: $KEY" -o "$LEDGER_LATEST" || true
  cp -f "$LEDGER_LATEST" "$DRIVE/ledger-latest.json" 2>/dev/null || true
fi
cp -f "$REPO/STATE.md" "$DRIVE/STATE.md" 2>/dev/null
if [ "$DRIVE_OK" = "1" ]; then echo "drive mirror updated"; else echo "drive mirror failed"; fi

# 3b. Off-machine delta fallback. Scheduled (launchd) runs are denied filesystem access to the
# Drive mount ("open: Operation not permitted"; only manually-invoked runs from a permitted app
# context can write it), so on any cycle where the Drive mirror fails, ship the loss-critical
# delta — uncommitted changes, untracked files, STATE.md, latest ledger snapshot — to the
# build's storage at R2 key quadsync/workspace-delta.tgz.b64 (base64 of a tar.gz).
# GitHub already carries every committed state; this covers exactly what a dead Mac would lose.
# Restore: fetch via R2_GET, base64 -d, tar -xzf.
DELTA_OK=0
if [ "$DRIVE_OK" = "0" ] && [ -n "$KEY" ]; then
  DTMP=$(mktemp -d)
  git -C "$REPO" diff HEAD > "$DTMP/uncommitted.patch" 2>/dev/null
  git -C "$REPO" status --porcelain --untracked-files=all > "$DTMP/status.txt" 2>/dev/null
  UNTRACKED_LIST="$DTMP/untracked.lst"
  git -C "$REPO" ls-files --others --exclude-standard > "$UNTRACKED_LIST" 2>/dev/null
  cp -f "$REPO/STATE.md" "$DTMP/STATE.md" 2>/dev/null
  cp -f "$LEDGER_LATEST" "$DTMP/ledger-latest.json" 2>/dev/null
  # Untracked payload capped at 5 MB of files; anything dropped is named in dropped.txt so the
  # bundle never silently claims completeness.
  BUDGET=$((5 * 1024 * 1024)); : > "$DTMP/dropped.txt"; : > "$DTMP/take.lst"
  while IFS= read -r f; do
    sz=$(stat -f%z "$REPO/$f" 2>/dev/null || echo 0)
    if [ "$sz" -le "$BUDGET" ]; then echo "$f" >> "$DTMP/take.lst"; BUDGET=$((BUDGET - sz)); else echo "$f ($sz bytes)" >> "$DTMP/dropped.txt"; fi
  done < "$UNTRACKED_LIST"
  tar -czf "$DTMP/workspace-delta.tgz" -C "$DTMP" uncommitted.patch status.txt STATE.md ledger-latest.json dropped.txt 2>/dev/null
  if [ -s "$DTMP/take.lst" ]; then
    tar -czf "$DTMP/untracked.tgz" -C "$REPO" -T "$DTMP/take.lst" 2>/dev/null
    tar -czf "$DTMP/workspace-delta.tgz" -C "$DTMP" uncommitted.patch status.txt STATE.md ledger-latest.json dropped.txt untracked.tgz 2>/dev/null
  fi
  B64="$DTMP/delta.b64"
  base64 -i "$DTMP/workspace-delta.tgz" | tr -d '\n' > "$B64"
  python3 - "$B64" << 'PYEOF' > "$DTMP/payload.json"
import json, sys
b64 = open(sys.argv[1]).read()
print(json.dumps({"key": "R2_PUT", "body": "quadsync/workspace-delta.tgz.b64|" + b64}))
PYEOF
  if curl -s --max-time 120 -X POST "https://miscsubjects.com/api/dispatch" \
      -H "x-terminal-key: $KEY" -H "content-type: application/json" \
      --data @"$DTMP/payload.json" | grep -q '"result": *"OK"'; then
    DELTA_OK=1
    echo "workspace delta shipped ($(stat -f%z "$DTMP/workspace-delta.tgz") bytes tar, $(wc -c < "$B64" | tr -d ' ') b64)"
  else
    echo "workspace delta ship failed"
  fi
  rm -rf "$DTMP"
fi

# 4. stamp the corners
if [ -n "$KEY" ]; then
  NOW=$(date +%s)
  if [ "$FETCH_OK" = "1" ]; then stamp "sync:local"; fi
  if [ "$DRIVE_OK" = "1" ]; then stamp "sync:drive"; fi
  if [ "$DELTA_OK" = "1" ]; then stamp "sync:delta"; fi
  curl -s -X POST "https://miscsubjects.com/api/event_log_ingest" \
    -H "x-terminal-key: $KEY" -H "content-type: application/json" \
    -d "{\"kind\":\"quadsync_observation\",\"branch\":\"$BRANCH\",\"head\":\"$HEAD_SHA\",\"origin_main\":\"$MAIN_SHA\",\"dirty_files\":$DIRTY_COUNT,\"fetch_ok\":$FETCH_OK,\"drive_ok\":$DRIVE_OK,\"delta_ok\":$DELTA_OK}" >/dev/null
fi
echo "=== done ==="
