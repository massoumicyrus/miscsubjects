// GET/POST /api/token/validate — the ONE validation path for the ONE token format.
// Present the token any way you can: ?share=<token> (browser), Authorization: Bearer <token>
// (curl), or x-write-token. Same token, same answer, either transport. Holding the token is
// the credential, so validating it needs no other auth.
import { verifyTokenAnyTransport, getCapabilityByFingerprint } from '../../_lib/admin_session.js';

export async function onRequest(context) {
  const { request, env } = context;
  const json = (o, status = 200) => new Response(JSON.stringify(o, null, 2), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
  const t = await verifyTokenAnyTransport(request, env);
  if (!t) {
    return json({
      valid: false,
      how_to_present: {
        browser: 'https://miscsubjects.com/api/token/validate?share=<token>',
        curl: "curl -s https://miscsubjects.com/api/token/validate -H 'Authorization: Bearer <token>'",
        note: 'One token format, three transports (?share=, Bearer, x-write-token). All resolve identically.',
      },
      mint: 'owner: GET /api/dispatch?mint_share=1&scope=act (read+write) — or scope=row:<KEY> for one delegated capability',
    }, 401);
  }
  let record = null;
  try { record = await getCapabilityByFingerprint(env, t.fingerprint); } catch {}
  const can = t.scope === 'act'
    ? ['read anything public', 'invoke any directory row (GET /api/dispatch?invoke=<KEY>&share=… or POST)', 'edit any article (PUT/PATCH /api/articles/<slug> with this token — write gate satisfied)', 'append sources/claims/widgets (POST /api/articles/<slug>/webhook)', 'search + read directory objects, including article:<slug> projections']
    : t.scope === 'row'
      ? ['invoke exactly one capability: ' + t.rowKey]
      : t.scope === 'rows'
        ? ['invoke exactly: ' + (t.rowKeys || []).join(', ')]
        : t.scope === 'pfx'
          ? ['invoke capabilities starting with: ' + t.prefix]
          : ['read-only: self-model, resume, ask'];
  return json({
    valid: true,
    scope: t.scope + (t.rowKey ? ':' + t.rowKey : ''),
    fingerprint: t.fingerprint,
    expires_at: new Date(t.exp * 1000).toISOString(),
    max_uses: t.maxUses || 'unlimited',
    record: record ? { purpose: record.purpose, actor: record.actor, issuer: record.issuer, risk_ceiling: record.risk_ceiling } : null,
    permits: can,
    interchangeable_transports: {
      browser_url_suffix: '?share=<this token>',
      curl_header: 'Authorization: Bearer <this token>',
      legacy_header: 'x-write-token: <this token>',
    },
    revoke: '/api/dispatch?revoke=' + t.fingerprint + ' (owner)',
    ledger: '/api/invocations?actor=' + encodeURIComponent('cap:' + t.fingerprint),
  });
}
