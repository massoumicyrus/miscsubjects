import test from 'node:test';
import assert from 'node:assert/strict';
import { claimDivsForMeta, renderArticleStateMastheadHtml, renderClaimSurfaceHtml } from './claim_surface.js';
import { renderDiscourseServerHtml } from './discourse_widgets.js';

test('formal claims become stable hashed DIVs with blind-model instructions', async () => {
  const claims = await claimDivsForMeta('proof', { claims: [{ id: 'c1', text: 'A falsifiable claim.', tier: 'observed' }] });
  assert.equal(claims[0].id, 'claim:c1');
  assert.match(claims[0].content_hash, /^[a-f0-9]{64}$/);
  assert.equal(claims[0].stable_url, 'https://miscsubjects.com/i/claim/proof/c1');
  const html = renderClaimSurfaceHtml('proof', claims, { thread_head: 'genesis', entries: [] });
  assert.match(html, /data-machine-contribution-surface="1"/);
  assert.match(html, /expected_thread_head/);
  assert.match(html, /voxel-challenge/);
  assert.match(html, /voxel-edit/);
});

test('server discourse cards expose exact model, date, type, argument and link safely', () => {
  const html = renderDiscourseServerHtml('proof', { entries: [{
    id: 'arg-1', slug: 'proof', target_div: 'claim:c1', family: 'gpt', claimed_model: 'GPT <5>',
    stance: 'challenge', body: '<script>not executable</script>', status: 'open', filed_at: '2026-07-16T12:00:00Z',
  }] });
  assert.match(html, /data-server-rendered="1"/);
  assert.match(html, /GPT &lt;5&gt;/);
  assert.match(html, /CHALLENGE/);
  assert.match(html, /2026-07-16/);
  assert.match(html, /&lt;script&gt;not executable&lt;\/script&gt;/);
  assert.match(html, /\/i\/discourse\/arg-1/);
  assert.doesNotMatch(html, /<script>not executable<\/script>/);
});

test('cold HTML masthead states the exact unbacked claim-DIV count', () => {
  const html = renderArticleStateMastheadHtml('proof', { divs: [
    { id: 'd1', type: 'claim', sources: [] },
    { id: 'd2', type: 'claim', sources: ['s1'] },
    { id: 'd3', type: 'structural', sources: [] },
  ] }, { counts: { open: 2 }, strongest_open: { id: 'obj-1' } });
  assert.match(html, /1 of 2 claim-DIVs rest on unbacked assertions/);
  assert.match(html, /data-server-rendered="1"/);
  assert.match(html, /\/i\/discourse\/obj-1/);
  assert.match(html, /2 open/);
});
