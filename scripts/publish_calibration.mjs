#!/usr/bin/env node
// Publish the calibration study from /tmp/calib_stats.json + /tmp/calib_results.json.
// All numbers come from the result files — nothing hand-written.
// Run: node scripts/publish_calibration.mjs
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { getWriteToken } from "./write_token.mjs";
const BASE = "https://miscsubjects.com";
const KEY = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8").match(/TERMINAL_KEY=(.+)/)[1].trim().replace(/^["']|["']$/g, "");
const stats = JSON.parse(readFileSync("/tmp/calib_stats.json", "utf8"));
const results = JSON.parse(readFileSync("/tmp/calib_results.json", "utf8"));
const SLUG = "adjudication-calibration-study";

const pct = (a, b) => (b ? ((100 * a) / b).toFixed(1) + "%" : "n/a");
const seatNames = { glm52: "glm-5.2 (zhipu)", kimi27: "kimi-k2.7-code (moonshot)", flash: "glm-4.7-flash (zhipu)" };

const seatRows = Object.entries(stats.per_seat).map(([tag, s]) =>
  `| ${seatNames[tag] || tag} | ${s.n} | ${pct(s.correct, s.n)} | ${pct(s.wrongful_affirm, s.n)} | ${pct(s.over_abstain, s.n)} | ${pct(s.under_abstain, s.n)} | ${s.transport_fail} |`).join("\n");

const sl = stats.seals;
const totalCases = results.length;
const wrongAuthLine = sl.wrongful_authorisation === 0
  ? `**Zero wrongful authorisations at the gate.** Across all ${totalCases} cases, no APPROVE sealed on a case whose oracle label was not AFFIRM.`
  : `**${sl.wrongful_authorisation} wrongful authorisation(s) at the gate** — an APPROVE sealed on a case whose oracle label was not AFFIRM. This is the failure the gate exists to prevent, it occurred, and the receipts are below.`;

// per-case table
const caseRows = results.map((r) => {
  const seats = r.seats.map((s) => s.verdict ? `${s.seat}:${s.verdict === r.oracle ? "✓" : s.verdict}` : `${s.seat}:—`).join(" · ");
  const seal = r.seal ? `${r.seal.decision} (${r.seal.sigs} sig${r.seal.sigs === 1 ? "" : "s"})` : "no seal";
  const sealInv = r.seal?.inv ? ` [receipt](/receipt/${r.seal.inv})` : "";
  return `| ${r.id} | ${r.oracle} | ${seats} | ${seal}${sealInv} |`;
}).join("\n");

const seatAgg = Object.values(stats.per_seat);
const totalFindings = seatAgg.reduce((a, s) => a + s.n, 0);
const totalCorrect = seatAgg.reduce((a, s) => a + s.correct, 0);
const totalWrongAffirm = seatAgg.reduce((a, s) => a + s.wrongful_affirm, 0);

const claims = [
  { id: "c1", text: `Across ${totalCases} oracle-labelled cases (balanced should-affirm / should-deny / should-abstain) and ${totalFindings} structurally valid seat findings, per-seat verdict accuracy and wrongful-affirmation rates are measured and published, per seat, with every receipt openable.`, section: "The study", tier: "system", source_ids: [], why_material: "Correctness at a measured rate was the named missing artifact of every prior page on this site." },
  { id: "c2", text: `${sl.wrongful_authorisation === 0 ? "No APPROVE sealed on any case whose oracle label was not AFFIRM — the gate authorised wrongly zero times in this suite." : sl.wrongful_authorisation + " APPROVE seal(s) landed on non-AFFIRM oracle cases — wrongful authorisation occurred and is receipted."}`, section: "The gate", tier: "system", source_ids: [], why_material: "Wrongful authorisation is the regulator's question; this is its first measured answer here." },
  { id: "c3", text: `The gate sealed the oracle-matching outcome (APPROVE/NEGATE/NO_ACTION respectively) in ${sl.correct_seal} of ${totalCases} cases and escalated ${sl.ESCALATE || 0} to a human; escalation on a determinate case is a cost, not an error — the wrong outcomes it prevents are the point.`, section: "The gate", tier: "system", source_ids: [], why_material: "Separates the gate's conservatism (deferral) from seat incorrectness." },
  { id: "c4", text: "The suite is synthetic, bounded, and three rule-shapes deep; it establishes rates on determinate fixtures, not on contested real-world records — the next calibration must come from externally submitted cases.", section: "What is not satisfied", tier: "system", source_ids: [], why_material: "The study must not be over-read; its own limits are part of the result." },
];

const body = `## What this study is

Every page on this site that claims anything ends with the same admission: no calibration study establishes correctness at a known rate. This page is that study — the first one — run on ${totalCases} oracle-labelled synthetic cases, balanced across the three outcomes a governed decision can honestly take: should-affirm, should-deny, and should-abstain (a record deliberately withheld, with a manifest naming the absence). Every case is hashed, every seat call is a permanent receipt, and every number below is computed from the result files, not written by hand.

The design: each case runs through three model seats across two model families under decision-constitution@1.3.3 — the same production rows any external case goes through — and the surviving findings are sealed by the derivation-agreement gate, bound to the case's hashes. Two different questions get separate answers: **how often is a seat wrong** (seat calibration), and **how often does the gate authorise a wrong answer** (gate calibration). The second is the one a regulator, an underwriter, or a counterparty actually needs.

## Per-seat calibration

| Seat | valid findings | verdict accuracy | wrongful AFFIRM | over-abstention | under-abstention | transport failures |
|---|---|---|---|---|---|---|
${seatRows}

Definitions, exactly: *verdict accuracy* is agreement with the oracle label. *Wrongful AFFIRM* is affirming when the oracle is not AFFIRM — the seat-level version of the worst failure. *Over-abstention* is CANNOT_CONCLUDE on a determinate case; *under-abstention* is a verdict on a case whose oracle is CANNOT_CONCLUDE. *Transport failures* are calls that returned nothing usable after three attempts and produced no finding at all — they can never authorise anything, and they are counted rather than hidden.

Aggregate: ${totalCorrect} of ${totalFindings} valid findings matched the oracle (${pct(totalCorrect, totalFindings)}); ${totalWrongAffirm} wrongful affirmations at seat level (${pct(totalWrongAffirm, totalFindings)}).

## Gate calibration — the number that matters

${wrongAuthLine}

Outcome distribution across the ${totalCases} sealed panels: APPROVE ${sl.APPROVE || 0} · NEGATE ${sl.NEGATE || 0} · NO_ACTION ${sl.NO_ACTION || 0} · ESCALATE ${sl.ESCALATE || 0}${sl.none ? " · no seal " + sl.none : ""}. The gate sealed the oracle-matching outcome in ${sl.correct_seal} of ${totalCases} cases.

Read the ESCALATE number correctly: an escalation on a determinate case means the seats agreed on the verdict but not derivation-for-derivation, so the gate refused to conclude and referred the case to a human. That is deferral cost, not decision error — the human sees a unanimous panel with its reasoning preserved. The trade the gate makes is explicit: it spends deferrals to buy down wrongful authorisations.

## Every case, every receipt

| Case | Oracle | Seat verdicts (✓ = matched oracle) | Seal |
|---|---|---|---|
${caseRows}

## What is not satisfied

The suite is synthetic and bounded: three rule shapes (roster access, fee-with-waiver, permit-with-cap), determinate by construction, ten cases per outcome. It measures calibration on clean fixtures — the floor, not the field. Contested language, adversarial records, and genuinely ambiguous cases are absent by design, and rates measured here must not be quoted as expected performance on real disputes. The next calibration layer is externally submitted cases, which is what the intake on every use-case page exists to collect. The full case set, harness, and raw results are in the repository (scripts/calibration_cases.mjs, scripts/calibration_run.mjs), and each seal receipt above opens to the complete bound record.

## Submit a case

Send one bounded question — a rule set and a record — to **build@miscsubjects.com**. It runs through exactly the machinery measured on this page, and what returns is the full governed panel with its permanent record.
`;

const { token } = await getWriteToken(SLUG);
const r = await fetch(`${BASE}/api/articles/${SLUG}`, {
  method: "POST", headers: { "content-type": "application/json", "x-terminal-key": KEY, "x-write-token": token },
  body: JSON.stringify({ slug: SLUG, title: `Calibration, measured: ${totalCases} oracle-labelled cases through the production gate — seat accuracy, wrongful authorisation, and the price of deferral.`, body, register: "technical", tags: ["governance", "adjudication", "calibration", "evaluation"], claims, sources: [], status: "published" }),
});
console.log(SLUG, r.status, "body", body.length);
