// Mechanical tests for the browser-model gateway's pure logic. No browser, no network.
// Run: node scripts/webmodel-core.test.mjs
import assert from 'node:assert/strict';
import {
  normalizeProvider, canTransition, selectCompletedTurn, isStable, redact, failure, digest,
  turnCompletedEvent, FAILURES,
} from '../bridge/webmodel/core.mjs';
import { normalizeProvider as edgeProvider, parseBody } from '../functions/_lib/webmodel_gateway.js';

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok', name); };

// ── session normalization ────────────────────────────────────────────────────────────────────
t('provider aliases normalize identically on both halves', () => {
  for (const [given, want] of [['ChatGPT Web', 'chatgpt'], ['openai', 'chatgpt'], ['Claude Web', 'claude'],
    ['anthropic', 'claude'], ['xai', 'grok'], ['Gemini Web', 'gemini'], ['moonshot', 'kimi'], ['KIMI', 'kimi']]) {
    assert.equal(normalizeProvider(given), want, `worker: ${given}`);
    assert.equal(edgeProvider(given), want, `edge: ${given}`);
  }
  assert.equal(normalizeProvider('llama'), null);
  assert.equal(edgeProvider(''), null);
});

// ── state transitions ────────────────────────────────────────────────────────────────────────
t('the state machine forbids the transitions that would let a lie through', () => {
  assert.equal(canTransition('ready', 'running'), true);
  assert.equal(canTransition('running', 'complete'), true);
  assert.equal(canTransition('closed', 'running'), false);      // a closed session cannot run
  assert.equal(canTransition('new', 'complete'), false);        // cannot complete without running
  assert.equal(canTransition('running', 'ready'), false);       // a running turn cannot be idled away
  assert.equal(canTransition('ready', 'nonsense'), false);
});

// ── completed-response selection ─────────────────────────────────────────────────────────────
t('the reply is never a message that predates the prompt', () => {
  const history = [{ text: 'old answer one' }, { text: 'old answer two' }];
  assert.equal(selectCompletedTurn(history, 2), null, 'nothing new yet -> no answer');
  assert.equal(selectCompletedTurn([...history, { text: 'the new answer', id: 'm3' }], 2).text, 'the new answer');
});
t('with several new assistant messages the last one wins', () => {
  assert.equal(selectCompletedTurn([{ text: 'old' }, { text: 'tool card' }, { text: 'final answer' }], 1).text, 'final answer');
});
t('an empty streaming placeholder is not a completed answer', () => {
  assert.equal(selectCompletedTurn([{ text: 'old' }, { text: '   ' }], 1), null);
});

// ── stabilization window ─────────────────────────────────────────────────────────────────────
t('stability is measured over the requested window, not over one poll', () => {
  // Two consecutive samples 700ms apart must NOT satisfy a 2500ms window. The first
  // implementation compared only consecutive samples, so dom_stable could never fire and
  // Claude fell all the way through to the accessibility fallback.
  assert.equal(isStable([{ text: 'x', at: 0 }, { text: 'x', at: 700 }], 2500), false);
  assert.equal(isStable([{ text: 'x', at: 0 }, { text: 'x', at: 700 }, { text: 'x', at: 1400 },
    { text: 'x', at: 2100 }, { text: 'x', at: 2800 }], 2500), true);
});
t('text still changing across the window is not stable', () => {
  assert.equal(isStable([{ text: 'partial', at: 0 }, { text: 'partial answ', at: 1500 }, { text: 'partial answer', at: 3000 }], 2500), false);
});
t('an empty reading is never stable', () => {
  assert.equal(isStable([{ text: '', at: 0 }, { text: '', at: 5000 }], 2500), false);
});

// ── redaction ────────────────────────────────────────────────────────────────────────────────
t('nothing that could re-authenticate as the owner survives redaction', () => {
  const r = redact({ url: 'https://x', cookie: 'session=abc', headers: { authorization: 'Bearer t', 'x-terminal-key': 'k' }, body: 'fine' });
  assert.equal(r.cookie, '[redacted]');
  assert.equal(r.headers.authorization, '[redacted]');
  assert.equal(r.headers['x-terminal-key'], '[redacted]');
  assert.equal(r.body, 'fine');
});

// ── failure propagation ──────────────────────────────────────────────────────────────────────
t('every failure is a named code, never a success with prose', () => {
  const f = failure('AUTH_REQUIRED', 'not signed in', { provider: 'kimi' });
  assert.equal(f.ok, false);
  assert.equal(f.error, 'AUTH_REQUIRED');
  assert.equal(f.provider, 'kimi');
  assert.equal(failure('something_made_up', 'x').error, 'BAD_REQUEST');
  for (const c of ['AUTH_REQUIRED', 'PROVIDER_UNAVAILABLE', 'SESSION_NOT_FOUND', 'SESSION_BUSY',
    'SUBMIT_FAILED', 'RESPONSE_TIMEOUT', 'RESPONSE_CAPTURE_FAILED', 'PROVIDER_RATE_LIMIT',
    'PROVIDER_USAGE_LIMIT', 'BROWSER_WORKER_OFFLINE', 'DURABLE_WRITE_FAILED', 'LEDGER_WRITE_FAILED']) {
    assert.ok(FAILURES.includes(c), `${c} must be a named failure`);
  }
});

// ── body parsing / idempotency inputs ────────────────────────────────────────────────────────
t('a prompt containing pipes survives the capability body grammar', () => {
  const b = parseBody('wms_abc|summarise a|b|c', 'session_id', 'prompt');
  assert.equal(b.session_id, 'wms_abc');
  assert.equal(b.prompt, 'summarise a|b|c');
});
t('a JSON body is honoured and a broken one is named, not guessed', () => {
  assert.equal(parseBody('{"session_id":"wms_1","prompt":"hi"}', 'session_id', 'prompt').prompt, 'hi');
  assert.equal(parseBody('{not json', 'session_id', 'prompt')._bad_json, true);
});

// ── digests + the normalized event ───────────────────────────────────────────────────────────
t('digests are stable and distinguish different text', () => {
  assert.equal(digest('GATEWAY_LIVE_OK'), digest('GATEWAY_LIVE_OK'));
  assert.notEqual(digest('GATEWAY_LIVE_OK'), digest('GATEWAY_LIVE_OKAY'));
});
t('the completion event carries no vendor-specific name', () => {
  const e = turnCompletedEvent({ provider: 'chatgpt', session_id: 's', turn_id: 't', completed_at: 'z' });
  assert.equal(e.event, 'browser_model.turn.completed');
  assert.equal(e.provider, 'chatgpt');
});

console.log(`\n${n} assertions passed`);
