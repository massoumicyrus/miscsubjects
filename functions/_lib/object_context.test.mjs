import assert from 'node:assert/strict';
import test from 'node:test';
import { injectObjectContext, objectContextHtml, pageRefFor } from './object_context.js';
import { shellHtml } from '../admin/_layout.js';

test('an admin path resolves to its canonical page ref', () => {
  assert.equal(pageRefFor('/admin/sheets'), 'page://admin/sheets');
  assert.equal(pageRefFor('/admin'), 'page://admin');
  assert.equal(pageRefFor('/admin/directory/models?v=1#x'), 'page://admin/directory/models');
  assert.equal(pageRefFor(''), 'page://admin');
});

test('the object context names the ref and links descriptor, rules, comparables and manual', () => {
  const html = objectContextHtml('/admin/sheets');
  assert.match(html, /<code[^>]*>page:\/\/admin\/sheets<\/code>/);
  assert.ok(html.includes('/api/environment/objects?ref=page%3A%2F%2Fadmin%2Fsheets'));
  assert.ok(html.includes('/api/environment/governance?ref=page%3A%2F%2Fadmin%2Fsheets'));
  assert.ok(html.includes('/api/environment/comparables?ref=page%3A%2F%2Fadmin%2Fsheets'));
  assert.ok(html.includes('/api/environment?format=markdown'));
});

test('injection lands inside the real admin shell header once, and never twice', () => {
  const page = shellHtml({ activeHref: '/admin/sheets', title: 'Sheets', body: '<p>grid</p>' });
  const once = injectObjectContext(page, '/admin/sheets');
  assert.equal(once.split('data-ms-object-context="1"').length - 1, 1);
  assert.ok(once.indexOf('page://admin/sheets') < once.indexOf('<main>'), 'the line sits in the header, above the page body');
  assert.equal(injectObjectContext(once, '/admin/sheets'), once);
  assert.equal(injectObjectContext('<html><body><p>bare</p></body></html>', '/admin/x').includes('page://admin/x'), true);
});
