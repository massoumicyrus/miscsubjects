#!/usr/bin/env bash
# Full batched selftest — one run_id, fresh_run on offset 0.
set -euo pipefail
source "${HOME}/.config/grok-bridge.env"
API="https://miscsubjects.com/api/selftest"
RUN_ID="${1:-st_c4b4900_$(date +%s)}"
OFFSET=0
FRESH=1

while true; do
  BODY=$(node -e "console.log(JSON.stringify({action:'run',limit:3,offset:$OFFSET,run_id:'$RUN_ID',fresh_run:!!$FRESH}))")
  FRESH=0
  RES=$(curl -sS -m 300 -X POST "$API" \
    -H "content-type: application/json" -H "x-terminal-key: ${TERMINAL_KEY}" -d "$BODY")
  DONE=$(echo "$RES" | node -e "
    const d=JSON.parse(require('fs').readFileSync(0,'utf8'));
    if(d.skipped){console.error('LOCKED active='+d.active);process.exit(3)}
    if(d.error){console.error('ERROR '+JSON.stringify(d));process.exit(2)}
    const f=(d.results||[]).filter(r=>!r.pass);
    console.error('offset='+(d.next_offset-(d.results||[]).length)+' score='+d.score+'% pass='+d.passed_so_far+'/'+d.tested_so_far+' done='+d.done+' fails='+f.length);
    for(const r of f) console.error('  FAIL #'+r.id+' '+r.reason+': '+(r.actual||'').slice(0,100));
    if(d.done){
      console.log(JSON.stringify({run_id:d.run_id,score:d.score,passed:d.passed_so_far,of:d.of,reflex_pending:d.reflex_pending,reflex:d.reflex},null,2));
    }
    process.stdout.write(String(d.done));
  " 2>&1 | tee /dev/stderr) || {
    EC=$?
    [ "$EC" -eq 3 ] && sleep 10 && continue
    [ "$EC" -eq 2 ] && exit 1
  }
  if echo "$RES" | node -e "process.exit(JSON.parse(require('fs').readFileSync(0,'utf8')).done?0:1)"; then
    echo "RUN_ID=$RUN_ID"
    exit 0
  fi
  OFFSET=$(echo "$RES" | node -e "console.log(JSON.parse(require('fs').readFileSync(0,'utf8')).next_offset)")
  sleep 2
done