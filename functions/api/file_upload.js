export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'PUT' && request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'PUT or POST only' }), { status: 405, headers: { 'content-type': 'application/json' } });
  }
  const got = request.headers.get('x-terminal-key') || '';
  if (!env.TERMINAL_KEY || got !== env.TERMINAL_KEY) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } });
  }
  if (!env.R2) return new Response(JSON.stringify({ error: 'no R2 binding' }), { status: 500, headers: { 'content-type': 'application/json' } });
  const name = (new URL(request.url).searchParams.get('key') || ('upload-' + Date.now())).replace(/[^A-Za-z0-9._-]/g, '_');
  const key = 'img/up/' + name;
  const bytes = await request.arrayBuffer();
  const ct = request.headers.get('content-type') ||
    (/\.png$/i.test(name) ? 'image/png' : /\.(jpe?g)$/i.test(name) ? 'image/jpeg' : /\.(mp4|mov)$/i.test(name) ? 'video/mp4' : 'application/octet-stream');
  await env.R2.put(key, bytes, { httpMetadata: { contentType: ct } });
  return new Response(JSON.stringify({ ok: true, key, size: bytes.byteLength, url: 'https://miscsubjects.com/' + key }), { headers: { 'content-type': 'application/json' } });
}
