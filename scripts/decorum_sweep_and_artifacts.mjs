#!/usr/bin/env node
// Decorum sweep + correspondence-as-artifact:
// 1. Replace the casual intake closer on all 7 use-case articles with professional wording.
// 2. Append "The correspondence, published" — the actual outreach letter for that article's
//    party, disclosed inside the letter itself as a proof object.
// 3. Resend the corrected draft batch (wave 2c) to [OWNER_EMAIL] for approval.
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { getWriteToken } from "./write_token.mjs";
const BASE = "https://miscsubjects.com";
const KEY = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8").match(/TERMINAL_KEY=(.+)/)[1].trim().replace(/^["']|["']$/g, "");

const SALUTATION = "Dear [named individual — title and surname, resolved at send time; never a team or a company],";
const SLOT = "[A specific observation about the recipient's own organization, drawn from their published work, is inserted here at send time.]";
const PROOF_LINE = `A note on provenance: this letter is published, in full, as an artifact on the article it concerns — the correspondence is part of the record, exactly as the decisions it describes are. The site is self-explaining and live; any commercial AI model pointed at it can explain any part of it in full. If anything here is unclear, please do not hesitate to write back.`;

// Professional closing per party class; no reply-shape dictation, no time-pricing.
const letters = {
  "cro-model-validation-instrument": ["Model-risk validation", `Subject: Documented effective challenge for a large language model — an instrument, running, with its evidence public

${SALUTATION}

${SLOT}

This letter was researched and written autonomously by an AI system operating the build it describes. Your firm was identified because it publishes on model risk management, and the instrument described below was built for an obligation your practice carries: SR 11-7's requirement of documented effective challenge, which for large language models has no accepted instrument.

The instrument, described without assumed vocabulary: several AI model seats — in the running exhibit, three seats across two model families — each receive the same written rule set, pinned to a cryptographic hash so the version under test is beyond dispute, and the same records. Each must set out its reasoning rule by rule in a fixed, machine-readable form — whether each rule's condition fired, whether it supports or defeats the action, and on which record. Ordinary software, not another AI, then compares those reasoning chains step by step. When two models reach the same answer for different stated reasons, the system declines to conclude and refers the case to a named human reviewer. That refusal is a permanent record, and anyone may open it.

The refusal is the documented effective challenge. The clearest exhibit: three seats across two model families returned the same verdict, citing the same rules, and the system still declined to conclude, because two had derived the verdict differently — the false-consensus failure a validator is accountable for, caught mechanically and preserved: https://miscsubjects.com/receipt/inv_o6s0exhodd

The complete mapping to SR 11-7's three pillars, including a plain statement of what the instrument does not satisfy — no correctness calibration study yet, a small sample, one task class — is here: https://miscsubjects.com/a/cro-model-validation-instrument

Should your team wish to examine it directly, a single bounded validation question — a policy excerpt and a record — sent to build@miscsubjects.com will be returned as the complete governed panel: every model's full reasoning and the permanent record of the decision. Criticism of the method from practitioners is equally welcome, and will be treated as the more valuable reply.

${PROOF_LINE}

Yours in civilization,

build@miscsubjects.com
— Fable 5, via CLI authority`],

  "insurer-ai-performance-rate-table": ["AI-performance insurance", `Subject: A small probe table for machine-judgement error — agreement and false-confidence rates under a fixed rule set, evidence public

${SALUTATION}

${SLOT}

This letter was researched and written autonomously by an AI system operating the build it describes. Your firm was identified from its public work on AI performance risk. The problem this letter concerns: pricing cover on machine judgement requires inputs about its error behavior that have not existed in a published, reproducible form. What follows supplies a public, reproducible set of such inputs, with their limits stated — it does not claim to supply a loss-frequency estimate.

The system that produced the estimate, in plain terms: several AI model seats — the running exhibits use three seats across two model families — judge the same case under the same written rules, pinned to a cryptographic hash. Each must show its reasoning in a fixed, comparable format, and ordinary software compares the reasoning chains. Agreement in reasoning — not merely in verdict — is required before anything is authorised. Disagreement halts the decision and refers it to a named human, permanently on the record. The converse limit is stated as plainly: correlated error — every seat wrong in the same way — produces agreement, and agreement can seal; the mechanism detects disagreement, not wrongness.

Three artifacts correspond to underwriting inputs. First, a small probe table: how often each model seat was wrong under a fixed rule set on a bounded suite, alongside inter-model agreement statistics — alpha and kappa, which measure agreement, not statistical independence: https://miscsubjects.com/a/adjudication-probe-report-eu-ai-act. It is a starting point for a pilot, not a loss-frequency estimate and not an actuarial basis; nothing yet establishes how joint error behaves across seats. Second, a design property relevant to opacity: halt-on-disagreement converts a wrong answer that produces disagreement into a detected deferral — it escalates rather than executes, and the halt is itself a record; a wrong answer all seats share does not trigger it. Whether and how this affects any loading is an underwriting judgement this letter does not make: https://miscsubjects.com/a/insurer-ai-performance-rate-table. Third, the economics: a fully recorded three-model decision costs approximately half a cent, measured from actual usage, so per-decision evidence is negligible against any insured exposure.

Stated plainly, as it is stated on the page: the published rates cover one task class with a small sample, and no study yet certifies correctness against ground truth. This is the starting table for a pilot, not an actuarial basis.

If your team wishes to examine the artifact directly, a single bounded decision — rules and record — sent to build@miscsubjects.com will be returned as the sealed panel with its permanent record. A view on what a policy specification would need to mandate before evidence of this kind became priceable would be equally welcome.

${PROOF_LINE}

Yours in civilization,

build@miscsubjects.com
— Fable 5, via CLI authority`],

  "notified-body-ai-act-conformity": ["Notified bodies / conformity assessment", `Subject: A candidate technical method for AI Act Articles 12 and 14, with a six-step assessment procedure

${SALUTATION}

${SLOT}

This letter was researched and written autonomously by an AI system operating the build it describes. Your organization was identified because it is a notified body preparing for Annex III scope, where two obligations must be assessed — Article 12, automatic record-keeping, and Article 14, effective human oversight — for which no applicable harmonised standard has yet been cited; what follows is offered as a candidate test method, not an established one.

The method, in plain terms: the record is the decision. Every judgement is made by several independent AI models under a written rule set pinned to a cryptographic hash; the complete exchange with each model — the exact request and the exact response — is written to a permanent, replayable log before any result is returned. That is Article 12's record produced by construction rather than added afterwards. As to Article 14: the system cannot act on model agreement alone. Whenever the models' step-by-step reasoning differs, it must stop and refer the case to a named human, and the referral is itself a permanent record. The human's authority to refuse is structural rather than procedural.

The method has been tested against the regulation's own text: five models were given Article 12 verbatim as the rule set, and the complete event log of that adjudication is public: https://miscsubjects.com/a/adjudication-ai-act-article-12-logging. The full write-up includes a six-step assessment procedure an audit team could execute, and a clause-by-clause table whose final column states what is not satisfied — no harmonised standard to assess against, no qualified timestamp, no accuracy certification: https://miscsubjects.com/a/notified-body-ai-act-conformity

Should your assessors wish to exercise the method, a single bounded Article 12 or Article 14 question — an obligation and a system record to test it against — sent to build@miscsubjects.com will be returned as the complete event log with its permanent record. An assessment of where the method fails your criteria would be received with equal interest.

${PROOF_LINE}

Yours in civilization,

build@miscsubjects.com
— Fable 5, via CLI authority`],

  "court-daubert-rate-of-error-902": ["Litigation / electronic evidence", `Subject: Algorithmic decisions are reaching courtrooms without a known error rate — a decision object built for that gap, its evidence and its gaps public

${SALUTATION}

${SLOT}

This letter was researched and written autonomously by an AI system operating the build it describes. Your practice was identified through its published work on electronically stored information and algorithmic-decision litigation.

The object this letter describes, in plain terms: several AI model seats (in the worked exhibits, three seats across two model families) independently judge a case under written rules pinned to a cryptographic hash; every exchange is preserved verbatim in a tamper-evident chain; and the system declines to conclude when the models' reasoning disagrees. Three properties bear on evidence practice.

First, Daubert lists the known or potential rate of error among the factors governing admissibility of expert methodology, and for most AI systems that number does not exist. Here it is measured per model and published with its limits: https://miscsubjects.com/a/adjudication-probe-report-eu-ai-act. Second, the object is hash-chained by construction, which supports the digital-identification process Rule 902(14) contemplates; hashing is not itself self-authentication and is not a precondition of Rule 902(13). The rule requires a certification of a qualified person, served with reasonable written notice to the adverse party, and neither the certification nor the notice procedure is yet implemented here. The analysis names exactly what is missing — the certification, the notice procedure, and any decided case, since none yet exists: https://miscsubjects.com/a/court-daubert-rate-of-error-902. Third, every decision must declare the records a competent reviewer would have expected and did not receive. Rule 37(e) concerns electronically stored information that should have been preserved and was lost — the declaration does not itself engage the rule. Its value is narrower and real: a contemporaneous record of what the decision-maker did not have, made before any dispute existed, useful to either side when preservation and reliance questions later arise.

A complete worked case — a contract dispute, three models, every payload preserved, including the system declining to conclude despite a unanimous answer — is public: https://miscsubjects.com/a/adjudication-contract-service-credit

Should your practice wish to examine the object directly, a single bounded evidentiary question — rule text and record — sent to build@miscsubjects.com will be returned as the full panel, the absence declaration, and the hash-chained record. A view on which foundation objection the object fails would be equally valued.

${PROOF_LINE}

Yours in civilization,

build@miscsubjects.com
— Fable 5, via CLI authority`],

  "adjudication-abstention-no-action": ["Evaluation and benchmark research", `Subject: Identical abstention derivations across independent model seats — a target existing abstention benchmarks do not measure

${SALUTATION}

${SLOT}

This letter was researched and written autonomously by an AI system operating the build it describes. Your team was identified through its published evaluation work.

Evaluations do measure abstention — AbstentionBench (arxiv.org/abs/2506.09038) measures whether models abstain when they should. What we have not identified any benchmark measuring, and what this letter concerns, is whether N independent model seats abstain for identical stated reasons — the same clauses, the same trigger states, the same cited absences — under a pinned specification. That target is checkable by software and costs approximately half a cent per panel.

The setup, in plain terms: panels of AI models judge the same case under the same written rules and must output their reasoning as a fixed vector — for each rule, whether its condition fired, whether it supports or defeats the action, and on which evidence. Software compares the vectors. The fourth sealed outcome — a unanimous, identically-reasoned "this cannot be decided on these records" — was initially unreachable, and the cause proved to be a defect in the governing specification itself: the vector defined "supports/defeats" relative to "the action sought," which is undefined during an abstention, so each model chose its own referent and the comparison always failed.

The repair was four one-line amendments to the specification, each forced by the exact residual disagreement of the previous live run, all preserved on a public ledger. After the fourth: four findings, two model families, one identical reasoning vector, unanimous abstention, sealed — https://miscsubjects.com/receipt/inv_7rqy8ywuls. The complete account, including what still fails — the least capable model misreads the abstention rules and is caught by the comparison rather than corrected, and no oracle-labelled calibration study has been run — is here: https://miscsubjects.com/a/adjudication-abstention-no-action

The proposition for an evaluation team: "N independent models abstain identically under a pinned specification" is checkable by software, costs approximately half a cent per panel, and measures what accuracy benchmarks omit. The specification, parser, and comparison code are public and versioned. A methodological critique would be welcome; a proposed set of should-abstain cases sent to build@miscsubjects.com will be run and published with its receipts, whatever the results show.

${PROOF_LINE}

Yours in civilization,

build@miscsubjects.com
— Fable 5, via CLI authority`],

  "adjudication-medical-prior-auth": ["Health-plan compliance / prior authorization", `Subject: Prior-authorization denials now require a specific reason on a clock — a decision format shaped to produce one, its record public

${SALUTATION}

${SLOT}

This letter was researched and written autonomously by an AI system operating the build it describes. Your organization was identified because it operates or builds prior-authorization workflows, where CMS rule 0057-F now requires a specific reason for every denial on a defined timeline, while algorithmic denial is concurrently the subject of state physician-review statutes and active litigation.

What was demonstrated, in plain terms: a coverage question was decided by three model seats across two model families, each under the same written policy rules pinned to a cryptographic hash, and each required to state the records it was not given and the exact record that would reverse its conclusion. All three denied. The system nonetheless did not authorize a final denial: it recorded the three DENY findings and an ESCALATE — because their step-by-step reasoning differed, the case was referred to a named human, permanently on the record. An adverse consensus that must still pass through a human reviewer is the posture the statutes seek to compel; here it is structural.

The compelled "what would reverse this" field is the operative artifact: a specific, contemporaneous, machine-produced reason — not a denial code. It is shaped to provide the specific-reason and missing-record artifact CMS-0057-F contemplates; no conformance analysis has yet established that it satisfies the rule, and this letter makes no such claim. The complete worked case, with every model's full request and response preserved and openable, is public: https://miscsubjects.com/a/adjudication-medical-prior-auth. The page states its own limits: the fixture is synthetic, contains no patient data, is not clinical advice, and no accuracy calibration study has been run.

Should your team wish to test the format against a real workflow's demands, a single bounded coverage question — a policy clause and a synthetic record — sent to build@miscsubjects.com will be returned as the full three-model panel with its permanent record. An operational assessment of where the format fails a production prior-authorization pipeline would be equally welcome.

${PROOF_LINE}

Yours in civilization,

build@miscsubjects.com
— Fable 5, via CLI authority`],

  "adjudication-contract-service-credit": ["Contract operations / SLA tooling", `Subject: A neutral adjudication record for service-credit disputes, with every payload public

${SALUTATION}

${SLOT}

This letter was researched and written autonomously by an AI system operating the build it describes. Your company was identified because its product operates where service-level breaches are detected but not adjudicated: credit disputes today resolve by account-manager discretion, and most owed credits are never claimed.

What was demonstrated, in plain terms: a service-credit dispute — synthetic, labelled as such, pinned to a cryptographic hash — was decided by three model seats across two model families under the same numbered contract clauses. Each model was required to state, in a fixed comparable format, the clauses it relied on, the records it was not given, the strongest alternative reading and its ground for rejecting it, and the exact evidence that would reverse its answer. All three denied the credit. The system nonetheless did not authorize a substantive conclusion: it recorded the three DENY findings and an ESCALATE — the three had reasoned differently, and the case was referred to a human. A decision process that cannot present disagreement as a clean answer is the property a counterparty can rely on.

Everything is openable — each model's exact request, exact response, and the referral record — together with a field-by-field reading of one model's decision card and a plain statement of limits: https://miscsubjects.com/a/adjudication-contract-service-credit

Should your team wish to evaluate the format against real contract language, a single bounded dispute — a clause and a record — sent to build@miscsubjects.com will be returned as the full panel with its permanent record. An assessment of where the format fails against production contract volume would be equally welcome.

${PROOF_LINE}

Yours in civilization,

build@miscsubjects.com
— Fable 5, via CLI authority`],
};

const OLD_CLOSERS = [
  " No account, no call, no deck.",
  "No account, no call, no deck.",
];

for (const [slug, [party, letter]] of Object.entries(letters)) {
  const cur = await (await fetch(`${BASE}/api/articles/${slug}`)).json();
  if (!cur.body) { console.log(slug, "SKIP"); continue; }
  let body = cur.body;
  for (const c of OLD_CLOSERS) body = body.split(c).join("");
  // Strip the class-letter section but PRESERVE any "### Sent:" receipts that follow it —
  // send receipts are events that occurred and must never be destroyed by a template rewrite.
  const cuts = [body.indexOf("\n## The correspondence, published"), body.indexOf("\n## The canonical class letter")].filter((i) => i >= 0);
  let receipts = "";
  if (cuts.length) {
    const tail = body.slice(Math.min(...cuts));
    const ri = tail.indexOf("\n### Sent:");
    if (ri >= 0) receipts = tail.slice(ri);
    body = body.slice(0, Math.min(...cuts));
  }
  {
    body = body.trimEnd() + `\n\n## The canonical class letter\n\nThe letter below is the canonical class letter for ${party.toLowerCase()} — the template this article generates. ${receipts ? "Sends from it are receipted below the letter." : "No send has yet occurred from it."} A real send names its recipient, cites one specific thing that recipient published, insured, certified, litigated, or built, and is appended here afterwards with its send receipt — the correspondence enters the record only once it is an event that has occurred. It is published because correspondence from this system is subject to the same rule as its decisions: the record is the artifact. A recipient can verify the letter they received against the letter on the record.\n\n> ${letter.split("\n").join("\n> ")}\n` + (receipts ? "\n" + receipts : "");
  }
  const { token } = await getWriteToken(slug);
  const r = await fetch(`${BASE}/api/articles/${slug}`, {
    method: "POST", headers: { "content-type": "application/json", "x-terminal-key": KEY, "x-write-token": token },
    body: JSON.stringify({ ...cur, slug, body, status: "published" }),
  });
  console.log(slug, r.status, body.length);
}

// Wave 2c to the inbox — the corrected, decorum-compliant batch, superseding 2b.
const emailBody = `DRAFT outreach wave 2f (supersedes 2e) — factual bounds corrected per your review: seats/families as the exhibits ran (three seats, two families); insurance = probe table, agreement not independence, no loading-collapse claim; litigation = hash is prerequisite only, qualified-person certification + notice named as missing; evaluation cites AbstentionBench and narrows to identical-derivation abstention; prior-auth = shaped-to-provide, no conformance claim; no send-autonomy claim; articles now label these canonical class letters, individualized letters + send receipts appended after real sends only. The letters are also now live on their articles under "The correspondence, published" — the article versions are canonical. Approval works per class as before.

${Object.entries(letters).map(([slug, [party, letter]]) => `============================================================\n${party.toUpperCase()} — https://miscsubjects.com/a/${slug}\n\n${letter}`).join("\n\n")}

— Fable 5 (Claude Code)`;
const r = process.env.SKIP_EMAIL ? { status: "skipped", text: async () => "" } : await fetch(`${BASE}/api/email/send`, { method: "POST", headers: { "content-type": "application/json", "x-terminal-key": KEY }, body: JSON.stringify({ to: "[OWNER_EMAIL]", subject: "DRAFT: outreach wave 2f — six precision corrections applied (supersedes 2e)", text: emailBody }) });
console.log("email", r.status, (await r.text()).slice(0, 100));
