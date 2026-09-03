#!/usr/bin/env python3
# edit.py — fast version-test. Pull a row's prompt/definition into your editor, change it,
# save, and it pushes live instantly. Then text the build and watch.py shows the result.
#
#   export TERMINAL_KEY=...
#   python3 scripts/edit.py ROUTER          # edit the router prompt
#   python3 scripts/edit.py ARTICLES        # edit a tool definition
#   python3 scripts/edit.py --doc style_topology   # edit a writer doc (style_topology/slot_specs/judge_prompt)
#
# Levers, cheapest first (see docs/BUILD_SPEC.md): message -> prompt -> row -> setting -> doc -> code -> deploy.
import os, sys, json, subprocess, urllib.request, urllib.error

BASE = os.environ.get("BUILD_BASE", "https://miscsubjects.com")
KEY  = os.environ.get("TERMINAL_KEY", "")
EDITOR = os.environ.get("EDITOR", "nano")

def req(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(BASE + path, data=data, method=method,
        headers={"content-type": "application/json", "x-terminal-key": KEY, "User-Agent": "curl/8.4.0"})
    with urllib.request.urlopen(r, timeout=40) as resp:
        return resp.read().decode()

args = sys.argv[1:]
is_doc = "--doc" in args
name = [a for a in args if not a.startswith("--")][0] if any(not a.startswith("--") for a in args) else "ROUTER"

if is_doc:
    # writer docs live in D1 `docs`; pull current body via the ledger-free admin page is messy,
    # so we round-trip through D1_EXEC for the write and DOCS via dispatch for the read.
    cur = ""
    try:
        out = req("POST", "/api/dispatch", {"key": "DOCS_GET", "body": name})
        cur = json.loads(out).get("result", "") or ""
    except Exception:
        cur = ""
    path = f"/tmp/{name}.doc.txt"
    open(path, "w").write(cur)
    print(f"editing doc '{name}' -> {path}  (if blank, DOCS_GET is the known-broken reader; paste fresh)")
    subprocess.call([EDITOR, path])
    new = open(path).read()
    if new == cur:
        print("no change."); sys.exit(0)
    sql = "UPDATE docs SET body='%s' WHERE slug='%s'" % (new.replace("'", "''"), name)
    print(req("POST", "/api/dispatch", {"key": "D1_EXEC", "body": sql}))
    print("doc pushed live. text the build to test.")
else:
    row = json.loads(req("GET", "/api/directory/" + name))
    path = f"/tmp/{name}.prompt.txt"
    open(path, "w").write(row.get("content", "") or "")
    print(f"editing row '{name}' (type={row.get('type')}) -> {path}")
    subprocess.call([EDITOR, path])
    new = open(path).read()
    if new == (row.get("content", "") or ""):
        print("no change."); sys.exit(0)
    print(req("PATCH", "/api/directory/" + name, {"content": new}))
    print("pushed live. text the build to test, watch.py shows the result.")
