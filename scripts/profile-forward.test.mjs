// The forwarding adapter's pure halves: what leaves the build, and what never does.
// node scripts/profile-forward.test.mjs
import assert from 'node:assert/strict';
import { metaEventBody, klaviyoEventBody, normalizeEmail, normalizePhone, sha256Hex, META_EVENT_NAMES } from '../functions/_lib/profile_forward.js';

let n = 0;
const atest = async (name, fn) => { try { await fn(); n++; console.log('ok', name); } catch (e) { console.log('FAIL', name); throw e; } };

const ev = { id: 'evt_1', profile_id: 'prf_a', event_type: 'ADD_TO_CART', ts: '2026-09-06T20:00:00Z', url: 'https://miscsubjects.com/a/x', source: 'beacon', payload: { sku: 'BPC-157-10', email: ' Jane@Example.com ', phone: '(424) 555-0100' } };

await atest('Meta receives hashed identifiers only, never the raw email or phone', async () => {
  const b = await metaEventBody(ev);
  const s = JSON.stringify(b);
  assert.ok(!s.includes('Example.com') && !s.includes('jane@example.com') && !s.includes('4245550100'), 'raw identifier leaked');
  assert.deepEqual(b.data[0].user_data.em, [await sha256Hex('jane@example.com')]);
  assert.deepEqual(b.data[0].user_data.ph, [await sha256Hex('4245550100')]);
  assert.deepEqual(b.data[0].user_data.external_id, [await sha256Hex('prf_a')]);
  assert.equal(b.data[0].event_name, 'AddToCart'); assert.equal(b.data[0].event_id, 'evt_1'); assert.equal(b.data[0].custom_data.sku, 'BPC-157-10');
  assert.equal(b.test_event_code, undefined);
});
await atest('without PII in the payload Meta still gets a joinable external_id and nothing else', async () => {
  const b = await metaEventBody({ ...ev, payload: { sku: 'x' } });
  assert.deepEqual(Object.keys(b.data[0].user_data), ['external_id']);
});
await atest('a test event code is echoed when configured', async () => {
  const b = await metaEventBody(ev, { pixelTestCode: 'TEST123' });
  assert.equal(b.test_event_code, 'TEST123');
});
await atest('an unmapped first-party type goes to Meta as a custom event under its own name', async () => {
  const b = await metaEventBody({ ...ev, event_type: 'DEVICE_TRUSTED', payload: {} });
  assert.equal(b.data[0].event_name, 'DEVICE_TRUSTED'); assert.equal(META_EVENT_NAMES.ORDER_CREATED, 'Purchase');
});
await atest('Klaviyo is keyed on external_id and only carries email or phone when the payload had them', async () => {
  const withPii = klaviyoEventBody(ev).data.attributes.profile.data.attributes;
  assert.equal(withPii.external_id, 'prf_a'); assert.equal(withPii.email, 'jane@example.com'); assert.equal(withPii.phone_number, '+4245550100');
  const without = klaviyoEventBody({ ...ev, payload: { sku: 'x' } }).data.attributes;
  assert.deepEqual(Object.keys(without.profile.data.attributes), ['external_id']);
  assert.equal(without.metric.data.attributes.name, 'ADD_TO_CART'); assert.equal(without.unique_id, 'evt_1');
});
await atest('normalisers refuse junk rather than forwarding it', async () => {
  assert.equal(normalizeEmail('not an email'), null); assert.equal(normalizePhone('12'), null); assert.equal(normalizePhone('+1 (424) 555-0100'), '14245550100');
});
console.log(`\n${n} assertions passed`);
