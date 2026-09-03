#!/usr/bin/env node
/**
 * Publish the read-gate article. Uses the gate it describes.
 * Run: node scripts/post_read_gate_article.mjs
 */
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { getWriteToken } from "./write_token.mjs";

const BASE = "https://miscsubjects.com";
const KEY = (() => {
  try {
    const env = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8");
    const m = env.match(/TERMINAL_KEY=(.+)/);
    return m ? m[1].trim().replace(/^["']|["']$/g, "") : process.env.TERMINAL_KEY;
  } catch {
    return process.env.TERMINAL_KEY;
  }
})();

const slug = "read-gate";

const sources = [
  {
    id: "s1",
    type: "reference",
    title: "HTTP 428 Precondition Required (RFC 6585 §3)",
    publisher: "IETF",
    url: "https://www.rfc-editor.org/rfc/rfc6585#section-3",
    quote:
      "The 428 status code indicates that the origin server requires the request to be conditional.",
    summary:
      "The correct status for a refusal that tells the caller how to become allowed, rather than 401 (identity) or 403 (permission).",
    accessed_at: "2026-07-28T00:00",
    claim_ids: ["c5"],
  },
  {
    id: "s2",
    type: "reference",
    title: "Cloudflare Workers KV — writing key-value pairs with expirationTtl",
    publisher: "Cloudflare",
    url: "https://developers.cloudflare.com/kv/api/write-key-value-pairs/",
    summary:
      "Where the challenge and the token live. expirationTtl deletes both without a cleanup job: 900 seconds for a challenge, 1800 for a token.",
    accessed_at: "2026-07-28T00:00",
    claim_ids: ["c6"],
  },
  {
    id: "s3",
    type: "reference",
    title: "The Laws of Writing — the object the gate quizzes on",
    publisher: "miscsubjects",
    url: "https://miscsubjects.com/api/articles/writing-law",
    summary:
      "48 clauses. The challenge returns all of them and asks for three clause titles verbatim. Amending the law changes the answers automatically, because the questions are generated from the clause array rather than stored.",
    accessed_at: "2026-07-28T00:00",
    claim_ids: ["c4"],
  },
  {
    id: "s4",
    type: "model",
    model: "Claude Opus 5",
    surface: "Claude Code",
    vendor: "Anthropic",
    object: "article:proof-of-coverage",
    passes: 1,
    title: "The failure the gate was built after",
    quote:
      "The article was written from memory of the writing law rather than from the law. It satisfied a remembered style — short sentences, findings as headers — and violated the live clauses: the title was an aphorism, the opening argued before it defined, and a reader who had not been in the originating conversation could not tell what the page was about.",
    verdict: "Confirmed defect — rule existed, rule not read, rule broken",
    accessed_at: "2026-07-28T00:00",
    claim_ids: ["c1"],
  },
];

const claims = [
  {
    id: "c1",
    text: "A model that has a rule in its context can still write from its memory of the rule instead of the rule, and the output satisfies the remembered version.",
    section: "The failure",
    tier: "system",
    source_ids: ["s4"],
    why_material: "It is why instructions alone do not produce compliance.",
  },
  {
    id: "c2",
    text: "A gate converts reading from a request into the only path to the credential the write requires.",
    section: "The mechanism",
    tier: "system",
    source_ids: [],
    why_material: "It removes the model's discretion over whether to read.",
  },
  {
    id: "c3",
    text: "The challenge must be answerable only from the text just served, or it tests recall instead of reading.",
    section: "Designing the question",
    tier: "system",
    source_ids: [],
    why_material: "A question a model can answer from training data gates nothing.",
  },
  {
    id: "c4",
    text: "Generating the questions from the rule text means amending the rule changes the answers with no separate update.",
    section: "Designing the question",
    tier: "system",
    source_ids: ["s3"],
    why_material: "A stored answer key would drift from the law it protects.",
  },
  {
    id: "c5",
    text: "The refusal returns 428 with the exact three steps, so a caller that has never seen the gate can pass it without documentation.",
    section: "The refusal",
    tier: "system",
    source_ids: ["s1"],
    why_material: "A gate that requires out-of-band knowledge blocks work instead of directing it.",
  },
  {
    id: "c6",
    text: "The token expires after 1,800 seconds and the challenge after 900, so neither becomes a permanent key.",
    section: "Lifetimes",
    tier: "system",
    source_ids: ["s2"],
    why_material: "A non-expiring token turns the gate back into an instruction.",
  },
  {
    id: "c7",
    text: "The gate proves the rule was fetched and parsed. It does not prove the rule was followed.",
    section: "The limit",
    tier: "system",
    source_ids: [],
    why_material: "Stating the limit is what stops the token being read as a compliance certificate.",
  },
];

const body = `## What a read gate is

A read gate is a rule enforced by the API instead of by the prompt: a write is refused unless the caller holds a short-lived token, and the only way to get that token is to fetch the rule document and answer questions whose answers appear nowhere except in the text just served. Reading stops being something the caller is asked to do and becomes the only route to the credential the write requires.

This page describes the one running on miscsubjects.com, where article writes are gated on the site's writing law. Every part of it is in the repository and every route below can be called by anyone.

## The failure it was built after

A model was given the writing law in its context, wrote an article, and broke three clauses of it. The prose looked like the law: short sentences, headers that state findings, no hedging. It failed the parts that are not stylistic — the title was an aphorism that named neither subject nor deliverable, the page argued before it defined its subject, and a reader who had not been in the conversation that produced it could not say what it was about.

[[embed:source:s4]]

The mechanism of that failure is worth stating precisely, because it decides what the fix has to be. The model did not ignore the rule. It reconstructed the rule from memory of similar rules, wrote to that reconstruction, and never compared the output against the actual text. Nothing in an instruction can prevent that, because the instruction is exactly the thing being reconstructed. What prevents it is making the actual text mandatory to obtain something the model cannot proceed without.

## The three routes

\`\`\`bash
# 1. Ask for a challenge. The response contains every clause of the law.
curl -s "https://miscsubjects.com/api/write-gate/challenge?slug=my-article"
\`\`\`

The response:

\`\`\`json
{
  "challenge_id": "wg_1f0c…",
  "expires_in": 900,
  "law_version": "1.5.0",
  "law_hash": "e3b0c442…",
  "clauses": [ { "id": "W01", "family": "hostility", "title": "…", "law": "…" }, … ],
  "questions": [
    { "clause_id": "W19", "question": "Return the exact title of clause W19 as the field \\"W19\\"." },
    { "clause_id": "W33", "question": "Return the exact title of clause W33 as the field \\"W33\\"." },
    { "clause_id": "W45", "question": "Return the exact title of clause W45 as the field \\"W45\\"." }
  ]
}
\`\`\`

\`\`\`bash
# 2. Answer. Three clause titles, plus a hash of the whole clause set.
curl -s -X POST https://miscsubjects.com/api/write-gate/answer \\
  -H 'content-type: application/json' \\
  -d '{"challenge_id":"wg_1f0c…","law_hash":"e3b0c442…","answers":{"W19":"…","W33":"…","W45":"…"}}'
# -> { "write_token": "wt_9a1c…", "expires_in": 1800 }
\`\`\`

\`\`\`bash
# 3. Write, carrying the token.
curl -s -X POST https://miscsubjects.com/api/articles/my-article \\
  -H 'content-type: application/json' \\
  -H 'x-write-token: wt_9a1c…' \\
  -d '{"title":"…","body":"…"}'
\`\`\`

Without step 3's header, the write returns 428 and the three steps above, so a caller that has never heard of the gate can pass it from the refusal alone.

\`\`\`json
{
  "error": "write_gate",
  "reason": "Article body and title writes require a write token. A token is issued only to a caller that fetched the live writing law and answered questions about it correctly.",
  "steps": [
    "GET /api/write-gate/challenge?slug=my-article — returns every clause and 3 questions",
    "POST /api/write-gate/answer {challenge_id, law_hash, answers} — returns write_token, valid 30 minutes",
    "POST /api/articles/my-article with header x-write-token: <write_token>"
  ]
}
\`\`\`

[[embed:source:s1]]

## Designing a question a model cannot bluff

The whole mechanism rests on one property: the answer must be unavailable to a model that did not read the response. That rules out most obvious questions.

| Question type | Why it fails or works |
|---|---|
| "Do you agree to follow the writing law?" | Fails. Answerable with no reading at all. |
| "Summarise the writing law." | Fails. A plausible summary is generable from the name. |
| "What does clause W12 say, roughly?" | Fails on grading, not on reading — any grader loose enough to accept paraphrase accepts invention. |
| "Return the exact title of clause W33." | Works. The titles are specific to this document and are not in any training set. |
| "Return the sha256 of every clause joined as id+title+law." | Works, and additionally proves the caller has the whole array, not one clause. |

The hash requirement is what makes partial reading useless. A caller can only compute it from the complete clause set in the exact order served, so quoting three titles found by searching is not enough.

Grading normalises case and punctuation and nothing else. A near-miss is a refusal with the failing clause ids named, because a grader that accepts approximate answers is a gate that accepts approximate reading.

[[embed:source:s3]]

The questions are generated from the clause array at request time, not stored. Adding a clause to the law changes the pool of possible questions immediately, and changes the law hash, which invalidates any answer computed from an older version. There is no answer key to keep in sync.

## Lifetimes, and why both are short

| Object | Lifetime | Reason |
|---|---|---|
| challenge | 900 s | Long enough to read 48 clauses and answer; short enough that a challenge cannot be answered by a different session later. |
| write token | 1800 s | Long enough to write a full article; short enough that it cannot be pasted into a config file and reused for a month. |

[[embed:source:s2]]

A token issued against a named slug only works for that slug. A token from a challenge with no slug works for any single article write. Both live in Cloudflare Workers KV with \`expirationTtl\`, so expiry needs no cleanup job.

## What is gated and what is not

Only prose: article body, title, and find/replace edits to a body. Everything else stays open — sources, claims, reviews, contributions, status changes, metadata. Those are ledger appends, not writing, and gating them would stall the system's own record-keeping to enforce a rule about sentences.

\`\`\`js
const touchesProse =
  b?.body != null || b?.content != null || b?.title != null || typeof b?.find === 'string';
if (!touchesProse) return null;              // ledger appends pass straight through
if (await tokenValid(env, token, slug)) return null;
return json(gateRefusal(slug), 428);
\`\`\`

This scoping is the difference between a gate and an outage. A gate that catches everything gets disabled the first time it blocks something urgent.

## Generalising it

The pattern has four parts and none of them are specific to writing:

1. **A rule that lives at an address.** Not in a prompt, not in a file each agent carries a copy of. One canonical document that can be fetched and hashed.
2. **A challenge generated from that document at request time.** Questions derived from the text, so the rule and the test can never diverge.
3. **A short-lived credential issued only on an exact-correct answer.**
4. **An enforcement point on the action itself,** refusing with instructions rather than with a complaint.

Applied elsewhere: a deploy gated on the runbook, a schema migration gated on the data contract, an outbound message gated on the disclosure policy, a code merge gated on the security requirements for the touched directory. In each case the substitution is the same — the rule stops being advice the actor may recall and becomes a fetch the actor cannot skip.

## What it does not do

The gate proves the rule was fetched and parsed. It does not prove the rule was followed. A caller can answer three questions perfectly and then write a page that violates every clause, because reading and complying are different acts and only the first is mechanically checkable at the door.

What it removes is the excuse and the most common cause. The failure it was built after was not defiance; it was a model working from a remembered version of a rule it never opened. That specific failure is now impossible. Compliance still has to be checked after the fact — on this site by conformance scripts and by the person who reads the page and says it is wrong.
`;

async function main() {
  const { token } = await getWriteToken(slug);
  const payload = {
    slug,
    title: "Read gates: refusing a model's write until it proves it read the rule",
    body,
    register: "technical",
    tags: ["system", "protocol", "governance", "agents"],
    claims,
    sources,
    status: "published",
  };
  const r = await fetch(`${BASE}/api/articles/${slug}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-terminal-key": KEY,
      "x-write-token": token,
    },
    body: JSON.stringify(payload),
  });
  console.log(r.status, (await r.text()).slice(0, 300));
}

main();
