import { isBuildAuthed } from '../../_lib/admin_session.js';
import { invalidateDirSnapshot } from '../../_lib/dir_snapshot.js';
import { DIR_SCHEMA, restFor } from '../../_lib/dir_schema.js';
import { renderDirWidgetResponse } from '../../_lib/dir_widgets.js';
import { registryHygieneViolation } from '../../_lib/registry_hygiene.js';
import { hashEnvironmentDescriptor, normalizeEnvironmentDescriptor, stableDescriptorJson, validateEnvironmentDescriptor } from '../../_lib/environment_descriptor.js';

const COLS = ['key', 'type', 'target', 'auth', 'content', 'includes', 'category', 'allowed_categories', 'seq', 'enabled', 'planner_visible', 'planner_rank', 'input_schema', 'examples', 'sensitive', 'runner', 'object_kind', 'descriptor_json', 'descriptor_rev', 'descriptor_hash'];
const ORDER = "ORDER BY (seq IS NULL), seq ASC, (key = 'ROUTER') DESC, key ASC";

function json(obj, status) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: { 'content-type': 'application/json' } });
}

const TEST_COLS = ['invocation', 'invocation_curl', 'last_status', 'last_response', 'test_state', 'tested_at'];

async function listRows(env, type) {
  const binds = [];
  const where = type ? 'WHERE type = ? ' : '';
  if (type) binds.push(type);
  // The invocation-record columns arrive with migration 0375; read them when present and fall
  // back to the older shape while it lands, so the list never goes dark.
  try {
    const r = await env.DB.prepare('SELECT ' + [...COLS, ...TEST_COLS].join(', ') + ', updated_at FROM directory ' + where + ORDER).bind(...binds).all();
    return (r.results || []).map((row, idx) => ({ ...row, row_num: idx + 1 }));
  } catch {
    const r = await env.DB.prepare('SELECT ' + COLS.join(', ') + ', updated_at FROM directory ' + where + ORDER).bind(...binds).all();
    return (r.results || []).map((row, idx) => ({ ...row, row_num: idx + 1 }));
  }
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const type = url.searchParams.get('type');
  const fmt = url.searchParams.get('format');
  const rowNumParam = url.searchParams.get('row_num');
  let rows = await listRows(env, type);
  // ?brief=1 — the catalog a model can read: no payload columns (a full list is ~5 MB once every row
  // carries its invocation and last response). Keeps key, type, category, state, docs.
  if (url.searchParams.get('brief')) {
    rows = rows.map((r) => ({ key: r.key, type: r.type, category: r.category, test_state: r.test_state, tested_at: r.tested_at, enabled: r.enabled, planner_visible: r.planner_visible,
      docs: String(r.content || '').split('\n').filter((l) => /^\s*#/.test(l)).map((l) => l.replace(/^\s*#\s?/, '')).join(' ').slice(0, 300), row_num: r.row_num }));
  }

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
  let descriptor = null;
  if (Object.prototype.hasOwnProperty.call(b, 'descriptor_json')) {
    let supplied;
    try { supplied = typeof b.descriptor_json === 'string' ? JSON.parse(b.descriptor_json) : b.descriptor_json; }
    catch { return json({ error: 'descriptor_json must be valid JSON', state_changed: false }, 422); }
    const checked = validateEnvironmentDescriptor(supplied);
    if (!checked.ok) return json({ error: 'environment_descriptor_refused', details: checked.errors, state_changed: false }, 422);
    descriptor = normalizeEnvironmentDescriptor({ ...checked.descriptor, revision: 1, directory_key: String(b.key) });
  }
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
  const descriptorJson = descriptor ? stableDescriptorJson(descriptor) : null;
  const descriptorHash = descriptor ? await hashEnvironmentDescriptor(descriptor) : null;
  try {
    await env.DB.prepare(
      'INSERT INTO directory (key, type, target, auth, content, includes, category, allowed_categories, seq, enabled, planner_visible, planner_rank, input_schema, examples, sensitive, runner, object_kind, descriptor_json, descriptor_rev, descriptor_hash, updated_at) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
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
      // object_kind is NOT NULL since 0373: a row created without a descriptor is an agent or a capability.
      descriptor ? descriptor.kind : (b.object_kind != null ? String(b.object_kind) : (String(b.type) === 'agent' ? 'agent' : 'capability')),
      descriptorJson,
      descriptor ? 1 : null,
      descriptorHash,
      ts
    ).run();
  } catch (e) {
    return json({ error: 'insert failed: ' + (e && e.message || String(e)) }, 409);
  }
  await invalidateDirSnapshot(env);
  return json({ ok: true, key: String(b.key), updated_at: ts,
    ...(descriptor ? { ref: descriptor.ref, descriptor_rev: 1, descriptor_hash: descriptorHash } : {}) }, 201);
}
