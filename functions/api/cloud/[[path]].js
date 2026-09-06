// /api/cloud/* — the front door of the CLOUD EXECUTION PLANE.
//
// Everything behind this route runs in a Cloudflare Container (Sandbox SDK) in
// the miscsubjects-sandbox Worker, which has no public origin of its own. This file
// is the only thing that can reach it, and it does three jobs before it forwards
// anything:
//
//   1. AUTHORITY — owner key, or a capability token the build already issues.
//   2. TENANT    — resolve WHO is asking, from the credential, never from the
//                  request body. A caller cannot name its own tenant; that is
//                  the whole isolation boundary.
//   3. SCOPE     — a tenant token must be allowed the CLOUD_* capability by the
//                  same tenant allow-list that gates every other capability.
//
// The exec contract is deliberately byte-compatible with the Mac bridge's
// POST /exec ({cmd,args,cwd,stdin,env,timeout,shell} -> {ok,exit,stdout,stderr,
// duration_ms}). That is what lets a directory row be re-pointed from the laptop
// to the cloud without touching the row's body template or any caller.
//
//   POST /api/cloud/exec               run one command, return exact exit state
//   POST /api/cloud/workspace/new      create a workspace (optionally clone a repo)
//   GET  /api/cloud/workspace/status   one workspace, incl. live container probe
//   POST /api/cloud/workspace/destroy  destroy the container, keep the record
//   GET  /api/cloud/workspace/list     this tenant's workspaces
//   POST /api/cloud/terminal/new|send|close, GET /api/cloud/terminal/list
//   POST /api/cloud/job/start|cancel,  GET /api/cloud/job/status|list
//   GET  /api/cloud/health             machine-readable substrate health

import {
  isBuildAuthed, verifyShareToken, tokenAllowsKey, getCapabilityByFingerprint,
  getTenant, tenantAllowsKey, normalizeTenantId, isOwnerTenant,
} from '../../_lib/admin_session.js';

const json = (o, s = 200) =>
  new Response(JSON.stringify(o, null, 2), { status: s, headers: { 'content-type': 'application/json; charset=utf-8' } });

// Which capability name a path is gated as. A tenant that is allowed CLOUD_EXEC
// is not thereby allowed to destroy workspaces; the allow-list is per key.
const KEY_FOR = {
  'exec': 'CLOUD_EXEC',
  'health': 'CLOUD_HEALTH',
  'workspace/new': 'CLOUD_WORKSPACE_NEW',
  'workspace/status': 'CLOUD_WORKSPACE_STATUS',
  'workspace/list': 'CLOUD_WORKSPACE_STATUS',
  'workspace/destroy': 'CLOUD_WORKSPACE_DESTROY',
  'terminal/new': 'CLOUD_TERMINAL_NEW',
  'terminal/send': 'CLOUD_TERMINAL_SEND',
  'terminal/close': 'CLOUD_TERMINAL_CLOSE',
  'terminal/list': 'CLOUD_TERMINAL_NEW',
  'job/start': 'CLOUD_JOB_START',
  'job/status': 'CLOUD_JOB_STATUS',
  'job/list': 'CLOUD_JOB_STATUS',
  'job/cancel': 'CLOUD_JOB_CANCEL',
};

// One bounded probe of the Mac bridge. Never throws: "the laptop did not answer"
// is a fact to report, not an error to propagate.
async function macBridgeHealth(env) {
  const url = 'https://agent.miscsubjects.com/health';
  const t0 = Date.now();
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 6000);
    const r = await fetch(url, {
      headers: env.TERMINAL_KEY ? { 'x-terminal-key': env.TERMINAL_KEY } : {},
      signal: ctl.signal,
    });
    clearTimeout(timer);
    const body = await r.text();
    let parsed = null; try { parsed = JSON.parse(body); } catch {}
    return { available: r.ok && !!parsed?.ok, status: r.status, latency_ms: Date.now() - t0,
      host: 'agent.miscsubjects.com', error: r.ok ? null : body.slice(0, 200) };
  } catch (e) {
    return { available: false, status: null, latency_ms: Date.now() - t0,
      host: 'agent.miscsubjects.com', error: String(e?.message || e) };
  }
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const sub = (Array.isArray(params.path) ? params.path.join('/') : String(params.path || '')) || 'health';
  const key = KEY_FOR[sub];
  if (!key) return json({ ok: false, error: 'unknown_route', path: sub }, 404);
  if (!env.SANDBOX) {
    return json({ ok: false, error: 'sandbox_binding_missing',
      note: 'deploy workers/sandbox (miscsubjects-sandbox) before the Pages project that binds it' }, 500);
  }

  // ── authority + tenant, in that order ────────────────────────────────────────
  let tenant = 'owner';
  const owner = await isBuildAuthed(request, env);
  if (!owner) {
    const tok = await verifyShareToken(request, env);
    if (!tok) return json({ ok: false, error: 'unauthorized', note: 'owner key or a ?share= capability token is required' }, 401);
    if (!tokenAllowsKey(tok, key)) {
      return json({ ok: false, error: 'capability_out_of_scope', capability: key,
        note: 'this token does not carry ' + key }, 403);
    }
    const cap = await getCapabilityByFingerprint(env, tok.fingerprint);
    const tid = cap?.tenant_id || null;
    if (!isOwnerTenant(tid)) {
      const t = await getTenant(env, tid);
      if (!t) return json({ ok: false, error: 'unknown_tenant' }, 403);
      if (String(t.status) === 'suspended') return json({ ok: false, error: 'tenant_suspended', tenant: tid }, 403);
      if (!tenantAllowsKey(t, key)) {
        return json({ ok: false, error: 'tenant_isolation', capability: key, tenant: tid,
          note: 'this tenant\'s allow-list does not include ' + key }, 403);
      }
      tenant = normalizeTenantId(tid);
    }
  }
  // A caller may pass tenant= in the body all it likes: the header the Worker
  // trusts is written here, from the credential, and overwrites anything sent.

  const inUrl = new URL(request.url);
  const target = new URL('https://sandbox/' + sub);   // host ignored over a service binding
  target.search = inUrl.search;

  const headers = new Headers({ 'content-type': 'application/json' });
  headers.set('x-sandbox-key', env.SANDBOX_KEY || '');
  headers.set('x-tenant', tenant);

  let body = null;
  if (request.method !== 'GET' && request.method !== 'HEAD') body = await request.text();

  const t0 = Date.now();
  let resp;
  try {
    resp = await env.SANDBOX.fetch(new Request(target.toString(), {
      method: request.method === 'GET' ? 'GET' : 'POST', headers, body,
    }));
  } catch (e) {
    return json({ ok: false, error: 'cloud_unavailable', detail: String(e?.message || e),
      execution_substrate: 'cloudflare_sandbox', capability: key }, 503);
  }
  const text = await resp.text();
  let payload;
  try { payload = JSON.parse(text); } catch { payload = { ok: false, error: 'bad_upstream', raw: text.slice(0, 2000) }; }
  payload.capability = key;
  payload.tenant = payload.tenant || tenant;
  payload.execution_substrate = payload.execution_substrate || 'cloudflare_sandbox';
  payload.front_door_ms = Date.now() - t0;

  // HEALTH is about the WHOLE execution plane, not one substrate. The build's
  // routing decision needs both answers in one read: "the Mac is offline, but
  // this capability is cloud-capable, so continue" is only derivable if the two
  // facts arrive together.
  if (sub === 'health') {
    payload.substrates = {
      cloudflare_sandbox: {
        available: !!payload.sandbox?.available,
        latency_ms: payload.sandbox?.latency_ms ?? null,
        error: payload.sandbox?.error || null,
      },
      mac_bridge: await macBridgeHealth(env),
    };
    payload.cloud_available = payload.substrates.cloudflare_sandbox.available;
    payload.edge_available = payload.substrates.mac_bridge.available;
    // The plane is up when EITHER substrate can run something. Reporting the
    // plane as down because the laptop is asleep is the exact confusion this
    // whole build exists to remove.
    payload.ok = payload.cloud_available || payload.edge_available;
  }
  // The HTTP status mirrors the upstream. A command that exits non-zero is a
  // successful CALL with a failed RESULT: 200 with ok:false and the real exit
  // code — never a 200 with ok:true (dispatch reads ok/exit, not the status).
  return json(payload, resp.status);
}
