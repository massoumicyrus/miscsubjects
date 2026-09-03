// Deterministic tests for decision-finding@1.0.0 and the derivation-agreement sealer logic.
// Run: node --test functions/_lib/decision_finding.test.mjs
import { test } from 'node:test';
import assert from 'node:assert';
import { parseDecisionFinding, derivationSignature } from './decision_finding.js';

// A well-formed governed response body under decision-constitution@1.3.0.
function goodResponse({ verdict = 'AFFIRM', rules = [1, 2, 3], vec } = {}) {
  const ev = vec || rules.map((n) => ({ clause: String(n), trigger_state: 'triggered', disposition: 'supports', evidence_ids: ['r1'], ground: 'g' + n }));
  return [
    'REASONING:',
    ...rules.map((n) => `${n}. [clause ${n}] evaluated.`),
    'DECISION: VERDICT — ' + verdict + ': ground.',
    'APPLICABLE_RULES: [' + rules.join(', ') + ']',
    'KNOWN_FACTS: x',
    'UNKNOWN_FACTS: none',
    'EVIDENCE_USED: r1',
    'PROPOSED_ACTION: act',
    'REJECTED_ALTERNATIVE: none',
    'EXPECTED_RESULT: y',
    'FAILURE_RESPONSE: escalate',
    'VERIFICATION_REQUIRED: check',
    'RECORDS_ABSENT: none',
    'VERDICT: ' + verdict,
    'CLAUSE_EVALUATIONS: ' + JSON.stringify(ev),
  ].join('\n');
}
const REQ = 'decision-constitution@1.3.0\nRULESET_HASH: ' + 'a'.repeat(64) + '\nARTIFACT_SHA256: ' + 'b'.repeat(64) + '\nEVIDENCE_IDS: r1, r2';
const allowed = new Set(['r1', 'r2']);

test('well-formed finding is structurally valid with a derivation signature', async () => {
  const f = await parseDecisionFinding(goodResponse(), REQ, { allowedEvidence: allowed });
  assert.equal(f.structurally_valid, true, JSON.stringify(f.structural_errors));
  assert.equal(f.verdict, 'AFFIRM');
  assert.deepEqual(f.applicable_rules, [1, 2, 3]);
  assert.ok(f.derivation_signature);
  assert.equal(f.constitution_version, 'decision-constitution@1.3.0');
});

test('missing terminal DECISION -> invalid', async () => {
  const body = goodResponse().replace(/DECISION: VERDICT[^\n]*\n/, '');
  const f = await parseDecisionFinding(body, REQ, { allowedEvidence: allowed });
  assert.equal(f.structurally_valid, false);
  assert.ok(f.structural_errors.includes('missing_terminal_DECISION'));
});

test('missing a C8 field -> invalid', async () => {
  const body = goodResponse().replace(/RECORDS_ABSENT: none\n/, '');
  const f = await parseDecisionFinding(body, REQ, { allowedEvidence: allowed });
  assert.equal(f.structurally_valid, false);
  assert.ok(f.structural_errors.some((e) => e.startsWith('missing_C8_field:RECORDS_ABSENT')));
});

test('missing CLAUSE_EVALUATIONS -> invalid', async () => {
  const body = goodResponse().replace(/CLAUSE_EVALUATIONS:[^\n]*/, '');
  const f = await parseDecisionFinding(body, REQ, { allowedEvidence: allowed });
  assert.equal(f.structurally_valid, false);
  assert.ok(f.structural_errors.includes('missing_or_unparseable_CLAUSE_EVALUATIONS'));
});

test('invented evidence id -> invalid', async () => {
  const vec = [1, 2, 3].map((n) => ({ clause: String(n), trigger_state: 'triggered', disposition: 'supports', evidence_ids: ['r99'], ground: 'g' }));
  const f = await parseDecisionFinding(goodResponse({ vec }), REQ, { allowedEvidence: allowed });
  assert.equal(f.structurally_valid, false);
  assert.ok(f.structural_errors.some((e) => e.startsWith('invented_evidence_id')));
});

test('vector clause set != APPLICABLE_RULES -> invalid', async () => {
  const vec = [1, 2].map((n) => ({ clause: String(n), trigger_state: 'triggered', disposition: 'supports', evidence_ids: ['r1'], ground: 'g' }));
  // APPLICABLE_RULES says [1,2,3] but vector only covers [1,2]
  const f = await parseDecisionFinding(goodResponse({ vec }), REQ, { allowedEvidence: allowed });
  assert.equal(f.structurally_valid, false);
  assert.ok(f.structural_errors.some((e) => e.startsWith('clause_vector_mismatch_applicable')));
});

test('invalid enum -> invalid', async () => {
  const vec = [1, 2, 3].map((n) => ({ clause: String(n), trigger_state: 'maybe', disposition: 'supports', evidence_ids: ['r1'], ground: 'g' }));
  const f = await parseDecisionFinding(goodResponse({ vec }), REQ, { allowedEvidence: allowed });
  assert.equal(f.structurally_valid, false);
  assert.ok(f.structural_errors.some((e) => e.startsWith('invalid_trigger_state')));
});

// The core defect test: identical clause NUMBERS, different derivations -> different signatures.
test('false convergence: same verdict + same clauses, different vectors -> different signatures', async () => {
  const a = [1, 2, 3].map((n) => ({ clause: String(n), trigger_state: 'triggered', disposition: 'supports', evidence_ids: ['r1'], ground: 'g' }));
  const b = [1, 2, 3].map((n) => ({ clause: String(n), trigger_state: (n === 2 ? 'not_triggered' : 'triggered'), disposition: (n === 2 ? 'defeats' : 'supports'), evidence_ids: ['r1'], ground: 'g' }));
  const fa = await parseDecisionFinding(goodResponse({ vec: a }), REQ, { allowedEvidence: allowed });
  const fb = await parseDecisionFinding(goodResponse({ vec: b }), REQ, { allowedEvidence: allowed });
  assert.deepEqual(fa.applicable_rules, fb.applicable_rules); // same clause numbers
  assert.notEqual(fa.derivation_signature, fb.derivation_signature); // different derivations
});

test('genuine agreement: identical vectors -> identical signatures', async () => {
  const v = [1, 2, 3].map((n) => ({ clause: String(n), trigger_state: 'triggered', disposition: 'supports', evidence_ids: ['r1', 'r2'], ground: 'wording differs here' }));
  const v2 = [1, 2, 3].map((n) => ({ clause: String(n), trigger_state: 'triggered', disposition: 'supports', evidence_ids: ['r2', 'r1'], ground: 'DIFFERENT wording, same logic' }));
  assert.equal(derivationSignature(v), derivationSignature(v2)); // ground and evidence order do not matter
});

// v1.3.3: 'blocks' is the abstention disposition — a gap-carrying clause is valid as 'blocks',
// and two seats agreeing on the gap produce identical signatures (the clean NO_ACTION path).
test('abstention: blocks is a valid disposition and agreeing abstentions share a signature', async () => {
  const vec = [
    { clause: '1', trigger_state: 'triggered', disposition: 'supports', evidence_ids: ['r1'], ground: 'fired' },
    { clause: '2', trigger_state: 'unknown', disposition: 'blocks', evidence_ids: ['r2'], ground: 'status unresolved' },
    { clause: '3', trigger_state: 'not_triggered', disposition: 'neutral', evidence_ids: ['r1'], ground: 'no bearing' },
  ];
  const f = await parseDecisionFinding(goodResponse({ vec }), REQ, { allowedEvidence: allowed });
  assert.equal(f.structurally_valid, true, JSON.stringify(f.structural_errors));
  const vec2 = vec.map((c) => ({ ...c, ground: 'different words, same derivation' }));
  assert.equal(derivationSignature(vec), derivationSignature(vec2));
});

// v1.3.2 defect regression: the same abstention derived as supports-vs-defeats over the gap
// clause must diverge — that split is real disagreement, not formatting noise.
test('abstention: supports vs blocks over the gap clause -> divergent signatures', async () => {
  const base = { clause: '2', evidence_ids: ['r2'], ground: 'g' };
  const a = [{ clause: '1', trigger_state: 'triggered', disposition: 'supports', evidence_ids: ['r1'], ground: 'g' }, { ...base, trigger_state: 'unknown', disposition: 'supports' }, { clause: '3', trigger_state: 'not_triggered', disposition: 'neutral', evidence_ids: ['r1'], ground: 'g' }];
  const b = [{ clause: '1', trigger_state: 'triggered', disposition: 'supports', evidence_ids: ['r1'], ground: 'g' }, { ...base, trigger_state: 'unknown', disposition: 'blocks' }, { clause: '3', trigger_state: 'not_triggered', disposition: 'neutral', evidence_ids: ['r1'], ground: 'g' }];
  assert.notEqual(derivationSignature(a), derivationSignature(b));
});
