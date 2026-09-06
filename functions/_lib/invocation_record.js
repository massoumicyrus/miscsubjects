import { deriveInvoke } from './invoke_spec.js';

export const STATE = Object.freeze({ works: '🟢 works', broken: '🔴 broken', untested: '🟡 untested' });
export const MAX_RESPONSE_CHARS = 60000;

// Keys whose effect leaves the build or destroys a record. The batch never fires these.
const OUTWARD = /^(EMAIL_SEND|EMAIL_SEND_TRACKED|RESEND_EMAILS|LEADS_SEND|LEADS_SEND_BATCH|LEADS_DRAFT|LEADS_SWEEP|LEADS_RUN_CITY|LEADS_FOLLOWUPS|OUTREACH_|QUEUE_SEND|X_POST|X_REPLY|X_DELETE|REDDIT_REPLY|BLOOIO_SEND|BLOOIO_CREATE|BLOOIO_DELETE|BLOOIO_UPDATE|BLOOIO_ADD|BLOOIO_REMOVE|BLOOIO_ROTATE|BLOOIO_REPLAY|BLOOIO_VOTE|BLOOIO_SET|BLOOIO_MARK|BLOOIO_SHARE|BLOOIO_FINISH|BLOOIO_TURN|TWOCHAT_SEND|SEND_|FED_SEND|VOICE_SEND|VOICE_SAY|GROK_VOICE_SEND|PHONE_|NOTIFY_OWNER|LOCAL_|DESKTOP_|EAGLE_IMSG|STRIPE_(CREATE|INVOICE_|PI_CREATE|PRICE_CREATE|PRODUCT_CREATE|CUSTOMER_CREATE|CUSTOMER_UPDATE|CUSTOMER_DELETE|REFUND|SUBSCRIPTION_CANCEL|PAYMENT_LINK_CREATE|WRITE|CATALOG_SYNC)|PAYMENTS_(CREATE|STRIPE_API_WRITE)|META_ADS_(ADSET_CREATE|ADSET_UPDATE|AD_CREATE|AD_UPDATE|AUDIENCE_CREATE|BUDGET_SET|CAMPAIGN_CREATE|CAMPAIGN_UPDATE|CATALOG_CREATE|CREATIVE_CREATE|LOOKALIKE_CREATE|OBJECT_DELETE|STATUS_SET)|META_CAPI_EVENT|KLAVIYO$|GOOGLE_CALENDAR_CREATE|GOOGLE_SHEETS_APPEND|AUTOMATE_(FIRE|FORCE|DELETE|ADD|TOGGLE)|CRON_|SCHEDULER_SET|WATCH_RULE_(ADD|DELETE)|DELTASK|TASK_DELETE|TASKS_ASSIGN|DEL_ROW|BLOCK_DELETE|PAGES_DELETE|FILE_(PUT|PATCH|CLAIM)|KV_(PUT|PUT_JSON|DEL|APPEND)|R2_(PUT|DEL)|D1_EXEC|D1_REPAIR|LEDGER_EXEC|CHAIN_SEAL|SEAL_PANEL|DEPLOY_LEASE|CAP_(MINT|REVOKE)|WITNESS_MINT|LAWS_(ADD|EDIT|DELETE)|DIR_PATCH|EDIT_ROW|ADD_ROW|ARTICLE_(PUT|INGEST|CLAIM)|ART_PATCH|PAGE_PATCH|PAGES_(CREATE|PUT)|BLOCK_(EDIT|MERGE|MOVE|MOVE_GROUP|REUSE|SPLIT|DIVIDE|COPY|COMMENT|ARA|VERDICT)|VOXEL_|SHORT_EDIT|SETTINGS_|SET_PUT|SET_(COST_CAP|DEPTH_CAP|MEMORY_WINDOW|TOOL_LOOPS)|FORGET|REMEMBER|EDIT_MEMORY|HISTORY_SET|REASONING_SET|PROMPT_APPEND|AGENT_SPAWN|AGENT_SPAWN_CLI|CLI_SPAWN|CLI_|APPS_SCRIPT_RUN|SHORTCUT_RUN|PLAYWRIGHT|BROWSER_USE|WEBHOOK_INTAKE|RELAY_POST_APPEND|MIRROR_APPEND|WORK_APPEND|OPOS_DROP|OIP_(SEED|REPAIR|PURIFICATION_SEED|REVIEW_SEED|ATOMIZE_QUEUE)|QUE_(ADD|RUN)|TODO_RUN|TEAM_RUN|TRAIL_(RUN|SAVE)|PROTOCOL_RUN|GOVERNOR_RUN|PROSECUTOR_RUN|EDITORIAL_BOARD_RUN|FIDELITY_RUN|BOARD_TICK|LANDSCAPE_NEXT|BUILD_LANDSCAPE|GRAPH_GROW|ARXIV_GROW|POPULATE|PIPELINE_(SEED|WRITE)|ISSUE_SWEEP|GITHUB_(CREATE|CLOSE|ADD)|STANDARD_REGISTER|STATE_CARD_(CERTIFY|REVOKE)|THREAD_(ADD|APPEND|CLOSE)|SESSION_(START|UPDATE|RESUME)|LOG_ASSET|STORE_AND_LOG_REF|STORE_REF_IMAGE|DELIVER_PENDING_ASSETS|ARCADS_(GENERATE|UPLOAD|TO_R2|VIDEO_GENERATE)|GROK_IMAGE|GROK_VIDEO_START|GROK_TTS|OPENAI_IMAGE|WAI_T2I|GEN_DUAL|AUDIO|GEMINI_GENERATE|CODE_LEASE_START|CODE_LEASE_COMMIT|WRITE_ARTICLE|WIRE_UP_AND_INVOKE|DURABLE_WORKER|SIBLING_WORKFLOW_DELIVER_TRIGGER|SIBLING_DO_CHAT|PROACTIVE_POKE|PROPOSE_ROWS|DEDUP_INSERT|MCP_(IMPORT|ATTACH|TOOL_CALL|EVAL)|SKILL_IMPORT|AGENT_(IMPORT|LEARN|BRIDGE)|REPO_ABSORB|OBSIDIAN_PULL|META_SYNC_BACKFILL|SHEETS_SYNC|OUTSTANDING_SYNC_EMAIL|TENANT_(DAILY_EMAIL|REPORT_EMAIL|POST|ANSWER))/;

export function outwardSideEffect(key) {
  return OUTWARD.test(String(key || ''));
}

export const CREDENTIAL_ENV_BY_HOST = Object.freeze({
  'api.x.ai': 'XAI_API_KEY',
  'api.openai.com': 'OPENAI_API_KEY',
  'api.anthropic.com': 'ANTHROPIC_API_KEY',
  'api.moonshot.ai': 'MOONSHOT_API_KEY',
  'generativelanguage.googleapis.com': 'GEMINI_API_KEY',
  'api.cloudflare.com': 'CF_API_TOKEN',
  'api.blooio.com': 'BLOOIO_API_KEY',
  'gateway.ai.cloudflare.com': 'AIG_TOKEN',
  'miscsubjects.com': 'TERMINAL_KEY',
});

const GATEWAY_PROVIDERS = Object.freeze({
  grok: { url: 'https://api.x.ai/v1/chat/completions', env: 'XAI_API_KEY' },
  openai: { url: 'https://api.openai.com/v1/chat/completions', env: 'OPENAI_API_KEY' },
  anthropic: { url: 'https://api.anthropic.com/v1/messages', env: 'ANTHROPIC_API_KEY' },
  moonshot: { url: 'https://api.moonshot.ai/v1/chat/completions', env: 'MOONSHOT_API_KEY' },
});

function unwrapGateway(req) {
  let host = '';
  try { host = new URL(String(req.url)).hostname; } catch { return null; }
  if (host !== 'gateway.ai.cloudflare.com') return null;
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { return null; } }
  const model = String(body?.model || '');
  const m = model.match(/^([a-z0-9-]+)\/(.+)$/);
  const prov = m ? GATEWAY_PROVIDERS[m[1]] : null;
  if (!prov) return null;
  return { url: prov.url, env: prov.env, body: { ...body, model: m[2] }, as_sent: String(req.url) };
}

export function credentialEnvFor(url, row) {
  let host = '';
  try { host = new URL(String(url)).hostname; } catch { host = ''; }
  if (CREDENTIAL_ENV_BY_HOST[host]) return CREDENTIAL_ENV_BY_HOST[host];
  if (/miscsubjects\.com$/.test(host)) return 'TERMINAL_KEY';
  // An http row names the secret it uses in its own auth column (e.g. "Bearer:$STRIPE_KEY").
  const fromAuth = String(row?.auth || '').match(/\$([A-Z][A-Z0-9_]+)/);
  if (fromAuth) return fromAuth[1];
  const fromTarget = String(row?.target || '').match(/\$([A-Z][A-Z0-9_]+)/);
  if (fromTarget && !/^(PREV)$/.test(fromTarget[1])) return fromTarget[1];
  return null;
}

export function buildInvocation(row, { origin = 'https://miscsubjects.com', args = null } = {}) {
  const spec = deriveInvoke(row);
  const body = args != null ? String(args) : defaultArgs(row, spec);
  return {
    method: 'POST',
    url: origin + '/api/dispatch',
    headers: { 'Content-Type': 'application/json', 'x-terminal-key': 'INJECTED_BY_WORKER' },
    body: { key: String(row.key), body },
  };
}

// What a row needs to be called with — read-side help, kept apart from the payload itself.
export function describeInvocation(row) {
  const spec = deriveInvoke(row);
  return {
    args: spec.args.map((a) => ({ pos: a.pos, name: a.name, desc: a.desc || '', variadic: !!a.variadic })),
    ops: spec.ops ? spec.ops.map((o) => o.op) : undefined,
    tag: spec.tag,
    returns: spec.returns || null,
  };
}

// The REAL invocation: the outbound request the row actually made when it ran (recorded by
// dispatch with the credential redacted), with the credential written back as its vault variable.
// For an agent that is the provider call — URL, model, messages. For an http row it is the target
// request with the args substituted. Falls back to the wrapper when the run produced no request.
export function realInvocation(row, requestJson, { origin = 'https://miscsubjects.com', args = null } = {}) {
  let req = null;
  try { req = typeof requestJson === 'string' ? JSON.parse(requestJson) : requestJson; } catch { req = null; }
  if (!req || typeof req !== 'object' || !req.url) return buildInvocation(row, { origin, args });
  const direct = unwrapGateway(req);
  if (direct) req = { ...req, url: direct.url, body: direct.body };
  const headers = {};
  for (const [k, v] of Object.entries(req.headers || {})) {
    if (String(v) === '<REDACTED>' || /REDACTED|INJECTED_BY_WORKER|\$[A-Z][A-Z0-9_]+/.test(String(v))) {
      headers[k] = k.toLowerCase() === 'authorization' ? 'Bearer INJECTED_BY_WORKER' : 'INJECTED_BY_WORKER';
    } else headers[k] = v;
  }
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch {} }
  const out = { method: String(req.method || 'POST').toUpperCase(), url: String(req.url), headers };
  if (body != null) out.body = body;
  return out;
}

// Placeholder args for shaping a call without sending it: <name> per declared positional arg.
export function placeholderArgs(row) {
  const spec = deriveInvoke(row);
  if (String(row.type) === 'agent') return '<your message>';
  // A row with named operations is shaped with its FIRST real op, so the column shows that
  // provider's request rather than an unknown-op error.
  if (spec.ops && spec.ops.length) {
    const first = spec.ops[0];
    const extra = Array.from({ length: Math.max(0, Number(first.extraArgs || 0)) }, (_, i) => '<arg' + (i + 1) + '>');
    return [first.op, ...extra].join('|');
  }
  return spec.args.map((a) => '<' + (/^[A-Za-z_][\w-]*$/.test(String(a.name || '')) ? a.name : 'arg' + a.pos) + '>').join('|');
}

// Args to test with, in this order: an entry of the row's `examples` column, the EXAMPLE in the
// row's doc lines, a one-line prompt for an agent, or nothing when the row takes no args.
export function defaultArgs(row, spec) {
  const s = spec || deriveInvoke(row);
  if (String(row.type) === 'agent') return 'Reply with exactly the two letters OK and nothing else.';
  const fromExamples = exampleArgs(row);
  if (fromExamples != null) return fromExamples;
  // Only an example the row's author WROTE counts (an `# EXAMPLE:` doc line); the signature
  // deriveInvoke synthesises from arg names is a shape, not a value, and would test nothing.
  if (s.example && /^\s*#\s*EXAMPLE\b/im.test(String(row.content || ''))) {
    const m = String(s.example).match(/^\[[A-Z0-9_]+\]([\s\S]*)\[\/[A-Z0-9_]+\]$/);
    if (m && !/^<|\$\d/.test(m[1])) return m[1];
  }
  return '';
}

function exampleArgs(row) {
  if (!row?.examples) return null;
  let ex;
  try { ex = typeof row.examples === 'string' ? JSON.parse(row.examples) : row.examples; } catch { return null; }
  const first = Array.isArray(ex) ? ex[0] : ex;
  if (first == null) return null;
  if (typeof first === 'string') return first;
  if (typeof first === 'object' && first.args != null) return String(first.args);
  if (typeof first === 'object' && first.body != null) return typeof first.body === 'string' ? first.body : JSON.stringify(first.body);
  return null;
}

// Can the batch run this row and read the result as a verdict about the TOOL (not about the args)?
export function testPlan(row) {
  const key = String(row.key);
  if (Number(row.enabled ?? 1) === 0) return { runnable: false, reason: 'disabled row' };
  if (outwardSideEffect(key)) return { runnable: false, reason: 'outward side effect (sends, posts, pays, spawns or deletes) — run it yourself with =INVOKE when you mean to' };
  const spec = deriveInvoke(row);
  const args = defaultArgs(row, spec);
  if (String(row.type) !== 'agent' && spec.args.length && !args) {
    return { runnable: false, reason: 'needs args and the row declares no example: ' + spec.args.map((a) => '$' + a.pos + ' ' + a.name).join(', ') + ' — add one to `examples` or test with {"args":"…"}' };
  }
  return { runnable: true, args };
}

// A result is a failure when it is an ERR:/ERROR: string, a JSON with an error field, or empty.
export function verdict(result, threw) {
  const text = result == null ? '' : (typeof result === 'string' ? result : JSON.stringify(result));
  if (threw) return { ok: false, why: 'threw: ' + threw };
  if (!text.trim()) return { ok: false, why: 'empty result' };
  if (/^\s*(ERR|ERROR|#ERR|#NAME|BREAKER|PROVIDER_ERROR)[:?\s]/i.test(text)) return { ok: false, why: text.slice(0, 300) };
  // An agent that answered with its provider's failure text did not work, whatever the transport said.
  if (/\bPROVIDER_ERROR\b|Incorrect API key|invalid_api_key|insufficient_quota|model returned nothing/i.test(text.slice(0, 400))) return { ok: false, why: text.slice(0, 300) };
  if (/^\s*\{/.test(text)) {
    try { const j = JSON.parse(text); if (j && typeof j === 'object' && (j.error || j.ok === false)) return { ok: false, why: String(j.error || j.note || 'ok:false').slice(0, 300) }; } catch {}
  }
  if (/^SHAPED:not_sent/.test(text)) return { ok: false, why: 'shaped only, not sent' };
  return { ok: true, why: '' };
}

export function transportRecord({ ok, ms, trace, why, http = 200, at, actor }) {
  return {
    http, ok: !!ok, ms: Number(ms || 0), trace_id: trace || null,
    ledger: trace ? '/admin/ledger?trace_id=' + encodeURIComponent(trace) : null,
    error: ok ? null : (why || null), at: at || new Date().toISOString(), actor: actor || 'directory-test',
  };
}

// Persist one test outcome on the row. state is one of STATE.*; when the row was not run, the
// transport record carries the reason and the invocation is still written, so every row shows
// how to call it even before anyone has.
export async function recordTest(env, key, { invocation, transport, response, state, at }) {
  const ts = at || new Date().toISOString();
  const payload = response == null ? null : (typeof response === 'string' ? response : JSON.stringify(response));
  await env.DB.prepare('UPDATE directory SET invocation = ?, last_status = ?, last_response = ?, test_state = ?, tested_at = ? WHERE key = ?')
    .bind(JSON.stringify(invocation), transport ? JSON.stringify(transport) : null, payload == null ? null : payload.slice(0, MAX_RESPONSE_CHARS), state, ts, key).run();
  return { key, test_state: state, tested_at: ts };
}
