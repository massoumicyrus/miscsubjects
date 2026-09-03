// POST /api/articles/<slug>/webhook — atomic append (widget, source, claim, provenance, contribution, review).
// Dedicated route so Cloudflare Pages matches /webhook before the catch-all upsert path.

import { logEvent } from '../../../_lib/event_log.js';
import { publicSecretFindingAndRevoke, publicSecret404 } from '../../../_lib/public_secret_guard.js';

function json(o, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
}

function authed(request, env) {
  return !!env.TERMINAL_KEY && (request.headers.get('x-terminal-key') || '') === env.TERMINAL_KEY;
}

function parseMeta(m) { try { return JSON.parse(m || '{}') || {}; } catch { return {}; } }
function nowIso() { return new Date().toISOString(); }

async function sha256(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s)));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
function sourceBody(e) {
  return [e.prev, e.accessed_at, e.type, e.url, e.title, e.quote, e.summary, (e.claim_ids || []).join(',')].join('|');
}
function contributionBody(e) {
  return [e.prev_hash, e.seq, e.ts, e.model, e.role, e.action, JSON.stringify(e.payload), e.rationale].join('|');
}
function provenanceBody(e) {
  return [e.prev, e.ts, e.model, e.action, e.prompt, e.input, e.response, e.tokens_in, e.tokens_out].join('|');
}

export async function onRequestPost(context) {
  const { request, env, params } = context;
  if (!authed(request, env)) return json({ error: 'unauthorized' }, 401);

  const slug = String(params.slug || '').trim();
  if (!slug) return json({ error: 'slug required' }, 400);

  const a = await env.DB.prepare('SELECT slug, meta FROM articles WHERE slug=?').bind(slug).first();
  if (!a) return json({ error: 'not found' }, 404);

  const b = await request.json().catch(() => ({}));
  if (await publicSecretFindingAndRevoke(b?.data, env, { route: '/api/articles/' + slug + '/webhook', actor: 'article-webhook' })) return publicSecret404();
  const kind = String(b.kind || '').toLowerCase();
  const data = b.data;
  if (!kind || data == null) return json({ error: 'kind and data required' }, 400);

  const valid = ['source', 'widget', 'claim', 'provenance', 'contribution', 'review'];
  if (!valid.includes(kind)) return json({ error: 'kind must be one of: ' + valid.join(', ') }, 400);

  const keyMap = { source: 'sources', widget: 'widgets', claim: 'claims', provenance: 'provenance', contribution: 'contributions', review: 'reviews' };
  const metaKey = keyMap[kind];
  const prevMeta = parseMeta(a.meta);
  const arr = Array.isArray(prevMeta[metaKey]) ? prevMeta[metaKey] : [];
  const item = { ...data, _id: data._id || ('w_' + Math.random().toString(36).slice(2, 10)), _ts: data._ts || nowIso() };
  if (kind === 'source') {
    item.id = String(item.id || item._id);
    item.type = String(item.type || 'source');
    item.accessed_at = String(item.accessed_at || item._ts);
    item.claim_ids = Array.isArray(item.claim_ids) ? item.claim_ids.map(String) : [];
    item.prev = arr.length ? arr[arr.length - 1].hash : 'genesis';
    item.hash = await sha256(sourceBody(item));
  }
  if (kind === 'contribution') {
    item.seq = Number(item.seq || arr.length + 1);
    item.ts = String(item.ts || item._ts);
    item.model = String(item.model || item.actor || 'unknown');
    item.role = String(item.role || kind);
    item.action = String(item.action || 'append');
    item.payload = item.payload == null ? data : item.payload;
    item.rationale = String(item.rationale || '');
    item.prev_hash = arr.length ? arr[arr.length - 1].hash : 'genesis';
    item.hash = await sha256(contributionBody(item));
  }
  if (kind === 'provenance') {
    item.ts = String(item.ts || item._ts);
    item.model = String(item.model || item.actor || 'unknown');
    item.action = String(item.action || 'append');
    item.prompt = String(item.prompt || '').slice(0, 4000);
    item.input = String(item.input || '').slice(0, 4000);
    item.response = String(item.response || '').slice(0, 4000);
    item.tokens_in = Number(item.tokens_in || 0);
    item.tokens_out = Number(item.tokens_out || 0);
    item.cost = Number(item.cost || 0);
    item.prev = arr.length ? arr[arr.length - 1].hash : 'genesis';
    item.hash = await sha256(provenanceBody(item));
  }
  if (kind === 'claim') {
    if (!item.posted_by) {
      item.posted_by = {
        actor: String(data.who_claims || data.model || data.agent || 'webhook'),
        channel: String(data.channel || 'webhook'),
        ts: item._ts,
      };
    }
    if (!item.who_claims) item.who_claims = item.posted_by.actor;
    if (!item.id) {
      let maxN = 0;
      arr.forEach((c) => {
        const m = /^c(\d+)$/.exec(String(c.id || ''));
        if (m) maxN = Math.max(maxN, +m[1]);
      });
      item.id = 'c' + (maxN + 1);
    }
    if (!item.tier) item.tier = 'speculative';
    if (!item.source_status) item.source_status = (item.source_ids || []).length ? 'sourced' : 'unsourced';
  }
  arr.push(item);
  prevMeta[metaKey] = arr;
  const metaJson = Object.keys(prevMeta).length ? JSON.stringify(prevMeta) : null;
  await env.DB.prepare('UPDATE articles SET meta=?, updated_at=? WHERE slug=?').bind(metaJson, nowIso(), slug).run();

  const eventId = await logEvent(env, {
    source: 'article-webhook',
    key: kind.toUpperCase(),
    action: 'append',
    actor: data.model || data.agent || 'webhook',
    direction: 'in',
    status: 200,
    trace_id: b.trace_id || null,
    request: { slug, kind, item },
    response: { ok: true, index: arr.length - 1 }
  }).catch(() => null);

  return json({ ok: true, slug, kind, index: arr.length - 1, item_id: item._id, event_id: eventId, immutable_append: true });
}
