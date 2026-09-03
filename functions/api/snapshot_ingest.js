import { logEvent } from '../_lib/event_log.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const got = request.headers.get('x-terminal-key') || '';
  if (!env.TERMINAL_KEY || got !== env.TERMINAL_KEY) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } });
  }
  if (!env.KV) return new Response(JSON.stringify({ ok: false, error: 'no KV binding' }), { status: 500, headers: { 'content-type': 'application/json' } });
  const content = await request.text();
  const sha = request.headers.get('x-snapshot-sha') || '';
  const ts = new Date().toISOString();
  const byte_count = content.length;
  await env.KV.put('repo:snapshot:current', JSON.stringify({ sha, ts, byte_count, content }));
  await logEvent(env, {
    source: 'github', key: 'REPO_SNAPSHOT_INGEST', action: 'snapshot_ingest', direction: 'IN',
    route: '/api/snapshot_ingest',
    request: JSON.stringify({ sha, byte_count }),
    response: 'stored repo:snapshot:current',
  });
  return new Response(JSON.stringify({ ok: true, sha, ts, byte_count }), { headers: { 'content-type': 'application/json' } });
}

export async function onRequestGet(context) {
  const { env } = context;
  if (!env.KV) return new Response(JSON.stringify({ error: 'no KV binding' }), { status: 500, headers: { 'content-type': 'application/json' } });
  const snap = await env.KV.get('repo:snapshot:current', 'json');
  if (!snap) return new Response(JSON.stringify({ error: 'no snapshot' }), { status: 404, headers: { 'content-type': 'application/json' } });
  return new Response(JSON.stringify({ sha: snap.sha, ts: snap.ts, byte_count: snap.byte_count }), { headers: { 'content-type': 'application/json' } });
}
