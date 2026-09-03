import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const here = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');

test('one canonical manual owns every token, capability, proof, and troubleshooting path', () => {
  const migration = here('../../migrations/0354_canonical_token_manual.sql');
  for (const required of [
    '/start', 'mint_share=1', 'self_scope=1', 'narrow=1', 'revoke=',
    'BLOCK_COMMENT', 'BLOCK_EDIT', 'proof of work', '/api/proven-work/',
    'API objects', 'CLI objects', 'MCP objects', 'computer objects',
    'Authorization: Bearer', 'capability_token', 'x-write-token', 'x-block-token',
    'receipt', 'replay', 'repair', 'Troubleshooting',
  ]) assert.match(migration, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), required);
  assert.match(migration, /WHERE slug = 'oip-tap-go'/);
  assert.match(migration, /INSERT INTO oip_articles/);
  assert.match(migration, /The complete token and capability manual/);
  assert.match(migration, /NOT EXISTS[\s\S]*Troubleshooting in the right order/);
});

test('llms.txt and every Tap & Go response defer token questions to the canonical manual', () => {
  const llms = here('../llms.txt.js');
  const dispatch = here('../api/dispatch.js');
  const articleDrop = here('./article_token_drop.js');
  assert.match(llms, /CANONICAL TOKEN MANUAL[\s\S]*\/a\/oip-tap-go/);
  assert.match(dispatch, /canonicalTokenManualLink/);
  assert.match(dispatch, /tap_go_markdown: canonicalTokenManualLink/);
  assert.match(articleDrop, /DOCUMENTATION: \$\{docOrigin\}\/a\/oip-tap-go/);
});

test('homepage and every public HTML footer expose the same sources-of-truth block', () => {
  const nav = here('./design/compositions/navigation-hub.js');
  const design = here('./design_system.js');
  const home = here('../index.js');
  const middleware = here('../_middleware.js');
  for (const required of [
    'ms-canonical-docs', 'Token manual and troubleshooting', '/a/oip-tap-go',
    '/a/the-build-end-to-end', '/a/proven-work', '/a/the-work-object', '/llms.txt',
  ]) assert.match(nav, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(design, /footer as designSystemFooter/);
  assert.match(home, /designSystemFooter\(\)/);
  assert.match(middleware, /ms-canonical-docs/);
  assert.match(middleware, /Token manual and troubleshooting/);
});
