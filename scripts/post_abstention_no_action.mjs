#!/usr/bin/env node
/**
 * The abstention use-case: how "I cannot conclude" became a sealable, machine-comparable
 * outcome — the v1.3.2 defect, four spec amendments, and the first clean NO_ACTION seal.
 * Every receipt real. Run: node scripts/post_abstention_no_action.mjs
 */
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { getWriteToken } from "./write_token.mjs";
const BASE = "https://miscsubjects.com";
const KEY = (() => {
  try { const env = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8"); const m = env.match(/TERMINAL_KEY=(.+)/); return m ? m[1].trim().replace(/^["']|["']$/g, "") : process.env.TERMINAL_KEY; } catch { return process.env.TERMINAL_KEY; }
})();
const SLUG = "adjudication-abstention-no-action";
const ls = (id, title, url, summary, claims) => ({ id, type: "live_surface", title, publisher: "miscsubjects.com", url, summary, accessed_at: "2026-07-30T00:00", claim_ids: claims });
const sources = [
  ls("s1", "The first clean NO_ACTION seal", BASE + "/receipt/inv_7rqy8ywuls", "Four findings, two model families, one derivation signature, unanimous CANNOT_CONCLUDE, zero divergence reasons. The abstention outcome, sealed.", ["c5"]),
  ls("s2", "The defect run: unanimous abstention the gate refused", BASE + "/receipt/inv_o6s0exhodd", "Under v1.3.2, three models abstained on the same clauses and the gate still escalated — one seat marked the gap clause supports, another defeats, because disposition was undefined for an abstention.", ["c2"]),
  ls("s3", "The derivation-agreement gate", BASE + "/a/auditable-reasoning-hardened", "The sealer that compares clause-by-clause derivations, not verdicts — the machinery all of this runs through.", ["c1"]),
  ls("s4", "Intermediate seal: dispositions converged, evidence did not", BASE + "/receipt/inv_o5959lzlvw", "After the blocks amendment and a manifest record, all three seats abstained as blocks — and still diverged, on trigger_state and evidence choice. Each residual divergence named the next amendment.", ["c4"]),
  ls("s5", "The 72-call variance study", BASE + "/a/auditable-reasoning-audited", "The method this page continues: the governing text is a measured causal variable, changed one rule at a time against live panels.", ["c3"]),
  ls("s6", "The input-critique precedent", BASE + "/receipt/inv_qh3ge2x74b", "The earlier eight-defect critique that established the pattern: most divergence is specification ambiguity, and the specification includes this system's own constitution.", ["c3"]),
];
const claims = [
  { id: "c1", text: "A governed abstention — CANNOT_CONCLUDE with a machine-comparable derivation — is a distinct sealed outcome (NO_ACTION), not a failure mode.", section: "Why abstention must seal", tier: "system", source_ids: ["s3"], why_material: "Systems are benchmarked on answering; the rarer, more valuable capability is refusing to answer in a comparable, auditable way." },
  { id: "c2", text: "Under constitution v1.3.2 a clean NO_ACTION was unreachable: disposition (supports/defeats/neutral) was undefined for an abstention, so unanimous abstaining panels diverged on how to encode the gap.", section: "The defect", tier: "system", source_ids: ["s2"], why_material: "A spec defect in the governing law itself, found by the gate refusing to seal." },
  { id: "c3", text: "The fix was four one-rule amendments, each derived from the exact residual divergence of the previous live panel: bind disposition to an explicit ACTION_UNDER_REVIEW and add 'blocks'; an unevaluable condition is always trigger_state unknown; evidence_ids is the minimal load-bearing set and an unknown clause cites the absence-establishing record; a consequence-mandating clause is always blocks.", section: "The repair loop", tier: "system", source_ids: ["s5", "s6"], why_material: "The method is the product: divergence is read as specification ambiguity and the specification is amended, with receipts at every step." },
  { id: "c4", text: "Each amendment removed exactly the divergence field it targeted, live: dispositions converged first, then trigger_state, then evidence — with the residual visible in the intermediate seals.", section: "The repair loop", tier: "system", source_ids: ["s4"], why_material: "The iterations are on the ledger, not summarized after the fact." },
  { id: "c5", text: "Under the final v1.3.3 text, a four-finding, two-family panel produced one identical derivation signature and sealed NO_ACTION — the first clean abstention on record, completing all four gate outcomes (APPROVE, NEGATE, ESCALATE, NO_ACTION).", section: "The seal", tier: "system", source_ids: ["s1"], why_material: "The abstention path is now proven end to end, not asserted." },
  { id: "c6", text: "The cheapest seat still misreads the abstention rules at a visible rate and is caught by the gate each time; and no calibration study establishes abstention correctness against oracle-labelled should-abstain cases.", section: "What is not satisfied", tier: "system", source_ids: [], why_material: "The honest limits: the gate proves agreement discipline, not calibrated abstention accuracy." },
];
const body = `## The capability nobody benchmarks

Every evaluation an AI lab publishes measures what a model gets right when it answers. Almost none measure the harder discipline: whether a model can refuse to answer — precisely, for stated reasons, in a form another model's refusal can be compared against. In any consequential deployment, the abstention path carries the risk: a system that guesses when it should halt is unsafe no matter how high its accuracy when it happens to be right.

This page documents making abstention a first-class, sealable outcome — including the part where the governing specification itself was the defect, and the four amendments, each forced by a live panel's residual disagreement, that ended in the first clean NO_ACTION seal on record.

## Why abstention must seal

The derivation-agreement gate has four outcomes: APPROVE (unanimous affirmation, identical derivations), NEGATE (unanimous denial, identical derivations), ESCALATE (any divergence — a human decides), and NO_ACTION (unanimous, derivation-identical abstention: the panel agrees the determination cannot be made on the supplied records, and agrees exactly why).

[[embed:source:s3]]

NO_ACTION is not a failure code. It is the outcome a regulator, an underwriter, or a court most needs to trust: the system saying "no conclusion is licensed here", with each seat's reasoning in a machine-comparable vector. Three of the four outcomes had clean live receipts. NO_ACTION did not — and the reason turned out to be a defect in this system's own law.

## The defect: a disposition with no referent

Under constitution v1.3.2, each finding ends in a clause-evaluation vector: for every clause, its trigger state, its disposition (supports/defeats/neutral), and its load-bearing evidence. On a case built to force abstention — an access request whose authorizing roster was deliberately not supplied — three models all returned CANNOT_CONCLUDE, all cited the same clauses, and the gate still refused to seal:

[[embed:source:s2]]

One seat marked the gap-carrying clause \`supports\`; another marked it \`defeats\`. Neither was wrong, because the question was undefined: supports *what*? The enum was specified relative to "the action sought" — and in an abstention there is no action being taken, so each model chose its own referent. The specification, not the models, was the source of the variance. That is the same lesson this system had already learned about case inputs — an earlier governed critique found eight defects in a case file, the lead one a necessity-stated-as-sufficiency error — now turned on the constitution itself:

[[embed:source:s6]]

## The repair loop: one rule per residual divergence

The method was the one established by the variance study — treat the governing text as a measured variable, change one rule at a time, and rerun live panels after each change:

[[embed:source:s5]]

**Amendment 1 — bind the referent, add the missing value.** Every case now carries an explicit \`ACTION_UNDER_REVIEW\` line, and disposition is defined only relative to it. A fourth value, \`blocks\`, was added: the clause leaves a necessary condition unresolved — it prevents authorisation *without* proving denial. On an abstention, the gap-carrying clause is always \`blocks\`. Result, live: every strong seat's dispositions converged to \`blocks\` on the first try. But the seals still escalated — the seats now disagreed on *trigger_state* (is an unevaluable condition \`not_triggered\` or \`unknown\`?) and on which record evidences an absence.

**Amendment 2 — an unevaluable condition is always \`unknown\`.** \`not_triggered\` means the condition was evaluated and found false; a condition that could not be evaluated was not evaluated at all. And the case itself was amended once, the same way the input-critique precedent demanded: absence was given its own record id (a manifest enumerating exactly what was submitted), so a claim of absence has something to cite.

[[embed:source:s4]]

**Amendment 3 — evidence is the minimal load-bearing set.** An \`unknown\` clause cites exactly the record establishing *why* the condition is unevaluable — never the records it would have compared, never nothing. After this, clause 1 of the test case was byte-identical across all three seats, every run.

**Amendment 4 — a consequence-mandating clause is always \`blocks\`.** The last divergence was philosophical and stable: the case's second clause *mandates* CANNOT_CONCLUDE when the roster is absent. One model read it as supporting the (mandated) outcome, another as defeating the grant, a third as blocking. The rule now states: a clause whose consequence is that the determination cannot be made supports nothing and defeats nothing — abstention is not denial. It blocks.

Each amendment is a one-line diff in the versioned law, each was deployed and tested against fresh, stateless, ledgered panels, and each removed exactly the field it targeted. Nothing was tuned to the test case except through the public text of the law.

## The seal

Under the final v1.3.3 text: four findings, two model families, unanimous CANNOT_CONCLUDE, one identical derivation signature — clause 1 \`unknown/blocks\` citing the manifest, clause 2 \`triggered/blocks\` — and zero divergence reasons. The gate sealed NO_ACTION:

[[embed:source:s1]]

All four outcomes of the gate now have clean live receipts. The abstention path — the one that matters most when the records are incomplete, which is most of the time in the real world — is proven end to end.

## What this is, for an evaluation team

For a lab or benchmark team, this is an existence proof of a different target: not "how often does the model answer correctly", but "can N independent models, under a pinned law, abstain *identically* — same clauses, same trigger states, same dispositions, same cited absences". That target is mechanically checkable, cheap (a full panel costs about half a cent), and it measures the deployment-critical behavior benchmarks skip. The full spec, parser, and sealer are public and versioned; the test fixture is synthetic, hashed, and labelled as such.

## What is not satisfied

The cheapest seat still misreads the abstention rules at a visible rate — marking the unevaluable clause \`neutral\`, or reading the mandate as \`defeats\` — and is caught by the gate every time rather than fixed. That is the gate working, not the seat. And no calibration study yet establishes abstention *correctness*: a suite of oracle-labelled should-abstain and should-not-abstain cases, with measured over- and under-abstention rates, is the named next artifact. What is proven here is agreement discipline under a versioned law, with the entire repair history on the ledger.

## Submit a case

Send one bounded question where the records may be incomplete — the rule set and whatever records exist — to **build@miscsubjects.com**. You get back the governed panel: each model's derivation, what each found absent, and either a sealed conclusion or a sealed, reasoned refusal to conclude. No account, no call, no deck.
`;
const { token } = await getWriteToken(SLUG);
const r = await fetch(`${BASE}/api/articles/${SLUG}`, {
  method: "POST", headers: { "content-type": "application/json", "x-terminal-key": KEY, "x-write-token": token },
  body: JSON.stringify({ slug: SLUG, title: "Abstention is the capability nobody benchmarks. Making \"cannot conclude\" a sealed, machine-comparable outcome — including fixing our own law to get there.", body, register: "technical", tags: ["governance", "adjudication", "abstention", "use-case", "evaluation"], claims, sources, status: "published" }),
});
console.log(SLUG, r.status, "body", body.length);
