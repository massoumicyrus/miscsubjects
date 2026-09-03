
const GATEWAY = 'default';

// Short names verified against this account's catalogue. Kept in sync with
// functions/api/aig/[[path]].js — both resolve to the same gateway ids.
export const ALIASES = {
  kimi: '@cf/moonshotai/kimi-k2.7-code',
  'kimi-k2.7-code': '@cf/moonshotai/kimi-k2.7-code',
  'kimi-k2.6': '@cf/moonshotai/kimi-k2.6',
  'kimi-k3': 'moonshotai/kimi-k3',
  glm: '@cf/zai-org/glm-5.2',
  'glm-5.2': '@cf/zai-org/glm-5.2',
  'glm-flash': '@cf/zai-org/glm-4.7-flash',
  fast: '@cf/zai-org/glm-4.7-flash',
  grok: 'xai/grok-4.5',
  gpt: 'openai/gpt-5.5',
  minimax: 'minimax/m3',
  opus5: 'anthropic/claude-opus-5',
  sonnet5: 'anthropic/claude-sonnet-5',
};

export const DEFAULT_MODEL = '@cf/moonshotai/kimi-k2.7-code';
export const DEFAULT_TIMEOUT_MS = 25000;
export const MAX_TIMEOUT_MS = 60000;
export const MAX_CALLS = 200;

// Ids written provider-first with a colon (grok:grok-4, openai:gpt-4o, gemini:…, kimi:…) were
// published by /api/models before the gateway catalogue existed. Workers AI answers them with
// "No such model", so they are translated to the catalogue's own provider prefix here.
const PROVIDER_PREFIX = {
  grok: 'xai/', xai: 'xai/', openai: 'openai/', gpt: 'openai/',
  gemini: 'google-ai-studio/', google: 'google-ai-studio/',
  kimi: 'moonshotai/', moonshot: 'moonshotai/', anthropic: 'anthropic/', minimax: 'minimax/',
};

export function resolveModel(raw, env) {
  const asked = String(raw || '').trim();
  if (!asked) return (env && env.AIG_DEFAULT_MODEL) || DEFAULT_MODEL;
  if (ALIASES[asked]) return ALIASES[asked];
  const m = asked.match(/^([a-z0-9-]+):(.+)$/i);
  if (m) {
    const pre = PROVIDER_PREFIX[m[1].toLowerCase()];
    if (pre) return pre + m[2];
  }
  return asked;
}

function aiBase(env) {
  return 'https://api.cloudflare.com/client/v4/accounts/' + env.CF_ACCOUNT_ID + '/ai';
}

function compatUrl(env) {
  return `https://gateway.ai.cloudflare.com/v1/${env.CF_ACCOUNT_ID}/${env.AIG_GATEWAY_ID || GATEWAY}/compat/chat/completions`;
}

function subVars(text, vars) {
  if (!text || !vars) return text || '';
  return String(text).replace(/\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g, (m, name) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : m);
}

// Directory rows named by `key`, fetched once for a whole batch.
export async function loadRows(env, keys) {
  const want = [...new Set(keys.filter(Boolean).map(String))];
  const map = {};
  if (!want.length || !env.DB) return map;
  const marks = want.map(() => '?').join(',');
  try {
    const r = await env.DB.prepare(
      `SELECT key, type, target, content, includes, enabled FROM directory WHERE key IN (${marks})`
    ).bind(...want).all();
    for (const row of r.results || []) map[row.key] = row;
  } catch {}
  return map;
}

export async function loadBlocks(env) {
  const map = {};
  if (!env.DB) return map;
  try {
    const r = await env.DB.prepare(
      "SELECT key, content FROM directory WHERE target = 'prompt_block' OR category LIKE 'block_%'"
    ).all();
    for (const row of r.results || []) if (row.key && row.content) map[row.key] = String(row.content);
  } catch {}
  return map;
}

// Turn one call object + its row into the exact system prompt and messages that go on the
// wire. Pure: the lab's "shape" view and the live call use this same function, so what you
// preview is byte-identical to what gets sent.
export function buildRequest(spec, row, blocks) {
  const vars = spec.vars && typeof spec.vars === 'object' ? spec.vars : null;
  const parts = [];

  const includes = String(spec.includes != null ? spec.includes : (row && row.includes) || '')
    .split(',').map((s) => s.trim()).filter(Boolean);
  for (const k of includes) {
    const b = blocks && blocks[k];
    if (b) parts.push(`=== ${k} ===\n${b}`);
  }

  let system = spec.system != null ? String(spec.system) : String((row && row.content) || '');
  system = system.replace(/^@includes\s+[^\n]+\n?/i, '');
  if (system.trim()) parts.push(system);

  if (spec.memory && String(spec.memory).trim()) {
    parts.push(`=== MEMORY (appended for this call only) ===\n${String(spec.memory).trim()}`);
  }

  const finalSystem = subVars(parts.join('\n\n'), vars);

  let messages;
  if (Array.isArray(spec.messages) && spec.messages.length) {
    messages = spec.messages.map((m) => ({
      role: String(m.role || 'user'),
      content: subVars(String(m.content == null ? '' : m.content), vars),
    }));
    if (finalSystem && !messages.some((m) => m.role === 'system')) {
      messages.unshift({ role: 'system', content: finalSystem });
    }
  } else {
    messages = [];
    if (finalSystem) messages.push({ role: 'system', content: finalSystem });
    messages.push({ role: 'user', content: subVars(String(spec.input == null ? '' : spec.input), vars) });
  }

  const model = resolveModel(spec.model || (row && row.target), null);

  // Anthropic through the gateway refuses a `system` role outright: its messages array accepts
  // only user and assistant. The system prompt is not dropped — it is folded into the first user
  // turn, so the same call object reaches every provider with the same instructions.
  if (/^anthropic\//.test(model)) {
    const sys = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
    messages = messages.filter((m) => m.role !== 'system');
    if (sys) {
      const first = messages.find((m) => m.role === 'user');
      if (first) first.content = sys + '\n\n' + first.content;
      else messages.unshift({ role: 'user', content: sys });
    }
  }

  const body = {
    model,
    messages,
    max_tokens: Number.isFinite(Number(spec.max_tokens)) ? Number(spec.max_tokens) : 2048,
  };
  if (spec.temperature != null && spec.temperature !== '' && Number.isFinite(Number(spec.temperature))) {
    body.temperature = Number(spec.temperature);
  }
  if (spec.json) body.response_format = { type: 'json_object' };
  // The rest of the provider's sampling object, passed through when named. Whitelisted so a
  // typo cannot become a silently ignored knob: anything here is a field the caller controls,
  // and anything not here is not controllable from this lane. PASSTHROUGH_FIELDS is the
  // contract the /admin/models-catalog and the sheet's MODEL_FIELDS tab both publish.
  for (const f of PASSTHROUGH_FIELDS) {
    const v = spec[f.name];
    if (v == null || v === '') continue;
    if (f.type === 'number') {
      if (Number.isFinite(Number(v))) body[f.name] = Number(v);
    } else if (f.type === 'boolean') {
      body[f.name] = v === true || v === 'true' || v === 1 || v === '1';
    } else if (f.type === 'string[]') {
      body[f.name] = Array.isArray(v) ? v.map(String) : String(v).split(/\s*,\s*/).filter(Boolean);
    } else {
      body[f.name] = String(v);
    }
  }
  return { body, system: finalSystem };
}

// Every sampling field this lane forwards to the provider, with its type and default.
// GET /api/invoke?fields=1 returns this list — one source of truth for the docs, the admin
// surface, and the sheet.
export const PASSTHROUGH_FIELDS = [
  { name: 'top_p', type: 'number', default: 'provider', note: 'nucleus sampling, 0–1' },
  { name: 'top_k', type: 'number', default: 'provider', note: 'sample from k most likely tokens' },
  { name: 'seed', type: 'number', default: 'none', note: 'same seed + same body = repeatable output' },
  { name: 'stop', type: 'string[]', default: 'none', note: 'comma-separated; generation halts on any of them' },
  { name: 'presence_penalty', type: 'number', default: 'provider', note: 'penalise tokens already present' },
  { name: 'frequency_penalty', type: 'number', default: 'provider', note: 'penalise tokens by frequency' },
  { name: 'repetition_penalty', type: 'number', default: 'provider', note: 'Cloudflare/Workers-AI models' },
];

// Fields handled explicitly above the passthrough loop, plus the prompt-composition fields.
// Published alongside PASSTHROUGH_FIELDS so the full controllable object is one table.
export const CORE_FIELDS = [
  { name: 'key', type: 'string', default: 'none', note: 'directory row holding the system prompt' },
  { name: 'model', type: 'string', default: "row's target", note: 'alias or full provider id' },
  { name: 'system', type: 'string', default: "row's content", note: 'overrides the row for this call only' },
  { name: 'input', type: 'string', default: 'empty', note: 'the user message' },
  { name: 'inputs', type: 'string[]', default: 'none', note: 'one parallel call per entry, one round trip' },
  { name: 'messages', type: 'object[]', default: 'none', note: 'full role/content array instead of input' },
  { name: 'memory', type: 'string', default: 'none', note: 'appended under a MEMORY header, not saved' },
  { name: 'includes', type: 'string', default: "row's includes", note: 'csv of prompt_block rows composed ahead' },
  { name: 'vars', type: 'object', default: 'none', note: '{{name}} substitution in system and input' },
  { name: 'max_tokens', type: 'number', default: '2048', note: 'hard output ceiling' },
  { name: 'temperature', type: 'number', default: 'provider', note: '0 = deterministic-ish' },
  { name: 'n', type: 'number', default: '1', note: 'answers per input, 1–50, all in flight at once' },
  { name: 'json', type: 'boolean', default: 'false', note: 'sets response_format json_object' },
  { name: 'timeout_ms', type: 'number', default: '25000', note: 'a breach is a named failure, never silence' },
  { name: 'label', type: 'string', default: 'key or model', note: 'names the result row' },
];

function textOf(payload) {
  if (!payload) return '';
  const c = payload.choices && payload.choices[0];
  if (c) {
    if (c.message && typeof c.message.content === 'string') return c.message.content;
    if (typeof c.text === 'string') return c.text;
    if (c.message && Array.isArray(c.message.content)) {
      return c.message.content.map((p) => (typeof p === 'string' ? p : p.text || '')).join('');
    }
  }
  if (typeof payload.response === 'string') return payload.response;
  if (payload.result && typeof payload.result.response === 'string') return payload.result.response;
  // Anthropic answers in its own shape even on the compat route: content blocks, no choices.
  // Reading only the OpenAI shape logged a 200 with seven output tokens as the model saying
  // nothing, which is the one mistake this function exists to prevent.
  if (Array.isArray(payload.content)) {
    return payload.content.filter((p) => p && p.type === 'text').map((p) => p.text || '').join('');
  }
  if (payload.result && Array.isArray(payload.result.content)) {
    return payload.result.content.filter((p) => p && p.type === 'text').map((p) => p.text || '').join('');
  }
  return '';
}

// One model call. Always returns — never throws, never hangs. A timeout is a RESULT with
// ok:false and error 'timeout', not silence: that distinction is what a Cloudflare error
// page being logged as "the model said nothing" cost the last measurement run.
export async function callOne(env, spec, row, blocks) {
  const started = Date.now();
  const { body, system } = buildRequest(spec, row, blocks);
  const label = spec.label != null ? String(spec.label) : (spec.key || body.model);

  if (!env.CF_ACCOUNT_ID || !env.CLOUDFLARE_API_TOKEN) {
    return { ok: false, label, model: body.model, ms: 0, text: '', error: 'no_credentials: CF_ACCOUNT_ID + CLOUDFLARE_API_TOKEN required' };
  }

  const timeoutMs = Math.min(
    MAX_TIMEOUT_MS,
    Number.isFinite(Number(spec.timeout_ms)) && Number(spec.timeout_ms) > 0 ? Number(spec.timeout_ms) : DEFAULT_TIMEOUT_MS
  );
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  const headers = {
    authorization: 'Bearer ' + env.CLOUDFLARE_API_TOKEN,
    'content-type': 'application/json',
    ...(env.AIG_RUN_TOKEN ? { 'cf-aig-authorization': 'Bearer ' + env.AIG_RUN_TOKEN } : {}),
  };

  const done = (extra) => ({ label, model: body.model, ms: Date.now() - started, system_chars: system.length, ...extra });

  try {
    let endpoint = aiBase(env) + '/v1/chat/completions';
    const send = (b) => fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(b), signal: ctl.signal });
    let r = await send(body);

    // A catalogue id (xai/, openai/, moonshotai/, anthropic/, minimax/) is not on the account AI
    // surface: it answers 404, or 400 "No such model". Both mean the same thing — the model lives
    // on the gateway's compat endpoint — so both re-route there rather than surfacing a routing
    // detail as a model failure.
    if (r.status === 404 || (!r.ok && /no such model/i.test(await r.clone().text()))) {
      endpoint = compatUrl(env);
      r = await send(body);
    }

    if (r.status === 400) {
      const first = await r.clone().text();
      if (/max_completion_tokens/.test(first)) {
        const retry = { ...body, max_completion_tokens: body.max_tokens };
        delete retry.max_tokens; delete retry.temperature;
        r = await send(retry);
      } else if (/temperature/i.test(first) && body.temperature !== undefined) {
        const retry = { ...body };
        delete retry.temperature;
        r = await send(retry);
      }
    }

    const raw = await r.text();
    if (!r.ok) {
      // An HTML body from a 5xx is an edge error page, not a model answer. Say which.
      const html = /^\s*<(?:!doctype|html)/i.test(raw);
      return done({
        ok: false, text: '', http: r.status,
        error: (html ? 'edge_error_page' : 'upstream_' + r.status) + ': ' + raw.slice(0, 400),
      });
    }
    let payload = null;
    try { payload = JSON.parse(raw); } catch {
      return done({ ok: false, text: '', http: r.status, error: 'unparseable_upstream: ' + raw.slice(0, 400) });
    }
    const text = textOf(payload);
    return done({
      ok: true, text, http: r.status,
      // A 200 that yields no text is either a real silence or a shape this reader does not know.
      // Naming the shape turns the second case from an investigation into a fact on the result.
      ...(text ? {} : {
        empty_shape: Object.keys(payload || {}).join(',')
          + (payload && payload.result && typeof payload.result === 'object'
            ? ' | result:' + Object.keys(payload.result).join(',') : '')
          + (payload && payload.choices && payload.choices[0]
            ? ' | choice:' + JSON.stringify(payload.choices[0]).slice(0, 400) : ''),
      }),
      usage: payload.usage || null,
      finish_reason: (payload.choices && payload.choices[0] && payload.choices[0].finish_reason) || null,
    });
  } catch (e) {
    const aborted = e && (e.name === 'AbortError' || /abort/i.test(String(e.message || e)));
    return done({ ok: false, text: '', error: aborted ? `timeout after ${timeoutMs}ms` : 'fetch_failed: ' + (e && e.message || String(e)) });
  } finally {
    clearTimeout(timer);
  }
}

// Expand the sugar forms into a flat list of call objects.
//   {calls:[...]} | [...] | {..., inputs:[a,b,c]} | {..., n:5} | {...}
export function expandSpecs(payload) {
  let list;
  if (Array.isArray(payload)) list = payload;
  else if (payload && Array.isArray(payload.calls)) list = payload.calls;
  else list = [payload || {}];

  const out = [];
  for (const spec of list) {
    if (!spec || typeof spec !== 'object') continue;
    const inputs = Array.isArray(spec.inputs) && spec.inputs.length ? spec.inputs : [null];
    const n = Math.max(1, Math.min(50, Number(spec.n) || 1));
    for (let i = 0; i < inputs.length; i++) {
      for (let j = 0; j < n; j++) {
        const one = { ...spec };
        delete one.inputs; delete one.n;
        if (inputs[i] !== null) one.input = inputs[i];
        if (one.label == null) {
          const base = spec.label || spec.key || spec.model || 'call';
          one.label = inputs.length > 1 || n > 1 ? `${base}#${i}${n > 1 ? '.' + j : ''}` : String(base);
        }
        out.push(one);
      }
    }
  }
  return out;
}

// The whole batch, in parallel, in one round trip. Cap is a backstop, not a queue: every
// call in a batch is in flight at the same time.
export async function invokeJSON(env, payload) {
  const started = Date.now();
  const specs = expandSpecs(payload);
  if (!specs.length) return { ok: false, error: 'no calls', count: 0, ms: 0, results: [] };
  if (specs.length > MAX_CALLS) {
    return { ok: false, error: `too many calls: ${specs.length} > ${MAX_CALLS}`, count: specs.length, ms: 0, results: [] };
  }
  const [rows, blocks] = await Promise.all([
    loadRows(env, specs.map((s) => s.key)),
    specs.some((s) => s.includes || (s.key && !s.system)) ? loadBlocks(env) : Promise.resolve({}),
  ]);
  const missing = specs.filter((s) => s.key && !rows[s.key]).map((s) => s.key);
  const results = await Promise.all(specs.map((s) => {
    if (s.key && !rows[s.key]) {
      return Promise.resolve({
        ok: false, label: s.label || s.key, model: null, ms: 0, text: '',
        error: `unknown directory key: ${s.key} — create it with POST /api/directory`,
      });
    }
    return callOne(env, s, rows[s.key] || null, blocks);
  }));
  return {
    ok: results.every((r) => r.ok),
    count: results.length,
    ok_count: results.filter((r) => r.ok).length,
    ms: Date.now() - started,
    ...(missing.length ? { missing_keys: [...new Set(missing)] } : {}),
    results,
  };
}
