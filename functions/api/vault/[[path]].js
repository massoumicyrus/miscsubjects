import { logEvent } from '../../_lib/event_log.js';
import { normalizeWidget, shortHash } from '../../_lib/vault_widgets.js';

const BASE = 'https://miscsubjects.com';
const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type,x-terminal-key',
  'cache-control': 'no-store'
};

// ── Protection Tiers ──────────────────────────────────────────────────────────
const TIER_1 = [
  'functions/a/[slug].js',
  'functions/_lib/widgets.js',
  'functions/api/protocol/[[path]].js',
  'functions/_lib/unified_handoff.js',
  'functions/_lib/webhook_intake.js',
  '.protected/golden/tap_go_drop_act.md',
  '.protected/golden/tap_go_drop_read.md',
  'scripts/check-tap-go-drop-golden.mjs',
];
const TIER_2 = [
  'prompts/ROUTER.md',
  'functions/api/dispatch.js',
  'functions/blooio.js',
];
const TIER_3 = ['functions/api/', 'functions/admin/'];

function tierOf(path) {
  return TIER_1.includes(path) ? 1 : TIER_2.includes(path) ? 2 : 3;
}

async function computeHash(content) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}

async function ghFetch(env, path) {
  const gh = env.GH_API_KEY || (env.KV ? await env.KV.get('GH_API_KEY') : null);
  if (!gh) return null;
  const r = await fetch(`https://api.github.com/repos/[OWNER_HANDLE]/miscsubjects-pages/contents/${path}?ref=main`, {
    headers: { Authorization: `Bearer ${gh}`, Accept: 'application/vnd.github.v3+json' }
  });
  if (!r.ok) return null;
  return r.json();
}

async function logVaultEvent(env, event) {
  try {
    if (!env.LEDGER) return;
    await env.LEDGER.prepare(
      `INSERT INTO vault_events (ts, file_path, change_type, actor, tier, blocked, reason) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(event.ts, event.filePath, event.changeType, event.actor, event.tier, event.blocked ? 1 : 0, event.reason || '').run();
  } catch {}
}

export async function vaultCheckMutation(env, filePath, changeType, actor) {
  const tier = tierOf(filePath);
  const ts = new Date().toISOString();
  await logVaultEvent(env, { ts, filePath, changeType, actor, tier, blocked: false });

  if (tier === 1) {
    const unlock = await env.KV.get('vault:owner_unlock');
    const token = await env.KV.get('vault:unlock_token');
    if (!unlock || unlock !== 'granted' || !token) {
      await logVaultEvent(env, { ts, filePath, changeType, actor, tier, blocked: true, reason: 'TIER_1_NO_UNLOCK' });
      return { allowed: false, reason: 'TIER_1_LOCKED — Owner unlock required via SMS or KV vault:owner_unlock=granted + vault:unlock_token set' };
    }
  }
  if (tier === 2) {
    const approvals = await env.KV.get('vault:tier2_approvals');
    const count = approvals ? JSON.parse(approvals).length : 0;
    if (count < 2) {
      await logVaultEvent(env, { ts, filePath, changeType, actor, tier, blocked: true, reason: 'TIER_2_NO_QUORUM' });
      return { allowed: false, reason: 'TIER_2_LOCKED — Need 2 of 3 model approvals (Grok/Kimi/Gemini) via POST /api/vault/approve' };
    }
  }
  return { allowed: true, tier, audit: true };
}

export async function vaultBaseline(env) {
  const baselines = {};
  for (const path of [...TIER_1, ...TIER_2]) {
    try {
      const j = await ghFetch(env, path);
      if (!j) continue;
      const content = atob(j.content || '');
      baselines[path] = await computeHash(content);
    } catch {}
  }
  await env.KV.put('vault:baselines', JSON.stringify(baselines), { expirationTtl: 86400 });
  return baselines;
}

export async function vaultAuditCron(env) {
  const baselinesRaw = await env.KV.get('vault:baselines');
  if (!baselinesRaw) return { status: 'no_baselines' };
  const baselines = JSON.parse(baselinesRaw);
  const violations = [];
  for (const [path, expectedHash] of Object.entries(baselines)) {
    try {
      const j = await ghFetch(env, path);
      if (!j) continue;
      const content = atob(j.content || '');
      const currentHash = await computeHash(content);
      if (currentHash !== expectedHash) {
        violations.push({ path, expectedHash, currentHash });
      }
    } catch {}
  }
  if (violations.length) {
    for (const v of violations) {
      await logVaultEvent(env, {
        ts: new Date().toISOString(),
        filePath: v.path,
        changeType: 'hash_mismatch',
        actor: 'cron_audit',
        tier: 1,
        blocked: true,
        reason: `Hash mismatch: expected ${v.expectedHash.slice(0,16)} got ${v.currentHash.slice(0,16)}`
      });
    }
    return { status: 'VIOLATIONS_FOUND', violations, action: 'alert_owner' };
  }
  return { status: 'clean', checked: Object.keys(baselines).length };
}

export async function vaultUnlock(env, token, source) {
  const expected = env.VAULT_UNLOCK_TOKEN || await env.KV.get('vault:unlock_token');
  if (!expected || token !== expected) {
    return { unlocked: false, reason: 'Invalid token' };
  }
  await env.KV.put('vault:owner_unlock', 'granted', { expirationTtl: 3600 });
  await logVaultEvent(env, { ts: new Date().toISOString(), filePath: 'SYSTEM', changeType: 'unlock', actor: source, tier: 1, blocked: false, reason: 'Owner unlocked for 1 hour' });
  return { unlocked: true, expires_in: '1 hour' };
}

export async function vaultApprove(env, model, filePath, rationale) {
  const key = `vault:tier2_approvals:${filePath}`;
  const existing = await env.KV.get(key);
  const approvals = existing ? JSON.parse(existing) : [];
  if (!approvals.find(a => a.model === model)) {
    approvals.push({ model, ts: new Date().toISOString(), rationale });
    await env.KV.put(key, JSON.stringify(approvals), { expirationTtl: 86400 });
  }
  return { approved: approvals.length, needed: 2, models: approvals.map(a => a.model) };
}

export async function vaultReset(env) {
  await env.KV.put('vault:owner_unlock', 'denied');
  await env.KV.put('vault:tier2_approvals', '[]');
  await vaultBaseline(env);
  return { reset: true };
}

// ── Legacy protected file list (kept for compatibility) ─────────────────────
export const PROTECTED_FILES = [
  'functions/a/[slug].js',
  'functions/_lib/widgets.js',
  'functions/admin/ledger/index.js',
  'functions/_lib/vault_widgets.js',
  'functions/api/vault/[[path]].js',
  'functions/admin/vault.js',
  'functions/_lib/unified_handoff.js',
  'functions/_lib/webhook_intake.js',
  '.protected/golden/tap_go_drop_act.md',
  '.protected/golden/tap_go_drop_read.md',
  'scripts/check-tap-go-drop-golden.mjs',
  'PROTECTED_WIDGETS.md',
  'PROTECTED_FEATURES.md',
  '.githooks/pre-commit',
  '.githooks/commit-msg',
  '.github/workflows/vault-session-scan.yml'
];
export const VAULT_LIMITS = {
  catalog_limit_max: 100,
  default_sessions_per_scan: 25,
  max_sessions_per_scan: 50,
  session_scan_cron: '17 * * * *',
  session_scan_tables_read: ['DB.cc_turns'],
  session_scan_writes: ['LEDGER.events'],
  session_scan_code_writes: false,
  session_scan_auto_revert: false,
  idea_title_max_chars: 180,
  idea_body_max_chars: 12000
};

function json(o, status = 200) {
  return new Response(JSON.stringify(o, null, 2), {
    status,
    headers: {
      'content-type': 'application/json',
      ...CORS_HEADERS
    }
  });
}

function options() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

function authed(request, env) {
  const got = request.headers.get('x-terminal-key') || '';
  return !!env.TERMINAL_KEY && got === env.TERMINAL_KEY;
}

function parse(v) {
  try { return JSON.parse(v || '{}') || {}; } catch { return {}; }
}

async function safeAll(stmt) {
  try { const r = await stmt.all(); return r.results || []; } catch { return []; }
}

async function taskWidgets(env, limit) {
  if (!env.DB) return [];
  const rows = await safeAll(env.DB.prepare('SELECT id, created_at, status, body, source, google_task_id FROM tasks ORDER BY id DESC LIMIT ?').bind(limit));
  return rows.map((r) => {
    const job = parse(r.body);
    const title = job.title || job.item || job.ask || job.role || r.source || 'Task #' + r.id;
    const body = job.detail || job.body || job.ask || job.item || r.body || '';
    return normalizeWidget('task', {
      id: 'task:' + r.id,
      title,
      body,
      status: r.status,
      ts: r.created_at,
      href: BASE + '/admin/tasks',
      hash: shortHash(r.id + '|' + r.body + '|' + r.status),
      meta: { role: r.source, google_task_id: r.google_task_id || null },
      api: BASE + '/api/tasks?status=' + encodeURIComponent(r.status || 'open')
    });
  });
}

async function eventWidgets(env, limit) {
  if (!env.LEDGER) return [];
  const rows = await safeAll(env.LEDGER.prepare(
    'SELECT id, ts, source, key, route, actor, action, direction, status, trace_id, request_preview, response_preview FROM events ORDER BY ts DESC LIMIT ?'
  ).bind(limit));
  return rows.map((e) => normalizeWidget('event', {
    id: 'event:' + e.id,
    title: [e.source, e.key, e.action].filter(Boolean).join(' / ') || e.id,
    body: e.request_preview || e.response_preview || '',
    status: e.status == null ? '' : String(e.status),
    ts: e.ts,
    href: BASE + '/api/events/' + encodeURIComponent(e.id),
    hash: shortHash(e.id + '|' + e.request_preview + '|' + e.response_preview),
    meta: { trace_id: e.trace_id, route: e.route, actor: e.actor, direction: e.direction },
    api: BASE + '/api/events/' + encodeURIComponent(e.id)
  }));
}

async function cardWidgets(env, limit) {
  if (!env.DB) return [];
  const rows = await safeAll(env.DB.prepare(
    'SELECT id, ts, session, cwd, user_input, assistant_text, input_kind FROM cc_turns ORDER BY id DESC LIMIT ?'
  ).bind(limit));
  return rows.map((c) => normalizeWidget('card', {
    id: 'cc:' + c.id,
    title: (c.input_kind || 'claude-code') + ' / ' + String(c.session || '').slice(0, 8),
    body: c.user_input || c.assistant_text || '',
    status: c.input_kind || '',
    ts: c.ts,
    href: BASE + '/api/cards?card_id=cc_' + encodeURIComponent(c.id),
    hash: shortHash(c.id + '|' + c.user_input + '|' + c.assistant_text),
    meta: { session: c.session, cwd: c.cwd },
    api: BASE + '/api/cards?card_id=cc_' + encodeURIComponent(c.id)
  }));
}

async function claimWidgets(env, limit) {
  if (!env.DB) return [];
  const rows = await safeAll(env.DB.prepare('SELECT slug, title, meta, updated_at FROM articles ORDER BY updated_at DESC LIMIT 120'));
  const out = [];
  for (const r of rows) {
    const m = parse(r.meta);
    for (const c of (Array.isArray(m.claims) ? m.claims : [])) {
      out.push(normalizeWidget('claim', {
        id: 'claim:' + r.slug + ':' + (c.id || shortHash(c.text || '')),
        title: r.title || r.slug,
        body: c.text || '',
        status: c.tier || c.source_status || '',
        ts: r.updated_at,
        href: BASE + '/a/' + encodeURIComponent(r.slug),
        hash: shortHash(r.slug + '|' + (c.id || '') + '|' + (c.text || '')),
        meta: { article: r.slug, section: c.section || null, source_ids: c.source_ids || [] },
        api: BASE + '/api/claims?slug=' + encodeURIComponent(r.slug)
      }));
      if (out.length >= limit) return out;
    }
  }
  return out;
}

async function protectedWidgets(env) {
  return PROTECTED_FILES.map((f) => normalizeWidget('protected', {
    id: 'lock:' + f,
    title: f,
    body: 'Owner-locked feature path. Any mutation must be explicit and tokened in git.',
    status: 'locked',
    href: BASE + '/api/inventory?kind=file',
    hash: shortHash('locked|' + f),
    api: BASE + '/api/vault/catalog'
  }));
}

export async function catalog(env, limit = 24) {
  const [tasks, events, cards, claims, locks] = await Promise.all([
    taskWidgets(env, limit),
    eventWidgets(env, limit),
    cardWidgets(env, limit),
    claimWidgets(env, limit),
    protectedWidgets(env)
  ]);
  const groups = { tasks, events, cards, claims, protected: locks };
  const counts = Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.length]));
  return {
    ts: new Date().toISOString(),
    build: 'miscsubjects',
    routes: {
      catalog: 'GET /api/vault/catalog',
      widgets: 'GET /api/vault/widgets',
      limits: 'GET /api/vault/limits',
      ideas: 'POST /api/vault/ideas {title, body, scope?, lock?}',
      session_scan: 'POST /api/vault/session-scan {limit?}',
      protect: 'POST /api/vault/protect {filePath, changeType, actor}',
      unlock: 'POST /api/vault/unlock {token}',
      approve: 'POST /api/vault/approve {model, filePath, rationale}',
      audit: 'POST /api/vault/audit',
      baseline: 'POST /api/vault/baseline',
      reset: 'POST /api/vault/reset',
      admin: 'GET /admin/vault'
    },
    limits: VAULT_LIMITS,
    counts,
    groups
  };
}

function blobOf(row) {
  return [
    row.user_input,
    row.assistant_text,
    row.files_json,
    row.commands_json,
    row.tools_json
  ].map((v) => String(v || '')).join('\n').toLowerCase();
}

function hazardsIn(blob) {
  const patterns = [
    'rm -rf',
    'git reset --hard',
    'git checkout --',
    'git clean -fd',
    'git push --force',
    'api/file'
  ];
  return patterns.filter((p) => blob.includes(p));
}

async function sessionScan(request, env) {
  if (!authed(request, env)) return json({ error: 'unauthorized - x-terminal-key required' }, 401);
  if (!env.DB) return json({ error: 'DB binding missing' }, 500);
  const b = await request.json().catch(() => ({}));
  const requested = parseInt(b.limit || VAULT_LIMITS.default_sessions_per_scan, 10) || VAULT_LIMITS.default_sessions_per_scan;
  const limit = Math.min(Math.max(requested, 1), VAULT_LIMITS.max_sessions_per_scan);
  const rows = await safeAll(env.DB.prepare(
    'SELECT id, ts, session, cwd, user_input, assistant_text, files_json, commands_json, tools_json, input_kind FROM cc_turns ORDER BY id DESC LIMIT ?'
  ).bind(limit));
  const alerts = [];
  for (const row of rows) {
    const blob = blobOf(row);
    const protected_hits = PROTECTED_FILES.filter((f) => blob.includes(f.toLowerCase()));
    const hazards = hazardsIn(blob);
    if (!protected_hits.length && !hazards.length) continue;
    alerts.push({
      id: row.id,
      ts: row.ts,
      session: row.session,
      input_kind: row.input_kind,
      protected_hits,
      hazards,
      href: BASE + '/admin/ledger?cards=1&source=claude-code&q=' + encodeURIComponent(String(row.id))
    });
  }
  const response = {
    ok: true,
    scanned: rows.length,
    alerts: alerts.length,
    alert_rows: alerts,
    limits: VAULT_LIMITS
  };
  const eventId = await logEvent(env, {
    source: 'vault',
    key: 'SESSION_SCAN',
    action: 'scan',
    actor: b.source || 'vault-cron',
    direction: 'in',
    status: 200,
    trace_id: 'vault_scan_' + Date.now(),
    request: { requested_limit: requested, applied_limit: limit, code_writes: false },
    response
  });
  response.event_id = eventId;
  return json(response);
}

async function createIdea(request, env) {
  if (!authed(request, env)) return json({ error: 'unauthorized - x-terminal-key required' }, 401);
  if (!env.DB) return json({ error: 'DB binding missing' }, 500);
  const b = await request.json().catch(() => ({}));
  const title = String(b.title || b.summary || 'Vault idea').slice(0, 180);
  const body = String(b.body || b.idea || b.text || '').slice(0, 12000);
  const scope = String(b.scope || 'macro').slice(0, 80);
  const ts = new Date().toISOString();
  const job = { role: 'vault-idea', title, body, scope, lock: !!b.lock, created_by: b.created_by || 'vault-api' };
  const r = await env.DB.prepare('INSERT INTO tasks (created_at, status, body, source) VALUES (?,?,?,?)')
    .bind(ts, 'open', JSON.stringify(job), 'vault-idea').run();
  const id = r.meta && r.meta.last_row_id;
  await logEvent(env, {
    source: 'vault',
    key: 'IDEA_INTAKE',
    action: 'create',
    actor: 'owner',
    direction: 'in',
    status: 200,
    trace_id: 'vault_' + id,
    request: job,
    response: { id, status: 'open' }
  });
  return json({ ok: true, id, status: 'open', task: job, links: { vault: BASE + '/admin/vault', tasks: BASE + '/admin/tasks' } });
}

// ── Protection endpoints ──────────────────────────────────────────────────────
async function protectCheck(request, env) {
  const b = await request.json().catch(() => ({}));
  const filePath = String(b.filePath || '');
  if (!filePath) return json({ error: 'filePath required' }, 400);
  const result = await vaultCheckMutation(env, filePath, b.changeType || 'check', b.actor || 'api');
  return json({ ok: true, filePath, ...result });
}

async function unlockVault(request, env) {
  const b = await request.json().catch(() => ({}));
  const result = await vaultUnlock(env, b.token, b.source || 'api');
  return json({ ok: result.unlocked, ...result });
}

async function approveTier2(request, env) {
  const b = await request.json().catch(() => ({}));
  if (!b.model || !b.filePath) return json({ error: 'model and filePath required' }, 400);
  const result = await vaultApprove(env, b.model, b.filePath, b.rationale || '');
  return json({ ok: true, ...result });
}

async function runAudit(env) {
  const result = await vaultAuditCron(env);
  return json({ ok: true, ...result });
}

async function runBaseline(env) {
  const result = await vaultBaseline(env);
  return json({ ok: true, baselines: result, count: Object.keys(result).length });
}

async function runReset(env) {
  const result = await vaultReset(env);
  return json({ ok: true, ...result });
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const method = request.method.toUpperCase();
  const pathParts = Array.isArray(params.path) ? params.path : (params.path ? [params.path] : []);
  const seg = String(pathParts[0] || 'catalog').toLowerCase();
  try {
    if (method === 'OPTIONS') return options();
    if (method === 'GET' && (seg === 'catalog' || seg === 'widgets' || seg === '')) {
      const limit = Math.min(parseInt(new URL(request.url).searchParams.get('limit') || '24', 10) || 24, VAULT_LIMITS.catalog_limit_max);
      return json(await catalog(env, limit));
    }
    if (method === 'GET' && seg === 'limits') return json({ ok: true, limits: VAULT_LIMITS, protected_files: PROTECTED_FILES });
    if (method === 'GET' && seg === 'protected') {
      const files = [...TIER_1, ...TIER_2].map(p => ({ path: p, tier: tierOf(p) }));
      return json({ ok: true, protected_files: files, tier_counts: { 1: TIER_1.length, 2: TIER_2.length, 3: TIER_3.length } });
    }
    if (method === 'POST' && (seg === 'ideas' || seg === 'idea')) return createIdea(request, env);
    if (method === 'POST' && (seg === 'session-scan' || seg === 'sessions')) return sessionScan(request, env);
    if (method === 'POST' && seg === 'protect') return protectCheck(request, env);
    if (method === 'POST' && seg === 'unlock') return unlockVault(request, env);
    if (method === 'POST' && seg === 'approve') return approveTier2(request, env);
    if (method === 'POST' && seg === 'audit') return runAudit(env);
    if (method === 'POST' && seg === 'baseline') return runBaseline(env);
    if (method === 'POST' && seg === 'reset') return runReset(env);
    return json({
      error: 'not found',
      routes: [
        'GET /api/vault/catalog', 'GET /api/vault/widgets', 'GET /api/vault/limits',
        'GET /api/vault/protected', 'POST /api/vault/ideas', 'POST /api/vault/session-scan',
        'POST /api/vault/protect', 'POST /api/vault/unlock', 'POST /api/vault/approve',
        'POST /api/vault/audit', 'POST /api/vault/baseline', 'POST /api/vault/reset'
      ]
    }, 404);
  } catch (e) {
    return json({ error: 'vault failed: ' + (e && e.message || String(e)) }, 500);
  }
}
