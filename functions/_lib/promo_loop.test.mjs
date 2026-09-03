import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { makePromoFnMap } from './promo_loop.js';

// A scripted D1: routes each prepared statement by pattern, records every call.
function fakeEnv({ claimedIds = [], taskCounts = [] } = {}) {
  const calls = [];
  return {
    calls,
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            const record = { sql, args };
            return {
              run: async () => { calls.push(record); return { meta: { changes: 0 } }; },
              all: async () => {
                calls.push(record);
                if (/SET status='enriching'/.test(sql)) return { results: claimedIds.map((id) => ({ id })) };
                if (/GROUP BY contact_status/.test(sql)) return { results: taskCounts };
                return { results: [] };
              },
            };
          },
          run: async () => { calls.push({ sql, args: [] }); return { meta: { changes: 0 } }; },
        };
      },
    },
  };
}

describe('task-scoped enrichment front', () => {
  it('delegates to the ambient batch when no task is given', async () => {
    let delegated = null;
    const map = makePromoFnMap({
      buildNowIso: () => '2026-08-28T00:00:00.000Z',
      xaiSearch: async () => ({ err: 'unused' }),
      pipeJson: () => null,
      enrichLead: async () => { throw new Error('must not crawl'); },
      enrichBatchBase: async (env, countArg) => { delegated = countArg; return JSON.stringify({ ambient: true }); },
    });
    const out = JSON.parse(await map.leadsEnrichBatchTask(fakeEnv(), '4', ''));
    assert.equal(delegated, '4');
    assert.equal(out.ambient, true);
  });

  it('refuses a malformed task id', async () => {
    const map = makePromoFnMap({ buildNowIso: () => '', xaiSearch: async () => ({}), pipeJson: () => null, enrichLead: async () => '', enrichBatchBase: async () => '' });
    const out = JSON.parse(await map.leadsEnrichBatchTask(fakeEnv(), '4', 'not-a-task'));
    assert.match(out.error, /WT-0090/);
  });

  it('claims only leads bound to the task, syncs pre-resolved candidates first, crawls each claim', async () => {
    const crawled = [];
    const env = fakeEnv({ claimedIds: [11, 12], taskCounts: [{ contact_status: 'verified_public', n: 2 }] });
    const map = makePromoFnMap({
      buildNowIso: () => '2026-08-28T00:00:00.000Z',
      xaiSearch: async () => ({ err: 'unused' }),
      pipeJson: () => null,
      enrichLead: async (envArg, id) => { crawled.push(id); return JSON.stringify({ id, email: '[REDACTED_EMAIL]', status: 'enriched' }); },
      enrichBatchBase: async () => { throw new Error('must not run ambient'); },
    });
    const out = JSON.parse(await map.leadsEnrichBatchTask(env, '8', 'WT-0090'));

    assert.deepEqual(crawled, [11, 12]);
    assert.equal(out.task_id, 'WT-0090');
    assert.equal(out.enriched_this_call, 2);
    assert.equal(out.units, 2);
    assert.deepEqual(out.task_contact_status, [{ contact_status: 'verified_public', n: 2 }]);

    const sqls = env.calls.map((c) => c.sql);
    const claim = sqls.find((s) => /SET status='enriching'/.test(s));
    assert.match(claim, /execution_case_candidates c ON c\.lead_id=l\.id/);
    assert.match(claim, /c\.task_id=\? AND c\.decision='included' AND c\.contact_status='pending'/);
    const syncVerified = sqls.findIndex((s) => /contact_status='verified_public'/.test(s) && /email IS NOT NULL/.test(s));
    const syncMissing = sqls.findIndex((s) => /status IN \('no_email','no_site'\)/.test(s));
    const claimAt = sqls.indexOf(claim);
    assert.ok(syncVerified >= 0 && syncVerified < claimAt, 'pre-resolved sync runs before the claim');
    assert.ok(syncMissing >= 0 && syncMissing < claimAt, 'exhausted-lead sync runs before the claim');
  });
});
