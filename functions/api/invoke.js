// /api/invoke — invokeJSON. One model call, or two hundred in parallel, in one round trip.
//
// The whole call is a JSON object. Nothing about a prompt lives in JavaScript: `key` names
// a directory row, everything else overrides it for this call only.
//
//   POST /api/invoke
//   { "key": "WRITER_AGENT_v5", "input": "write the lede" }
//
//   POST /api/invoke                       -- 100 replies, one request, in parallel
//   { "key": "WRITER_AGENT_v5", "inputs": ["row 1", "row 2", ... ] }
//
//   POST /api/invoke                       -- same input, five prompt versions, side by side
//   { "calls": [ {"key":"V1","input":"x"}, {"key":"V2","input":"x"}, ... ] }
//
//   POST /api/invoke                       -- no row at all, literal prompt
//   { "model": "kimi", "system": "You are terse.", "input": "hi", "memory": "Owner hates hedging." }
//
//   GET /api/invoke?key=WRITER&input=hello&format=text
//
// Query/header knobs:
//   ?format=text   -> plain text, one reply per line (tabs escaped) — for Sheets IMPORTDATA
//   ?format=csv    -> label,ok,ms,model,text
//   ?shape=1       -> build the exact outbound payload and DO NOT send it
//
// Auth: an admin session cookie, or `authorization: Bearer <TERMINAL_KEY>`, or ?token=.
// Model calls cost money, so this is never open.

import { isBuildAuthed } from '../_lib/admin_session.js';
import { invokeJSON, expandSpecs, buildRequest, loadRows, loadBlocks, CORE_FIELDS, PASSTHROUGH_FIELDS } from '../_lib/invoke_json.js';
import { logEvent } from '../_lib/event_log.js';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization,x-invoke-token,x-terminal-key',
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...CORS },
  });
}

function plain(text, status = 200, type = 'text/plain') {
  return new Response(text, {
    status,
    headers: { 'content-type': type + '; charset=utf-8', 'cache-control': 'no-store', ...CORS },
  });
}

function bearer(request) {
  const h = String(request.headers.get('authorization') || '');
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : '';
}

async function authed(request, env, url) {
  const keys = [env.TERMINAL_KEY, env.INVOKE_TOKEN, env.AIG_SHIM_TOKEN].filter(Boolean).map(String);
  const presented = bearer(request)
    || String(url.searchParams.get('token') || '')
    || String(request.headers.get('x-invoke-token') || '')
    || String(request.headers.get('x-terminal-key') || ''); // the shape Apps Script already sends
  if (presented && keys.includes(presented)) return true;
  return isBuildAuthed(request, env);
}

// The Sheets lane: one cell per reply, so a tab or newline inside an answer cannot shift
// the grid. Escaped, not truncated — the whole answer is still there.
function oneLine(s) {
  return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/\t/g, '\\t').replace(/\r?\n/g, '\\n');
}

function csvCell(s) {
  return '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"';
}

function render(out, format) {
  if (format === 'text') {
    return plain(out.results.map((r) => (r.ok ? oneLine(r.text) : 'ERROR: ' + oneLine(r.error))).join('\n'));
  }
  if (format === 'csv') {
    const head = 'label,ok,ms,model,text';
    const rows = out.results.map((r) =>
      [csvCell(r.label), r.ok ? 'true' : 'false', r.ms, csvCell(r.model), csvCell(r.ok ? r.text : 'ERROR: ' + r.error)].join(','));
    return plain([head, ...rows].join('\n'), 200, 'text/csv');
  }
  return json(out, out.ok ? 200 : 207);
}

// Dry run: exactly what would go on the wire, built by the same function that sends it.
async function shape(env, payload) {
  const specs = expandSpecs(payload);
  const rows = await loadRows(env, specs.map((s) => s.key));
  const blocks = await loadBlocks(env);
  return {
    ok: true, sent: false, count: specs.length,
    requests: specs.map((s) => {
      const missing = s.key && !rows[s.key];
      const built = buildRequest(s, rows[s.key] || null, blocks);
      return { label: s.label || s.key || null, ...(missing ? { error: 'unknown directory key: ' + s.key } : {}), body: built.body };
    }),
  };
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // ?fields=1 — the full controllable REST object as a table: field, type, default, note.
  // The sheet's MODEL_FIELDS tab reads exactly this, so a knob can never appear in one and
  // not the other.
  if (url.searchParams.get('fields')) {
    return json({
      endpoint: '/api/invoke',
      what: 'every field you can control on a model call through this lane',
      core: CORE_FIELDS,
      sampling_passthrough: PASSTHROUGH_FIELDS,
      note: 'A field not in these two lists is not controllable here. Nothing is silently ignored.',
    });
  }

  if (!url.searchParams.get('key') && !url.searchParams.get('system') && !url.searchParams.get('input')) {
    return json({
      endpoint: '/api/invoke',
      what: 'invokeJSON — one model call, or up to 200 in parallel, in one round trip. No prompt lives in code.',
      auth: 'admin cookie, `authorization: Bearer <TERMINAL_KEY>`, or ?token=',
      call_object: {
        key: 'directory row (type=agent) supplying system prompt + model — optional',
        model: 'override; alias (kimi|glm|fast|grok|gpt|opus5|sonnet5) or any gateway model id',
        system: 'literal system prompt; overrides the row content',
        memory: 'extra block appended under a MEMORY header, this call only',
        includes: 'csv of prompt_block keys composed ahead of the system prompt',
        input: 'the user message', messages: 'full [{role,content}] array; wins over input',
        inputs: 'array of user messages -> one parallel call each',
        n: 'run the same call n times in parallel (sampling / variance)',
        vars: '{NAME:value} substituted for {{NAME}} in system and input',
        temperature: 'number', max_tokens: 'number (default 2048)',
        json: 'true -> ask the model for a JSON object', timeout_ms: 'default 25000, max 60000',
        label: 'echoed back on the result',
      },
      batch_forms: ['{calls:[...]}', '[...]', '{key, inputs:[...]}', '{key, n:5}'],
      formats: { json: 'default', text: '?format=text — one reply per line, for Sheets', csv: '?format=csv' },
      shape: '?shape=1 builds the outbound payload and does not send it',
      examples: [
        'curl -X POST https://miscsubjects.com/api/invoke -H "authorization: Bearer $TERMINAL_KEY" -d \'{"key":"ROUTER","input":"hello"}\'',
        'curl -X POST https://miscsubjects.com/api/invoke -H "authorization: Bearer $TERMINAL_KEY" -d \'{"model":"fast","system":"Be terse.","inputs":["a","b","c"]}\'',
        'GET /api/invoke?key=ROUTER&input=hello&format=text&token=$TERMINAL_KEY',
      ],
      lab: '/admin/prompts — click any prompt, edit model/system/input/memory, tap Generate',
    });
  }

  if (!(await authed(request, env, url))) return json({ error: 'unauthorized' }, 401);

  const p = url.searchParams;
  const spec = {};
  for (const f of ['key', 'model', 'system', 'memory', 'includes', 'input', 'label']) {
    if (p.get(f) != null) spec[f] = p.get(f);
  }
  for (const f of ['temperature', 'max_tokens', 'n', 'timeout_ms']) {
    if (p.get(f) != null) spec[f] = Number(p.get(f));
  }
  if (p.get('json') === '1') spec.json = true;
  if (p.get('inputs')) spec.inputs = p.get('inputs').split('\n');

  if (p.get('shape') === '1') return json(await shape(env, spec));
  const out = await invokeJSON(env, spec);
  context.waitUntil(receipt(env, out, 'GET'));
  return render(out, p.get('format'));
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  if (!(await authed(request, env, url))) return json({ error: 'unauthorized' }, 401);

  let payload;
  try { payload = await request.json(); }
  catch { return json({ error: 'invalid json body' }, 400); }

  if (url.searchParams.get('shape') === '1' || payload.shape === true) {
    return json(await shape(env, payload));
  }

  const out = await invokeJSON(env, payload);
  context.waitUntil(receipt(env, out, 'POST'));
  return render(out, url.searchParams.get('format') || payload.format);
}

// A receipt for every batch: how many calls, how many answered, how long. This is the
// number that makes "the model was slow" a measurement instead of an impression.
async function receipt(env, out, verb) {
  await logEvent(env, {
    source: 'invoke_json',
    route: '/api/invoke',
    actor: 'invoke',
    action: verb,
    direction: 'out',
    status: out.ok ? 200 : 207,
    request: { verb, count: out.count },
    response: {
      ok: out.ok, count: out.count, ok_count: out.ok_count, ms: out.ms,
      models: [...new Set(out.results.map((r) => r.model))],
      errors: out.results.filter((r) => !r.ok).map((r) => r.error).slice(0, 10),
    },
  }).catch(() => {});
}
