import assert from 'node:assert/strict';
import test from 'node:test';
import { makeFnMap } from './fn_runners.js';

test('GRAPH_LINT reads the compact next-acts response instead of the resource-heavy full lint payload', async () => {
  const originalFetch = globalThis.fetch;
  let requested = '';
  globalThis.fetch = async (url) => {
    requested = String(url);
    return new Response(JSON.stringify({
      counts: {
        articles: 1015,
        edges: 3000,
        missing_pages: 12,
        orphans: 20,
        unsourced_claim_articles: 3,
        contested_articles: 2,
        stale: 4,
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const result = await makeFnMap({}).protoGraphLint({});
    assert.equal(requested, 'https://miscsubjects.com/api/articles/next-acts?limit=1');
    assert.match(result, /Graph lint: 1015 articles · 3000 edges/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
