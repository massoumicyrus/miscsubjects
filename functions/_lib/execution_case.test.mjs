import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assertDecisionComplete,
  bindCandidatesToInvocation,
  normalizeDiscoveredCandidates,
  publicCandidate,
  renderExecutionCaseHtml,
  summarizeExecutionCase,
} from './execution_case.js';

describe('large execution-case contract', () => {
  it('refuses a candidate whose inclusion or exclusion decision has no reason', () => {
    assert.throws(() => assertDecisionComplete({ decision: 'excluded', decision_reason: '' }), /decision_reason_required/);
    assert.throws(() => assertDecisionComplete({ decision: '', decision_reason: 'site did not resolve' }), /decision_must_be_included_or_excluded/);
  });

  it('publishes the recipient in full alongside its hash commitment (public-launch disclosure)', async () => {
    const row = await publicCandidate({
      candidate_id: 'cand_1',
      task_id: 'WT-0090',
      organization_name: 'Example Ventures',
      official_url: 'https://example.com',
      query_text: 'seed investors in agent infrastructure',
      source_url: 'https://example.com/thesis',
      invocation_id: 'inv_abc',
      canonical: 1,
      decision: 'included',
      decision_reason: 'The official thesis names seed investments in agent infrastructure.',
      contact_status: 'verified_public',
      contact_email: 'partners@example.com',
      contact_source_url: 'https://example.com/contact',
      contact_valid: 1,
    });

    assert.equal(row.decision, 'included');
    assert.equal(row.canonical, true);
    assert.equal(row.receipt_url, 'https://miscsubjects.com/receipt/inv_abc');
    assert.match(row.decision_reason, /official thesis/);
    assert.deepEqual(row.contact, {
      status: 'verified_public',
      source_url: 'https://example.com/contact',
      email: 'partners@example.com',
      email_redacted: 'pa…@example.com',
      email_sha256: '1fc3a6bd2f65f8d9300a6058691632196934a780e8f06c89a98e805c32da8f95',
      valid: true,
    });
    // The masked form is still available for any caller that wants it.
    const masked = await publicCandidate({ ...row, contact_status: 'verified_public', contact_email: 'partners@example.com', decision: 'included', decision_reason: 'x' }, { revealContact: false });
    assert.equal(masked.contact.email, null);
    assert.equal(masked.contact.email_redacted, 'pa…@example.com');
  });

  it('counts only rows bound to the requested task', () => {
    const summary = summarizeExecutionCase('WT-0090', {
      candidates: [
        { task_id: 'WT-0090', decision: 'included', contact_status: 'verified_public' },
        { task_id: 'WT-0090', decision: 'excluded', contact_status: 'not_sought' },
        { task_id: 'WT-0089', decision: 'included', contact_status: 'verified_public' },
      ],
      sends: [
        { task_id: 'WT-0090', provider_status: 'accepted', proof_id: 'snd_1' },
        { task_id: 'WT-0089', provider_status: 'accepted', proof_id: 'snd_old' },
      ],
      audits: [
        { task_id: 'WT-0090', verdict_text: 'valid', receipt_id: 'inv_1' },
        { task_id: 'WT-0090', verdict_text: null, receipt_id: 'inv_2' },
      ],
    });

    assert.deepEqual(summary, {
      task_id: 'WT-0090',
      candidates: 2,
      included: 1,
      excluded: 1,
      verified_public_contacts: 1,
      raw_discovery_decisions: 2,
      superseded_duplicates: 0,
      provider_accepted_sends: 1,
      executed_cold_audits: 1,
    });
  });

  it('turns every discovery return into an included or excluded decision row', async () => {
    const rows = await normalizeDiscoveredCandidates({
      taskId: 'WT-0090',
      query: 'seed investors in agent infrastructure',
      returned: [
        {
          name: 'Proof Ventures',
          website: 'https://proof.example',
          city: 'New York',
          source_url: 'https://proof.example/thesis',
          source_quote: 'We invest at pre-seed in infrastructure for autonomous software agents.',
        },
        { name: 'Directory profile', website: 'https://linkedin.com/company/proof', city: 'New York' },
        { name: 'Unsupported claim', website: 'https://unsupported.example', city: 'Boston' },
      ],
    });

    assert.equal(rows.length, 3);
    assert.deepEqual(rows.map((row) => row.decision), ['included', 'excluded', 'excluded']);
    assert.match(rows[1].decision_reason, /third-party directory/);
    assert.match(rows[2].decision_reason, /official source quote/);
    assert.equal(rows.every((row) => row.task_id === 'WT-0090' && row.query_text.includes('seed investors')), true);
  });

  it('summarizes from whole-task SQL counts, never from the fetched page', async () => {
    const { loadExecutionCase } = await import('./execution_case.js');
    const calls = [];
    const env = {
      DB: {
        prepare(sql) {
          return {
            bind(...args) {
              return {
                first: async () => {
                  calls.push({ sql, args });
                  if (/FROM work_tasks/.test(sql)) return { id: 'WT-0090', state: 'leased' };
                  if (/SELECT\s+\(SELECT COUNT/.test(sql)) return { candidates: 1400, included: 792, excluded: 608, verified_public_contacts: 199, receipt_bound_candidates: 1314, provider_accepted_sends: 0, executed_cold_audits: 0 };
                  return null;
                },
                all: async () => { calls.push({ sql, args }); return { results: [] }; },
              };
            },
          };
        },
      },
    };
    const data = await loadExecutionCase(env, 'WT-0090', { candidateLimit: 100, candidateOffset: 200 });
    assert.equal(data.summary.candidates, 1400);
    assert.equal(data.summary.receipt_bound_candidates, 1314);
    assert.equal(data.page.candidates_total, 1400);
    assert.equal(data.page.candidates_offset, 200);
    assert.equal(data.page.next_offset, 200);
    const pageQuery = calls.find((c) => /LIMIT \? OFFSET \?/.test(c.sql));
    assert.deepEqual(pageQuery.args.slice(1), [100, 200]);
  });

  it('binds included and excluded candidate rows to the receipted invocation, only while unbound', async () => {
    const calls = [];
    const env = {
      DB: {
        prepare(sql) {
          return {
            bind(...args) {
              return { run: async () => { calls.push({ sql, args }); return { meta: { changes: args.length - 3 } }; } };
            },
          };
        },
      },
    };
    const cand = (n) => 'cand_' + String(n).padStart(20, '0').replace(/[^0-9a-f]/g, '0');
    const result = JSON.stringify({
      class: 'ai-infra-investors',
      task_id: 'WT-0090',
      included: 2,
      excluded: 1,
      candidate_ids: [cand(1), cand(2), cand(3)],
    });
    const bound = await bindCandidatesToInvocation(env, 'inv_abc123', result, '2026-08-28T00:00:00.000Z');
    assert.equal(bound, 3);
    assert.equal(calls.length, 1);
    assert.match(calls[0].sql, /invocation_id IS NULL/);
    assert.deepEqual(calls[0].args.slice(0, 3), ['inv_abc123', '2026-08-28T00:00:00.000Z', 'WT-0090']);
    assert.deepEqual(calls[0].args.slice(3), [cand(1), cand(2), cand(3)]);
  });

  it('chunks large candidate lists and ignores results that are not task-bound discovery returns', async () => {
    const calls = [];
    const env = {
      DB: { prepare(sql) { return { bind(...args) { return { run: async () => { calls.push({ sql, args }); return { meta: { changes: args.length - 3 } }; } }; } }; } },
    };
    const many = Array.from({ length: 60 }, (_, i) => 'cand_' + i.toString(16).padStart(20, '0'));
    const bound = await bindCandidatesToInvocation(env, 'inv_big', JSON.stringify({ task_id: 'WT-0090', candidate_ids: many }));
    assert.equal(bound, 60);
    assert.equal(calls.length, 2);

    assert.equal(await bindCandidatesToInvocation(env, 'inv_x', JSON.stringify({ ok: true })), 0);
    assert.equal(await bindCandidatesToInvocation(env, 'inv_x', JSON.stringify({ task_id: 'nope', candidate_ids: ['cand_' + '0'.repeat(20)] })), 0);
    assert.equal(await bindCandidatesToInvocation(env, 'inv_x', JSON.stringify({ task_id: 'WT-0090', candidate_ids: ['DROP TABLE'] })), 0);
    assert.equal(await bindCandidatesToInvocation(env, null, JSON.stringify({ task_id: 'WT-0090', candidate_ids: ['cand_' + '0'.repeat(20)] })), 0);
    assert.equal(calls.length, 2);
  });

  it('renders one browser door per firm, recipients shown in full with their hash and receipt', () => {
    const html = renderExecutionCaseHtml({
      task: { id: 'WT-0090', objective: 'Large public run', state: 'in_progress' },
      summary: { candidates: 1000, included: 300, excluded: 700, verified_public_contacts: 100, provider_accepted_sends: 100, executed_cold_audits: 4, raw_discovery_decisions: 1400, superseded_duplicates: 400, receipt_bound_candidates: 990, contact_invalid: 1 },
      candidates: [{ candidate_id: 'cand_1', organization_name: 'Proof Ventures', official_url: 'https://proof.example/', source_url: 'https://proof.example/thesis', source_quote: 'We invest at pre-seed in infrastructure for autonomous software agents.', decision: 'included', decision_reason: 'Official thesis matches.', invocation_id: 'inv_k9', receipt_url: 'https://miscsubjects.com/receipt/inv_k9', contact: { status: 'verified_public', email: '[REDACTED_EMAIL]', email_sha256: 'abc', source_url: 'https://proof.example/contact', valid: true } }],
      sends: [{ send_id: 'send_1', candidate_id: 'cand_1', subject: 'your agent audit', body: 'A cold model can inspect the run.', proof_id: 'snd_1', verify_url: 'https://miscsubjects.com/verify/snd_1', provider_status: 'accepted' }],
      audits: [{ model: 'Grok 4.5', family: 'xai', receipt_id: 'inv_1', verdict: 'Valid with one objection.' }],
    });
    assert.match(html, /Verify the run yourself/);
    assert.match(html, /\/api\/execution-case\/WT-0090/);
    assert.match(html, /\/api\/work-evidence\/WT-0090\/verify/);
    assert.match(html, /1,000/);
    assert.match(html, /partners@proof\.example/); // recipient shown in full (owner order, public launch)
    assert.match(html, /receipt\/inv_k9/); // every row links its receipt
    assert.match(html, /1,400/); // raw discovery total is disclosed alongside the deduped count
    assert.match(html, /view=raw/);
  });
});
