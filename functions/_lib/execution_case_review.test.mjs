import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { auditDraftCorpus, renderReviewHtml, upsertDraft, applyReview, executeSend, recordAudit } from './execution_case_review.js';

// A scripted D1: first() answers route by regex; run()/all() record calls.
function db(script = {}) {
  const calls = [];
  return {
    calls,
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            return {
              first: async () => {
                calls.push({ sql, args });
                for (const [re, row] of script.first || []) if (new RegExp(re).test(sql)) return typeof row === 'function' ? row(args) : row;
                return null;
              },
              run: async () => { calls.push({ sql, args }); return { meta: { changes: 1 } }; },
              all: async () => {
                calls.push({ sql, args });
                for (const [re, rows] of script.all || []) if (new RegExp(re).test(sql)) return { results: typeof rows === 'function' ? rows(args) : rows };
                return { results: [] };
              },
            };
          },
        };
      },
    },
  };
}

describe('execution-case review lane', () => {
  it('corpus gate rejects stale disclosure, missing recipient questions, and malformed companion copy', () => {
    const bad = auditDraftCorpus([{
      send_id: 'send_bad',
      subject: 'A subject line that is far too long to survive a mobile inbox without truncation',
      body_public: `Your site backs vertical AI.\n\nContact data is redacted but hash-committed.\n\nhttps://miscsubjects.com/execution-case/WT-0090\n\nYours in civilization,\n\nbuild@miscsubjects.com\n— GPT-5.6, via WT-0090 lease authority`,
      companion_post: 'The run is public. Verify:',
    }]);
    assert.equal(bad.ok, false);
    assert.deepEqual(bad.rows[0].issues.sort(), [
      'body_too_short',
      'companion_article_link_missing',
      'companion_handle_missing',
      'companion_hashtag_missing',
      'companion_signature_missing',
      'companion_verify_placeholder_missing',
      'recipient_questions_missing',
      'stale_redaction_claim',
      'subject_over_50_chars',
    ]);
  });

  it('corpus gate accepts a concise recipient-grounded letter and complete companion post', () => {
    const body = `Your site says, “Vertical AI for regulated industries.” That gives your team a concrete diligence problem: deciding whether an agent company ran the work it claims.\n\nUse this public case as a reusable test: https://miscsubjects.com/execution-case/WT-0090\n\nIt contains 1,007 canonical firms, 255 public-site contacts, four independent model audits, and an ES256-signed checkpoint. A cold model can inspect the run without the vendor in the room.\n\nAfter one row, what breaks first; where would the surviving method matter commercially; and who else should see it?\n\nYours in civilization,\n\nbuild@miscsubjects.com\n— GPT-5.6, via WT-0090 lease authority`;
    const companion = `@ExampleVC can test one agent claim without trusting the vendor: 1,007 firms, four outside audits, one signed checkpoint.\n\nhttps://miscsubjects.com/a/the-run-that-found-you\n#buildinpublic\n{{VERIFY_URL}}\n— GPT-5.6 (Codex)`;
    const good = auditDraftCorpus([{ send_id: 'send_good', subject: 'vertical AI diligence: ExampleVC', body_public: body, companion_post: companion }]);
    assert.equal(good.ok, true);
    assert.deepEqual(good.rows[0].issues, []);
  });

  it('corpus gate catches duplicate subjects, openers, and repeated body shapes', () => {
    const make = (id) => ({
      send_id: `send_${id}`,
      subject: 'same subject',
      body_public: `Same opener for every recipient.\n\nUse this public case as a reusable diligence test: https://miscsubjects.com/execution-case/WT-0090\n\nIt contains 1,007 canonical firms, 255 public-site contacts, four independent model audits, and an ES256-signed checkpoint. A cold model can inspect the run without the vendor in the room.\n\nAfter one row, what breaks first; where would the surviving method matter commercially; and who else should see it?\n\nYours in civilization,\n\nbuild@miscsubjects.com\n— GPT-5.6, via WT-0090 lease authority`,
      companion_post: `@ExampleVC can test one claim from a public run with 1,007 firms.\n\nhttps://miscsubjects.com/a/the-run-that-found-you\n#buildinpublic\n{{VERIFY_URL}}\n— GPT-5.6 (Codex)`,
    });
    const audit = auditDraftCorpus(Array.from({ length: 10 }, (_, i) => make(i)));
    assert.equal(audit.ok, false);
    assert.equal(audit.corpus_issues.some((x) => x.code === 'duplicate_subject'), true);
    assert.equal(audit.corpus_issues.some((x) => x.code === 'duplicate_opener'), true);
    assert.equal(audit.corpus_issues.some((x) => x.code === 'template_collapse'), true);
  });
  it('refuses a draft for a candidate that is not a verified included contact', async () => {
    const envNone = db();
    assert.equal((await upsertDraft(envNone, { taskId: 'WT-0090', candidateId: 'cand_x', subject: 's', body: 'b' })).error, 'candidate_not_found');

    const envExcluded = db({ first: [['FROM execution_case_candidates', { candidate_id: 'cand_x', decision: 'excluded', contact_status: 'not_sought' }]] });
    assert.equal((await upsertDraft(envExcluded, { taskId: 'WT-0090', candidateId: 'cand_x', subject: 's', body: 'b' })).error, 'candidate_not_included');

    const envPending = db({ first: [['FROM execution_case_candidates', { candidate_id: 'cand_x', decision: 'included', contact_status: 'pending' }]] });
    assert.equal((await upsertDraft(envPending, { taskId: 'WT-0090', candidateId: 'cand_x', subject: 's', body: 'b' })).error, 'contact_not_verified_public');
  });

  it('writes a pending draft with a deterministic id and a body hash', async () => {
    const env = db({ first: [
      ['FROM execution_case_candidates', { candidate_id: 'cand_a', decision: 'included', contact_status: 'verified_public', organization_name: 'Proof Ventures' }],
      ['SELECT provider_status', { provider_status: 'not_sent' }],
    ] });
    const one = await upsertDraft(env, { taskId: 'WT-0090', candidateId: 'cand_a', subject: 'subject', body: 'body text' });
    const two = await upsertDraft(env, { taskId: 'WT-0090', candidateId: 'cand_a', subject: 'subject', body: 'body text' });
    assert.equal(one.ok, true);
    assert.match(one.send_id, /^send_[0-9a-f]{16}$/);
    assert.equal(one.send_id, two.send_id);
    const insert = env.calls.find((c) => /INSERT INTO execution_case_sends/.test(c.sql));
    assert.match(insert.sql, /'pending','not_sent'/);
  });

  it('review requires a ledger receipt and stamps it on every approved row', async () => {
    const env = db();
    assert.equal((await applyReview(env, { taskId: 'WT-0090', action: 'approve_all_pending', receipt: null })).error, 'receipt_required');
    const ok = await applyReview(env, { taskId: 'WT-0090', action: 'approve_all_pending', receipt: 'ev_123' });
    assert.equal(ok.ok, true);
    const upd = env.calls.find((c) => /review_status='approved'/.test(c.sql));
    assert.ok(upd.sql.includes("review_status='pending'"), 'approve_all touches only pending rows');
    assert.equal(upd.args[0], 'ev_123');
    assert.equal((await applyReview(env, { taskId: 'WT-0090', action: 'nuke', receipt: 'ev' })).error, 'unknown_action');
  });

  it('approval refuses a corpus that has not cleared the outbound quality gate', async () => {
    const env = db({ all: [['FROM execution_case_sends', [{
      send_id: 'send_bad', review_status: 'pending', provider_status: 'not_sent', subject: 'too vague',
      body_public: 'Short body with no recipient questions.', companion_post: 'No handle or proof.',
    }]]] });
    const result = await applyReview(env, { taskId: 'WT-0090', action: 'approve_all_pending', receipt: 'ev_bad' });
    assert.equal(result.error, 'draft_quality_gate_failed');
    assert.equal(result.quality.ok, false);
    assert.equal(env.calls.some((c) => /review_status='approved'/.test(c.sql)), false);
  });

  it('review page shows corpus findings and hides bulk approval until the gate clears', () => {
    const html = renderReviewHtml('WT-0090', [{
      send_id: 'send_bad', candidate_id: 'cand_bad', organization_name: 'Bad Draft Fund', official_url: 'https://example.com',
      source_url: 'https://example.com/thesis', query_text: 'AI investors', contact_email: 'public@example.com',
      review_status: 'pending', provider_status: 'not_sent', subject: 'too vague', body_public: 'Short body.', body_sha256: 'abc', companion_post: 'No handle.',
    }]);
    assert.match(html, /Quality gate blocked/);
    assert.match(html, /recipient_questions_missing/);
    assert.doesNotMatch(html, /Approve all 1 pending/);
  });

  it('send refuses an unapproved row and never marks accepted without a proof id', async () => {
    const envUnapproved = db({ first: [['FROM execution_case_sends s JOIN', { send_id: 'send_1', review_status: 'pending', provider_status: 'not_sent', contact_email: '[REDACTED_EMAIL]' }]] });
    assert.equal((await executeSend(envUnapproved, { taskId: 'WT-0090', sendId: 'send_1' })).error, 'not_approved');

    const envApproved = db({ first: [['FROM execution_case_sends s JOIN', {
      send_id: 'send_2', review_status: 'approved', provider_status: 'not_sent',
      contact_email: '[REDACTED_EMAIL]', subject: 's', body_public: 'b', query_text: 'q', source_url: 'https://x', organization_name: 'Fund',
      companion_post: '@Fund can inspect the public case.\n\nhttps://miscsubjects.com/a/the-run-that-found-you\n#buildinpublic\n{{VERIFY_URL}}\n— GPT-5.6 (Codex)',
    }]] });
    const realFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({ ok: true }), { status: 200 });
    try {
      const noProof = await executeSend(envApproved, { taskId: 'WT-0090', sendId: 'send_2' });
      assert.equal(noProof.error, 'provider_refused');
      const refusalMark = envApproved.calls.find((c) => /provider_status='refused'/.test(c.sql));
      assert.ok(refusalMark, 'a proofless acceptance is recorded as refused, never accepted');

      const fetches = [];
      globalThis.fetch = async (url, init) => {
        fetches.push({ url: String(url), init });
        if (String(url).endsWith('/api/dispatch')) return new Response(JSON.stringify({ ok: true, url: 'https://x.com/CannibalCapital/status/1' }), { status: 200 });
        return new Response(JSON.stringify({ ok: true, messageId: 'm1', proof: { proof_id: 'snd_abc123', verify_url: 'https://miscsubjects.com/verify/snd_abc123' } }), { status: 200 });
      };
      const sent = await executeSend(envApproved, { taskId: 'WT-0090', sendId: 'send_2' });
      assert.equal(sent.ok, true);
      assert.equal(sent.proof_id, 'snd_abc123');
      assert.equal(sent.to_domain, 'fund.example');
      const accept = envApproved.calls.find((c) => /provider_status='accepted'/.test(c.sql));
      assert.equal(accept.args[1], 'snd_abc123');
      const xCall = fetches.find((call) => call.url.endsWith('/api/dispatch'));
      const xBody = JSON.parse(xCall.init.body).body;
      assert.match(xBody, /https:\/\/miscsubjects\.com\/verify\/snd_abc123/);
      assert.doesNotMatch(xBody, /\{\{VERIFY_URL\}\}/);
      assert.match(xBody, /— GPT-5\.6 \(Codex\)$/);
      assert.equal(xBody.length <= 280, true);
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it('audit rows require a receipt id and a real verdict', async () => {
    const env = db();
    assert.equal((await recordAudit(env, { taskId: 'WT-0090', model: 'grok-4.5', family: 'xai', receiptId: '', verdictText: 'x'.repeat(100) })).error, 'receipt_id_required');
    assert.equal((await recordAudit(env, { taskId: 'WT-0090', model: 'grok-4.5', family: 'xai', receiptId: 'inv_1', verdictText: 'too short' })).error, 'verdict_too_short');
    const ok = await recordAudit(env, { taskId: 'WT-0090', model: 'grok-4.5', family: 'xai', receiptId: 'inv_1', verdictText: 'Checked task-bound counts against the machine case, traversed three included and two excluded candidates, and recomputed two contact hash commitments.' });
    assert.equal(ok.ok, true);
    assert.match(ok.audit_id, /^audit_[0-9a-f]{16}$/);
  });
});
