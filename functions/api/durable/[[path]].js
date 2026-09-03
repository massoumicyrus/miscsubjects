// Pages front door for the bound Durable Object (DirectoryDO, script
// loop-safe-directory-do). Gives the worker a production-hostname REST surface so the
// DURABLE_WORKER directory row and the slug registry are callable at
// https://miscsubjects.com/api/durable/<op>.
//   GET  /api/durable/ping
//   GET  /api/durable/slug.list
//   GET  /api/durable/slug.resolve?slug=<slug>
//   GET  /api/durable/intents
//   POST /api/durable/slug.register   {"slug","kind","target"}
import { verifyShareToken, getCapabilityByNonce, isOwnerTenant } from '../../_lib/admin_session.js';

// Each tenant gets its OWN DirectoryDO instance (own SQLite) — federation isolation, and it
// dissolves the single-writer 'main' bottleneck at node scale. The instance name is derived from
// the AUTHENTICATED tenant, never the client-supplied ?name= (which could otherwise reach another
// tenant's registry). Owner plane / no token → 'main', byte-identical to prior behavior.
async function shardName(request, env, fallback) {
  try {
    const tok = await verifyShareToken(request, env);
    if (tok?.nonce) {
      const cap = await getCapabilityByNonce(env, tok.nonce);
      if (cap && !isOwnerTenant(cap.tenant_id)) return cap.tenant_id;
    }
  } catch { /* owner plane */ }
  return fallback || 'main';
}

export async function onRequest(context) {
  const { request, env, params } = context;
  if (!env.DIRECTORY_DO) {
    return new Response(JSON.stringify({ ok: false, error: 'DIRECTORY_DO binding missing — deploy loop-safe-directory-do and add the Pages binding' }), {
      status: 500, headers: { 'content-type': 'application/json' },
    });
  }
  const url = new URL(request.url);
  const seg = Array.isArray(params.path) ? params.path.join('/') : (params.path || '');
  const op = seg || url.searchParams.get('op') || 'ping';
  const name = await shardName(request, env, url.searchParams.get('name') || 'main');
  const id = env.DIRECTORY_DO.idFromName(name);
  const stub = env.DIRECTORY_DO.get(id);
  const fwd = new URL('https://do/');
  fwd.searchParams.set('op', op);
  const slug = url.searchParams.get('slug');
  if (slug) fwd.searchParams.set('slug', slug);
  const init = { method: request.method };
  if (request.method === 'POST') { init.body = await request.text(); init.headers = { 'content-type': 'application/json' }; }
  const resp = await stub.fetch(new Request(fwd.toString(), init));
  return new Response(await resp.text(), { status: resp.status, headers: { 'content-type': 'application/json' } });
}
