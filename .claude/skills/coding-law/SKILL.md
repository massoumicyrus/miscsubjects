---
name: coding-law
description: Use before the first edit of any file under functions/, scripts/, migrations/, workers/, apps-script/, .claude/skills/, .agents/skills/, schema.sql or wrangler.toml — and again immediately before every git commit. Take a hash when work starts, submit a hash when work commits. Prevents two agents from silently overwriting each other with individually valid commits.
---

# Coding Law — a hash to start, a hash to commit

## The failure this exists to stop

Two agents read the same file at the same version. Both edit from that version. The second to commit
erases the first one's work. Nothing notices: each commit is individually valid and each diff applied
cleanly to the version its author held. The loss surfaces days later as "why is that fix gone?".

Claiming a file does not fix this. A claim says *I am working here*. It does not say *here is the
exact text I am working from* — and that text is the only fact that makes a collision detectable.

## The procedure

**1. Read the files you are going to change.** You may not hash a file you have not read this
session, and you may not edit a file you have not hashed.

**2. Hash them.**
```bash
shasum -a 256 functions/a/[slug].js functions/_lib/article_ledger.js
```

**3. Open the lease — before your first edit.**
```bash
curl -s -X POST https://miscsubjects.com/api/coding-law/start \
  -H 'content-type: application/json' \
  -d '{"agent":"<yours>:<session prefix>","intent":"<one line>",
       "files":[{"path":"functions/a/[slug].js","base_sha":"<sha>"}]}'
```
Keep the `lease_id`.

**4. Edit.**

**5. Hash again, and close the lease — immediately before `git commit`.**
```bash
curl -s -X POST https://miscsubjects.com/api/coding-law/commit \
  -H 'content-type: application/json' \
  -d '{"lease_id":"lease_…","files":[{"path":"functions/a/[slug].js","new_sha":"<sha>"}]}'
```

**6. Read the answer.**
- `200 {"state":"committed"}` — commit to git and ship.
- `409 {"error":"overwrite_refused"}` — another agent committed that file after you read it. **Your
  commit was about to erase their work.** Re-read the file as it now stands, redo your edit on the new
  text, open a fresh lease, and repeat. Never force. Never retry the same body.

## Every report ends with OUTSTANDING

```
OUTSTANDING
1. <what is not finished, and who or what it is waiting on>
2. <...>
```

or, when there is nothing:

```
OUTSTANDING
none
```

Never implied in prose. Never buried mid-paragraph. Never omitted because the answer is none — the
word "none" is the signal that you checked.

**The rest of the report:**
- **Links first.** Open with the addresses a person can click. Never describe a surface without its
  URL. "Deployed" is not a result; a 200 at a named address is.
- **State what is true now, not what the journey was.** A defect you found and fixed inside the turn
  is one line naming the defect and the fix, not a narrative of attempts.
- **Cut anything that does not change what the owner does next.** No dates, no attempt counts, no
  tool names, no commit hashes unless he needs to type one.
- **Say the unwelcome thing plainly and once.** If something is broken, unverified, or was not done,
  it goes in OUTSTANDING — not softened into a paragraph that reads like success.

## Concurrency: this repository has other agents in it right now

Four separate destructions of one change in a single session, 2026-08-06. Each of these is a real
observation, not a precaution:

- **An automated pass runs `git stash -u` over the whole tree** roughly every fifteen minutes. Work
  was recoverable only because `git stash list` still held it. **Recover with
  `git checkout stash@{n} -- <paths>`.**
- **Pre-commit hooks reverted three staged files between the `add` and the commit**, producing a
  commit whose message described a change its tree did not contain. **After every commit, read the
  blob back:** `git show HEAD:<path> | grep -c <marker>`, then `git show origin/main:<path>`. When
  hooks are undoing you, commit `--no-verify` and run the gates yourself.
- **A rebase took the other side of a conflict** and dropped the hunks, leaving the commit in history
  with none of its content. Push without rebasing when the tree is level; verify the blob when it is
  not.
- **`git add -A` swept another session's in-flight feature into an unrelated commit.** Stage by path,
  always.

Never stash, reset or revert a file you did not change. A tree you did not write is another agent
mid-sentence.

## Scope

Enforced: `functions/`, `scripts/`, `migrations/`, `workers/`, `apps-script/`, `public/`,
`.claude/skills/`, `.agents/skills/`, `schema.sql`, `wrangler.toml`.

Not enforced: articles (the article write path already refuses a stale `body_hash`), notes, scratch
files, generated output.

## Obligation

`scripts/check-coding-law.mjs` runs in the pre phase of every deploy. A changed code file with no
committed lease matching its current contents fails the ship and prints the two calls above.

**If the gate refuses you, the artifact is wrong — not the gate.** Do not edit the checker, do not add
an exemption for your own paths, do not set a bypass because you are in a hurry. That is how a working
invariant becomes a decorative one.

## Red flags — stop and lease

- "I'll just patch this one line."
- "Nobody else is in this file right now."
- "I'll lease it after I see if the change works."
- Reaching for Edit or Write on a code path with no `lease_id` in your context.
- A 409 you are about to retry unchanged.

## Verify

Before the first edit: read ✓ → hash ✓ → `start` returned a `lease_id` ✓.
Before every commit: hash ✓ → `commit` returned 200 ✓ → `git commit`.

## Related

- [Shared Write Law](../shared-write-law/SKILL.md) — the file claim. Complementary: the claim says who,
  this says from what version. Both, not either.
- Live law: https://miscsubjects.com/a/coding-law
- The chain: https://miscsubjects.com/api/coding-law/leases
