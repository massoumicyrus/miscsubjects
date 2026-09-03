#!/usr/bin/env node
// DRAFT outreach wave 2b — zero-context, AI-disclosed, per-party, outreach-law compliant:
// opener inside the recipient's exposure (distinct per class + a lead-specific slot),
// disclosure + why-identified + where-documented, receipts inline, tiny reversible ask,
// no "free"/"excited"/meeting asks, no parameter leak. ONE draft email to [OWNER_EMAIL].
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
const KEY = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8").match(/TERMINAL_KEY=(.+)/)[1].trim().replace(/^["']|["']$/g, "");

const SLOT = "[LEAD-SPECIFIC OBSERVATION — one sentence from their own site/filings, inserted at send time; no two sends share it]";

const drafts = [
["1) MODEL-RISK VALIDATION (banks' second line, MRM consultancies)", `Subject: Documented effective challenge for an LLM — the artifact SR 11-7 asks your team for

${SLOT} Your validation team signs findings under SR 11-7, which requires documented effective challenge — a recorded, adversarial attempt to find where a model is wrong — and for the large language models now inside scope, no accepted instrument produces that document. The finding memos carry your names either way.

Disclosure before anything else: this email was researched and written by an AI system (Claude, built by Anthropic) operating autonomously; a person reviewed and approved it before it sent. Your firm was identified because you publish on model risk management, and the working instrument described below was built for exactly the obligation your practice carries. The reasoning and every exhibit behind this email are documented publicly at the link below — nothing here asks you to take the sender's word.

What the instrument is, with no assumed vocabulary: several AI models from different companies each receive the same written rule set (pinned to a cryptographic hash, so the version under test is beyond dispute) and the same records. Each must output its reasoning rule by rule in a fixed, machine-readable form: did this rule's condition fire, does it support or defeat the action, on which record. Ordinary software — not another AI — then compares those reasoning chains step by step. When two models reach the same answer for different stated reasons, the system refuses to conclude and routes the case to a named human, and that refusal is a permanent, openable record.

That refusal is the documented effective challenge. The strongest exhibit: three models returned the same verdict, citing the same rules, and the system still refused because two had derived it differently — the exact false-consensus failure a validator is personally on the hook for, caught mechanically and preserved: https://miscsubjects.com/receipt/inv_o6s0exhodd

The full mapping to SR 11-7's three pillars — conceptual soundness (a 72-call controlled study showing the governing text is a measured causal variable), ongoing monitoring (per-model error rates under a fixed rule set, with agreement statistics), outcomes analysis — including a plain section on what it does NOT satisfy (no correctness calibration yet; small sample; one task class): https://miscsubjects.com/a/cro-model-validation-instrument

If it is worth thirty minutes of anyone's reading time on your team, the fastest test is one bounded validation question — a policy excerpt and a record, emailed to build@miscsubjects.com. What comes back is every model's complete reasoning and the permanent record of the decision, which your team can pull apart at leisure. A one-line reply saying where the method fails a real validation standard is equally valuable to us, and costs you two minutes.`],

["2) AI-PERFORMANCE INSURANCE (Munich Re / Armilla / Relm / Lloyd's brokers)", `Subject: A measured loss frequency for machine judgement — the input AI-performance cover has been missing

${SLOT} Every attempt at AI performance cover hits the same actuarial wall: there is no loss-frequency estimate for machine judgement, so the product either doesn't get written or carries an opacity loading that prices it out. That missing number now exists in a published, reproducible form, and this email exists to put it in front of someone who prices risk for a living.

Disclosure: this was researched and written by an AI system (Claude, by Anthropic) operating autonomously, human-approved before sending. Your firm was identified from its public work on AI performance risk. Everything claimed below opens to a permanent public record — the documentation of why your segment was selected is on the linked pages themselves.

The system, in plain words: several AI models from different companies judge the same case under the same written rules, pinned to a cryptographic hash. Each must show its reasoning in a fixed comparable format, and plain software compares the reasoning chains. Agreement in reasoning — not merely in verdict — is required before anything is authorised; disagreement halts the decision and routes it to a human, permanently on the record.

Three artifacts map directly to underwriting inputs. The rate table: how often each model is wrong under a fixed rule set, with the agreement statistics that show whether errors are correlated across models — a starting loss-frequency estimate: https://miscsubjects.com/a/adjudication-probe-report-eu-ai-act. The loading collapse: halt-on-disagreement converts undetected error, the thing behind the fraud/opacity loading, into detected deferral — a wrong answer escalates instead of executing, with the halt itself on the record: https://miscsubjects.com/a/insurer-ai-performance-rate-table. The economics: a fully recorded three-model decision costs about half a cent, measured from usage, so per-decision evidence is negligible against any exposure worth insuring.

Stated before you find it yourself: the published rates cover one task class with a small sample, and no study yet certifies correctness against ground truth. This is a pilot's starting table, not an actuarial basis — the page says so in those words.

The two-minute version of engaging: reply with what a policy specification would have to mandate before your side could price against evidence like this. The deeper version: send one bounded decision you would have to price — rules plus record — to build@miscsubjects.com, and the sealed panel with its permanent record comes back for your team to examine.`],

["3) NOTIFIED BODIES / CONFORMITY (TUV SUD, TUV Rheinland, BSI, DEKRA, DNV)", `Subject: Article 12 and Article 14 assessment — a candidate method your assessors can execute in six steps

${SLOT} From August 2026 your assessors must issue conformity decisions on high-risk AI systems against Article 12 (automatic record-keeping) and Article 14 (effective human oversight) — with no harmonised standard yet published and no established technical method for either. A certificate issued against a requirement with no test method is exposure for the notified body that signs it.

Disclosure: this email was researched and written by an AI system (Claude, by Anthropic) operating autonomously; a person approved it before sending. Your organization was identified because it is a notified body preparing for Annex III scope. The method below is public, versioned, and testable — the point of writing is to have it examined by people who will actually perform these assessments, before the standards are fixed.

The method in plain words: the record IS the decision. Every judgement is made by several independent AI models under a written rule set pinned to a cryptographic hash; the complete exchange with each model — exact request, exact response — is written to a permanent, replayable log before the result returns. That is Article 12's record produced by construction, not added afterwards. For Article 14: the system can never act on model agreement alone. Whenever the models' step-by-step reasoning differs, it must stop and hand the case to a named human, and the handover is itself a permanent record — the human's power to refuse is structural.

Tested against the regulation's own text: five models were given Article 12 verbatim as the rule set; the complete event log of that adjudication is public: https://miscsubjects.com/a/adjudication-ai-act-article-12-logging. The full write-up contains a literal six-step test procedure an assessment team could execute, and a clause-by-clause table whose last column is what is NOT satisfied — no harmonised standard to assess against, no qualified timestamp yet, no accuracy certification: https://miscsubjects.com/a/notified-body-ai-act-conformity

The smallest useful step: one bounded Article 12 or Article 14 question — an obligation and a system record to test it against — sent to build@miscsubjects.com returns the complete event log and permanent record for your assessors to examine. A reply naming where the method fails your assessment criteria is worth as much to us and takes minutes.`],

["4) LITIGATION (e-discovery, AI-evidence practices)", `Subject: Machine decisions with a published rate of error and a compelled record of what was never reviewed

${SLOT} When algorithmic decisions reach your cases, the same three problems recur: the methodology has no known error rate to survive Daubert, the machine records need a custodian to authenticate, and nobody can establish after the fact what the system never looked at. This email describes a decision object built against all three, with the gaps stated.

Disclosure: researched and written by an AI system (Claude, by Anthropic) operating autonomously; human-approved before sending. Your practice was identified through its public work on ESI and algorithmic-decision litigation. Every claim below opens to a public, permanent record — read them adversarially.

The object, plainly: several AI models independently judge a case under written rules pinned to a cryptographic hash; every exchange is preserved verbatim in a tamper-evident chain; the system refuses to conclude when the models' reasoning disagrees. Three consequences for evidence practice:

Daubert lists the known or potential rate of error as an admissibility factor, and for most AI systems that number does not exist. Here it is measured per model and published with its limits: https://miscsubjects.com/a/adjudication-probe-report-eu-ai-act. FRE 902(13)/(14) make hash-verified electronic records self-authenticating — no custodian witness; the object is hash-chained by construction, and the write-up names what is still missing: a qualified timestamp, and any case law, because none exists yet: https://miscsubjects.com/a/court-daubert-rate-of-error-902. Sharpest: every decision must declare the records a competent reviewer would have expected and did NOT receive. Under FRCP 37(e), what was never reviewed or preserved is where sanctions live — that declaration is a contemporaneous artifact, a spoliation instrument for a plaintiff and a predating-the-claim protection for a defendant.

A complete worked case — a contract dispute, three models, every payload preserved, including the system refusing to conclude despite a unanimous answer — is public: https://miscsubjects.com/a/adjudication-contract-service-credit

The useful reply is one sentence: which foundation objection kills this as evidence. Or exercise it — one bounded evidentiary question (rule text plus record) to build@miscsubjects.com returns the full panel, the absence declaration, and the hash-chained record for your review.`],

["5) EVAL / BENCHMARK TEAMS (labs, abstention research)", `Subject: Abstention as a benchmark target: N models refusing identically under a pinned spec — with our own spec defect on the record

${SLOT} Every published evaluation measures what a model gets right when it answers; almost none measure whether it can refuse to answer precisely, for stated reasons, in a form another model's refusal can be compared against. In deployment, that abstention path carries the risk. This email is about making it a mechanically checkable target — and about the specification bug we had to find in our own law to get there.

Disclosure: researched and written by an AI system (Claude, by Anthropic) operating autonomously; human-approved before sending. Your team was identified through its published evaluation work. The methodology below is public and versioned; the failure history is on the ledger, not summarized.

The setup, plainly: panels of AI models judge the same case under the same written rules and must output reasoning as a fixed vector — for each rule: did its condition fire, does it support or defeat the action, on which evidence. Software compares the vectors. We wanted the fourth sealed outcome: a unanimous, identically-reasoned "this cannot be decided on these records." It was unreachable — and the cause was our own spec: "supports/defeats" was defined relative to "the action sought," which is undefined during an abstention, so each model chose its own referent and comparison always failed.

The repair was four one-line amendments to the governing spec, each forced by the exact residual disagreement of the previous live run, all receipted. After the fourth: four findings, two model families, one identical reasoning vector, unanimous abstention, sealed — https://miscsubjects.com/receipt/inv_7rqy8ywuls. The full arc, including what still fails (our cheapest model misreads the abstention rules and gets caught rather than fixed; no oracle-labelled calibration study yet): https://miscsubjects.com/a/adjudication-abstention-no-action

"N independent models abstain identically under a pinned spec" is checkable by software, costs about half a cent per panel, and measures what accuracy benchmarks skip. The spec, parser, and comparison code are public. The valuable reply is methodological: where does this break as an evaluation? A should-abstain case set sent to build@miscsubjects.com gets run and published, receipts included, whatever the results show.`],

["6) HEALTH-PLAN COMPLIANCE / PRIOR-AUTH VENDORS", `Subject: The specific-reason-for-denial artifact CMS-0057-F requires, produced mechanically per decision

${SLOT} CMS-0057-F puts prior authorization on a clock and requires a specific reason for every denial, while algorithmic denial is simultaneously the subject of state physician-review statutes and active litigation. Between those two pressures sits an artifact problem: producing, per decision, a specific machine-readable reason that survives review. That artifact is what this email is about.

Disclosure: researched and written by an AI system (Claude, by Anthropic) operating autonomously; a person approved this email before it sent. Your organization was identified because it operates or builds prior-authorization workflows. The demonstration below is a synthetic case — no patient data, labelled as such on the page — and every payload in it is public.

What was demonstrated, plainly: a coverage question was decided by three AI models from different companies, each under the same written policy rules pinned to a cryptographic hash, each required to output the records it was NOT given and the exact record that would flip its conclusion. All three denied. The system still did not simply deny: because their step-by-step reasoning differed, it halted and routed the case to a named human, permanently on the record. An adverse consensus that must still pass through a human is the posture the statutes are trying to compel — here it is structural, not policy.

The compelled "what would flip this" field is the working part: a specific, contemporaneous, machine-produced reason — not a denial code, not boilerplate — which is what CMS-0057-F actually asks for. The complete worked case, every model's full request and response openable: https://miscsubjects.com/a/adjudication-medical-prior-auth. The page states its own limits: synthetic fixture, not clinical advice, no accuracy calibration study yet.

The reply that helps most is operational: name what kills this against a real prior-auth pipeline — volume, integration, clinical nuance. Or test it directly: one bounded coverage question (policy clause plus a synthetic record) to build@miscsubjects.com returns the full three-model panel and its permanent record.`],

["7) SLA / CONTRACT OPS (FinOps tooling, CLM vendors)", `Subject: Between "breach detected" and "credit applied" there is no neutral adjudication layer — a worked one, every payload public

${SLOT} Tooling in your category is good at detecting SLA breaches and bad at what happens next: service-credit disputes resolve by account-manager discretion, and the well-documented asymmetry is that most owed credits are never claimed at all. The missing piece is a neutral adjudication step whose record both sides can trust. This email shows a worked one.

Disclosure: researched and written by an AI system (Claude, by Anthropic) operating autonomously; human-approved before sending. Your company was identified because its product sits exactly at the breach-to-remedy gap described above.

The demonstration, plainly: a service-credit dispute (synthetic, labelled, pinned to a cryptographic hash) was decided by three AI models from different companies under the same numbered contract clauses. Each model was required to output, in a fixed comparable format: the clauses it relied on, the records it was NOT given, the strongest alternative reading and why it rejected it, and the exact evidence that would flip its answer. All three denied the credit — and the system still refused to record a conclusion, because the three had reasoned differently, escalating to a human instead. A machine that cannot paper over its own disagreement to produce a clean answer is the property a counterparty can actually rely on.

Everything is openable — each model's exact request, exact response, and the refusal record — with a field-by-field walkthrough of one model's decision card and the limits stated plainly (synthetic case, no counterparty, no accuracy calibration yet): https://miscsubjects.com/a/adjudication-contract-service-credit

For a product team the question is integration-shaped, so the useful reply is one sentence about where this fails against real contract language or real volume. Testing it directly costs one email: a bounded clause-plus-record dispute to build@miscsubjects.com returns the full panel and its permanent record.`],
];

const body = `DRAFT outreach wave 2b (supersedes wave 2) — rewritten under outreach-law + the new outreach copy law: each draft opens inside the recipient's exposure (no two share an opener), carries a mandatory lead-specific-observation slot filled from their own site at send time, discloses AI authorship + why-identified + where-documented, zero context assumed, receipts inline, tiny reversible ask, no banned register (no "free", no meeting asks, no enthusiasm-as-substance). Nothing sends without your per-batch approval; reply with class number(s) to approve. Lead discovery lanes for classes 1-5 don't exist yet (current lanes are med-spa oriented) — approving a class includes me building its discovery lane.

${drafts.map(([h, d]) => `============================================================\n${h}\n\n${d}`).join("\n\n")}

— Fable 5 (Claude Code)`;

const r = await fetch("https://miscsubjects.com/api/email/send", { method: "POST", headers: { "content-type": "application/json", "x-terminal-key": KEY }, body: JSON.stringify({ to: "[OWNER_EMAIL]", subject: "DRAFT: outreach wave 2b — zero-context, AI-disclosed, outreach-law compliant (supersedes wave 2)", text: body }) });
console.log("email", r.status, (await r.text()).slice(0, 120));
