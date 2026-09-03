// /api/store/* — TERMINAL_KEY-gated proxy to the private loop-safe-storage Worker via the
// STORE service binding. Mirrors functions/api/file/[[path]].js: same-origin, authed, no
// public exposure of the storage Worker. Attaches STORE_KEY so the Worker accepts writes.
//
//   GET  /api/store/f?path=<p>     -> read one object
//   GET  /api/store/search?q=<q>   -> index lookup
//   GET  /api/store/list?prefix=<p>-> enumerate
//   PUT  /api/store/f?path=<p>     -> store (body = content)
//   DELETE /api/store/f?path=<p>   -> remove

function json(o, s) { return new Response(JSON.stringify(o), { status: s || 200, headers: { 'content-type': 'application/json' } }); }
function authed(request, env) { return !!env.TERMINAL_KEY && (request.headers.get('x-terminal-key') || '') === env.TERMINAL_KEY; }

export async function onRequest(context) {
  const { request, env, params } = context;
  if (!env.STORE) return json({ error: 'STORE binding missing' }, 500);
  if (!authed(request, env)) return json({ error: 'unauthorized' }, 401);

  const sub = Array.isArray(params.path) ? params.path.join('/') : String(params.path || '');
  const inUrl = new URL(request.url);
  const target = new URL('https://store/' + sub);   // host is ignored over a service binding
  target.search = inUrl.search;

  const headers = new Headers(request.headers);
  if (env.STORE_KEY) headers.set('x-store-key', env.STORE_KEY);

  const init = { method: request.method, headers };
  if (request.method !== 'GET' && request.method !== 'HEAD') init.body = await request.arrayBuffer();

  return env.STORE.fetch(new Request(target.toString(), init));
}
