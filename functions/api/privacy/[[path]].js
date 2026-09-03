import { isBuildAuthed, tokenAllowsKey, verifyShareTokenValue } from '../../_lib/admin_session.js';
import {
  appendDisclosure,
  appendErasureEvent,
  authorizeEgress,
  classifyContext,
  minimizeQuery,
  privacyConformance,
  privacyManifest,
  recipientLedger,
  shapeEgress,
} from '../../_lib/privacy_accountability.js';

const json = (value, status = 200) => new Response(JSON.stringify(value, null, 2), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'access-control-allow-origin': '*', 'x-content-type-options': 'nosniff' } });

async function privacyAuthed(request, env) {
  if (await isBuildAuthed(request, env)) return true;
  const raw = (request.headers.get('authorization') || '').replace(/^bearer\s+/i, '').trim();
  if (!raw) return false;
  const token = await verifyShareTokenValue(env, raw);
  return !!token && tokenAllowsKey(token, 'PRIVACY_EGRESS');
}

export async function onRequestGet({ env, params, request }) {
  const parts = Array.isArray(params.path) ? params.path : String(params.path || '').split('/').filter(Boolean);
  if (!parts.length || parts[0] === 'schema') return json(privacyManifest);
  if (parts[0] === 'disclosures') {
    if (parts[1]) {
      const all = await recipientLedger(env);
      const disclosure = all.disclosures.find((item) => item.id === parts[1]);
      return disclosure ? json({ protocol: 'OIP', kind: 'disclosure_receipt', disclosure, erasure_events: all.erasure_events.filter((item) => item.disclosure_id === parts[1]) }) : json({ error: 'not_found' }, 404);
    }
    if (!(await privacyAuthed(request, env))) return json({ error: 'scope_required', required_row: 'PRIVACY_EGRESS' }, 403);
    return json(await recipientLedger(env, new URL(request.url).searchParams.get('recipient')));
  }
  if (parts[0] === 'conformance' && parts[1]) {
    const result = await privacyConformance(env, parts[1]);
    const transportStatus = Number.isInteger(result.status) ? result.status : (result.error ? 400 : 200);
    return json(result, transportStatus);
  }
  return json({ error: 'not_found' }, 404);
}

export async function onRequestPost({ env, request }) {
  if (!(await privacyAuthed(request, env))) return json({ error: 'scope_required', required_row: 'PRIVACY_EGRESS' }, 403);
  const length = Number(request.headers.get('content-length') || 0);
  if (length > 262144) return json({ error: 'payload_too_large' }, 413);
  let body; try { body = await request.json(); } catch { return json({ error: 'invalid_json' }, 400); }
  const action = text(body?.action).toLowerCase(); const actor = text(body?.actor || 'owner', 200);
  let result;
  if (action === 'shape') result = await shapeEgress(body);
  else if (action === 'classify') result = { ok: true, action, executed: false, stored: false, classification: classifyContext(body?.content ?? body?.payload ?? '') };
  else if (action === 'minimize') result = await minimizeQuery(body);
  else if (action === 'authorize') result = await authorizeEgress(env, body, actor);
  else if (action === 'disclose') result = await appendDisclosure(env, body, actor);
  else if (action === 'erasure') result = await appendErasureEvent(env, body, actor);
  else if (action === 'conformance') result = await privacyConformance(env, body?.disclosure_id);
  else result = { error: 'unknown action', status: 400, allowed: privacyManifest.actions };
  const transportStatus = Number.isInteger(result.status) ? result.status : (result.error ? 400 : 200);
  return json(result, transportStatus);
}

function text(value, max = 100) { return String(value == null ? '' : value).trim().slice(0, max); }

export function onRequestOptions() { return new Response(null, { status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type,x-terminal-key,authorization', 'access-control-max-age': '86400' } }); }
