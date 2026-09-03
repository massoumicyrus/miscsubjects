export async function onRequestGet(context) {
  const { params, env } = context;
  const key = 'img/' + (Array.isArray(params.path) ? params.path.join('/') : String(params.path || ''));
  if (!env.R2) return new Response('no R2', { status: 500 });
  const obj = await env.R2.get(key);
  if (!obj) return new Response('not found', { status: 404 });
  const ct = obj.httpMetadata?.contentType || 'image/png';
  return new Response(obj.body, { headers: { 'content-type': ct, 'cache-control': 'public, max-age=31536000' } });
}
