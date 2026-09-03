// GET /api/ledger — every inbound/outbound payload, chronological, zero redaction.
// A CARD is one unified turn/loop: click any trace_id to inspect the full connected series.
//
//   /api/ledger                         -> chronological raw events (ledger)
//   /api/ledger?card=t_xxxx             -> inspect one card/turn
//   /api/ledger?view=cards              -> grouped card list
//   /api/ledger?format=json             -> JSON API for either view
//   /api/ledger/widgets                 -> legacy sideways widget rails
//
// Filters (events view): ?source ?actor ?key ?category ?q ?limit

import { vaultStyles, renderVaultCard, normalizeWidget, renderRail } from '../../_lib/vault_widgets.js';
import { classify, TAXONOMY, CAT_COLOR, GROUP_COLOR } from '../../_lib/ledger_taxonomy.js';
import { isBuildAuthed } from '../../_lib/admin_session.js';

const BASE = 'https://miscsubjects.com';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function parse(v) { try { return JSON.parse(v || '{}') || {}; } catch { return {}; } }

async function dirTypeMap(env) {
  const m = {};
  try {
    const r = await env.DB.prepare('SELECT key, type FROM directory').all();
    for (const row of (r.results || [])) m[row.key] = row.type;
  } catch {}
  return m;
}

// ── fetchers ─────────────────────────────────────────────────────────────────
async function fetchEvents(env, url) {
  if (!env.LEDGER) return { rows: [], error: 'LEDGER binding missing' };
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10) || 100, 1000);
  const where = [];
  const binds = [];
  const source = url.searchParams.get('source');
  const actor = url.searchParams.get('actor');
  const key = url.searchParams.get('key');
  const q = url.searchParams.get('q');
  if (source) { where.push('source = ?'); binds.push(source); }
  if (actor) { where.push('actor = ?'); binds.push(actor); }
  if (key) { where.push('key = ?'); binds.push(key); }
  if (q) { where.push('(key LIKE ? OR action LIKE ? OR request_preview LIKE ? OR response_preview LIKE ?)'); binds.push('%' + q + '%', '%' + q + '%', '%' + q + '%', '%' + q + '%'); }
  const sql = 'SELECT id, ts, build, source, key, route, actor, action, direction, status, trace_id, step, parent, request_preview, response_preview, request_size, response_size FROM events ' +
    (where.length ? 'WHERE ' + where.join(' AND ') + ' ' : '') + 'ORDER BY ts DESC LIMIT ?';
  binds.push(limit);
  try {
    const r = await env.LEDGER.prepare(sql).bind(...binds).all();
    return { rows: r.results || [] };
  } catch (e) { return { rows: [], error: String(e && e.message || e) }; }
}

async function fetchCards(request, url) {
  const target = new URL('/admin/ledger', url.origin);
  target.searchParams.set('cards', '1');
  const source = url.searchParams.get('source');
  const actor = url.searchParams.get('actor');
  const category = url.searchParams.get('category');
  const q = url.searchParams.get('q');
  const cardId = url.searchParams.get('card');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10) || 100, 500);
  if (source) target.searchParams.set('source', source);
  if (actor) target.searchParams.set('actor', actor);
  if (category) target.searchParams.set('category', category);
  if (q) target.searchParams.set('q', q);
  if (cardId) target.searchParams.set('card_id', cardId);
  target.searchParams.set('limit', String(limit));
  try {
    const r = await fetch(target.toString(), { headers: { 'x-terminal-key': request.headers.get('x-terminal-key') || '' } });
    const j = await r.json();
    return { cards: j.cards || [], error: j.error };
  } catch (e) { return { cards: [], error: String(e && e.message || e) }; }
}

async function fetchClaims(env, limit = 50) {
  if (!env.DB) return { rows: [], error: 'DB binding missing' };
  try {
    const rows = await env.DB.prepare('SELECT slug, title, meta FROM articles ORDER BY updated_at DESC LIMIT ?').bind(limit).all();
    return { rows: rows.results || [] };
  } catch (e) { return { rows: [], error: String(e && e.message || e) }; }
}

function claimWidgets(rows) {
  const out = [];
  for (const r of (rows || [])) {
    const m = parse(r.meta);
    for (const c of (Array.isArray(m.claims) ? m.claims : [])) {
      const srcCount = (c.source_ids || []).length;
      out.push(normalizeWidget('claim', {
        id: r.slug + ':' + c.id,
        title: (c.tier || 'claim') + ' · ' + r.title,
        body: c.text,
        ts: null,
        status: srcCount ? 'sourced' : (c.source_status || 'unsourced'),
        href: `${BASE}/a/${r.slug}#claim-${c.id || ''}`,
        api: `${BASE}/api/claims?slug=${encodeURIComponent(r.slug)}`
      }));
    }
  }
  return out;
}

// ── HTML parts ───────────────────────────────────────────────────────────────
function commonHead() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ledger — miscsubjects.com</title>
<style>
:root{--bg:#f6f7f9;--ink:#111;--ink-soft:#445;--muted:#667;--line:#dde1e6;--line-strong:#c8cdd3;--accent:#0a52d0;--accent-soft:#e8f0fe;--sans:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;--mono:ui-monospace,SFMono-Regular,Menlo,Monaco,monospace}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 var(--sans);padding:24px}
${vaultStyles()}
.toolbar{display:flex;gap:10px;flex-wrap:wrap;align-items:end;margin-bottom:18px;padding:14px;border:1px solid var(--line);border-radius:8px;background:#fff}
.toolbar label{font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;display:flex;flex-direction:column;gap:4px}
.toolbar input,.toolbar select{font:13px var(--sans);padding:7px 10px;border:1px solid var(--line-strong);border-radius:6px;color:var(--ink);min-width:120px}
.toolbar button{font:13px var(--sans);padding:8px 16px;border:1px solid var(--line-strong);border-radius:6px;background:#fff;color:var(--ink);font-weight:700;cursor:pointer}
.toolbar button:hover{border-color:var(--accent);background:var(--accent-soft)}
.toolbar .primary{background:var(--accent);color:#fff;border-color:var(--accent)}
.toolbar .primary:hover{background:#0946b0}
.viewtabs{display:flex;gap:8px;margin-bottom:18px}
.viewtabs a{padding:8px 18px;border:1px solid var(--line-strong);border-radius:99px;background:#fff;font-weight:700;text-decoration:none;color:var(--ink)}
.viewtabs a.on{background:var(--accent);color:#fff;border-color:var(--accent)}
.count{font:12px var(--mono);color:var(--muted);margin-bottom:8px}
.empty{padding:40px;text-align:center;color:var(--muted)}
.ledger-table{width:100%;border-collapse:collapse;font-size:13px;background:#fff;border:1px solid var(--line);border-radius:8px;overflow:hidden}
.ledger-table th{background:#f4f5f7;border-bottom:1px solid var(--line);padding:10px 12px;text-align:left;font-weight:700}
.ledger-table td{border-bottom:1px solid var(--line);padding:10px 12px;vertical-align:top}
.ledger-table tr:hover td{background:var(--accent-soft)}
.ledger-table .ts{font:11px var(--mono);color:var(--muted);white-space:nowrap}
.ledger-table .src{font:10px var(--sans);font-weight:800;text-transform:uppercase;letter-spacing:.05em;background:#f0f0f0;padding:2px 7px;border-radius:99px}
.ledger-table .key{font:12px var(--mono);font-weight:700}
.ledger-table .trace{font:11px var(--mono);color:var(--accent);text-decoration:none}
.ledger-table .trace:hover{text-decoration:underline}
.ledger-table .preview{font:12px var(--mono);background:#f8f9fa;border:1px solid var(--line);border-radius:6px;padding:8px;max-height:120px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;margin:4px 0 0}
.ledger-table .dir{font:10px var(--mono);color:var(--muted)}
.status-dot{display:inline-block;width:8px;height:8px;border-radius:50%}
.status-dot.ok{background:#19a463}
.status-dot.fail{background:#d93025}
.status-dot.warn{background:#f9ab00}
.status-dot.neutral{background:#999}
.detail{max-width:980px;border:1px solid var(--line);border-radius:12px;background:#fff;padding:0;margin:18px 0;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.08)}
.detail .dhead{padding:14px 18px;border-bottom:1px solid var(--line);background:#fff;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.detail .dbody{padding:18px}
.hero-io{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}
@media(max-width:860px){.hero-io{grid-template-columns:1fr}}
.hero-box{border:1px solid var(--line);border-radius:10px;overflow:hidden}
.hero-box .hbar{padding:10px 14px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;background:#f4f5f7;border-bottom:1px solid var(--line)}
.hero-box.in{border-left:5px solid var(--accent)}
.hero-box.in .hbar{color:var(--accent)}
.hero-box.out{border-left:5px solid #19a463}
.hero-box.out .hbar{color:#19a463}
.hero-box .hmsg{padding:12px 14px;font-size:15px;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere;max-height:260px;overflow:auto}
.curl-block{border:1px solid var(--line);border-radius:8px;overflow:hidden;background:#0f1115;margin:14px 0}
.curl-bar{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#1a1d23;border-bottom:1px solid #2a2e36;color:#888;font:11px var(--sans);font-weight:700;text-transform:uppercase;letter-spacing:.04em}
.curl-block pre{margin:0;padding:12px;font:12px var(--mono);color:#c8d0d8;white-space:pre-wrap;overflow-wrap:anywhere}
.events{margin-top:14px}
.ev{border-top:1px solid var(--line);padding:12px 0}
.ev:first-child{border-top:none;padding-top:0}
.ev .evmeta{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:6px}
.ev .evkey{font:12px var(--mono);font-weight:700;background:#f0f0f0;padding:2px 8px;border-radius:4px}
.ev .evactor{font:11px var(--sans);color:var(--muted);font-weight:700;text-transform:uppercase}
.ev pre{margin:6px 0 0;background:#f8f9fa;border:1px solid var(--line);border-radius:6px;padding:10px;font:12px var(--mono);white-space:pre-wrap;overflow-wrap:anywhere;max-height:220px;overflow:auto}
.back{display:inline-block;margin-bottom:14px;font-weight:700}
</style>
</head>
<body>
<div class="vault-shell">
  <section class="vault-hero">
    <div>
      <h1>Ledger</h1>
      <p>Every inbound &amp; outbound payload, chronological, zero redaction. A card is one unified turn — click any trace ID to inspect the full loop.</p>
    </div>
    <div class="vault-actions">
      <a href="/api/ledger?format=json">JSON</a>
      <a href="/api/ledger/widgets">Widget rails</a>
      <a href="/admin/vault">Vault</a>
    </div>
  </section>
`;
}

function commonFoot() {
  return '</div></body></html>';
}

function filterForm(url, activeView) {
  const source = url.searchParams.get('source') || '';
  const actor = url.searchParams.get('actor') || '';
  const key = url.searchParams.get('key') || '';
  const category = url.searchParams.get('category') || '';
  const q = url.searchParams.get('q') || '';
  const limit = url.searchParams.get('limit') || '100';
  return `
  <div class="viewtabs">
    <a href="/api/ledger" class="${activeView === 'ledger' ? 'on' : ''}">Ledger</a>
    <a href="/api/ledger?view=cards" class="${activeView === 'cards' ? 'on' : ''}">Cards</a>
  </div>

  <form method="GET" class="toolbar">
    ${activeView === 'cards' ? '<input type="hidden" name="view" value="cards">' : ''}
    <label>Source <input name="source" value="${esc(source)}" placeholder="blooio, dispatch"></label>
    <label>Actor <input name="actor" value="${esc(actor)}" placeholder="ROUTER, grok"></label>
    <label>Key <input name="key" value="${esc(key)}" placeholder="ROUTER, GH_ISSUE"></label>
    <label>Category <input name="category" value="${esc(category)}" placeholder="agent, cli"></label>
    <label>Search <input name="q" value="${esc(q)}" placeholder="text in payloads"></label>
    <label>Limit
      <select name="limit">
        ${['40','100','200','500'].map(l => '<option' + (limit === l ? ' selected' : '') + '>' + esc(l) + '</option>').join('')}
      </select>
    </label>
    <button type="submit" class="primary">Filter</button>
  </form>`;
}

function eventRow(row, dmap) {
  const c = classify({ source: row.source, key: row.key, dirType: dmap[row.key] });
  const statusDot = row.status == null ? '<span class="status-dot neutral"></span>' : (row.status >= 200 && row.status < 300 ? '<span class="status-dot ok"></span>' : '<span class="status-dot fail"></span>');
  const req = row.request_preview ? '<pre class="preview">' + esc(row.request_preview) + '</pre>' : '';
  const res = row.response_preview ? '<pre class="preview">' + esc(row.response_preview) + '</pre>' : '';
  return '<tr>' +
    '<td class="ts">' + esc(String(row.ts).slice(0, 19).replace('T', ' ')) + '</td>' +
    '<td><span class="src">' + esc(row.source) + '</span><br><span class="dir">' + esc(row.direction || '') + '</span></td>' +
    '<td><span class="key">' + esc(row.key) + '</span><br><span class="dir">' + esc(c.category) + ' · ' + esc(c.actor) + '</span></td>' +
    '<td>' + statusDot + ' ' + (row.status != null ? esc(row.status) : '') + '</td>' +
    '<td>' + req + res + '</td>' +
    '<td>' + (row.trace_id ? '<a class="trace" href="/api/ledger?card=' + encodeURIComponent(row.trace_id) + '">' + esc(row.trace_id) + '</a>' : '') + '</td>' +
  '</tr>';
}

function cardWidget(c) {
  const color = { agent: '#6a5acd', channel: '#0a52d0', cli: '#b5453b', router: '#d32323', github: '#333', other: '#667' }[c.category] || '#667';
  const title = (c.input || '').slice(0, 90) || c.card_id;
  const body = (c.output || '').slice(0, 180) || (c.events || []).map(x => x.key).join(' → ');
  const w = { kind: 'card', id: c.card_id, title, body, ts: c.ts, status: c.actor, hash: c.hash };
  return renderVaultCard(w).replace('class="vault-card card"', 'class="vault-card card" style="--vc:' + color + '"').replace('<a class="vault-card card"', '<a class="vault-card card" href="/api/ledger?card=' + encodeURIComponent(c.card_id) + '"');
}

function cardDetailHtml(c) {
  const events = (c.events || []).map(ev => {
    return '<div class="ev"><div class="evmeta">' +
      '<span class="evkey">' + esc(ev.key) + '</span>' +
      '<span class="evactor">' + esc(ev.actor || '') + '</span>' +
      '<span style="font:11px var(--mono);color:var(--muted)">' + (ev.status != null ? esc('HTTP ' + ev.status) : '') + '</span>' +
    '</div>' +
    (ev.request ? '<pre>' + esc(ev.request) + '</pre>' : '') +
    (ev.response ? '<pre>' + esc(ev.response) + '</pre>' : '') +
    '</div>';
  }).join('');
  return '<a class="back" href="/api/ledger">← back to ledger</a>' +
    '<div class="detail">' +
    '<div class="dhead"><span class="vc-id">' + esc(c.card_id) + '</span><span class="vc-status">' + esc(c.category) + ' · ' + esc(c.actor) + '</span><span style="margin-left:auto;font:11px var(--mono);color:var(--muted)">' + esc(c.ts) + '</span></div>' +
    '<div class="dbody">' +
      '<div class="hero-io">' +
        '<div class="hero-box in"><div class="hbar">👤 YOU — message in</div><div class="hmsg">' + esc(c.input || '—') + '</div></div>' +
        '<div class="hero-box out"><div class="hbar">🤖 LLM — reply out</div><div class="hmsg">' + esc(c.output || '—') + '</div></div>' +
      '</div>' +
      '<div class="curl-block"><div class="curl-bar">REST / cURL for this card</div><pre>curl -s "' + BASE + '/api/ledger?format=json&card=' + encodeURIComponent(c.card_id) + '" -H "x-terminal-key: $TERMINAL_KEY"</pre></div>' +
      '<div class="events"><div style="font:12px var(--sans);font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:8px">' + (c.events || []).length + ' connected payloads</div>' + events + '</div>' +
    '</div>' +
  '</div>';
}

// ── views ────────────────────────────────────────────────────────────────────
async function ledgerView(request, env, url) {
  const dmap = await dirTypeMap(env);
  const { rows, error } = await fetchEvents(env, url);

  if (url.searchParams.get('format') === 'json') {
    return new Response(JSON.stringify({ rows, error }, null, 2), { headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
  }

  let content = '';
  if (error) content = '<div class="empty">error: ' + esc(error) + '</div>';
  else if (!rows.length) content = '<div class="empty">no events</div>';
  else {
    content = '<table class="ledger-table"><thead><tr><th>ts</th><th>source</th><th>key / category</th><th>status</th><th>payload preview</th><th>card</th></tr></thead><tbody>' +
      rows.map(r => eventRow(r, dmap)).join('') +
      '</tbody></table>';
  }

  const body = commonHead() + filterForm(url, 'ledger') + '<div class="count">' + rows.length + ' events</div>' + content + commonFoot();
  return new Response(body, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store, no-cache, must-revalidate' } });
}

async function cardsView(request, env, url) {
  const { cards, error } = await fetchCards(request, url);

  if (url.searchParams.get('format') === 'json') {
    return new Response(JSON.stringify({ cards, error }, null, 2), { headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
  }

  let content = '';
  if (error) content = '<div class="empty">error: ' + esc(error) + '</div>';
  else if (!cards.length) content = '<div class="empty">no cards</div>';
  else content = '<div class="vault-rail">' + cards.map(cardWidget).join('') + '</div>';

  const body = commonHead() + filterForm(url, 'cards') + '<div class="count">' + cards.length + ' cards</div>' + content + commonFoot();
  return new Response(body, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store, no-cache, must-revalidate' } });
}

async function cardDetailView(request, env, url) {
  const cardId = url.searchParams.get('card') || '';
  const detailUrl = new URL('/api/ledger', url.origin);
  detailUrl.searchParams.set('card', cardId);
  const { cards, error } = await fetchCards(request, detailUrl);
  const c = (cards || [])[0];

  if (url.searchParams.get('format') === 'json') {
    return new Response(JSON.stringify({ card: c || null, error }, null, 2), { headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
  }

  let content = '';
  if (error) content = '<div class="empty">error: ' + esc(error) + '</div>';
  else if (!c) content = '<a class="back" href="/api/ledger">← back to ledger</a><div class="empty">card not found</div>';
  else content = cardDetailHtml(c);

  const body = commonHead() + content + commonFoot();
  return new Response(body, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store, no-cache, must-revalidate' } });
}

async function widgetsView(request, env, url) {
  const source = url.searchParams.get('source') || 'all';
  const fmt = url.searchParams.get('format');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 200);

  let widgets = {};
  if (source === 'all' || source === 'events') {
    const { rows } = await fetchEvents(env, new URL('/api/ledger?limit=' + limit, url.origin));
    widgets.events = (rows || []).map(e => normalizeWidget('event', {
      id: 'ev:' + e.id,
      title: (e.key || e.route || e.source || 'event') + (e.action ? ' · ' + e.action : ''),
      body: (e.request_preview || '').slice(0, 200) + (e.response_preview ? ' → ' + e.response_preview.slice(0, 140) : ''),
      ts: e.ts,
      status: e.status || e.direction || '',
      href: `${BASE}/api/events/${e.id}`,
      api: `${BASE}/api/events/${e.id}`
    }));
  }
  if (source === 'all' || source === 'cards') {
    const { cards, error } = await fetchCards(request, new URL('/api/ledger?view=cards&limit=' + limit, url.origin));
    widgets.cards = (cards || []).map(c => normalizeWidget('card', {
      id: c.card_id || ('card:' + (c.trace_id || c.ts)),
      title: c.title || c.card_id || 'Model/session card',
      body: (c.summary || c.input || c.output || '').slice(0, 280),
      ts: c.ts,
      status: c.category || c.actor || '',
      href: `${BASE}/api/ledger?card=${encodeURIComponent(c.card_id || '')}`,
      api: `${BASE}/api/ledger?format=json&card=${encodeURIComponent(c.card_id || '')}`
    }));
    widgets.cards_error = error;
  }
  if (source === 'all' || source === 'claims') {
    const { rows } = await fetchClaims(env, limit);
    widgets.claims = claimWidgets(rows);
  }

  if (fmt === 'json' || ['events','cards','claims'].includes(source)) {
    return new Response(JSON.stringify({ source, limit, widgets }, null, 2), { headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
  }

  const rails = [
    renderRail('Events ledger', widgets.events || [], '/api/events'),
    renderRail('Model/session cards', widgets.cards || [], '/api/cards'),
    renderRail('Claims ledger', widgets.claims || [], '/api/claims')
  ].join('');
  const actions = `<div class="vault-actions"><a href="/api/ledger/widgets?format=json">JSON</a><a href="/api/ledger">Filtered ledger</a><a href="/admin/vault">Vault</a></div>`;
  const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Ledger widgets</title><style>
:root{--bg:#f6f7f9;--ink:#111;--ink-soft:#445;--muted:#667;--line:#dde1e6;--line-strong:#c8cdd3;--accent:#0a52d0;--accent-soft:#e8f0fe;--sans:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;--mono:ui-monospace,SFMono-Regular,Menlo,Monaco,monospace}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 var(--sans);padding:24px}
${vaultStyles()}
</style></head><body><div class="vault-shell"><section class="vault-hero"><div><h1>Ledger widgets</h1><p>Sideways cards for everything the build has logged.</p></div>${actions}</section>${rails}</div></body></html>`;
  return new Response(page, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store, no-cache, must-revalidate' } });
}

function redirectToAdminLedger(url) {
  const dest = new URL('/admin/ledger', url.origin);
  const card = url.searchParams.get('card');
  if (card) dest.searchParams.set('trace_id', card);
  for (const k of ['source', 'actor', 'key', 'category', 'q', 'limit', 'trace_id', 'view']) {
    const v = url.searchParams.get(k);
    if (v) dest.searchParams.set(k, v);
  }
  return Response.redirect(dest.toString(), 302);
}

// ── router ───────────────────────────────────────────────────────────────────
export async function onRequestGet(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);
  const pathParts = Array.isArray(params.path) ? params.path : (params.path ? [params.path] : []);
  const last = pathParts[pathParts.length - 1] || '';

  // PUBLIC EXCEPTION (outside-model audit 2026-08-04): /api/ledger/head is the URL a stranger
  // guesses for the anchored chain head, and it used to serve the admin login page — a direct
  // contradiction of "a door any stranger can open". The public, keyless head lives at
  // /api/chain/head; this route now sends the guesser there instead of to a login wall.
  if (last === 'head') {
    return Response.redirect(new URL('/api/chain/head' + url.search, url.origin).toString(), 302);
  }

  // OWNER PRIVACY BAR: the ledger holds the owner's private CLI turns (verbatim inputs, cwd, name,
  // session). Every machine-readable branch of this route is owner/admin token only. The HTML path
  // falls through to redirectToAdminLedger, which is itself gated.
  const authed = await isBuildAuthed(request, env);
  if (!authed) {
    const wantsMachine =
      last === 'widgets' ||
      (pathParts.length > 0 && pathParts[0] === 'widgets') ||
      url.searchParams.get('format') === 'json' ||
      !!url.searchParams.get('card') ||
      url.searchParams.get('view') === 'cards';
    if (wantsMachine) {
      return new Response(JSON.stringify({ error: 'unauthorized', note: 'owner or admin token required' }), {
        status: 401,
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
      });
    }
    return redirectToAdminLedger(url);
  }

  if (last === 'widgets' || (pathParts.length > 0 && pathParts[0] === 'widgets')) {
    return widgetsView(request, env, url);
  }
  if (url.searchParams.get('format') !== 'json') {
    return redirectToAdminLedger(url);
  }
  if (url.searchParams.get('card')) {
    return cardDetailView(request, env, url);
  }
  if (url.searchParams.get('view') === 'cards') {
    return cardsView(request, env, url);
  }
  return ledgerView(request, env, url);
}
