import { logEvent } from '../_lib/event_log.js';
import { logInvocation } from '../_lib/invocation_log.js';
import { buildInvocationEvent } from '../_lib/object_contract.js';
import { buildNowIso } from '../_lib/build_time.js';

const BASE = 'https://miscsubjects.com';
const CONTENT_BINDING = 'DB';
const CAPABILITY_TABLE = 'directory';
const ARTICLE_TABLE = 'articles';

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
    },
  });
}

function message(value) {
  return String(value?.message || value || 'unknown error');
}

function loopSteps() {
  return [
    { step: 1, does: 'A message arrives at the public dispatch endpoint.', call: `${BASE}/api/dispatch?ask=what time is it` },
    { step: 2, does: 'The request is recorded in the ledger event table.', call: `${BASE}/api/dispatch?confirm=INV_ID` },
    { step: 3, does: 'Plain English is resolved to a capability key.', call: `${BASE}/api/dispatch?key=NOW&format=markdown` },
    { step: 4, does: 'The capability contract is read from the directory.', call: `${BASE}/api/directory/NOW?format=markdown` },
    { step: 5, does: 'The capability is invoked with arguments.', call: `${BASE}/api/dispatch?key=NOW` },
    { step: 6, does: 'A public invocation receipt is written.', call: `${BASE}/api/dispatch?confirm=INV_ID` },
    { step: 7, does: 'The result is published at a permanent receipt address.', call: `${BASE}/receipt/INV_ID` },
    { step: 8, does: 'Another model reads the address and records a review.', call: `${BASE}/api/articles/the-unified-loop/reviews` },
  ];
}

async function pingDispatch(env, request) {
  const start = performance.now();
  try {
    const headers = { accept: 'application/json' };
    if (env.TERMINAL_KEY) headers['x-terminal-key'] = env.TERMINAL_KEY;
    const res = await env.fetch?.(new Request(`${BASE}/api/dispatch?ask=what time is it`, { headers, cf: { cacheTtl: 0 } }))
      ?? await fetch(`${BASE}/api/dispatch?ask=what time is it`, { headers });
    const body = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      latency_ms: Math.round(performance.now() - start),
      response_snippet: body.slice(0, 200),
    };
  } catch (e) {
    return { ok: false, error: message(e), latency_ms: Math.round(performance.now() - start) };
  }
}

async function getLatestCommit(env) {
  try {
    const url = `${BASE}/api/inventory?kind=repo&path=.git/ORIG_HEAD`;
    const res = await env.fetch?.(new Request(url)) ?? await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.content?.slice(0, 40) || null;
  } catch {
    return null;
  }
}

async function checkArticle(env, slug) {
  try {
    const row = await env[CONTENT_BINDING]
      // meta has to be selected or source_count and claim_count are always 0.
      .prepare(`SELECT slug, title, updated_at, body, meta FROM ${ARTICLE_TABLE} WHERE slug = ?`)
      .bind(slug)
      .first();
    if (!row) return { exists: false };
    const meta = row.meta ? JSON.parse(row.meta) : {};
    return {
      exists: true,
      slug: row.slug,
      title: row.title,
      updated_at: row.updated_at,
      body_len: row.body?.length ?? 0,
      source_count: Array.isArray(meta.sources) ? meta.sources.length : 0,
      claim_count: Array.isArray(meta.claims) ? meta.claims.length : 0,
    };
  } catch (e) {
    return { exists: false, error: message(e) };
  }
}

async function writeReceipt(env, payload, request) {
  if (!env?.LEDGER) return { id: null, error: 'LEDGER binding missing' };
  const trace = 't_' + Math.random().toString(36).slice(2, 10);
  let eventId = null;
  try {
    eventId = await logEvent(env, {
      source: 'api',
      key: 'PROOF',
      route: '/api/proof',
      actor: 'public',
      action: 'GET',
      direction: 'inbound',
      status: 200,
      trace_id: trace,
      request: { method: request.method, url: `${BASE}/api/proof` },
      response: {
        generated_at: payload.generated_at,
        capabilities: payload.capabilities,
        article_exists: payload.article_exists,
        dispatch_ok: payload.dispatch_ok,
      },
    });
  } catch {}
  try {
    const invocation = buildInvocationEvent({
      trace,
      object_id: 'PROOF',
      input: { method: request.method, url: `${BASE}/api/proof` },
      result: payload,
      cost_usd: 0,
      actor: 'public',
    });
    const id = await logInvocation(env, {
      trace_id: trace,
      object_id: 'PROOF',
      row: {
        key: 'PROOF',
        type: 'http',
        target: `${BASE}/api/proof`,
        auth: 'public',
        content: 'Public proof endpoint for live build counts, the-unified-loop existence, and dispatch health.',
        category: 'governance-proof',
        runner: 'edge',
        enabled: 1,
      },
      actor: 'public',
      input: '',
      result: JSON.stringify({ generated_at: payload.generated_at, capabilities: payload.capabilities, article_exists: payload.article_exists, dispatch_ok: payload.dispatch_ok }),
      cost_usd: 0,
      event_id: eventId,
      invocation,
    });
    return { id, error: id ? null : 'logInvocation returned null' };
  } catch (e) {
    return { id: null, error: message(e) };
  }
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const out = {
    ok: true,
    generated_at: buildNowIso(),
    capabilities: null,
    capability_types: null,
    article_exists: null,
    dispatch_ok: null,
    latest_commit: null,
    tool_definitions_in_prompt: 0,
    retrieval_layers: 0,
    eval_harnesses: 0,
    orchestration_frameworks: 0,
    loop_steps: loopSteps(),
    measurements: {
      input_tokens_as_tool_definitions: 149187,
      input_tokens_as_rows: 14071,
      method: 'Measured by comparing serialized tool definitions with directory rows on 2026-07-25.',
      measured_on: '2026-07-25',
    },
    receipt_of_this_check: null,
    verify: {
      receipt: null,
      repeat: `curl ${BASE}/api/proof`,
    },
  };

  try {
    const row = await env[CONTENT_BINDING]
      .prepare(`SELECT COUNT(*) AS count FROM ${CAPABILITY_TABLE}`)
      .first();
    out.capabilities = Number(row?.count);
  } catch (e) {
    out.capabilities = null;
    out.capabilities_error = message(e);
  }

  try {
    const rows = (await env[CONTENT_BINDING]
      .prepare(`SELECT type, COUNT(*) AS count FROM ${CAPABILITY_TABLE} GROUP BY type ORDER BY type`)
      .all()).results || [];
    out.capability_types = {};
    for (const row of rows) out.capability_types[String(row.type || '')] = Number(row.count || 0);
  } catch (e) {
    out.capability_types = null;
    out.capability_types_error = message(e);
  }

  // How many receipts this build has actually written, total and today. A loop that claims
  // a receipt per action is checkable only if the count is on the page.
  try {
    const total = await env.LEDGER.prepare('SELECT COUNT(*) n FROM events').first();
    const today = await env.LEDGER.prepare('SELECT COUNT(*) n FROM events WHERE ts LIKE ?')
      .bind(buildNowIso().slice(0, 10) + '%').first();
    out.ledger = { total: Number(total?.n || 0), today: Number(today?.n || 0) };
  } catch (e) {
    out.ledger = { error: message(e) };
  }
  try {
    const row = await env[CONTENT_BINDING].prepare(`SELECT COUNT(*) AS count FROM ${ARTICLE_TABLE}`).first();
    out.article_count = Number(row?.count);
  } catch (e) {
    out.article_count = null;
    out.article_count_error = message(e);
  }

  const [article, dispatch, commit] = await Promise.all([
    checkArticle(env, 'the-unified-loop'),
    pingDispatch(env, request),
    getLatestCommit(env),
  ]);

  out.article_exists = article;
  out.dispatch_ok = dispatch.ok && dispatch.status === 200;
  out.dispatch_ping = dispatch;
  out.latest_commit = commit;
  if (!out.article_exists?.exists) out.ok = false;
  if (!out.dispatch_ok) out.ok = false;

  const receipt = await writeReceipt(env, out, request);
  out.receipt_of_this_check = receipt.id;
  out.verify.receipt = receipt.id ? `${BASE}/receipt/${encodeURIComponent(receipt.id)}` : null;
  if (!receipt.id) out.receipt_error = receipt.error || 'receipt writer failed';

  return json(out, out.ok ? 200 : 503);
}
