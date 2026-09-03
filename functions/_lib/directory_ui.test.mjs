import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet } from '../admin/directory/index.js';

function env() {
  return {
    DB: {
      prepare(sql) {
        return {
          async all() {
            if (sql.includes('FROM directory')) return { results: [{ key: 'ALPHA', type: 'fn', target: 'alpha', category: 'tools', created_at: '2026-07-01T00:00:00Z' }] };
            if (sql.includes('FROM articles')) return { results: [{ key: 'opos', type: 'content', target: 'OPOS', category: 'content', created_at: '2026-07-21T00:00:00Z', updated_at: '2026-07-21T01:00:00Z', href: '/a/opos' }] };
            if (sql.includes('FROM pages')) return { results: [{ key: 'privacy', type: 'page', target: 'Privacy', category: 'page', created_at: '2026-06-01T00:00:00Z', updated_at: '2026-06-02T00:00:00Z' }] };
            return { results: [] };
          },
        };
      },
    },
    LEDGER: { prepare() { return { async all() { return { results: [] }; } }; } },
  };
}

test('directory data gives content real dates, sane categories, and the audit Tap & Go row', async () => {
  const response = await onRequestGet({ request: new Request('https://miscsubjects.com/admin/directory?data=directory'), env: env() });
  const payload = await response.json();
  const article = payload.rows.find(row => row.key === 'opos');
  const drop = payload.rows.find(row => row.key === 'OPOS_AUDIT_TAP_GO');
  assert.equal(article.category, 'content');
  assert.equal(article.created_at, '2026-07-21T00:00:00Z');
  assert.equal(article.href, '/a/opos');
  assert.equal(drop.href, '/api/dispatch?tap_go=1&drop=audit');
  assert.equal(drop.featured, 1);
});

test('switching primary Directory sections clears stale secondary filters and preserves newest sort', async () => {
  const response = await onRequestGet({ request: new Request('https://miscsubjects.com/admin/directory'), env: env() });
  const html = await response.text();
  assert.match(html, /elv\('dir-filter'\)\.value = ''/);
  assert.match(html, /elv\('dir-use'\)\.value = ''/);
  assert.match(html, /elv\('dir-cat'\)\.value = ''/);
  assert.match(html, /refreshCategories\(\)/);
  assert.match(html, /\(b\.featured\|\|0\)-\(a\.featured\|\|0\)/);
  assert.match(html, /DIR_PAGE_SIZE = 200/);
  assert.match(html, /<option value="new" selected>Newest added<\/option>/);
});

test('directory time parser orders mixed SQLite, UTC ISO, and offset ISO timestamps by time', async () => {
  const response = await onRequestGet({ request: new Request('https://miscsubjects.com/admin/directory'), env: env() });
  const html = await response.text();
  const source = html.match(/function rowTime\(r\)\{[\s\S]*?\n\}/)?.[0];
  assert.ok(source, 'rowTime function embedded');
  const rowTime = Function(source + '; return rowTime;')();
  const sqliteLater = rowTime({ created_at: '2026-07-21 23:47:00' });
  const isoEarlier = rowTime({ created_at: '2026-07-21T22:04:00Z' });
  const offsetSame = rowTime({ created_at: '2026-07-21T16:47:00-07:00' });
  assert.ok(sqliteLater > isoEarlier);
  assert.equal(sqliteLater, offsetSame);
});
