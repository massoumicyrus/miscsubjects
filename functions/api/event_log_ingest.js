import { logEvent } from '../_lib/event_log.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const got = request.headers.get('x-terminal-key') || '';
  if (!env.TERMINAL_KEY || got !== env.TERMINAL_KEY) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } });
  }
  let body;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ ok: false, error: 'invalid json' }), { status: 400, headers: { 'content-type': 'application/json' } }); }
  const kind = String(body.kind || 'bridge_event');
  // Agents that post here are not all "bridge": misc-cli, and anything else that names
  // itself, should appear under its own service in the chronology and the turn ledger
  // instead of being flattened into one label. An allowlist keeps a caller from writing
  // arbitrary sources into the ledger.
  const NAMED = new Set(['misc-cli', 'grok-cli', 'kimi-cli', 'codex-cli', 'bridge']);
  const claimed = String(body.surface || body.source || '').toLowerCase();
  const source = NAMED.has(claimed) ? claimed : 'bridge';
  await logEvent(env, {
    source,
    key: kind,
    action: String(body.action || kind),
    actor: body.model ? String(body.model) : (body.agent ? String(body.agent) : null),
    direction: 'IN',
    route: '/api/event_log_ingest',
    trace_id: body.trace_id || body.session || null,
    // The turn ledger renders these two as "you said" and "agent said", so send them
    // rather than burying the whole payload in one blob.
    request: body.said_user != null ? String(body.said_user) : JSON.stringify(body),
    response: body.said_agent != null ? String(body.said_agent) : '',
  });
  return new Response(null, { status: 204 });
}
