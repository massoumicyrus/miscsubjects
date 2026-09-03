// Browser-safe GET facade for model web tools that block `/api/*` navigation before the
// request reaches Cloudflare. This is not a second execution kernel: it rewrites the request
// into the existing dispatch GET handler, so the same capability, risk, use, dedupe, and
// receipt gates remain authoritative.
import { onRequestGet as dispatchGet } from '../api/dispatch.js';

const BASE = 'https://miscsubjects.com';

function json(value, status = 200) {
  return new Response(JSON.stringify(value, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
    },
  });
}

function browserLinks(invocationId, share) {
  const q = share ? '?share=' + encodeURIComponent(share) : '';
  return {
    confirm: invocationId ? BASE + '/web/confirm/' + invocationId : null,
    receipt: invocationId ? BASE + '/web/receipt/' + invocationId + q : null,
    run_template: BASE + '/web/run/TOOL?share=' + encodeURIComponent(share || 'TOKEN') + '&body=URL_ENCODED_ARGS',
  };
}

export async function onRequestGet(context) {
  const incoming = new URL(context.request.url);
  const suffix = incoming.pathname.replace(/^\/web\/?/, '').split('/').filter(Boolean);
  const mode = String(suffix[0] || 'help').toLowerCase();
  const value = suffix.slice(1).join('/');
  const target = new URL('/api/dispatch', incoming.origin);

  for (const [key, item] of incoming.searchParams) target.searchParams.append(key, item);
  if (mode === 'run' && value) target.searchParams.set('invoke', value.toUpperCase());
  else if (mode === 'explain') target.searchParams.set('explain', '1');
  else if (mode === 'confirm' && value) target.searchParams.set('confirm', value);
  else if (mode === 'receipt' && value) target.searchParams.set('receipt', value);
  else if (mode === 'key' && value) target.searchParams.set('key', value.toUpperCase());
  else if (mode === 'map') target.searchParams.set('map', '1');
  else if (mode === 'conformance') target.searchParams.set('conformance', '1');
  else if (mode === 'help') {
    return json({
      protocol: 'OIP browser lane',
      law: 'Web ChatGPT and browser-only models open these URLs with their browser/web tool. Do not use Bash, curl, Python requests, or a code sandbox.',
      run: BASE + '/web/run/TOOL?share=TOKEN&body=URL_ENCODED_ARGS',
      explain: BASE + '/web/explain?share=TOKEN',
      confirm: BASE + '/web/confirm/inv_ID',
      receipt: BASE + '/web/receipt/inv_ID?share=TOKEN',
      key: BASE + '/web/key/TOOL?share=TOKEN&format=markdown',
      map: BASE + '/web/map?share=TOKEN&format=markdown',
    });
  } else return json({ error: 'unknown_browser_mode', allowed: ['run/TOOL', 'explain', 'confirm/inv_ID', 'receipt/inv_ID', 'key/TOOL', 'map', 'conformance'] }, 404);

  const rewritten = new Request(target.toString(), context.request);
  const response = await dispatchGet({ ...context, request: rewritten });
  const type = response.headers.get('content-type') || '';
  if (!type.includes('application/json')) return response;
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { return new Response(text, response); }
  const invocationId = body?.proof?.invocation_id || body?.invocation?.id || (mode === 'confirm' ? value : null);
  body.browser_lane = browserLinks(invocationId, incoming.searchParams.get('share') || '');
  body.browser_lane.executed_by = 'the existing /api/dispatch handler; this facade does not bypass or duplicate authorization';
  return json(body, response.status);
}
