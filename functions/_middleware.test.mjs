import test from 'node:test';
import assert from 'node:assert/strict';
import { guardDensityMetricClose } from './_middleware.js';

const ten = Array.from({ length: 10 }, (_, index) => `missing-${index}`).join(',');

function context(body, headers = {}, first = async () => null) {
  const request = new Request('https://miscsubjects.com/api/protocol/density-metric', {
    method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body),
  });
  return {
    request,
    env: {
      TERMINAL_KEY: 'owner-key',
      DB: { prepare: () => ({ bind: () => ({ first }) }) },
    },
  };
}

test('public corpus-sized density requests cannot change objection state', async () => {
  const ctx = context({ slugs: ten });
  const response = await guardDensityMetricClose(ctx, new URL(ctx.request.url));
  assert.equal(response.status, 403);
  const body = await response.json();
  assert.equal(body.state_changed, false);
});

test('caller-supplied missing slugs never count as a corpus scan', async () => {
  const ctx = context({ slugs: ten }, { 'x-terminal-key': 'owner-key' });
  const response = await guardDensityMetricClose(ctx, new URL(ctx.request.url));
  assert.equal(response.status, 422);
  const body = await response.json();
  assert.equal(body.eligible_articles, 0);
  assert.equal(body.state_changed, false);
});

test('small public density reads remain available', async () => {
  const ctx = context({ slugs: 'philosophy,grain-the-injustice-claim' });
  assert.equal(await guardDensityMetricClose(ctx, new URL(ctx.request.url)), null);
});

test('owner corpus scans accept legacy DIVs whose missing type means claim', async () => {
  const ctx = context({ slugs: ten }, { 'x-terminal-key': 'owner-key' }, async () => ({
    meta: JSON.stringify({ divs: [{ id: 'd1', text: 'legacy claim DIV' }] }),
  }));
  assert.equal(await guardDensityMetricClose(ctx, new URL(ctx.request.url)), null);
});
