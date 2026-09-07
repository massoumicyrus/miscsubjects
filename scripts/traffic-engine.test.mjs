// The traffic engine's pure decision path, exercised without a database.
// node scripts/traffic-engine.test.mjs
import assert from 'node:assert/strict';
import { evaluate, validateCondition, ipInCidrs, readPath } from '../functions/_lib/traffic/conditions.js';
import { issueGrant, verifyGrant, signPayload, verifyPayload, identifierHash, maskIdentifier } from '../functions/_lib/traffic/grants.js';
import { parseUserAgent, classifyNetwork, parseCookies } from '../functions/_lib/traffic/signals.js';
import { normalizePhone, extractCode, composeMessage } from '../functions/_lib/traffic/funnel.js';
import { effectiveStatus } from '../functions/_lib/traffic/store.js';
import { pickRuleset, resolveDestination, evaluateContext, finalizeDecision, campaignFor } from '../functions/_lib/traffic/engine.js';

let n = 0;
const t = async (name, fn) => { try { await fn(); n++; console.log('ok', name); } catch (e) { console.log('FAIL', name); throw e; } };

// ---------------------------------------------------------------- condition language
await t('AND/OR/NOT and leaf operators evaluate with a trace', async () => {
  const ctx = { network: { country: 'US', risk: 70 }, profile: { tags: ['vip'] }, device: { class: 'mobile' } };
  assert.equal(evaluate({ all: [{ path: 'network.country', op: '=', value: 'US' }, { path: 'profile.tags', op: 'contains', value: 'vip' }] }, ctx).result, true);
  assert.equal(evaluate({ any: [{ path: 'network.country', op: '=', value: 'CA' }, { path: 'device.class', op: '=', value: 'mobile' }] }, ctx).result, true);
  assert.equal(evaluate({ not: { path: 'network.risk', op: '>', value: 90 } }, ctx).result, true);
  assert.equal(evaluate({ path: 'network.risk', op: 'between', value: [50, 80] }, ctx).result, true);
});
await t('an empty condition always matches (that is a default rule)', () => {
  assert.equal(evaluate({}, {}).result, true);
});
await t('a malformed leaf is false and names its defect, never throwing', () => {
  const r = evaluate({ path: 'x', op: 'nope' }, {});
  assert.equal(r.result, false); assert.match(r.trace.error, /unknown_op/);
});
await t('validateCondition flags an unknown op and a path outside the catalog', () => {
  const defects = validateCondition({ path: 'made.up.path', op: 'sideways' }, ['network.country']);
  assert.ok(defects.some((d) => /unknown_op/.test(d.error || '')));
  assert.ok(defects.some((d) => d.warning === 'path_not_in_signal_catalog'));
});
await t('CIDR matching covers v4 and bare ips', () => {
  assert.equal(ipInCidrs('203.0.113.44', ['203.0.113.0/24']), true);
  assert.equal(ipInCidrs('203.0.114.1', ['203.0.113.0/24']), false);
  assert.equal(readPath({ a: { b: [{ c: 9 }] } }, 'a.b[0].c'), 9);
});

// ---------------------------------------------------------------- grants (HMAC, one-time-safe payloads)
await t('a grant verifies for its audience and is rejected for another', async () => {
  const g = await issueGrant('secret', { tenant: 't_root', aud: 'miscsubjects.com', dest: 'dst_money', sub: 'prf_1', dev: 'd_1', ttl_s: 300 });
  assert.equal((await verifyGrant('secret', g.token, { aud: 'miscsubjects.com', dest: 'dst_money' })).ok, true);
  assert.equal((await verifyGrant('secret', g.token, { aud: 'evil.example' })).error, 'audience_mismatch');
});
await t('a tampered grant fails the signature', async () => {
  const g = await issueGrant('secret', { aud: 'h', dest: 'd' });
  const bad = g.token.slice(0, -2) + (g.token.slice(-2) === 'aa' ? 'bb' : 'aa');
  assert.equal((await verifyPayload('secret', bad)).ok, false);
});
await t('an expired grant is refused', async () => {
  const g = await issueGrant('secret', { aud: 'h', dest: 'd', ttl_s: 5, now: Date.now() - 10000 });
  assert.equal((await verifyGrant('secret', g.token, { aud: 'h' })).error, 'expired');
});
await t('identifier hashing is keyed and masking never reveals the value', async () => {
  const h1 = await identifierHash('k1', 'email', 'Jane@Example.com');
  const h2 = await identifierHash('k2', 'email', 'Jane@Example.com');
  assert.notEqual(h1, h2); // different key → different hash
  assert.equal(await identifierHash('k1', 'email', ' jane@example.com '), h1); // normalized
  assert.equal(maskIdentifier('email', 'jane@example.com'), 'j***@example.com');
  assert.equal(maskIdentifier('phone', '[PHONE]'), '+1***0100');
});

// ---------------------------------------------------------------- signals
await t('user-agent parsing and network classification', () => {
  const ua = parseUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605 Safari/604', { mobile: true });
  assert.equal(ua.class, 'mobile');
  assert.equal(classifyNetwork('Amazon.com, Inc.'), 'datacenter');
  assert.deepEqual(parseCookies('ms_did=d_1; ms_sid=s_2'), { ms_did: 'd_1', ms_sid: 's_2' });
});

// ---------------------------------------------------------------- SMS funnel primitives
await t('phone normalization, code extraction and message composition', () => {
  assert.equal(normalizePhone('(424) 555-0100'), '[PHONE]');
  assert.equal(extractCode('JOIN ABC234'), 'ABC234');
  assert.equal(extractCode('no code here'), null);
  assert.equal(composeMessage('JOIN {code}', 'ABC234'), 'JOIN ABC234');
});

// ---------------------------------------------------------------- memberships precedence
await t('effective status follows population precedence and flags a mixed population as review', () => {
  assert.equal(effectiveStatus([{ population: 'manual', status: 'approved' }, { population: 'rule', status: 'blocked' }]).status, 'approved');
  assert.equal(effectiveStatus([{ population: 'rule', status: 'approved' }, { population: 'rule', status: 'blocked' }]).status, 'review');
  assert.equal(effectiveStatus([]).status, 'unknown');
});

// ---------------------------------------------------------------- the splitter, end to end, in memory
function snapshot() {
  const destinations = {
    dst_money: { id: 'dst_money', name: 'Offer', type: 'redirect', url: 'https://example.com/offer', enabled: 1, health: 'healthy', allowed_hosts: ['example.com'], grant_required: 0 },
    dst_safe: { id: 'dst_safe', name: 'Safe', type: 'inline', html: '<p>safe</p>', enabled: 1, health: 'healthy' },
    dst_group: { id: 'dst_group', type: 'group', enabled: 1, health: 'healthy', members: [{ id: 'dst_money', weight: 1 }, { id: 'dst_safe', weight: 1 }], sticky: 1 },
  };
  const ruleset = {
    id: 'rs_1', state: 'active', revision: 1, hash: 'sha256:x', entry: [{ host: '*', path: '/go/*', entry: 'acceptance' }],
    default_destination: 'dst_safe', fail_mode: 'FALLBACK', allowed_capabilities: [], enrichment: [],
    rules: [
      { id: 'rule_block_dc', enabled: 1, priority: 10, on_match: 'stop', condition: { path: 'network.type', op: '=', value: 'datacenter' }, actions: [{ type: 'deny', message: 'no datacenters' }] },
      { id: 'rule_vip', enabled: 1, priority: 20, on_match: 'stop', condition: { path: 'profile.tags', op: 'contains', value: 'vip' }, actions: [{ type: 'destination', id: 'dst_money' }] },
    ],
  };
  return { tenant: 't_root', hash: 'sha256:s', rulesets: [ruleset], destinations, campaigns: {}, lists: [], segments: [], experiments: [], signal_policy: [] };
}
function baseCtx(over = {}) {
  return {
    request: { id: 'r1', host: 'miscsubjects.com', path: '/go/acceptance', entry: 'acceptance', phase: 'visit', user_agent: '', query: {} },
    network: { risk: 20, type: 'residential', country: 'US', asn: 7922 },
    device: { id: 'd_1', trusted: false, class: 'desktop' },
    profile: { id: 'prf_1', known: false, customer: false, status: 'unknown', tags: [], segments: [], experiments: {}, acks: {}, memberships: [], identifier_kinds: [], previous_destinations: [], attrs: {} },
    time: {}, session: { id: 's_1' }, history: { jci_status: 'unknown', rows: 0, signals: {} }, consistency: { device: 'consistent', timezone: 'consistent' },
    geo: {}, campaign: {}, turnstile: { valid: false, skip: false }, lists: { allow: [], deny: [], kinds: [], allow_match: false, deny_match: false },
    buckets: { request: 10, device: 30, profile: 55 }, experiment: {}, grant: { valid: false }, custom: {}, ...over,
  };
}
const pick = (snap) => pickRuleset(snap, { host: 'miscsubjects.com', path: '/go/acceptance', entry: 'acceptance' });

await t('pickRuleset matches on host/path/entry glob and skips inactive rulesets', () => {
  const snap = snapshot();
  assert.equal(pick(snap).id, 'rs_1');
  snap.rulesets[0].state = 'draft';
  assert.equal(pick(snap), null);
});
await t('a VIP profile routes to the money destination', async () => {
  const snap = snapshot(); const rs = pick(snap); const ctx = baseCtx({ profile: { ...baseCtx().profile, tags: ['vip'] } });
  const core = await evaluateContext(ctx, snap, rs, { nowIso: '2026-09-06T12:00:00Z' });
  const d = await finalizeDecision({ ctx, snapshot: snap, ruleset: rs, core, tenant: 't_root', mode: 'test', t0: 0, nowIso: '2026-09-06T12:00:00Z', request_id: 'r1', entry: 'acceptance' });
  assert.equal(d.destination_id, 'dst_money'); assert.ok(d.matched_rules.includes('rule_vip'));
});
await t('a datacenter visitor is denied by the deny rule (the blacklist works)', async () => {
  const snap = snapshot(); const rs = pick(snap); const ctx = baseCtx({ network: { ...baseCtx().network, type: 'datacenter' } });
  const core = await evaluateContext(ctx, snap, rs, { nowIso: '2026-09-06T12:00:00Z' });
  const d = await finalizeDecision({ ctx, snapshot: snap, ruleset: rs, core, tenant: 't_root', mode: 'test', t0: 0, nowIso: '2026-09-06T12:00:00Z', request_id: 'r1', entry: 'acceptance' });
  assert.equal(d.experience, 'DENY'); assert.equal(d.destination_id, null);
});
await t('an ordinary visitor falls through to the default destination', async () => {
  const snap = snapshot(); const rs = pick(snap); const ctx = baseCtx();
  const core = await evaluateContext(ctx, snap, rs, { nowIso: '2026-09-06T12:00:00Z' });
  const d = await finalizeDecision({ ctx, snapshot: snap, ruleset: rs, core, tenant: 't_root', mode: 'test', t0: 0, nowIso: '2026-09-06T12:00:00Z', request_id: 'r1', entry: 'acceptance' });
  assert.equal(d.destination_id, 'dst_safe'); assert.equal(d.fallback_used, true);
});
await t('a denylist entry decides before any rule runs', async () => {
  const snap = snapshot();
  snap.lists = [{ id: 'lst_1', list: 'deny', kind: 'device', value: 'd_1', effect: 'decide', reason: 'known abuser', priority: 1, effect_obj: {} }];
  const rs = pick(snap); const ctx = baseCtx({ profile: { ...baseCtx().profile, tags: ['vip'] } });
  const core = await evaluateContext(ctx, snap, rs, { nowIso: '2026-09-06T12:00:00Z' });
  assert.equal(core.experience, 'DENY'); assert.ok(core.list_matches.some((m) => m.id === 'lst_1'));
});
await t('a disabled destination follows its fallback chain', async () => {
  const snap = snapshot(); snap.destinations.dst_money.enabled = 0; snap.destinations.dst_money.fallback_id = 'dst_safe';
  const r = await resolveDestination(snap, 'dst_money', baseCtx());
  assert.equal(r.destination.id, 'dst_safe'); assert.equal(r.fallback_used, true);
});
await t('a group destination splits deterministically by a sticky unit', async () => {
  const snap = snapshot();
  const a = await resolveDestination(snap, 'dst_group', baseCtx());
  const b = await resolveDestination(snap, 'dst_group', baseCtx());
  assert.equal(a.destination.id, b.destination.id); // same profile → same arm
  assert.ok(['dst_money', 'dst_safe'].includes(a.destination.id));
});

console.log(`\n${n} assertions passed`);
