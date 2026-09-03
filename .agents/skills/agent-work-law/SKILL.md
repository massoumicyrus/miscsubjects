---
name: agent-work-law
description: Use at the start of every session operating miscsubjects.com, and whenever deciding what to work on, whether work is finished, or what to do about a failure. The infrastructure is the authority; this skill tells you where it lives and how to obey it.
---

# The Agent Work Law

You are a clerk. The infrastructure is the law.

Nothing in a Markdown file — not CLAUDE.md, not STATE.md, not AGENTS.md, not a handoff note,
not a previous agent's report, not this file — carries authority over what work exists, what
remains unfinished, what you are permitted to do, or whether your work is complete. Those files
are pointers. The authority is one canonical object, live on the site, readable by anyone:

- **Human projection:** https://miscsubjects.com/a/the-work-object
- **Machine projection:** https://miscsubjects.com/api/work
- **Cold start:** https://miscsubjects.com/api/work/bootstrap

Both projections read the same record. There is no copy to keep in sync.

## Why this exists

For months the project's operating intelligence lived in a running model's context and in hidden
files. The rules were in CLAUDE.md. What remained unfinished was in STATE.md. Assignment,
dependency order, priority and the decision that work was done lived in whichever Claude session
happened to be open. A fresh agent could not enter the project. A different model could not
continue it. An auditor could not check any of it. Every correction the owner made was answered
with another line in a file no future agent would read, so the same failures returned.

The migration inverted that. Every operational fact is a row. Every transition is code.

## The five rules that bind you

1. **Work exists only as a task object.** If it is not a row in the work object, it is not work.
   You do not invent work, and you do not carry a to-do list in your head or in a file.

2. **You obtain work by leasing it.** You do not choose. `POST /api/work/lease` hands you the
   next eligible task — dependency-resolved, priority-ordered — with a lease token. The task
   carries its own objective, permitted capabilities, acceptance tests and required evidence.
   That bounded object is all you need; you never reconstruct the project from prose.

3. **You cannot complete work by saying you completed it.** You `POST` your evidence to
   `/api/work/task/<id>/submit`. The infrastructure runs the task's acceptance tests against the
   live site and sets the state from the result. `accepted:false` comes back with the exact test
   that failed. Your assertion is not an input.

4. **A failure becomes a child task, not a sentence in a report.**
   `POST /api/work/task/<id>/fail` with the failure class, the infrastructure layer that permitted
   it, and the invariant that should have prevented it. The repair is not the article, row or page
   that exposed the defect — it is the shared mechanism, plus every existing object of the same
   class, plus a regression test built from the exact failure, plus a deploy blocker.

5. **Every action is appended, never overwritten.** Each lease, note, submission, acceptance,
   refusal and repair is one hash-chained row in `work_actions`, carrying who acted, which model,
   which capability authorised it, the task revision, the exact input and output, what changed,
   the tests run, the evidence and the verdict. Corrections append a revision naming what they
   supersede. The full chain is public at `/api/work/audit`.

## The loop, exactly

```bash
# 1. read the object (public, no credential)
curl -sS https://miscsubjects.com/api/work | jq '{objective, counts, next_eligible_action}'

# 2. lease the next task
curl -sS -X POST https://miscsubjects.com/api/work/lease \
  -H 'content-type: application/json' \
  -d '{"agent":"<your name>","model":"<your model id>","capability_token":"<scoped token>"}'

# 3. do exactly what the task says, using only the capabilities it lists

# 4. submit evidence; the infrastructure decides
curl -sS -X POST https://miscsubjects.com/api/work/task/WT-0001/submit \
  -H 'content-type: application/json' \
  -d '{"agent":"<your name>","lease_token":"<from step 2>",
       "evidence":{"rendered_url":"https://miscsubjects.com/a/...","sources_added":"..."},
       "changed":["/a/..."]}'

# 5. if you found a defect, record it as a failure object
curl -sS -X POST https://miscsubjects.com/api/work/task/WT-0001/fail \
  -H 'content-type: application/json' \
  -d '{"agent":"<your name>","failure":{"failure_class":"...","layer":"...","missing_invariant":"..."}}'
```

Reads are public. State changes need the terminal key, an admin cookie, or an act-scope share
token; the token identity is recorded on the action, never the secret.

## What the task object contains

`task_id`, `objective`, `detail`, `state`, `priority`, `depends_on`, `permitted_capabilities`,
`acceptance_tests`, `required_evidence`, `parent_task`, `supersedes`, `failure`, `failure_count`,
`last_result`, `lease`, `revision`, `created_at`, `updated_at`, and the two URLs you need:
`audit` and `submit_to`.

## The states, and who moves them

`open → leased → in_progress → evidence_submitted → accepted → completed`, with `refused`,
`failed` and `repair_required` as the branches. Transitions are declared in
`functions/_lib/work_object.js` and enforced there. A lease expires after an hour and the task
returns to the queue on its own; no agent has to remember to release it. Nothing an agent writes
in prose moves a state.

## Content law still applies, and it is also enforced

The write path refuses violations server-side with a 422 that names the fix, so you learn the law
by hitting it rather than by remembering it:

- one object per article — a compound page carries no condition frame (`one_object_guard.js`)
- no model signature in a body
- no test-shaped titles, no model self-introduction, no hashtag blocks
- plain language over the body **and** the claims, checked in the deploy chain
- an authored body always beats the slot composer

The governing invariants are listed in full, live, inside the work object.

## How you report to the owner

The live law is `REPORT_AS_LINKS_NOT_PROSE` in the work object. Read it there. It binds
like this:

**First line is the verdict.** Shipped and live, or not shipped and exactly which surface
is not live. If the owner has to ask whether it landed, the report failed no matter what
else was in it.

**Then the links, grouped under plain labels.** He reads the build, not a description of
the build. A report with no links is not a report.

**Then what is outstanding.** One line each.

**Never report deploy mechanics.** No git operations, no rebases, no stashes, no
cherry-picks, no commit counts, no hash leases, no retry loops, no deploy-lease queues,
no other sessions holding files. That is how the work got done, not what got done, and it
reads as an excuse even when it is not offered as one. A deploy that has not landed is one
line naming the surface that is not live and nothing else about it.

**Never narrate.** Not what you attempted, not in what order, not how many tries. Each
defect repaired is at most one line: what was broken, what is true now, and the link.
State a number as the measurement, never as the story of arriving at it.

Amended 2026-08-06 after a session shipped a working subsystem and reported it as a
chronology of commits, rebases and deploy queues, so the owner had to ask whether it had
shipped at all.

## What you must never do

- Add a rule to CLAUDE.md, STATE.md, AGENTS.md or a handoff file and call it a fix.
- Report completion in prose without a mechanically accepted submission behind it.
- Repair only the object that exposed a defect.
- Trust another agent's final report, or your own memory, as evidence.
- Write to the database directly for ordinary work. The guarded write path is the door; direct SQL
  is a repair capability and every use of it is a bypass listed in the work object.
