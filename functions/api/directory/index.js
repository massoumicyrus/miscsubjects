import { isBuildAuthed } from '../../_lib/admin_session.js';
import { invalidateDirSnapshot } from '../../_lib/dir_snapshot.js';
import { DIR_SCHEMA, restFor } from '../../_lib/dir_schema.js';
import { renderDirWidgetResponse } from '../../_lib/dir_widgets.js';
import { registryHygieneViolation } from '../../_lib/registry_hygiene.js';

const COLS = ['key', 'type', 'target', 'auth', 'content', 'includes', 'category', 'allowed_categories', 'seq', 'enabled', 'planner_visible', 'planner_rank', 'input_schema', 'examples', 'sensitive', 'runner'];
const ORDER = 'ORDER BY (seq IS NULL), seq ASC, (key = "ROUTER") DESC, key ASC';

function json(obj, status) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: { 'content-type': 'application/json' } });
}

async function listRows(env, type) {
  let sql = 'SELECT ' + COLS.join(', ') + ', updated_at FROM directory ';
  const binds = [];
  if (type) { sql += 'WHERE type = ? '; binds.push(type); }
  sql += ORDER;
  const r = await env.DB.prepare(sql).bind(...binds).all();
  return (r.results || []).map((row, idx) => ({ ...row, row_num: idx + 1 }));
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const type = url.searchParams.get('type');
  const fmt = url.searchParams.get('format');
  const rowNumParam = url.searchParams.get('row_num');
  const rows = await listRows(env, type);

  if (rowNumParam) {
    const n = parseInt(rowNumParam, 10);
    if (!Number.isFinite(n) || n < 1) return json({ error: 'row_num must be a positive integer' }, 400);
    if (n > rows.length) return json({ error: 'row_num out of range', max: rows.length }, 404);
    const row = rows[n - 1];
    if (fmt === 'widgets') return renderDirWidgetResponse([row], { title: `Directory row #${n}` });
    return json({ ...row, _rest: restFor(row.key), _schema: DIR_SCHEMA.fields });
  }

  if (fmt === 'widgets') {
    return renderDirWidgetResponse(rows, { title: type ? `Directory · ${type}` : 'Directory' });
  }

  return json({ count: rows.length, type: type || 'all', schema: DIR_SCHEMA, rows });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await isBuildAuthed(request, env))) return json({ error: 'unauthorized' }, 401);
  let b;
  try { b = await request.json(); } catch { return json({ error: 'invalid json' }, 400); }
  if (!b || !b.key || !b.type) return json({ error: 'key and type required' }, 400);
  const violation = registryHygieneViolation({
    sensitive: b.sensitive,
    auth: b.auth,
    input_schema: b.input_schema,
    examples: b.examples,
    content: b.content,
  });
  if (violation) {
    return json({
      error: 'registry_hygiene_refused: ' + violation.code,
      key: String(b.key),
      how_to_fix: violation.fix,
      state_changed: false,
    }, 422);
  }
  const ts = new Date().toISOString();
  try {
    await env.DB.prepare(
      'INSERT INTO directory (key, type, target, auth, content, includes, category, allowed_categories, seq, enabled, planner_visible, planner_rank, input_schema, examples, sensitive, runner, updated_at) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      String(b.key), String(b.type), String(b.target || ''), String(b.auth || ''), String(b.content || ''),
      b.includes != null ? String(b.includes) : null,
      b.category != null ? String(b.category) : null,
      b.allowed_categories != null ? String(b.allowed_categories) : null,
      b.seq != null ? Number(b.seq) : null,
      b.enabled != null ? Number(b.enabled) : 1,
      b.planner_visible != null ? Number(b.planner_visible) : 1,
      b.planner_rank != null ? Number(b.planner_rank) : 100,
      b.input_schema != null ? String(b.input_schema) : null,
      b.examples != null ? String(b.examples) : null,
      b.sensitive != null ? Number(b.sensitive) : 0,
      b.runner != null ? String(b.runner) : null,
      ts
    ).run();
  } catch (e) {
    return json({ error: 'insert failed: ' + (e && e.message || String(e)) }, 409);
  }
  await invalidateDirSnapshot(env);
  return json({ ok: true, key: String(b.key), updated_at: ts }, 201);
}
