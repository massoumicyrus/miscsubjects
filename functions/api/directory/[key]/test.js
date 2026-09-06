import { isBuildAuthed } from '../../../_lib/admin_session.js';
import { invalidateDirSnapshot } from '../../../_lib/dir_snapshot.js';
import { logEvent } from '../../../_lib/event_log.js';
import { buildInvocation, placeholderArgs, realInvocation, recordTest, STATE, testPlan, transportRecord, verdict } from '../../../_lib/invocation_record.js';

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}

async function readRow(env, key) {
  return env.DB.prepare('SELECT * FROM directory WHERE key = ?').bind(key).first();
}

export async function onRequestGet({ request, env, params }) {
  const key = String(params.key);
  const row = await readRow(env, key);
  if (!row) return json({ error: 'not found', key }, 404);
  const origin = new URL(request.url).origin;
  return json({
    key, test_state: row.test_state || STATE.untested, tested_at: row.tested_at || null,
    invocation: row.invocation ? JSON.parse(row.invocation) : buildInvocation(row, { origin }),
    last_status: row.last_status ? JSON.parse(row.last_status) : null,
    last_response: row.last_response || null,
    plan: testPlan(row),
    run: 'POST ' + origin + '/api/directory/' + encodeURIComponent(key) + '/test  {"run":true}   (owner authority)',
  });
}

export async function onRequestPost({ request, env, params }) {
  if (!(await isBuildAuthed(request, env))) return json({ error: 'unauthorized', how_to_fix: 'x-terminal-key or an admin cookie' }, 401);
  const key = String(params.key);
  const row = await readRow(env, key);
  if (!row) return json({ error: 'not found', key }, 404);
  let body = {};
  try { body = await request.json(); } catch { body = {}; }
  const origin = new URL(request.url).origin;
  const plan = testPlan(row);
  const args = body.args != null ? String(body.args) : (plan.runnable ? plan.args : null);
  const invocation = buildInvocation(row, { origin, args: args != null ? args : undefined });
  const run = body.run !== false;
  const at = new Date().toISOString();

  if (!run) {
    await env.DB.prepare('UPDATE directory SET invocation = ? WHERE key = ?').bind(JSON.stringify(invocation), key).run();
    await invalidateDirSnapshot(env);
    return json({ key, recorded: 'invocation', test_state: row.test_state || STATE.untested, invocation });
  }
  if (!plan.runnable && !body.force && body.args == null) {
    // Not run — but the row still shows its REAL request: dispatch shapes the outbound call
    // (URL, headers, body with <arg> placeholders) without sending it. Nothing leaves the build.
    let shaped = invocation;
    if (row.type === 'http' || row.type === 'agent') {
      try {
        const { dispatch } = await import('../../dispatch.js');
        const s = await dispatch(env, key, placeholderArgs(row), { actor: 'directory-test', shapeOnly: true, noLog: true });
        if (s && s.request_json) shaped = realInvocation(row, s.request_json, { origin });
      } catch {}
    }
    const transport = { skipped: true, reason: plan.reason, at };
    await recordTest(env, key, { invocation: shaped, transport, response: null, state: STATE.untested, at, row });
    await invalidateDirSnapshot(env);
    return json({ key, test_state: STATE.untested, skipped: plan.reason, invocation: shaped, how_to_run_anyway: 'POST …/test {"force":true}  or  {"args":"…"}' });
  }

  const { dispatch } = await import('../../dispatch.js');
  const started = Date.now();
  let out = null; let threw = null;
  try { out = await dispatch(env, key, args || '', { actor: 'directory-test' }); }
  catch (e) { threw = String(e && e.message || e); }
  const ms = Date.now() - started;
  const result = out ? out.result : null;
  const v = verdict(result, threw);
  const transport = transportRecord({ ok: v.ok, ms, trace: out && out.trace, why: v.why, at, actor: 'directory-test' });
  const state = v.ok ? STATE.works : STATE.broken;
  const recorded = out && out.request_json ? realInvocation(row, out.request_json, { origin, args: args != null ? args : undefined }) : invocation;
  const rec = await recordTest(env, key, { invocation: recorded, transport, response: result == null ? (threw || '') : result, state, at, row });
  await invalidateDirSnapshot(env);
  try {
    await logEvent(env, { source: 'directory', key: 'DIRECTORY_TEST', action: 'POST', direction: 'IN', route: '/api/directory/' + key + '/test', trace_id: out && out.trace || null, actor: 'owner',
      request: JSON.stringify({ key, args }), response: JSON.stringify({ test_state: state, ms, error: v.why || null }), status: v.ok ? 200 : 500 });
  } catch {}
  return json({ key, test_state: state, tested_at: at, last_status: transport, last_response: typeof result === 'string' ? result : JSON.stringify(result), invocation: recorded, invocation_curl: rec.invocation_curl });
}
