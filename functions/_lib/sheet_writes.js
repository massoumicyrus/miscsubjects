import { writePin } from './sheet_views.js';

export const WRITABLE_FIELDS = Object.freeze({
  directory: ['content', 'target', 'type', 'auth', 'category', 'includes', 'input_schema', 'examples', 'runner', 'enabled', 'planner_visible', 'planner_rank', 'seq', 'sensitive', 'allowed_categories'],
  articles: ['title', 'subject', 'published', 'body', 'meta'],
});

export function fieldWritable(source, field) {
  return (WRITABLE_FIELDS[source] || []).includes(String(field));
}

export async function writeViewCell(env, { source, id, field, value, actor, origin = 'https://miscsubjects.com', fetchImpl = fetch } = {}) {
  const src = String(source || '');
  const f = String(field || '');
  if (!fieldWritable(src, f)) return { error: 'field_not_writable', source: src, field: f, writable: WRITABLE_FIELDS[src] || [] };
  if (src === 'directory') return writePin(env, 'directory/' + String(id) + '/' + f, value, actor || 'sheet-view');
  if (src === 'articles') {
    const slug = String(id || '').trim();
    if (!slug) return { error: 'slug_required' };
    const headers = { 'content-type': 'application/json', 'x-terminal-key': String(env.TERMINAL_KEY || '') };
    const body = {};
    if (f === 'body') {
      const cur = await fetchImpl(origin + '/api/articles/' + encodeURIComponent(slug), { headers });
      const j = await cur.json().catch(() => ({}));
      if (!cur.ok) return { error: 'article_read_failed', status: cur.status };
      body.body = String(value == null ? '' : value);
      body.expected_hash = j.body_hash || j.hash || null;
    } else if (f === 'published') {
      body.published = /^(1|true|yes|published)$/i.test(String(value)) ? 1 : 0;
    } else if (f === 'meta') {
      try { body.meta = typeof value === 'string' ? JSON.parse(value) : value; } catch { return { error: 'meta_must_be_json' }; }
    } else body[f] = String(value == null ? '' : value);
    const res = await fetchImpl(origin + '/api/articles/' + encodeURIComponent(slug), { method: 'PATCH', headers, body: JSON.stringify(body) });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || out.ok === false) return { error: out.error || ('HTTP ' + res.status), detail: out.how_to_fix || out.current_hash || null, status: res.status };
    return { ok: true, source: 'articles', id: slug, field: f, updated_at: out.updated_at || null };
  }
  return { error: 'source_not_writable', source: src };
}
