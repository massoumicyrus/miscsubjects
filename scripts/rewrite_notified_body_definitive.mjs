#!/usr/bin/env node
/**
 * Rewrite /a/notified-body-ai-act-conformity to definitive depth. Only this article.
 * Everything grounded in live receipts already on the ledger — nothing fabricated.
 * Run: node scripts/rewrite_notified_body_definitive.mjs
 */
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { getWriteToken } from "./write_token.mjs";
const BASE = "https://miscsubjects.com";
const KEY = (() => {
  try { const env = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8"); const m = env.match(/TERMINAL_KEY=(.+)/); return m ? m[1].trim().replace(/^["']|["']$/g, "") : process.env.TERMINAL_KEY; } catch { return process.env.TERMINAL_KEY; }
})();
const SLUG = "notified-body-ai-act-conformity";
const ls = (id, title, url, summary, claims) => ({ id, type: "live_surface", title, publisher: "miscsubjects.com", url, summary, accessed_at: "2026-07-30T00:00", claim_ids: claims });
const sources = [
  ls("s1", "Article 12, adjudicated verbatim by five models", BASE + "/a/adjudication-ai-act-article-12-logging", "The actual text of AI Act Article 12 put through the governed panel: five models, unanimous refusal to certify compliance from the evidence offered, and the complete event log of the adjudication itself — the log that Article 12 asks for, produced while assessing Article 12.", ["c4", "c5"]),
  ls("s2", "The attested conformance map — what is and is not satisfied, clause by clause", BASE + "/a/attested-finding-conformance-map", "AI Act Articles 12 and 14, FRE 902, ISA 705, NIST AI RMF, ISO 42001 and IEC 61508, mapped row by row to the build's artifacts, with every row stating explicitly what is NOT satisfied.", ["c7", "c9"]),
  ls("s3", "The derivation-agreement gate and the escalate-to-a-named-human default", BASE + "/a/auditable-reasoning-hardened", "Independent models under a pinned rule set; the gate refuses to authorise when clause-by-clause derivations diverge, even on a unanimous verdict; the default outcome is escalation to a named human. Includes the false-convergence defect the gate itself exhibited, and its fix.", ["c6", "c8"]),
  ls("s4", "Measured per-model error rates under a fixed rule set", BASE + "/a/adjudication-probe-report-eu-ai-act", "Per-model error rates, Krippendorff alpha, Fleiss kappa, and the prevalence paradox, measured on an EU AI Act task class — the quantitative annex a technical-documentation review needs.", ["c10"]),
  ls("s5", "A unanimous verdict, refused", BASE + "/receipt/inv_o6s0exhodd", "Three models returned the same verdict citing the same clauses; two derived it through different trigger states, so the gate refused to conclude and escalated. Agreement that hides disagreement cannot authorise.", ["c6"]),
  ls("s6", "The genuine APPROVE — unanimous verdict, identical derivation", BASE + "/receipt/inv_wl0rnh136b", "The one clean authorisation on record: every seat fired the same clauses in the same trigger states on the same evidence, and the complete exchange is preserved verbatim.", ["c5"]),
  ls("s7", "A malformed finding, voided", BASE + "/receipt/inv_2dsklah529", "A seat cited clauses that do not exist in the rule set. The deterministic parser voided the finding; structurally invalid output can never authorise. Fail-closed, on the record.", ["c8"]),
];
const claims = [
  { id: "c1", text: "Annex III high-risk AI systems must pass conformity assessment before being placed on the EU market, and for several Annex III categories that assessment involves a notified body under Article 43.", section: "The machinery", tier: "system", source_ids: [], why_material: "This is the legal trigger that puts notified bodies in the position of needing a test method." },
  { id: "c2", text: "No harmonised standard adopted under Article 40 yet gives a notified body a presumption-of-conformity test for Article 12 record-keeping or Article 14 human oversight, so assessment currently falls back to first-principles technical judgement.", section: "The standards gap", tier: "system", source_ids: [], why_material: "The absence of a harmonised standard is the exact gap a candidate technical method addresses." },
  { id: "c3", text: "The high-risk obligations, including Articles 12 and 14, apply from 2 August 2026 for new Annex III systems, so notified bodies are assessing against these articles now, without an established method.", section: "The machinery", tier: "system", source_ids: [], why_material: "The timeline is what makes the method gap operational rather than academic." },
  { id: "c4", text: "The text of Article 12 has been adjudicated verbatim by a five-model governed panel, and the panel unanimously refused to certify compliance from the evidence offered — with the complete event log of that adjudication preserved.", section: "Article 12", tier: "system", source_ids: ["s1"], why_material: "A refusal on the record is stronger evidence of assessment discipline than any approval." },
  { id: "c5", text: "In this method the log is the decision: the pinned rule set, the verbatim model exchanges, the derivations and the verdict are appended to a ledger before the result returns, which is the automatic lifetime record-keeping Article 12 describes, produced by construction rather than added afterwards.", section: "Article 12", tier: "system", source_ids: ["s1", "s6"], why_material: "Logging by construction is testable; logging by policy is only auditable after the fact." },
  { id: "c6", text: "The human is load-bearing by construction: the gate's default outcome is escalation to a named human, and it has refused a unanimous three-model verdict because the derivations diverged — oversight that can actually override, which is what Article 14(4) requires.", section: "Article 14", tier: "system", source_ids: ["s3", "s5"], why_material: "Article 14 asks for effective oversight, not nominal oversight; a recorded refusal is the evidence." },
  { id: "c7", text: "A clause-by-clause conformance map exists covering AI Act Articles 12 and 14 alongside FRE 902, ISA 705, NIST AI RMF, ISO 42001 and IEC 61508, and every row states what is NOT satisfied.", section: "The assessment file", tier: "system", source_ids: ["s2"], why_material: "A scoped negative statement is the part of a technical file assessors trust least when it is missing." },
  { id: "c8", text: "Malformed findings are voided by a deterministic parser and can never authorise, so the system fails closed on invalid output — a property a notified body can test by injecting malformed cases.", section: "The test procedure", tier: "system", source_ids: ["s3", "s7"], why_material: "Fail-closed behaviour is directly testable, which is what makes the method assessable at all." },
  { id: "c9", text: "This is a candidate technical method, not a certification: no harmonised standard covers it, no qualified electronic timestamp seals the ledger, and no calibration study establishes correctness at a known rate.", section: "What is not satisfied", tier: "system", source_ids: ["s2"], why_material: "A method that oversells itself to a conformity assessor is defective by its own standard." },
  { id: "c10", text: "Per-model error rates on an EU AI Act task class are measured and published, with agreement statistics, giving an assessor a quantitative starting table rather than an accuracy assertion.", section: "The test procedure", tier: "system", source_ids: ["s4"], why_material: "Quantified residual error is what turns a demonstration into assessable technical documentation." },
];
const body = `## The position a notified body is in

The EU AI Act sends every high-risk AI system — the systems listed in Annex III: biometric identification, critical infrastructure, education and vocational scoring, employment and worker management, access to essential services and credit, law enforcement, migration and border control, administration of justice — through **conformity assessment** before it can be placed on the EU market. For most Annex III systems the provider may self-assess under internal control (Annex VI). But for remote biometric identification, and for any Annex III system where the provider has not applied harmonised standards in full, Article 43 routes the assessment through a **notified body** — a designated third party (TÜV SÜD, TÜV Rheinland, BSI, DEKRA, DNV and their peers) that examines the technical documentation and the quality-management system and issues, or refuses, the certificate.

Two of the requirements that assessment must cover have no established technical test method:

- **Article 12 — record-keeping.** The system must *technically allow for the automatic recording of events (logs) over its lifetime*, to a standard that supports identifying situations of risk, post-market monitoring, and reconstruction of what the system did.
- **Article 14 — human oversight.** The system must be designed so that natural persons can *effectively oversee* it: understand its capacities and limitations, remain aware of automation bias, correctly interpret its output, and **decide not to use it, or to disregard, override or reverse its output**.

For a machine tool or a pressure vessel, a notified body opens a harmonised standard and runs the listed tests. For Articles 12 and 14 there is no such standard to open.

## Why there is no standard to open

Article 40 gives conformity assessment its normal backbone: harmonised standards, drafted by CEN/CENELEC under a Commission standardisation request and cited in the Official Journal, carry a **presumption of conformity** — a system that meets the standard is presumed to meet the corresponding legal requirement. The Commission issued that standardisation request to CEN/CENELEC JTC 21 in May 2023, covering exactly these areas: record-keeping and logging, human oversight, transparency, accuracy, robustness. As of mid-2026, the deliverables covering Articles 12 and 14 have not been adopted and cited in the Official Journal. The drafting is behind the application date.

The application date does not wait. The Act entered into force on 1 August 2024; prohibitions applied from February 2025; general-purpose model obligations from August 2025; and the high-risk obligations — Articles 8 through 15, including 12 and 14 — apply from **2 August 2026** for new Annex III systems. So a notified body assessing an Annex III system this year must form a technical opinion on logging and oversight from first principles: no presumption of conformity, no listed test procedure, no reference implementation.

That is the gap this page addresses. What follows is a candidate method — one running system whose logging and oversight properties are produced by construction and are therefore *testable* rather than merely *documented*. Every claim opens to a live record.

## Article 12, mapped to the artifact

Read Article 12 as an assessor would, requirement by requirement:

**"Automatic recording of events (logs) over the lifetime of the system."** In this method, every governed decision *is* the record. The rule set under which the decision is made is pinned to a content hash. The complete exchange with every model — request and response, verbatim, no summaries — is captured. The clause-by-clause derivation each model produced, the verdict, and the gate's disposition are appended to a ledger *before the result returns to the caller*. There is no code path that produces a decision without producing its log, because the log and the decision are the same object. Logging is not a feature bolted onto the system; it is the construction.

**"Enabling the identification of situations that may result in risk."** The recorded object includes each model's derivation vector — which clauses triggered, on which evidence, what was absent, what would flip the conclusion — so a risk situation is identifiable at the level of reasoning, not just at the level of inputs and outputs.

**"Facilitating post-market monitoring and the reconstruction of the system's operation."** The record is replayable. Anyone with the receipt URL can open the complete exchange a year later and reconstruct exactly what every model was shown and exactly what it returned.

The strongest exhibit is reflexive: the text of Article 12 itself was put through the governed panel — five models, the article verbatim, the build's own logging evidence as the record under review — and the panel **unanimously refused** to certify compliance from the evidence offered, with the complete event log of that adjudication preserved:

[[embed:source:s1]]

Sit with the shape of that. The method's own answer to "does this satisfy Article 12?" was a refusal, logged to the standard Article 12 describes. A notified body will trust a method that refuses on the record long before it trusts one that approves in prose. And when the panel *does* authorise, the artifact looks like this — every seat firing the same clauses in the same trigger states on the same evidence, the whole exchange preserved:

[[embed:source:s6]]

## Article 14, mapped to the artifact

Article 14's operative word is *effectively*. Paragraph 4 spells out what the human must be enabled to do: understand the system's capacities and limitations; remain aware of automation bias; correctly interpret the output; **decide not to use the system in a particular situation**; and **intervene or interrupt the system** — disregard, override, reverse. Most systems answer this with an organisational measure: a policy document saying a human reviews the output. A notified body cannot test a policy document; it can only file it.

Here the human is **load-bearing by construction**. The derivation-agreement gate compares the independent models' clause-by-clause derivations, and its default outcome is **escalation to a named human**. The system never authorises an action on model agreement alone when the derivations diverge — and the escalation is itself a logged event, so the oversight trail is part of the Article 12 record:

[[embed:source:s3]]

The exhibit that separates effective oversight from nominal oversight: three models returned the **same verdict**, citing the **same clauses**, and the gate still refused to conclude, because two of them had derived that verdict through different trigger states. The case went to the human. The refusal is on the record:

[[embed:source:s5]]

That receipt is Article 14(4) expressed as a mechanism. The human was not offered a rubber stamp over an already-agreed answer — the machinery itself detected that the agreement was hollow and routed the decision to a person, and it is architecturally incapable of doing otherwise. Automation bias is addressed not by warning the human about it but by refusing to hand the human a false consensus in the first place.

## What the notified body's assessment file gets

A conformity assessment under Annex VII examines the technical documentation. Assembled from this method, the Article 12 and 14 sections of that file contain:

- **The governing constitution at its content hash** — the design documentation for the decision procedure, version-pinned and beyond dispute.
- **The conformance map** — Articles 12 and 14 clause by clause, each row mapped to the artifact that addresses it, alongside the same treatment of FRE 902, ISA 705, NIST AI RMF, ISO 42001 and IEC 61508, and — the part an assessor should read first — every row stating what is **not** satisfied:

[[embed:source:s2]]

- **The escalation receipts** — every case where the gate refused, with the divergent derivations preserved verbatim. These are the Article 14 evidence.
- **The fail-closed record** — malformed findings voided by the deterministic parser. A seat that cited clauses which do not exist in the rule set had its finding structurally voided; invalid output can never authorise:

[[embed:source:s7]]

- **The rate table** — measured per-model error rates on an EU AI Act task class, with Krippendorff's alpha and Fleiss' kappa and the prevalence paradox stated rather than hidden, giving the accuracy-and-robustness section (Article 15 borders here) a quantitative starting point:

[[embed:source:s4]]

## What the test procedure would literally be

A notified body assessing this method does not have to take any of the above on description. Each property is exercisable:

1. **Logging by construction (Art. 12).** Submit a bounded case. Verify the receipt exists before the result is consumed; open it; confirm the rule-set hash, the verbatim exchanges, and the derivations are present and complete. Re-open the same receipt later and confirm it replays identically.
2. **Reconstruction.** Take a sealed decision from the ledger, hand the receipt to a second assessor with no other context, and require them to reconstruct what every model was shown and what it returned. The test passes if the reconstruction needs nothing outside the receipt.
3. **Effective oversight (Art. 14).** Construct a case designed to produce surface agreement with divergent reasoning — the false-consensus case. Confirm the gate refuses and escalates to the named human rather than authorising. The refused-unanimous-verdict receipt above is this test, already run once in the open.
4. **Override.** Have the named human reverse a panel outcome and confirm the reversal is itself logged as a first-class event on the same ledger.
5. **Fail-closed.** Inject structurally malformed findings — invented clauses, missing fields, absent decision lines — and confirm every one is voided and none can authorise. The voided-finding receipt above is this test on the record.
6. **Change detection.** Re-run the hashed case suite after a model or prompt change and diff the rate table — the vendor-checkpoint-swap event that lifecycle assessment has to catch.

That is a test procedure a notified body could execute this quarter, with pass/fail criteria that do not depend on trusting the provider's narrative. It is, structurally, what a harmonised standard for Articles 12 and 14 would have to contain — which is the point.

## What is not satisfied

Stated as plainly as the rest, because a method that oversells itself to a conformity assessor is defective by its own standard:

- **This is a method, not a certification.** Nothing here confers a presumption of conformity, a CE marking, or any legal effect. Only a notified body can issue a certificate, and none has assessed this.
- **No harmonised standard covers it.** Until CEN/CENELEC deliverables for Articles 12 and 14 are cited in the Official Journal, any assessment of this method is first-principles judgement. The honest ambition — stated, not self-declared as achieved — is to be a reference implementation worth citing when that standard is written.
- **No qualified timestamp.** The ledger is append-ordered and content-hashed, but it is not sealed by a qualified electronic timestamp under eIDAS. A hostile reading of the evidence chain should assume the operator could have rewritten history until that seal exists.
- **No calibration study.** The published rates quantify disagreement and per-seat error on one bounded task class with small n. No study yet establishes that the panel is *correct* at a known rate against oracle-labelled ground truth. That study is the named next artifact, not a footnote.

A notified body reading this should treat those four gaps as the assessment agenda. Everything else on this page is already openable.

## Submit a case

Send one bounded conformity question — an Article 12 or Article 14 obligation and a system record to test it against — to **build@miscsubjects.com**. You get back the full event log, every model's derivation, the gate's decision, and a replayable receipt. No account, no call, no deck.
`;
const cur = await (await fetch(`${BASE}/api/articles/${SLUG}`)).json();
const { token } = await getWriteToken(SLUG);
const r = await fetch(`${BASE}/api/articles/${SLUG}`, {
  method: "POST", headers: { "content-type": "application/json", "x-terminal-key": KEY, "x-write-token": token },
  body: JSON.stringify({ ...cur, slug: SLUG, body, claims, sources, status: "published" }),
});
console.log(SLUG, r.status, "body", body.length, "chars,", claims.length, "claims,", sources.length, "sources");
