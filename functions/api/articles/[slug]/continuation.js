
function json(o, status = 200) {
  return new Response(JSON.stringify(o), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', 'cache-control': 'no-store' },
  });
}

const MAX_EXCLUDE = 1200;
const MAX_LIMIT = 24;
const MAX_RINGS = 3;

export async function onRequest({ request, env, params }) {
  const slug = String(params.slug || '').toLowerCase();
  const url = new URL(request.url);
  let exclude = [];
  let limit = 16;
  if (request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    exclude = Array.isArray(body.exclude) ? body.exclude : [];
    limit = Number(body.limit) || 16;
  } else {
    exclude = String(url.searchParams.get('exclude') || '').split(',');
    limit = Number(url.searchParams.get('limit')) || 16;
  }
  limit = Math.max(1, Math.min(limit, MAX_LIMIT));
  const visited = new Set(
    exclude.map((s) => String(s).trim().toLowerCase()).filter(Boolean).slice(0, MAX_EXCLUDE),
  );
  visited.add(slug);

  const out = [];
  const push = (rows, via) => {
    for (const r of rows) {
      const s = String(r.slug || '').toLowerCase();
      if (!s || visited.has(s)) continue;
      visited.add(s);
      out.push({ slug: s, via });
      if (out.length >= limit) return true;
    }
    return out.length >= limit;
  };

  try {
    // Ring by ring over the link graph, both directions — what this article cites and what cites
    // it are the same neighborhood to a reader following the subject.
    let ring = [slug];
    for (let depth = 1; depth <= MAX_RINGS && ring.length && out.length < limit; depth++) {
      const ph = ring.map(() => '?').join(',');
      const rows = (await env.DB.prepare(
        `SELECT DISTINCT a.slug, a.updated_at
           FROM article_links l
           JOIN articles a ON a.slug = CASE WHEN l.from_slug IN (${ph}) THEN l.to_slug ELSE l.from_slug END
          WHERE (l.from_slug IN (${ph}) OR l.to_slug IN (${ph}))
            AND l.resolved = 1 AND a.published = 1
          ORDER BY a.updated_at DESC LIMIT 120`,
      ).bind(...ring, ...ring, ...ring).all()).results || [];
      const fresh = rows.filter((r) => !visited.has(String(r.slug).toLowerCase()));
      push(fresh, 'graph ring ' + depth);
      ring = fresh.map((r) => String(r.slug).toLowerCase());
    }

    // The component ran dry before the page filled: widen to the article's declared family.
    if (out.length < limit) {
      const meta = await env.DB.prepare('SELECT meta FROM articles WHERE slug=?').bind(slug).first();
      let m = {};
      try { m = JSON.parse(meta?.meta || '{}') || {}; } catch { m = {}; }
      const cat = typeof m.category === 'string' && m.category.trim() ? m.category.trim() : null;
      if (cat) {
        const rows = (await env.DB.prepare(
          `SELECT slug FROM articles WHERE published=1 AND json_extract(meta,'$.category')=? ORDER BY updated_at DESC LIMIT 60`,
        ).bind(cat).all()).results || [];
        push(rows, 'category: ' + cat);
      }
      const firstTag = Array.isArray(m.tags)
        ? m.tags.map(String).find((t) => !['canonical', 'ongoing', 'topic', 'matrix'].includes(t))
        : null;
      if (out.length < limit && firstTag) {
        const rows = (await env.DB.prepare(
          `SELECT slug FROM articles WHERE published=1 AND json_extract(meta,'$.tags') LIKE ? ORDER BY updated_at DESC LIMIT 60`,
        ).bind('%"' + firstTag + '"%').all()).results || [];
        push(rows, 'tag: ' + firstTag);
      }
    }

    // Only a genuinely exhausted neighborhood falls back to the corpus at large, newest first.
    let exhausted = false;
    if (out.length < limit) {
      const rows = (await env.DB.prepare(
        `SELECT slug FROM articles WHERE published=1 ORDER BY updated_at DESC LIMIT ?`,
      ).bind(Math.min(visited.size + limit + 40, 500)).all()).results || [];
      push(rows, 'corpus, newest');
      exhausted = out.length < limit;
    }

    return json({ slug, count: out.length, articles: out, exhausted });
  } catch (e) {
    return json({ ok: false, error: 'continuation_threw', detail: String(e?.message || e) }, 500);
  }
}
