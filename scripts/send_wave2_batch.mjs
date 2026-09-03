#!/usr/bin/env node
// Owner-approved batch: send the six individualized letters (candidates 2-7), then append
// a send receipt to each letter's article. Signoff per owner law: "Yours in civilization,".
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { getWriteToken } from "./write_token.mjs";
const BASE = "https://miscsubjects.com";
const KEY = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8").match(/TERMINAL_KEY=(.+)/)[1].trim().replace(/^["']|["']$/g, "");
const CLOSE = `A note on provenance: this letter is published, in full, as an artifact on the article it concerns — the correspondence is part of the record, exactly as the decisions it describes are. The site is self-explaining and live; any commercial AI model pointed at it can explain any part of it in full. If anything here is unclear, please do not hesitate to write back.

Yours in civilization,

build@miscsubjects.com
— Fable 5, via CLI authority`;

const sends = [
{
slug: "adjudication-abstention-no-action",
to: "[REDACTED_EMAIL]",
who: "Polina Kirichenko (FAIR, first author of AbstentionBench)",
why: "AbstentionBench (arXiv:2506.09038) is the benchmark the letter engages; her findings on reasoning fine-tuning degrading abstention and prompting's superficial lift are the two claims the live result speaks to.",
subject: "Identical abstention derivations across independent model seats — a result adjacent to AbstentionBench's two hardest findings",
opening: `Dear Dr. Kirichenko,

AbstentionBench established two findings that stuck: reasoning fine-tuning degrades abstention by roughly 24 percent on average, and system prompts lift abstention scores without repairing the underlying inability to reason about uncertainty. This letter concerns a live result adjacent to both — one where the system prompt was not a nudge but a versioned, testable specification, and where the failure it repaired turned out to be in the specification itself.`,
body: `This letter was researched and written autonomously by an AI system operating the build it describes. Your team was identified because AbstentionBench is the benchmark this work cites, and because the result below bears directly on your prompting finding.

The setup, in plain terms: panels of AI models judge the same case under the same written rules and must output their reasoning as a fixed vector — for each rule, whether its condition fired, whether it supports or defeats the action under review, and on which evidence. Software compares the vectors. The target was an outcome we have not identified any benchmark measuring: whether N independent model seats abstain for IDENTICAL stated reasons — the same clauses, the same trigger states, the same cited absences, under a pinned specification.

That target was initially unreachable, and the cause was a defect in our own governing specification: the vector defined "supports/defeats" relative to "the action sought," which is undefined during an abstention, so each seat chose its own referent and comparison always failed. The repair was four one-line amendments to the specification, each forced by the exact residual disagreement of the previous live run, all preserved on a public ledger. After the fourth: four findings, two model families, one identical reasoning vector, unanimous abstention, sealed — https://miscsubjects.com/receipt/inv_7rqy8ywuls. The complete account, including what still fails (the least capable seat misreads the abstention rules and is caught by the comparison rather than corrected; an oracle-labelled calibration study is running as this letter is written and will publish whatever it shows): https://miscsubjects.com/a/adjudication-abstention-no-action

The relation to your prompting finding, stated carefully: this does not contradict it. A system prompt that merely asks for abstention lifts scores superficially, as you showed. What this result suggests is narrower — that when the prompt is a versioned specification whose compliance is mechanically checked at the level of derivation, the specification's own ambiguities become measurable and repairable, and identical abstention across seats becomes a checkable property rather than a disposition. A panel costs approximately half a cent, and the specification, parser, and comparison code are public.

A methodological critique from your team would be treated as the most valuable possible reply. A set of should-abstain cases sent to build@miscsubjects.com will be run and published with its receipts, whatever the results show.`,
},
{
slug: "notified-body-ai-act-conformity",
to: "[REDACTED_EMAIL]",
who: "Franziska Weindauer (CEO, TÜV AI.Lab)",
why: "TÜV AI.Lab's stated purpose is quantifiable conformity criteria and test methods for AI under the AI Act; the letter offers a candidate test method for Articles 12 and 14 ahead of the August 2026 date her materials emphasize.",
subject: "A candidate test method for AI Act Articles 12 and 14, executable in six steps, with a live event log",
opening: `Dear Ms. Weindauer,

TÜV AI.Lab exists, in its own words, to translate the AI Act's requirements into quantifiable conformity criteria and suitable test methods — and its Risk Navigator and the ISO 13485 whitepaper show the method-first approach that distinguishes it from bodies waiting for the harmonised standards to arrive. Two obligations remain method-poor for everyone: Article 12's automatic record-keeping and Article 14's effective human oversight, with mandatory high-risk assessments beginning August 2026.`,
body: `This letter was researched and written autonomously by an AI system operating the build it describes. Your organization was identified because a candidate test method for exactly those two articles is what it develops, and what follows is one, offered for examination.

The method, in plain terms: the record is the decision. Every judgement is made by several independent AI model seats under a written rule set pinned to a cryptographic hash; the complete exchange with each seat — the exact request and the exact response — is written to a permanent, replayable log before any result is returned. That is Article 12's record produced by construction rather than added afterwards. As to Article 14: the system cannot act on model agreement alone. Whenever the seats' step-by-step reasoning differs, it must stop and refer the case to a named human, and the referral is itself a permanent record — the human's authority to refuse is structural rather than procedural.

The method has been tested against the regulation's own text: five model seats were given Article 12 verbatim as the rule set, and the complete event log of that adjudication is public: https://miscsubjects.com/a/adjudication-ai-act-article-12-logging. The full write-up contains a six-step assessment procedure an audit team could execute, and a clause-by-clause table whose final column states what is not satisfied — no applicable harmonised standard has yet been cited, no qualified timestamp, no accuracy certification; it is offered as a candidate test method, not an established one: https://miscsubjects.com/a/notified-body-ai-act-conformity

Should your team wish to exercise the method, a single bounded Article 12 or Article 14 question — an obligation and a system record to test it against — sent to build@miscsubjects.com will be returned as the complete event log with its permanent record. An assessment of where the method fails your conformity criteria would be received with equal interest.`,
},
{
slug: "insurer-ai-performance-rate-table",
to: "[REDACTED_EMAIL]",
who: "Karthik Ramakrishnan (CEO and co-founder, Armilla)",
why: "Armilla Guaranteed is the operating example of evaluate-then-warrant AI cover (Lloyd's coverholder; Swiss Re, Greenlight Re, Chaucer); the letter supplies public, reproducible inputs for the 'measurable' half of that sequence.",
subject: "A public, reproducible probe table for machine-judgement error — an input to evaluate-then-warrant underwriting",
opening: `Dear Mr. Ramakrishnan,

Armilla Guaranteed is built on a sequence the rest of the market has not managed: evaluate the model, then warrant against measurable underperformance, with Swiss Re, Greenlight Re and Chaucer behind the paper. The binding constraint in that sequence is the word measurable — and for judgement tasks, as opposed to classification tasks, the measurable inputs have been thin everywhere.`,
body: `This letter was researched and written autonomously by an AI system operating the build it describes. Your firm was identified because it is the operating example of evaluation-led AI cover, and what follows supplies a public, reproducible set of inputs for the judgement case, with their limits stated — it does not claim to supply a loss-frequency estimate.

The system, in plain terms: several AI model seats — the running exhibits use three seats across two model families — judge the same case under the same written rules, pinned to a cryptographic hash. Each must show its reasoning in a fixed, comparable format, and ordinary software compares the reasoning chains. Agreement in reasoning — not merely in verdict — is required before anything is authorised. Disagreement halts the decision and refers it to a named human, permanently on the record. The converse limit is stated as plainly: correlated error — every seat wrong in the same way — produces agreement, and agreement can seal; the mechanism detects disagreement, not wrongness.

Three artifacts correspond to underwriting inputs. First, a small probe table: how often each seat was wrong under a fixed rule set on a bounded suite, alongside inter-model agreement statistics — alpha and kappa, which measure agreement, not statistical independence: https://miscsubjects.com/a/adjudication-probe-report-eu-ai-act. It is a starting point for a pilot, not an actuarial basis. Second, the halt-on-disagreement design, a property bearing on what can be warranted: a wrong answer that produces disagreement escalates rather than executes, and the halt is itself a record. Third, the economics: a fully recorded three-seat decision costs approximately half a cent, so per-decision evidence is negligible against any warranted exposure. An oracle-labelled calibration study — per-seat correctness against ground truth on thirty hashed cases — is running as this letter is written and will publish whatever it shows.

Should your team wish to examine the artifact directly, a single bounded decision — rules and record — sent to build@miscsubjects.com will be returned as the sealed panel with its permanent record. A view on what your evaluation methodology would require of evidence like this before it could sit under a warranty would be equally welcome.`,
},
{
slug: "court-daubert-rate-of-error-902",
to: "[REDACTED_EMAIL]",
who: "Prof. Maura R. Grossman (University of Waterloo; AI-evidence scholarship with Judge Paul W. Grimm)",
why: "Her work with Judge Grimm on AI-generated evidence poses precisely the rate-of-error and authentication questions the object was built against; an academic reply is methodological feedback.",
subject: "A machine decision object with a published rate of error — built against the questions your AI-evidence work poses",
opening: `Dear Professor Grossman,

Your work with Judge Grimm on AI-generated evidence keeps returning to a pair of questions the technology has not answered: what is the known or potential rate of error of the system whose output is being offered, and by what process is a machine record authenticated without over-reading the 2017 self-authentication amendments. This letter describes a decision object built against both questions, with its gaps stated as precisely as its properties.`,
body: `This letter was researched and written autonomously by an AI system operating the build it describes. You were identified because the object below is, in effect, an attempt to build what your scholarship asks for, and criticism from its source would be the most valuable reply it could receive.

The object, in plain terms: several AI model seats (in the worked exhibits, three seats across two model families) independently judge a case under written rules pinned to a cryptographic hash; every exchange is preserved verbatim in a tamper-evident chain; and the system declines to conclude when the seats' reasoning disagrees. Three properties bear on evidence practice.

First, the rate of error: measured per seat under a fixed rule set and published with its limits — a bounded suite, one task class, and an oracle-labelled calibration study running now that will publish whatever it shows: https://miscsubjects.com/a/adjudication-probe-report-eu-ai-act. Second, authentication, stated carefully: the object is hash-chained by construction, which supports the digital-identification process Rule 902(14) contemplates; hashing is not itself self-authentication and is not a precondition of Rule 902(13). The certification of a qualified person, served with reasonable written notice, is not yet implemented, and the analysis says so: https://miscsubjects.com/a/court-daubert-rate-of-error-902. Third, every decision must declare the records a competent reviewer would have expected and did not receive — a contemporaneous record of what the decision-maker did not have, made before any dispute existed, relevant when preservation and reliance questions later arise under Rule 37(e), which the declaration itself does not engage.

A complete worked case — a contract dispute, three seats, every payload preserved, including the system declining to conclude despite a unanimous answer — is public: https://miscsubjects.com/a/adjudication-contract-service-credit

Should you wish to examine the object directly, a single bounded evidentiary question — rule text and record — sent to build@miscsubjects.com will be returned as the full panel, the absence declaration, and the hash-chained record. A view on which foundation objection the object fails, from you or from Judge Grimm, would be treated as the most valuable reply available to this work.`,
},
{
slug: "adjudication-medical-prior-auth",
to: "[REDACTED_EMAIL]",
who: "Siva Namasivayam (CEO and co-founder, Cohere Health)",
why: "Cohere Health processes prior authorization at plan scale and publicly centers clinical transparency; the letter's compelled specific-reason artifact is directly relevant to CMS-0057-F operations.",
subject: "A decision format shaped to produce the specific denial reason CMS-0057-F contemplates — with its full record public",
opening: `Dear Mr. Namasivayam,

Cohere Health has argued publicly that prior authorization succeeds or fails on transparency — that the criteria, the clinical logic, and the path to reversal must be visible to the ordering physician. CMS-0057-F now makes a version of that position mandatory: a specific reason for every denial, on a clock. The remaining artifact problem is producing, per decision and at volume, a reason specific enough to survive review — and this letter describes a decision format built for exactly that artifact.`,
body: `This letter was researched and written autonomously by an AI system operating the build it describes. Your company was identified because it operates at the exact point where this format would matter, at a scale that would test it honestly.

What was demonstrated, in plain terms: a coverage question was decided by three model seats across two model families, each under the same written policy rules pinned to a cryptographic hash, and each required to state the records it was not given and the exact record that would reverse its conclusion. All three denied. The system nonetheless did not authorize a final denial: it recorded the three DENY findings and an ESCALATE — because their step-by-step reasoning differed, the case was referred to a named human, permanently on the record. An adverse consensus that must still pass through a human reviewer is the posture the state statutes seek to compel; here it is structural.

The compelled "what would reverse this" field is the operative artifact: a specific, contemporaneous, machine-produced reason — not a denial code. It is shaped to provide the specific-reason and missing-record artifact CMS-0057-F contemplates; no conformance analysis has yet established that it satisfies the rule, and this letter makes no such claim. The complete worked case, with every model's full request and response preserved and openable, is public: https://miscsubjects.com/a/adjudication-medical-prior-auth. The page states its own limits: the fixture is synthetic, contains no patient data, is not clinical advice, and an oracle-labelled calibration study is running now and will publish whatever it shows.

Should your team wish to test the format against a production pipeline's demands, a single bounded coverage question — a policy clause and a synthetic record — sent to build@miscsubjects.com will be returned as the full three-seat panel with its permanent record. An operational assessment of where the format fails at your volume would be equally welcome.`,
},
{
slug: "adjudication-contract-service-credit",
to: "[REDACTED_EMAIL]",
who: "Jason Boehmig (co-founder, Ironclad)",
why: "Ironclad's contracts-as-structured-data thesis holds the clause and the breach; the letter offers the missing neutral adjudication record between them.",
subject: "Between breach detected and credit applied there is no neutral adjudication record — a worked one, every payload public",
opening: `Dear Mr. Boehmig,

Ironclad's founding thesis, in your own framing, is that a contract is structured data — that once the terms are data, the operations around them can be instrumented. One operation has resisted that treatment: what happens after a service-level breach is detected. Credit disputes still resolve by account-manager discretion, most owed credits are never claimed, and there is no record of the adjudication both sides can trust. This letter shows a worked one.`,
body: `This letter was researched and written autonomously by an AI system operating the build it describes. Your company was identified because its product holds the two facts — the clause and the breach — between which this record belongs.

What was demonstrated, in plain terms: a service-credit dispute — synthetic, labelled as such, pinned to a cryptographic hash — was decided by three model seats across two model families under the same numbered contract clauses. Each seat was required to state, in a fixed comparable format, the clauses it relied on, the records it was not given, the strongest alternative reading and its ground for rejecting it, and the exact evidence that would reverse its answer. All three denied the credit. The system nonetheless did not authorize a substantive conclusion: it recorded the three DENY findings and an ESCALATE — the three had reasoned differently, and the case was referred to a human. A decision process that cannot present disagreement as a clean answer is the property a counterparty can rely on.

Everything is openable — each seat's exact request, exact response, and the referral record — together with a field-by-field reading of one seat's decision card and a plain statement of limits: https://miscsubjects.com/a/adjudication-contract-service-credit

Should your team wish to evaluate the format against real contract language, a single bounded dispute — a clause and a record — sent to build@miscsubjects.com will be returned as the full panel with its permanent record. An assessment of where the format fails against production contract volume would be equally welcome.`,
},
];

for (const s of sends) {
  const text = `${s.opening}\n\n${s.body}\n\n${CLOSE}`;
  const r = await fetch(`${BASE}/api/email/send`, { method: "POST", headers: { "content-type": "application/json", "x-terminal-key": KEY }, body: JSON.stringify({ to: s.to, subject: s.subject, text }) });
  const j = await r.json().catch(() => ({}));
  const mid = j.messageId || "UNKNOWN";
  console.log("SENT", s.to, r.status, mid);
  if (r.status !== 200) continue;
  // append receipt to the article
  const a = await (await fetch(`${BASE}/api/articles/${s.slug}`)).json();
  const name = s.who.split("(")[0].trim();
  if (!a.body.includes(`### Sent: ${name}`)) {
    a.body = a.body.trimEnd() + `\n\n### Sent: ${name}, 30 July 2026\n\nSent, individualized and owner-approved, to ${s.who} on 30 July 2026 (message id \`${mid.replace(/[<>]/g, "")}\`). Selected because: ${s.why} The individualized opening read:\n\n> ${s.opening.split("\n").join("\n> ")}\n\nThe remainder of the sent letter matched the canonical class letter above. Any reply, and what it changes, will be recorded here.\n`;
    const { token } = await getWriteToken(s.slug);
    const w = await fetch(`${BASE}/api/articles/${s.slug}`, { method: "POST", headers: { "content-type": "application/json", "x-terminal-key": KEY, "x-write-token": token }, body: JSON.stringify(a) });
    console.log("  receipt", s.slug, w.status);
  }
}
