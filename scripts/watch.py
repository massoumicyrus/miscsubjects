#!/usr/bin/env python3
# watch.py — stream a compact digest of every turn as it happens, so you never have to
# tab between the router prompt, the directory, and the ledger to see what went wrong.
#
#   export TERMINAL_KEY=...           # your build key
#   python3 scripts/watch.py         # leave running in a terminal tab; then text the build
#
# For each new turn it prints: your message -> each tool/agent it ran (in->out) -> the reply,
# and the exact PATCH commands to tweak whatever was involved.
import os, json, time, urllib.request, urllib.error

BASE = os.environ.get("BUILD_BASE", "https://miscsubjects.com")
KEY  = os.environ.get("TERMINAL_KEY", "")

def get(path):
    req = urllib.request.Request(BASE + path, headers={"x-terminal-key": KEY, "User-Agent": "curl/8.4.0"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read().decode())

def short(s, n=90):
    s = str(s or "").replace("\n", " ").strip()
    return s if len(s) <= n else s[:n] + "…"

seen = set()
first = True
print("watching the build ledger — text it, digests appear here. Ctrl-C to stop.\n", flush=True)
while True:
    try:
        rows = [r for r in get("/admin/ledger?data=1&limit=80").get("rows", []) if r.get("trace_id")]
    except Exception as e:
        print("(ledger fetch error:", e, ")"); time.sleep(3); continue

    by_trace = {}
    for r in rows:
        by_trace.setdefault(r["trace_id"], []).append(r)

    for tid, steps in sorted(by_trace.items(), key=lambda kv: max(x.get("ts", "") for x in kv[1])):
        if tid in seen:
            continue
        if first:
            seen.add(tid)  # seed existing turns silently; only show new ones after start
            continue
        steps.sort(key=lambda x: x.get("ts", ""))
        is_router = any(s.get("key") == "ROUTER" for s in steps)
        reply = ""
        for s in steps:
            rp = str(s.get("response_preview") or "")
            if "[REPLY]" in rp:
                reply = rp.split("[REPLY]", 1)[1].split("[/REPLY]", 1)[0]
        if not is_router and not reply:
            continue
        seen.add(tid)

        inbound = ""
        for s in steps:
            rq = str(s.get("request_preview") or "")
            if "Now:" in rq:
                inbound = rq.split("Now:", 1)[1]
                break
        print("=" * 72)
        print("YOU:  ", short(inbound, 120) or "(no inbound text captured)")
        tools = []
        for s in steps:
            k = s.get("key")
            if not k or k == "ROUTER":
                continue
            tools.append(k)
            print(f"  -> {k}: {short(s.get('request_preview'), 40)}  =>  {short(s.get('response_preview'), 70)}")
        print("BUILD:", short(reply, 240) or "(no reply emitted — router stopped early)")
        knobs = ["PATCH /api/directory/ROUTER"] + [f"PATCH /api/directory/{k}" for k in dict.fromkeys(tools)]
        print("TWEAK:", "  |  ".join(knobs), flush=True)
        print(flush=True)
    if first:
        print("ready — send the build a message.\n", flush=True)
        first = False
    time.sleep(3)
