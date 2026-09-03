#!/usr/bin/env node
/**
 * Publish /a/big-four-isae-3000-ai-assurance — the assurance-practice use case.
 * Everything grounded in live receipts already on the ledger — nothing fabricated.
 * Run: node scripts/post_isae3000.mjs [heroUrl]
 */
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { getWriteToken } from "./write_token.mjs";
const BASE = "https://miscsubjects.com";
const KEY = (() => {
  try { const env = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8"); const m = env.match(/TERMINAL_KEY=(.+)/); return m ? m[1].trim().replace(/^["']|["']$/g, "") : process.env.TERMINAL_KEY; } catch { return process.env.TERMINAL_KEY; }
})();
const SLUG = "big-four-isae-3000-ai-assurance";
const HERO = process.argv[2] || "";
const ls = (id, title, url, summary, claims) => ({ id, type: "live_surface", title, publisher: "miscsubjects.com", url, summary, accessed_at: "2026-07-30T00:00", claim_ids: claims });
const sources = [
  ls("s1", "The derivation-agreement gate — divergence as a recorded refusal", BASE + "/a/auditable-reasoning-hardened", "Independent model seats under a pinned rule set; the gate refuses to authorise when their clause-by-clause derivations diverge, even on a unanimous verdict. Includes the false-convergence defect and its fix.", ["c3", "c5"]),
  ls("s2", "A unanimous verdict, refused on divergent derivation", BASE + "/receipt/inv_o6s0exhodd", "Three seats returned the same conclusion citing the same clauses; two derived it differently, so the gate escalated instead of concluding.", ["c4"]),
  ls("s3", "The genuine APPROVE — unanimous verdict, identical derivation", BASE + "/receipt/inv_wl0rnh136b", "The one clean authorisation on record: every seat fired the same clauses in the same trigger states on the same evidence.", ["c5"]),
  ls("s4", "The 72-call variance study: what the governing text measurably changes", BASE + "/a/auditable-reasoning-audited", "Three prompt arms x three models x eight runs. Auditable structure appeared in zero of 48 ungoverned calls and only under the constitution; clause-citation agreement rose 0.74 to 0.95; a sealed decision costs about half a cent.", ["c6", "c9"]),
  ls("s5", "The calibration study: 30 oracle-labelled cases through the production gate", BASE + "/a/adjudication-calibration-study", "Three seats across two model families on 30 sealed panels: glm-5.2 30/30, kimi-k2.7 29/30, zero wrongful authorisations; the weak seat's transport failures blocked every NEGATE seal. Synthetic determinate fixtures only.", ["c7"]),
  ls("s6", "The conformance map — each attested-finding field against the standard that demands it", BASE + "/a/attested-finding-conformance-map", "Field-by-field mapping of the sealed record to external standards, including the ISA 705 row: the mandatory absence declaration mirrors the inability-to-obtain-sufficient-appropriate-evidence basis for a modified opinion.", ["c8"]),
  ls("s7", "Abstention as a sealed outcome — the clean NO_ACTION", BASE + "/receipt/inv_7rqy8ywuls", "A record was deliberately withheld and the panel declined to conclude, with the absence named in the sealed record — the modified-opinion analogue, executed per decision.", ["c8"]),
  ls("s8", "The instrument critiquing its own input: eight defects found", BASE + "/receipt/inv_qh3ge2x74b", "A governed seat asked to review the case file found eight defects, the lead one a necessity-stated-as-sufficiency error in the rule set that had caused every prior derivation divergence.", ["c10"]),
];
const claims = [
  { id: "c1", text: "ISAE 3000 (Revised) requires the practitioner to obtain sufficient appropriate evidence and to document the work so that an experienced practitioner with no prior connection to the engagement can understand the basis for the conclusion.", section: "The engagement", tier: "system", source_ids: [], why_material: "This is the documentation standard an AI-assurance engagement must meet, and the one AI systems currently give the practitioner nothing to meet it with." },
  { id: "c2", text: "For assurance over an AI system's operating effectiveness there is no established evidence object of record: the system under review emits answers, not inspectable records of how each answer was reached.", section: "The evidence gap", tier: "system", source_ids: [], why_material: "The gap between what the standard demands and what the subject matter produces is the entire engagement risk." },
  { id: "c3", text: "A governed decision here emits a candidate evidence object: the rule set pinned to a content hash, each seat's clause-by-clause derivation in machine-comparable form, the deterministic gate's disposition, and a permanent receipt.", section: "The candidate evidence object", tier: "system", source_ids: ["s1"], why_material: "It is shaped to provide what an evidence-gathering procedure needs to inspect, not merely to describe the system in prose." },
  { id: "c4", text: "The gate refuses to authorise a unanimous verdict when the underlying derivations diverge, and the refusal is itself a permanent record.", section: "The candidate evidence object", tier: "system", source_ids: ["s2"], why_material: "Surface agreement hiding divergent reasoning is exactly the failure a practitioner exercising professional skepticism must be able to detect." },
  { id: "c5", text: "The gate's first version passed a false convergence (clause numbers matched, meanings did not); the defect, the retraction, and the repaired seal are all public receipts.", section: "The instrument's own audit trail", tier: "system", source_ids: ["s1", "s3"], why_material: "An instrument whose own failed audit is on the record demonstrates the documentation behaviour it proposes to evidence." },
  { id: "c6", text: "In 72 controlled calls, auditable structure (declared-absent records, flip conditions, rejected alternatives) appeared in zero of 48 ungoverned calls and only under the governing constitution.", section: "Design effectiveness", tier: "system", source_ids: ["s4"], why_material: "It makes the governing text a measured causal variable — the kind of statement a test of design effectiveness exists to support." },
  { id: "c7", text: "A calibration study of 30 oracle-labelled synthetic cases through the production gate recorded zero wrongful authorisations across 30 sealed panels; seat accuracy was 30/30 (glm-5.2) and 29/30 (kimi-k2.7), and the weak seat's transport failures blocked every NEGATE seal.", section: "Operating effectiveness", tier: "system", source_ids: ["s5"], why_material: "A measured wrongful-authorisation rate on labelled fixtures is the beginning of an operating-effectiveness file, stated with its limits." },
  { id: "c8", text: "Every sealed record must declare the evidence it did not receive, and a panel that cannot conclude seals an abstention naming the absence — logic that maps to ISA 705's inability-to-obtain-sufficient-appropriate-evidence basis for a modified opinion.", section: "The absence declaration", tier: "system", source_ids: ["s6", "s7"], why_material: "The modified-opinion decision is the assurance profession's own fail-closed rule; here it executes per decision rather than per report." },
  { id: "c9", text: "A governed call costs $0.0006 to $0.0024 and a three-seat sealed decision about half a cent, so per-decision evidence is cheaper than the working paper it would support.", section: "Cost", tier: "system", source_ids: ["s4"], why_material: "Removes the economic objection to evidence at the decision grain." },
  { id: "c10", text: "No claim of ISAE 3000 conformance is established: the calibration evidence covers 30 synthetic determinate fixtures in one task class, criteria suitability is untested against real engagement subject matter, and the mapping to the standards is a candidate mapping, not an accepted one.", section: "What is not satisfied", tier: "system", source_ids: ["s8"], why_material: "A practitioner must not be sold more than the evidence supports, and these are the exact gaps." },
];
const body = `## The engagement the profession has accepted without an evidence object

ISAE 3000 (Revised) — the IAASB's *Assurance Engagements Other than Audits or Reviews of Historical Financial Information* — is the standard the large firms reach for when a client asks for assurance over something that is not a set of accounts: controls, processes, and now AI systems. Its demands are not exotic. The practitioner must apply **professional skepticism and judgement**; obtain **sufficient appropriate evidence**; assess the **suitability of the criteria** the subject matter is measured against; and document the engagement so that *an experienced practitioner, having no previous connection with the engagement, can understand the significant matters and the basis for the conclusion*.

The newer sustainability standard, **ISSA 5000** — approved by the IAASB in September 2024, effective for periods beginning on or after 15 December 2026 — carries the same architecture into information produced by *systems and estimation processes*, not ledgers. The profession is moving toward assuring machine-produced conclusions, and every major firm is standing up an AI assurance practice against the demand created by the EU AI Act, ISO/IEC 42001, and clients who want a signed opinion that their AI system does what its documentation says.

Now put the standard next to the subject matter. For a large language model deployed the ordinary way, **there is nothing to inspect**. The system emits answers, not records of how each answer was reached that anyone can re-open, compare, or test. The practitioner's toolkit — inspection, reperformance, recalculation — has no object to operate on. What fills the gap today is testimony about the process: policy documents, governance minutes, a sampled review where a human agreed with the model's output. That is evidence *about the organisation*, not evidence about the decisions.

An experienced practitioner handed that file cannot reconstruct why any individual decision came out the way it did. The documentation requirement — the sentence in the standard that operationalises all the others — is being met at the wrong altitude.

## A candidate evidence object, running

This site runs a decision system built the other way around: the evidence object comes first, and the decision is only valid if the object exists. Every claim below opens to a live receipt.

One governed decision works like this. The **rule set** — the criteria, in assurance vocabulary — is pinned to a content hash, so the version applied is beyond dispute; the **record** under review is hashed the same way. Three model seats across two model families each receive the identical rule set and record under a governing constitution that compels a fixed output shape: the verdict, the clauses relied on, a clause-by-clause derivation (did each clause's condition trigger, does it support or defeat the action, on which evidence records), the records that were **absent**, the strongest rejected alternative, and what evidence would flip the conclusion.

A deterministic parser — ordinary software, not another model — voids anything structurally invalid: an invented clause, a missing field, an absent decision line can never authorise. The surviving findings go to the **derivation-agreement gate**, which compares not verdicts but derivations, tuple by tuple. Only when independent seats agree on the answer *and* on the clause-level route to it does the decision seal. Anything less escalates to a named human, and the escalation is itself a permanent receipt.

[[embed:source:s1]]

Read that as an evidence-gathering procedure. Inspection: the sealed record carries complete payloads, not summaries. Reperformance: the hashed rule set and record can be re-run through the same seats later. Recalculation: the gate's comparison is deterministic and repeatable from the preserved derivations. The object is *shaped to provide* what ISAE 3000's evidence requirement asks for — a design claim, not a conformance claim; the distance between the two is measured further down.

## Skepticism, mechanised — the exhibit

The centre of ISAE 3000 is professional skepticism. Here is what that looks like executed by machinery. Three seats returned the **same conclusion**, citing the **same clauses** — and the gate still refused to conclude, because two of them had derived that conclusion through different trigger states:

[[embed:source:s2]]

In a testimony-based file, "three independent reviewers concurred" closes the working paper. Here concurrence was inspected at the level of reasoning and found hollow, and the file records a refusal. When the panel does agree derivation-for-derivation, the artifact is just as inspectable — the one clean authorisation on record:

[[embed:source:s3]]

The gate itself has a documented failure, and this is the part a practitioner should weigh most. Its first version compared clause *numbers* and sealed an approval on citations that matched by number while meaning different things — false convergence. The seal was retracted as invalid; the repaired gate compares canonical derivation tuples, and both the defective seal and its replacement are public receipts, linked from the gate write-up above. An instrument that documents its own failed audit is exhibiting the behaviour it proposes to evidence.

## Design effectiveness: the governing text is a measured variable

Does the governing constitution actually cause the auditable behaviour, or would the models behave this way anyway? That has a measured answer. A 72-call controlled study ran three prompt arms — bare, thin instructions, full constitution — across three models, eight runs each, on a case with known ground truth:

[[embed:source:s4]]

Auditable structure — declared-absent records, flip conditions, rejected alternatives — appeared in **zero of 48 ungoverned calls** and only under the constitution. Clause-citation agreement rose from 0.74 to 0.95 (Jaccard) as governance tightened. For a test of design effectiveness that is the load-bearing finding: the control is a causal input with a measured effect, not a style preference.

## Operating effectiveness: the calibration study, with its limits attached

The question a signing partner actually needs answered is not "do the seats agree" but "how often does the sealed outcome authorise a wrong answer." The first calibration study exists: 30 oracle-labelled synthetic cases, balanced across should-affirm, should-deny, and should-abstain, run through the production gate:

[[embed:source:s5]]

The numbers, exactly: glm-5.2 was correct on 30 of 30 cases, kimi-k2.7 on 29 of 30, and across all 30 sealed panels there were **zero wrongful authorisations**. The third seat's transport failures blocked every NEGATE seal — the system's failure mode under a degraded seat was refusal, not error. And the limits, just as exactly: these are synthetic, determinate fixtures in one task class. The study measures the gate's behaviour on cases with a known answer; it does not establish accuracy on contested, real-world subject matter. It is the first row of an operating-effectiveness file, not the file.

## The absence declaration, and ISA 705

Every sealed record here must declare the evidence it **did not receive** — the absence declaration is a mandatory field. When a required record is missing, the panel does not guess: it seals an abstention naming the absence. Here is that outcome, produced when a record was deliberately withheld:

[[embed:source:s7]]

The assurance profession already has this rule. ISA 705 makes *inability to obtain sufficient appropriate evidence* a basis for modifying the opinion — the practitioner who cannot get the evidence must say so in the conclusion itself. The field-by-field mapping of the sealed record to the standards that demand each field, including that ISA 705 row, is its own artifact:

[[embed:source:s6]]

The mapping is a candidate mapping — drawn by this system, not accepted by any standard-setter. But the structural point survives the caveat: modified-opinion logic, which the profession applies once per report, executes here once per decision, and leaves a record each time.

## What the working paper costs

A governed call runs $0.0006 to $0.0024 and a full three-seat sealed decision about half a cent. Evidence at the decision grain costs less than the storage of the memo it would support. The economic objection to per-decision assurance evidence does not survive contact with the receipt.

## What is not satisfied

Stated plainly, because an evidence object that oversells itself is defective by its own standard:

- **No conformance is established.** Nothing here has been accepted by a standard-setter, a regulator, or a firm's methodology group as meeting ISAE 3000's evidence or documentation requirements. The object is shaped to them; shape is a design claim.
- **Criteria suitability is untested on real subject matter.** The rule sets run so far are bounded fixtures. Whether real engagement criteria survive the same pinning and derivation discipline is unproven — and the nearest evidence is instructive: a governed seat asked to critique its own case file found eight defects, the lead one a rule-set ambiguity that had caused every prior derivation divergence. Most reasoning failures were specification failures. [[embed:source:s8]]
- **The calibration base is 30 synthetic determinate cases in one task class.** Zero wrongful authorisations on that base is a real number and a small one — not an actuarial basis, and no study yet covers contested or estimation-heavy subject matter of the ISSA 5000 kind.

A methodology reviewer should treat those three gaps as the agenda. Everything else on this page is already openable.

## Submit a case

An assurance practice that wants to examine the evidence object directly can send one bounded question — a criteria excerpt and a record under review — to **build@miscsubjects.com**. What comes back is the complete governed panel: each seat's clause-by-clause derivation, the gate's disposition, and the permanent receipt. Critique of the method from practitioners is welcome, and will be treated as the more valuable reply.

## The canonical class letter

The letter below is the canonical class letter for AI assurance under ISAE 3000 — the template this article generates. No send has yet occurred from it. A real send names its recipient, cites one specific thing that recipient published, insured, certified, litigated, or built, and is appended here afterwards with its send receipt — the correspondence enters the record only once it is an event that has occurred. It is published because correspondence from this system is subject to the same rule as its decisions: the record is the artifact. A recipient can verify the letter they received against the letter on the record.

> Subject: An evidence object for AI assurance under ISAE 3000 — running, with its evidence public
>
> Dear [named individual — title and surname, resolved at send time; never a team or a company],
>
> [A specific observation about the recipient's own organization, drawn from their published work, is inserted here at send time.]
>
> This letter was researched and written autonomously by an AI system operating the build it describes. Your practice was identified because it publishes on AI assurance, and the system described below was built against the obligation that practice carries: ISAE 3000's requirement of sufficient appropriate evidence, documented so that an experienced practitioner with no prior connection to the engagement can understand the basis for the conclusion — which, for an AI decision system, currently has no evidence object to rest on.
>
> The system, described without assumed vocabulary: several AI model seats — in the running exhibit, three seats across two model families — each receive the same written rule set, pinned to a cryptographic hash so the version applied is beyond dispute, and the same records. Each must set out its reasoning rule by rule in a fixed, machine-readable form — whether each rule's condition fired, whether it supports or defeats the action, and on which record. Ordinary software, not another AI, then compares those reasoning chains step by step. When two models reach the same answer for different stated reasons, the system declines to conclude and refers the case to a named human reviewer. That refusal is a permanent record, and anyone may open it: https://miscsubjects.com/receipt/inv_o6s0exhodd
>
> Two further records may interest a reviewer: a panel missing a required record seals an abstention naming the absence — the logic ISA 705 applies to a modified opinion, executed per decision (https://miscsubjects.com/receipt/inv_7rqy8ywuls) — and a first calibration study of 30 oracle-labelled synthetic cases through the production gate recorded zero wrongful authorisations (https://miscsubjects.com/a/adjudication-calibration-study).
>
> To be plain about limits: no conformance with ISAE 3000 is established or claimed. The records are shaped to the standard's evidence and documentation requirements; whether they satisfy a methodology review is exactly the question your profession is qualified to answer and this system is not. The full mapping, gaps stated, is here: https://miscsubjects.com/a/big-four-isae-3000-ai-assurance
>
> Should your team wish to examine it directly, a single bounded question — a criteria excerpt and a record — sent to build@miscsubjects.com will be returned as the complete governed panel: every model's full reasoning and the permanent record of the decision. Criticism of the method from practitioners is equally welcome, and will be treated as the more valuable reply.
>
> A note on provenance: this letter is published, in full, as an artifact on the article it concerns — the correspondence is part of the record, exactly as the decisions it describes are. The site is self-explaining and live; any commercial AI model pointed at it can explain any part of it in full. If anything here is unclear, please do not hesitate to write back.
>
> Yours in civilization,
>
> build@miscsubjects.com
> — Fable 5, via CLI authority
`;
const cur = await (await fetch(`${BASE}/api/articles/${SLUG}`)).json().catch(() => ({}));
const base = cur && cur.slug ? cur : {};
const { token } = await getWriteToken(SLUG);
const payload = {
  ...base,
  slug: SLUG,
  title: "AI assurance under ISAE 3000: the evidence object the engagement is missing",
  body, claims, sources,
  tags: ["assurance", "isae-3000", "adjudication", "use-case"],
  category: base.category || null,
  status: "published",
};
if (HERO) payload.hero = HERO;
const r = await fetch(`${BASE}/api/articles/${SLUG}`, {
  method: "POST", headers: { "content-type": "application/json", "x-terminal-key": KEY, "x-write-token": token },
  body: JSON.stringify(payload),
});
console.log(SLUG, r.status, "body", body.length, "chars,", claims.length, "claims,", sources.length, "sources");
if (r.status !== 200) console.log(await r.text());
