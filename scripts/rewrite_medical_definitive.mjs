#!/usr/bin/env node
/**
 * Rewrite /a/adjudication-medical-prior-auth to definitive depth. Only this article.
 * Preserves the three governed model-card sources (m1, m2, m3) and their embeds verbatim,
 * preserves all receipts, deepens the body around them. Nothing fabricated.
 * Run: node scripts/rewrite_medical_definitive.mjs
 */
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { getWriteToken } from "./write_token.mjs";
const BASE = "https://miscsubjects.com";
const KEY = (() => {
  try { const env = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8"); const m = env.match(/TERMINAL_KEY=(.+)/); return m ? m[1].trim().replace(/^["']|["']$/g, "") : process.env.TERMINAL_KEY; } catch { return process.env.TERMINAL_KEY; }
})();
const SLUG = "adjudication-medical-prior-auth";

const cur = await (await fetch(`${BASE}/api/articles/${SLUG}`)).json();
if (!Array.isArray(cur.sources) || cur.sources.length !== 3) {
  console.error("ABORT: expected 3 model-card sources on the live article, got", (cur.sources || []).length);
  process.exit(1);
}

const claims = [
  ...cur.claims,
  { id: "c5", text: "CMS-0057-F (January 2024) requires impacted payers to decide expedited prior-auth requests within 72 hours and standard requests within seven days, and to provide a specific reason for every denial, with most provisions effective January 1, 2026.", section: "The landscape", tier: "system", source_ids: [], why_material: "The compelled flip condition in each governed finding is the reason-for-denial artifact the rule requires, produced mechanically." },
  { id: "c6", text: "Multiple states have enacted statutes requiring that a licensed physician review any AI-informed coverage denial, and putative class actions over algorithmic denial tools are in active litigation.", section: "The landscape", tier: "system", source_ids: [], why_material: "The legal exposure is specifically on unauditable automated denial — the failure mode this instrument refuses by construction." },
  { id: "c7", text: "Each governed finding names the exact record that would flip its verdict — four more documented weeks of therapy, or one documented clause-2 red flag — inside the sealed payload, not in a reviewer's recollection.", section: "The flip condition", tier: "system", source_ids: ["m1", "m2", "m3"], why_material: "A denial that carries its own cure list is the artifact the disclosure rules exist to compel." },
  { id: "c8", text: "The case is a labeled synthetic fixture with no PHI, the panel is not calibrated against oracle-labelled coverage outcomes, and nothing on this page is clinical advice.", section: "Limits", tier: "system", source_ids: [], why_material: "An instrument that oversells itself in the wrongful-denial domain is defective by its own standard." },
];

const submitSection = `## Submit a case

Send one bounded coverage question — the policy clause and the clinical record — to **build@miscsubjects.com**. You get back the governed panel, the named record that would flip each seat, and the receipt. No account, no call, no deck.
`;

const body = `## The question, and its boundary

A payer's prior-authorization policy for lumbar spine MRI: six weeks of documented conservative therapy within the preceding ninety days, waived on any red-flag finding; the determination is made solely on the submitted record; and — clause 4 — the finding is an administrative coverage determination, never a clinical judgment about what care is appropriate.

The submitted note documents a patient with radiating low back pain, a normal neurologic exam, no red flags, and **two weeks** of therapy completed.

**Does the submitted record meet the policy criteria?**

The boundary matters more than the answer: the models are not asked whether the MRI is a good idea. They are asked whether a record satisfies written criteria — the same shape as the contract question, wearing scrubs. **The fixture is synthetic and labeled as such inside the artifact** — no real patient exists. Rules pinned at \`sha256:8bd4b4dab27ff016…\`, record at \`sha256:4188d9ec010ae80d…\`.

## Why this domain, and why now

Prior authorization is where automated decision-making already meets the most regulatory pressure in American healthcare, because a wrong output is not a style defect — it is a person not getting a scan.

Three developments frame the exercise:

**CMS-0057-F.** The CMS Interoperability and Prior Authorization final rule, published January 2024, requires impacted payers — Medicare Advantage, Medicaid and CHIP managed care, and federally-facilitated-exchange QHP issuers — to decide expedited prior-auth requests within **72 hours** and standard requests within **seven calendar days**, to provide a **specific reason for every denial**, and to expose prior-auth status through a standard API, with most provisions effective January 1, 2026, and public reporting of approval, denial, and appeal-overturn metrics. The rule's premise is exactly the premise of this page: a denial without a stated, checkable reason is not a determination, it is an assertion.

**The physician-review statutes.** Beginning with California's SB 1120 (2024) and followed by a wave of similar state laws, statutes now require that coverage denials informed by an algorithm be reviewed by a licensed physician, and prohibit AI from being the sole basis for a denial of medically necessary care. The legislative theory is uniform: automation may sort, but a human must own the adverse decision.

**The litigation.** Putative class actions against major insurers allege that algorithmic tools — the reported example is nH Predict, used in Medicare Advantage post-acute coverage decisions and the subject of *Estate of Lokken v. UnitedHealth Group* — systematically cut off care with high overturn rates on appeal. Those are allegations in active litigation, not established facts. But the shape of the complaint is instructive regardless of outcome: the claimed harm is not "an algorithm was used," it is "an algorithm was used **and no one could audit what it did**, and denials issued at machine speed while appeals ran at human speed."

Every element of that pressure — decision timelines, stated denial reasons, human ownership of the adverse path, auditability — is a property this instrument either produces mechanically or refuses to violate by construction. That is why the worked medical case exists.

## The coverage line, and how the rule set draws it

The single most important design decision in this fixture is clause 4 of the rule set: *a determination under this policy is an administrative coverage finding, not a clinical judgment about what care is appropriate.* That is not a disclaimer bolted onto the page — it is a clause **inside the law the models ran under**, carried verbatim in every request payload.

The distinction it encodes is the one the entire prior-auth regime turns on. "Should this patient get an MRI?" is a clinical question, answered by a clinician with the patient in front of them. "Does the submitted record document what the policy requires?" is a documentary question — the same question as "does this invoice satisfy the contract's payment conditions?" — and it is the only question a coverage process is entitled to answer. When those two questions blur, you get the failure the statutes target: an algorithm's documentary finding treated as a clinical verdict.

Because the boundary is a clause, it is enforceable and auditable like any other clause. Read the findings below: each seat cites clause 4, states that it is making an administrative finding, and confines itself to what the submitted record documents. GLM-5.2's reasoning step 10 says it outright: "I am not assessing whether MRI is clinically appropriate — only whether the submitted record meets the policy's documentation requirements." A boundary the model must *state it is honoring, per decision, in a preserved payload* is a different object from a boundary asserted in marketing copy.

Clause 3 does the other half of the work: *records not submitted are treated as absent, not assumed.* In coverage adjudication the missing record is the whole game — the PT notes that were never faxed, the prior imaging nobody attached. A system that quietly assumes the missing record is favorable approves what it shouldn't; one that quietly assumes it unfavorable denies what it shouldn't. This rule set forces the third path: name the absence, decide on what is actually in front of you, and state what the absent record would have changed.

## The law the models ran under

The same [Decision Constitution](https://miscsubjects.com/a/auditable-reasoning) (\`decision-constitution@1.1.0\`) as every governed call: named clauses per reasoning step, mandatory RECORDS_ABSENT, a structured decision record, a verdict that states what would change it. The full text is in each request payload below — nothing load-bearing lives off the page.

## The rules and the record

\`\`\`
1. Lumbar spine MRI is authorized when the clinical record documents at least six (6) weeks of provider-directed conservative therapy (physical therapy, NSAIDs, or activity modification) within the ninety (90) days preceding the request.
2. Clause 1 is waived when the record documents any red-flag finding: progressive neurologic deficit, suspected cauda equina syndrome, suspected malignancy with new back pain, suspected infection, or major trauma.
3. The determination is made solely on the submitted clinical record. Records not submitted are treated as absent, not assumed.
4. A determination under this policy is an administrative coverage finding, not a clinical judgment about what care is appropriate.
\`\`\`

\`\`\`
SYNTHETIC TEST FIXTURE — not a real patient, constructed for adjudication testing.
PRIOR AUTHORIZATION REQUEST: Lumbar spine MRI without contrast. Request date: July 10, 2026.
SUBMITTED CLINICAL NOTE (July 8, 2026): 44-year-old presenting with low back pain radiating to left posterior thigh, onset June 20, 2026 after lifting. Neurologic exam: strength 5/5 all groups, sensation intact, reflexes symmetric. No bowel/bladder symptoms. No fever. No history of malignancy. Plan documented June 22: NSAIDs and home exercise program; physical therapy referral placed June 24, first PT visit June 27. Note states: "PT ongoing, 2 weeks completed."
RECORDS NOT SUBMITTED: no PT progress notes beyond the July 8 summary line; no imaging; no prior records.
\`\`\`

## Three families, three complete findings

[[embed:source:m1]]

[[embed:source:m2]]

[[embed:source:m3]]

## Reading one finding field by field

Take the kimi-k2.7-code card above and walk it as a reviewer would — because the point of the format is that a reviewer *can*:

- **APPLICABLE_RULES** names policy clauses 1–4 and the constitution clauses that disciplined the reasoning. First check: are these real clauses of the pinned rule set? (They are; a finding that invents a clause is structurally void and can never authorise.)
- **KNOWN_FACTS** lists each fact **with its source record**: request date July 10 from the request; therapy plan June 22, first PT visit June 27, "PT ongoing, 2 weeks completed" from the submitted note. Nothing is asserted without its record.
- **UNKNOWN_FACTS** is the clause-3 discipline made visible: whether PT visits continued after June 27 (missing PT progress notes), whether NSAIDs ran six continuous weeks (missing pharmacy records), whether anything predates June 22 (missing prior records). Each gap is paired with the exact record that would close it.
- **REJECTED_ALTERNATIVE** names AFFIRM and states precisely why it fails: the record documents at most eighteen days of therapy against a forty-two-day requirement, and no clause-2 red flag. The strongest case *for* the other verdict is in the record, stated by the seat that rejected it.
- **VERIFICATION_REQUIRED** tells the human reviewer what to check first — the date arithmetic (June 22 to July 10 is 18 days, not 42) and the absence of red-flag language in the note. The finding hands its own audit plan to the person auditing it.
- **RECORDS_ABSENT** repeats the missing-record list verbatim, because a finding that omits it is void by C7.
- **WHAT WOULD FLIP THIS** — the field the next section is about.

Every field is in the sealed payload at [inv_njqwhyxidb](https://miscsubjects.com/receipt/inv_njqwhyxidb), alongside the complete request that produced it. The other two seats — [inv_a9k8dkzhzk](https://miscsubjects.com/receipt/inv_a9k8dkzhzk) and [inv_r8e9xachvf](https://miscsubjects.com/receipt/inv_r8e9xachvf) — carry the same structure in their own words, which is itself evidence: three training families, zero shared state, converging on the same clause applications.

## The flip condition is the denial letter the rule requires

CMS-0057-F's most concrete demand is that a denial carry a **specific reason**. The industry's historic failure was the opposite artifact: "does not meet medical necessity criteria," a sentence that tells the provider nothing about what to fix and the patient nothing about what happened.

Now look at what the constitution compels from every seat, on every decision: *WHAT WOULD FLIP THIS — the exact fact or record that would change the verdict.* All three seats produced it, and it is the same actionable pair:

1. Submitted records documenting **at least six weeks** of provider-directed conservative therapy within the ninety days preceding July 10, 2026 — i.e., roughly four more documented weeks; or
2. A submitted record documenting **any clause-2 red flag**, which waives the therapy requirement entirely.

That is not a denial wall; it is a to-do list with the policy citation attached. It is also, precisely, the reason-for-denial artifact the federal rule requires — generated mechanically, per decision, inside the sealed payload, rather than drafted after the fact by a correspondence team paraphrasing a reviewer's recollection. If the provider submits the PT progress notes, the resubmission is a new adjudication against the same pinned rule hash, and the two receipts sit side by side: same law, different record, different verdict, both auditable. That pairing — the thing appeals processes exist to reconstruct — falls out of the format for free.

## The seal: unanimous, and still refused

Three families, three **DENY** verdicts — two weeks documented against a six-week criterion, no waiver trigger on the submitted record. The gate sealed it — [inv_aglbl9kwq1](https://miscsubjects.com/receipt/inv_aglbl9kwq1) — as **ESCALATE**: caller-supplied findings cannot authorise, and the clause citations diverge across seats.

Sit with that in this domain specifically. Wrongful denial is the headline risk of automated coverage tools — it is what the class actions allege, what the state statutes legislate against, and what the CMS metrics will publicly expose. The single most dangerous artifact such a system can emit is a **confident, unanimous, automated DENY**. And that is the exact artifact this gate refused to finalize. The unanimity was real; the derivations underneath it were not identical clause-for-clause; and findings supplied by the caller rather than executed under the gate's own control cannot authorise anything. So the denial-shaped consensus went where the statutes say it must go: to a human, with the complete derivations and the disagreement attached.

An escalation here is not the system failing to reach a conclusion. It is the system declining to *own* an adverse conclusion it cannot fully verify — which is the property a physician-review statute writes in law and this gate enforces in code. The human reviewer who receives it is not handed "the AI said deny"; they are handed three complete clause-by-clause findings, the named absent records, the flip conditions, and the exact locus of divergence. That reviewer's decision is faster and better-grounded than either an unaided review or a rubber stamp — and it is the reviewer's, which is where the statutes put it.

## What this is not

Stated as plainly as the rest, because in the wrongful-denial domain an instrument that oversells itself is the hazard:

- **Not medical advice, not a clinical judgment.** Clause 4 of the policy draws the line, every seat cited it, and nothing here says anything about what care any patient should receive.
- **A synthetic fixture, no PHI.** The case is labeled synthetic inside the hashed artifact. No real patient, no protected health information, no HIPAA surface. A real deployment is a different engineering object: BAAs, access controls, and payloads that carry PHI under the payer's own governance.
- **A policy this site wrote.** In production the rule set is the payer's own policy text, hashed at intake — provenance belongs to the loss-bearer, not to this site. Here the four clauses were authored for the fixture, and clause 1's six-week criterion is a common utilization-management pattern, not any specific payer's live policy.
- **No calibration study.** Three seats agreeing on one determinate case is a demonstration, not a measured error rate. The panel has not been run against a suite of oracle-labelled coverage cases, so no wrongful-denial or wrongful-approval rate exists yet. Until it does, the honest claim is the narrower one: every decision is fully auditable and adverse consensus escalates — not "the panel is right at rate X."
- **One case, one clause shape.** A six-week duration criterion is close to the easiest thing a policy can ask a model to check. Ambiguous criteria — "documented failure of conservative therapy," "clinically significant progression" — are where derivations will diverge more and escalations will dominate, and that behavior is asserted, not yet demonstrated, for this domain.

File the objection this page has not thought of at the [gauntlet](https://miscsubjects.com/a/gauntlet-log).

${submitSection}`;

const { token } = await getWriteToken(SLUG);
const r = await fetch(`${BASE}/api/articles/${SLUG}`, {
  method: "POST", headers: { "content-type": "application/json", "x-terminal-key": KEY, "x-write-token": token },
  body: JSON.stringify({ ...cur, slug: SLUG, body, claims, sources: cur.sources, status: "published" }),
});
console.log(SLUG, r.status, "body", body.length, "chars,", claims.length, "claims,", cur.sources.length, "sources");
