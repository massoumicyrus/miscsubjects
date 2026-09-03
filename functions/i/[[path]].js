const BASE = 'https://miscsubjects.com';

function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=60' } });
}

function redirect(location) {
  return new Response(null, { status: 302, headers: { location, 'cache-control': 'public, max-age=60' } });
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  const kind = parts[1] || '';
  const wantsJson = url.searchParams.get('format') === 'json' || (request.headers.get('accept') || '').includes('application/json');

  if (kind === 'article' && parts[2]) {
    const slug = parts[2];
    const row = await env.DB.prepare('SELECT slug FROM articles WHERE slug=?').bind(slug).first();
    if (!row) return json({ error: 'article not found', slug }, 404);
    const item = { kind, id: 'art:' + slug, stable_url: BASE + '/i/article/' + encodeURIComponent(slug), human_url: BASE + '/a/' + encodeURIComponent(slug), machine_url: BASE + '/api/articles/' + encodeURIComponent(slug), inventory_url: BASE + '/api/inventory?id=' + encodeURIComponent('art:' + slug) };
    return wantsJson ? json(item) : redirect(item.human_url);
  }

  if ((kind === 'claim' || kind === 'div') && parts[2] && parts[3]) {
    const slug = parts[2];
    const id = parts[3];
    const row = await env.DB.prepare('SELECT meta FROM articles WHERE slug=?').bind(slug).first();
    if (!row) return json({ error: 'article not found', slug }, 404);
    let meta = {}; try { meta = JSON.parse(row.meta || '{}') || {}; } catch {}
    const exists = kind === 'claim'
      ? (meta.claims || []).some((claim) => String(claim.id) === id)
      : (meta.divs || []).some((div) => String(div.id) === id);
    if (!exists) return json({ error: kind + ' not found', slug, id }, 404);
    const fragment = kind === 'claim' ? '#claim-' + encodeURIComponent(id) : '#div-' + encodeURIComponent(id);
    const machine = kind === 'claim'
      ? BASE + '/api/articles/' + encodeURIComponent(slug) + '/claims/' + encodeURIComponent(id)
      : BASE + '/api/articles/' + encodeURIComponent(slug) + '/voxels?div=' + encodeURIComponent(id);
    const item = { kind, id, slug, stable_url: BASE + '/i/' + kind + '/' + encodeURIComponent(slug) + '/' + encodeURIComponent(id), human_url: BASE + '/a/' + encodeURIComponent(slug) + fragment, machine_url: machine };
    return wantsJson ? json(item) : redirect(item.human_url);
  }

  if (kind === 'discourse' && parts[2]) {
    const id = parts[2];
    const row = await env.DB.prepare('SELECT id, slug FROM discourse WHERE id=?').bind(id).first();
    if (!row) return json({ error: 'discourse item not found', id }, 404);
    const item = { kind, id, slug: row.slug, stable_url: BASE + '/i/discourse/' + encodeURIComponent(id), human_url: BASE + '/a/' + encodeURIComponent(row.slug) + '#disc-' + encodeURIComponent(id), machine_url: BASE + '/api/articles/' + encodeURIComponent(row.slug) + '/discourse' };
    return wantsJson ? json(item) : redirect(item.human_url);
  }

  if (kind === 'tool' && parts[2]) {
    const key = parts[2];
    const row = await env.DB.prepare('SELECT key FROM directory WHERE key=?').bind(key).first();
    if (!row) return json({ error: 'tool not found', key }, 404);
    const target = BASE + '/api/directory/' + encodeURIComponent(key);
    return wantsJson ? json({ kind, id: 'dir:' + key, stable_url: BASE + '/i/tool/' + encodeURIComponent(key), machine_url: target, inventory_url: BASE + '/api/inventory?id=' + encodeURIComponent('dir:' + key) }) : redirect(target);
  }

  if (kind === 'code' && parts.length > 2) {
    const path = parts.slice(2).join('/');
    const target = BASE + '/api/file/' + path.split('/').map(encodeURIComponent).join('/');
    return wantsJson ? json({ kind, id: 'file:' + path, stable_url: BASE + '/i/code/' + path.split('/').map(encodeURIComponent).join('/'), machine_url: target, inventory_url: BASE + '/api/inventory?id=' + encodeURIComponent('file:' + path) }) : redirect(target);
  }

  return json({ error: 'item not found', formats: ['/i/article/<slug>', '/i/claim/<slug>/<claim-id>', '/i/div/<slug>/<div-id>', '/i/discourse/<id>', '/i/tool/<key>', '/i/code/<repo-path>'] }, 404);
}
