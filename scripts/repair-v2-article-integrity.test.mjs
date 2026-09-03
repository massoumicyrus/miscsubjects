import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addEvidenceKey,
  reconcileEvidenceGraph,
} from './repair-v2-article-integrity.mjs';

test('reconciles valid one-way edges without inventing evidence', () => {
  const article = {
    sources: [
      { id: 's1', type: 'publisher_documentation', claim_ids: ['c1'] },
      { id: 's2', type: 'github_issue', claim_ids: ['c1'] },
    ],
    claims: [
      { id: 'c1', text: 'Claim', source_ids: ['s1'] },
    ],
  };
  const repaired = reconcileEvidenceGraph(article);
  assert.deepEqual(repaired.claims[0].source_ids, ['s1', 's2']);
  assert.deepEqual(repaired.sources[0].claim_ids, ['c1']);
  assert.equal(repaired.claims[0].evidence_status, 'specified + externally attested');
});

test('refuses dangling IDs unless an explicit claim replacement is supplied', () => {
  const article = {
    sources: [{ id: 's1', type: 'reddit', claim_ids: ['c2'] }],
    claims: [{ id: 'c1', text: 'Narrow claim', source_ids: [] }],
  };
  assert.throws(() => reconcileEvidenceGraph(article), /missing claim c2/);
  const repaired = reconcileEvidenceGraph(article, { claimIdMap: { c2: 'c1' } });
  assert.deepEqual(repaired.sources[0].claim_ids, ['c1']);
  assert.deepEqual(repaired.claims[0].source_ids, ['s1']);
});

test('adds a compact evidence-status key after the thesis, once', () => {
  const body = 'Specific thesis paragraph.\n\nSecond paragraph.\n\n## First section\n\nText.';
  const once = addEvidenceKey(body);
  assert.match(once, /Observed.*Specified.*Externally attested/s);
  assert.equal(addEvidenceKey(once), once);
  assert.equal(once.indexOf('## Evidence status') < once.indexOf('## First section'), true);
});
