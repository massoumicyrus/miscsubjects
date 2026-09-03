import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { planResolution, normName } from './execution_case_resolve.js';
import { isPlausiblePublicEmail } from './valid_tld.js';

const own = (n, dom, opts = {}) => ({
  candidate_id: opts.id || ('cand_' + n.replace(/\W/g, '').padEnd(20, '0').slice(0, 20)),
  organization_name: n,
  official_url: 'https://' + dom + '/',
  source_url: opts.source || ('https://' + dom + '/thesis'),
  source_quote: opts.quote || 'We invest at pre-seed in infrastructure for autonomous software agents and developer tools.',
  decision: opts.decision || 'included',
  contact_email: opts.email,
});

describe('canonical resolution', () => {
  it('dedupes a firm surfaced by many queries into ONE canonical decision', () => {
    const rows = [
      own('Khosla Ventures', 'khosla.com', { id: 'cand_a0000000000000000000', email: '[REDACTED_EMAIL]' }),
      own('Khosla Ventures', 'khoslaventures.com', { id: 'cand_a0000000000000000001' }), // diff domain, same name
      { candidate_id: 'cand_a0000000000000000002', organization_name: 'Khosla Ventures', official_url: 'https://khosla.com/', source_url: 'https://forbes.com/x', source_quote: 'a Forbes line about Khosla '.padEnd(60, '.'), decision: 'included', contact_email: null }, // loose
    ];
    const { assignments, summary } = planResolution(rows);
    assert.equal(summary.firms, 1, 'all three collapse to one firm');
    const canon = assignments.filter((a) => a.canonical);
    assert.equal(canon.length, 1);
    assert.equal(canon[0].decision, 'included');
    assert.equal(canon[0].candidate_id, 'cand_a0000000000000000000'); // the one with a valid email wins
    assert.equal(canon[0].contact_status, 'verified_public');
    assert.equal(assignments.filter((a) => !a.canonical).length, 2);
  });

  it('flips a firm that was only ever loose-included to excluded with the own-site reason', () => {
    const rows = [
      { candidate_id: 'cand_b0000000000000000000', organization_name: 'Sequoia Capital', official_url: 'https://sequoiacap.com/', source_url: 'https://forbes.com/a-partners-algorithm', source_quote: 'a Forbes line about a partner ' .padEnd(60, '.'), decision: 'included', contact_email: '[REDACTED_EMAIL]' },
    ];
    const { assignments, summary } = planResolution(rows);
    assert.equal(summary.included, 0);
    assert.equal(summary.excluded, 1);
    assert.match(assignments[0].decision_reason, /own.?site/i);
    assert.equal(assignments[0].decision, 'excluded');
    assert.equal(assignments[0].contact_status, 'not_sought');
  });

  it('never marks a garbage-TLD contact verified — it is contact_invalid', () => {
    const rows = [own('GV', 'gv.com', { id: 'cand_c0000000000000000000', email: '[REDACTED_EMAIL]' })];
    const { assignments, summary } = planResolution(rows);
    assert.equal(summary.verified_public, 0);
    assert.equal(summary.contact_invalid, 1);
    assert.equal(assignments[0].decision, 'included');
    assert.equal(assignments[0].contact_status, 'contact_invalid');
    assert.equal(isPlausiblePublicEmail('[REDACTED_EMAIL]'), false);
  });

  it('keeps genuinely distinct firms separate and normalizes names', () => {
    const rows = [
      own('Amplify Partners', 'amplifypartners.com', { id: 'cand_d0000000000000000000', email: '[REDACTED_EMAIL]' }),
      own('Zetta Venture Partners', 'zettavp.com', { id: 'cand_d0000000000000000001', email: '[REDACTED_EMAIL]' }),
    ];
    const { summary } = planResolution(rows);
    assert.equal(summary.firms, 2);
    assert.equal(normName('Andreessen Horowitz (a16z)'), 'andreessen horowitz');
    assert.equal(normName('The Andreessen Horowitz'), 'andreessen horowitz');
  });
});
