#!/usr/bin/env bash
# SHIP VIA THE MAC BRIDGE — the real gated deploy, driven from anywhere that holds the terminal
# key (GitHub Actions today). Every step is one LOCAL_EXEC dispatch, so the whole deploy lands on
# the invocation ledger with receipts — the deploy itself is proven work.
#
#   TERMINAL_KEY=<key> bash scripts/ship-via-bridge.sh
#
# Steps: locate the repo on the Mac → pull main → run scripts/ship.mjs with the four new
# migrations (content-spine ones as explicit args; ship.mjs runs its full gate suite and the
# preview→promote deploy) → apply the LEDGER-database migration → report the tail of the log.
set -euo pipefail
BASE="${BASE:-https://miscsubjects.com}"
[ -n "${TERMINAL_KEY:-}" ] || { echo "TERMINAL_KEY unset"; exit 78; }

lexec() { # $1 = shell command for the Mac; prints the dispatch result JSON
  curl -sS -m 120 -X POST "$BASE/api/dispatch" \
    -H "x-terminal-key: $TERMINAL_KEY" -H 'content-type: application/json' \
    --data "$(python3 -c 'import json,sys; print(json.dumps({"key":"LOCAL_EXEC","body":sys.argv[1],"actor":"ship-remote"}))' "$1")"
}
out() { python3 -c 'import json,sys
d=json.load(sys.stdin); r=d.get("result")
print(r if isinstance(r,str) else json.dumps(r))'; }

PATHFIX='export PATH="$PATH:/opt/homebrew/bin:/usr/local/bin:$HOME/.nvm/versions/node/*/bin"; '

echo "== locate repo on the Mac =="
LOC=$(lexec 'for d in ~/miscsubjects-pages ~/Desktop/miscsubjects-pages ~/Documents/miscsubjects-pages ~/code/miscsubjects-pages ~/dev/miscsubjects-pages ~/Projects/miscsubjects-pages; do [ -d "$d/.git" ] && echo "FOUND:$d" && break; done; true' | out)
echo "$LOC"
REPO=$(echo "$LOC" | grep -o 'FOUND:[^" ]*' | head -1 | cut -d: -f2 || true)
if [ -z "$REPO" ]; then
  LOC2=$(lexec 'mdfind "kMDItemFSName == miscsubjects-pages" 2>/dev/null | grep -v Library | head -3; true' | out)
  echo "$LOC2"
  REPO=$(echo "$LOC2" | grep -o '/[^" ]*miscsubjects-pages' | head -1 || true)
fi
[ -n "$REPO" ] && echo "repo: $REPO" || { echo "REPO NOT FOUND on the Mac"; exit 1; }

echo "== pull main =="
lexec "cd $REPO && git fetch origin main && git checkout main && git pull --ff-only origin main && git log --oneline -1" | out

echo "== start gated ship (detached; full gate suite + preview->promote) =="
lexec "$PATHFIX cd $REPO && rm -f /tmp/ship-skillgraph.log && (nohup node scripts/ship.mjs migrations/0357_skill_evidence_graph.sql migrations/0358_comparisons.sql migrations/0360_session_cases.sql > /tmp/ship-skillgraph.log 2>&1 & echo ship-started pid=\$!)" | out

echo "== watch the ship log =="
for i in $(seq 1 40); do
  sleep 20
  TAIL=$(lexec 'tail -c 1500 /tmp/ship-skillgraph.log 2>/dev/null; echo; ps aux | grep -c "[s]hip.mjs" || true' | out)
  echo "--- poll $i ---"; echo "$TAIL" | tail -8
  if echo "$TAIL" | grep -qiE 'PRODUCTION NOT PROMOTED|GATE.*FAIL|Error:|error Command failed'; then
    echo "SHIP FAILED — full tail follows"; lexec 'tail -c 6000 /tmp/ship-skillgraph.log' | out; exit 1
  fi
  # ship.mjs ends after the production smoke; the process count line hits 0 when done
  if echo "$TAIL" | tail -1 | grep -qx '0'; then
    echo "ship process exited — final tail:"; lexec 'tail -c 3000 /tmp/ship-skillgraph.log' | out
    break
  fi
done

echo "== apply the LEDGER-database migration (0359 part B) =="
lexec "$PATHFIX cd $REPO && npx wrangler d1 execute miscsubjects-events --remote --file migrations/0359_articles_schema_and_merkle.sql 2>&1 | tail -5" | out

echo "== done =="
