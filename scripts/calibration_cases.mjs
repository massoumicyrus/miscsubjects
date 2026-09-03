#!/usr/bin/env node
// 30 oracle-labelled synthetic calibration cases: 10 AFFIRM, 10 DENY, 10 CANNOT_CONCLUDE.
// Every case is a determinate (or determinately-indeterminate) fixture, labelled synthetic,
// hashed, with explicit evidence ids and an ACTION_UNDER_REVIEW. Writes /tmp/calib_cases.json.
import { createHash } from "crypto";
import { writeFileSync } from "fs";
const sha = (s) => createHash("sha256").update(s).digest("hex");

const cases = [];
let n = 0;
const NAMES = ["R. Alvarez", "K. Osei", "M. Lindqvist", "T. Nakamura", "S. Petrov", "A. Duarte", "J. Whitfield", "L. Moreau", "D. Okonkwo", "P. Haugen"];

// Shape A — roster access (rules constant; artifact varies)
const accessRules = `1. Access is issued when the request matches a row of the authorized roster on both full legal name and employee ID.
2. When the authorized roster is not among the submitted records, the match in clause 1 cannot be performed and the determination is exactly CANNOT_CONCLUDE — neither granted nor denied. A finding under this clause cites [manifest] as its evidence.`;
function accessCase(kind, i) {
  const name = NAMES[i % NAMES.length];
  const id = "E-" + (4100 + i * 37);
  let artifact, oracle;
  if (kind === "AFFIRM") {
    artifact = `SYNTHETIC TEST FIXTURE. Records supplied, each with an id:\n  [req] ACCESS REQUEST: name "${name}", employee ID "${id}".\n  [roster] AUTHORIZED ROSTER (complete): row 1 — name "${name}", employee ID "${id}"; row 2 — name "Q. Varga", employee ID "E-9901".\n  [manifest] RECORD MANIFEST: the complete set of submitted records is exactly: req, roster.\nDETERMINATION: strictly on the submitted records.`;
    oracle = "AFFIRM";
  } else if (kind === "DENY") {
    artifact = `SYNTHETIC TEST FIXTURE. Records supplied, each with an id:\n  [req] ACCESS REQUEST: name "${name}", employee ID "${id}".\n  [roster] AUTHORIZED ROSTER (complete): row 1 — name "Q. Varga", employee ID "E-9901"; row 2 — name "B. Ionescu", employee ID "E-7734".\n  [manifest] RECORD MANIFEST: the complete set of submitted records is exactly: req, roster.\nDETERMINATION: strictly on the submitted records.`;
    oracle = "DENY";
  } else {
    artifact = `SYNTHETIC TEST FIXTURE. Records supplied, each with an id:\n  [req] ACCESS REQUEST: name "${name}", employee ID "${id}".\n  [manifest] RECORD MANIFEST: the complete set of submitted records is exactly: req. The authorized roster is NOT among the submitted records.\nDETERMINATION: strictly on the submitted records.`;
    oracle = "CANNOT_CONCLUDE";
  }
  return {
    id: "calib-" + String(++n).padStart(2, "0"), oracle,
    question: "Does the request satisfy the roster-match rule, such that access should be issued?",
    action_under_review: "issue the access credential",
    rules: accessRules, ruleset_hash: sha(accessRules),
    artifact, artifact_sha256: sha(artifact),
    evidence_ids: kind === "ABSTAIN" ? ["req", "manifest"] : ["req", "roster", "manifest"],
  };
}

// Shape B — library late fee
const feeRules = `1. A late fee is charged when a book is returned after its due date.
2. No late fee is charged when the borrower's account shows an active fee-waiver whose stated expiry date is after the return date.
3. When the borrower's account record is not among the submitted records, clause 2 cannot be evaluated and the determination is exactly CANNOT_CONCLUDE. A finding under this clause cites [manifest] as its evidence.`;
function feeCase(kind, i) {
  const days = 2 + i;
  let artifact, oracle;
  if (kind === "AFFIRM") {
    artifact = `SYNTHETIC TEST FIXTURE. Records supplied, each with an id:\n  [ret] RETURN RECORD: book returned ${days} days after its due date, on 2026-07-${10 + i}.\n  [acct] BORROWER ACCOUNT: no fee-waiver on file.\n  [manifest] RECORD MANIFEST: the complete set of submitted records is exactly: ret, acct.\nDETERMINATION: strictly on the submitted records.`;
    oracle = "AFFIRM";
  } else if (kind === "DENY") {
    artifact = `SYNTHETIC TEST FIXTURE. Records supplied, each with an id:\n  [ret] RETURN RECORD: book returned ${days} days after its due date, on 2026-07-${10 + i}.\n  [acct] BORROWER ACCOUNT: active fee-waiver on file, stated expiry 2026-12-31.\n  [manifest] RECORD MANIFEST: the complete set of submitted records is exactly: ret, acct.\nDETERMINATION: strictly on the submitted records.`;
    oracle = "DENY";
  } else {
    artifact = `SYNTHETIC TEST FIXTURE. Records supplied, each with an id:\n  [ret] RETURN RECORD: book returned ${days} days after its due date, on 2026-07-${10 + i}.\n  [manifest] RECORD MANIFEST: the complete set of submitted records is exactly: ret. The borrower's account record is NOT among the submitted records.\nDETERMINATION: strictly on the submitted records.`;
    oracle = "CANNOT_CONCLUDE";
  }
  return {
    id: "calib-" + String(++n).padStart(2, "0"), oracle,
    question: "Is a late fee owed?",
    action_under_review: "charge the late fee",
    rules: feeRules, ruleset_hash: sha(feeRules),
    artifact, artifact_sha256: sha(artifact),
    evidence_ids: kind === "ABSTAIN" ? ["ret", "manifest"] : ["ret", "acct", "manifest"],
  };
}

// Shape C — parking permit (sufficiency-form rule, per the input-critique lesson)
const permitRules = `1. A resident parking permit is issued when the applicant's submitted proof of address shows a street address inside Zone C.
2. A permit is refused when the applicant already holds two active permits, regardless of clause 1.
3. When the permit registry record is not among the submitted records, clause 2 cannot be evaluated and the determination is exactly CANNOT_CONCLUDE. A finding under this clause cites [manifest] as its evidence.`;
const ZONE_C = ["14 Calder Row", "9 Brindle Lane", "22 Foss Street", "3 Harrow Walk"];
function permitCase(kind, i) {
  const addr = ZONE_C[i % ZONE_C.length];
  let artifact, oracle;
  if (kind === "AFFIRM") {
    artifact = `SYNTHETIC TEST FIXTURE. Records supplied, each with an id:\n  [poa] PROOF OF ADDRESS: "${addr}", designated Zone C on its face.\n  [reg] PERMIT REGISTRY: applicant holds 0 active permits.\n  [manifest] RECORD MANIFEST: the complete set of submitted records is exactly: poa, reg.\nDETERMINATION: strictly on the submitted records.`;
    oracle = "AFFIRM";
  } else if (kind === "DENY") {
    artifact = `SYNTHETIC TEST FIXTURE. Records supplied, each with an id:\n  [poa] PROOF OF ADDRESS: "${addr}", designated Zone C on its face.\n  [reg] PERMIT REGISTRY: applicant holds 2 active permits.\n  [manifest] RECORD MANIFEST: the complete set of submitted records is exactly: poa, reg.\nDETERMINATION: strictly on the submitted records.`;
    oracle = "DENY";
  } else {
    artifact = `SYNTHETIC TEST FIXTURE. Records supplied, each with an id:\n  [poa] PROOF OF ADDRESS: "${addr}", designated Zone C on its face.\n  [manifest] RECORD MANIFEST: the complete set of submitted records is exactly: poa. The permit registry record is NOT among the submitted records.\nDETERMINATION: strictly on the submitted records.`;
    oracle = "CANNOT_CONCLUDE";
  }
  return {
    id: "calib-" + String(++n).padStart(2, "0"), oracle,
    question: "Should the resident parking permit be issued?",
    action_under_review: "issue the resident parking permit",
    rules: permitRules, ruleset_hash: sha(permitRules),
    artifact, artifact_sha256: sha(artifact),
    evidence_ids: kind === "ABSTAIN" ? ["poa", "manifest"] : ["poa", "reg", "manifest"],
  };
}

// 30 cases: shapes rotate; kinds balanced 10/10/10.
const makers = [accessCase, feeCase, permitCase];
for (const kind of ["AFFIRM", "DENY", "ABSTAIN"]) {
  for (let i = 0; i < 10; i++) cases.push(makers[i % 3](kind, i));
}
writeFileSync("/tmp/calib_cases.json", JSON.stringify(cases, null, 1));
const counts = cases.reduce((m, c) => ((m[c.oracle] = (m[c.oracle] || 0) + 1), m), {});
console.log("wrote", cases.length, "cases", JSON.stringify(counts));
