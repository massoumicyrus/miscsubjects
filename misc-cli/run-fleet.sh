#!/usr/bin/env bash
# Run one task file through N gateway models, one misc process each, in parallel.
# Usage: run-fleet.sh <task-file> <out-dir> <model> [model...]
set -uo pipefail
TASK="${1:?task file}"; OUT="${2:?out dir}"; shift 2
REPO="${MISC_FLEET_CWD:-/Users/owner/miscsubjects-pages}"
mkdir -p "$OUT"
for M in "$@"; do
  SAFE="$(echo "$M" | tr '/.' '__')"
  (
    START=$(date +%s)
    cd "$REPO" || exit 1
    MISC_MODEL="$M" /Users/owner/.local/bin/misc -p "$(cat "$TASK")" >"$OUT/$SAFE.log" 2>&1
    CODE=$?
    END=$(date +%s)
    printf '%s\t%s\t%s\t%s\n' "$M" "$CODE" "$((END-START))s" "$(wc -c <"$OUT/$SAFE.log" | tr -d ' ')" >>"$OUT/_results.tsv"
  ) &
done
wait
echo "=== $OUT/_results.tsv ==="
cat "$OUT/_results.tsv"
