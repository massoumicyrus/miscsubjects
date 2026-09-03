function extractDocs(content) {
  const lines = String(content || '').split('\n');
  const out = [];
  for (const ln of lines) {
    if (/^\s*#/.test(ln)) out.push(ln.replace(/^\s*#\s?/, ''));
    else break;
  }
  return out.join(' ').trim();
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const q = url.searchParams.get('q') || '';
  const category = url.searchParams.get('category') || '';
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '20', 10) || 20, 1), 100);

  const where = ['IFNULL(enabled,1)=1', 'IFNULL(planner_visible,1)=1'];
  const binds = [];
  if (q) {
    where.push('(LOWER(key) LIKE ? OR LOWER(IFNULL(category,"")) LIKE ? OR LOWER(IFNULL(content,"")) LIKE ?)');
    const like = '%' + q.toLowerCase() + '%';
    binds.push(like, like, like);
  }
  if (category) {
    where.push('category = ?');
    binds.push(category);
  }
  binds.push(limit);

  const sql =
    'SELECT key, type, category, content, target, planner_rank ' +
    'FROM directory WHERE ' + where.join(' AND ') +
    ' ORDER BY IFNULL(planner_rank,100), key LIMIT ?';

  const r = await env.DB.prepare(sql).bind(...binds).all();
  const rows = (r.results || []).map(x => ({
    key: x.key,
    type: x.type,
    category: x.category,
    target: x.target,
    planner_rank: x.planner_rank ?? 100,
    docs: extractDocs(x.content),
  }));

  // ARTICLES ARE DIRECTORY OBJECTS (owner law, 2026-07-29). Every article is discoverable
  // here as a PROJECTION — key article:<slug> resolving to the canonical articles row.
  // Nothing is copied: the row carries pointers, the article stays the one source of truth.
  if (q) {
    const like = '%' + q.toLowerCase() + '%';
    const arts = await env.DB.prepare(
      "SELECT slug, title, updated_at FROM articles WHERE published=1 AND (LOWER(slug) LIKE ? OR LOWER(title) LIKE ?) AND COALESCE(json_extract(meta,'$.register'),'standard') NOT IN ('source_ledger','source','audit') ORDER BY updated_at DESC LIMIT ?"
    ).bind(like, like, limit).all();
    for (const a of (arts.results || [])) {
      rows.push({
        key: 'article:' + a.slug,
        type: 'article',
        category: 'articles',
        target: '/api/articles/' + a.slug,
        planner_rank: 100,
        docs: a.title,
        human: '/a/' + a.slug,
        edit: '/admin/articles/' + a.slug,
        object: '/api/directory/article:' + a.slug,
      });
    }
  }

  return new Response(JSON.stringify({ q, category, count: rows.length, rows }), {
    headers: { 'content-type': 'application/json' },
  });
}
