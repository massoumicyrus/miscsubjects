import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isPlausiblePublicEmail, registrableDomain, VALID_TLDS } from './valid_tld.js';

describe('public email + domain validity', () => {
  it('rejects the exact garbage the cold audit found', () => {
    assert.equal(isPlausiblePublicEmail('[REDACTED_EMAIL]'), false);
    assert.equal(isPlausiblePublicEmail('[REDACTED_EMAIL]'), false);
  });
  it('accepts real addresses under real TLDs, common and uncommon', () => {
    for (const e of ['[REDACTED_EMAIL]', '[REDACTED_EMAIL]', '[REDACTED_EMAIL]', '[REDACTED_EMAIL]', '[REDACTED_EMAIL]', '[REDACTED_EMAIL]']) {
      assert.equal(isPlausiblePublicEmail(e), true, e);
    }
  });
  it('rejects malformed shapes', () => {
    for (const e of ['', 'no-at-sign', 'two@@at.com', 'a@nodot', 'a@ .com', '[REDACTED_EMAIL]']) {
      assert.equal(isPlausiblePublicEmail(e), false, e);
    }
  });
  it('has the real TLDs and not the fake ones', () => {
    assert.ok(VALID_TLDS.has('com') && VALID_TLDS.has('vc') && VALID_TLDS.has('quebec'));
    assert.ok(!VALID_TLDS.has('smae') && !VALID_TLDS.has('kcr'));
  });
  it('computes registrable domains', () => {
    assert.equal(registrableDomain('https://www.gv.com/x'), 'gv.com');
    assert.equal(registrableDomain('sequoiacap.com'), 'sequoiacap.com');
    assert.equal(registrableDomain('https://sub.example.co.uk'), 'co.uk'); // last-two-labels heuristic, documented
  });
});
