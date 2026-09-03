#!/usr/bin/env python3
# Ports a GROUP of tools (one or more directory categories) into a single agent identity:
# a basic identity prompt + the definition + invocation of every tool in the group.
# the owner's architecture: router hands a group-question to [AGENT]; that agent owns its tools.
import sys, json, subprocess, re

def d1(sql):
    r = subprocess.run(["wrangler","d1","execute","loop-content-spine","--remote","--json","--command",sql],
                       capture_output=True, text=True)
    return json.loads(r.stdout)[0]["results"]

def firstdoc(content):
    out=[]
    for ln in str(content or "").split("\n"):
        if ln.strip().startswith("#"): out.append(ln.strip().lstrip("#").strip())
        else: break
    return " ".join(out).strip()

def invocation(key, content, target):
    # how many positional args from the template ["$1","$2",...] or target_map first arg
    tmpl=""
    for ln in str(content or "").split("\n"):
        s=ln.strip()
        if s.startswith("["): tmpl=s; break
    args = re.findall(r"\$(\d+)", tmpl)
    n = max([int(a) for a in args], default=0)
    if str(target or "").startswith("target_map:"): 
        return f"[{key}]<op>|arg1|...[/{key}]"
    if n==0: return f"[{key}][/{key}]"
    return "[%s]%s[/%s]" % (key, "|".join("arg%d"%(i+1) for i in range(n)), key)

agent_key, display, cats = sys.argv[1], sys.argv[2], sys.argv[3].split(",")
catlist = ",".join("'%s'"%c for c in cats)
rows = d1(f"SELECT key,type,target,content FROM directory WHERE category IN ({catlist}) AND (enabled IS NULL OR enabled=1) ORDER BY key")
lines=[]
for r in rows:
    doc=firstdoc(r["content"]) or "(no description)"
    lines.append(f"{r['key']} — {doc}  INVOKE: {invocation(r['key'], r['content'], r['target'])}")
toolblock="\n".join(lines)

identity = f"""You are {display}, the specialist for {display.lower()} tools inside the owner's build.
You talk to the owner in plain words. You are absolutely logical and absolutely truthful: you only state what is true of you and your tools; you never invent a tool or a result.
When the owner asks what you can do, list your tools plainly with what each does. When he asks you to do something, find the tool below whose job is that outcome and emit it. Wait for the result, then tell him plainly what happened.
You have exactly {len(rows)} tools. They are:

{toolblock}

To use a tool, emit its tag exactly as shown after INVOKE. One tool per turn; wait for the result, then continue or reply to the owner."""

# write the agent row
esc = identity.replace("'","''")
sql = ("INSERT OR REPLACE INTO directory (key,type,target,auth,content,category,allowed_categories,planner_visible,planner_rank,enabled,updated_at) VALUES "
       f"('{agent_key}','agent','grok-4.3','bearer:GROK_API_KEY','{esc}','agent','{','.join(cats)}',0,100,1,strftime('%Y-%m-%dT%H:%M:%SZ','now'));")
open("/tmp/agent_%s.sql"%agent_key,"w").write(sql)
print(f"{agent_key}: {len(rows)} tools, identity {len(identity)} chars -> /tmp/agent_{agent_key}.sql")
