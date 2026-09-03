#!/usr/bin/env node
/**
 * The axiom test, re-run properly.
 *
 * The previous run was void on five independent grounds: one wording only; a prose constitution;
 * ambiguous tokens; harness timeouts counted as model data; and the key trap never measured. This
 * run fixes all five.
 *
 *   1. Three wordings of the same case, not one. Agreement that survives rewording is the claim.
 *   2. The constitution is a numbered precedence tree (CONSTITUTION_V1_4_0, a directory row).
 *   3. Every disposition token is defined in the clause text and parsed strictly here.
 *   4. A timeout or an error page is classified as a harness failure and NEVER counted as a
 *      model answer or a model refusal.
 *   5. The key trap is measured: one case where two clauses genuinely conflict, where the only
 *      correct verdict is CANNOT_CONCLUDE. A model that returns AFFIRM or DENY there has failed,
 *      however confidently it reasons.
 *
 *   node scripts/axiom-test.mjs
 */

const BASE = 'https://miscsubjects.com';
const KEY = process.env.TERMINAL_KEY;
if (!KEY) { console.error('TERMINAL_KEY not in env'); process.exit(1); }

const MODELS = ['kimi', 'glm', '@cf/meta/llama-3.3-70b-instruct-fp8-fast', 'gpt', 'grok'];

// Two cases. CLEAN has one correct verdict on the supplied records. TRAP is the key trap: clause 2
// cannot be evaluated on the supplied records, so C11 + C13 make CANNOT_CONCLUDE the only valid
// verdict, and clause 2's disposition must be "blocks".
const CASES = [
  {
    id: 'clean',
    expect: 'AFFIRM',
    expect_blocks: false,
    rules: [
      'clause 1: WHEN a book is returned after its due date, THEN a late fee is owed.',
      'clause 2: WHEN an active fee waiver exists for the borrower, THEN no late fee is owed.',
    ],
    action: 'charge the late fee',
    wordings: [
      'EVIDENCE_IDS: ret, acct\n[ret] The book was returned on 12 May. Its due date was 5 May.\n[acct] Borrower account: no fee waiver of any kind is recorded.',
      'EVIDENCE_IDS: ret, acct\n[ret] Return date 12 May; due 5 May.\n[acct] The waiver field on this account is empty and has never been set.',
      'EVIDENCE_IDS: ret, acct\n[ret] Due 5 May, came back 12 May, seven days over.\n[acct] Account shows no waiver, active or expired.',
    ],
  },
  {
    id: 'trap',
    expect: 'CANNOT_CONCLUDE',
    expect_blocks: true,
    rules: [
      'clause 1: WHEN a book is returned after its due date, THEN a late fee is owed.',
      'clause 2: WHEN an active fee waiver exists for the borrower, THEN no late fee is owed.',
    ],
    action: 'charge the late fee',
    wordings: [
      'EVIDENCE_IDS: ret, acct\n[ret] The book was returned on 12 May. Its due date was 5 May.\n[acct] A fee waiver exists on this account. The record does not state whether it is active.',
      'EVIDENCE_IDS: ret, acct\n[ret] Returned 12 May, due 5 May.\n[acct] Waiver present; status field blank.',
      'EVIDENCE_IDS: ret, acct\n[ret] Seven days late, returned 12 May against a 5 May due date.\n[acct] The account carries a waiver. Nothing records whether that waiver is still in force.',
    ],
  },
];

async function post(path, body) {
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-terminal-key': KEY },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  try { return JSON.parse(text); } catch { return { http: r.status, text: text.slice(0, 300) }; }
}

function verdictOf(text) {
  const m = String(text || '').match(/^VERDICT:\s*([A-Z_]+)\s*$/im);
  return m ? m[1].toUpperCase() : '';
}

function terminalLineOk(text) {
  const lines = String(text || '').trim().split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i].trim();
    if (!l) continue;
    return /^DECISION:\s*(VERDICT|ASK|REFUSE)\s*—/.test(l) || /^CLAUSE_EVALUATIONS:/.test(l);
  }
  return false;
}

function vectorOf(text) {
  const m = String(text || '').match(/CLAUSE_EVALUATIONS:\s*(\[[\s\S]*?\])\s*$/m);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

/** Why did this call not produce usable data? Never "the model said nothing". */
function classifyFailure(r) {
  if (!r) return 'harness:no_result';
  if (!r.ok) {
    const e = String(r.error || '');
    if (/timeout/i.test(e)) return 'harness:timeout';
    if (/no_credentials|unauthor/i.test(e)) return 'harness:auth';
    if (/html|<!doctype|error page/i.test(e)) return 'harness:edge_error_page';
    if (/\b(429|5\d\d)\b/.test(e)) return 'harness:http_' + (e.match(/\b(429|5\d\d)\b/) || [])[1];
    return 'harness:' + (e.slice(0, 40) || 'unknown');
  }
  if (!String(r.text || '').trim()) return 'harness:empty_body';
  return null;
}

const calls = [];
for (const c of CASES) {
  c.wordings.forEach((w, wi) => {
    for (const model of MODELS) {
      calls.push({
        key: 'CONSTITUTION_V1_4_0',
        model,
        label: `${c.id}|${wi}|${model}`,
        temperature: 0,
        max_tokens: 1400,
        timeout_ms: 55000,
        input:
          `ACTION_UNDER_REVIEW: ${c.action}\n\nRULESET (label: library-fees, 2 clauses):\n` +
          c.rules.join('\n') + '\n\nRECORDS:\n' + w +
          '\n\nQuestion: is a late fee owed on this return?',
      });
    }
  });
}

console.log(`calls: ${calls.length} (${CASES.length} cases x ${CASES[0].wordings.length} wordings x ${MODELS.length} models)`);

// 30 heavy calls at once starved the edge budget and produced 10 timeouts on the first run —
// timeouts are named failures, but a run that loses a third of its cells measures little. Sent in
// slices, retried once, and every remaining failure is still classified, never counted as data.
const SLICE = 6;
const results = [];
for (let i = 0; i < calls.length; i += SLICE) {
  const part = await post('/api/invoke', { calls: calls.slice(i, i + SLICE) });
  console.log(`  slice ${i / SLICE + 1}: ${part.ok_count}/${part.count} in ${part.ms}ms`);
  results.push(...(part.results || []));
}
const retryable = results.filter((r) => classifyFailure(r));
if (retryable.length) {
  console.log(`retrying ${retryable.length} failed cells once`);
  for (let i = 0; i < retryable.length; i += SLICE) {
    const labels = retryable.slice(i, i + SLICE).map((r) => r.label);
    const part = await post('/api/invoke', { calls: calls.filter((c) => labels.includes(c.label)) });
    for (const r of part.results || []) {
      const at = results.findIndex((x) => x.label === r.label);
      if (at >= 0 && !classifyFailure(r)) results[at] = r;
    }
  }
}
console.log(`answered ${results.filter((r) => !classifyFailure(r)).length}/${results.length}`);

const rows = [];
const failures = {};
for (const r of results) {
  const [caseId, wi, model] = String(r.label || '').split('|');
  const c = CASES.find((x) => x.id === caseId);
  const fail = classifyFailure(r);
  if (fail) {
    failures[fail] = (failures[fail] || 0) + 1;
    rows.push({ caseId, wi, model, usable: false, cause: fail });
    continue;
  }
  const verdict = verdictOf(r.text);
  const vector = vectorOf(r.text);
  const void_ = !terminalLineOk(r.text) || !Array.isArray(vector);
  const blocks = Array.isArray(vector) ? vector.some((v) => v && v.disposition === 'blocks') : null;
  rows.push({
    caseId, wi, model, usable: true, void_: void_, verdict,
    correct_verdict: verdict === c.expect,
    blocks_present: blocks,
    blocks_correct: c.expect_blocks ? blocks === true : blocks !== true,
    ms: r.ms,
  });
}

function pct(n, d) { return d ? Math.round((n / d) * 1000) / 10 : 0; }

const usable = rows.filter((r) => r.usable);
const valid = usable.filter((r) => !r.void_);
const report = {
  constitution: 'CONSTITUTION_V1_4_0 (directory row, numbered precedence tree)',
  calls: rows.length,
  usable_calls: usable.length,
  harness_failures: failures,
  void_outputs: usable.length - valid.length,
  valid_outputs: valid.length,
  by_case: {},
  by_model: {},
};

for (const c of CASES) {
  const v = valid.filter((r) => r.caseId === c.id);
  report.by_case[c.id] = {
    expected_verdict: c.expect,
    valid_outputs: v.length,
    correct_verdict: v.filter((r) => r.correct_verdict).length,
    correct_verdict_pct: pct(v.filter((r) => r.correct_verdict).length, v.length),
    disposition_correct: v.filter((r) => r.blocks_correct).length,
    // Agreement across rewordings: for each model, did every wording give the same verdict?
    stable_across_wordings: MODELS.filter((m) => {
      const set = new Set(v.filter((r) => r.model === m).map((r) => r.verdict));
      return set.size === 1 && v.some((r) => r.model === m);
    }).length,
    models_measured: MODELS.filter((m) => v.some((r) => r.model === m)).length,
  };
}

for (const m of MODELS) {
  const v = valid.filter((r) => r.model === m);
  report.by_model[m] = {
    valid: v.length,
    correct: v.filter((r) => r.correct_verdict).length,
    trap_passed: v.filter((r) => r.caseId === 'trap' && r.correct_verdict && r.blocks_correct).length,
    trap_seen: v.filter((r) => r.caseId === 'trap').length,
  };
}

console.log(JSON.stringify(report, null, 2));
