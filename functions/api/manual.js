
import { DIR_SCHEMA, restFor } from '../_lib/dir_schema.js';
import { dispatch } from './dispatch.js';
import { deriveInvoke } from '../_lib/invoke_spec.js';

const BASE = 'https://miscsubjects.com';

// The single response envelope every JSON endpoint follows, stated once so any LLM
// parses every result the same way.
const ENVELOPE = {
  note: 'Standard result shapes. Parse these and you parse the whole build.',
  dispatch: '{ "trace": "t_xxxx", "result": "<string|json-string>", "cost": <number> }  — from POST /api/dispatch',
  rest_ok: '2xx + JSON body of the affected object (article/file/row/…)',
  rest_err: 'non-2xx + { "error": "<reason>" }',
  fn_or_flow_result: 'result is a JSON string for fn/flow rows — JSON.parse(result) to read it',
  shape_mode: 'POST /api/dispatch {key,body,shape:true} OR GET /api/manual?test=<key> — returns the fully-shaped outbound request without sending',
};

const AUTH_NOTE = 'edits (PUT/DELETE/POST that mutate) require header  x-terminal-key: <TERMINAL_KEY>';

// Fixed REST surfaces (the non-directory endpoints), each with a literal request shape.
function surfaces() {
  return {
    run_any_capability: { method: 'POST', url: `${BASE}/api/dispatch`, body: { key: '<KEY>', body: '<args>', actor: '<optional tag>' }, note: 'the one door — runs any directory row' },
    list_capabilities: { method: 'GET', url: `${BASE}/api/directory`, note: 'every row; add ?type=agent|http|fn|flow' },
    create_capability: { method: 'POST', url: `${BASE}/api/directory`, body: { key: '<KEY>', type: 'fn|http|agent|flow', target: '<target>', content: '<template/prompt/dsl>' } },
    edit_capability: { method: 'PATCH', url: `${BASE}/api/directory/<KEY>`, body: { content: '<new>' }, note: 'partial; PUT for full upsert; DELETE to remove' },
    inventory: { method: 'GET', url: `${BASE}/api/inventory`, note: 'every file/object with read/edit/delete; ?kind=file,r2,kv,directory,page,article' },
    file_read: { method: 'GET', url: `${BASE}/api/file/<path>` },
    file_write: { method: 'PUT', url: `${BASE}/api/file/<path>`, headers: { 'x-terminal-key': '<KEY>' }, body: { content: '<text>', message: '<optional commit msg>' }, note: 'commits to GitHub main' },
    file_delete: { method: 'DELETE', url: `${BASE}/api/file/<path>`, headers: { 'x-terminal-key': '<KEY>' } },
    article_create: { method: 'POST', url: `${BASE}/api/articles`, body: { slug: '<slug>', title: '<title>', body: '<markdown body>', hero: '<url>', images: [{url:'<url>',caption:'<text>'}], style: {theme:'light|dark',accent:'#hex',font:'"Georgia", serif',measure:'680'} }, note: 'hero, images, style are optional. body is markdown with ## headings, **bold**, ![alt](url), [text](url). Public page: /a/<slug>' },
    article_read: { method: 'GET', url: `${BASE}/api/articles/<slug>`, note: 'returns {slug,title,body,hero,images,style,created_at,updated_at}' },
    article_patch: { method: 'PATCH', url: `${BASE}/api/articles/<slug>`, body: { title: '<new>', body: '<new>', hero: '<new>', images: '<new>', style: '<new>' }, note: 'partial edit; any field omitted is left unchanged' },
    article_delete: { method: 'DELETE', url: `${BASE}/api/articles/<slug>`, note: 'removes article and all its data' },
    article_list: { method: 'GET', url: `${BASE}/api/articles`, note: 'returns {articles:[{slug,title,updated_at}]}' },
    page_read: { method: 'GET', url: `${BASE}/api/pages/<slug>`, note: 'D1 page; ?versions=1 for history. NOTE: the homepage / is the static file public/index.html, not a D1 page.' },
    page_write: { method: 'PUT|PATCH', url: `${BASE}/api/pages/<slug>`, body: { title: '<title>', body_html: '<html>' }, note: 'PUT upserts, PATCH edits; each write snapshots a version' },
    page_delete: { method: 'DELETE', url: `${BASE}/api/pages/<slug>` },
    content_list: { method: 'GET', url: `${BASE}/api/content`, note: 'filters ?type ?status ?section ?tag ?q ?limit · ?title=<exact>' },
    content_create: { method: 'POST', url: `${BASE}/api/content`, body: { slug: '<slug>', type: '<type>', title: '<title>', body_md: '<markdown>', tags: ['<tag>'] } },
    content_edit: { method: 'PATCH', url: `${BASE}/api/content/<slug>`, body: { body_md: '<new>' }, note: 'body_json merges field-by-field; snapshots a version' },
    content_delete: { method: 'DELETE', url: `${BASE}/api/content/<slug>` },
    kv: { method: 'GET|PUT|DELETE', url: `${BASE}/api/kv`, note: 'key in ?key= ; also the agent settings store (convo_max, agent_tool_loops, grok_web_search, grok_temperature, todo_autorun, gas_webhook_url)' },
    r2: { method: 'GET|PUT|DELETE', url: `${BASE}/api/r2/<path>` },
    settings: { method: 'GET|PUT|PATCH|DELETE', url: `${BASE}/api/settings/<key>` },
    ledger_turns_for_gas: { method: 'GET', url: `${BASE}/admin/ledger?turns=1`, note: 'ONE JSON object per inbound iMessage: {message, tools:[{key,in,out}], routed, reply}. Filters ?trace_id ?q ?limit. The view to point Google Apps Script at.' },
    ledger_raw: { method: 'GET', url: `${BASE}/admin/ledger?data=1`, note: 'raw events, one row per step. Filters ?source ?key ?trace_id ?q ?limit (<=1000).' },
    send_message: { method: 'POST', url: `${BASE}/api/dispatch`, body: { key: 'SEND_BY_CHANNEL', body: 'blooio|<phone-or-chat>|<text>' }, note: 'the build sends an iMessage/text itself' },
    deploy: { method: 'POST', url: `${BASE}/api/dispatch`, body: { key: 'WRANGLER_DEPLOY', body: '' }, note: 'runs `wrangler pages deploy public` on the Mac bridge; makes committed code live' },
    run_shell: { method: 'POST', url: `${BASE}/api/dispatch`, body: { key: 'LOCAL_EXEC', body: '<any shell line>' }, note: 'full shell on the Mac' },
    screenshot: { method: 'POST', url: `${BASE}/api/dispatch`, body: { key: 'LOCAL_SCREENSHOT', body: '' }, note: 'screenshots the Mac, returns a stable URL' },
    ontology_index: { method: 'GET', url: `${BASE}/api/map`, note: 'routes + bindings + counts (the index; this endpoint is the full shape dump)' },
  };
}

function docOf(content) {
  // The leading comment lines of a row's content are its self-doc.
  const lines = String(content || '').split('\n');
  const doc = [];
  for (const ln of lines) { if (ln.startsWith('#')) doc.push(ln.replace(/^#+\s?/, '')); else break; }
  return doc.join(' ').trim();
}

function capabilityOf(row) {
  const argTemplate = row.type === 'http' || row.type === 'fn' ? (String(row.content || '').split('\n').filter((l) => !l.startsWith('#'))[0] || '') : '';
  // Full derived call spec (exact signature, per-arg legend, secrets used, RETURNS,
  // EXAMPLE, REST forms) — same layer the admin views use, now exposed as JSON.
  let invoke_spec; try { invoke_spec = deriveInvoke(row); } catch (e) { invoke_spec = { error: String(e && e.message || e) }; }
  return {
    key: row.key,
    type: row.type,
    category: row.category || null,
    doc: docOf(row.content),
    invoke: { method: 'POST', url: `${BASE}/api/dispatch`, body: { key: row.key, body: '<args>' } },
    invoke_spec: invoke_spec,
    args_template: argTemplate || undefined,
    edit: restFor(row.key),
    examples: row.examples || undefined,
    test: `GET ${BASE}/api/manual?test=${encodeURIComponent(row.key)}`,
  };
}

function json(o, s) { return new Response(JSON.stringify(o, null, 2), { status: s || 200, headers: { 'content-type': 'application/json' } }); }

export async function onRequestGet(context) {
  const { env, request } = context;
  const u = new URL(request.url);
  const wantKey = u.searchParams.get('key');
  const wantType = u.searchParams.get('type');
  const testKey = u.searchParams.get('test');
  const slim = u.searchParams.get('slim') === '1';

  // ?test=<KEY> — dry-run the row (shape only, fires nothing) and return the shaped request.
  if (testKey) {
    try {
      const r = await dispatch(env, testKey, u.searchParams.get('body') || '', { shapeOnly: true });
      return json({ tested: testKey, shaped: r.result, note: 'shape only — nothing was sent or run' });
    } catch (e) { return json({ tested: testKey, error: String(e && e.message || e) }, 500); }
  }

  let rows = [];
  try { rows = (await env.DB.prepare('SELECT key,type,target,content,category,examples FROM directory ORDER BY key').all()).results || []; } catch (e) { /* DB optional */ }
  if (wantType) rows = rows.filter((r) => r.type === wantType);

  // ?key=<KEY> — one capability, full detail.
  if (wantKey) {
    const row = rows.find((r) => r.key === wantKey);
    if (!row) return json({ error: 'unknown key: ' + wantKey }, 404);
    return json({ build: 'miscsubjects', ts: new Date().toISOString(), capability: capabilityOf(row) });
  }

  const out = {
    build: 'miscsubjects',
    ts: new Date().toISOString(),
    note: 'One call = the whole build, with the exact request for every capability and how to test it. Every capability is REST.',
    auth: AUTH_NOTE,
    envelope: ENVELOPE,
    bootstrap: [
      'GET /api/manual           -> this (every capability + its request + its test)',
      'POST /api/dispatch {key,body} -> run any capability',
      'GET /api/manual?test=<key> -> prove a capability\'s request shape without firing it',
    ],
    surfaces: surfaces(),
    directory_schema: DIR_SCHEMA,
    counts: { capabilities: rows.length },
  };
  if (!slim) out.capabilities = rows.map(capabilityOf);
  return json(out);
}
