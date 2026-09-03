// GET  /api/rules           — list append-only owner rules (public read for models)
// GET  /api/rules/verify    — recompute hash chain
// POST /api/rules           — append one rule (x-terminal-key required)
//
// No PUT, PATCH, or DELETE. Models cannot overwrite owner rules.

import { logEvent } from '../../_lib/event_log.js';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type,x-terminal-key',
  'cache-control': 'no-store'
};

const KINDS = new Set(['rule', 'preference', 'thought', 'ban', 'boolean', 'identity', 'goal']);

function json(o, status = 200) {
  return new Response(JSON.stringify(o, null, 2), {
    status,
    headers: { 'content-type': 'application/json', ...CORS }
  });
}

function authed(request, env) {
  const got = (request.headers.get('x-terminal-key') || '').toLowerCase();
  const want = String(env.TERMINAL_KEY || '').toLowerCase();
  return !!want && got === want;
}

async function sha256(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}

function rowBody(r) {
  return [r.prev_hash, r.seq, r.ts, r.kind, r.content, r.added_by].join('|');
}

async function verifyChain(rows) {
  let prev = 'genesis';
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r.prev_hash !== prev) return { valid: false, broken_at: i, reason: 'prev_hash mismatch' };
    const h = await sha256(rowBody(r));
    if (h !== r.hash) return { valid: false, broken_at: i, reason: 'hash mismatch' };
    prev = r.hash;
  }
  return { valid: true, entries: rows.length, head: rows.length ? rows[rows.length - 1].hash : 'genesis' };
}

async function listRules(env, kind) {
  if (!env.DB) return { rules: [], error: 'DB binding missing' };
  let sql = 'SELECT id, seq, ts, kind, content, added_by, prev_hash, hash FROM owner_rules';
  const binds = [];
  if (kind) { sql += ' WHERE kind = ?'; binds.push(kind); }
  sql += ' ORDER BY seq ASC';
  try {
    const r = await env.DB.prepare(sql).bind(...binds).all();
    return { rules: r.results || [] };
  } catch (e) {
    return { rules: [], error: String(e && e.message || e) };
  }
}

async function appendRule(env, { kind, content, added_by }) {
  if (!env.DB) return { ok: false, error: 'DB binding missing' };
  const k = String(kind || 'preference').toLowerCase();
  const text = String(content || '').trim();
  if (!KINDS.has(k)) return { ok: false, error: 'invalid kind' };
  if (!text) return { ok: false, error: 'content required' };
  if (text.length > 12000) return { ok: false, error: 'content too long (max 12000)' };

  const head = await env.DB.prepare('SELECT seq, hash FROM owner_rules ORDER BY seq DESC LIMIT 1').first();
  const seq = head ? head.seq + 1 : 1;
  const prev_hash = head ? head.hash : 'genesis';
  const ts = new Date().toISOString();
  const by = String(added_by || 'owner').slice(0, 64);
  const draft = { prev_hash, seq, ts, kind: k, content: text, added_by: by };
  const hash = await sha256(rowBody(draft));

  await env.DB.prepare(
    'INSERT INTO owner_rules (seq, ts, kind, content, added_by, prev_hash, hash) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(seq, ts, k, text, by, prev_hash, hash).run();

  return { ok: true, seq, kind: k, hash, prev_hash };
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const url = new URL(request.url);
  // [[path]] catch-all: context.params.path is an array of segments (e.g. ['verify']),
  // undefined at the base. Normalize both shapes before reading the subpath.
  const rawPath = context.params.path;
  const parts = (Array.isArray(rawPath) ? rawPath : String(rawPath || '').split('/')).filter(Boolean);
  const sub = parts[0] || '';

  if (request.method === 'GET') {
    if (sub === 'verify') {
      const { rules, error } = await listRules(env);
      if (error) return json({ ok: false, error }, 500);
      const chain = await verifyChain(rules);
      return json({ ok: chain.valid, chain, count: rules.length });
    }
    const kind = url.searchParams.get('kind') || '';
    const { rules, error } = await listRules(env, kind || null);
    if (error) return json({ ok: false, error }, 500);
    return json({
      ok: true,
      count: rules.length,
      rules,
      contract: {
        append: 'POST /api/rules {kind, content, added_by?} — x-terminal-key required',
        kinds: [...KINDS],
        immutable: 'no update or delete endpoints; append only'
      }
    });
  }

  if (request.method === 'POST' && !sub) {
    if (!authed(request, env)) return json({ ok: false, error: 'x-terminal-key required' }, 401);
    let body = {};
    try { body = await request.json(); } catch {}
    const result = await appendRule(env, body);
    if (!result.ok) return json(result, 400);
    try {
      await logEvent(env, {
        source: 'owner_rules',
        key: 'RULES_APPEND',
        action: 'append',
        actor: body.added_by || 'owner',
        request_preview: JSON.stringify({ kind: result.kind, seq: result.seq }),
        response_preview: result.hash,
        status: 200
      });
    } catch {}
    return json(result);
  }

  return json({ ok: false, error: 'not found' }, 404);
}