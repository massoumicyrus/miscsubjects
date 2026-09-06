
export const MAC_BRIDGE_HOST = 'agent.miscsubjects.com';
export const CLOUD_EXEC_URL = 'https://miscsubjects.com/api/cloud/exec';

export const SUBSTRATE_CLOUD = 'cloudflare_sandbox';
export const SUBSTRATE_MAC = 'mac_bridge';

const HEALTH_KEY = 'exec_route:cloud_ok';
const HEALTH_TTL_S = 120;

export function isMacBridgeTarget(target) {
  return String(target || '').includes(MAC_BRIDGE_HOST);
}

// Normalised policy for a row. Rows that never touched the Mac are 'n/a' — this
// layer has no opinion about a Stripe row or a model row.
export function executionPolicy(row) {
  const declared = String(row?.execution || '').trim().toLowerCase();
  if (declared) return declared;
  return isMacBridgeTarget(row?.target) ? 'unclassified' : 'n/a';
}

// Is the cloud plane answering? Cached briefly in KV so a burst of routed calls
// costs one probe, and so a cold container start is not paid per command.
//
// The cache stores a NEGATIVE result for a shorter window than a positive one:
// being wrong about "cloud is up" costs one failed call and a fallback; being
// wrong about "cloud is down" sends work to a laptop that did not need to be
// involved, which is the thing we are removing.
export async function cloudAvailable(env, { force = false } = {}) {
  if (!env?.SANDBOX) return { available: false, reason: 'sandbox_binding_missing', cached: false };
  if (!force && env.KV) {
    try {
      const hit = await env.KV.get(HEALTH_KEY);
      if (hit === 'up') return { available: true, cached: true };
      if (hit === 'down') return { available: false, reason: 'cached_probe_down', cached: true };
    } catch {}
  }
  let available = false, reason = null;
  try {
    const r = await env.SANDBOX.fetch(new Request('https://sandbox/exec', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-sandbox-key': env.SANDBOX_KEY || '', 'x-tenant': 'owner' },
      body: JSON.stringify({ cmd: 'printf', args: ['ROUTE_PROBE_OK'], timeout: 60000 }),
    }));
    const j = await r.json();
    available = !!j.ok && String(j.stdout || '').trim() === 'ROUTE_PROBE_OK';
    if (!available) reason = j.error || 'probe_mismatch';
  } catch (e) { reason = String(e?.message || e); }
  if (env.KV) {
    try { await env.KV.put(HEALTH_KEY, available ? 'up' : 'down', { expirationTtl: available ? HEALTH_TTL_S : 30 }); } catch {}
  }
  return { available, reason, cached: false };
}

// Is the Mac bridge answering? Same cache discipline as the cloud probe, and the
// same reason it exists: a routing decision must be made on a fact, not on a
// guess about whether a laptop is awake.
const MAC_HEALTH_KEY = 'exec_route:mac_ok';

export async function macAvailable(env, { force = false } = {}) {
  if (!force && env?.KV) {
    try {
      const hit = await env.KV.get(MAC_HEALTH_KEY);
      if (hit === 'up') return { available: true, cached: true };
      if (hit === 'down') return { available: false, reason: 'cached_probe_down', cached: true };
    } catch {}
  }
  let available = false, reason = null;
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 6000);
    const r = await fetch('https://' + MAC_BRIDGE_HOST + '/health', {
      headers: env?.TERMINAL_KEY ? { 'x-terminal-key': env.TERMINAL_KEY } : {},
      signal: ctl.signal,
    });
    clearTimeout(timer);
    const j = await r.json().catch(() => null);
    available = r.ok && !!j?.ok;
    if (!available) reason = 'status_' + r.status;
  } catch (e) { reason = String(e?.message || e).slice(0, 80); }
  if (env?.KV) {
    try { await env.KV.put(MAC_HEALTH_KEY, available ? 'up' : 'down', { expirationTtl: available ? 60 : 30 }); } catch {}
  }
  return { available, reason, cached: false };
}

// The decision. Returns the target to actually call, the substrate that target
// represents, and — when the answer is "nowhere" — an explicit refusal string
// that names which substrate was unavailable rather than pretending otherwise.
export async function routeExecution(row, ctx) {
  const env = ctx?.env;
  const target = String(row?.target || '');
  const policy = executionPolicy(row);

  // cloud_pending:<reason> — the row is cloud-capable in principle but is NOT
  // routed yet, and the reason is on the record rather than in someone's head:
  //   cloud_pending:image — the container image does not carry that tool
  //   cloud_pending:body  — the row body hard-codes a path on the Mac
  // It behaves exactly as it did before. The value is bookkeeping that does not lie.
  if (policy.startsWith('cloud_pending')) {
    return { target, substrate: SUBSTRATE_MAC, policy, routed: false, pending: policy.split(':')[1] || 'unspecified' };
  }

  if (policy === 'n/a' || policy === 'unclassified') {
    return { target, substrate: isMacBridgeTarget(target) ? SUBSTRATE_MAC : null, policy, routed: false };
  }

  if (policy === 'edge_required') {
    // Never rerouted. If the Mac is off, the honest answer is "this one needs
    // the Mac and the Mac is not there" — not a container pretending to be it,
    // and not a bare connection error the caller has to interpret. The two
    // failures must never read alike: one is "the cloud plane is down", the
    // other is "this capability is the laptop, and the laptop is asleep".
    const mac = await macAvailable(env);
    if (!mac.available) {
      return { refusal: 'ERR:execution_routing:edge_unavailable:' + (row?.key || '?') +
        ' — this capability requires the owner Mac (' + MAC_BRIDGE_HOST + ') and the Mac bridge did not answer' +
        (mac.reason ? ' (' + mac.reason + ')' : '') +
        '. It is edge_required, so it was NOT rerouted to the cloud execution plane. Cloud-capable work is unaffected.',
        substrate: null, policy, routed: false, edge_required: true };
    }
    return { target, substrate: SUBSTRATE_MAC, policy, routed: false, edge_required: true };
  }

  const cloud = await cloudAvailable(env);
  const method = target.slice(0, target.indexOf(' ')).toUpperCase() || 'POST';
  const cloudTarget = 'POST ' + CLOUD_EXEC_URL;

  if (policy === 'cloud') {
    if (cloud.available) return { target: cloudTarget, substrate: SUBSTRATE_CLOUD, policy, routed: true };
    return { refusal: 'ERR:execution_routing:cloud_unavailable:' + (row?.key || '?') +
      ' — this capability is declared cloud-only and the cloud execution plane did not answer' +
      (cloud.reason ? ' (' + cloud.reason + ')' : '') + '. It was NOT run on the Mac.',
      substrate: null, policy, routed: false };
  }

  if (policy === 'cloud_preferred') {
    if (cloud.available) return { target: cloudTarget, substrate: SUBSTRATE_CLOUD, policy, routed: true };
    if (isMacBridgeTarget(target)) {
      return { target, substrate: SUBSTRATE_MAC, policy, routed: false, fell_back: true,
        fallback_reason: cloud.reason || 'cloud_unavailable' };
    }
    return { refusal: 'ERR:execution_routing:no_substrate:' + (row?.key || '?') +
      ' — cloud unavailable and this row has no edge fallback target.', substrate: null, policy, routed: false };
  }

  if (policy === 'either' && isMacBridgeTarget(target)) {
    const mac = await macAvailable(env);
    if (mac.available) return { target, substrate: SUBSTRATE_MAC, policy, routed: false };
    if (cloud.available) {
      return { target: cloudTarget, substrate: SUBSTRATE_CLOUD, policy, routed: true, fell_back: true,
        fallback_reason: 'mac_bridge_unavailable' + (mac.reason ? ':' + mac.reason : '') };
    }
    return { refusal: 'ERR:execution_routing:no_substrate:' + (row?.key || '?') +
      ' — neither the Mac bridge nor the cloud execution plane answered.', substrate: null, policy, routed: false };
  }
  return { target, substrate: isMacBridgeTarget(target) ? SUBSTRATE_MAC : null, policy, routed: false, method };
}

// Stamp the substrate into the result so evidence never has to be inferred.
// The result string from an http row is 'HTTP <status>:<body>'; when the body is
// JSON the field is added inside it, so a machine reading the payload sees it
// without parsing the envelope.
export function stampSubstrate(result, decision) {
  if (!decision || !decision.substrate) return result;
  const s = String(result ?? '');
  const m = /^HTTP (\d+):([\s\S]*)$/.exec(s);
  if (!m) return s;
  let parsed;
  try { parsed = JSON.parse(m[2]); } catch { return s; }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return s;
  parsed.execution_substrate = parsed.execution_substrate || decision.substrate;
  parsed.execution_policy = decision.policy;
  if (decision.fell_back) {
    parsed.execution_fallback = true;
    parsed.execution_fallback_reason = decision.fallback_reason || 'cloud_unavailable';
  }
  return 'HTTP ' + m[1] + ':' + JSON.stringify(parsed);
}
