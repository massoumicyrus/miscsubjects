#!/usr/bin/env python3
"""Run full batched selftest until done. Usage: run_selftest_full.py [run_id]"""
import json, os, re, sys, time, urllib.request

env = open(os.path.expanduser("~/.config/grok-bridge.env")).read()
m = re.search(r"TERMINAL_KEY=(\S+)", env)
TK = m.group(1) if m else os.environ.get("TERMINAL_KEY", "")
if not TK:
    sys.exit("TERMINAL_KEY missing")

API = "https://miscsubjects.com/api/selftest"
run_id = sys.argv[1] if len(sys.argv) > 1 else f"st_c4b4900_{int(time.time())}"
offset = 0
fresh = True
fails = []
start = time.time()


def post(body):
    import subprocess
    r = subprocess.run(
        [
            "curl", "-sS", "-m", "300", "-X", "POST", API,
            "-H", "content-type: application/json",
            "-H", f"x-terminal-key: {TK}",
            "-H", "User-Agent: miscsubjects-selftest-runner/1.0",
            "-d", json.dumps(body),
        ],
        capture_output=True, text=True, check=False,
    )
    if r.returncode != 0:
        raise RuntimeError(r.stderr or r.stdout or f"curl exit {r.returncode}")
    raw = (r.stdout or "").strip()
    if not raw:
        raise RuntimeError("empty response (worker timeout?)")
    return json.loads(raw)


while True:
    body = {"action": "run", "limit": 1, "offset": offset, "run_id": run_id}
    if fresh:
        body["fresh_run"] = True
        fresh = False
    try:
        res = post(body)
    except (urllib.error.HTTPError, RuntimeError, json.JSONDecodeError) as e:
        print(f"BATCH ERR offset={offset}: {e}", flush=True)
        time.sleep(10)
        continue
    if res.get("skipped"):
        print(f"LOCKED active={res.get('active')}", flush=True)
        time.sleep(10)
        continue
    if res.get("error"):
        print("ERROR", res, flush=True)
        sys.exit(1)
    for r in res.get("results") or []:
        if not r.get("pass"):
            fails.append(r)
    print(
        f"offset={offset} score={res.get('score')}% "
        f"pass={res.get('passed_so_far')}/{res.get('tested_so_far')} "
        f"done={res.get('done')}",
        flush=True,
    )
    if res.get("done"):
        print("=== FINAL ===", flush=True)
        print(json.dumps({
            "run_id": res.get("run_id"),
            "score": res.get("score"),
            "passed": res.get("passed_so_far"),
            "total": res.get("of"),
            "fail_count": len(fails),
            "reflex_pending": res.get("reflex_pending"),
            "reflex": res.get("reflex"),
            "elapsed_s": int(time.time() - start),
        }, indent=2))
        if fails:
            print("=== FAILURES ===", flush=True)
            for f in fails:
                print(f"#{f.get('id')} [{f.get('reason')}] {f.get('q', '')[:80]}", flush=True)
                print(f"  {(f.get('actual') or '')[:150]}", flush=True)
        sys.exit(0)
    offset = res.get("next_offset", offset + 1)
    time.sleep(3)