import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sanitizeSecrets, renderTurnCard } from './work_turns.js';

describe('work-turns security (sanitizeSecrets is the whole safety story)', () => {
  it('strips every secret class the build actually holds', () => {
    const cases = [
      ['authorization: Bearer abc123def456ghi789', /\[redacted-token\]/],
      ['token wlt_316bfdf943043554557459f0a521c464 minted', /\[redacted-token\]/],
      ['lease_4c99c6f776990542 held', /\[redacted-token\]/],
      ['x-terminal-key: 0a1b2c3d4e5f60718293a4b5c6d7e8f9', /x-terminal-key: \[redacted/],
      ['sha 10b40347e80eb361ba4941e7d4c278e606763ce2ef61355ba9a02fdcb73a1b8a here', /\[redacted-hex\]/],
      ['set AIG_SHIM_TOKEN and CLOUDFLARE_API_TOKEN', /\[redacted-secret-name\]/],
    ];
    for (const [input, re] of cases) assert.match(sanitizeSecrets(input), re, input);
  });

  it('strips the operator identity and local paths', () => {
    const s = sanitizeSecrets('the owner at /Users/owner/miscsubjects-pages ran it; the owner@<operator-domain>');
    assert.equal(/the owner/i.test(s), false);
    assert.equal(s.includes('/Users/'), false);
    assert.match(s, /the operator/);
  });

  it('leaves the legitimate public content intact', () => {
    const s = sanitizeSecrets('Included AI Fund (aifund.ai) for query "seed investors in agent infrastructure"; receipt inv_k9zzzqjxxj.');
    assert.match(s, /AI Fund/);
    assert.match(s, /aifund\.ai/);
    assert.match(s, /seed investors/);
    assert.match(s, /inv_k9zzzqjxxj/); // invocation ids are public receipts, not secrets
  });

  it('renders a card and escapes any HTML in the transcript', () => {
    const html = renderTurnCard({ role: 'operator', seq: 1, hash: 'abc123def456', title: 'Instruction', text: 'do <script>x</script> this', tools: [{ name: 'Edit', status: 'ok', summary: 'y' }], errors: [], refs: [{ url: 'https://x', label: 'r' }] });
    assert.match(html, /turn operator/);
    assert.equal(html.includes('<script>x</script>'), false);
    assert.match(html, /&lt;script&gt;/);
    assert.match(html, /1 tool call/);
  });
});
