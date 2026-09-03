import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet } from './[[path]].js';

function envFor(rows) {
  return {
    DB: {
      prepare(sql) {
        let values = [];
        return {
          bind(...next) { values = next; return this; },
          async first() {
            if (sql.includes('FROM articles') && sql.includes('meta')) return rows.article?.[values[0]] || null;
            if (sql.includes('FROM articles')) return rows.article?.[values[0]] ? { slug: values[0] } : null;
            if (sql.includes('FROM discourse')) return rows.discourse?.[values[0]] || null;
            if (sql.includes('FROM directory')) return rows.tool?.[values[0]] ? { key: values[0] } : null;
            return null;
          },
        };
      },
    },
  };
}

test('claim and discourse stable links resolve to exact article anchors', async () => {
  const env = envFor({
    article: { proof: { meta: JSON.stringify({ claims: [{ id: 'c1' }], divs: [{ id: 'd1' }] }) } },
    discourse: { 'arg-1': { id: 'arg-1', slug: 'proof' } }, tool: {},
  });
  const claim = await onRequestGet({ request: new Request('https://miscsubjects.com/i/claim/proof/c1'), env });
  assert.equal(claim.status, 302);
  assert.equal(claim.headers.get('location'), 'https://miscsubjects.com/a/proof#claim-c1');
  const argument = await onRequestGet({ request: new Request('https://miscsubjects.com/i/discourse/arg-1'), env });
  assert.equal(argument.status, 302);
  assert.equal(argument.headers.get('location'), 'https://miscsubjects.com/a/proof#disc-arg-1');
});

test('stable item JSON carries both human and machine representations', async () => {
  const env = envFor({ article: { proof: { meta: '{}' } }, discourse: {}, tool: { VOXEL_EDIT: true } });
  const response = await onRequestGet({ request: new Request('https://miscsubjects.com/i/article/proof?format=json'), env });
  const body = await response.json();
  assert.equal(body.stable_url, 'https://miscsubjects.com/i/article/proof');
  assert.equal(body.human_url, 'https://miscsubjects.com/a/proof');
  assert.equal(body.machine_url, 'https://miscsubjects.com/api/articles/proof');
});
