#!/usr/bin/env node
/**
 * "The gate now compares derivations, not citations." The v1.2.0 APPROVE was false
 * convergence; v1.3.x fixes it. Four live sealed outcomes, the model that reviewed the
 * author's own input, and the prompt-version -> conformance correlation.
 * Run: node scripts/post_derivation_gate.mjs
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
  } catch { return process.env.TERMINAL_KEY; }
})();

const slug = "auditable-reasoning-hardened";
const critique = readFileSync("/tmp/crit_full.txt", "utf8").replace(/^["']|["']$/g, "").replace(/\\n/g, "\n").slice(0, 5200);

const sources = [
  { id: "s1", type: "live_surface", title: "APPROVE — genuine derivation agreement, first under the new gate", publisher: "miscsubjects.com", url: BASE + "/receipt/inv_wl0rnh136b",
    summary: "Three findings, two families, unanimous AFFIRM, ONE distinct derivation signature (identical per-clause trigger/disposition/evidence), zero reasons. action_authorised: true.", accessed_at: "2026-07-30T00:00", claim_ids: ["c4"] },
  { id: "s2", type: "live_surface", title: "NEGATE — unanimous DENY, identical derivations", publisher: "miscsubjects.com", url: BASE + "/receipt/inv_cgwtkvx17u",
    summary: "The action is refused, not deferred. One derivation signature across three findings.", accessed_at: "2026-07-30T00:00", claim_ids: ["c5"] },
  { id: "s3", type: "live_surface", title: "ESCALATE — unanimous verdict, divergent derivations", publisher: "miscsubjects.com", url: BASE + "/receipt/inv_o6s0exhodd",
    summary: "All three models returned CANNOT_CONCLUDE and cited clauses [1,2,3] — yet two derived it differently, so the gate refused to seal. Verdict agreement is not derivation agreement.", accessed_at: "2026-07-30T00:00", claim_ids: ["c3"] },
  { id: "s4", type: "model", title: "@cf/zai-org/glm-5.2 reviewed the author's own case input — and found eight defects", publisher: "Cloudflare Workers AI via miscsubjects gateway", url: BASE + "/receipt/inv_qh3ge2x74b",
    model: "@cf/zai-org/glm-5.2", raw_response: critique,
    summary: "Asked as a colleague to critique the ruleset before adjudicating, the model found that clause 1 stated only a NECESSARY condition for access, never a sufficient one — so no clause licensed an affirmative grant. Seven more, each with the exact fix.", accessed_at: "2026-07-30T00:00", claim_ids: ["c6"] },
  { id: "s5", type: "live_surface", title: "The earlier gate catching an invented-clause hallucination", publisher: "miscsubjects.com", url: BASE + "/receipt/inv_2dsklah529",
    summary: "A first v1.3.0 panel escalated: glm-4.7-flash cited clauses 7, 8 and 12 in a three-clause ruleset. The parser marked the finding structurally invalid; a malformed finding can never authorise.", accessed_at: "2026-07-30T00:00", claim_ids: ["c2"] },
];

const claims = [
  { id: "c1", text: "The v1.2.0 first APPROVE was false convergence: three models cited the same clause numbers [1,2,3] but their per-clause derivations were not compared, so the gate authorised agreement it had not actually verified.", section: "The defect", tier: "system", source_ids: [], why_material: "The celebrated result was the exact failure the whole system exists to prevent, and only the fix revealed it." },
  { id: "c2", text: "A parsed decision-finding@1.0.0 object marks a finding structurally invalid — and unable to authorise — when it lacks a terminal decision, a required field, or the clause-evaluation vector, or when it invents a clause or evidence id.", section: "The fix", tier: "system", source_ids: ["s5"], why_material: "It converts undetected malformed reasoning into a recorded refusal, and it caught a live invented-clause hallucination." },
  { id: "c3", text: "The gate now compares canonical per-clause tuples — clause, trigger_state, disposition, load-bearing evidence — so a unanimous verdict with divergent derivations escalates instead of authorising.", section: "The fix", tier: "system", source_ids: ["s3"], why_material: "Proven live: three CANNOT_CONCLUDE findings citing [1,2,3] still escalated because two derived it differently." },
  { id: "c4", text: "Under the corrected gate and a sufficiency-complete input, three findings across two families reached one identical derivation signature and the gate returned APPROVE.", section: "Four outcomes", tier: "system", source_ids: ["s1"], why_material: "The genuine APPROVE the v1.2.0 result only impersonated." },
  { id: "c5", text: "A unanimous DENY with identical derivations sealed as NEGATE — the action refused, not deferred.", section: "Four outcomes", tier: "system", source_ids: ["s2"], why_material: "The refusal path, exercised live and cleanly." },
  { id: "c6", text: "A model operating under the constitution, asked to review the author's own case input as a colleague, found eight ambiguities the author had not — beginning with a ruleset that never licensed the affirmative answer it was being asked for.", section: "The input is half the instrument", tier: "system", source_ids: ["s4"], why_material: "The derivation divergences were not model defects; they were the model correctly reflecting an underspecified input back at its author." },
  { id: "c7", text: "Conforming-finding rate tracked prompt clarity, not model tier: at v1.3.0 (rules only) one of three findings was structurally valid; adding a worked right/wrong exemplar and a collegial uncertainty path took the capable seats to three of three with an identical derivation vector.", section: "Prompt version vs conformance", tier: "system", source_ids: [], why_material: "It settles the question the author raised — the variance was the prompt, not the model class." },
  { id: "c8", text: "No correctness-calibration study has been run: these outcomes prove the gate's structural behaviour, not that the models are correct at a known rate. That benchmark is the next experiment.", section: "What is not yet proven", tier: "system", source_ids: [], why_material: "The honest boundary; a gate that seals correctly on agreement still says nothing about whether the agreed answer is right." },
];

const body = `## The defect the last APPROVE was hiding

The [72-call experiment](${BASE}/a/auditable-reasoning-audited) ended on a celebrated result: the first sealed APPROVE, three models unanimous, clause signature [1,2,3]. It was false convergence.

The old gate compared the *clause numbers* each model cited. Three models can cite clauses 1, 2 and 3 and mean completely different things by them — clause 2 "triggered" for one and "not triggered" for another, resting on different records, pointing to opposite effects — and the gate would still call that agreement and authorise the action. Citing the same rule is not applying it the same way. The gate was reading the table of contents and calling it the argument.

This page is the fix, proven live, and the more uncomfortable finding underneath it: two of the things blocking a *genuine* APPROVE were never the models at all. One was the governing prompt. The other was the input.

## What changed in the gate

Every governed finding is now parsed into a versioned object (\`decision-finding@1.0.0\`) that is a deterministic projection of the raw payload — it never infers or repairs a missing field. A finding is **structurally invalid, and can never authorise**, when it lacks the terminal decision, lacks any required field, lacks the clause-evaluation vector, or invents a clause or an evidence id.

That last one is not hypothetical. A first panel under the new constitution escalated because \`glm-4.7-flash\` cited clauses **7, 8 and 12 in a three-clause ruleset** — it invented three rules. The parser marked it malformed; the gate refused.

[[embed:source:s5]]

Then the comparison itself changed. Each model must now emit, as the last line of its finding, a machine-readable vector — one entry per clause, each carrying the clause's **trigger_state** (did its condition fire on this record), its **disposition** (does that support, defeat, or stay neutral to the action), and the **exact record ids** it rests on. The gate compares the canonical tuple of those fields. Same clause numbers with different tuples is divergence, and divergence escalates.

Nine deterministic unit tests pin this, including the one that matters: same verdict, same clause numbers, different tuples → different signatures; and identical logic with different *wording* and *evidence order* → identical signatures. Wording is the human's; the tuple is the machine's.

## Four outcomes, live

Run through the production path — fresh stateless calls, each ledgered, then sealed by id in bound mode.

| outcome | case | verdict | derivations | seal |
|---|---|---|---|---|
| **APPROVE** | a parking-permit rule, sufficiency-complete | unanimous AFFIRM | **1 identical signature** | [inv_wl0rnh136b](${BASE}/receipt/inv_wl0rnh136b) |
| **NEGATE** | a late service-credit claim | unanimous DENY | 1 identical signature | [inv_cgwtkvx17u](${BASE}/receipt/inv_cgwtkvx17u) |
| **ESCALATE** | an access request with the roster withheld | unanimous CANNOT_CONCLUDE | **2 divergent signatures** | [inv_o6s0exhodd](${BASE}/receipt/inv_o6s0exhodd) |

The APPROVE is the genuine article the last one impersonated: not just the same verdict and the same clauses, but the same per-clause reasoning — \`1:triggered:supports:reg | 2:not_triggered:neutral:cite\` from every seat.

[[embed:source:s1]]

The ESCALATE is the fix's clearest proof. All three models returned **CANNOT_CONCLUDE** and all three cited clauses [1,2,3]. The old gate would have sealed that as a clean NO_ACTION. The new gate escalated it, because two of the three derived that conclusion differently — they split on whether clause 2's condition even fired when the roster was missing. Agreement on the answer is not agreement on the reasoning, and only the second is safe to act on.

[[embed:source:s3]]

## The input is half the instrument

Before the corrected APPROVE, I could not get three models to converge on the access-control case no matter how I tuned the prompt. The reflex is to blame the model tier. That reflex is wrong.

I asked \`glm-5.2\`, under the constitution, to review the case input as a colleague before adjudicating it. It found eight defects — beginning with one that made the whole exercise incoherent:

[[embed:source:s4]]

Its lead finding: my ruleset said access is granted "**only to**" an individual who matches the roster. That is a *necessary* condition — if granted, then a match — and I was asking the models an *affirmative* question, should access be granted. No clause anywhere said a match was *sufficient* to grant. A careful model could correctly return CANNOT_CONCLUDE (nothing licenses a grant) while another returned AFFIRM (reading the match as sufficient). The divergence I kept seeing was not the models failing. It was the models faithfully reflecting a hole in the rules back at the person who wrote them.

The clean APPROVE came only after moving to a rule stated in sufficiency form — "a permit is issued *when* registration is current." Same models, same gate. The variable was the input.

## Prompt version versus conformance

The author's claim was that the variance was the prompt, not the model. The versions bear it out. Holding the models fixed:

| constitution | what it added | conforming findings | derivation agreement |
|---|---|---|---|
| v1.1.0 | invariant register, no vector | n/a — no vector to compare | not measurable |
| v1.3.0 | the clause-evaluation vector (rules only) | 1 of 3 (one used a BASIS line, one invented clauses) | divergent |
| v1.3.0 + output-format override | told the model the constitution outranks its row schema | 2 of 2 capable seats valid | closer |
| v1.3.2 | a worked right/wrong exemplar; a collegial, specific uncertainty path | 3 of 3 valid | **identical** |

The jump from stating the rules to *showing a filled-in right answer and five labelled wrong ones* is what took conforming findings from one-in-three to three-in-three. Models conform to an exemplar, not a specification — which is exactly how the original 2026 system prompt was built, with its LEVEL 1/2/3 worked cases, and exactly what this one had been missing.

## What is not yet proven

This page proves the gate's structural behaviour: it approves genuine derivation agreement, refuses genuine disagreement, and escalates a unanimous verdict whose reasoning diverges. It does **not** prove the models are *correct*. A gate that seals perfectly on agreement still says nothing about whether the agreed answer is the right one — three models can agree, derive identically, and all be wrong together.

That is the next experiment, named and not yet run: a fixed benchmark of determinate cases with outcomes fixed by a deterministic oracle before any model sees them, scored on one primary metric — the rate of wrongful authorisation. Until that runs, the honest claim is exactly this and no more: the instrument now measures agreement at the level of derivation, and it is cheap enough to do it on every consequential decision. Whether the agreement is *right* is a question this page does not answer and does not pretend to.`;

async function main() {
  const { token } = await getWriteToken(slug);
  const r = await fetch(`${BASE}/api/articles/${slug}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-terminal-key": KEY, "x-write-token": token },
    body: JSON.stringify({
      slug,
      title: "The gate now compares derivations, not citations — and the first APPROVE was false convergence",
      body, register: "technical",
      tags: ["governance", "adjudication", "decision-constitution", "experiment"],
      claims, sources, status: "published",
    }),
  });
  console.log(r.status, (await r.text()).slice(0, 160));
}
main();
