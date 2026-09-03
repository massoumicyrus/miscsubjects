#!/usr/bin/env node
/**
 * Publish the proof-of-coverage article.
 * Run: node scripts/post_coverage_proof_article.mjs
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

const slug = "proof-of-coverage";

const sources = [
  {
    id: "s1",
    type: "reference",
    title: "W3C PROV-DM: The PROV Data Model",
    publisher: "W3C",
    url: "https://www.w3.org/TR/prov-dm/",
    quote:
      "PROV-DM is a data model for provenance that describes the entities, activities and agents involved in producing a piece of data or thing in the world.",
    summary:
      "The standard vocabulary for saying who did what to which thing. It models the pass. It does not model the universe, so it cannot express coverage.",
    accessed_at: "2026-07-27T00:00",
    claim_ids: ["c8"],
  },
  {
    id: "s2",
    type: "github",
    repo: "in-toto/attestation",
    title: "in-toto attestation framework: signed statements about software artifacts",
    url: "https://github.com/in-toto/attestation",
    summary:
      "A signed statement binds a predicate to a subject identified by cryptographic digest. This is the shape a pass record needs: the claim is bound to the hash of the exact thing examined, not to its name.",
    accessed_at: "2026-07-27T00:00",
    claim_ids: ["c4"],
  },
  {
    id: "s3",
    type: "reference",
    title: "SLSA v1.0 provenance specification",
    publisher: "slsa.dev",
    url: "https://slsa.dev/spec/v1.0/provenance",
    quote:
      "The provenance attestation describes how an artifact was produced, including the builder identity, the build definition, and the resolved dependencies.",
    summary:
      "Builder identity plus resolved inputs plus an externally produced record. Same three parts a model pass needs, applied to build systems instead of inference.",
    accessed_at: "2026-07-27T00:00",
    claim_ids: ["c4"],
  },
  {
    id: "s4",
    type: "reference",
    title: "OpenTelemetry tracing specification",
    publisher: "OpenTelemetry",
    url: "https://opentelemetry.io/docs/specs/otel/trace/api/",
    summary:
      "Records operations and their causal relationships across services. Spans are sampled and expire, and nothing declares how many spans should have existed, so a trace cannot answer a coverage question.",
    accessed_at: "2026-07-27T00:00",
    claim_ids: ["c8"],
  },
  {
    id: "s5",
    type: "reference",
    title: "OpenLineage object model",
    publisher: "OpenLineage",
    url: "https://openlineage.io/docs/spec/object-model",
    summary:
      "Datasets, jobs and runs, tracked across pipelines. Lineage at dataset granularity: it says a job read a table, not which of the table's rows were evaluated.",
    accessed_at: "2026-07-27T00:00",
    claim_ids: ["c8"],
  },
  {
    id: "s6",
    type: "reference",
    title: "Cloudflare D1 pricing — rows written, rows read, storage",
    publisher: "Cloudflare",
    url: "https://developers.cloudflare.com/d1/platform/pricing/",
    quote:
      "Rows written: first 50 million / month included + $1.00 / million rows. Rows read: first 25 billion / month included + $0.001 / million rows. Storage: first 5 GB included + $0.75 / GB-mo.",
    summary: "The rates used in the cost arithmetic below. Page last updated 2026-04-21.",
    accessed_at: "2026-07-27T00:00",
    claim_ids: ["c7"],
  },
  {
    id: "s7",
    type: "model",
    model: "GPT-5.6",
    surface: "web app",
    vendor: "OpenAI",
    object: "claim:coverage-needs-a-denominator",
    passes: 1,
    title: "GPT-5.6 on the declared universe",
    quote:
      "Without the declared universe, “the AI checked everything” is unverifiable.",
    verdict: "Agreed — coverage requires a declared denominator",
    accessed_at: "2026-07-27T00:00",
    claim_ids: ["c1"],
  },
  {
    id: "s8",
    type: "model",
    model: "Kimi",
    surface: "kimi.com web app",
    vendor: "Moonshot",
    object: "claim:coverage-needs-a-denominator",
    passes: 1,
    title: "Kimi, given the same question and none of the first answer",
    quote:
      "Your “one door” is only as good as your proof that nothing slipped through it.",
    verdict: "Agreed — same conclusion, independent pass",
    accessed_at: "2026-07-27T00:00",
    claim_ids: ["c1"],
  },
  {
    id: "s9",
    type: "model",
    model: "GPT-5.6",
    surface: "web app",
    vendor: "OpenAI",
    object: "claim:model-narration-is-proof",
    passes: 1,
    title: "GPT-5.6 refuses the self-report",
    quote:
      "Model self-report is not proof. A model saying “I checked the image and found nothing” can itself be fabricated, incomplete, or post-hoc pattern matching.",
    verdict: "Refuted — the environment must produce the record, not the model",
    accessed_at: "2026-07-27T00:00",
    claim_ids: ["c4"],
  },
  {
    id: "s10",
    type: "model",
    model: "Kimi",
    surface: "kimi.com web app",
    vendor: "Moonshot",
    object: "claim:finite-shapes",
    passes: 2,
    title: "Kimi on how few shapes there are",
    quote: "Payments: Stripe, Square, PayPal, Plaid — same shape, different field names.",
    verdict: "Agreed — a new system is a classification, not an integration",
    accessed_at: "2026-07-27T00:00",
    claim_ids: ["c6"],
  },
  {
    id: "s11",
    type: "model",
    model: "GPT-5.6",
    surface: "web app",
    vendor: "OpenAI",
    object: "claim:coverage-proves-correctness",
    passes: 1,
    title: "The strongest objection on the page",
    quote:
      "Execution correctness: every intended object was processed under the intended procedure. World correctness: the resulting judgment was actually true. Ten models can consistently make the same error.",
    verdict: "Partially refuted — coverage proves the first only",
    accessed_at: "2026-07-27T00:00",
    claim_ids: ["c9"],
  },
];

const claims = [
  {
    id: "c1",
    text: "Coverage cannot be verified without a stored count of the objects that were supposed to be examined.",
    section: "The four objects",
    tier: "system",
    source_ids: ["s7", "s8"],
    why_material: "It is the field every existing provenance format omits.",
  },
  {
    id: "c2",
    text: "Coverage is a subtraction between the object table and the pass table, not a statement produced by a model.",
    section: "The arithmetic",
    tier: "system",
    source_ids: [],
    why_material: "It makes the completeness question a query anyone can rerun.",
  },
  {
    id: "c3",
    text: "The identity rule — what counts as one object — must be written down before enrolment, because it sets the denominator.",
    section: "The identity rule",
    tier: "system",
    source_ids: [],
    why_material: "Every coverage number is only as honest as this rule.",
  },
  {
    id: "c4",
    text: "A pass record is only evidence if the execution environment writes it and binds it to the hash of the exact input; a model's own account of its work is not evidence.",
    section: "The pass record",
    tier: "system",
    source_ids: ["s9", "s2", "s3"],
    why_material: "It sets the minimum content of the record and rules out narration.",
  },
  {
    id: "c5",
    text: "Hash-chaining pass records makes silent deletion detectable, because removing a row breaks every hash after it.",
    section: "The chain",
    tier: "system",
    source_ids: [],
    why_material: "Without it, a clean coverage report can be produced by deleting the failures.",
  },
  {
    id: "c6",
    text: "Most systems present a small number of record shapes, so enrolling the thousandth system is a classification against an existing template rather than a new integration.",
    section: "Enrolment",
    tier: "system",
    source_ids: ["s10"],
    why_material: "It is the reason the cost of the method does not grow with the number of systems.",
  },
  {
    id: "c7",
    text: "At Cloudflare D1's published rates, one billion pass records cost $1,000 to write once, about $490 per month to store, and $1.00 for a full-table coverage recount.",
    section: "Cost",
    tier: "system",
    source_ids: ["s6"],
    why_material: "It shows the method is limited by rules and access, not by money.",
  },
  {
    id: "c8",
    text: "PROV, OpenTelemetry and OpenLineage each record operations, and none of them stores a declared universe, so none can answer a coverage question by itself.",
    section: "What already exists",
    tier: "system",
    source_ids: ["s1", "s4", "s5"],
    why_material: "It locates the specific gap this method fills.",
  },
  {
    id: "c9",
    text: "A coverage proof shows a procedure ran over every enrolled object. It does not show the procedure was correct.",
    section: "The limit",
    tier: "system",
    source_ids: ["s11"],
    why_material: "Confusing the two is the way this method would be used to launder a bad rule.",
  },
];

const body = `## What proof of coverage is

Proof of coverage is a way of recording machine work so that a stranger can check whether every item that was supposed to be examined actually was. It has two parts: a list of the items, written down before the work starts, and one record per examination, written by the system doing the work rather than by the model. Completeness is then a subtraction between the two lists.

The problem it solves comes up whenever software is asked to look at many things and report back. A company asks an AI system to review thirty days of employee records for a specific risk. The system answers: reviewed, three concerns found. Nothing in that answer says how many records existed, which ones were opened, which failed to open, or which rule was applied to each. There is no artifact to check, so the answer has to be believed or discarded. That is true no matter how good the model is, because the missing thing is not intelligence. It is bookkeeping.

[[embed:source:s7]]

A second model, asked the same question with none of the first answer in front of it, stopped in the same place.

[[embed:source:s8]]

## The four objects

Everything below is built out of four record types. Nothing else is required.

| Object | What it is | Written when |
|---|---|---|
| **universe** | A named set of items to be examined, with a frozen count and the rule that decides membership | Once, before any work |
| **object** | One item in that set, with a stable id and a hash of its content | Once per item, at enrolment |
| **procedure** | A versioned description of the test to apply — the prompt, the model, the threshold, the tool | Once per version |
| **pass** | One examination of one object by one actor under one procedure, with the result | Once per examination |

"Universe" is the load-bearing word. It is the denominator: the number the coverage percentage is divided by. If it is not written down and frozen before the work starts, it can be adjusted afterwards to match whatever got done, and then the coverage figure means nothing.

## What a pass record contains

The record is written by the execution environment — the code that calls the model — never by the model itself. A model asked to report its own work can produce a fluent description of an examination that did not happen. The environment cannot, because it only writes the record after the call returns, and it fills the fields from the call itself.

\`\`\`json
{
  "universe_id": "u_2026_07_27_gate_a_faces",
  "object_id": "face:8f2a1c9d4b6e0175",
  "object_hash": "sha256:8f2a1c9d…0a1b2c",
  "procedure": "match@v3.1",
  "actor": "vision-model-a@operator-1",
  "input_envelope_hash": "sha256:1b9f…7d21",
  "output": "no_match",
  "confidence": 0.02,
  "started_at": "2026-07-27T18:04:11.221Z",
  "duration_ms": 412,
  "receipt": "sha256:c4d5…9e08",
  "prev": "sha256:aa01…4f6b",
  "hash": "sha256:bb02…7c1d"
}
\`\`\`

Field by field, and why each one is not optional:

| Field | Why it is there |
|---|---|
| \`object_hash\` | Binds the result to the exact bytes examined. Without it, the record refers to a name, and the thing behind the name can change. |
| \`procedure\` | Versioned. "Reviewed for risk" is not checkable; \`match@v3.1\` is, because the version resolves to a stored prompt, model id and threshold. |
| \`actor\` | Which model, which endpoint, which operator ran it. Two actors disagreeing about one object is a fact worth keeping. |
| \`input_envelope_hash\` | Hash of everything sent — prompt, parameters, attachments. Makes the call repeatable by a third party. |
| \`output\` | A value from a fixed set the procedure declares, not free text. Free text cannot be counted. |
| \`receipt\` | The provider's own identifier for the call, when one exists. Independent corroboration that the call occurred. |
| \`prev\`, \`hash\` | The chain. Explained below. |

[[embed:source:s9]]

The same requirement exists in software supply-chain security, where a signed statement binds a claim to the digest of the artifact rather than to its filename. The shape is borrowed, not invented.

[[embed:source:s2]]

## The chain, and what it stops

Each pass record hashes its own contents together with the hash of the record before it:

\`\`\`js
// hash = sha256(prev + canonical_json(record_without_hash))
async function chain(prev, record) {
  const body = JSON.stringify(record, Object.keys(record).sort());
  const bytes = new TextEncoder().encode(prev + body);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}
\`\`\`

Without the chain, the easiest way to produce a perfect coverage report is to delete the passes that failed. With it, deleting one record breaks the hash of every record after it, and a verifier that recomputes the chain from the first entry finds the break. The chain does not prevent deletion. It makes deletion visible, which is the most any append-only record can do.

## Coverage is a query, not a claim

With the four object types in place, "did it examine everything" stops being a question about the system's honesty:

\`\`\`sql
SELECT
  u.declared_count,
  COUNT(DISTINCT p.object_id) FILTER (WHERE p.output <> 'error') AS examined,
  u.declared_count - COUNT(DISTINCT p.object_id) FILTER (WHERE p.output <> 'error') AS missing
FROM universe u
LEFT JOIN pass p
  ON p.universe_id = u.id
 AND p.procedure = 'match@v3.1'
WHERE u.id = 'u_2026_07_27_gate_a_faces';
\`\`\`

A result of \`4812 | 4790 | 22\` is a real answer: twenty-two enrolled objects have no successful pass under that procedure, and a second query names them. "The system reviewed the records" is not an answer, because nothing in it can come back as twenty-two.

The same table answers the questions that matter after the fact. Which objects were examined more than once. Where two actors disagreed. Which objects nobody touched.

| Actor | Object | Passes | Result |
|---|---|---|---|
| \`vision-model-a@operator-1\` | \`face:F-1842\` | 1 | no match |
| \`vision-model-b@operator-2\` | \`image:I-9921\` | 1 | no match |
| \`vision-model-c@operator-3\` | \`image:I-9921\` | 2 | match, confidence 0.31 |
| \`doc-model-a@operator-4\` | \`receipt:R-4408\` | 1 | accepted |

Two actors reached opposite conclusions about \`image:I-9921\`. In separate systems that contradiction never meets. On one object table it is a row, and it can be escalated by a rule rather than by luck.

## The identity rule sets the denominator, so it is written first

The hardest part of this method is not the storage. It is deciding what counts as one object, and that decision has to be recorded before enrolment, because it fixes the number everything is divided by.

For faces in footage: is a person appearing in eleven frames one object or eleven? Is a face at nine pixels wide an object or an unusable detection? Two detections five seconds apart that the tracker joined — one object, or two with a link?

The rule is stored on the universe as text a person can read and as code that runs:

\`\`\`json
{
  "id": "u_2026_07_27_gate_a_faces",
  "declared_count": 4812,
  "frozen_at": "2026-07-27T18:00:00Z",
  "identity_rule": "One object per tracked face-track with >= 3 detections and minimum bounding box 40px. Tracks broken by more than 2s of occlusion are separate objects. Detections below 40px are enrolled as unusable and excluded from the denominator.",
  "identity_rule_impl": "sha256:9c41…b07e",
  "excluded": 337,
  "exclusion_reason": "below minimum resolution"
}
\`\`\`

Note \`excluded\`. Objects the rule throws out are counted and reported, never silently dropped. A universe that declares 4,812 objects and 337 exclusions is checkable. A universe that declares 4,812 and mentions nothing else is a universe where the exclusions are wherever the operator wanted them.

## Enrolling a system it does not cooperate with

The other system does not need to adopt any of this. Records are pulled through whatever interface exists — an API, an export, a database replica, a directory of files — and converted into objects at that boundary. Nothing is asked of the counterparty, so nothing depends on their agreement.

That is affordable because record shapes repeat. Different products, same structure:

| Shape | Fields that always exist | Examples |
|---|---|---|
| Collection | cursor or offset, page size, total or last-page marker | almost every list API |
| Record with identity | id, created, updated, owner | employee, customer, patient rows |
| Transaction | two parties, amount, currency, timestamp, status | payment processors, banks, ledgers |
| Message | sender, recipients, body, thread id, timestamp | email, chat, ticket systems |
| Media with detections | binary, checksum, detected regions with coordinates and confidence | image and video pipelines |
| Operation | inputs, actor, authority, effects, outputs | logs, audit trails, job runners |

[[embed:source:s10]]

An enrolment template is written once per shape. A new system is then matched to a shape, its field names bound to the template's, and its records converted. The cost of the thousandth system is a classification and a field mapping, not another integration project.

The remaining difficulty is real but ordinary: throughput, deduplication when the same underlying thing appears in two systems, ordering when timestamps disagree, and identity resolution when two records may be the same person. None of it changes the four object types.

## What it costs to store a billion passes

Rates below are Cloudflare's published D1 prices, page last updated 2026-04-21. A pass record with full 64-character hashes serialises to 659 bytes.

| Item | Arithmetic | Result |
|---|---|---|
| Writing 1,000,000,000 passes | 1,000 million × $1.00/million | **$1,000 once** |
| Storing them | 1e9 × 659 B = 659 GB; (659 − 5) × $0.75 | **$490.50 / month** |
| Full-table coverage recount | 1e9 rows read × $0.001/million | **$1.00 per recount** |
| Indexed coverage query on one universe | thousands of rows read | fractions of a cent |

[[embed:source:s6]]

A recount over a billion examinations costs a dollar. The reason this is not already normal practice is not the bill.

## What this does not prove

Coverage is proof that a procedure ran over every enrolled object. It is not proof that the procedure was right.

[[embed:source:s11]]

Ten models can apply the same wrong rule, sign cleanly, and produce a ledger with 100% coverage over a bad conclusion. Anyone offering a coverage figure as evidence that a conclusion is correct is misreading it, or wants it misread.

What the structure does buy is that the wrong conclusion now has an address. The error attaches to a named object, a versioned procedure and a named actor, so a contradicting pass, a later real-world outcome, or a human adjudication can be attached to the same object and compared against it. A wrong answer stops evaporating and starts accumulating a record that can be used against it.

## What already exists

None of the parts are new. The gap is specific and worth naming precisely.

[[embed:source:s1]]

PROV models entities, activities and agents — the pass, in other words — and has no concept of a declared set that the activities were supposed to cover.

[[embed:source:s3]]

SLSA and in-toto bind a claim to a digest and name the builder, which is exactly the shape a pass record needs, applied to build artifacts.

[[embed:source:s4]]

Traces record operations and their relationships, are commonly sampled, and expire on a retention policy. Nothing in a trace says how many spans should have existed.

[[embed:source:s5]]

Lineage tracks which job read which dataset. It answers questions at table granularity, not per row.

The missing piece across all of them is the same: a frozen, stored count of what was supposed to be examined, sitting next to the records of what was. Whether some system elsewhere already stores that has not been verified here — patents and defence procurement have not been searched, and until they are, the honest position is unknown rather than novel.
`;

async function main() {
  const payload = {
    slug,
    title:
      "Proof of coverage: how to prove an AI examined every record it was given",
    body,
    register: "technical",
    tags: ["system", "protocol", "objects", "ledger", "audit"],
    claims,
    sources,
    status: "published",
  };
  const { token } = await getWriteToken(slug);
  const r = await fetch(`${BASE}/api/articles/${slug}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-terminal-key": KEY, "x-write-token": token },
    body: JSON.stringify(payload),
  });
  console.log(r.status, (await r.text()).slice(0, 400));
}

main();
