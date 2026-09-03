import { logEvent } from './event_log.js';

const ORIGIN = 'https://miscsubjects.com';

function pickMarkers(html, extra = []) {
  const base = ['loading…', 'unauthorized', 'login?', '(empty)', 'D1_ERROR', 'lbl_viewer_auth_failed'];
  const found = {};
  for (const m of [...base, ...extra]) {
    if (m) found[m] = html.includes(m);
  }
  return found;
}

/** Compare operator-visible fetch (no terminal key) vs agent fetch (terminal key). Ledgered. */
export async function uiSurfaceProbe(env, url, opts = {}) {
  const raw = String(url || '').trim();
  if (!raw) return { error: 'url_required' };
  const full = raw.startsWith('http') ? raw : ORIGIN + (raw.startsWith('/') ? raw : '/' + raw);
  const markers = Array.isArray(opts.markers) ? opts.markers : [];

  const opRes = await fetch(full, { redirect: 'manual' });
  const opBody = await opRes.text();
  const agentHeaders = env.TERMINAL_KEY ? { 'x-terminal-key': env.TERMINAL_KEY } : {};
  const agRes = await fetch(full, { headers: agentHeaders, redirect: 'manual' });
  const agBody = await agRes.text();

  const operator = {
    status: opRes.status,
    bytes: opBody.length,
    location: opRes.headers.get('location'),
    markers: pickMarkers(opBody, markers),
  };
  const agent = {
    status: agRes.status,
    bytes: agBody.length,
    location: agRes.headers.get('location'),
    markers: pickMarkers(agBody, markers),
  };
  const mismatch = operator.status !== agent.status
    || Math.abs(operator.bytes - agent.bytes) > 32
    || JSON.stringify(operator.markers) !== JSON.stringify(agent.markers);

  const out = {
    url: full,
    mismatch,
    operator,
    agent,
    law: 'operator_surface_must_match_agent_claim',
  };

  await logEvent(env, {
    source: 'build',
    key: 'UI_SURFACE_PROBE',
    action: 'probe',
    direction: 'in',
    status: mismatch ? 409 : 200,
    route: full,
    response: { mismatch, operator_status: operator.status, agent_status: agent.status },
  });

  return out;
}