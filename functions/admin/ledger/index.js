import { shellHtml } from '../_layout.js';
import { workbookResponse } from '../sheets/index.js';
import { isBuildAuthed } from '../../_lib/admin_session.js';
import { classify, TAXONOMY, CAT_COLOR, GROUP_COLOR, cardHash } from '../../_lib/ledger_taxonomy.js';
import { logEvent, archiveTick } from '../../_lib/event_log.js';
import { buildUnifiedCards } from '../../_lib/card_builder.js';
import {
  enrichEventRow, SERVICE_COLOR, serviceWhereClause, buildServiceCounts,
  serviceChipsFromCounts, serviceLabel, cardMatchesService, formatTs, svcColorForLabel,
} from '../../_lib/ledger_event_view.js';
import { heroCardStyles, renderHeroLedgerCards } from '../../_lib/ledger_card_widgets.js';
import { handleForumRequest, renderForumPage } from '../../_lib/ledger_forum.js';
import { syncHealth } from '../../_lib/ledger_sync.js';
import { dispatch } from '../../api/dispatch.js';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function jsonResp(o, status = 200) {
  return new Response(JSON.stringify(o, null, 2), { status, headers: { 'content-type': 'application/json' } });
}

// Map a shell command string to the CLI/tool actor that ran it (for Claude-Code evidence rows).
function cliActorOf(cmd) {
  const t = String(cmd || '').trim().split(/\s+/)[0] || '';
  const base = t.split('/').pop();
  if (['wrangler', 'gh', 'npm', 'npx', 'clasp', 'git', 'curl', 'python', 'python3', 'node', 'jq', 'sed', 'grep', 'awk'].includes(base)) return base;
  return 'shell';
}

// Pull the live system prompt for an agent key (cached per request). Returns '' if none.
async function agentPromptOf(env, key, cache) {
  if (!key) return '';
  if (cache.has(key)) return cache.get(key);
  let content = '';
  try {
    const row = await env.DB.prepare('SELECT content, type FROM directory WHERE key = ?').bind(key).first();
    if (row && (row.type === 'agent')) content = String(row.content || '');
  } catch {}
  cache.set(key, content);
  return content;
}

// Build a key->type map from the directory (one query) so http/fn/agent classify correctly.
async function dirTypeMap(env) {
  const m = {};
  try {
    const r = await env.DB.prepare('SELECT key, type FROM directory').all();
    for (const row of (r.results || [])) m[row.key] = row.type;
  } catch {}
  return m;
}

// Agent-turn services (Claude Code / Grok CLI / Kimi CLI …) live in DB.agent_turns + DB.cc_turns,
// NOT in LEDGER.events — fold their counts in so the service bar has a chip per agent.
function agentServiceLabel(source, agent) {
  const s = String(source || '').toLowerCase();
  if (s === 'grok-cli' || s === 'cli-grok') return 'grok-cli';
  if (s === 'claude-code' || s === 'cli-claude') return 'claude-cli';
  if (s === 'codex-cli' || s === 'cli-codex') return 'codex-cli';
  if (s === 'misc-cli' || s === 'cli-misc') return 'misc-cli';
  if (s.startsWith('cli-')) return s.slice(4) + '-cli';
  const a = String(agent || '').toLowerCase();
  if (a === 'grok') return 'grok-cli';
  if (a === 'claude') return 'claude-cli';
  if (a === 'codex') return 'codex-cli';
  if (a === 'kimi') return 'kimi-cli';
  if (a === 'misc') return 'misc-cli';
  return a ? a + '-cli' : (s || 'agent');
}

async function mergeAgentCounts(env, counts) {
  try {
    const at = await env.DB.prepare('SELECT source, agent, COUNT(*) n FROM agent_turns GROUP BY source, agent').all();
    for (const row of (at.results || [])) {
      const label = agentServiceLabel(row.source, row.agent);
      counts[label] = (counts[label] || 0) + (Number(row.n) || 0);
    }
  } catch {}
  try {
    const cc = await env.DB.prepare('SELECT COUNT(*) n FROM cc_turns').first();
    if (cc && cc.n) counts['claude-cli'] = (counts['claude-cli'] || 0) + Number(cc.n);
  } catch {}
  try {
    const gr = await env.DB.prepare('SELECT COUNT(*) n FROM grok_turns').first();
    if (gr && gr.n) counts['grok-cli'] = (counts['grok-cli'] || 0) + Number(gr.n);
  } catch {}
}

async function buildAllServiceChips(env) {
  const counts = {};
  try {
    // events_stats = incrementally-maintained rollup (source,key,n) — O(pairs), never a full events scan.
    const r = await env.LEDGER.prepare('SELECT source, key, n FROM events_stats').all();
    Object.assign(counts, buildServiceCounts(r.results || []));
  } catch {
    try {
      const r = await env.LEDGER.prepare('SELECT source, key, COUNT(*) AS n FROM events GROUP BY source, key').all();
      Object.assign(counts, buildServiceCounts(r.results || []));
    } catch {}
  }
  await mergeAgentCounts(env, counts);
  const chips = serviceChipsFromCounts(counts);
  // Pin the agent chips even when low-volume — he wants to filter by Claude Code / Grok CLI / etc.
  for (const label of ['codex-cli', 'claude-cli', 'grok-cli', 'kimi-cli', 'misc-cli', 'grok API']) {
    if (counts[label] && !chips.some((c) => c.id === label)) {
      chips.push({ id: label, label, count: counts[label] });
    }
  }
  return chips;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  // DEFENSE IN DEPTH: this endpoint serves the owner's raw ledger (his machine, sessions, inputs).
  // The middleware adminGate should already have blocked unauth callers, but a routing quirk
  // (/ADMIN, //admin) once bypassed it — so this handler independently requires the owner/admin token.
  if (!(await isBuildAuthed(request, env))) {
    return new Response(JSON.stringify({ error: 'unauthorized', login: '/admin/login' }), {
      status: 401,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  }
  const url = new URL(request.url);
  const params = url.searchParams;
  const dataMode = params.get('data');

  // The Sheets workbook is the default view of this surface (owner order 2026-08-29).
  // Every JSON/data mode and the classic page with all its views remain below: any other
  // query parameter routes to them, and ?view=classic reaches the classic page explicitly.
  // The workbook's own view-state params (owner order 2026-08-30: every view state is a
  // link) pass through so a pasted sheet link restores the exact view.
  {
    const passthrough = ['view', 'share', 'terminal_key', 'tk', 'tab', 'kind', 'sort', 'cell', 'id', 'field'];
    const paramKeys = [...params.keys()].filter(
      (k) => !passthrough.includes(k) && !k.startsWith('f.') && !k.startsWith('v.'),
    );
    if (!paramKeys.length && params.get('view') !== 'classic') {
      return workbookResponse('ledger', '/admin/ledger');
    }
  }

  // Amortized storage upkeep: move full payloads older than 45 days from D1 to R2
  // (KV-throttled to one batch per 5 min). Keeps the LEDGER database bounded forever;
  // previews + R2 keys stay in D1, readEventFull rehydrates transparently.
  try { context.waitUntil(archiveTick(env)); } catch {}

  // ── ?forum=1 — ledger-derived coding-agent forum (agent_turns projection, no separate store).
  if (params.get('forum') === '1') {
    const out = await handleForumRequest(context);
    if (out instanceof Response) return out;
    const forumBody = renderForumPage(out);
    return new Response(shellHtml({ activeHref: '/admin/ledger?forum=1', title: 'Forum', body: forumBody }), {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store, no-cache, must-revalidate',
        'pragma': 'no-cache',
      },
    });
  }

  // ── ?services=1 — every service type in the ledger, sorted by volume (+ other bucket).
  if (params.get('services')) {
    if (!env.LEDGER) return jsonResp({ services: [] });
    return jsonResp({ services: await buildAllServiceChips(env) });
  }

  // ── ?synchealth=1 — the sync corners (Cloudflare / Ledger↔GitHub / local Mac / Google Drive).
  if (params.get('synchealth')) {
    return jsonResp({ corners: await syncHealth(env) });
  }

  // ── ?bundle=1 — "Copy for LLM": a self-explaining §SELF bundle for THIS ledger view.
  // Same philosophy as the article copy-bundle, applied to the admin: paste into any model and
  // it knows what the ledger is, the exact call to reproduce the current view, how to read a card,
  // and the build's self-describing spine (OIP registry + invocations + system map).
  if (params.get('bundle')) {
    const origin = url.origin;
    const view = params.get('view') === 'turns' ? 'turns' : 'chronology';
    const service = params.get('service') || '';
    const key = params.get('key') || '';
    const q = params.get('q') || '';
    const limit = params.get('limit') || '100';
    const rp = new URLSearchParams();
    if (view === 'turns') rp.set('cards', '1'); else rp.set('data', '1');
    if (service) rp.set('service', service);
    if (key) rp.set('key', key);
    if (q) rp.set('q', q);
    rp.set('limit', limit);
    const curl = (path) => 'curl -s "' + origin + path + '" -H "x-terminal-key: $TERMINAL_KEY"';
    const md = [
      '## §SELF — miscsubjects ledger (paste without external context)',
      '',
      '**Principle:** self-explaining payload. Read this block first. It says what the ledger is, how to reproduce the exact view it came from, and where the rest of the build describes itself.',
      '',
      '**This surface:** the admin ledger — the chronological trace of every event and every turn in the build. Two lenses:',
      '- **CHRONOLOGY** = every raw payload (blooio, LLM/API, coding agents, D1_QUERY/D1_EXEC, stripe, github, cron…) as raw events, museum-grade — each row expandable to full raw request/response plus a copy-paste command that pulls that event live.',
      '- **TURNS** = one state card per turn: channel in (via Blooio / via my machine) · agent (Claude CLI / Grok CLI / Router) · what I said · what they said · tools used · WHAT HAPPENED (a numbered step-by-step sequence, each step expandable to its raw payload).',
      '',
      '**The view this bundle was copied from:**',
      '- lens: ' + view,
      '- service filter: ' + (service || 'all'),
      '- search: ' + (q || '(none)'),
      '- key: ' + (key || '(none)'),
      '- limit: ' + limit,
      '',
      '**Reproduce this exact view (JSON):**',
      '```',
      curl('/admin/ledger?' + rp.toString()),
      '```',
      '**Read one event, full raw (rehydrated from R2 if offloaded):**',
      '```',
      curl('/admin/ledger/<event_id>?data=1'),
      '```',
      '',
      '**How to read it:** on a card, *channel* = how the message arrived, *agent* = who answered, *WHAT HAPPENED* = the ordered trace, and the raw payload under each step = the exact bytes. A chronology row shows service · you-said · agent-said · agent-did, with size + R2 tag + a full-raw drill-down.',
      '',
      '### The build\'s self-describing spine — understand the whole thing from here',
      '- **Capability (what it can do):** `' + curl('/api/dispatch?registry=1') + '` — every invokable object, self-describing. `?key=KEY` returns one object\'s `_self`. Invoke with `POST /api/dispatch {key, body, actor}`.',
      '- **History (what it did):** `' + curl('/api/invocations') + '` — every invocation with yield / waste / cost / actor / trace. This ledger UI is the human lens on it.',
      '- **Knowledge (what it knows):** `' + curl('/api/articles/system-map') + '` — the content feature index; every article has its own Copy-for-LLM bundle.',
      '- **Protocol:** Object Invocation Protocol (OIP) v0.1 — resolve → validate → execute → ledger → response(data + _self + yield).',
      '',
      '### To audit or get a second opinion',
      'Ask another model through the build itself: `POST /api/dispatch {"key":"ASK_CLAUDE","body":"<question>"}` (also ASK_GPT / ASK_GEMINI / ASK_KIMI). Every such call is itself ledgered with its actor and cost, so the audit is auditable.',
      '',
      '_Self-explaining. Not medical advice._',
      '',
    ].join('\n');
    return new Response(md, { headers: { 'content-type': 'text/markdown; charset=utf-8', 'cache-control': 'no-store' } });
  }

  // ── ?convene=1 — the congress: fan this view's self-describing subject to N models, each an
  // independent voice, every call ledgered through dispatch with its own actor. Returns an HTML panel.
  if (params.get('convene')) {
    const origin = url.origin;
    const view = params.get('view') === 'turns' ? 'turns' : 'chronology';
    const service = params.get('service') || 'all';
    const question = (params.get('cq') || '').trim() ||
      'Audit this build direction. Is a unified, self-describing, ledgered trace (chronology of every payload + per-turn state cards, all invokable via one Object Invocation Protocol) the right architecture — or is it over-built? Give your direct view.';
    const preamble = [
      'You are ONE voice in a congress of models reviewing the miscsubjects build. Other models are answering the same question independently; disagreement is welcome.',
      '',
      'The build is self-describing via the Object Invocation Protocol (OIP): every capability is an invokable object.',
      '- capability registry: ' + origin + '/api/dispatch?registry=1',
      '- full invocation history (yield/waste/cost/actor/trace): ' + origin + '/api/invocations',
      '- content/knowledge map: ' + origin + '/api/articles/system-map',
      'You are looking at its ledger — lens=' + view + ', service=' + service + ' — the chronological trace of every event and every turn.',
      '',
      'Question: ' + question,
      '',
      'Answer in 2-5 sentences. Be direct and specific. No preamble, no sign-off. If you think it is wrong or over-built, say so and why.',
    ].join('\n');
    const panel = ['ASK_GPT', 'ASK_GEMINI', 'ASK_KIMI', 'ASK_CLAUDE'];
    const results = await Promise.all(panel.map(async (k) => {
      try {
        const out = await dispatch(env, k, preamble, { actor: 'convene:' + k });
        const r = String((out && out.result) || '');
        const bad = r.startsWith('ERR') || r.startsWith('PROVIDER_ERROR');
        return { key: k, ok: !bad, result: r, cost: (out && out.cost) || 0, trace: (out && out.trace) || '' };
      } catch (e) {
        return { key: k, ok: false, result: 'ERR: ' + (e && e.message || e), cost: 0, trace: '' };
      }
    }));
    const modelLabel = { ASK_GPT: 'GPT-4o', ASK_GEMINI: 'Gemini', ASK_KIMI: 'Kimi', ASK_CLAUDE: 'Claude' };
    const answered = results.filter((x) => x.ok).length;
    const rows = results.map((x) =>
      '<div class="cv-voice ' + (x.ok ? 'ok' : 'err') + '">' +
        '<div class="cv-head"><span class="cv-model">' + esc(modelLabel[x.key] || x.key) + '</span>' +
          '<span class="cv-badge ' + (x.ok ? 'ok' : 'err') + '">' + (x.ok ? 'answered' : 'unavailable') + '</span>' +
          (x.cost ? '<span class="cv-cost">$' + esc(x.cost) + '</span>' : '') +
        '</div>' +
        '<div class="cv-body">' + esc(x.result || '(no response)') + '</div>' +
      '</div>').join('');
    const html = '<div class="convene-panel">' +
      '<div class="cv-q"><b>CONGRESS</b> · ' + answered + '/' + results.length + ' answered · ' + esc(question) + '</div>' +
      rows +
      '<div class="cv-note">Each voice was invoked through /api/dispatch and ledgered with its actor + cost. This is not a vote — it is independent views on the same self-describing subject.</div>' +
    '</div>';
    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
  }

  // ── ?voxels=1 — the build's own architecture as a DERIVED graph. Nodes = directory objects;
  // activity + edges = the invocation events ledger. It cannot drift from reality because it is
  // computed from what actually ran (cold read, no hot-path cost). ?voxels=1&html=1 renders it.
  if (params.get('voxels')) {
    const dir = await env.DB.prepare('SELECT key, type, runner, category, IFNULL(enabled,1) enabled FROM directory').all();
    const act = await env.LEDGER.prepare("SELECT key, SUM(n) calls, SUM(errors) errors, MAX(last_ts) last_ts FROM events_stats WHERE key != '' GROUP BY key").all();
    const actMap = {};
    for (const r of (act.results || [])) actMap[r.key] = r;
    const ev = await env.LEDGER.prepare('SELECT trace_id, key FROM events WHERE trace_id IS NOT NULL AND key IS NOT NULL ORDER BY ts DESC LIMIT 8000').all();
    const byTrace = {};
    for (const r of (ev.results || [])) { (byTrace[r.trace_id] = byTrace[r.trace_id] || new Set()).add(r.key); }
    const edgeW = {};
    for (const tid in byTrace) {
      const keys = [...byTrace[tid]];
      for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
        const a = keys[i], b = keys[j];
        const kk = a < b ? a + '' + b : b + '' + a;
        edgeW[kk] = (edgeW[kk] || 0) + 1;
      }
    }
    const edges = Object.entries(edgeW).map(([k, w]) => { const p = k.split(''); return { a: p[0], b: p[1], weight: w }; })
      .sort((x, y) => y.weight - x.weight).slice(0, 200);
    const maxCalls = Math.max(1, ...(act.results || []).map((r) => r.calls || 0));
    const nodes = (dir.results || []).map((row) => {
      const a = actMap[row.key] || { calls: 0, errors: 0, last_ts: null };
      const calls = a.calls || 0, errors = a.errors || 0, er = calls ? errors / calls : 0;
      let tier;
      if (calls === 0) tier = 'orphan';
      else if (er > 0.2 && calls >= 5) tier = 'fragile';
      else if (calls >= maxCalls * 0.25) tier = 'hot';
      else if (calls >= 10) tier = 'warm';
      else tier = 'cold';
      return { key: row.key, type: row.type, runner: row.runner, category: row.category, enabled: !!row.enabled, calls, errors, error_rate: Math.round(er * 100) / 100, last_ts: a.last_ts, tier };
    });
    const orphans = nodes.filter((n) => n.tier === 'orphan' && n.enabled);
    const fragile = nodes.filter((n) => n.tier === 'fragile');
    const stats = { nodes: nodes.length, enabled: nodes.filter((n) => n.enabled).length, invoked: nodes.filter((n) => n.calls > 0).length, orphans: orphans.length, fragile: fragile.length, edges: edges.length, edge_window: (ev.results || []).length };
    if (!params.get('html')) {
      return jsonResp({ protocol: 'OIP', kind: 'capability-voxels', generated_at: new Date().toISOString(), stats, nodes, edges });
    }
    const tierColor = { hot: '#19a463', warm: '#0a52d0', cold: '#9aa7ba', orphan: '#d93025', fragile: '#f9ab00' };
    const chip = (n) => '<span class="vx-node" style="border-color:' + tierColor[n.tier] + '66">' +
      '<span class="vx-dot" style="background:' + tierColor[n.tier] + '"></span>' +
      '<span class="vx-k">' + esc(n.key) + '</span>' +
      '<span class="vx-m">' + esc(n.type || '') + (n.calls ? ' · ' + n.calls : '') + (n.errors ? ' · ' + n.errors + 'err' : '') + '</span></span>';
    const orphanList = orphans.slice(0, 150).map(chip).join('') || '<span class="dim">none — every enabled capability has been invoked</span>';
    const fragileList = fragile.slice(0, 80).map(chip).join('') || '<span class="dim">none</span>';
    const hotList = nodes.filter((n) => n.tier === 'hot').sort((a, b) => b.calls - a.calls).slice(0, 40).map(chip).join('') || '<span class="dim">none</span>';
    const byCat = {};
    for (const n of nodes) { (byCat[n.category || '—'] = byCat[n.category || '—'] || []).push(n); }
    const catRows = Object.entries(byCat).sort((a, b) => b[1].length - a[1].length).map(([c, ns]) => {
      const orph = ns.filter((n) => n.tier === 'orphan' && n.enabled).length;
      return '<tr><td>' + esc(c) + '</td><td>' + ns.length + '</td><td>' + ns.filter((n) => n.calls > 0).length + '</td><td>' + (orph ? '<b style="color:#d93025">' + orph + '</b>' : '0') + '</td></tr>';
    }).join('');
    const body = `<style>
.vx-stats{display:flex;gap:14px;flex-wrap:wrap;margin:14px 0 22px}
.vx-stat{border:1px solid var(--line);border-radius:12px;padding:14px 22px;min-width:120px;background:#fff}
.vx-n{font-size:28px;font-weight:800;color:#0a0a0a;line-height:1}
.vx-l{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-top:6px}
.vx-wrap{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 22px}
.vx-node{display:inline-flex;align-items:center;gap:6px;padding:4px 11px;border-radius:99px;border:1px solid;background:#fff;font-size:11px}
.vx-dot{width:8px;height:8px;border-radius:50%;flex:0 0 8px}
.vx-k{font-family:var(--mono);font-weight:700;color:#0a0a0a}
.vx-m{color:#888;font-size:10px;font-family:var(--mono)}
.vx-legend{font-size:11px;color:var(--muted);margin-bottom:10px}
.dim{color:#bbb;font-size:13px}
</style>
<h1>Capability voxels</h1>
<p class="subtitle">The build's own architecture as a derived graph — nodes = directory objects, activity + edges = the invocation ledger. A cold, read-only projection: it cannot drift from reality because it is computed from what actually ran. Full node + edge JSON: <code>/admin/ledger?voxels=1</code>.</p>
<div class="vx-stats">
  <div class="vx-stat"><div class="vx-n">${stats.nodes}</div><div class="vx-l">capabilities</div></div>
  <div class="vx-stat"><div class="vx-n">${stats.invoked}</div><div class="vx-l">invoked</div></div>
  <div class="vx-stat"><div class="vx-n" style="color:#d93025">${stats.orphans}</div><div class="vx-l">orphans · never called</div></div>
  <div class="vx-stat"><div class="vx-n" style="color:#f9ab00">${stats.fragile}</div><div class="vx-l">fragile · error-prone</div></div>
  <div class="vx-stat"><div class="vx-n">${stats.edges}</div><div class="vx-l">edges · co-trace</div></div>
</div>
<div class="vx-legend">tier: <b style="color:#19a463">hot</b> · <b style="color:#0a52d0">warm</b> · <b style="color:#9aa7ba">cold</b> · <b style="color:#f9ab00">fragile</b> · <b style="color:#d93025">orphan</b></div>
<h2>⬡ Orphans — declared but never invoked (dead-capability candidates)</h2>
<div class="vx-wrap">${orphanList}</div>
<h2>⚠ Fragile — high error rate</h2>
<div class="vx-wrap">${fragileList}</div>
<h2>🔥 Hot — most invoked</h2>
<div class="vx-wrap">${hotList}</div>
<h2>By category</h2>
<table><thead><tr><th>category</th><th>total</th><th>invoked</th><th>orphans</th></tr></thead><tbody>${catRows}</tbody></table>`;
    return new Response(shellHtml({ activeHref: '/admin/ledger', title: 'Voxels', body }), { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
  }

  // ── ?export=1 — browser download of filtered history (turns or chronology).
  if (params.get('export') === '1') {
    if (!env.LEDGER) {
      return new Response('LEDGER binding missing', { status: 500, headers: { 'content-type': 'text/plain' } });
    }
    const format = (params.get('format') || 'md').toLowerCase();
    const view = params.get('view') || 'turns';
    const service = params.get('service') || '';
    const key = params.get('key') || '';
    const traceId = params.get('trace_id') || '';
    const q = params.get('q') || '';
    const hideNoise = params.get('hide_noise') !== '0';
    const limit = Math.min(parseInt(params.get('limit') || '500', 10) || 500, 2000);
    const stamp = new Date().toISOString().slice(0, 10);
    const svcSlug = (service || 'all').replace(/[^a-zA-Z0-9_-]+/g, '_');
    const fname = 'ledger_' + view + '_' + svcSlug + '_' + stamp;

    if (view === 'turns') {
      const out = await buildUnifiedCards(env, {
        limit: String(limit),
        trace_id: traceId,
        q: key && q ? key + ' ' + q : (key || q),
        service: (service && service !== '__other__') ? service : '',
        hide_noise: hideNoise ? '1' : '0',
      });
      let cards = out.cards || [];
      if (service && service !== 'all') {
        if (service === '__other__') {
          const sr = await env.LEDGER.prepare('SELECT source, key, n FROM events_stats').all();
          const topIds = new Set(serviceChipsFromCounts(buildServiceCounts(sr.results || []))
            .filter((c) => c.id && c.id !== '' && c.id !== '__other__').map((c) => c.id));
          cards = cards.filter((c) => !topIds.has(serviceLabel({ source: c.source, key: c.routed || c.actor || '' })));
        } else {
          cards = cards.filter((c) => cardMatchesService(c, service));
        }
      }
      if (format === 'json') {
        return new Response(JSON.stringify({ view, service: service || 'all', count: cards.length, cards }, null, 2), {
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'content-disposition': 'attachment; filename="' + fname + '.json"',
            'cache-control': 'no-store',
          },
        });
      }
      const lines = [
        '# Ledger turns export',
        '',
        'view: turns',
        'service: ' + (service || 'all'),
        'turns: ' + cards.length,
        'exported: ' + new Date().toISOString(),
        '',
      ];
      for (const c of cards) {
        lines.push('---', '');
        lines.push('## ' + (c.card_id || '') + ' · ' + (c.ts || '') + ' · ' + serviceLabel({ source: c.source, key: c.routed || c.key || '' }));
        lines.push('');
        lines.push('### MY MESSAGE');
        lines.push(String(c.input || '').trim() || '(empty)');
        lines.push('');
        lines.push('### YOUR REPLY');
        lines.push(String(c.output || '').trim() || '(empty)');
        lines.push('');
        lines.push('### TOOLS USED');
        const tools = c.tools_used || [];
        if (tools.length) for (const t of tools) lines.push('- ' + t);
        else lines.push('(none)');
        lines.push('');
      }
      return new Response(lines.join('\n'), {
        headers: {
          'content-type': 'text/markdown; charset=utf-8',
          'content-disposition': 'attachment; filename="' + fname + '.md"',
          'cache-control': 'no-store',
        },
      });
    }

    const where = [];
    const binds = [];
    if (service) {
      const sw = await serviceWhereClause(env, service);
      if (sw) { where.push(sw.clause); binds.push(...sw.binds); }
    }
    if (key) { where.push('key = ?'); binds.push(key); }
    if (traceId) { where.push('trace_id = ?'); binds.push(traceId); }
    if (hideNoise && service !== 'cron') { where.push('key != ?'); binds.push('TODO_RUN'); }
    if (q) {
      where.push('(key LIKE ? OR action LIKE ? OR request_preview LIKE ? OR response_preview LIKE ?)');
      const like = '%' + q + '%';
      binds.push(like, like, like, like);
    }
    const sql =
      'SELECT id, ts, build, source, key, route, action, direction, status, trace_id, step, parent, ' +
      'request_preview, response_preview, request_size, response_size, r2_request_key, r2_response_key ' +
      'FROM events ' + (where.length ? 'WHERE ' + where.join(' AND ') + ' ' : '') +
      'ORDER BY ts DESC LIMIT ?';
    binds.push(limit);
    const er = await env.LEDGER.prepare(sql).bind(...binds).all();
    const rows = (er.results || []).map(enrichEventRow);
    if (format === 'json') {
      return new Response(JSON.stringify({ view: 'chronology', service: service || 'all', count: rows.length, rows }, null, 2), {
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'content-disposition': 'attachment; filename="' + fname + '.json"',
          'cache-control': 'no-store',
        },
      });
    }
    const lines = [
      '# Ledger chronology export',
      '',
      'view: chronology',
      'service: ' + (service || 'all'),
      'events: ' + rows.length,
      'exported: ' + new Date().toISOString(),
      '',
    ];
    for (const row of rows) {
      lines.push('---', '');
      lines.push('## ' + (row.time_short || row.ts) + ' · ' + (row.service || row.source) + ' · ' + (row.key || ''));
      lines.push('');
      lines.push('you said: ' + (row.you_said || '—'));
      lines.push('agent said: ' + (row.agent_said || '—'));
      lines.push('agent did: ' + (row.agent_did || '—'));
      if (row.trace_id) lines.push('trace: ' + row.trace_id);
      lines.push('');
    }
    return new Response(lines.join('\n'), {
      headers: {
        'content-type': 'text/markdown; charset=utf-8',
        'content-disposition': 'attachment; filename="' + fname + '.md"',
        'cache-control': 'no-store',
      },
    });
  }

  // ── ?keys=1 — every event key in the ledger, sorted by volume (for KEY datalist).
  if (params.get('keys')) {
    if (!env.LEDGER) return jsonResp({ keys: [] });
    const r = await env.LEDGER.prepare("SELECT key, SUM(n) AS n FROM events_stats WHERE key != '' GROUP BY key ORDER BY n DESC LIMIT 500").all();
    return jsonResp({ keys: r.results || [] });
  }

  // ── ?categories=1 — the parent→child category tree with live counts.
  // The higher-level groups the owner asked for; drill into any leaf via ?cards=1&category=.
  if (params.get('categories')) {
    if (!env.LEDGER) return jsonResp({ groups: [], error: 'LEDGER binding missing' });
    const dmap = await dirTypeMap(env);
    const r = await env.LEDGER.prepare(
      'SELECT source, key, n FROM events_stats'
    ).all();
    const catCount = {}, actorCount = {};
    for (const row of (r.results || [])) {
      const c = classify({ source: row.source, key: row.key, dirType: dmap[row.key] });
      catCount[c.category] = (catCount[c.category] || 0) + row.n;
      actorCount[c.actor] = (actorCount[c.actor] || 0) + row.n;
    }
    // CLI turns live in the spine DB; fold their counts in too.
    let ccN = 0;
    let grN = 0;
    try { const cc = await env.DB.prepare('SELECT COUNT(*) n FROM cc_turns').first(); ccN = (cc && cc.n) || 0; } catch {}
    try { const gr = await env.DB.prepare('SELECT COUNT(*) n FROM grok_turns').first(); grN = (gr && gr.n) || 0; } catch {}
    catCount['claude-code'] = (catCount['claude-code'] || 0) + ccN;
    actorCount['claude-code'] = (actorCount['claude-code'] || 0) + ccN;
    catCount['cli'] = (catCount['cli'] || 0) + grN;
    actorCount['grok'] = (actorCount['grok'] || 0) + grN;

    const groups = Object.entries(TAXONOMY).map(([group, cats]) => ({
      group,
      total: cats.reduce((s, c) => s + (catCount[c] || 0), 0),
      categories: cats.map((c) => ({ category: c, count: catCount[c] || 0 })),
    })).filter((g) => g.total > 0);
    return jsonResp({ groups, actors: actorCount });
  }

  // ── ?github_poll=1 — pull recent commits from GitHub and fold them into the ledger as
  // source='github' events (id gh_<sha>, idempotent). Lets the ledger include repo activity.
  if (params.get('github_poll')) {
    if (!env.GITHUB_TOKEN) return jsonResp({ error: 'no GITHUB_TOKEN' }, 500);
    const REPO = '[OWNER_HANDLE]/miscsubjects-pages';
    const n = Math.min(parseInt(params.get('n') || '20', 10) || 20, 100);
    const r = await fetch(`https://api.github.com/repos/${REPO}/commits?per_page=${n}`, {
      headers: { 'Authorization': 'Bearer ' + env.GITHUB_TOKEN, 'Accept': 'application/vnd.github+json', 'User-Agent': 'miscsubjects-ledger' },
    });
    if (!r.ok) return jsonResp({ error: 'github ' + r.status, detail: await r.text() }, 502);
    const commits = await r.json();
    let inserted = 0;
    for (const c of (commits || [])) {
      const sha = c.sha;
      const exists = await env.LEDGER.prepare('SELECT id FROM events WHERE id = ?').bind('gh_' + sha).first();
      if (exists) continue;
      await logEvent(env, {
        id: 'gh_' + sha,
        ts: (c.commit && c.commit.author && c.commit.author.date) || new Date().toISOString(),
        source: 'github',
        key: 'COMMIT',
        action: 'push',
        actor: (c.commit && c.commit.author && c.commit.author.name) || 'github',
        trace_id: 'gh_' + String(sha).slice(0, 8),
        request: { sha, message: c.commit && c.commit.message, url: c.html_url },
        response: { author: c.commit && c.commit.author, files_url: c.url },
        status: 200,
      });
      inserted++;
    }
    return jsonResp({ ok: true, polled: (commits || []).length, inserted });
  }

  // ── ?cards=1 — unified state cards (trace events + agent_turns). Same builder as /admin/os.
  if (params.get('cards')) {
    try {
      const out = await buildUnifiedCards(env, {
        limit: params.get('limit'),
        card_id: params.get('card_id') || '',
        trace_id: params.get('trace_id') || '',
        agent: params.get('agent') || '',
        source: params.get('source') || '',
        category: params.get('category') || '',
        group: params.get('group') || '',
        actor: params.get('actor') || '',
        tag: params.get('tag') || '',
        q: params.get('q') || '',
        hide_noise: params.get('hide_noise'),
        service: (params.get('service') && params.get('service') !== '__other__') ? params.get('service') : '',
      });
      const svc = params.get('service') || '';
      if (svc && svc !== 'all') {
        if (svc === '__other__') {
          const sr = await env.LEDGER.prepare('SELECT source, key, n FROM events_stats').all();
          const topIds = new Set(serviceChipsFromCounts(buildServiceCounts(sr.results || []))
            .filter((c) => c.id && c.id !== '' && c.id !== '__other__').map((c) => c.id));
          out.cards = (out.cards || []).filter((c) => !topIds.has(serviceLabel({ source: c.source, key: c.routed || c.actor || '' })));
        } else {
          out.cards = (out.cards || []).filter((c) => cardMatchesService(c, svc));
        }
      }
      if (params.get('html')) {
        // ?cards=1&html=1 is the fragment the styled page fetches into itself. Opened as a
        // top-level navigation it renders bare and reads as the site being broken
        // (2026-07-27). A human navigation goes to the styled turns view instead.
        if ((request.headers.get('sec-fetch-mode') || '') === 'navigate') {
          const q = new URLSearchParams({ view: 'turns' });
          const agent = params.get('agent') || '';
          const svc = params.get('service') || (agent ? agent.replace(/^cli-/, '') + '-cli' : '');
          if (svc) q.set('service', svc);
          if (params.get('trace_id')) q.set('trace_id', params.get('trace_id'));
          if (params.get('q')) q.set('q', params.get('q'));
          return Response.redirect(url.origin + '/admin/ledger?' + q.toString(), 302);
        }
        const origin = url.origin;
        const curl = (path) => 'curl -s "' + origin + path + '" -H "x-terminal-key: $TERMINAL_KEY"';
        const enriched = (out.cards || []).map((c) => ({ ...c, time_short: formatTs(c.ts) }));
        return new Response(renderHeroLedgerCards(enriched, {
          curlGet: curl,
          catColor: (cat) => CAT_COLOR[cat] || '#dedede',
        }), {
          headers: { 'content-type': 'text/html; charset=utf-8' },
        });
      }
      return jsonResp(out);
    } catch (err) {
      if (params.get('html')) {
        return new Response('<p class="empty">' + esc(String(err && err.message || err)) + '</p>', {
          status: 500,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        });
      }
      return jsonResp({ count: 0, cards: [], flows: [], error: String(err && err.message || err) }, 500);
    }
  }

  // ── ?turns=1 — one clean JSON object PER inbound message, for Google Apps Script.
  // Groups the raw events by trace_id and returns, per turn: the message you sent, every
  // tool the router ran (in -> out), where it routed, and the reply it sent. This is the
  // GAS-facing view the owner asked for: point a GAS UrlFetchApp.fetch at it and read what
  // happened to each inbound iMessage. Filters: ?trace_id= (one turn) · ?limit= (turns) ·
  // ?q= (text in the message). No key required (same as the rest of this endpoint).
  if (params.get('turns')) {
    if (!env.LEDGER) {
      return new Response(JSON.stringify({ turns: [], error: 'LEDGER binding missing' }), { headers: { 'content-type': 'application/json' } });
    }
    const traceId = params.get('trace_id') || '';
    const q       = params.get('q') || '';
    const limit   = Math.min(parseInt(params.get('limit') || '40', 10) || 40, 300);

    const where = ['trace_id IS NOT NULL'];
    const binds = [];
    if (traceId) { where.push('trace_id = ?'); binds.push(traceId); }
    // Pull enough raw events to cover `limit` turns (a turn is ~2-10 events).
    const sql =
      'SELECT id, ts, source, key, action, direction, trace_id, step, ' +
      'request_preview, response_preview, request_json, response_json ' +
      'FROM events WHERE ' + where.join(' AND ') +
      ' ORDER BY ts DESC LIMIT ?';
    binds.push(Math.min(limit * 12, 3000));
    const r = await env.LEDGER.prepare(sql).bind(...binds).all();
    const rows = r.results || [];

    // group by trace, ascending within a trace
    const byTrace = {};
    for (const row of rows) { (byTrace[row.trace_id] = byTrace[row.trace_id] || []).push(row); }

    const reText = (row, which) => String((which === 'in' ? (row.request_json || row.request_preview) : (row.response_json || row.response_preview)) || '');
    const lastReply = (s) => {
      const str = String(s || ''); const re = /\[REPLY\]([\s\S]*?)\[\/REPLY\]/g; let m, last = null;
      while ((m = re.exec(str)) !== null) last = m[1];
      if (last == null) { const o = str.lastIndexOf('[REPLY]'); if (o !== -1) last = str.slice(o + 7); }
      return last == null ? '' : last.replace(/\[\/?(REASONING|DONE|SELF|REPLY)\]/g, '').replace(/\s+/g, ' ').trim();
    };
    const inboundOf = (s) => { const i = String(s || '').lastIndexOf('Now:'); return i === -1 ? '' : String(s).slice(i + 4).trim(); };
    const headOf = (s) => { const m = String(s || '').match(/\[channel ([^\]]+)\]/); return m ? m[1].trim() : ''; };

    const turns = [];
    for (const [tid, steps] of Object.entries(byTrace)) {
      steps.sort((a, b) => String(a.ts).localeCompare(String(b.ts)) || (a.step || 0) - (b.step || 0));
      // A "turn" for GAS = an inbound message the ROUTER handled. Skip automated traces
      // (page serves, crawler hits) that never touched the router — unless one trace is asked for.
      const brain = steps.find((x) => x.key === 'ROUTER');
      if (!brain && !traceId) continue;
      if (!brain) { turns.push({ trace_id: tid, ts: steps[steps.length - 1].ts, channel: '', message: '', tools: steps.map((x) => ({ key: x.key, in: String(reText(x, 'in')).slice(0, 120), out: String(reText(x, 'out')).slice(0, 200) })), routed: null, reply: '', steps: steps.length }); continue; }
      const routerOut = steps.filter((x) => x.key === 'ROUTER').map((x) => reText(x, 'out')).join('\n');
      // The inbound message + reply are also captured on the small blooio 'router' envelope
      // (the ROUTER request itself spills to R2, so its preview lacks "Now:"). Prefer that.
      let bMsg = '', bReply = '';
      const bev = steps.find((x) => x.source === 'blooio' && /"router":true/.test(String(x.request_preview || '')));
      if (bev) { try { const p = JSON.parse(String(bev.request_preview)); bMsg = p.turn || ''; bReply = p.reply || ''; } catch {} }
      const inbound = inboundOf(reText(brain, 'in')) || bMsg;
      if (q && !(inbound.toLowerCase().includes(q.toLowerCase()))) continue;
      // tools = every non-ROUTER dispatched step
      const tools = steps.filter((x) => x.key && x.key !== 'ROUTER' && x.source === 'dispatch').map((x) => ({
        key: x.key,
        in: String(reText(x, 'in')).slice(0, 300),
        out: String(reText(x, 'out')).slice(0, 600),
      }));
      // routed agent = an uppercase routing tag in the router output (not a reply/meta tag)
      let routed = null; const tagRe = /\[([A-Z_][A-Z0-9_]*)\]/g; let tm;
      while ((tm = tagRe.exec(routerOut)) !== null) { if (!['REPLY','DONE','SELF','REASONING'].includes(tm[1])) { routed = tm[1]; break; } }
      const reply = lastReply(steps.map((x) => reText(x, 'out')).join('\n')) || bReply;
      turns.push({
        trace_id: tid,
        ts: steps[steps.length - 1].ts,
        channel: headOf(reText(brain, 'in')),
        message: inbound,
        tools,
        routed,
        reply,
        steps: steps.length,
      });
    }
    turns.sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
    return new Response(JSON.stringify({ turns: turns.slice(0, limit) }, null, 2), { headers: { 'content-type': 'application/json' } });
  }

  if (dataMode) {
    const source   = params.get('source')   || '';
    const service  = params.get('service')  || '';
    const key      = params.get('key')      || '';
    const traceId  = params.get('trace_id') || '';
    const statusS  = params.get('status')   || '';
    const q        = params.get('q')        || '';
    // Cursor for infinite scroll (owner order 2026-08-29): rows strictly older than this ts.
    const before   = params.get('before')   || '';
    const hideNoise = params.get('hide_noise') !== '0';
    const limit    = Math.min(parseInt(params.get('limit') || '100', 10), 1000);

    if (!env.LEDGER) {
      return new Response(JSON.stringify({ rows: [], error: 'LEDGER binding missing' }), {
        headers: { 'content-type': 'application/json' },
      });
    }

    const where = [];
    const binds = [];
    if (service) {
      const sw = await serviceWhereClause(env, service);
      if (sw) { where.push(sw.clause); binds.push(...sw.binds); }
    } else if (source) {
      where.push('source = ?'); binds.push(source);
    }
    if (key)     { where.push('key = ?');      binds.push(key); }
    if (traceId) { where.push('trace_id = ?'); binds.push(traceId); }
    if (statusS) { where.push('status = ?');   binds.push(parseInt(statusS, 10)); }
    if (before)  { where.push('ts < ?');       binds.push(before); }
    if (hideNoise && service !== 'cron') { where.push('key != ?'); binds.push('TODO_RUN'); }
    if (q)       {
      where.push('(key LIKE ? OR action LIKE ? OR request_preview LIKE ? OR response_preview LIKE ?)');
      const like = '%' + q + '%';
      binds.push(like, like, like, like);
    }
    const sql =
      'SELECT id, ts, build, source, key, route, action, direction, status, trace_id, step, parent, ' +
      'request_preview, response_preview, request_size, response_size, r2_request_key, r2_response_key, legacy_table ' +
      'FROM events ' +
      (where.length ? 'WHERE ' + where.join(' AND ') + ' ' : '') +
      'ORDER BY ts DESC LIMIT ?';
    binds.push(limit);

    const r = await env.LEDGER.prepare(sql).bind(...binds).all();
    const rows = (r.results || []).map(enrichEventRow);
    return new Response(JSON.stringify({ rows }), {
      headers: { 'content-type': 'application/json' },
    });
  }

  const initialService = params.get('service') || '';
  const initialSource = params.get('source') || '';
  const initialKey    = params.get('key')    || '';
  const initialTrace  = params.get('trace_id') || '';
  const initialHideNoise = params.get('hide_noise') !== '0';
  const origin = url.origin;

  function curlGet(path) {
    return 'curl -s "' + origin + path + '" -H "x-terminal-key: $TERMINAL_KEY"';
  }

  const ssr = { events: [], cards: [], error: '', keys: [], services: [], sync: [] };
  try { ssr.sync = await syncHealth(env); } catch {}
  if (!env.LEDGER) {
    ssr.error = 'LEDGER binding missing on this Worker — events cannot load.';
  } else {
    try {
      ssr.services = await buildAllServiceChips(env);
      const kr = await env.LEDGER.prepare("SELECT key, SUM(n) AS n FROM events_stats WHERE key != '' GROUP BY key ORDER BY n DESC LIMIT 500").all();
      ssr.keys = kr.results || [];
    } catch {}
    try {
      const where = [];
      const binds = [];
      if (initialService) {
        const sw = await serviceWhereClause(env, initialService);
        if (sw) { where.push(sw.clause); binds.push(...sw.binds); }
      } else if (initialSource) { where.push('source = ?'); binds.push(initialSource); }
      if (initialKey) { where.push('key = ?'); binds.push(initialKey); }
      if (initialTrace) { where.push('trace_id = ?'); binds.push(initialTrace); }
      if (initialHideNoise && initialService !== 'cron') { where.push('key != ?'); binds.push('TODO_RUN'); }
      const sql =
        'SELECT id, ts, build, source, key, route, action, direction, status, trace_id, step, parent, ' +
        'request_preview, response_preview, request_size, response_size, r2_request_key, r2_response_key ' +
        'FROM events ' + (where.length ? 'WHERE ' + where.join(' AND ') + ' ' : '') +
        'ORDER BY ts DESC LIMIT ?';
      binds.push(100);
      const er = await env.LEDGER.prepare(sql).bind(...binds).all();
      ssr.events = (er.results || []).map(enrichEventRow);
    } catch (e) {
      ssr.error = 'events query failed: ' + String(e && e.message || e);
    }
    try {
      const cr = await buildUnifiedCards(env, { limit: 24, trace_id: initialTrace, q: initialKey ? '' : '', hide_noise: initialHideNoise ? '1' : '0', service: (initialService && initialService !== '__other__') ? initialService : '' });
      ssr.cards = cr.cards || [];
    } catch (e) {
      ssr.error = (ssr.error ? ssr.error + ' · ' : '') + 'cards failed: ' + String(e && e.message || e);
    }
  }

  function svcColor(svc) {
    return svcColorForLabel(svc);
  }

  function ssrEventRow(row) {
    const svc = row.service || row.source || '';
    const col = svcColor(svc);
    const trace = row.trace_id
      ? '<a class="trace-link" href="/admin/ledger?trace_id=' + encodeURIComponent(row.trace_id) + '">' + esc(row.trace_id) + '</a>' + (row.step != null ? '<span class="step-n">·' + esc(row.step) + '</span>' : '')
      : '';
    const reqR2 = row.r2_request_key ? '<span class="r2-tag">R2</span>' : '';
    const resR2 = row.r2_response_key ? '<span class="r2-tag">R2</span>' : '';
    const reqSz = row.request_size > 0 ? '<span class="sz">' + esc(row.request_size) + 'b</span>' : '';
    const resSz = row.response_size > 0 ? '<span class="sz">' + esc(row.response_size) + 'b</span>' : '';
    const full = row.id ? '<div class="rawmeta"><a class="id-link" href="/admin/ledger/' + encodeURIComponent(row.id) + '?data=1" target="_blank" rel="noopener">full raw ↗</a></div>' : '';
    const raw = (row.request_preview || row.response_preview || row.r2_request_key || row.r2_response_key)
      ? '<details class="raw-fold"><summary>raw' + reqSz + reqR2 + resSz + resR2 + '</summary>' + full + '<pre>' + esc('req: ' + (row.request_preview || '(offloaded to R2 — open full raw)') + '\n---\nres: ' + (row.response_preview || '(offloaded to R2 — open full raw)')) + '</pre></details>'
      : '';
    const dot = row.status == null ? 'neutral' : (row.status >= 200 && row.status < 400 ? 'ok' : 'fail');
    return '<tr class="ev-row' + (dot === 'fail' ? ' ev-fail' : '') + '">' +
      '<td class="col-time"><span class="ev-dot ' + dot + '"></span>' + esc(row.time_short || row.ts) + '</td>' +
      '<td class="col-svc"><span class="svc-chip" style="background:' + col + '">' + esc(svc) + '</span></td>' +
      '<td class="col-you"><div class="cell-text you">' + (row.you_said ? esc(row.you_said) : '<span class="dim">—</span>') + '</div></td>' +
      '<td class="col-agent"><div class="cell-text agent">' + (row.agent_said ? esc(row.agent_said) : '<span class="dim">—</span>') + '</div></td>' +
      '<td class="col-did"><div class="cell-text did">' + esc(row.agent_did || '—') + raw + '</div></td>' +
      '<td class="col-trace">' + trace + '</td>' +
    '</tr>';
  }

  const serviceBarHtml = (ssr.services.length ? ssr.services : [{ id: '', label: 'all', count: 0 }]).map((c) => {
    const on = (initialService || '') === c.id ? ' on' : '';
    const col = svcColor(c.label === 'other' ? 'other' : c.label);
    return '<button type="button" class="svc-filter' + on + '" data-svc="' + esc(c.id) + '" style="--svc:' + col + '">' +
      esc(c.label) + '<span class="svc-n">' + esc(String(c.count || 0)) + '</span></button>';
  }).join('');

  const keyDatalistHtml = (ssr.keys || []).map((r) => '<option value="' + esc(r.key) + '">').join('');

  const ssrEventRows = ssr.events.length
    ? ssr.events.map(ssrEventRow).join('')
    : '<tr><td colspan="6" class="empty">' + esc(ssr.error || 'no events in this filter') + '</td></tr>';

  const ssrCardPreview = ssr.cards.length
    ? renderHeroLedgerCards(
        ssr.cards.slice(0, 24).map((c) => ({ ...c, time_short: formatTs(c.ts) })),
        { curlGet, catColor: (cat) => CAT_COLOR[cat] || '#dedede' },
      )
    : '<p class="empty">' + esc(ssr.error || 'no turns') + '</p>';

  const initialTermQs = new URLSearchParams();
  initialTermQs.set('data', '1');
  if (initialService) initialTermQs.set('service', initialService);
  else if (initialSource) initialTermQs.set('source', initialSource);
  if (initialKey) initialTermQs.set('key', initialKey);
  if (initialTrace) initialTermQs.set('trace_id', initialTrace);
  if (!initialHideNoise) initialTermQs.set('hide_noise', '0');
  initialTermQs.set('limit', '100');
  const initialTermCmd = curlGet('/admin/ledger?' + initialTermQs.toString());

  const ssrBanner = ssr.error ? '<div class="banner"><b>Ledger error:</b> ' + esc(ssr.error) + '</div>' : '';

  function syncAgeLabel(c) {
    if (c.id === 'cloudflare') return 'source of record';
    if (c.age_s == null) return 'never';
    if (c.age_s < 90) return 'just now';
    if (c.age_s < 3600) return Math.round(c.age_s / 60) + 'm ago';
    return Math.round(c.age_s / 3600) + 'h ago';
  }
  function syncStripHtml(corners) {
    const dots = (corners || []).map((c) =>
      '<span class="sy-corner" title="' + esc(c.label + ' · ' + syncAgeLabel(c)) + '">' +
        '<span class="sy-dot ' + esc(c.state) + '"></span>' +
        '<span class="sy-name">' + esc(c.label) + '</span>' +
        '<span class="sy-age">' + esc(syncAgeLabel(c)) + '</span>' +
      '</span>').join('<span class="sy-link">⟷</span>');
    return '<div class="sync-strip" id="sync-strip">' +
      '<span class="sy-title">SYNC</span>' + dots +
      '<span class="sy-note">one build · four corners · no asymmetry</span></div>';
  }

  const body = `
<style>
${heroCardStyles()}
/* ── one query panel ── */
.query-panel{border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin-bottom:18px;background:#fafbfc}
.dl-compact{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end;margin-bottom:12px}
.dl-compact .dl-label{font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.dl-seg{display:inline-flex;border:1px solid var(--line-strong);border-radius:7px;overflow:hidden}
.dl-seg .dl-f{border:none;border-radius:0;padding:5px 11px;font-size:11px;font-weight:800;background:#fff;color:#0a0a0a;cursor:pointer;border-right:1px solid var(--line)}
.dl-seg .dl-f:last-child{border-right:none}
.dl-seg .dl-f:hover{background:#f0f4fb}
.dl-seg .dl-f.on{background:#0a0a0a;color:#fff}
.dl-counts{display:inline-flex;gap:4px}
.dl-n{font-size:11px;font-weight:700;padding:5px 11px;border-radius:7px;border:1px solid var(--line-strong);background:#fff;color:#0a0a0a;text-decoration:none;cursor:pointer}
.dl-n:hover{border-color:#0a52d0;background:#f0f4fb;text-decoration:none}
.dl-llm-btn{font-size:11px;font-weight:700;padding:5px 12px;border-radius:7px;border:1px solid var(--line-strong);background:#fff;color:#0a0a0a;cursor:pointer}
.dl-llm-btn:hover{border-color:#0a52d0;background:#f0f4fb}

/* ── convene: congress of models ── */
.convene-panel{margin:14px 0 4px;border:2px solid #0a0a0a;border-radius:12px;overflow:hidden;background:#fff}
.cv-q{padding:12px 16px;background:#0a0a0a;color:#fff;font-size:13px;line-height:1.5}
.cv-voice{padding:12px 16px;border-bottom:1px solid #eee}
.cv-voice:last-of-type{border-bottom:none}
.cv-voice.err{background:#fdf6f6}
.cv-head{display:flex;align-items:center;gap:8px;margin-bottom:5px}
.cv-model{font-weight:800;font-size:13px;color:#0a0a0a}
.cv-badge{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;padding:1px 7px;border-radius:99px}
.cv-badge.ok{background:#e7f6ee;color:#0f7a3d}
.cv-badge.err{background:#fdeaea;color:#c0392b}
.cv-cost{font-size:10px;color:#999;font-family:var(--mono);margin-left:auto}
.cv-body{font-size:14px;line-height:1.6;color:#222;white-space:pre-wrap;overflow-wrap:anywhere}
.cv-note{padding:10px 16px;font-size:11px;color:var(--muted);background:#fafbfc;border-top:1px solid #eee}
.service-bar{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid var(--line)}
.service-bar .svc-label{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-right:6px}
.svc-filter{font-size:12px;font-weight:600;padding:5px 12px;border-radius:99px;border:1px solid var(--line-strong);background:#fff;cursor:pointer;color:#0a0a0a;white-space:nowrap;display:inline-flex;align-items:center;gap:6px}
.svc-filter:hover{border-color:#0a52d0}
.svc-filter.on{background:#0a0a0a;color:#fff;border-color:#0a0a0a}
.svc-filter .svc-n{font-size:10px;font-family:var(--mono);opacity:.75;font-weight:700}
.svc-filter.on .svc-n{opacity:.9}
.query-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.query-row .grp{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}
.query-row input,.query-row select{font-size:13px;padding:6px 10px;color:#000;border:1px solid var(--line-strong);border-radius:6px;min-width:0}
.query-row #f-key{min-width:160px;font-family:var(--mono)}
.query-row #f-trace{min-width:120px;font-family:var(--mono)}
.query-row #f-q{min-width:180px}
.viewtog button{font-size:12px;font-weight:600;padding:6px 14px;border-radius:6px;border:1px solid var(--line-strong);background:#fff;cursor:pointer}
.viewtog button.on{background:#0a0a0a;color:#fff;border-color:#0a0a0a}
.term-bar.expanded{margin-top:12px}
.term-bar.expanded pre{min-height:52px;max-height:220px;overflow:auto}

/* ── events table ── */
#events-table{table-layout:fixed;width:100%}
#events-table th{font-size:11px;text-transform:uppercase;letter-spacing:.05em;position:static}
#events-table .col-time{width:148px;font-family:var(--mono);font-size:11px;white-space:nowrap;color:#555}
#events-table th.col-time .tz{font-size:9px;font-weight:600;color:#999;text-transform:uppercase}
#events-table .col-svc{width:100px}
#events-table .col-you,#events-table .col-agent{width:24%}
#events-table .col-did{width:18%}
#events-table .col-trace{width:120px;font-family:var(--mono);font-size:11px}
.svc-chip{display:inline-block;padding:4px 10px;border-radius:99px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#0a0a0a;border:1px solid rgba(0,0,0,.08);white-space:nowrap;line-height:1.2}
.cell-text{font-size:13px;line-height:1.5;overflow-wrap:anywhere;word-break:break-word;max-height:88px;overflow:hidden}
.cell-text.you{color:#0a0a0a;font-weight:500}
.cell-text.agent{color:#0f5132;background:#f4fbf6;border-radius:6px;padding:6px 8px;margin:-2px 0}
.cell-text.did{color:#444;font-family:var(--mono);font-size:11px}
.cell-text .dim{color:#bbb}
.trace-link{color:#0a52d0;text-decoration:none;font-weight:600}
.trace-link:hover{text-decoration:underline}
.step-n{color:#999;margin-left:2px}
.raw-fold{margin-top:6px}
.raw-fold summary{font-size:10px;color:#888;cursor:pointer}
.raw-fold pre{margin:4px 0 0;font-size:10px;max-height:120px;overflow:auto;white-space:pre-wrap;color:#666;background:#f4f5f7;padding:6px;border-radius:4px}
.ev-row td{vertical-align:top;padding:10px 12px}
.ev-dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:7px;vertical-align:middle}
.ev-dot.ok{background:#19a463}
.ev-dot.fail{background:#d93025;box-shadow:0 0 0 3px #d9302522}
.ev-dot.neutral{background:#c8cdd3}
.ev-row.ev-fail{background:#fdf7f6}
.ev-row.ev-fail:hover{background:#fbf0ee}
.ev-row:hover{background:#fafbfd}
.preview{margin:0;font-size:11px;max-height:160px;overflow:auto;white-space:pre-wrap;word-break:normal;overflow-wrap:anywhere;color:#000;font-family:var(--mono)}

/* ── STATE CARDS — EXTREMELY VISUAL ── */
.card{
  border:1px solid var(--line);
  border-radius:14px;
  padding:0;
  margin-bottom:20px;
  overflow:hidden;
  background:#fff;
  box-shadow:0 1px 3px rgba(0,0,0,.06),0 4px 12px rgba(0,0,0,.04);
}
.card:hover{box-shadow:0 2px 6px rgba(0,0,0,.08),0 8px 24px rgba(0,0,0,.06)}

/* thick colored left border */
.card .head{
  display:flex;
  align-items:center;
  gap:10px;
  flex-wrap:wrap;
  padding:14px 18px;
  border-left:6px solid var(--card-accent,#0a52d0);
  border-bottom:1px solid #f0f0f0;
  background:linear-gradient(180deg,#fafbfc 0%,#fff 100%);
}
.card .head .cat-badge{
  display:inline-flex;align-items:center;gap:6px;
  padding:4px 12px;border-radius:99px;font-size:12px;font-weight:700;
  letter-spacing:.02em;color:#0a0a0a;border:1px solid rgba(0,0,0,.1);
  background:var(--card-accent,#0a52d0);background-blend-mode:screen;
  box-shadow:0 1px 2px rgba(0,0,0,.06);
}
.card .head .src-badge{
  display:inline-flex;align-items:center;gap:4px;
  padding:3px 10px;border-radius:99px;font-size:11px;font-weight:600;
  letter-spacing:.04em;text-transform:uppercase;color:#fff;
  background:#0a0a0a;border:1px solid rgba(0,0,0,.1);
}
.card .head .cid{
  font-family:var(--mono);font-size:13px;font-weight:700;color:#0a0a0a;
  background:#f0f0f0;padding:2px 8px;border-radius:5px;
}
.card .head .chash{
  font-family:var(--mono);font-size:10px;color:#888;
  background:#f5f5f5;padding:2px 6px;border-radius:4px;
}
.card .head .when{
  font-size:11px;color:#555;margin-left:auto;font-family:var(--mono);
  font-weight:600;letter-spacing:.01em;
}

/* body */
.card .body{padding:18px 20px}

/* ── message / reply — HERO SECTIONS ── */
.card .hero-io{display:grid;grid-template-columns:1fr;gap:18px}
.card .hero-box{
  border-radius:12px;border:1px solid var(--line);overflow:hidden;
  background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.04);
}
.card .hero-box .hbar{
  display:flex;align-items:center;gap:8px;padding:8px 14px;
  font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;
  border-bottom:1px solid var(--line);background:#f8f9fa;
}
.card .hero-box .hbar .hicon{font-size:14px}
.card .hero-box .hmsg{
  font-size:16px;line-height:1.65;white-space:pre-wrap;overflow-wrap:anywhere;
  color:#0a0a0a;padding:14px 16px;max-height:360px;overflow:auto;
  font-family:var(--sans);font-weight:450;
}
.card .hero-box.in{border-left:5px solid #0a52d0}
.card .hero-box.in .hbar{color:#0a52d0}
.card .hero-box.out{border-left:5px solid #19a463}
.card .hero-box.out .hbar{color:#19a463}
.card .hero-box.out .hmsg{background:#f8fcf9}
.card .hero-box.warn{border-left:5px solid #d93025}
.card .hero-box.warn .hbar{color:#d93025}

/* ── system prompt — BRAIN PANEL ── */
.card .brain-panel{
  margin-top:16px;border-radius:10px;border:1px solid #e2e2e2;
  overflow:hidden;background:#fff;
}
.card .brain-panel summary{
  cursor:pointer;padding:10px 14px;font-size:11px;font-weight:700;
  text-transform:uppercase;letter-spacing:.06em;color:#444;
  background:#f5f5f5;border-bottom:1px solid #ddd;user-select:none;
  display:flex;align-items:center;gap:8px;
}
.card .brain-panel summary:hover{color:#000}
.card .brain-panel pre{
  margin:0;padding:14px 16px;font-size:12.5px;line-height:1.6;
  white-space:pre-wrap;overflow-wrap:anywhere;max-height:340px;overflow:auto;
  background:#fff;color:#222;font-family:var(--mono);
  border:none;border-radius:0;
}
.card .brain-panel .brain-note{
  font-size:10px;color:#6a7280;margin-left:auto;font-weight:500;
  text-transform:none;letter-spacing:0;
}
.card .brain-panel textarea.sp-edit{
  width:100%;box-sizing:border-box;margin:0;padding:14px 16px;font-size:12.5px;line-height:1.6;
  white-space:pre-wrap;min-height:200px;max-height:420px;resize:vertical;
  background:#fff;color:#222;font-family:var(--mono);border:none;outline:none;display:block;
}
.card .brain-panel .sp-actions{
  display:flex;align-items:center;gap:10px;padding:10px 14px;background:#f5f5f5;border-top:1px solid #ddd;
}
.card .brain-panel .sp-save{
  font-size:12px;font-weight:700;padding:7px 14px;border-radius:6px;border:1px solid #3a8f5a;
  background:#19a463;color:#fff;cursor:pointer;
}
.card .brain-panel .sp-save:hover{background:#15945a}
.card .brain-panel .sp-status{font-size:11px;color:#9aa6b2;font-family:var(--mono)}
.card .brain-panel .sp-note{padding:10px 14px;font-size:11px;color:#555;background:#f5f5f5;border-top:1px solid #ddd}

/* ── step timeline ── */
.card .timeline{
  margin-top:16px;border-radius:10px;border:1px solid #e8e8e8;
  overflow:hidden;background:#fafbfc;
}
.card .timeline summary{
  cursor:pointer;padding:10px 14px;font-size:11px;font-weight:700;
  color:#555;user-select:none;display:flex;align-items:center;gap:8px;
  border-bottom:1px solid #e8e8e8;background:#f4f5f7;
}
.card .timeline summary:hover{color:#0a0a0a}

/* step chips row */
.card .step-chips{
  display:flex;flex-wrap:wrap;gap:6px;padding:12px 14px;
  border-bottom:1px solid #e8e8e8;background:#fff;
}
.card .step-chip{
  display:inline-flex;align-items:center;gap:5px;
  padding:5px 11px;border-radius:99px;font-size:12px;font-weight:600;
  color:#0a0a0a;border:1px solid rgba(0,0,0,.08);background:#fff;
  box-shadow:0 1px 2px rgba(0,0,0,.04);cursor:default;transition:transform .08s;
}
.card .step-chip:hover{transform:translateY(-1px);box-shadow:0 2px 4px rgba(0,0,0,.08)}
.card .step-chip .chip-dot{width:7px;height:7px;border-radius:50%;display:inline-block}
.card .step-chip .chip-key{font-family:var(--mono);font-size:11px;font-weight:700}
.card .step-chip .chip-actor{font-size:10px;opacity:.7}

/* step details */
.card .step-detail{
  border-top:1px solid #e8e8e8;padding:12px 14px;background:#fff;
}
.card .step-detail:first-child{border-top:none}
.card .step-detail .dline{
  display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px;
}
.card .step-detail .dlabel{
  font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#999;
  margin-bottom:4px;
}
.card .step-detail pre{
  margin:0;padding:10px 12px;font-size:12px;line-height:1.5;
  white-space:pre-wrap;overflow-wrap:anywhere;max-height:200px;overflow:auto;
  background:#f8f9fa;border:1px solid #e8e8e8;border-radius:6px;font-family:var(--mono);color:#0a0a0a;
}

/* status dot */
.status-dot{width:8px;height:8px;border-radius:50%;display:inline-block}
.status-dot.ok{background:#19a463}
.status-dot.fail{background:#d93025}
.status-dot.warn{background:#f9ab00}
.status-dot.neutral{background:#999}

/* routed arrow */
.routed-arrow{font-size:12px;font-weight:600;color:#555;background:#f0f0f0;padding:2px 10px;border-radius:99px;display:inline-flex;align-items:center;gap:4px}

/* missing ledger chrome */
.id-pill{font-family:var(--mono);font-size:11px;color:#4a5568;background:#edf2f7;border:1px solid #e2e8f0;border-radius:99px;padding:3px 10px;display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.id-copy{cursor:pointer;opacity:.7;transition:opacity .1s}
.id-copy:hover{opacity:1}
.copy-btn{font-size:11px;padding:5px 10px;border-radius:6px;border:1px solid #e2e8f0;background:#fff;cursor:pointer;color:#4a5568}
.copy-btn:hover{background:#f7fafc;border-color:#cbd5e0}
.cat-chip{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#fff;padding:3px 8px;border-radius:99px;white-space:nowrap}
.src-chip{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#0a0a0a;padding:3px 8px;border-radius:99px;border:1px solid rgba(0,0,0,.08);background:#fff}
.json-viewer{border:1px solid #e8e8e8;border-radius:10px;overflow:hidden;background:#fafbfc}
.jv-bar{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#f4f5f7;border-bottom:1px solid #e8e8e8;font-size:12px;font-weight:700;color:#555}
.jv-type{font-family:var(--mono);font-size:11px;font-weight:500;color:#888}
.json-viewer pre{margin:0;padding:14px;font-size:12px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere;max-height:400px;overflow:auto;background:#fff}
.term-cell{display:flex;align-items:flex-start;gap:8px;min-width:220px}
.term-cmd{font-family:var(--mono);font-size:10px;line-height:1.45;white-space:pre-wrap;word-break:break-all;color:#0a0a0a;background:#f4f5f7;border:1px solid #e2e8f0;border-radius:6px;padding:6px 8px;flex:1}
.mono-id{font-family:var(--mono);font-size:10px;color:#555}
.term-bar{margin-bottom:12px}

/* ── museum raw chrome (every payload preserved + inspectable) ── */
.sz{display:inline-block;font-family:var(--mono);font-size:9px;color:#555;background:#f0f0f0;padding:1px 5px;border-radius:3px;margin-left:6px}
.r2-tag{display:inline-block;background:#ffe8b3;color:#5a4a1a;padding:1px 5px;border-radius:3px;font-size:9px;font-weight:700;margin-left:6px}
.id-link{color:#0a52d0;text-decoration:none;font-weight:600;font-family:var(--mono);font-size:11px}
.id-link:hover{text-decoration:underline}
.rawmeta{padding:4px 0 6px}

/* ── self-explaining query panel ── */
.qhelp{border:1px solid var(--line);border-radius:10px;background:#fff;color:#000;margin-bottom:14px;overflow:hidden}
.qhelp>summary{cursor:pointer;padding:10px 14px;font-size:12px;font-weight:800;letter-spacing:.04em;color:#000;list-style:none}
.qhelp>summary::-webkit-details-marker{display:none}
.qrow{display:flex;align-items:center;gap:10px;padding:5px 14px;font-size:12px;border-top:1px solid #ddd;flex-wrap:wrap}
.qmethod{font-family:var(--mono);font-size:10px;font-weight:800;padding:2px 7px;border-radius:4px}
.qmethod.get{background:#19a463;color:#fff}
.qpath{font-family:var(--mono);font-size:11px;color:#000;word-break:break-all}
.qnote{font-size:11px;color:#555}

/* ── SYNC strip — the four corners, in unison ── */
.sync-strip{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px;padding:10px 16px;border-radius:12px;border:1px solid var(--line);background:linear-gradient(135deg,#fafbfd 0%,#f4f7fb 100%);box-shadow:0 1px 2px rgba(0,0,0,.03)}
.sy-title{font-size:10px;font-weight:900;letter-spacing:.14em;color:#8a94a3}
.sy-corner{display:inline-flex;align-items:center;gap:7px;padding:5px 12px;border-radius:99px;background:#fff;border:1px solid var(--line);box-shadow:0 1px 2px rgba(0,0,0,.04)}
.sy-dot{width:9px;height:9px;border-radius:50%;flex:0 0 9px}
.sy-dot.green{background:#19a463;box-shadow:0 0 0 3px #19a46322,0 0 8px #19a46366;animation:sy-pulse 2.4s ease-in-out infinite}
.sy-dot.amber{background:#f9ab00;box-shadow:0 0 0 3px #f9ab0022}
.sy-dot.red{background:#d93025;box-shadow:0 0 0 3px #d9302522}
@keyframes sy-pulse{0%,100%{box-shadow:0 0 0 3px #19a46322,0 0 6px #19a46344}50%{box-shadow:0 0 0 4px #19a46333,0 0 12px #19a46388}}
.sy-name{font-size:12px;font-weight:700;color:#0a0a0a}
.sy-age{font-size:10px;color:#8a94a3;font-family:var(--mono)}
.sy-link{color:#c8cdd3;font-size:13px}
.sy-note{margin-left:auto;font-size:10px;color:#a8b0bc;font-style:italic}

/* ── filter #1: big chronology / turns switch ── */
.view-switch{display:flex;gap:12px;margin-bottom:16px;position:sticky;top:94px;z-index:8;background:#fff;padding:10px 0;box-shadow:0 6px 10px -8px rgba(0,0,0,.25)}
.vbig{flex:1;display:flex;flex-direction:column;align-items:flex-start;gap:3px;padding:15px 22px;border-radius:12px;border:2px solid var(--line-strong);background:#fff;cursor:pointer;transition:border-color .12s,background .12s;text-align:left}
.vbig:hover{border-color:#0a52d0}
.vbig.on{background:#0a0a0a;border-color:#0a0a0a}
.vbig .vt{font-size:18px;font-weight:800;letter-spacing:.02em;color:#0a0a0a}
.vbig.on .vt{color:#fff}
.vbig .vsub{font-size:12px;font-weight:600;color:var(--muted)}
.vbig.on .vsub{color:#c8c8c8}

/* ── raw payloads inside a card ── */
.raw-payloads{margin-top:12px;border:1px solid #e8e8e8;border-radius:10px;overflow:hidden;background:#fafbfc}
.raw-payloads>summary{cursor:pointer;padding:10px 14px;font-size:11px;font-weight:800;letter-spacing:.06em;color:#555;background:#f4f5f7;border-bottom:1px solid #e8e8e8;list-style:none}
.raw-payloads>summary::-webkit-details-marker{display:none}
.raw-payloads .rp-item{padding:10px 14px;border-bottom:1px solid #eee}
.raw-payloads .rp-key{font-family:var(--mono);font-size:11px;font-weight:700;color:#0a0a0a;margin-bottom:4px}
.raw-payloads .dlabel{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#999;margin:6px 0 2px}
.raw-payloads pre{margin:0;padding:8px 10px;font-size:11px;line-height:1.4;white-space:pre-wrap;overflow-wrap:anywhere;max-height:220px;overflow:auto;background:#fff;border:1px solid #eee;border-radius:5px;font-family:var(--mono);color:#0a0a0a}
.raw-payloads .rp-term{display:flex;gap:6px;align-items:flex-start;margin-top:6px}

/* ── WHAT HAPPENED — per-turn trace sequence ── */
.what-happened{margin-top:14px;border:1px solid #e3e8ef;border-radius:10px;overflow:hidden;background:#fff}
.what-happened>summary{cursor:pointer;padding:10px 14px;font-size:11px;font-weight:800;letter-spacing:.06em;color:#0a0a0a;background:#eef2f7;border-bottom:1px solid #e3e8ef;list-style:none}
.what-happened>summary::-webkit-details-marker{display:none}
.wh-step{display:flex;gap:12px;padding:11px 14px;border-bottom:1px solid #f2f2f2}
.wh-step:last-child{border-bottom:none}
.wh-n{flex:0 0 22px;height:22px;border-radius:50%;background:#0a0a0a;color:#fff;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;font-family:var(--mono)}
.wh-body{flex:1;min-width:0}
.wh-line{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.wh-svc{font-size:10px;font-weight:700;padding:2px 8px;border-radius:99px;border:1px solid;color:#0a0a0a}
.wh-key{font-family:var(--mono);font-size:12px;font-weight:700;color:#0a0a0a}
.wh-status{font-size:10px;font-weight:700;padding:1px 7px;border-radius:99px;font-family:var(--mono)}
.wh-status.ok{background:#e7f6ee;color:#0f7a3d}
.wh-status.fail{background:#fdeaea;color:#c0392b}
.wh-time{font-size:10px;color:#999;font-family:var(--mono);margin-left:auto}
.wh-what{font-size:13px;color:#444;margin-top:3px}
.wh-raw{margin-top:6px}
.wh-raw>summary{cursor:pointer;font-size:10px;font-weight:700;color:#0a52d0;text-transform:uppercase;letter-spacing:.04em}
.wh-raw pre{margin:4px 0;padding:8px 10px;font-size:11px;white-space:pre-wrap;overflow-wrap:anywhere;max-height:200px;overflow:auto;background:#f8f9fa;border:1px solid #eee;border-radius:5px;font-family:var(--mono);color:#0a0a0a}
.wh-raw .dlabel{font-size:9px;font-weight:700;text-transform:uppercase;color:#999;margin-top:4px}
.wh-raw .rp-term{display:flex;gap:6px;align-items:flex-start;margin-top:6px}

/* Ledger is one dark admin surface. Historical light-theme declarations above
   are normalized here through the shared admin design tokens. */
.sync-strip,.query-panel,.view-switch,.vbig,.card,.card .head,.card .hero-box,
.card .timeline,.card .step-chips,.card .step-detail,.card .agent-section,
.raw-payloads,.raw-payloads>summary,.raw-payloads .rp-item,.what-happened,
.what-happened>summary,.wh-step,.convene-panel,.cv-note,.json-viewer,.jv-bar{
  background:var(--panel);border-color:var(--line);color:var(--ink)
}
.sync-strip{background:linear-gradient(135deg,var(--panel),var(--raised));box-shadow:none}
.sy-corner,.svc-filter,.dl-seg .dl-f,.dl-n,.dl-llm-btn,.viewtog button,
.copy-btn,.src-chip{background:var(--raised);border-color:var(--line-strong);color:var(--ink-soft);box-shadow:none}
.sy-name,.vbig .vt,.card .head .cid,.card .head .cat-badge,
.card .hero-box .hmsg,.card .step-chip,.card .step-detail pre,
.raw-payloads .rp-key,.raw-payloads pre,.what-happened>summary,.wh-key,
.wh-svc,.preview,.cell-text.you,.term-cmd,.json-viewer pre{color:var(--ink)}
.sy-title,.sy-age,.sy-note,.vbig .vsub,.card .head .when,.card .head .chash,
.card .timeline summary,.card .step-detail .dlabel,.raw-payloads>summary,
.raw-payloads .dlabel,.wh-time,.wh-raw .dlabel,.cell-text.did,
#events-table .col-time,.mono-id,.sz,.jv-bar,.jv-type{color:var(--muted)}
.sy-link,.trace-link,.id-link,.wh-raw>summary{color:var(--accent)}
.view-switch{top:120px;padding:10px 0;border:0;box-shadow:0 8px 16px -14px #000}
.vbig{border-width:1px}.vbig:hover{border-color:var(--accent)}
.vbig.on,.svc-filter.on,.viewtog button.on,.dl-seg .dl-f.on{
  background:var(--accent)!important;border-color:var(--accent)!important;color:#fff!important
}
.vbig.on .vt,.vbig.on .vsub,.svc-filter.on,.viewtog button.on,.dl-seg .dl-f.on{color:#fff!important}
.query-row input,.query-row select{background:var(--raised);border-color:var(--line-strong);color:var(--ink)}
.query-row input::placeholder{color:var(--muted)}
.card{box-shadow:none}.card:hover{box-shadow:0 14px 40px rgba(0,0,0,.18)}
.card .head{background:linear-gradient(180deg,var(--raised),var(--panel));border-bottom-color:var(--line)}
.card .head .cid,.card .head .chash,.routed-arrow,.id-pill,.sz{background:var(--raised);border-color:var(--line)}
.card .head .src-badge{background:var(--bg);color:var(--ink)}
.card .body{background:var(--panel)}
.card .hero-box{box-shadow:none}.card .hero-box .hbar{background:var(--raised);border-color:var(--line)}
.card .hero-box.out .hmsg,.cell-text.agent{background:rgba(25,164,99,.08);color:var(--ink)}
.card .timeline summary,.card .step-chips,.card .step-detail{border-color:var(--line)}
.card .step-chip{background:var(--raised);border-color:var(--line);box-shadow:none}
.card .step-detail pre,.raw-payloads pre,.wh-raw pre,.term-cmd,.json-viewer pre{
  background:var(--bg);border-color:var(--line)
}
.raw-payloads>summary,.what-happened>summary,.jv-bar{background:var(--raised);border-color:var(--line)}
.raw-payloads .rp-item,.wh-step{border-color:var(--line)}
.what-happened,.raw-payloads{background:var(--panel);border-color:var(--line)}
.wh-what{color:var(--ink-soft)}.wh-n{background:var(--accent);color:#fff}
.routed-arrow,.id-pill{color:var(--ink-soft)}
.svc-chip,.cat-chip,.src-chip{border-color:rgba(255,255,255,.12)}
.ev-row.ev-fail{background:rgba(217,48,37,.08)}.ev-row.ev-fail:hover{background:rgba(217,48,37,.12)}
.ev-row:hover{background:var(--raised)}.raw-fold pre{background:var(--raised);color:var(--ink-soft)}
.convene-panel{border-color:var(--line-strong)}.cv-q{background:var(--raised);color:var(--ink)}
.cv-body{color:var(--ink)}.cv-note{border-color:var(--line)}
#events-table th{background:var(--raised)}
@media(max-width:760px){.view-switch{top:164px;gap:8px}.vbig{padding:12px}.vbig .vt{font-size:14px}}
</style>

${ssrBanner}

${syncStripHtml(ssr.sync)}

<details class="qhelp"><summary>🔍 How to query this ledger — cards (turns) + raw events (chronology)</summary>
<div class="qrow"><span class="qmethod get">GET</span><span class="qpath">/admin/ledger?cards=1&amp;limit=20</span><span class="qnote">latest state cards — I said / you said / you did</span></div>
<div class="qrow"><span class="qmethod get">GET</span><span class="qpath">/admin/ledger?cards=1&amp;card_id=t_xxxx</span><span class="qnote">one turn card by trace ID</span></div>
<div class="qrow"><span class="qmethod get">GET</span><span class="qpath">/admin/ledger?data=1&amp;limit=100</span><span class="qnote">raw events, chronological — every payload in</span></div>
<div class="qrow"><span class="qmethod get">GET</span><span class="qpath">/admin/ledger?data=1&amp;trace_id=t_xxxx</span><span class="qnote">every raw action for one turn</span></div>
<div class="qrow"><span class="qmethod get">GET</span><span class="qpath">/admin/ledger/&lt;id&gt;?data=1</span><span class="qnote">one event, full raw — rehydrated from R2 if offloaded</span></div>
<div class="qrow"><span class="qmethod get">GET</span><span class="qpath">/admin/ledger?export=1&amp;view=turns&amp;format=md</span><span class="qnote">download the whole history</span></div>
<div class="qrow"><span class="qmethod get">GET</span><a class="qpath" href="/admin/ledger?voxels=1&amp;html=1" style="text-decoration:underline">/admin/ledger?voxels=1&amp;html=1</a><span class="qnote">⬡ the build's own architecture as a derived voxel graph — orphans · fragile · hot · edges</span></div>
<div class="qrow"><span class="qmethod get">GET</span><a class="qpath" href="/admin/ledger?forum=1" style="text-decoration:underline">/admin/ledger?forum=1</a><span class="qnote">coding-agent forum — threaded render over agent_turns, not a fourth store</span></div>
</details>

<div class="view-switch">
  <button type="button" id="v-chronology" class="vbig"><span class="vt">CHRONOLOGY</span><span class="vsub">every raw payload — museum</span></button>
  <button type="button" id="v-turns" class="vbig"><span class="vt">TURNS</span><span class="vsub">I said · you said · you used</span></button>
  <a href="/admin/ledger?forum=1" class="vbig" style="text-decoration:none"><span class="vt">FORUM</span><span class="vsub">agent governance · ledger-derived</span></a>
</div>
<div class="query-panel">
  <div class="dl-compact">
    <span class="dl-label">download</span>
    <span class="dl-seg"><button type="button" class="dl-f on" data-fmt="md">MD</button><button type="button" class="dl-f" data-fmt="json">JSON</button></span>
    <span class="dl-counts"><a class="dl-n" id="dln-5" data-n="5">5</a><a class="dl-n" id="dln-10" data-n="10">10</a><a class="dl-n" id="dln-100" data-n="100">100</a><a class="dl-n" id="dln-all" data-n="2000">all</a></span>
    <button type="button" class="dl-llm-btn" id="dl-llm" title="§SELF bundle for this view — paste into any model">Copy for LLM</button>
    <button type="button" class="dl-llm-btn" id="dl-convene" title="Fan this view to a congress of models — GPT · Gemini · Kimi · Claude — each an independent, ledgered voice">Convene ⚖</button>
  </div>
  <div class="service-bar" id="service-bar">
    <span class="svc-label">service</span>${serviceBarHtml}
  </div>
  <div class="query-row">
    <span class="grp">KEY <input id="f-key" list="lkeys" placeholder="KEY" onchange="updateTermBar()" oninput="updateTermBar()"></span>
    <datalist id="lkeys">${keyDatalistHtml}</datalist>
    <span class="grp">SEARCH <input id="f-q" placeholder="text or trace id" onchange="updateTermBar()" oninput="updateTermBar()"></span>
    <select id="f-limit" onchange="updateTermBar()">
      <option>40</option><option selected>100</option><option>200</option><option>500</option>
    </select>
    <label style="font-size:11px;font-weight:600;color:var(--muted)"><input type="checkbox" id="f-hide-noise" checked> hide cron</label>
    <button type="button" id="btn-refresh">Refresh</button>
  </div>
  <div class="curl-block term-bar expanded" id="term-bar">
    <div class="curl-bar"><span>terminal</span><button type="button" class="copy-btn" onclick="copyTermBar(this)">copy</button></div>
    <pre id="term-cmd">${esc(initialTermCmd)}</pre>
  </div>
</div>

<div id="convene-host"></div>

<table id="events-table">
<thead><tr>
  <th class="col-time">logged at <span class="tz">~ PST</span></th><th class="col-svc">service</th>
  <th class="col-you">you said</th><th class="col-agent">agent said</th><th class="col-did">agent did</th>
  <th class="col-trace">trace</th>
</tr></thead>
<tbody id="rows">${ssrEventRows}</tbody>
</table>
<div id="cards" style="display:none">${ssrCardPreview}</div>

<script>
const ORIGIN = ${JSON.stringify(origin)};
const INITIAL_SERVICE = ${JSON.stringify(initialService)};
const INITIAL_SOURCE = ${JSON.stringify(initialSource)};
const INITIAL_KEY    = ${JSON.stringify(initialKey)};
const INITIAL_TRACE  = ${JSON.stringify(initialTrace)};
const INITIAL_HIDE_NOISE = ${initialHideNoise ? 'true' : 'false'};
const SERVICE_COLOR = ${JSON.stringify(SERVICE_COLOR)};
const CAT_COLOR   = ${JSON.stringify(CAT_COLOR)};
const GROUP_COLOR = ${JSON.stringify(GROUP_COLOR)};

let SERVICE = INITIAL_SERVICE || '';

function curlGet(path) {
  return 'curl -s "' + ORIGIN + path + '" -H "x-terminal-key: $TERMINAL_KEY"';
}
function copyTermBar(btn) {
  var pre = document.getElementById('term-cmd');
  if (pre) copyText(pre.textContent, btn);
}
function applySearch(qs) {
  var s = document.getElementById('f-q').value.trim();
  if (!s) return;
  if (/^(t|gc|at|cc|gh|task)_|^gh-\d+$/.test(s)) qs.set('trace_id', s);
  else qs.set('q', s);
}
function bundleUrl() {
  var qs = new URLSearchParams();
  qs.set('bundle', '1');
  qs.set('view', VIEW === 'turns' ? 'turns' : 'chronology');
  if (SERVICE) qs.set('service', SERVICE);
  var k = document.getElementById('f-key').value; if (k) qs.set('key', k);
  var s = document.getElementById('f-q').value.trim(); if (s) qs.set('q', s);
  qs.set('limit', document.getElementById('f-limit').value);
  return '/admin/ledger?' + qs.toString();
}
function copyForLlm(btn) {
  var orig = btn.textContent;
  btn.textContent = 'loading…';
  fetch(bundleUrl(), { credentials: 'same-origin' })
    .then(function(r){ return r.text(); })
    .then(function(t){
      return navigator.clipboard.writeText(t).then(function(){
        btn.textContent = 'Copied ' + (t.length / 1000).toFixed(1) + 'k for LLM';
        setTimeout(function(){ btn.textContent = orig; }, 2200);
      });
    })
    .catch(function(){ btn.textContent = 'copy failed'; setTimeout(function(){ btn.textContent = orig; }, 2200); });
}
function conveneUrl() {
  var qs = new URLSearchParams();
  qs.set('convene', '1');
  qs.set('view', VIEW === 'turns' ? 'turns' : 'chronology');
  if (SERVICE) qs.set('service', SERVICE);
  return '/admin/ledger?' + qs.toString();
}
function convene(btn) {
  var host = document.getElementById('convene-host');
  var orig = btn.textContent;
  btn.textContent = 'convening…'; btn.disabled = true;
  if (host) { host.innerHTML = '<p class="empty">the congress is deliberating — GPT · Gemini · Kimi · Claude…</p>'; host.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  fetch(conveneUrl(), { credentials: 'same-origin' })
    .then(function(r){ return r.text(); })
    .then(function(t){ if (host) host.innerHTML = t; })
    .catch(function(e){ if (host) host.innerHTML = '<p class="empty">convene failed: ' + e + '</p>'; })
    .finally(function(){ btn.textContent = orig; btn.disabled = false; });
}
function exportUrl(format, n) {
  var qs = new URLSearchParams();
  qs.set('export', '1');
  qs.set('format', format);
  qs.set('view', VIEW === 'turns' ? 'turns' : 'chronology');
  if (SERVICE) qs.set('service', SERVICE);
  var k = document.getElementById('f-key').value;    if (k) qs.set('key', k);
  applySearch(qs);
  var hide = document.getElementById('f-hide-noise');
  if (hide && !hide.checked) qs.set('hide_noise', '0');
  qs.set('limit', String(n || document.getElementById('f-limit').value));
  return '/admin/ledger?' + qs.toString();
}
var DLFMT = 'md';
function updateDownloadLinks() {
  var counts = { '5': 'dln-5', '10': 'dln-10', '100': 'dln-100', '2000': 'dln-all' };
  Object.keys(counts).forEach(function(n){
    var a = document.getElementById(counts[n]);
    if (a) a.href = exportUrl(DLFMT, n);
  });
  document.querySelectorAll('.dl-f').forEach(function(b){
    b.className = 'dl-f' + (b.getAttribute('data-fmt') === DLFMT ? ' on' : '');
  });
}
function updateTermBar() {
  var pre = document.getElementById('term-cmd');
  if (!pre) return;
  pre.textContent = curlGet(VIEW === 'turns' ? cardsUrl() : buildUrl());
  updateDownloadLinks();
}
function termCell(id) {
  var cmd = curlGet('/admin/ledger/' + encodeURIComponent(id) + '?data=1');
  return '<td class="term-cell"><button type="button" class="copy-btn" onclick="copyText(' + JSON.stringify(cmd) + ', this)">copy</button><code class="term-cmd">' + e(cmd) + '</code></td>';
}

function e(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function catColor(c){ return CAT_COLOR[c] || '#dedede'; }
function grpColor(g){ return GROUP_COLOR[g] || '#cccccc'; }

/* ── copy helpers ── */
function copyText(text, btn) {
  function mark() { if (btn) { btn.textContent = '✓'; setTimeout(function(){ btn.textContent = '📋'; }, 1200); } }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(mark);
  } else {
    var ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta); mark();
  }
}
// edit the failing agent's system prompt right here -> PATCH the directory row (content only).
function savePrompt(btn) {
  var panel = btn.closest('.brain-panel');
  var ta = panel.querySelector('.sp-edit');
  var status = panel.querySelector('.sp-status');
  var agent = ta.getAttribute('data-agent');
  if (!agent) { status.textContent = 'no agent key on this card'; return; }
  status.textContent = 'saving…'; btn.disabled = true;
  fetch('/api/directory/' + encodeURIComponent(agent), {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ content: ta.value })
  }).then(function(r){ return r.json(); }).then(function(d){
    status.textContent = (d && d.ok) ? ('saved ✓ ' + (d.updated_at || '') + ' — live on next turn') : ('error: ' + JSON.stringify(d));
    btn.disabled = false;
  }).catch(function(e){ status.textContent = 'error: ' + e; btn.disabled = false; });
}
function copyCardJson(btn) {
  var raw = btn.getAttribute('data-json');
  if (!raw) return;
  try { copyText(JSON.stringify(JSON.parse(raw), null, 2)); }
  catch (e) { copyText(raw); }
  btn.textContent = '✓ copied'; btn.classList.add('ok');
  setTimeout(function(){ btn.textContent = '📋 copy JSON'; btn.classList.remove('ok'); }, 1200);
}

const SRC_COLOR = { grok:'#ff7bd1', blooio:'#9dffb0', stripe:'#a3ffb0', dispatch:'#dedede', meta:'#ffd479', github:'#d4d4d4', 'claude-code':'#f4a09c', 'grok-cli':'#ff9ad6' };
function srcStyle(src){ return 'background:' + (SRC_COLOR[src] || '#dedede'); }
function srcBg(src){ return SRC_COLOR[src] || '#dedede'; }

let VIEW = 'chronology';
let SIG_E = '', SIG_C = '';

function normView(v) {
  if (v === 'cards' || v === 'turns') return 'turns';
  return 'chronology';
}

function setView(v, refresh) {
  VIEW = normView(v);
  document.getElementById('events-table').style.display = VIEW === 'chronology' ? '' : 'none';
  document.getElementById('cards').style.display = VIEW === 'turns' ? '' : 'none';
  document.getElementById('v-chronology').className = 'vbig' + (VIEW === 'chronology' ? ' on' : '');
  document.getElementById('v-turns').className = 'vbig' + (VIEW === 'turns' ? ' on' : '');
  updateTermBar();
  if (refresh) reload(true);
}
function pickService(svc) {
  SERVICE = svc || '';
  document.querySelectorAll('.svc-filter').forEach(function(el) {
    el.className = 'svc-filter' + ((el.getAttribute('data-svc') || '') === SERVICE ? ' on' : '');
  });
  reload(true);
}
function reload(show) {
  updateTermBar();
  VIEW === 'turns' ? loadCards(show) : loadLedger(show);
}

async function loadServiceBar() {
  const data = await fetch('/admin/ledger?services=1', { credentials: 'same-origin' }).then(function(r) { return r.json(); }).catch(function() { return { services: [] }; });
  const host = document.getElementById('service-bar');
  if (!host) return;
  const chips = data.services || [];
  var html = '<span class="svc-label">service</span>';
  html += chips.map(function(c) {
    var on = SERVICE === (c.id || '') ? ' on' : '';
    var col = svcColor(c.label === 'other' ? 'other' : c.label);
    return '<button type="button" class="svc-filter' + on + '" data-svc="' + e(c.id || '') + '">' +
      e(c.label) + '<span class="svc-n">' + e(String(c.count || 0)) + '</span></button>';
  }).join('');
  host.innerHTML = html;
  host.querySelectorAll('.svc-filter').forEach(function(el) {
    el.addEventListener('click', function() { pickService(el.getAttribute('data-svc') || ''); });
  });
}

async function loadKeys() {
  const data = await fetch('/admin/ledger?keys=1', { credentials: 'same-origin' }).then(function(r) { return r.json(); }).catch(function() { return { keys: [] }; });
  const dl = document.getElementById('lkeys');
  if (!dl) return;
  dl.innerHTML = (data.keys || []).map(function(r) { return '<option value="' + e(r.key) + '">'; }).join('');
}

function buildUrl() {
  const qs = new URLSearchParams();
  qs.set('data', '1');
  if (SERVICE) qs.set('service', SERVICE);
  const k = document.getElementById('f-key').value;    if (k) qs.set('key', k);
  applySearch(qs);
  const hide = document.getElementById('f-hide-noise');
  if (hide && !hide.checked) qs.set('hide_noise', '0');
  qs.set('limit', document.getElementById('f-limit').value);
  return '/admin/ledger?' + qs.toString();
}

function svcColor(svc) { return SERVICE_COLOR[svc] || '#dedede'; }
function evRowHtml(row) {
  const svc = row.service || row.source || '';
  const col = svcColor(svc);
  const trace = row.trace_id
    ? '<a class="trace-link" href="/admin/ledger?trace_id=' + encodeURIComponent(row.trace_id) + '">' + e(row.trace_id) + '</a>' + (row.step != null ? '<span class="step-n">·' + e(row.step) + '</span>' : '')
    : '';
  const reqR2 = row.r2_request_key ? '<span class="r2-tag">R2</span>' : '';
  const resR2 = row.r2_response_key ? '<span class="r2-tag">R2</span>' : '';
  const reqSz = row.request_size > 0 ? '<span class="sz">' + e(row.request_size) + 'b</span>' : '';
  const resSz = row.response_size > 0 ? '<span class="sz">' + e(row.response_size) + 'b</span>' : '';
  const full = row.id ? '<div class="rawmeta"><a class="id-link" href="/admin/ledger/' + encodeURIComponent(row.id) + '?data=1" target="_blank" rel="noopener">full raw ↗</a></div>' : '';
  const raw = (row.request_preview || row.response_preview || row.r2_request_key || row.r2_response_key)
    ? '<details class="raw-fold"><summary>raw' + reqSz + reqR2 + resSz + resR2 + '</summary>' + full + '<pre>' + e('req: ' + (row.request_preview || '(offloaded to R2 — open full raw)') + '\\n---\\nres: ' + (row.response_preview || '(offloaded to R2 — open full raw)')) + '</pre></details>'
    : '';
  const dot = row.status == null ? 'neutral' : (row.status >= 200 && row.status < 400 ? 'ok' : 'fail');
  return '<tr class="ev-row' + (dot === 'fail' ? ' ev-fail' : '') + '">' +
    '<td class="col-time"><span class="ev-dot ' + dot + '"></span>' + e(row.time_short || row.ts) + '</td>' +
    '<td class="col-svc"><span class="svc-chip" style="background:' + col + '">' + e(svc) + '</span></td>' +
    '<td class="col-you"><div class="cell-text you">' + (row.you_said ? e(row.you_said) : '<span class="dim">—</span>') + '</div></td>' +
    '<td class="col-agent"><div class="cell-text agent">' + (row.agent_said ? e(row.agent_said) : '<span class="dim">—</span>') + '</div></td>' +
    '<td class="col-did"><div class="cell-text did">' + e(row.agent_did || '—') + raw + '</div></td>' +
    '<td class="col-trace">' + trace + '</td>' +
  '</tr>';
}

function cardsUrl() {
  const qs = new URLSearchParams();
  qs.set('cards', '1');
  if (SERVICE) qs.set('service', SERVICE);
  const k = document.getElementById('f-key').value;
  const s = document.getElementById('f-q').value.trim();
  if (s && /^(t|gc|at|cc|gh|task)_|^gh-\d+$/.test(s)) { qs.set('trace_id', s); if (k) qs.set('q', k); }
  else if (k && s) qs.set('q', k + ' ' + s);
  else if (k) qs.set('q', k);
  else if (s) qs.set('q', s);
  const hide = document.getElementById('f-hide-noise');
  if (hide && !hide.checked) qs.set('hide_noise', '0');
  qs.set('limit', document.getElementById('f-limit').value);
  return '/admin/ledger?' + qs.toString();
}

// icon for a step key
function stepIcon(key) {
  const k = String(key || '').toUpperCase();
  if (k === 'BASH' || k === 'SHELL') return '💻';
  if (k === 'EDIT' || k === 'WRITE') return '✏️';
  if (k === 'READ') return '📖';
  if (k === 'FILE_EDIT') return '📝';
  if (k === 'ROUTER') return '🧠';
  if (k.indexOf('ASK_') === 0) return '🤖';
  if (k.indexOf('WRANGLER') === 0) return '☁️';
  if (k.indexOf('GH_') === 0) return '🐙';
  if (k.indexOf('GAPI') === 0) return '📊';
  if (k.indexOf('CF') === 0) return '⚡';
  if (k.indexOf('DEPLOY') >= 0) return '🚀';
  return '⚙️';
}

function stepChip(x) {
  const col = catColor(x.category);
  const icon = stepIcon(x.key);
  const statusDot = x.status == null ? '' : (x.status >= 200 && x.status < 300 ? '' : '<span class="status-dot fail" style="width:6px;height:6px"></span>');
  return '<span class="step-chip" style="border-color:' + col + '33;background:' + col + '14">' +
    '<span class="chip-dot" style="background:' + col + '"></span>' +
    icon + ' <span class="chip-key">' + e(x.key || '') + '</span>' +
    (x.actor ? '<span class="chip-actor">' + e(x.actor) + '</span>' : '') + statusDot +
  '</span>';
}

function evHtml(x) {
  const col = catColor(x.category);
  const icon = stepIcon(x.key);
  const statusDot = x.status == null ? '<span class="status-dot neutral"></span>' : (x.status >= 200 && x.status < 300 ? '<span class="status-dot ok"></span>' : '<span class="status-dot fail"></span>');
  const rawIn  = x.request  ? '<div class="dlabel">raw request</div><pre>' + e(x.request) + '</pre>' : '';
  const rawOut = x.response ? '<div class="dlabel">raw response</div><pre>' + e(x.response) + '</pre>' : '';
  const full = x.id ? '<div class="term-cell" style="margin-top:6px"><button type="button" class="copy-btn" onclick="copyText(' + JSON.stringify(curlGet('/admin/ledger/' + encodeURIComponent(x.id) + '?data=1')) + ', this)">copy</button><code class="term-cmd">' + e(curlGet('/admin/ledger/' + encodeURIComponent(x.id) + '?data=1')) + '</code></div>' : '';
  return '<div class="step-detail">' +
    '<div class="dline">' + statusDot + ' ' +
      '<span class="cat-chip" style="background:' + col + '">' + e(x.category) + '</span>' +
      '<span class="chip-key" style="font-family:var(--mono);font-weight:700;font-size:12px">' + icon + ' ' + e(x.key || '') + '</span>' +
      '<span style="color:#888;font-size:12px">' + e(x.actor || '') + '</span>' +
      (x.status != null ? '<span style="font-size:11px;color:#888;font-family:var(--mono)">· HTTP ' + e(x.status) + '</span>' : '') +
    '</div>' + rawIn + rawOut + full + '</div>';
}

function hasSsrCards(el) {
  return el && el.querySelector('.card');
}

function toolsRowHtml(tools) {
  const list = (tools || []).filter(Boolean);
  if (!list.length) return '<div class="tools-row"><span class="tools-empty">—</span></div>';
  return '<div class="tools-row">' + list.map(function(t) {
    return '<span class="tool-chip">' + e(t) + '</span>';
  }).join('') + '</div>';
}

function cardHtml(c) {
  const svc = serviceLabelForCard(c);
  const col = svcColor(svc);
  const you = String(c.input || '').trim();
  const agent = String(c.output || '').trim();
  const ts = c.time_short || c.ts || '';
  const tools = c.tools_used || [];
  const traceHref = c.trace_id ? '/admin/ledger?trace_id=' + encodeURIComponent(c.trace_id) + '&view=turns' : '';
  const cardCmd = curlGet('/admin/ledger?cards=1&card_id=' + encodeURIComponent(c.card_id || ''));
  const chips = (c.events || []).slice(0, 12).map(stepChip).join('');
  const details = (c.events || []).map(evHtml).join('');
  const steps = (c.events || []).length
    ? '<details class="timeline"><summary><span style="font-size:13px">' + e(String(c.n_events || (c.events || []).length)) + ' steps</span></summary>' +
        (chips ? '<div class="step-chips">' + chips + '</div>' : '') + details + '</details>'
    : '';
  return '<div class="card" style="--card-accent:' + col + '">' +
    '<div class="head">' +
      '<span class="src-badge" style="background:' + col + ';color:#0a0a0a">' + e(svc) + '</span>' +
      (c.actor ? '<span class="cat-badge" style="background:' + catColor(c.category) + '22;border-color:' + catColor(c.category) + '66">' + e(c.actor) + '</span>' : '') +
      '<span class="cid">' + e(c.card_id || '') + '</span>' +
      (c.routed ? '<span class="routed-arrow">→ ' + e(c.routed) + '</span>' : '') +
      '<span class="when">' + e(ts) + '</span>' +
      (traceHref ? '<a class="trace-link" href="' + traceHref + '" style="margin-left:auto">trace</a>' : '') +
    '</div>' +
    '<div class="body">' +
      '<div class="hero-io">' +
        '<div class="hero-box in"><div class="hbar"><span class="hicon">👤</span> MY MESSAGE</div><div class="hmsg">' +
          (you ? e(you) : '<span style="color:#aaa">—</span>') + '</div></div>' +
        '<div class="hero-box out"><div class="hbar"><span class="hicon">🤖</span> YOUR REPLY</div><div class="hmsg">' +
          (agent ? e(agent) : '<span style="color:#aaa">—</span>') + '</div></div>' +
      '</div>' +
      '<div class="card-tools"><div class="tbar">🔧 TOOLS USED</div>' + toolsRowHtml(tools) + '</div>' +
      '<div class="curl-block" style="margin-top:12px"><div class="curl-bar"><span>terminal</span><button type="button" class="copy-btn" onclick="copyText(' + JSON.stringify(cardCmd) + ', this)">copy</button></div><pre>' + e(cardCmd) + '</pre></div>' +
      steps +
    '</div></div>';
}

function serviceLabelForCard(c) {
  const src = String(c.source || '');
  const key = String(c.routed || c.key || '');
  if (src === 'blooio') return 'blooio';
  if (src === 'grok-cli' || src === 'cli-grok') return 'grok-cli';
  if (src === 'grok') return 'grok API';
  if (src === 'claude-code' || src === 'cli-claude') return 'claude-cli';
  if (src.startsWith('cli-')) return src.slice(4) + ' CLI';
  if (src === 'dispatch' || src === '') return key && key !== 'ROUTER' ? key : (key === 'ROUTER' ? 'router' : 'build');
  return src || 'other';
}

async function loadCards(show) {
  const host = document.getElementById('cards');
  if (show && !hasSsrCards(host)) host.innerHTML = '<p class="empty">refreshing turns…</p>';
  // ONE renderer: fetch the server-rendered card HTML (same renderHeroLedgerCards as SSR) so the
  // TURNS view is byte-identical to the API surface — no second client renderer to drift out of sync.
  const html = await fetch(cardsUrl() + '&html=1', { credentials: 'same-origin' })
    .then(function(res) { return res.ok ? res.text() : '<p class="empty">HTTP ' + res.status + '</p>'; })
    .catch(function(err) { return '<p class="empty">' + e(String(err)) + '</p>'; });
  if (/class="empty"/.test(html) && hasSsrCards(host)) return;
  if (html === SIG_C) return;
  SIG_C = html;
  host.innerHTML = html;
}

function hasSsrRows(el) {
  return el && el.querySelector('tr td:not(.empty)');
}

async function loadLedger(show) {
  const body = document.getElementById('rows');
  if (show && !hasSsrRows(body)) body.innerHTML = '<tr><td colspan="6" class="empty">refreshing…</td></tr>';
  const r = await fetch(buildUrl(), { credentials: 'same-origin', headers: { accept: 'application/json' } })
    .then(async function(res) {
      if (!res.ok) return { rows: [], error: 'HTTP ' + res.status + ' ' + res.statusText };
      return res.json();
    })
    .catch(err => ({ rows: [], error: String(err) }));
  let html;
  if (r.error) {
    if (hasSsrRows(body)) return;
    html = '<tr><td colspan="6" class="empty">' + e(r.error) + '</td></tr>';
  } else {
    const rows = r.rows || [];
    if (!rows.length && hasSsrRows(body)) return;
    html = !rows.length ? '<tr><td colspan="6" class="empty">no events</td></tr>' : rows.map(evRowHtml).join('');
  }
  if (html === SIG_E) return;   // unchanged — skip repaint (no strobe)
  SIG_E = html; body.innerHTML = html;
}

document.getElementById('v-chronology').addEventListener('click', function(){ setView('chronology', true); });
document.getElementById('v-turns').addEventListener('click', function(){ setView('turns', true); });
document.getElementById('btn-refresh').addEventListener('click', function() { loadServiceBar(); loadKeys(); reload(true); });
document.getElementById('dl-llm').addEventListener('click', function() { copyForLlm(this); });
document.querySelectorAll('.dl-f').forEach(function(b){ b.addEventListener('click', function(){ DLFMT = b.getAttribute('data-fmt'); updateDownloadLinks(); }); });
document.getElementById('dl-convene').addEventListener('click', function() { convene(this); });
document.querySelectorAll('.svc-filter').forEach(function(el) {
  el.addEventListener('click', function() { pickService(el.getAttribute('data-svc') || ''); });
});
document.getElementById('f-hide-noise').addEventListener('change', function() { reload(true); });
document.getElementById('f-key').value    = INITIAL_KEY;
document.getElementById('f-q').value      = INITIAL_TRACE || (new URLSearchParams(location.search).get('q') || '');
if (document.getElementById('f-hide-noise')) document.getElementById('f-hide-noise').checked = INITIAL_HIDE_NOISE;
var BOOT = new URLSearchParams(location.search);
var BOOT_VIEW = BOOT.get('view') || 'chronology';
if (BOOT.get('service')) {
  SERVICE = BOOT.get('service');
  document.querySelectorAll('.svc-filter').forEach(function(el) {
    el.className = 'svc-filter' + ((el.getAttribute('data-svc') || '') === SERVICE ? ' on' : '');
  });
}
setView(BOOT_VIEW, false);
updateDownloadLinks();
SIG_E = document.getElementById('rows').innerHTML;
SIG_C = document.getElementById('cards').innerHTML;
loadKeys();
reload(false);
setInterval(function(){ var a = document.activeElement; if (a && a.tagName === 'INPUT') return; reload(false); }, 10000);
setInterval(function(){ loadServiceBar(); }, 60000);
async function loadSyncStrip() {
  try {
    var d = await fetch('/admin/ledger?synchealth=1', { credentials: 'same-origin' }).then(function(r){ return r.json(); });
    var host = document.getElementById('sync-strip');
    if (!host || !d.corners) return;
    function age(c){ if (c.id === 'cloudflare') return 'source of record'; if (c.age_s == null) return 'never'; if (c.age_s < 90) return 'just now'; if (c.age_s < 3600) return Math.round(c.age_s/60)+'m ago'; return Math.round(c.age_s/3600)+'h ago'; }
    host.innerHTML = '<span class="sy-title">SYNC</span>' + d.corners.map(function(c){
      return '<span class="sy-corner" title="' + e(c.label + ' · ' + age(c)) + '"><span class="sy-dot ' + e(c.state) + '"></span><span class="sy-name">' + e(c.label) + '</span><span class="sy-age">' + e(age(c)) + '</span></span>';
    }).join('<span class="sy-link">⟷</span>') + '<span class="sy-note">one build · four corners · no asymmetry</span>';
  } catch {}
}
setInterval(loadSyncStrip, 30000);
</script>
`;

  const activeHref = '/admin/ledger' + (initialSource ? '?source=' + initialSource : '');
  return new Response(shellHtml({ activeHref, title: 'Ledger', body }), {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store, no-cache, must-revalidate',
      'pragma': 'no-cache',
    },
  });
}
