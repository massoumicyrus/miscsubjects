#!/usr/bin/env node
/**
 * Rewrite /a/court-daubert-rate-of-error-902 to definitive depth. Only this article.
 * Everything grounded in live receipts already on the ledger — nothing fabricated.
 * Run: node scripts/rewrite_court_definitive.mjs
 */
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { getWriteToken } from "./write_token.mjs";
const BASE = "https://miscsubjects.com";
const KEY = (() => {
  try { const env = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8"); const m = env.match(/TERMINAL_KEY=(.+)/); return m ? m[1].trim().replace(/^["']|["']$/g, "") : process.env.TERMINAL_KEY; } catch { return process.env.TERMINAL_KEY; }
})();
const SLUG = "court-daubert-rate-of-error-902";
const ls = (id, title, url, summary, claims) => ({ id, type: "live_surface", title, publisher: "miscsubjects.com", url, summary, accessed_at: "2026-07-30T00:00", claim_ids: claims });
const sources = [
  ls("s1", "The measured rate of error — per model, under a pinned rule set", BASE + "/a/adjudication-probe-report-eu-ai-act", "Seventy findings, five models, fourteen probes against pre-declared ground truth. Per-model accuracy, miss, false-confidence and over-abstention rates, with the suite and rule set both pinned by SHA-256 before the run.", ["c3"]),
  ls("s2", "Records mapped to FRE 902(13)/(14), with the gaps named", BASE + "/a/attested-finding-conformance-map", "Every field traced to its recognised frame: 902(13), 902(14), FRCP 37(e), eIDAS Article 41. The qualified timestamp and the custodian certification are named as missing rather than hidden.", ["c5", "c6"]),
  ls("s3", "A worked adjudication with the absence declaration on the record", BASE + "/a/adjudication-contract-service-credit", "A hashed synthetic contract dispute; three model families each list the records they were not given — the signed agreement, the claim email's provable transmission date — before concluding.", ["c7"]),
  ls("s4", "The methodology tested against itself: a failure found and fixed", BASE + "/a/auditable-reasoning-hardened", "The derivation-agreement gate passed a false convergence — agreement on clause numbers hiding disagreement in reasoning — was caught, retracted, fixed, and the failure case became a unit test. Testability, exercised.", ["c2"]),
  ls("s5", "The 72-call controlled study behind the method", BASE + "/a/auditable-reasoning-audited", "Three prompt arms, three models, eight runs each. Auditable structure appeared in zero of 48 ungoverned calls and only under the governing constitution; clause-citation agreement rose 0.74 to 0.95.", ["c2", "c9"]),
  ls("s6", "A unanimous verdict, refused on divergent derivation", BASE + "/receipt/inv_o6s0exhodd", "Three models returned the same verdict citing the same clauses; two derived it through different trigger states, so the gate escalated instead of concluding. The refusal is itself a receipt.", ["c4"]),
  ls("s7", "The genuine authorisation — identical derivations, sealed", BASE + "/receipt/inv_wl0rnh136b", "The clean seal on record: every seat fired the same clauses in the same trigger states on the same evidence, and the complete request and response payloads travel with the receipt.", ["c9"]),
  ls("s8", "The instrument critiquing its own input: eight defects", BASE + "/receipt/inv_qh3ge2x74b", "A governed model asked to review the case file found eight defects, the lead one a necessity-stated-as-sufficiency error in the rule set — the kind of specification flaw an opposing expert would find in deposition.", ["c8"]),
];
const claims = [
  { id: "c1", text: "Daubert enumerates testability, peer review, known or potential rate of error, controlling standards, and general acceptance as factors for admitting expert methodology, and machine-generated judgement offered in litigation faces the same threshold.", section: "The threshold", tier: "system", source_ids: [], why_material: "Every AI-derived conclusion offered through an expert must survive these factors, and most AI systems can answer none of them." },
  { id: "c2", text: "The methodology can be and has been tested: a documented failure (false convergence in the agreement gate) was caught, publicly retracted, fixed, and converted into a regression test, with both the defective and corrected runs on the record.", section: "Testability", tier: "system", source_ids: ["s4", "s5"], why_material: "Falsifiability with an exhibited falsification is the strongest form of the first Daubert factor." },
  { id: "c3", text: "The rate of error is measured, per model: across 70 findings on a pre-declared probe suite, false confidence — a verdict where abstention was correct — ran from 21.4% to 42.9% depending on the seat, published with the suite hash.", section: "Rate of error", tier: "system", source_ids: ["s1"], why_material: "A known rate of error is an enumerated Daubert factor, and here it is a table rather than an assertion." },
  { id: "c4", text: "Standards controlling the technique's operation exist and are enforced by a deterministic parser and gate: a unanimous three-model verdict was refused because two derivations diverged, and the refusal is a public receipt.", section: "Standards", tier: "system", source_ids: ["s6"], why_material: "Daubert asks for standards that control operation, not standards that are recited; a refusal receipt is the standard operating against the operator's interest." },
  { id: "c5", text: "FRE 902(13) and 902(14), added in 2017 to remove the cost of live authentication testimony for electronic records, make hash-verified records self-authenticating on a qualified person's written certification, and every field of the governed record is built to that shape.", section: "Self-authentication", tier: "system", source_ids: ["s2"], why_material: "It replaces a records-custodian witness with a certificate for this entire class of records." },
  { id: "c6", text: "The 902 position has two named gaps: no signed custodian certification has been drafted, and no qualified (eIDAS Article 41-grade) timestamp exists on the checkpoints — cryptographic anteriority via drand and Bitcoin anchoring is present but carries no legal presumption.", section: "Self-authentication", tier: "system", source_ids: ["s2"], why_material: "A litigator must know exactly which paper is missing before relying on self-authentication." },
  { id: "c7", text: "Every governed finding must declare the records a competent reviewer would have expected and did not receive, before any dispute exists, which makes the absence declaration a contemporaneous instrument under FRCP 37(e) for plaintiff and defence alike.", section: "Spoliation", tier: "system", source_ids: ["s3"], why_material: "37(e) sanctions turn on exactly what was not preserved or reviewed, and this field records it at decision time." },
  { id: "c8", text: "The methodology audits its own inputs: a governed critique of a case file returned eight defects, led by a necessity-stated-as-sufficiency error in the rule set — the specification flaw class an opposing expert hunts for.", section: "Standards", tier: "system", source_ids: ["s8"], why_material: "An instrument that documents its own input defects pre-empts the cross-examination that would otherwise surface them." },
  { id: "c9", text: "An expert report built on this record attaches, for every opinion, the complete request and response payloads, the pinned rule set hash, the derivation of each panel seat, and the measured error table — the Rule 26(a)(2)(B) 'facts or data considered' as artifacts rather than recollection.", section: "The expert report", tier: "system", source_ids: ["s5", "s7"], why_material: "Rule 26 requires the basis and the data considered; receipts make that requirement mechanical instead of reconstructive." },
  { id: "c10", text: "General acceptance is not satisfied, no court has ruled on an object of this shape, no correctness calibration certifies the panel right at a known rate, and the published error rates cover one task class with small n.", section: "What is not satisfied", tier: "system", source_ids: [], why_material: "The untested edges are exactly what a litigator must price before relying on any of this." },
];
const body = `## The threshold every machine conclusion has to cross

When a party offers expert methodology in a United States federal court, *Daubert v. Merrell Dow Pharmaceuticals* (1993) and Federal Rule of Evidence 702 make the trial judge a gatekeeper, and the Supreme Court enumerated the factors the gate turns on: **can the technique be tested** (and has it been); **has it been subjected to peer review and publication**; **what is its known or potential rate of error**; **do standards exist that control its operation**; and **is it generally accepted** in the relevant community.

Machine-generated judgement is now routinely upstream of litigated facts — a model read the covenant, classified the transaction, disposed of the alert — and when that judgement is offered through an expert, or attacked through one, it faces the same five questions. For most AI systems the honest answers are: untested in any falsifiable sense, unpublished, error rate unknown, no operative standards, no acceptance. The methodology is vulnerable at the threshold, before anyone reaches the merits.

This page walks the factors one at a time against a system that is running, and maps each factor to a live artifact — including the factors that are **not** satisfied, stated as plainly as the ones that are.

## Factor one: tested — with the failure on the record

Daubert's first factor is falsifiability: not "could this in principle be tested" but whether it has been, and what happened. The strongest evidence a methodology can offer here is a documented failure that was caught by its own machinery, retracted, and fixed. This one has that. The derivation-agreement gate — the component that refuses to seal a decision unless independent models agree clause by clause on *why*, not just on the verdict — originally compared clause numbers only. It sealed an approval on three seats that cited the same clauses while meaning different things by them: a **false convergence**. The audit caught it, the seal was retracted as invalid, the comparison was rebuilt on canonical per-clause derivation tuples, and the failure case is now a regression test:

[[embed:source:s4]]

Behind that sits a 72-call controlled study — three prompt arms, three models, eight runs each, on a case with known ground truth — establishing that the governing constitution is a measured causal variable: auditable structure (declared-absent records, flip conditions, rejected alternatives) appeared in zero of 48 ungoverned calls, and clause-citation agreement rose from 0.74 to 0.95 under governance:

[[embed:source:s5]]

A methodology that has published its own falsification and repair is answering Daubert factor one in the strongest available form.

## Factor two: peer review — partially, and honestly

The receipts, rule sets, probe suites and failure analyses are public and attackable: every hash is recomputable, every payload is complete, and adversarial model audits of the system's own inputs are on the ledger. That is publication and exposure to challenge. It is **not** academic peer review — no journal, no anonymous referees, no independent replication by an outside laboratory. A court weighing this factor gets scrutiny-by-publication, not scrutiny-by-discipline, and counsel should characterise it exactly that way.

## Factor three: the known rate of error, as a table

This is the factor most AI evidence dies on, and here it is the factor supplied most directly. The panel's error rate was measured by running fourteen probes with pre-declared correct verdicts through the identical adjudication path — same rule set pinned at SHA-256, same prompts, same temperature — across five models, seventy findings in all:

[[embed:source:s1]]

The numbers are unflattering and published anyway. The panel's **false-confidence rate** — returning a verdict where the correct answer was "cannot conclude" — runs from 21.4% on the best seat to 42.9% on the worst. Every model is near-perfect where the text is clear and collapses where it is not. Accuracy per seat, miss rate, over-abstention, span fidelity: each is a row in a table, with the probe suite itself published at a hash so the measurement is attackable rather than asserted. A cross-examiner can do real work with that table; what a cross-examiner cannot do is claim the rate is unknown.

## Factor four: standards that control the operation

Daubert asks whether standards exist and whether they actually govern. Here the standards are executable. The rule set under adjudication is pinned to a content hash before any model runs. Each seat operates under a governing constitution that compels verdict, clauses relied on, a clause-by-clause derivation, the records *not* received, the strongest rejected alternative, and the flip condition. A deterministic parser — not a model — voids any finding that invents a clause or omits a required field. And the gate enforces the standard against the operator's own interest: the exhibit is a case where three models returned the **same verdict citing the same clauses** and the system still refused to conclude, because two of them had derived it through different trigger states:

[[embed:source:s6]]

A standard that only ever produces the answer its operator wanted is decoration. A public refusal receipt is the standard operating.

The standards also run backwards, against the inputs. A governed seat asked to critique a case file as a colleague returned eight defects, the lead one a rule set that stated only a necessary condition where a sufficient one was needed — precisely the specification flaw an opposing expert would surface in deposition, found and published by the methodology itself first:

[[embed:source:s8]]

## Factor five: general acceptance — not satisfied

No professional community has adopted this technique. No court has admitted or excluded an object of this shape. No standards body has recognised the format. Stating otherwise would be false, so it is stated as the open factor: under the flexible *Daubert* inquiry a methodology can be admitted with this factor unmet when the others are strong, but counsel should brief it as unmet, not finesse it.

## FRE 902(13) and (14): authentication without the witness

The second doctrine is narrower and more mechanical. In 2017, Rules 902(13) and 902(14) were added to the Federal Rules of Evidence for a stated purpose: authenticating electronic records at trial was consuming money and witnesses out of all proportion to how rarely authenticity was genuinely disputed. The amendment made two classes of records **self-authenticating** — admissible without a live foundation witness:

- **902(13)**: a record generated by an electronic process or system shown to produce an accurate result, certified by a qualified person.
- **902(14)**: data copied from an electronic device, storage medium, or file, where the copy is authenticated by a process of **digital identification** — in practice, a hash match — again on a qualified person's certification.

The mechanics matter. The certification is a written declaration, served in advance under the same procedure as 902(11)/(12) business-records certificates, by a person who would be qualified to give the same testimony live — a systems administrator, a forensic examiner — describing the process and, for 902(14), attesting that the hash of the copy matches the hash of the original. The opponent gets notice and a fair opportunity to challenge; if they do not raise a genuine dispute, no custodian ever takes the stand.

The governed record here is built to that shape by construction: every invocation writes identifier, timestamp, actor, object, input and output fingerprints automatically, as a regular activity of the system; every artifact, record and rule set carries a published SHA-256 recomputable by anyone; an offline verifier rehashes every object. The conformance map traces each field to its subsection — and names what is missing rather than hiding it:

[[embed:source:s2]]

Two gaps, stated exactly. First, **no custodian certification has been drafted or signed** — the paper that makes self-authentication operative is a form to fill, but it has not been filled. Second, **no qualified timestamp**: the checkpoints are anchored to drand and Bitcoin, which gives cryptographic anteriority, but an eIDAS Article 41-grade qualified timestamp carries a legal presumption of time and integrity that this anchoring does not. For a litigator, the position is: the record is 902(14)-shaped and the certificate is a week of work, not a rebuild.

## FRCP 37(e): the absence declaration, both directions

The sharpest litigation use of this record is not what it contains but what it compels the system to say it *lacked*. Every governed finding must list the records a competent reviewer would have expected and did not receive — before anyone knew there would be a dispute. In the worked contract adjudication, each of three model families declared its absences by name: the signed agreement itself, the claim email's provable transmission date, any waiver or tolling agreement:

[[embed:source:s3]]

Under **FRCP 37(e)**, sanctions for failure to preserve electronically stored information turn on exactly what was lost and whether the party acted with intent to deprive. The absence declaration serves both sides of that fight:

- **For the plaintiff**, it is a spoliation instrument: a contemporaneous, machine-compelled record of what the decision-maker never looked at, made at decision time, immune to later reconstruction. "You approved this without the underlying agreement" stops being an inference and becomes a quoted field.
- **For the defence**, the same field is armour: it converts "we reviewed everything relevant" from testimony assembled years later into an artifact that predates the claim, and where a record was genuinely unavailable, the declaration proves the unavailability was known and stated, not concealed.

The field serves both because it records reality rather than a position. One limit, stated: the declaration proves what was not *received*; it does not by itself prove the absent record ever existed.

## What an expert report built on this looks like

Rule 26(a)(2)(B) requires a testifying expert's report to contain a complete statement of all opinions, **the basis and reasons for them**, and **the facts or data considered** in forming them. In ordinary AI litigation that clause produces reconstruction: the expert re-runs something like the original system, approximates the prompt, and testifies about what it probably did. Built on this record, the same report is an exhibit list:

- for each opinion, the invocation receipt carrying the **complete request and response payloads** — the exact governing text, the exact record, the exact output, not a recollection of them;
- the rule set at its content hash, so "the policy the model applied" is a byte string, not a characterisation;
- each panel seat's clause-by-clause derivation, its declared absences, its rejected alternative and flip condition — the *reasons* as structured data;
- the measured error table for the panel that produced the conclusion, which is the report's own reliability section written in advance.

The genuine sealed authorisation on the record shows the shape — every seat firing the same clauses in the same trigger states on the same evidence, payloads attached:

[[embed:source:s7]]

The difference from a prose report is not eloquence; it is that every sentence of the basis-and-reasons section resolves to a receipt the opposing expert can open.

## What is not satisfied

- **No case law.** No court has ruled on the admissibility of an object of this shape, under Daubert or under 902. Everything above is a well-founded position, not a holding.
- **No general acceptance.** The fifth Daubert factor is unmet and should be briefed as unmet.
- **No qualified timestamp, no signed certification.** The two named 902 gaps above; the second is paperwork, the first requires a qualified trust service.
- **No correctness calibration.** The measured rates quantify disagreement and false confidence; no study yet certifies the panel *right* at a known rate against oracle-labelled ground truth.
- **One task class, small n.** Seventy findings on fourteen probes is a published starting table, not an actuarial basis, and it says so on its face.

A litigator should treat those five items as the risk memo — and given that the parties who need this record most encounter it post-enforcement, in discovery or under a consent decree, the first courtroom test is a question of when, not whether.

## Submit a case

Send one bounded evidentiary question — the rule text and the record — to **build@miscsubjects.com**. You get back the governed panel, the absence declaration, and a hash-chained receipt. No account, no call, no deck.
`;
const cur = await (await fetch(`${BASE}/api/articles/${SLUG}`)).json();
const { token } = await getWriteToken(SLUG);
const r = await fetch(`${BASE}/api/articles/${SLUG}`, {
  method: "POST", headers: { "content-type": "application/json", "x-terminal-key": KEY, "x-write-token": token },
  body: JSON.stringify({ ...cur, slug: SLUG, body, claims, sources, status: "published" }),
});
console.log(SLUG, r.status, "body", body.length, "chars,", claims.length, "claims,", sources.length, "sources");
