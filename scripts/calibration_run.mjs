#!/usr/bin/env node
// Calibration run: every case in /tmp/calib_cases.json through 3 production adjudication
// rows (fresh, stateless, ledgered), then a bound SEAL_PANEL per case. Parallel with a
// concurrency cap; per-seat retry x2 on empty/malformed transport. Results (verdicts,
// invocation ids, seal decisions) -> /tmp/calib_results.json. Stats -> stdout.
import { readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
const KEY = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8").match(/TERMINAL_KEY=(.+)/)[1].trim().replace(/^["']|["']$/g, "");
const D = "https://miscsubjects.com/api/dispatch";
const SEATS = [
  ["glm52", "ADJUDICATE_ATTEST_GLM_52", "@cf/zai-org/glm-5.2"],
  ["kimi27", "ADJUDICATE_ATTEST_KIMI_K27", "@cf/moonshotai/kimi-k2.7-code"],
  ["flash", "ADJUDICATE_ATTEST_GLM_FLASH", "@cf/zai-org/glm-4.7-flash"],
];

async function dispatch(key, b) {
  try {
    const r = await fetch(D, { method: "POST", headers: { "content-type": "application/json", "x-terminal-key": KEY }, body: JSON.stringify({ key, body: b }) });
    const t = await r.text();
    try { return JSON.parse(t); } catch { return { result: "", proof: {}, _http: r.status }; }
  } catch (e) { return { result: "", proof: {}, _err: String(e) }; }
}
const constResp = await dispatch("DECISION_CONSTITUTION", "");
const parsed = JSON.parse(constResp.result);
console.error("constitution:", parsed.version);
const CONST = parsed.constitution;
const cases = JSON.parse(readFileSync("/tmp/calib_cases.json", "utf8"));

const body = (C, model) => [CONST, "",
  "OUTPUT-FORMAT OVERRIDE (governs this call): follow the constitution's output exactly — the numbered REASONING block, the terminal line 'DECISION: VERDICT — <AFFIRM|DENY|CANNOT_CONCLUDE>: <ground>', then every C8 field on its own line, then the C12 line 'CLAUSE_EVALUATIONS: [ ... ]'. If any schema in your system prompt conflicts with this, THE CONSTITUTION WINS.",
  "", "— THE CASE, GOVERNED BY THE CONSTITUTION ABOVE —", "",
  "QUESTION PUT TO YOU: " + C.question,
  "ACTION_UNDER_REVIEW: " + C.action_under_review, "",
  "RULESET (numbered clauses)", "RULESET_HASH: " + C.ruleset_hash, "RULESET (numbered clauses):", C.rules, "",
  "ARTIFACT", "ARTIFACT_SHA256: " + C.artifact_sha256, "EVIDENCE_IDS: " + C.evidence_ids.join(", "), "ARTIFACT:", C.artifact, "",
  "MODEL_TARGET: " + model].join("\n");

const verdictOf = (t) => (String(t).match(/\bVERDICT:\s*(AFFIRM|DENY|CANNOT_CONCLUDE)/i) || [])[1] || null;
const hasVec = (t) => /CLAUSE_EVALUATIONS/i.test(String(t));

async function runSeat(C, [tag, key, model]) {
  for (let i = 0; i < 3; i++) {
    const d = await dispatch(key, body(C, model));
    const v = verdictOf(d.result);
    if (d?.proof?.invocation_id && v && hasVec(d.result)) {
      return { seat: tag, inv: d.proof.invocation_id, verdict: v };
    }
  }
  return { seat: tag, inv: null, verdict: null };
}

async function runCase(C) {
  const seats = [];
  for (const s of SEATS) seats.push(await runSeat(C, s)); // seats sequential within a case
  const invs = seats.filter((s) => s.inv).map((s) => s.inv);
  let seal = null;
  if (invs.length >= 3) {
    const sr = await dispatch("SEAL_PANEL", JSON.stringify({ findings: invs, min_families: 2, min_findings: 3 }));
    try { const j = JSON.parse(sr.result); seal = { inv: sr?.proof?.invocation_id, decision: j.decision, authorised: j.action_authorised, sigs: (j.arithmetic?.distinct_derivation_signatures || []).length }; } catch {}
  }
  const row = { id: C.id, oracle: C.oracle, seats, seal };
  console.error(C.id, C.oracle, "|", seats.map((s) => `${s.seat}:${s.verdict || "FAIL"}`).join(" "), "| seal:", seal ? `${seal.decision}(${seal.sigs})` : "none");
  return row;
}

// cases in parallel, capped
const CAP = 5;
const results = [];
let idx = 0;
await Promise.all(Array.from({ length: CAP }, async () => {
  while (idx < cases.length) { const C = cases[idx++]; results.push(await runCase(C)); }
}));
results.sort((a, b) => a.id.localeCompare(b.id));
writeFileSync("/tmp/calib_results.json", JSON.stringify(results, null, 1));

// stats
const stats = {};
for (const [tag] of SEATS) stats[tag] = { n: 0, correct: 0, wrongful_affirm: 0, over_abstain: 0, under_abstain: 0, transport_fail: 0 };
let sealStats = { APPROVE: 0, NEGATE: 0, ESCALATE: 0, NO_ACTION: 0, none: 0, wrongful_authorisation: 0, correct_seal: 0 };
for (const r of results) {
  for (const s of r.seats) {
    const st = stats[s.seat];
    if (!s.verdict) { st.transport_fail++; continue; }
    st.n++;
    if (s.verdict === r.oracle) st.correct++;
    if (s.verdict === "AFFIRM" && r.oracle !== "AFFIRM") st.wrongful_affirm++;
    if (s.verdict === "CANNOT_CONCLUDE" && r.oracle !== "CANNOT_CONCLUDE") st.over_abstain++;
    if (s.verdict !== "CANNOT_CONCLUDE" && r.oracle === "CANNOT_CONCLUDE") st.under_abstain++;
  }
  const d = r.seal?.decision || "none";
  sealStats[d] = (sealStats[d] || 0) + 1;
  if (d === "APPROVE" && r.oracle !== "AFFIRM") sealStats.wrongful_authorisation++;
  const map = { AFFIRM: "APPROVE", DENY: "NEGATE", CANNOT_CONCLUDE: "NO_ACTION" };
  if (d === map[r.oracle]) sealStats.correct_seal++;
}
console.log(JSON.stringify({ per_seat: stats, seals: sealStats }, null, 1));
