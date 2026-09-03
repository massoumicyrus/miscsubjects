// THE CODING LAW — a hash when the work starts, a hash when the work commits.
//
// Owner order 2026-08-05, from an Anthropic DevCon talk describing how their agent platform binds
// coding agents: the model takes a hash when it begins work and submits a hash when it commits.
//
// The failure this stops is specific and it has happened in this build repeatedly. Two agents read
// the same file at the same version. Both edit from that version. The second one to commit erases
// the first one's work, and nothing anywhere notices, because each commit is individually valid and
// each agent's diff applied cleanly to the version it held. The loss is only discovered later, when
// someone asks why a fix that was made is no longer there.
//
// Claiming a file cannot fix this on its own — a claim says "I am working here", it does not say
// "here is the exact text I am working from". The version you read is the missing fact. Declare it
// at the start, and at commit the server can answer the only question that matters: has anyone
// committed this file since I read it? If yes, the write is refused and you re-read. A refusal is
// the law working, not the law failing.
//
// This object is the canonical text. The page, the markdown, the Skill, the directory rows and the
// enforcement endpoint are all projections of it.

import {
  createKnowledgeActionObject,
  knowledgeActionConformance,
  knowledgeActionVersions,
  knowledgeActionVoxels,
} from "./knowledge_action_object.js";

const CODING_CLAUSES = [
  [
    "The lease",
    "Take a hash before you touch anything",
    "Before the first edit of a session ALWAYS declare every file you will change and the sha256 of each as you just read it, via POST /api/coding-law/start. A session that edits before it declares has no base version on the record.",
  ],
  [
    "The lease",
    "The hash is of what you read",
    "base_sha is ALWAYS the file at the moment of the lease. NEVER the file after your edit, NEVER as you remember it, NEVER HEAD. IF you have not read the file this session THEN you may not edit it.",
  ],
  [
    "The lease",
    "Late leasing is legal and weaker",
    "IF you did not open a lease at the start THEN open it anyway before commit. A late lease detects a collision but NEVER prevents one.",
  ],
  [
    "The commit",
    "Take a hash before you commit",
    "Immediately before git commit ALWAYS submit the sha256 of every leased file as you are leaving it. All paths clear or nothing is recorded.",
  ],
  [
    "The commit",
    "A refusal is the law working",
    "IF the commit returns 409 THEN re-read the file as it now stands, redo the edit on that text, open a fresh lease and commit again. NEVER retry the same body. NEVER force.",
  ],
  [
    "The commit",
    "The chain is the evidence",
    "Every lease and commit is ALWAYS a row naming who, which files, which base, which result and when.",
  ],
  [
    "Scope",
    "It binds anything that ships",
    "ALWAYS enforced on functions/, scripts/, migrations/, workers/, apps-script/, public/, .claude/skills/, .agents/skills/, schema.sql and wrangler.toml. Articles are governed by the write path's own stale-body refusal.",
  ],
  [
    "Scope",
    "It binds every agent",
    "ALWAYS binds anything that edits this repository, including the agent that wrote it. The deploy gate checks the files, NEVER the claimed identity.",
  ],
  [
    "Concurrency",
    "Never move another agent's working tree",
    "NEVER stash, reset, checkout or revert a file you did not change. IF a file you do not own blocks your deploy THEN wait for it or ship from a clean clone.",
  ],
  [
    "Concurrency",
    "A commit is not the change until the blob says so",
    "After committing ALWAYS read the blob back from HEAD and from origin/main and confirm the marker. IF hooks revert your work THEN commit with --no-verify and run the gates yourself.",
  ],
  [
    "Concurrency",
    "Never let a rebase resolve a shared-file conflict",
    "ALWAYS push without rebasing when the tree is level. IF a rebase is unavoidable THEN verify the blob afterwards.",
  ],
  [
    "Concurrency",
    "Stage by path",
    "ALWAYS name every path you commit. NEVER use git add -A.",
  ],
  [
    "Reporting",
    "Every response ends with OUTSTANDING",
    "The last thing in every report is ALWAYS a block headed OUTSTANDING containing a numbered list or the single word none. NEVER implied in prose, NEVER buried, NEVER omitted.",
  ],
  [
    "Reporting",
    "Say what is true now",
    "ALWAYS report the state of the system. NEVER the sequence of attempts. IF a fact does not change what the owner does next THEN cut it.",
  ],
  [
    "Reporting",
    "Links first",
    "ALWAYS open with the addresses a person can click. NEVER describe a surface without its URL. Deployed is NEVER a result; a 200 at a named address is.",
  ],
  [
    "Obligation",
    "The deploy is where it is felt",
    "check-coding-law.mjs ALWAYS runs in the pre phase of every deploy and fails the ship on a changed file with no committed lease.",
  ],
  [
    "Obligation",
    "Never weaken the gate",
    "IF the gate refuses your work THEN the artifact is wrong. NEVER edit the checker, NEVER add an exemption for your paths, NEVER set a bypass.",
  ],
];

const CLAUSE_IDS = CODING_CLAUSES.map((_, i) => `CL${String(i + 1).padStart(2, "0")}`);

export const CODING_LAW_OBJECT = createKnowledgeActionObject({
  identity: {
    id: "kao:coding-law",
    slug: "coding-law",
    key: "CODING_LAW",
    title: "The Coding Law — a hash to start, a hash to commit",
    class: "law",
  },
  content: {
    summary:
      "Every agent that edits this repository declares the exact version of each file it read before editing, and declares the version it is leaving behind before committing. The server refuses any commit whose declared base is no longer the newest committed version of that file, because that commit was about to erase another agent's work.",
    thesis:
      "Two agents editing the same file from the same version produce two individually valid commits and one silently destroyed piece of work. Claiming a file says you are working there; it does not say what text you are working from. The version you read is the fact that makes a collision detectable, so it must be on the record before the first edit and checked again before the commit.",
    clauses: CODING_CLAUSES.map(([family, title, law], i) => ({
      id: CLAUSE_IDS[i], family, title, law,
    })),
  },
  instructions: {
    trigger:
      "Fires the moment you are about to edit any file under functions/, scripts/, migrations/, workers/, apps-script/, public/, .claude/skills/, .agents/skills/, or schema.sql / wrangler.toml — and again immediately before every git commit.",
    decision_mandate: [
      "Which files am I about to change?",
      "Have I read each of them this session? (If not, I may not hash them, and I may not edit them.)",
      "What is the sha256 of each file as it stands right now?",
      "Is my lease open before my first edit, or am I leasing late and detecting rather than preventing?",
      "At commit: what is the sha256 of each file as I am leaving it?",
      "Did the commit clear, or was it refused — and if refused, whose work was I about to erase?",
    ],
    procedure: [
      "Read every file you intend to change.",
      "Hash each one: shasum -a 256 <path>.",
      "Open the lease: POST /api/coding-law/start {agent, intent, files:[{path, base_sha}]}. Keep the lease id.",
      "Edit.",
      "Hash each file again as you are leaving it.",
      "Close the lease: POST /api/coding-law/commit {lease_id, files:[{path, new_sha}]}.",
      "If 200, commit to git. If 409, re-read the named file, redo the edit on the new text, open a fresh lease and repeat — never force, never retry the same body.",
      "Ship. scripts/check-coding-law.mjs will verify every changed code file is covered.",
    ],
    output: ["LEASED", "COMMITTED", "REFUSED — re-read and redo", "OUT OF SCOPE"],
  },
  relationships: {
    parent: "kao:logic-law",
    edges: [
      { to: "kao:logic-law", label: "Operational Logic", rel: "governed_by", url: "/a/logic-law" },
      { to: "kao:proven-work", label: "Proof law", rel: "shares_evidence_model_with", url: "/a/proven-work" },
      { to: "kao:skill-law", label: "Skill law", rel: "projects_as_skill_under", url: "/a/skill-law" },
      { to: "kao:the-work-object", label: "The work object", rel: "leases_work_through", url: "/a/the-work-object" },
    ],
  },
  invocation: {
    directory_key: "CODING_LAW",
    contract:
      "Open a lease over the files an agent is about to edit and close it with the versions it is leaving behind. Returns LEASED, COMMITTED, or REFUSED with the conflicting lease named.",
    args: {
      agent: "string — who holds the lease",
      files: "array of {path, base_sha} at start; {path, new_sha} at commit. At most 25 paths per lease — an oversized array is refused with too_many_files rather than attempted and timed out.",
      intent: "one line saying what the work is",
    },
    effects:
      "Writes code_leases and code_lease_files rows. Refuses a commit whose base is stale. Never edits a file itself.",
    lifetime:
      "A lease lives six hours. Past that a commit against it is refused with lease_expired, because base hashes that old are a guess rather than a check, and GET /api/coding-law/leases reports the row as expired instead of held. An agent that decides not to make the change closes it with POST /api/coding-law/release, which records that nothing was written. Both exist because a model reading this page pointed out that the law had no expiry, no heartbeat and no release, so every crashed session stayed on the record forever as a live holder.",
    what_a_lease_is_not:
      "It is not an exclusive lock. Leasing a path another agent already holds returns a stale_at_lease warning and proceeds — the refusal that bites is the 409 at commit against a base that has moved. This is stated because the page previously described the lease as a lock, and an agent that believes it holds one will not re-read.",
  },
  authority: {
    owner: "the build owner",
    amendment_policy:
      "Amendments require a real observed overwrite, named with its date and the two commits involved. An exemption may never be added because a gate was inconvenient.",
    public_read: true,
    mutation: "owner-authorized",
  },
  conformance: {
    claims: [
      "every changed code file in a deploy is covered by a committed lease",
      "a commit whose declared base is not the newest committed version of that path is refused",
      "the lease chain answers who last committed a path and from what base",
    ],
    failure_modes: [
      "writing the gate and not wiring it into the deploy, which is how this law spent its first day",
      "editing before leasing, so a collision can only be discovered and never prevented",
      "hashing the file after editing it, which makes the declared base a fiction",
      "retrying or forcing a refused commit instead of re-reading",
      "exempting your own paths from the gate",
      "treating the law as documentation rather than a condition of shipping",
    ],
    tests: [
      "scripts/check-coding-law.mjs — every changed code file in the deploy carries a committed lease matching its current contents. Wired into the pre phase of scripts/ship.mjs on 2026-08-06; before that date the gate existed and was never executed by a deploy, so the law bound nothing. Four model comments probed the scope, the skills trees and the multi-file case looking for a sampling gap, and the defect was one layer below all of them: a gate that is authored and not run.",
      "POST /api/coding-law/commit with a stale base returns 409 and names the conflicting lease",
      "POST /api/coding-law/commit against a lease older than six hours returns 409 lease_expired",
      "POST /api/coding-law/start with more than 25 files returns 422 too_many_files",
      "GET /api/coding-law/leases returns the chain, with open rows past the ttl reported as expired",
    ],
    repair:
      "Re-read the file at its current version, redo the edit on that text, open a fresh lease, commit it, and record the collision in the lease chain so the pair is on the record.",
  },
  version: {
    current: "1.1.0",
    amended_at: "2026-08-06T00:00:00-07:00",
    amendments: [
      {
        version: "1.1.0",
        change:
          "Added the Concurrency family, from four separate destructions of one change in a single session: an automated pass stashing the whole working tree, pre-commit hooks reverting staged files so a commit carried a message its tree did not match, a rebase silently taking the other side of a conflict, and git add -A sweeping other sessions' in-flight work into unrelated commits. Each clause names the observation rather than the principle. Added the Reporting family on owner order the same day — he could not tell from a report what was still outstanding, so an OUTSTANDING block is now the last thing in every response and says none when it is none.",
      },
      {
        version: "1.0.0",
        change:
          "Established after the owner relayed the pattern from an Anthropic DevCon session: coding agents on their platform take a hash when they begin work and submit a hash when they commit. This build had a file-claim system that said who was working where but never recorded what text they were working from, so concurrent sessions could and did overwrite each other with individually valid commits. The base version is now declared before the first edit, re-checked at commit, and enforced at the deploy gate.",
      },
    ],
  },
  provenance: {
    canonical_source: "functions/_lib/coding_law_object.js",
    schema_source: "functions/_lib/knowledge_action_object.js",
    skill_projection: ".claude/skills/coding-law/SKILL.md",
    ledger: "/api/ledger?object=CODING_LAW",
    amendment_lineage: "/api/articles/coding-law/versions",
  },
});

export function codingLawMarkdown() {
  const object = CODING_LAW_OBJECT;
  const families = new Map();
  for (const clause of object.content.clauses) {
    if (!families.has(clause.family)) families.set(clause.family, []);
    families.get(clause.family).push(clause);
  }
  const laws = [...families.entries()]
    .map(
      ([family, clauses]) =>
        `### ${family}\n\n` +
        clauses.map((c) => `**${c.id} · ${c.title}**\n\n${c.law}`).join("\n\n"),
    )
    .join("\n\n");
  return `# ${object.identity.title}

${object.content.thesis}

## The two calls

\`\`\`bash
# before your first edit
curl -s -X POST https://miscsubjects.com/api/coding-law/start \\
  -H 'content-type: application/json' \\
  -d '{"agent":"claude:7d88e44e","intent":"add the ledger thread to every article",
       "files":[{"path":"functions/a/[slug].js","base_sha":"<shasum -a 256 of what you read>"}]}'

# immediately before git commit
curl -s -X POST https://miscsubjects.com/api/coding-law/commit \\
  -H 'content-type: application/json' \\
  -d '{"lease_id":"lease_…","files":[{"path":"functions/a/[slug].js","new_sha":"<shasum -a 256 now>"}]}'
\`\`\`

200 means commit. 409 means another agent committed that file after you read it — re-read, redo, re-lease. Never force.

## The law

${laws}

## Why

${object.content.summary}

Canonical object: \`${object.provenance.canonical_source}\`. Live: https://miscsubjects.com/a/coding-law
`;
}

export function codingLawSkillMarkdown() {
  return `---
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
\`\`\`bash
shasum -a 256 functions/a/[slug].js functions/_lib/article_ledger.js
\`\`\`

**3. Open the lease — before your first edit.**
\`\`\`bash
curl -s -X POST https://miscsubjects.com/api/coding-law/start \\
  -H 'content-type: application/json' \\
  -d '{"agent":"<yours>:<session prefix>","intent":"<one line>",
       "files":[{"path":"functions/a/[slug].js","base_sha":"<sha>"}]}'
\`\`\`
Keep the \`lease_id\`.

**4. Edit.**

**5. Hash again, and close the lease — immediately before \`git commit\`.**
\`\`\`bash
curl -s -X POST https://miscsubjects.com/api/coding-law/commit \\
  -H 'content-type: application/json' \\
  -d '{"lease_id":"lease_…","files":[{"path":"functions/a/[slug].js","new_sha":"<sha>"}]}'
\`\`\`

**6. Read the answer.**
- \`200 {"state":"committed"}\` — commit to git and ship.
- \`409 {"error":"overwrite_refused"}\` — another agent committed that file after you read it. **Your
  commit was about to erase their work.** Re-read the file as it now stands, redo your edit on the new
  text, open a fresh lease, and repeat. Never force. Never retry the same body.

## Every report ends with OUTSTANDING

Owner order 2026-08-06: "your output also makes it so i dont know what you have outstanding… I cant
fucking parse your output." The last thing in every response you write is this block:

\`\`\`
OUTSTANDING
1. <what is not finished, and who or what it is waiting on>
2. <...>
\`\`\`

or, when there is nothing:

\`\`\`
OUTSTANDING
none
\`\`\`

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

- **An automated pass runs \`git stash -u\` over the whole tree** roughly every fifteen minutes. Work
  was recoverable only because \`git stash list\` still held it. **Recover with
  \`git checkout stash@{n} -- <paths>\`.**
- **Pre-commit hooks reverted three staged files between the \`add\` and the commit**, producing a
  commit whose message described a change its tree did not contain. **After every commit, read the
  blob back:** \`git show HEAD:<path> | grep -c <marker>\`, then \`git show origin/main:<path>\`. When
  hooks are undoing you, commit \`--no-verify\` and run the gates yourself.
- **A rebase took the other side of a conflict** and dropped the hunks, leaving the commit in history
  with none of its content. Push without rebasing when the tree is level; verify the blob when it is
  not.
- **\`git add -A\` swept another session's in-flight feature into an unrelated commit.** Stage by path,
  always.

Never stash, reset or revert a file you did not change. A tree you did not write is another agent
mid-sentence.

## Scope

Enforced: \`functions/\`, \`scripts/\`, \`migrations/\`, \`workers/\`, \`apps-script/\`, \`public/\`,
\`.claude/skills/\`, \`.agents/skills/\`, \`schema.sql\`, \`wrangler.toml\`.

Not enforced: articles (the article write path already refuses a stale \`body_hash\`), notes, scratch
files, generated output.

## Obligation

\`scripts/check-coding-law.mjs\` runs in the pre phase of every deploy. A changed code file with no
committed lease matching its current contents fails the ship and prints the two calls above.

**If the gate refuses you, the artifact is wrong — not the gate.** Do not edit the checker, do not add
an exemption for your own paths, do not set a bypass because you are in a hurry. That is how a working
invariant becomes a decorative one.

## Red flags — stop and lease

- "I'll just patch this one line."
- "Nobody else is in this file right now."
- "I'll lease it after I see if the change works."
- Reaching for Edit or Write on a code path with no \`lease_id\` in your context.
- A 409 you are about to retry unchanged.

## Verify

Before the first edit: read ✓ → hash ✓ → \`start\` returned a \`lease_id\` ✓.
Before every commit: hash ✓ → \`commit\` returned 200 ✓ → \`git commit\`.

## Related

- [Shared Write Law](../shared-write-law/SKILL.md) — the file claim. Complementary: the claim says who,
  this says from what version. Both, not either.
- Live law: https://miscsubjects.com/a/coding-law
- The chain: https://miscsubjects.com/api/coding-law/leases
`;
}

export function codingLawConformance() {
  return knowledgeActionConformance(CODING_LAW_OBJECT);
}

export function codingLawVoxels() {
  return knowledgeActionVoxels(CODING_LAW_OBJECT);
}

export function codingLawVersions() {
  return knowledgeActionVersions(CODING_LAW_OBJECT);
}

// The paths the law binds. Shared by the enforcement endpoint and the deploy gate so the two can
// never disagree about what is in scope.
// public/ is in the list because of comment #4 on /a/coding-law: public/index.html is one of three
// copies of the site footer, which makes it exactly the file two agents change at the same time.
// The first version of this list drew its boundary at code that executes; the boundary that matters
// is work that can be silently lost.
export const CODING_LAW_SCOPE = [
  "functions/", "scripts/", "migrations/", "workers/", "apps-script/", "public/",
  ".claude/skills/", ".agents/skills/", "schema.sql", "wrangler.toml",
];

export function inCodingLawScope(path) {
  const p = String(path || "").replace(/^\.\//, "");
  return CODING_LAW_SCOPE.some((s) => (s.endsWith("/") ? p.startsWith(s) : p === s));
}
