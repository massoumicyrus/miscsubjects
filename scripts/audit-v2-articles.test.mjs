import assert from 'node:assert/strict';
import test from 'node:test';

import { auditArticle } from './audit-v2-articles.mjs';

function response(body, { status = 200, type = 'application/json' } = {}) {
  return new Response(type === 'application/json' ? JSON.stringify(body) : body, {
    status,
    headers: { 'content-type': type },
  });
}

function completeArticle() {
  const claims = Array.from({ length: 13 }, (_, index) => ({
    id: `c${index + 1}`,
    text: `Claim ${index + 1}`,
    source_ids: [`s${index + 1}`],
  }));
  const sources = Array.from({ length: 15 }, (_, index) => ({
    id: `s${index + 1}`,
    type: index < 5 ? 'people' : (index === 5 ? 'independent_measurement' : 'publisher_documentation'),
    url: `https://source.test/${index + 1}`,
    title: `Source ${index + 1}`,
    quote: `Literal evidence ${index + 1}`,
    claim_ids: index < 13 ? [`c${index + 1}`] : ['c1'],
  }));
  claims[0].source_ids.push('s14', 's15');
  return {
    slug: 'complete',
    title: 'A specific article thesis',
    hero: 'https://source.test/hero.png',
    body: `## Evidence status\n\nObserved and specified evidence are labeled.\n\n${'Observed evidence. Derived result. '.repeat(500)}\n| A | B |\n|---|---|\n|1|2|\n| C | D |\n|---|---|\n|3|4|\n| E | F |\n|---|---|\n|5|6|`,
    sources,
    claims,
    widgets: Array.from({ length: 6 }, () => ({ type: 'stat', value: '1', label: 'Measured' })),
  };
}

test('passes only when API data, evidence graph, assets, links, and render all pass', async () => {
  const article = completeArticle();
  const fetchImpl = async (url) => {
    if (url === 'https://site.test/api/articles/complete') return response(article);
    if (url === 'https://site.test/a/complete') {
      return response(`<html><body><h1>${article.title}</h1>${article.body}</body></html>`, { type: 'text/html' });
    }
    return response('ok', { type: 'text/plain' });
  };
  const result = await auditArticle('complete', { baseUrl: 'https://site.test', fetchImpl });
  assert.equal(result.pass, true);
  assert.equal(result.metrics.sources, 15);
  assert.equal(result.metrics.people_sources, 5);
  assert.equal(result.metrics.claims, 13);
  assert.equal(result.metrics.widgets, 6);
  assert.equal(result.metrics.tables, 3);
  assert.deepEqual(result.failures, []);
});

test('reports thin content and every orphaned evidence edge', async () => {
  const article = completeArticle();
  article.body = 'thin';
  article.sources[0].claim_ids = ['missing-claim'];
  article.claims[1].source_ids = ['missing-source'];
  article.widgets = [];
  const fetchImpl = async (url) => {
    if (url.includes('/api/articles/')) return response(article);
    if (url.includes('/a/')) return response('runtime error', { status: 500, type: 'text/html' });
    return response('gone', { status: 404, type: 'text/plain' });
  };
  const result = await auditArticle('complete', { baseUrl: 'https://site.test', fetchImpl });
  assert.equal(result.pass, false);
  assert.equal(result.failures.some((failure) => failure.includes('body_chars')), true);
  assert.equal(result.failures.some((failure) => failure.includes('missing-claim')), true);
  assert.equal(result.failures.some((failure) => failure.includes('missing-source')), true);
  assert.equal(result.failures.some((failure) => failure.includes('render status 500')), true);
});

test('rejects a successful but stale render whose title does not match the API', async () => {
  const article = completeArticle();
  const fetchImpl = async (url) => {
    if (url.includes('/api/articles/')) return response(article);
    if (url.includes('/a/')) {
      return response(`<html><body><h1>An obsolete cached title</h1>${'healthy page '.repeat(500)}</body></html>`, { type: 'text/html' });
    }
    return response('ok', { type: 'text/plain' });
  };
  const result = await auditArticle('complete', { baseUrl: 'https://site.test', fetchImpl });
  assert.equal(result.pass, false);
  assert.equal(result.failures.includes('render title does not match article API'), true);
});

test('does not mistake an article discussing runtime-error strings for an error page', async () => {
  const article = completeArticle();
  article.body += '\n\nThe production guard rejects “internal server error” before promotion.';
  const fetchImpl = async (url) => {
    if (url.includes('/api/articles/')) return response(article);
    if (url.includes('/a/')) {
      return response(`<html><body><h1>${article.title}</h1>${article.body}</body></html>`, { type: 'text/html' });
    }
    return response('ok', { type: 'text/plain' });
  };
  const result = await auditArticle('complete', { baseUrl: 'https://site.test', fetchImpl });
  assert.equal(result.pass, true);
  assert.equal(result.failures.includes('render contains runtime-error marker'), false);
});
