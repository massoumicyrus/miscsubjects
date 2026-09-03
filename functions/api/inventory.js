const BASE = 'https://miscsubjects.com';
const ARTICLE_TOOLS = ['VOXEL_EDIT', 'VOXEL_MOVE', 'VOXEL_CONSOLIDATE', 'VOXEL_CHALLENGE'];
const ARTICLE_CODE = [
  'functions/_lib/voxel_graph.js',
  'functions/_lib/discourse_widgets.js',
  'functions/_lib/claim_surface.js',
  'functions/api/articles/[[path]].js',
  'functions/api/protocol/[[path]].js',
];

function stableFor(kind, name) {
  if (kind === 'article') return `${BASE}/i/article/${encodeURIComponent(name)}`;
  if (kind === 'directory') return `${BASE}/i/tool/${encodeURIComponent(name)}`;
  if (kind === 'file') return `${BASE}/i/code/${String(name).split('/').map(encodeURIComponent).join('/')}`;
  return `${BASE}/api/inventory?id=${encodeURIComponent(kind + ':' + name)}`;
}

function json(o, s) { return new Response(JSON.stringify(o), { status: s || 200, headers: { 'content-type': 'application/json' } }); }

async function safeAll(env, db, sql) { try { const r = await db.prepare(sql).all(); return r.results || []; } catch { return []; } }

async function listDirectoryRows(env) {
  const rows = await safeAll(env, env.DB, 'SELECT key, type, target, category, updated_at FROM directory');
  return rows.map(r => ({
    id: 'dir:' + r.key,
    kind: 'directory',
    name: r.key,
    type: r.type, target: r.target, category: r.category,
    read: `${BASE}/api/directory/${encodeURIComponent(r.key)}`,
    edit: `${BASE}/api/directory/${encodeURIComponent(r.key)}`,
    edit_method: 'PATCH',
    edit_body: '{type?, target?, auth?, content?, category?, allowed_categories?, seq?, enabled?, planner_visible?, planner_rank?, input_schema?, examples?}',
    delete_method: 'DELETE',
    updated_at: r.updated_at,
    stable_url: stableFor('directory', r.key),
    related_items: ARTICLE_TOOLS.includes(r.key) ? `${BASE}/api/inventory?related_to=${encodeURIComponent('dir:' + r.key)}` : null,
  }));
}

async function listSettingsRows(env) {
  const rows = await safeAll(env, env.DB, 'SELECT key, updated_at, length(value) AS size FROM settings');
  return rows.map(r => ({
    id: 'set:' + r.key,
    kind: 'settings',
    name: r.key,
    read: `${BASE}/api/settings/${encodeURIComponent(r.key)}`,
    edit: `${BASE}/api/settings/${encodeURIComponent(r.key)}`,
    edit_method: 'PUT',
    edit_body: '{value}',
    delete_method: 'DELETE',
    size: r.size,
    updated_at: r.updated_at,
  }));
}

async function listArticles(env) {
  const rows = await safeAll(env, env.DB, 'SELECT slug, updated_at FROM articles');
  return rows.map(r => ({
    id: 'art:' + r.slug,
    kind: 'article',
    name: r.slug,
    read: `${BASE}/api/articles/${encodeURIComponent(r.slug)}`,
    edit: `${BASE}/api/articles/${encodeURIComponent(r.slug)}`,
    edit_method: 'PATCH',
    edit_body: '{title?, body?, ...}',
    delete_method: 'DELETE',
    updated_at: r.updated_at,
    stable_url: stableFor('article', r.slug),
    human: `${BASE}/a/${encodeURIComponent(r.slug)}`,
    claims: `${BASE}/api/articles/${encodeURIComponent(r.slug)}/claims`,
    voxels: `${BASE}/api/articles/${encodeURIComponent(r.slug)}/voxels`,
    discourse: `${BASE}/api/articles/${encodeURIComponent(r.slug)}/discourse`,
    relationships: [
      ...ARTICLE_TOOLS.map(key => ({ type: 'edited_by', id: 'dir:' + key, url: stableFor('directory', key) })),
      ...ARTICLE_CODE.map(path => ({ type: 'implemented_by', id: 'file:' + path, url: stableFor('file', path) })),
    ],
  }));
}

async function listPages(env) {
  const rows = await safeAll(env, env.DB, 'SELECT slug, updated_at FROM pages');
  return rows.map(r => ({
    id: 'page:' + r.slug,
    kind: 'page',
    name: r.slug,
    read: `${BASE}/api/pages/${encodeURIComponent(r.slug)}`,
    edit: `${BASE}/api/pages/${encodeURIComponent(r.slug)}`,
    edit_method: 'PATCH',
    edit_body: '{title?, body_html?}',
    delete_method: 'DELETE',
    updated_at: r.updated_at,
  }));
}

async function listKv(env, limit) {
  if (!env.KV) return [];
  const out = []; let cursor = undefined;
  while (out.length < limit) {
    const r = await env.KV.list({ limit: Math.min(1000, limit - out.length), cursor });
    for (const k of (r.keys || [])) out.push({
      id: 'kv:' + k.name,
      kind: 'kv',
      name: k.name,
      read: `${BASE}/api/kv?key=${encodeURIComponent(k.name)}`,
      edit: `${BASE}/api/kv?key=${encodeURIComponent(k.name)}`,
      edit_method: 'PUT',
      edit_body: 'raw text body; optional ?ttl=<seconds>',
      delete_method: 'DELETE',
      expiration: k.expiration || null,
    });
    if (r.list_complete || !r.cursor) break;
    cursor = r.cursor;
  }
  return out;
}

async function listR2(env, limit) {
  if (!env.R2) return [];
  const out = []; let cursor = undefined;
  while (out.length < limit) {
    const r = await env.R2.list({ limit: Math.min(1000, limit - out.length), cursor });
    for (const o of (r.objects || [])) out.push({
      id: 'r2:' + o.key,
      kind: 'r2',
      name: o.key,
      read: `${BASE}/api/r2/${o.key.split('/').map(encodeURIComponent).join('/')}`,
      edit: `${BASE}/api/r2/${o.key.split('/').map(encodeURIComponent).join('/')}`,
      edit_method: 'PUT',
      edit_body: 'raw bytes; pass Content-Type header to set httpMetadata',
      delete_method: 'DELETE',
      size: o.size,
      uploaded: o.uploaded ? o.uploaded.toISOString() : null,
      etag: o.etag || null,
      contentType: (o.httpMetadata && o.httpMetadata.contentType) || null,
    });
    if (!r.truncated || !r.cursor) break;
    cursor = r.cursor;
  }
  return out;
}

async function listRepoFiles(env, limit) {
  const cacheKey = new Request('https://inventory.internal/repo-files');
  const cached = typeof caches !== 'undefined' ? await caches.default.match(cacheKey) : null;
  if (cached) {
    const rows = await cached.json();
    return rows.slice(0, limit);
  }
  const headers = { 'User-Agent': 'miscsubjects-build', 'Accept': 'application/vnd.github+json' };
  if (env.GITHUB_TOKEN) headers.Authorization = 'Bearer ' + env.GITHUB_TOKEN;
  const root = 'https://api.github.com/repos/[OWNER_HANDLE]/miscsubjects-pages';
  let r = await fetch(`${root}/git/trees/main?recursive=1`, { headers });
  let j = r.ok ? await r.json() : null;
  // Some GitHub tokens accept a tree SHA but not a branch name at /git/trees.
  // Resolve main explicitly so inventory never silently loses the repository.
  if (!j?.tree) {
    const branch = await fetch(`${root}/branches/main`, { headers });
    if (branch.ok) {
      const branchJson = await branch.json();
      const commit = await fetch(`${root}/git/commits/${encodeURIComponent(branchJson?.commit?.sha || '')}`, { headers });
      if (commit.ok) {
        const commitJson = await commit.json();
        r = await fetch(`${root}/git/trees/${encodeURIComponent(commitJson?.tree?.sha || '')}?recursive=1`, { headers });
        if (r.ok) j = await r.json();
      }
    }
  }
  let entries = (j?.tree || []).filter(t => t.type === 'blob');
  // Contents is slower but has different GitHub permission semantics. It is the
  // last-resort inventory source so a valid file API token still yields every file.
  if (!entries.length) {
    entries = [];
    const queue = [''];
    while (queue.length && entries.length < 20000) {
      const paths = queue.splice(0, 10);
      const batches = await Promise.all(paths.map(async path => {
        const encoded = path ? '/' + path.split('/').map(encodeURIComponent).join('/') : '';
        const response = await fetch(`${root}/contents${encoded}?ref=main`, { headers });
        return response.ok ? response.json() : [];
      }));
      for (const batch of batches) for (const item of (Array.isArray(batch) ? batch : [])) {
        if (item.type === 'dir') queue.push(item.path);
        else if (item.type === 'file') entries.push({ path: item.path, size: item.size, sha: item.sha });
      }
    }
  }
  const rows = entries.slice(0, 20000).map(t => ({
    id: 'file:' + t.path,
    kind: 'file',
    name: t.path,
    read: `${BASE}/api/file/${t.path.split('/').map(encodeURIComponent).join('/')}`,
    edit: `${BASE}/api/file/${t.path.split('/').map(encodeURIComponent).join('/')}`,
    edit_method: 'PUT',
    edit_body: '{content, message?, sha?}  // sha auto-resolved if omitted',
    delete_method: 'DELETE',
    size: t.size,
    sha: t.sha,
    stable_url: stableFor('file', t.path),
    related_items: ARTICLE_CODE.includes(t.path) ? `${BASE}/api/inventory?related_to=${encodeURIComponent('file:' + t.path)}` : null,
  }));
  if (rows.length && typeof caches !== 'undefined') {
    await caches.default.put(cacheKey, new Response(JSON.stringify(rows), {
      headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=300' },
    }));
  }
  return rows.slice(0, limit);
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const u = new URL(request.url);
  const wanted = (u.searchParams.get('kind') || '').split(',').map(s => s.trim()).filter(Boolean);
  const want = (k) => wanted.length === 0 || wanted.includes(k);

  const limit_kv = Math.min(parseInt(u.searchParams.get('limit_kv') || '2000', 10) || 2000, 5000);
  const limit_r2 = Math.min(parseInt(u.searchParams.get('limit_r2') || '2000', 10) || 2000, 5000);
  const limit_file = Math.min(parseInt(u.searchParams.get('limit_file') || '5000', 10) || 5000, 20000);

  const [directory, settings, articles, pages, kv, r2, files] = await Promise.all([
    want('directory') ? listDirectoryRows(env) : [],
    want('settings')  ? listSettingsRows(env)  : [],
    want('article')   ? listArticles(env)      : [],
    want('page')      ? listPages(env)         : [],
    want('kv')        ? listKv(env, limit_kv)  : [],
    want('r2')        ? listR2(env, limit_r2)  : [],
    want('file')      ? listRepoFiles(env, limit_file) : [],
  ]);

  // Stable short IDs: D<n> directory, S<n> settings, A<n> article, P<n> page, K<n> kv, R<n> r2, F<n> file.
  // Sort each kind by `name` ASC so the index is deterministic across calls.
  function assign(list, prefix) {
    list.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    list.forEach((r, i) => { r.short_id = prefix + (i + 1); });
    return list;
  }
  assign(directory, 'D');
  assign(settings,  'S');
  assign(articles,  'A');
  assign(pages,     'P');
  assign(kv,        'K');
  assign(r2,        'R');
  assign(files,     'F');

  const all = [...directory, ...settings, ...articles, ...pages, ...kv, ...r2, ...files];

  // Bidirectional graph reads. Articles name their tools/code above; these queries are the
  // exact reverse edge from a tool/code object back to every article it governs.
  const relatedTo = u.searchParams.get('related_to');
  if (relatedTo) {
    const isTool = relatedTo.startsWith('dir:') && ARTICLE_TOOLS.includes(relatedTo.slice(4));
    const isCode = relatedTo.startsWith('file:') && ARTICLE_CODE.includes(relatedTo.slice(5));
    if (!isTool && !isCode) return json({ related_to: relatedTo, count: 0, rows: [] });
    return json({
      related_to: relatedTo,
      relationship: isTool ? 'edits' : 'implements',
      count: articles.length,
      rows: articles.map(article => ({ id: article.id, name: article.name, stable_url: article.stable_url, human: article.human })),
    });
  }

  const exactId = u.searchParams.get('id');
  if (exactId) {
    const row = all.find(item => item.id === exactId);
    if (!row) return json({ error: 'no inventory item', id: exactId }, 404);
    const reverse = exactId.startsWith('dir:') && ARTICLE_TOOLS.includes(exactId.slice(4))
      ? articles.map(article => ({ type: 'edits', id: article.id, url: article.stable_url }))
      : exactId.startsWith('file:') && ARTICLE_CODE.includes(exactId.slice(5))
        ? articles.map(article => ({ type: 'implements', id: article.id, url: article.stable_url }))
        : [];
    return json({ ...row, reverse_relationships: reverse });
  }

  // ?short_id=<ID> — return ONLY that one row (saves bytes when the agent already knows the ID).
  const sid = u.searchParams.get('short_id');
  if (sid) {
    const row = all.find(r => r.short_id === sid);
    if (!row) return json({ error: 'no row for short_id', short_id: sid }, 404);
    return json(row);
  }

  return json({
    ts: new Date().toISOString(),
    build: 'miscsubjects',
    auth: 'most edits require header: x-terminal-key: $TERMINAL_KEY',
    short_id_scheme: 'D=directory, S=settings, A=article, P=page, K=kv, R=r2, F=file. Numeric suffix is the 1-based index after sorting that kind by name ASC.',
    counts: {
      directory: directory.length, settings: settings.length, article: articles.length,
      page: pages.length, kv: kv.length, r2: r2.length, file: files.length, total: all.length,
    },
    rows: all,
  });
}
