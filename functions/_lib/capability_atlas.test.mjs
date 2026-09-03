import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCapabilityAtlas } from './capability_atlas.js';

function binding({ firstRows = [], allRows = [] } = {}) {
  return { prepare(sql) { return { async first() { const hit = firstRows.find(x => x.when.test(sql)); return hit ? hit.value : null; }, async all() { const hit = allRows.find(x => x.when.test(sql)); return { results: hit ? hit.value : [] }; } }; } };
}

test('capability atlas joins contracts, invocation evidence, tests, and turn sediment without exposing secrets', async () => {
  const DB = binding({
    firstRows: [{ when: /FROM agent_turns/, value: { total: 40, agents: 3, sessions: 9, file_changing_turns: 12, tool_using_turns: 30 } }],
    allRows: [
      { when: /FROM directory ORDER/, value: [
        { key: 'STRIPE_READ', type: 'fn', target: 'https://api.stripe.com/v1/$1', category: 'stripe', enabled: 1, planner_visible: 1, sensitive: 1, content: '# WHAT: Read Stripe objects.\\n# ARGS: token=super-secret\\n# TESTS: list customers.' },
        { key: 'GROK_IMAGE', type: 'http', target: 'https://api.x.ai/image', category: 'creative', enabled: 1, planner_visible: 1, sensitive: 0, content: '# WHAT: Generate an image.' },
      ] },
      { when: /FROM directory_tests/, value: [{ key: 'STRIPE_READ', tests: 2, passed_tests: 1, last_run_id: 'run-1' }] },
      { when: /GROUP BY agent/, value: [{ agent: 'codex', turns: 20, sessions: 3, file_changing_turns: 8 }] },
      { when: /GROUP BY substr/, value: [{ day: '2026-07-21', turns: 3, file_changing_turns: 1 }] },
      { when: /json_each/, value: [{ file: '/Users/owner/miscsubjects-pages/functions/api/dispatch.js', turns: 9 }] },
    ],
  });
  const LEDGER = binding({ allRows: [{ when: /FROM invocations/, value: [{ object_id: 'STRIPE_READ', uses: 12, material_uses: 7, actors: 2, last_used: 'now' }] }] });
  const atlas = await buildCapabilityAtlas({ DB, LEDGER }, 'https://miscsubjects.com/api/capability-atlas');
  assert.equal(atlas.summary.registered_capabilities, 2);
  assert.equal(atlas.summary.capabilities_with_recorded_invocations, 1);
  assert.equal(atlas.summary.capabilities_with_registered_tests, 1);
  assert.equal(atlas.capabilities[0].evidence.verification, 'tested_and_invoked');
  assert.equal(atlas.capabilities[1].evidence.verification, 'registered_only');
  assert.equal(atlas.capabilities[0].domain, 'commerce');
  assert.equal(atlas.capabilities[0].description, 'Read Stripe objects.');
  assert.equal(atlas.turn_archaeology.changed_files.top[0].file, 'functions/api/dispatch.js');
  assert.doesNotMatch(JSON.stringify(atlas), /super-secret/);
});

test('summary mode omits the full capability array', async () => {
  const empty = binding();
  const atlas = await buildCapabilityAtlas({ DB: empty, LEDGER: empty }, 'https://miscsubjects.com/api/capability-atlas', { includeCapabilities: false });
  assert.equal('capabilities' in atlas, false);
  assert.equal(atlas.schema, 'miscsubjects-capability-atlas/1.0');
});
