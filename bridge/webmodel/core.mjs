// Pure logic for the browser-model gateway: no browser, no network, no filesystem.
// Everything here is unit-testable and is tested by scripts/webmodel-core.test.mjs.

import crypto from 'node:crypto';
import { PROVIDERS } from './adapters/index.mjs';

// Named failures. A caller never gets `ok:true` with an error string buried in the text.
export const FAILURES = [
  'AUTH_REQUIRED', 'PROVIDER_UNAVAILABLE', 'SESSION_NOT_FOUND', 'SESSION_BUSY', 'SUBMIT_FAILED',
  'RESPONSE_TIMEOUT', 'RESPONSE_CAPTURE_FAILED', 'PROVIDER_RATE_LIMIT', 'PROVIDER_USAGE_LIMIT',
  'BROWSER_WORKER_OFFLINE', 'DURABLE_WRITE_FAILED', 'LEDGER_WRITE_FAILED', 'UNKNOWN_PROVIDER',
  'BAD_REQUEST',
];

export const SESSION_STATES = ['new', 'ready', 'running', 'complete', 'auth_required', 'failed', 'closed'];

const TRANSITIONS = {
  new: ['ready', 'running', 'auth_required', 'failed', 'closed'],
  ready: ['running', 'auth_required', 'failed', 'closed'],
  running: ['complete', 'failed', 'auth_required', 'closed'],
  complete: ['running', 'ready', 'auth_required', 'failed', 'closed'],
  auth_required: ['ready', 'running', 'failed', 'closed'],
  failed: ['ready', 'running', 'closed'],
  closed: [],
};

export function canTransition(from, to) {
  if (!SESSION_STATES.includes(to)) return false;
  if (!from) return to === 'new';
  return (TRANSITIONS[from] || []).includes(to);
}

export function normalizeProvider(p) {
  const s = String(p == null ? '' : p).toLowerCase().trim();
  const alias = { 'chatgpt web': 'chatgpt', openai: 'chatgpt', gpt: 'chatgpt',
    'claude web': 'claude', anthropic: 'claude', 'grok web': 'grok', xai: 'grok',
    'gemini web': 'gemini', google: 'gemini', 'kimi web': 'kimi', moonshot: 'kimi' };
  const v = alias[s] || s;
  return PROVIDERS.includes(v) ? v : null;
}

export function failure(code, message, extra = {}) {
  return { ok: false, error: FAILURES.includes(code) ? code : 'BAD_REQUEST', message: String(message || code), ...extra };
}

export function digest(s) {
  return 'sha256:' + crypto.createHash('sha256').update(String(s == null ? '' : s), 'utf8').digest('hex');
}

export function newId(prefix) { return `${prefix}_${crypto.randomBytes(9).toString('hex')}`; }

// The answer to THIS prompt is the last assistant node whose index is at or past the count of
// assistant nodes that already existed when the prompt was submitted. Anything at a lower index
// is conversation history and must never be returned as the reply.
export function selectCompletedTurn(nodes, priorCount) {
  const list = Array.isArray(nodes) ? nodes : [];
  if (list.length <= priorCount) return null;
  const fresh = list.slice(priorCount).filter((n) => n && typeof n.text === 'string' && n.text.trim().length);
  if (!fresh.length) return null;
  return fresh[fresh.length - 1];
}

// The text has stopped changing if the newest reading equals the newest reading that is at least
// `stableMs` older. Comparing merely CONSECUTIVE readings is wrong — they are one poll apart, so
// the real window becomes the poll interval and stabilization can never fire.
export function isStable(samples, stableMs) {
  if (samples.length < 2) return false;
  const last = samples[samples.length - 1];
  if (!last.text.length) return false;
  for (let i = samples.length - 2; i >= 0; i--) {
    if (last.at - samples[i].at >= stableMs) return samples[i].text === last.text;
  }
  return false;
}

const SECRET_KEYS = /^(cookie|cookies|set-cookie|authorization|x-terminal-key|token|access_token|session_token|password|api_key)$/i;

export function redact(value, depth = 0) {
  if (depth > 8 || value == null) return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = SECRET_KEYS.test(k) ? '[redacted]' : redact(v, depth + 1);
    return out;
  }
  return value;
}

// One normalized event shape for every provider. Downstream automation never learns a vendor
// name from the event name.
export function turnCompletedEvent(turn) {
  return {
    event: 'browser_model.turn.completed',
    provider: turn.provider,
    session_id: turn.session_id,
    turn_id: turn.turn_id,
    state_handle: turn.state_handle || null,
    invocation_id: turn.invocation_id || null,
    completed_at: turn.completed_at,
  };
}
