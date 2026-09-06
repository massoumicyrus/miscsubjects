import test from 'node:test';
import assert from 'node:assert';
import { executionPolicy, isMacBridgeTarget, routeExecution, stampSubstrate } from './execution_routing.js';

// A fake env whose two substrates can each be turned off, because the whole
// point of this layer is what it does when one of them is not there.
function env({ cloud = true, mac = true } = {}) {
  return {
    KV: null,
    TERMINAL_KEY: 'k',
    SANDBOX: {
      fetch: async () => new Response(JSON.stringify(
        cloud ? { ok: true, stdout: 'ROUTE_PROBE_OK' } : { ok: false, error: 'container_down' })),
    },
    __mac: mac,
  };
}
// macAvailable() reaches the bridge over fetch; swap global fetch per case.
function withMac(up, fn) {
  const real = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ ok: up }), { status: up ? 200 : 502 });
  return fn().finally(() => { globalThis.fetch = real; });
}

const MAC = 'POST https://agent.miscsubjects.com/exec';

test('a row that never touched the Mac is none of this layer\'s business', () => {
  assert.equal(executionPolicy({ target: 'POST https://api.stripe.com/v1/charges' }), 'n/a');
  assert.equal(isMacBridgeTarget('POST https://api.stripe.com/v1/charges'), false);
});

test('an unclassified Mac row behaves exactly as it did before', async () => {
  const d = await routeExecution({ key: 'X', target: MAC }, { env: env() });
  assert.equal(d.routed, false);
  assert.equal(d.target, MAC);
  assert.equal(d.substrate, 'mac_bridge');
});

test('cloud_preferred goes to the cloud when the cloud is up', async () => {
  const d = await routeExecution({ key: 'CLI_JQ', target: MAC, execution: 'cloud_preferred' }, { env: env() });
  assert.equal(d.routed, true);
  assert.equal(d.substrate, 'cloudflare_sandbox');
  assert.match(d.target, /\/api\/cloud\/exec$/);
});

test('cloud_preferred falls back to the Mac when the cloud is down, and says it fell back', async () => {
  const d = await routeExecution({ key: 'CLI_JQ', target: MAC, execution: 'cloud_preferred' }, { env: env({ cloud: false }) });
  assert.equal(d.substrate, 'mac_bridge');
  assert.equal(d.fell_back, true);
});

test('cloud-only REFUSES rather than quietly running on the laptop', async () => {
  const d = await routeExecution({ key: 'CLOUD_EXEC', target: MAC, execution: 'cloud' }, { env: env({ cloud: false }) });
  assert.match(d.refusal, /cloud_unavailable/);
  assert.match(d.refusal, /NOT run on the Mac/);
  assert.equal(d.routed, false);
});

test('edge_required with the Mac offline names the edge, and never reaches for a container', async () => {
  await withMac(false, async () => {
    const d = await routeExecution({ key: 'LOCAL_SCREENSHOT', target: MAC, execution: 'edge_required' }, { env: env() });
    assert.match(d.refusal, /edge_unavailable/);
    assert.match(d.refusal, /NOT rerouted to the cloud/);
    assert.equal(d.substrate, null);
  });
});

test('either stays on the Mac while the Mac answers', async () => {
  await withMac(true, async () => {
    const d = await routeExecution({ key: 'BASH', target: MAC, execution: 'either' }, { env: env() });
    assert.equal(d.substrate, 'mac_bridge');
    assert.equal(d.routed, false);
  });
});

test('either falls over to the cloud only once the Mac stops answering', async () => {
  await withMac(false, async () => {
    const d = await routeExecution({ key: 'BASH', target: MAC, execution: 'either' }, { env: env() });
    assert.equal(d.substrate, 'cloudflare_sandbox');
    assert.equal(d.fell_back, true);
    assert.match(d.fallback_reason, /mac_bridge_unavailable/);
  });
});

test('cloud_pending records the classification without changing behaviour', async () => {
  const d = await routeExecution({ key: 'CLI_PYTHON', target: MAC, execution: 'cloud_pending:image' }, { env: env() });
  assert.equal(d.routed, false);
  assert.equal(d.target, MAC);
  assert.equal(d.pending, 'image');
});

test('the substrate actually used is stamped into the result payload', () => {
  const out = stampSubstrate('HTTP 200:{"ok":true,"exit":0}', { substrate: 'mac_bridge', policy: 'either', fell_back: true, fallback_reason: 'x' });
  const parsed = JSON.parse(out.slice('HTTP 200:'.length));
  assert.equal(parsed.execution_substrate, 'mac_bridge');
  assert.equal(parsed.execution_policy, 'either');
  assert.equal(parsed.execution_fallback, true);
});

test('a non-JSON result is left alone rather than mangled', () => {
  assert.equal(stampSubstrate('ERR:http:500:boom', { substrate: 'mac_bridge', policy: 'either' }), 'ERR:http:500:boom');
});
