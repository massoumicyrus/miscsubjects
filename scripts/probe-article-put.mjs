// End-to-end probe: mint a slug-scoped write token, invoke ARTICLE_PUT with it as
// a body field, then verify the published title/body via the live article API.
// Usage: node scripts/probe-article-put.mjs
import { readFileSync } from 'node:fs';

const envFile = readFileSync(process.env.HOME + '/.config/grok-bridge.env', 'utf8');
const tk = (envFile.match(/^TERMINAL_KEY=(.+)$/m) || [])[1];
if (!tk) { console.error('no TERMINAL_KEY'); process.exit(1); }

const BASE = 'https://miscsubjects.com';
const SLUG = 'probe-article-put-' + Date.now();
const TITLE = 'Probe: ARTICLE_PUT write-token forward (e2e)';
const BODY = '# Probe\n\nEnd-to-end test of the write_token forward in runHttp. ' + new Date().toISOString();

async function main() {
  // 1. Mint a slug-scoped write token.
  const chal = await fetch(`${BASE}/api/write-gate/challenge?slug=${SLUG}`).then(r => r.json());
  if (!chal.challenge_id) throw new Error('challenge failed: ' + JSON.stringify(chal).slice(0, 200));
  const ans = await fetch(`${BASE}/api/write-gate/answer`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-terminal-key': tk },
    body: JSON.stringify({
      challenge_id: chal.challenge_id,
      law_hash: chal.law_hash,
      answers: Object.fromEntries(chal.clauses.map(c => [c.id, c.title]))
    })
  }).then(r => r.json());
  if (!ans.ok) throw new Error('answer failed: ' + JSON.stringify(ans));
  const writeToken = ans.write_token;

  // 2. Invoke ARTICLE_PUT with write_token in the body.
  const articleJson = JSON.stringify({ slug: SLUG, title: TITLE, body: BODY, write_token: writeToken });
  const disp = await fetch(`${BASE}/api/dispatch?key=ARTICLE_PUT`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-terminal-key': tk },
    body: JSON.stringify({ key: 'ARTICLE_PUT', body: articleJson })
  }).then(r => r.json());
  console.log('dispatch:', JSON.stringify(disp).slice(0, 400));

  // 3. Verify via live article API.
  const live = await fetch(`${BASE}/api/articles/${SLUG}`).then(r => r.json());
  console.log('live title:', live.title);
  console.log('live body starts:', (live.body || '').slice(0, 60));
  console.log('live body len:', (live.body || '').length);

  const ok = live.title === TITLE && (live.body || '').startsWith('# Probe') && (live.body || '').length === BODY.length;
  console.log(ok ? 'PASS' : 'FAIL');
  process.exit(ok ? 0 : 1);
}
main().catch(e => { console.error('ERR', e); process.exit(1); });
