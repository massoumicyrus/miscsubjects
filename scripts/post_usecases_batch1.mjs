#!/usr/bin/env node
/**
 * Four use-case articles, each mapped to a real regulatory instrument and grounded in
 * live receipts already on the ledger (no new panels fabricated). CRO/SR 11-7, insurer
 * rate-table, notified-body AI Act, court Daubert/FRE 902.
 * Run: node scripts/post_usecases_batch1.mjs
 */
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { getWriteToken } from "./write_token.mjs";

const BASE = "https://miscsubjects.com";
const KEY = (() => {
  try { const env = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8"); const m = env.match(/TERMINAL_KEY=(.+)/); return m ? m[1].trim().replace(/^["']|["']$/g, "") : process.env.TERMINAL_KEY; } catch { return process.env.TERMINAL_KEY; }
})();

// Real, live receipts reused across these articles (nothing fabricated).
const R = {
  approve: BASE + "/receipt/inv_wl0rnh136b",
  negate: BASE + "/receipt/inv_cgwtkvx17u",
  escalate: BASE + "/receipt/inv_o6s0exhodd",
  malformed: BASE + "/receipt/inv_2dsklah529",
  critique: BASE + "/receipt/inv_qh3ge2x74b",
};
const A = {
  hardened: BASE + "/a/auditable-reasoning-hardened",
  audited: BASE + "/a/auditable-reasoning-audited",
  primitive: BASE + "/a/auditable-reasoning",
  probe: BASE + "/a/adjudication-probe-report-eu-ai-act",
  art12: BASE + "/a/adjudication-ai-act-article-12-logging",
  conformance: BASE + "/a/attested-finding-conformance-map",
  verifier: BASE + "/a/offline-verifier",
  contract: BASE + "/a/adjudication-contract-service-credit",
  medical: BASE + "/a/adjudication-medical-prior-auth",
};

const liveSurface = (id, title, url, summary, claim) => ({ id, type: "live_surface", title, publisher: "miscsubjects.com", url, summary, accessed_at: "2026-07-30T00:00", claim_ids: [claim] });

const articles = [
  {
    slug: "cro-model-validation-instrument",
    title: "SR 11-7 requires independent model validation with documented effective challenge. For an LLM, there is no instrument. Here is one.",
    tags: ["governance", "model-risk", "adjudication", "use-case"],
    sources: [
      liveSurface("s1", "The derivation-agreement gate — effective challenge, mechanised", A.hardened, "Independent models under a pinned rule set; the gate refuses to authorise when their derivations diverge, even on a unanimous verdict. That refusal is documented effective challenge, produced without a committee.", "c2"),
      liveSurface("s2", "A unanimous verdict, refused on divergent derivation", R.escalate, "Three models returned CANNOT_CONCLUDE and cited the same clauses; two derived it differently, so the gate escalated instead of concluding. The disagreement is the challenge, and it is on the record.", "c3"),
      liveSurface("s3", "Measured per-model error rates under a fixed rule set", A.probe, "Krippendorff alpha, Fleiss kappa, per-model rates, the prevalence paradox — the quantitative validation evidence SR 11-7 asks for and vendors do not supply.", "c4"),
    ],
    claims: [
      { id: "c1", text: "SR 11-7 and OCC 2011-12 legally require independent validation of a model with documented effective challenge, and there is no established instrument that does this for a large language model.", section: "The obligation", tier: "system", source_ids: [], why_material: "It is a live legal requirement with personal exposure for the validator, currently met with prose." },
      { id: "c2", text: "The derivation-agreement gate mechanises effective challenge: independent models under a pinned rule set are compared at the level of their clause-by-clause reasoning, and disagreement is a recorded refusal.", section: "The instrument", tier: "system", source_ids: ["s1"], why_material: "It converts 'we reviewed it' into an artifact a regulator can open." },
      { id: "c3", text: "A unanimous verdict is refused when the derivations diverge, so agreement that hides disagreement cannot pass validation.", section: "The instrument", tier: "system", source_ids: ["s2"], why_material: "The exact failure mode a validator is on the hook for — false consensus — is caught mechanically." },
      { id: "c4", text: "Per-model error rates are measured under a fixed rule set, with agreement statistics, so the residual is quantified rather than asserted.", section: "The evidence", tier: "system", source_ids: ["s3"], why_material: "Quantified residual error is the core of a validation file." },
      { id: "c5", text: "No calibration study establishes the models' correctness at a known rate; this instrument documents challenge and residual disagreement, not accuracy.", section: "What is not satisfied", tier: "system", source_ids: [], why_material: "A validator must not be sold more than the evidence supports." },
    ],
    body: `## The obligation nobody has an instrument for

SR 11-7 (the Federal Reserve and OCC guidance on model risk management) and OCC 2011-12 require that a model be independently validated, and that the validation include **documented effective challenge** — a real, recorded attempt to find where the model is wrong, performed by someone independent of the people who built it. For traditional statistical models there is a mature toolkit. For a large language model making a judgement, there is not. Validation teams are personally exposed to a requirement they have no established method to meet, and they are meeting it today with narrative memos.

This page is the instrument, and it is already running.

## Effective challenge, mechanised

Effective challenge is not a review meeting. It is an adversarial process whose output is evidence. Here it is a panel: several independent models, from different training families, each placed under the *same rule set pinned to a content hash*, each required to expose its reasoning clause by clause. A deterministic gate then compares not their conclusions but their **derivations** — for each clause, did its condition fire, does that support or defeat the action, and on which records.

[[embed:source:s1]]

The challenge is structural: if two models reach the same answer for different stated reasons, the gate treats that as unresolved and refuses to authorise. A validator does not have to trust that the challenge happened. The challenge *is* the artifact, and it is openable.

## The failure a validator is personally on the hook for

The failure that ends careers is false consensus — a model, or a panel of them, agreeing on an answer that is wrong, with nothing in the file showing the disagreement that should have surfaced. This instrument catches exactly that:

[[embed:source:s2]]

Three models returned the same verdict and cited the same clauses. Two of them derived it differently. The gate escalated to a human instead of recording a clean conclusion. In a validation file, that escalation is the documented effective challenge — the moment the process refused to let agreement paper over disagreement.

## The residual, quantified

Validation is not complete without a statement of residual error. The measured error rates for these models under a fixed rule set are published — per model, with Krippendorff's alpha, Fleiss' kappa, and the prevalence paradox stated plainly:

[[embed:source:s3]]

That is the quantitative core of a validation file: not "the model is accurate", but "here is the rate at which it is wrong, measured, and here is the process that catches the wrong answers before they authorise anything."

## What this does not do

It does not establish that the models are *correct* at a known rate — no calibration study against ground truth has been run, and that is stated wherever the claim could be over-read. It documents effective challenge and quantifies residual disagreement. Those are the two things SR 11-7 names and the two things an LLM validation file currently lacks. Correctness at a certified rate is the next instrument, not this one, and a validator should be sold exactly this far and no further.

The whole apparatus — the constitution, the gate, the receipts — is at [auditable reasoning](${A.primitive}). A model-validation team can call it against its own rule set today; every call is a receipt, and the receipts are the validation file.`,
  },
  {
    slug: "insurer-ai-performance-rate-table",
    title: "You cannot write an AI performance guarantee without a loss-frequency estimate. The probe table is the rate table.",
    tags: ["governance", "insurance", "adjudication", "use-case"],
    sources: [
      liveSurface("s1", "Measured error rate per model, per rule set", A.probe, "The loss-frequency estimate machine judgement has never had: how often each model is wrong under a fixed rule set, with the agreement statistics.", "c2"),
      liveSurface("s2", "The cost of one governed decision, measured", A.audited, "72 fresh calls priced from their own usage: a three-model, two-family sealed decision costs about half a cent. The loading, not a promise.", "c3"),
      liveSurface("s1b", "The gate that fails closed on disagreement", A.hardened, "The mechanism that turns undetected error into detected deferral — which is what collapses the fraud loading a carrier prices against.", "c4"),
    ],
    claims: [
      { id: "c1", text: "Insurers and reinsurers cannot write AI performance guarantees because there is no loss-frequency estimate for machine judgement.", section: "Why the market is stuck", tier: "system", source_ids: [], why_material: "It is the specific missing input that blocks the product, not a general reluctance." },
      { id: "c2", text: "A measured error rate per model under a fixed rule set is a loss-frequency estimate for machine judgement.", section: "The rate table", tier: "system", source_ids: ["s1"], why_material: "It supplies the exact input the actuarial model needs." },
      { id: "c3", text: "A governed, receipted, three-model decision costs about half a cent, so the instrument's own cost is negligible against the exposure it prices.", section: "The economics", tier: "system", source_ids: ["s2"], why_material: "The cost objection dissolves at this price." },
      { id: "c4", text: "When the record is anchored and the error rate is measured, undetected error becomes detected deferral, which is what collapses the fraud loading.", section: "Why the loading collapses", tier: "system", source_ids: ["s1b"], why_material: "The carrier's real lever is fraud/opacity loading, and this addresses it directly." },
      { id: "c5", text: "The measured rate covers one task class with small n; it is a starting rate table, not a certified actuarial basis.", section: "What is not satisfied", tier: "system", source_ids: [], why_material: "An underwriter must know the sample is thin before pricing on it." },
    ],
    body: `## Why the AI-performance market is stuck

Munich Re, Armilla, Relm, and the Lloyd's syndicates that have looked at AI performance cover all hit the same wall. You cannot price a guarantee on a thing whose failure rate you cannot estimate. Traditional insurance rests on loss frequency — how often, historically, the insured event occurs. Machine judgement has no such history in a form an actuary can use. So the product either does not get written, or it gets written with a fraud/opacity loading so large it prices itself out.

The underwriter does not need the model to be auditable in the abstract. The underwriter needs a number.

## The rate table

The number exists. Under a rule set pinned to a content hash, each model's error rate is measured and published — with the agreement statistics that tell you whether the errors are independent or correlated:

[[embed:source:s1]]

That is a loss-frequency estimate for machine judgement. It is the input the actuarial model has been missing. It is not a marketing figure — it is computed from a fixed suite, and its limits (one task class, small n) are stated on the page, because an underwriter who prices on a hidden sample is the one who gets hurt.

## Why the loading collapses

The fraud and opacity loading exists because, today, a wrong machine decision is *undetected* — it looks exactly like a right one until a loss surfaces. The instrument changes the shape of the risk:

[[embed:source:s1b]]

When the record is anchored and the panel fails closed on disagreement, undetected error becomes detected deferral: the wrong answer escalates to a human instead of executing. The carrier is no longer pricing an opaque black box; it is pricing a process with a measured escape rate and a documented halt. That is the difference between an uninsurable risk and a priced one.

## The economics

The instrument's own cost is not a factor. A governed, three-model, receipted decision costs about half a cent:

[[embed:source:s2]]

Against the exposure on a single guaranteed AI decision, the cost of measuring and receipting it rounds to zero. The economics do not argue against adoption; they argue that the measurement should sit on every covered decision.

## What is not satisfied

The published rate is measured for one task class, with a deliberately small sample, and no cross-domain calibration study has been run. It is a *starting* rate table — enough to write a pilot and refine, not enough to treat as a certified actuarial basis. A broker mandating this artifact in a specification does more to move the market than a carrier buying it, because the specification is where the loss-frequency requirement becomes contractual.

The mechanism is at [auditable reasoning, hardened](${A.hardened}); the rate methodology and cost at [auditable reasoning, audited](${A.audited}).`,
  },
  {
    slug: "notified-body-ai-act-conformity",
    title: "Annex III conformity assessment needs a technical method for AI Act Article 12 logging and Article 14 oversight. There isn't one. This is one.",
    tags: ["governance", "eu-ai-act", "adjudication", "use-case"],
    sources: [
      liveSurface("s1", "Article 12, adjudicated verbatim, with the logging it produced", A.art12, "Five models, Article 12 quoted verbatim as the rule set, and a unanimous refusal — with the complete event log every step wrote, which is the record Article 12 requires.", "c2"),
      liveSurface("s2", "Every primitive mapped to the frame it belongs to, with what each fails", A.conformance, "AI Act 12 and 14, FRE 902, ISA 705, NIST, ISO 42001, IEC 61508 — clause by clause, each row stating what is NOT satisfied. The scope statement a notified body needs.", "c3"),
      liveSurface("s3", "Oversight that can refuse — Article 14 as a fail-closed gate", A.hardened, "The human-in-the-loop is load-bearing by construction: the gate escalates to a named reviewer on disagreement and never authorises on the model's say-so. That is Article 14 oversight, mechanised.", "c4"),
    ],
    claims: [
      { id: "c1", text: "Annex III conformity assessment under the AI Act requires a technical method for demonstrating Article 12 record-keeping and Article 14 human oversight, and no established method exists.", section: "The gap", tier: "system", source_ids: [], why_material: "Notified bodies are actively looking for exactly this and cannot certify without it." },
      { id: "c2", text: "Every governed decision writes a complete, replayable event log — the rule set at a hash, the full model exchange, the verdict — which is the record Article 12 mandates.", section: "Article 12", tier: "system", source_ids: ["s1"], why_material: "Article 12 is a record-keeping obligation and this produces the record by construction." },
      { id: "c3", text: "A clause-by-clause conformance map states, for Article 12, Article 14 and adjacent frames, exactly what is and is not satisfied.", section: "The scope statement", tier: "system", source_ids: ["s2"], why_material: "A conformity assessment is a scoped opinion, and the map supplies the scope honestly." },
      { id: "c4", text: "Human oversight is load-bearing by construction: the gate escalates to a named reviewer on disagreement and never authorises on the model's say-so, which is Article 14 mechanised.", section: "Article 14", tier: "system", source_ids: ["s3"], why_material: "Article 14 requires effective human oversight, and this makes the human's refusal the default, not an option." },
      { id: "c5", text: "This is a technical method, not a certification; a notified body must still assess it against the harmonised standard once one exists.", section: "What is not satisfied", tier: "system", source_ids: [], why_material: "The method does not certify itself." },
    ],
    body: `## The gap the notified bodies are looking at

Annex III of the EU AI Act sends high-risk systems through conformity assessment. Two of the obligations a notified body (TÜV SÜD, TÜV Rheinland, BSI, DEKRA, DNV) must assess against have no established technical method: **Article 12** (automatic record-keeping / logging over the system's lifetime) and **Article 14** (effective human oversight). A notified body cannot issue a certificate against a requirement it has no method to test. They are, right now, looking for one.

This build is a candidate method, and every claim below opens to a live record.

## Article 12 — the record produced by construction

Article 12 requires that a high-risk system automatically record events over its lifetime, to a standard that lets you reconstruct what happened. Here, every governed decision *is* that record: the rule set pinned to a content hash, the complete model exchange (request and response, verbatim), the derivation, and the verdict, all appended to a ledger before the result returns.

[[embed:source:s1]]

Article 12 asks for logging. This does not add logging to a decision; the log is the decision, and it is replayable a year later by anyone.

## Article 14 — oversight that can actually refuse

Article 14 requires *effective* human oversight — not a human who can theoretically intervene, but oversight that bites. Here the human is load-bearing by construction: the gate escalates to a named reviewer whenever the panel disagrees at the level of derivation, and it never authorises an action on the models' agreement alone.

[[embed:source:s3]]

The default is refusal-to-a-human, not automatic action. That is the posture Article 14 is trying to compel, expressed as a gate rather than a policy document.

## The scope statement a conformity assessment needs

A conformity assessment is a scoped opinion, and its integrity depends on stating what is *not* covered. The conformance map does exactly that — AI Act 12 and 14, alongside FRE 902, ISA 705, NIST AI RMF, ISO 42001 and IEC 61508 — clause by clause, each row naming what is unsatisfied:

[[embed:source:s2]]

## What is not satisfied

This is a technical *method*, not a certification, and it does not certify itself. There is not yet a harmonised standard for a notified body to assess it against, and this build's honest position is that it wants to be the reference implementation cited when that standard is written — which is the single highest-leverage outcome available to it, and one it cannot self-declare. A notified body evaluating it should treat the conformance map's "not satisfied" column as the agenda, not the appendix.`,
  },
  {
    slug: "court-daubert-rate-of-error-902",
    title: "The rate of error is a Daubert factor. Hash-verified records are self-authenticating under FRE 902. This object satisfies both by construction.",
    tags: ["governance", "litigation", "evidence", "use-case"],
    sources: [
      liveSurface("s1", "The measured rate of error — a Daubert factor", A.probe, "Daubert enumerates the known or potential rate of error as a factor for admitting expert methodology. Here it is measured, per model, under a fixed rule set.", "c2"),
      liveSurface("s2", "Records self-authenticating under FRE 902(13)/(14)", A.conformance, "902(13) and 902(14) make hash-verified electronic records self-authenticating. The map traces the object to those subsections, and states where a qualified timestamp is still missing.", "c3"),
      liveSurface("s3", "Absence declared, not assumed — a spoliation instrument", A.contract, "Every finding must list the records a competent reviewer would have expected and did not receive. Under FRCP 37(e), sanctions turn on exactly what was not preserved or reviewed.", "c4"),
    ],
    claims: [
      { id: "c1", text: "Daubert enumerates the known or potential rate of error as a factor for admitting expert methodology, and a measured per-model rate is that factor supplied.", section: "Daubert", tier: "system", source_ids: ["s1"], why_material: "It maps a published metric directly onto an admissibility factor." },
      { id: "c2", text: "FRE 902(13) and 902(14) make hash-verified electronic records self-authenticating, and the governed object is hash-chained and receipted by construction.", section: "Self-authentication", tier: "system", source_ids: ["s2"], why_material: "It removes the authentication witness for a class of machine records." },
      { id: "c3", text: "A mandatory absence declaration — the records a reviewer would have expected but did not get — is a spoliation instrument under FRCP 37(e), for the plaintiff bar and the defence alike.", section: "Absence as instrument", tier: "system", source_ids: ["s3"], why_material: "37(e) sanctions turn on exactly what was not preserved or reviewed, which this field records at decision time." },
      { id: "c4", text: "No qualified timestamp and no case law yet exist for this object, so 902 self-authentication is satisfied by construction but untested in a courtroom.", section: "What is not satisfied", tier: "system", source_ids: [], why_material: "A litigator must know the untested edge before relying on it." },
    ],
    body: `## Two doctrines this object was built to satisfy

Two independent rules of evidence bear directly on machine-generated judgement, and this object satisfies both by construction rather than by argument.

**Daubert.** When a court decides whether to admit expert methodology, one enumerated factor is the *known or potential rate of error*. For most AI systems that number does not exist, so the methodology is vulnerable at the threshold.

[[embed:source:s1]]

Here the rate of error is measured, per model, under a rule set pinned to a hash. It is a Daubert factor, supplied — with its limits (one task class, small n) stated, which is itself what a careful methodology does.

## Self-authentication under FRE 902

**FRE 902(13) and 902(14)** make certain electronic records — including data copied from an electronic device or file and shown by a hash to be unaltered — *self-authenticating*: admissible without a live witness to establish authenticity. The governed object is hash-chained and receipted by construction; the conformance map traces it to those subsections and names the one thing still missing — a qualified timestamp — instead of hiding it:

[[embed:source:s2]]

For a litigator, that is the difference between calling a records-custodian witness and attaching a certificate.

## Absence as a spoliation instrument

The sharpest litigation use is not the presence of a record but the mandated declaration of its **absence**. Every governed finding must list the records a competent reviewer would have expected and did not receive.

[[embed:source:s3]]

Under **FRCP 37(e)**, sanctions for failure to preserve electronically stored information turn on exactly what was not preserved or reviewed. For the plaintiff bar, an absence declaration is a spoliation instrument — a contemporaneous record of what the decision-maker never looked at. For the defence, the same field is protection: it converts "we reviewed everything relevant" from later testimony into an artifact that predates the claim. The same clause serves both sides because it records reality, not a position.

## What is not satisfied

902 self-authentication here is satisfied *by construction* and *untested in a courtroom*: there is no qualified (eIDAS Article 41-grade) timestamp on the checkpoints yet, and no case law has ruled on an object of this shape. A litigator should treat it as a strong, well-founded position that has not yet been adjudicated — and, given that the buyers who close are post-enforcement (in discovery, under a consent decree, holding personal liability), the first courtroom test is a question of when, not whether.

The evidence frame is mapped clause by clause at [the conformance map](${A.conformance}); the worked adjudication behind the absence field is [the contract case](${A.contract}).`,
  },
];

async function publish(p) {
  const { token } = await getWriteToken(p.slug);
  const r = await fetch(`${BASE}/api/articles/${p.slug}`, {
    method: "POST", headers: { "content-type": "application/json", "x-terminal-key": KEY, "x-write-token": token },
    body: JSON.stringify({ slug: p.slug, title: p.title, body: p.body, register: "technical", tags: p.tags, claims: p.claims, sources: p.sources, status: "published" }),
  });
  console.log(p.slug, r.status, (await r.text()).slice(0, 90));
}
for (const p of articles) await publish(p);
