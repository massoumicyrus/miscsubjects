
import { dispatch } from './dispatch.js';

function scrub(s) {
  return String(s || '').replace(/https?:\/\/[^\s"'<>]+/g, '<url>').replace(/<[^>]{1,200}>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
}

export async function onRequestGet(context) {
  const { env } = context;
  let ok = false;
  let detail = '';
  const started = Date.now();
  try {
    const r = await dispatch(env, 'APPS_SCRIPT_RUN', 'ping|{}', { actor: 'google-health' });
    const txt = String((r && r.result) || '');
    ok = /"ok"\s*:\s*true/.test(txt);
    if (!ok) detail = scrub(txt) || 'empty answer from the web app';
  } catch (e) {
    detail = scrub(e && e.message || e);
  }
  const body = {
    ok,
    apps_script_ping: ok ? 'ok' : 'failing',
    ms: Date.now() - started,
    detail: ok ? '' : detail,
    what: 'Acceptance probe for the Google write path (WT-0104 line). 200 only when APPS_SCRIPT_RUN ping answers ok:true; 503 otherwise, with the reason.',
    repair_task: '/api/work/task/WT-0104',
  };
  return new Response(JSON.stringify(body, null, 2), {
    status: ok ? 200 : 503,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}
