import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { ARTICLE_EDGE_CACHE_VERSION, edgeCacheUrls, purgeArticlePageCache } from './edge_cache.js';


test('edgeCacheUrls carry the version — an unversioned purge deletes nothing', () => {
  const urls = edgeCacheUrls('/a/philosophy');
  assert.equal(urls.length, 2);
  for (const u of urls) assert.ok(u.includes('__edge_v=' + ARTICLE_EDGE_CACHE_VERSION), u);
  assert.ok(urls.some((u) => u.includes('__lean=1')), 'the lean fetcher copy has its own key');
});

test('purgeArticlePageCache deletes the versioned edge entries and the KV snapshots', async () => {
  const deletedCache = [];
  const deletedKv = [];
  const env = { KV: { async delete(key) { deletedKv.push(key); } } };
  const cacheStore = { async delete(req) { deletedCache.push(req.url); return true; } };
  await purgeArticlePageCache(env, 'philosophy', { indexes: true, cacheStore });
  assert.deepEqual(deletedKv, ['lastgood:/a/philosophy', 'lastgood:/api/articles/philosophy']);
  for (const path of ['/a/philosophy', '/content', '/latest']) {
    for (const u of edgeCacheUrls(path)) {
      assert.ok(deletedCache.includes(u), 'missing purge of ' + u);
    }
  }
  assert.ok(deletedCache.every((u) => u.includes('__edge_v=')), 'every purge is versioned');
});

test('voxel-edit path purges the page cache in the same request', () => {
  // Style of the sibling contract tests: read the route source and pin the mechanism.
  // voxelSaveArticle is the single save every voxel write verb (divide/edit/move/
  // consolidate/batch) goes through, so the purge there covers them all.
  const route = readFileSync(new URL('../api/protocol/[[path]].js', import.meta.url), 'utf8');
  assert.match(route, /import\s*\{\s*purgeArticlePageCache\s*\}\s*from\s*["']\.\.\/\.\.\/_lib\/edge_cache\.js["']/);
  const save = route.slice(route.indexOf('async function voxelSaveArticle'));
  const saveBody = save.slice(0, save.indexOf('\n}'));
  assert.match(saveBody, /if \(saved\) await purgeArticlePageCache\(env, slug\)/);
  // voxel-void mutates the discourse table directly, outside voxelSaveArticle — it purges too.
  const voidFn = route.slice(route.indexOf('async function voxelVoidAction'));
  const voidBody = voidFn.slice(0, voidFn.indexOf('\n}'));
  assert.match(voidBody, /purgeArticlePageCache\(env, row\.slug\)/);
});

test('article PUT/PATCH purge goes through the versioned helper, not the plain URL', () => {
  const route = readFileSync(new URL('../api/articles/[[path]].js', import.meta.url), 'utf8');
  assert.match(route, /import\s*\{\s*purgeArticlePageCache\s*\}\s*from\s*['"]\.\.\/\.\.\/_lib\/edge_cache\.js['"]/);
  assert.match(route, /await purgeArticlePageCache\(env, slug, \{ indexes: true \}\)/);
  assert.doesNotMatch(route, /caches\.default\.delete\(new Request\(origin \+ p/);
});
