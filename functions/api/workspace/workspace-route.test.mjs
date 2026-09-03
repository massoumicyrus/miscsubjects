import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet, onRequestPost } from './[[path]].js';
import { evaluateMutation, roleGrant, poolObjectBoundary, resolvePoolToken, MUTATION_OPS } from '../../_lib/workspace_object.js';
import { tokenAllowsKey } from '../../_lib/admin_session.js';
import { scopeNarrows } from '../dispatch.js';

const WS = {
  purpose: 'test workspace',
  status: 'active',
  members: [{ name: 'Victor', role: 'creative' }],
  roles: {
    creative: { rows: ['ARCADS_GENERATE', 'WEB_FETCH'], ops: ['add-object', 'propose-repair'], public: false },
    finance: { rows: ['WEB_FETCH'], ops: [], public: false },
    observer: { rows: ['WEB_FETCH'], ops: [], public: true },
  },
  objects: ['adops-q3-creative-deck'],
  lineage: [],
  mutations: [],
};

function envFor(ws) {
  const meta = JSON.stringify({ extra: { workspace: ws } });
  const updates = [];
  return {
    updates,
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            return {
              async first() {
                if (sql.startsWith('UPDATE')) { updates.push(args); return null; }
                if (!sql.includes('FROM articles')) return null;
                const slug = args[0];
                if (slug === 'ws-test') return { slug, title: 'WS Test', body: '', meta };
                if (slug === 'adops-q3-creative-deck' || slug === 'adops-q3-ad-deck') return { slug, title: 'obj', body: '', meta: '{}' };
                return null;
              },
              async run() { updates.push(args); return {}; },
              async all() { return { results: [] }; },
            };
          },
        };
      },
    },
    LEDGER: {
      prepare() { return { bind() { return { async run() { return {}; } }; } }; },
    },
  };
}

test('mutation policy: in-role op approves, out-of-role op denies, unknown verb denies', () => {
  assert.equal(evaluateMutation(WS, 'creative', 'add-object').decision, 'APPROVED');
  assert.equal(evaluateMutation(WS, 'finance', 'add-object').decision, 'DENIED');
  assert.equal(evaluateMutation(WS, 'finance', 'add-object').reason, 'op_outside_role_authority');
  assert.equal(evaluateMutation(WS, 'creative', 'close-object').decision, 'DENIED');
  assert.equal(evaluateMutation(WS, 'ghost-role', 'add-object').decision, 'DENIED');
  assert.ok(MUTATION_OPS.includes('propose-repair'));
});

test('unresolved pool tokens allow nothing; resolution fills the declared rows only', async () => {
  const tok = { scope: 'pool', pool: { workspace: 'ws-test', role: 'creative' } };
  assert.equal(tokenAllowsKey(tok, 'WEB_FETCH'), false); // fail closed before resolution
  await resolvePoolToken(envFor(WS), tok);
  assert.equal(tokenAllowsKey(tok, 'WEB_FETCH'), true);
  assert.equal(tokenAllowsKey(tok, 'ARCADS_GENERATE'), true);
  assert.equal(tokenAllowsKey(tok, 'VOXEL_EDIT'), false); // not declared for the role
});

test('an undeclared role resolves to an empty grant', async () => {
  const tok = { scope: 'pool', pool: { workspace: 'ws-test', role: 'intruder' } };
  await resolvePoolToken(envFor(WS), tok);
  assert.equal(tokenAllowsKey(tok, 'WEB_FETCH'), false);
  assert.equal(tok.poolError, 'role_not_declared');
});

test('pool object boundary: slug-bearing bodies outside the object set are refused', async () => {
  const tok = { scope: 'pool', pool: { workspace: 'ws-test', role: 'creative' } };
  await resolvePoolToken(envFor(WS), tok);
  assert.equal(poolObjectBoundary(tok, JSON.stringify({ slug: 'adops-q3-creative-deck', text: 'x' })).ok, true);
  const out = poolObjectBoundary(tok, JSON.stringify({ slug: 'some-unrelated-article', text: 'x' }));
  assert.equal(out.ok, false);
  assert.equal(out.reason, 'pool_object_boundary');
  assert.equal(poolObjectBoundary(tok, 'not json at all').ok, true); // non-slug bodies pass through to the row gate
});

test('attenuation fails closed around pools in both directions', () => {
  assert.equal(scopeNarrows('pool:ws-test:creative', 'rows:WEB_FETCH'), false);
  assert.equal(scopeNarrows('act', 'pool:ws-test:creative'), false);
  assert.equal(scopeNarrows('pool:ws-test:creative', 'read'), true); // read stays the floor
});

test('the projection lists roles, objects, and the mutation contract', async () => {
  const res = await onRequestGet({
    request: new Request('https://x/api/workspace/ws-test'),
    env: envFor(WS),
    params: { path: ['ws-test'] },
  });
  const bodyOut = await res.json();
  assert.equal(res.status, 200);
  assert.equal(bodyOut.workspace, 'ws-test');
  assert.ok(bodyOut.roles.creative.rows.some((r) => r.key === 'ARCADS_GENERATE'));
  assert.ok(bodyOut.mutation_contract.ops.includes('add-object'));
  assert.ok(bodyOut.objects.some((o) => o.slug === 'adops-q3-creative-deck'));
});

test('entering a privileged role without the owner key is denied with a recorded reason', async () => {
  const res = await onRequestPost({
    request: new Request('https://x/api/workspace/ws-test/enter', {
      method: 'POST', body: JSON.stringify({ role: 'creative', actor: 'stranger-model' }),
    }),
    env: envFor(WS),
    params: { path: ['ws-test', 'enter'] },
  });
  assert.equal(res.status, 403);
  const out = await res.json();
  assert.equal(out.error, 'privileged_role_requires_owner_mint');
});

test('a mutation without a pool credential is refused at the door', async () => {
  const res = await onRequestPost({
    request: new Request('https://x/api/workspace/ws-test/mutate', {
      method: 'POST', body: JSON.stringify({ op: 'add-object', target: 'adops-q3-ad-deck' }),
    }),
    env: envFor(WS),
    params: { path: ['ws-test', 'mutate'] },
  });
  assert.equal(res.status, 401);
  const out = await res.json();
  assert.equal(out.error, 'pool_credential_required');
});
