import { isBuildAuthed } from '../../_lib/admin_session.js';
import { invalidateDirSnapshot } from '../../_lib/dir_snapshot.js';
import { logEvent } from '../../_lib/event_log.js';
import { DIR_SCHEMA, restFor } from '../../_lib/dir_schema.js';
import { renderDirWidgetResponse } from '../../_lib/dir_widgets.js';
import { directoryRowSkillMarkdown } from '../../_lib/article_skill.js';
import { registryHygieneViolation } from '../../_lib/registry_hygiene.js';

function json(obj, status) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: { 'content-type': 'application/json' } });
}
async function authed(request, env) { return isBuildAuthed(request, env); }

const ORDER = 'ORDER BY (seq IS NULL), seq ASC, (key = "ROUTER") DESC, key ASC';

async function readRow(env, key) {
  return env.DB.prepare('SELECT * FROM directory WHERE key = ?').bind(key).first();
}

async function rowNumFor(env, key) {
  const r = await env.DB.prepare('SELECT key FROM directory ' + ORDER).all();
  const idx = (r.results || []).findIndex(row => row.key === key);
  return idx >= 0 ? idx + 1 : null;
}

// CONTRACT VERSIONING (spec Phase 1.5, migration 0357). A directory row's `content` is the
// contract a model reads before invoking; until now edits overwrote it in place, so a receipt
// naming object_id could not prove which contract text it ran under. Every mutation that changes
// content now appends a (key, version, content_hash) row to directory_versions. Best-effort by
// the same rule as the DO/ledger hooks: a versioning hiccup never fails the D1 write, and the
// table degrades gracefully until 0357 is applied.
async function recordContractVersion(env, key, actor) {
  try {
    const row = await env.DB.prepare('SELECT content FROM directory WHERE key=?').bind(key).first();
    if (!row) return;
    const content = String(row.content || '');
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content));
    const hash = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
    const last = await env.DB.prepare('SELECT version, content_hash FROM directory_versions WHERE key=? ORDER BY version DESC LIMIT 1').bind(key).first();
    if (last && String(last.content_hash) === hash) return; // content unchanged — no version
    await env.DB.prepare('INSERT INTO directory_versions (key,version,content,content_hash,actor,ts) VALUES (?,?,?,?,?,?)')
      .bind(key, Number(last?.version || 0) + 1, content, hash, actor || null, new Date().toISOString()).run();
  } catch {}
}

// Every directory mutation flows through ONE control point (this file). On each write
// we (1) register the slug in the bound DirectoryDO so the slug registry stays current
// and (2) log the mutation raw to the LEDGER. Both are best-effort — a registry/ledger
// hiccup never fails the D1 write (D1 is the source of truth).
async function afterMutation(env, action, key, row) {
  if (env.DIRECTORY_DO) {
    try {
      const id = env.DIRECTORY_DO.idFromName('main');
      await env.DIRECTORY_DO.get(id).fetch(new Request('https://do/?op=slug.register', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug: key, kind: 'row', target: row ? `${row.type}:${row.target || ''}` : `delete:${action}` }),
      }));
    } catch {}
  }
  try {
    await logEvent(env, {
      source: 'directory', key: 'DIRECTORY_MUTATE', action, direction: 'IN', route: '/api/directory/' + key,
      request: JSON.stringify({ action, key, row: row || null }), response: 'ok',
    });
  } catch {}
}

// AN AGENT'S SETTINGS, WHERE THE AGENT IS.
//
// dispatch() already reads a per-agent override for each of these before every call —
// `<KEY>_model`, `<KEY>_temperature`, `<KEY>_reasoning_effort`, `<KEY>_web_search`,
// `<KEY>_mcp`. They worked and were invisible: nothing listed them, nothing wrote them, so
// the only way to change one agent's model was to know the naming convention. These are the
// five the dispatcher actually honours, and no more — a settings box that silently does
// nothing is worse than no box.
const AGENT_SETTINGS = [
  { name: 'model',            note: 'model id for this agent only; empty = the global grok_model' },
  { name: 'temperature',      note: '0–2; empty = the global grok_temperature' },
  { name: 'reasoning_effort', note: 'none | low | high, model dependent' },
  { name: 'web_search',       note: '1 = let this agent search the web' },
  { name: 'mcp',              note: 'comma-separated MCP servers to attach' },
];

async function readSetting(env, k) {
  try {
    if (env.KV) { const v = await env.KV.get(k); if (v != null) return v; }
    const r = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind(k).first();
    return r?.value ?? null;
  } catch { return null; }
}

// D1 is the record, KV is the fast path dispatch reads first. Both, or the change appears to
// work and then does not.
async function writeSetting(env, k, v) {
  const val = String(v == null ? '' : v);
  await env.DB.prepare(
    'INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
  ).bind(k, val).run();
  if (env.KV) { try { if (val) await env.KV.put(k, val); else await env.KV.delete(k); } catch {} }
}

// The full REST request this agent would send, in the shape the LLM sheet's column A uses:
// method, url, headers, body — the whole envelope, with the credential left as a placeholder.
async function agentBlock(env, row, key) {
  const vals = {};
  for (const s of AGENT_SETTINGS) vals[s.name] = (await readSetting(env, key + '_' + s.name)) || '';
  const globals = {
    model: (await readSetting(env, 'grok_model')) || 'grok-4.3',
    temperature: (await readSetting(env, 'grok_temperature')) || '0.7',
    reasoning_effort: (await readSetting(env, 'grok_reasoning_effort')) || '',
    web_search: (await readSetting(env, 'grok_web_search')) || '0',
    tool_loops: (await readSetting(env, 'agent_tool_loops')) || '8',
    memory_window: (await readSetting(env, 'agent_memory_window')) || '6',
    cost_cap: (await readSetting(env, 'agent_cost_cap')) || '',
  };
  const model = vals.model || globals.model;
  const temperature = Number(vals.temperature || globals.temperature);
  const effort = vals.reasoning_effort || globals.reasoning_effort;
  const body = {
    model,
    messages: [
      { role: 'system', content: String(row.content || '') },
      { role: 'user', content: '{{INPUT}}' },
    ],
    temperature: Number.isFinite(temperature) ? temperature : 0.7,
    stream: false,
  };
  if (effort) body.reasoning_effort = effort;
  const envelope = {
    method: 'POST',
    url: 'https://api.x.ai/v1/chat/completions',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer INJECTED_BY_WORKER' },
    body,
  };
  return {
    what: 'The settings this agent runs under, and the exact request it sends. Paste request_json '
        + "into the LLM sheet's column A and it runs there unchanged.",
    name: key,
    identity_at: 'the content field of this row — /admin/directory, or PATCH {content} here',
    request_json: JSON.stringify(envelope, null, 2),
    effective: { model, temperature: body.temperature, reasoning_effort: effort || null,
      web_search: (vals.web_search || globals.web_search) === '1',
      tool_loops: Number(globals.tool_loops), memory_turns: Number(globals.memory_window) },
    overrides: vals,
    global_defaults: globals,
    settings_reference: AGENT_SETTINGS,
    change_one: 'PATCH /api/directory/' + encodeURIComponent(key)
      + ' {"agent_model":"grok-4.3","agent_temperature":"0.4"} — an empty string clears the override',
    change_identity: 'PATCH /api/directory/' + encodeURIComponent(key) + ' {"content":"<the system prompt>"}',
    caveat: 'These five are the ones dispatch reads per agent. tool_loops, memory_turns and the '
          + 'cost cap are global for every agent, and are shown so the effective figure is not a guess.',
  };
}

export async function onRequestGet(context) {
  const { env, params, request } = context;
  const key = String(params.key);
  const fmt = new URL(request.url).searchParams.get('format');
  // ARTICLE PROJECTION (owner law, 2026-07-29): article:<slug> is a directory object that
  // RESOLVES to the canonical articles row — never a second copy of its content. One object,
  // simultaneously an article and a directory row; one token edits it through the same verbs.
  if (key.startsWith('article:')) {
    const slug = key.slice(8).toLowerCase();
    const a = await env.DB.prepare('SELECT slug, title, updated_at, published FROM articles WHERE slug=?').bind(slug).first();
    if (!a) return json({ error: 'not found', hint: 'search: /api/directory/search?q=<words> lists article:<slug> projections' }, 404);
    return json({
      key,
      type: 'article',
      kind: 'projection',
      canonical: '/api/articles/' + a.slug,
      title: a.title,
      updated_at: a.updated_at,
      published: !!a.published,
      human: '/a/' + a.slug,
      edit_ui: '/admin/articles/' + a.slug,
      skill: '/skills/article-editing',
      verbs: {
        read: 'GET /api/articles/' + a.slug + '   (?format=post = re-postable shape)',
        edit: "PATCH /api/articles/" + a.slug + " {find,replace,expected_hash} — auth: Authorization: Bearer <act token> OR ?share=<act token>",
        replace: 'PUT /api/articles/' + a.slug + ' {title,body,...,replace:true} — same token',
        sources: 'POST /api/articles/' + a.slug + '/webhook {kind:"source",data:{url,title,quote}}',
        rewrite: 'POST /api/articles/' + a.slug + '/rewrite {find,instruction} — proposal + apply recipe',
        download: 'GET /api/articles/export?slug=' + a.slug,
        validate_token: 'GET /api/token/validate?share=<token> — or curl with Authorization: Bearer',
      },
      note: 'This row holds no content. The article at canonical is the single source of truth.',
    });
  }
  const [row, row_num] = await Promise.all([readRow(env, key), rowNumFor(env, key)]);
  if (!row) return json({ error: 'not found' }, 404);
  const related = row.category
    ? (await env.DB.prepare('SELECT key, type, category FROM directory WHERE category = ? AND key <> ? AND enabled <> 0 ORDER BY planner_rank, key LIMIT 24').bind(row.category, key).all()).results || []
    : [];
  const agentInfo = String(row.type || '') === 'agent' ? await agentBlock(env, row, key) : null;
  if (fmt === 'widgets') return renderDirWidgetResponse([{ ...row, row_num }], { title: `Directory · ${key}` });
  // Every agent row carries its settings and its whole REST request, so tapping an agent shows
  // what it is and what it sends — not a name and a type.
  const isAgent = String(row.type || '') === 'agent';
  if (fmt === 'agent') {
    if (!isAgent) return json({ error: 'not_an_agent', key, type: row.type }, 422);
    return json({ key, ...(await agentBlock(env, row, key)) });
  }
  // OBJECT FOLDER LAW — a directory capability is downloadable as one folder.
  if (fmt === 'zip' || fmt === 'folder' || fmt === 'manifest') {
    const url = new URL(request.url);
    const manifest = {
      law: 'One link, one identity, many representations, downloadable as one folder.',
      id: `directory:${key}`,
      key,
      type: row.type,
      category: row.category || null,
      canonical_url: `https://miscsubjects.com/a/directory/${encodeURIComponent(key)}`,
      representations: {
        human: `/a/directory/${encodeURIComponent(key)}`,
        json: `/api/directory/${encodeURIComponent(key)}`,
        skill: `/api/directory/${encodeURIComponent(key)}?format=skill`,
        contract: `/api/dispatch?key=${encodeURIComponent(key)}`,
        folder_zip: `/api/directory/${encodeURIComponent(key)}?format=zip`,
      },
    };
    if (fmt === 'manifest') return json(manifest);
    const { zipBytes } = await import('../../_lib/object_folder.js');
    let html = null;
    try {
      const res = await fetch(new URL(`/a/directory/${encodeURIComponent(key)}`, url.origin));
      if (res.ok) html = await res.text();
    } catch {}
    const files = [
      { path: `${key}/article.md`, text: `# ${key}\n\ntype: ${row.type || 'fn'} · category: ${row.category || 'uncategorized'}\n\n${row.content || ''}\n` },
      { path: `${key}/article.json`, text: JSON.stringify({ ...row, row_num }, null, 2) },
      { path: `${key}/skill/SKILL.md`, text: directoryRowSkillMarkdown(row) },
      ...(html ? [{ path: `${key}/article.html`, text: html }] : []),
      { path: `${key}/manifest.json`, text: JSON.stringify(manifest, null, 2) },
    ];
    return new Response(zipBytes(files), {
      status: 200,
      headers: {
        'content-type': 'application/zip',
        'content-disposition': `attachment; filename="${encodeURIComponent(key)}.zip"`,
        'cache-control': 'public, max-age=60',
        'x-object-id': `directory:${key}`,
      },
    });
  }
  if (fmt === 'skill') {
    return new Response(directoryRowSkillMarkdown(row), {
      headers: {
        'content-type': 'text/markdown; charset=utf-8',
        'content-disposition': `inline; filename="${encodeURIComponent(key)}-SKILL.md"`,
        'cache-control': 'public, max-age=120',
      },
    });
  }
  return json({
    ...row,
    row_num,
    ...(agentInfo ? { agent: agentInfo } : {}),
    _rest: restFor(key),
    _schema: DIR_SCHEMA.fields,
    _object: {
      identity: `directory:${key}`,
      object_type: 'directory-object',
      representations: {
        article: `/a/directory/${encodeURIComponent(key)}`,
        json: `/api/directory/${encodeURIComponent(key)}`,
        skill: `/api/directory/${encodeURIComponent(key)}?format=skill`,
        oip_contract: `/api/dispatch?key=${encodeURIComponent(key)}`,
      },
      ontology: {
        parent: row.category ? `category:${row.category}` : 'category:uncategorized',
        siblings: related.map((item) => ({
          id: `directory:${item.key}`,
          key: item.key,
          relation: 'shares_capability_family',
          article: `/a/directory/${encodeURIComponent(item.key)}`,
          skill: `/api/directory/${encodeURIComponent(item.key)}?format=skill`,
        })),
      },
      law: 'This directory definition is also a human article, model Skill, and invocable OIP object under one identity.',
    },
  });
}

export async function onRequestPut(context) {
  const { request, env, params } = context;
  if (!(await authed(request, env))) return json({ error: 'unauthorized' }, 401);
  const key = String(params.key);
  let b;
  try { b = await request.json(); } catch { return json({ error: 'invalid json' }, 400); }
  if (!b || !b.type) return json({ error: 'type required' }, 400);
  const existing = await readRow(env, key);
  const violation = registryHygieneViolation({
    sensitive: b.sensitive != null ? b.sensitive : existing?.sensitive,
    auth: b.auth,
    input_schema: b.input_schema,
    examples: b.examples,
    content: b.content,
  });
  if (violation) return json({ error: 'registry_hygiene_refused: ' + violation.code, key, how_to_fix: violation.fix, state_changed: false }, 422);
  const ts = new Date().toISOString();
  await env.DB.prepare(
    'INSERT INTO directory (key, type, target, auth, content, includes, category, allowed_categories, seq, enabled, planner_visible, planner_rank, input_schema, examples, sensitive, runner, updated_at, created_at) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ' +
    'ON CONFLICT(key) DO UPDATE SET type=excluded.type, target=excluded.target, auth=excluded.auth, content=excluded.content, includes=excluded.includes, ' +
    'category=excluded.category, allowed_categories=excluded.allowed_categories, seq=excluded.seq, enabled=excluded.enabled, ' +
    'planner_visible=excluded.planner_visible, planner_rank=excluded.planner_rank, input_schema=excluded.input_schema, ' +
    'examples=excluded.examples, sensitive=excluded.sensitive, runner=excluded.runner, updated_at=excluded.updated_at'
  ).bind(
    key, String(b.type), String(b.target || ''), String(b.auth || ''), String(b.content || ''),
    b.includes != null ? String(b.includes) : null,
    b.category != null ? String(b.category) : null,
    b.allowed_categories != null ? String(b.allowed_categories) : null,
    b.seq != null ? Number(b.seq) : null,
    b.enabled != null ? Number(b.enabled) : 1,
    b.planner_visible != null ? Number(b.planner_visible) : 1,
    b.planner_rank != null ? Number(b.planner_rank) : 100,
    b.input_schema != null ? String(b.input_schema) : null,
    b.examples != null ? String(b.examples) : null,
    b.sensitive != null ? Number(b.sensitive) : Number(existing?.sensitive ?? 0),
    b.runner != null ? String(b.runner) : (existing?.runner || null),
    ts,
    ts
  ).run();
  await invalidateDirSnapshot(env);
  await recordContractVersion(env, key, 'put');
  await afterMutation(env, 'put', key, { type: String(b.type), target: String(b.target || '') });
  return json({ ok: true, key, updated_at: ts });
}

export async function onRequestPatch(context) {
  const { request, env, params } = context;
  if (!(await authed(request, env))) return json({ error: 'unauthorized' }, 401);
  const key = String(params.key);
  const row = await readRow(env, key);
  if (!row) return json({ error: 'not found' }, 404);
  let b;
  try { b = await request.clone().json(); } catch { b = null; }
  // Gate only NEW violations — a row already non-compliant (one of the ~600 the audit found)
  // must still be patchable for unrelated maintenance (category, seq, etc.) without forcing
  // a full backfill in the same call. Block only a patch that makes a compliant row non-compliant.
  if (b) {
    const before = registryHygieneViolation({ sensitive: row.sensitive, auth: row.auth, input_schema: row.input_schema, examples: row.examples, content: row.content });
    const merged = {
      sensitive: Object.prototype.hasOwnProperty.call(b, 'sensitive') ? b.sensitive : row.sensitive,
      auth: Object.prototype.hasOwnProperty.call(b, 'auth') ? b.auth : row.auth,
      input_schema: Object.prototype.hasOwnProperty.call(b, 'input_schema') ? b.input_schema : row.input_schema,
      examples: Object.prototype.hasOwnProperty.call(b, 'examples') ? b.examples : row.examples,
      content: Object.prototype.hasOwnProperty.call(b, 'content') ? b.content : row.content,
    };
    const after = registryHygieneViolation(merged);
    if (!before && after) return json({ error: 'registry_hygiene_refused: ' + after.code, key, how_to_fix: after.fix, state_changed: false }, 422);
  } else {
    return json({ error: 'invalid json' }, 400);
  }
  const FIELDS = ['type', 'target', 'auth', 'content', 'includes', 'category', 'allowed_categories', 'seq', 'enabled', 'planner_visible', 'planner_rank', 'input_schema', 'examples', 'sensitive', 'runner'];
  const sets = [], vals = [];
  for (const f of FIELDS) {
    if (b && Object.prototype.hasOwnProperty.call(b, f)) { sets.push(f + ' = ?'); vals.push(b[f]); }
  }
  // agent_<name> writes the per-agent override dispatch reads before every call. Kept separate
  // from the directory columns above: these live in `settings`, not in the directory row, and an
  // empty string clears the override rather than storing an empty model id.
  const agentWrites = [];
  for (const spec of AGENT_SETTINGS) {
    const f = 'agent_' + spec.name;
    if (b && Object.prototype.hasOwnProperty.call(b, f)) {
      await writeSetting(env, key + '_' + spec.name, b[f]);
      agentWrites.push(spec.name);
    }
  }
  if (!sets.length) {
    if (agentWrites.length) {
      await invalidateDirSnapshot(env);
      return json({ ok: true, key, agent_settings_written: agentWrites, note: 'takes effect on the next call' });
    }
    return json({ error: 'no recognized fields' }, 400);
  }
  const ts = new Date().toISOString();
  sets.push('updated_at = ?'); vals.push(ts); vals.push(key);
  await env.DB.prepare('UPDATE directory SET ' + sets.join(', ') + ' WHERE key = ?').bind(...vals).run();
  await invalidateDirSnapshot(env);
  await recordContractVersion(env, key, 'patch');
  const after = await readRow(env, key);
  await afterMutation(env, 'patch', key, after ? { type: after.type, target: after.target } : null);
  return json({ ok: true, key, updated_at: ts, fields: sets.length - 1, agent_settings_written: agentWrites });
}

export async function onRequestDelete(context) {
  const { request, env, params } = context;
  if (!(await authed(request, env))) return json({ error: 'unauthorized' }, 401);
  const key = String(params.key);
  const r = await env.DB.prepare('DELETE FROM directory WHERE key = ?').bind(key).run();
  await invalidateDirSnapshot(env);
  await afterMutation(env, 'delete', key, null);
  return json({ ok: true, key, deleted: r.meta.changes });
}
