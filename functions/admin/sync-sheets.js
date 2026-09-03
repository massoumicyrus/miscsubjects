const SHEET_ID = '<GOOGLE_SHEET_ID>';
const REPO = '[OWNER_HANDLE]/miscsubjects-pages';

async function airunnerPost(env, action, args) {
  const url = env.AIRUNNER_WEB_APP_URL;
  if (!url) return { ok: false, error: 'AIRUNNER_WEB_APP_URL env var missing' };
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, args }),
      redirect: 'follow',
    });
    const text = await r.text();
    let parsed; try { parsed = JSON.parse(text); } catch { parsed = { raw: text.slice(0, 500) }; }
    return { ok: r.ok, status: r.status, body: parsed };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  }
}

function purposeOf(path) {
  const p = String(path);
  const ext = (p.match(/\.([a-z0-9]+)$/i) || [, ''])[1].toLowerCase();
  if (p.startsWith('migrations/')) return 'D1 migration — schema or seed; runs once to change the database';
  if (p.startsWith('functions/api/')) return 'REST API endpoint (server)';
  if (p.startsWith('functions/admin/')) return 'admin page (server-rendered HTML)';
  if (p.startsWith('functions/_lib/')) return 'shared server library';
  if (p === 'functions/[slug].js') return 'serves legacy editable HTML pages at /<slug>';
  if (p.startsWith('functions/content/')) return 'public article page';
  if (p.startsWith('functions/img/')) return 'serves images from R2';
  if (p.startsWith('functions/')) return 'page or messaging-channel handler (server)';
  if (p.startsWith('public/')) return 'static asset (public/index.html = the one-page app)';
  if (p.startsWith('prompts/')) return 'agent system prompt';
  if (p.startsWith('content-source/')) return 'raw content source (peptide framework, voice law)';
  if (p.startsWith('scripts/')) return 'one-off build/seed script';
  if (p.startsWith('apps-script/')) return 'Google Apps Script — the Sheets sync receiver';
  if (p.startsWith('bridge/')) return 'bridge code';
  if (p.startsWith('workers/')) return 'separate Cloudflare Worker';
  if (p.startsWith('agents/')) return 'agent config';
  if (p.startsWith('docs/')) return 'DOC / notes — bulk of the sprawl (791 files); mostly not load-bearing';
  if (ext === 'md') return 'doc / notes';
  if (ext === 'toml') return 'Cloudflare config (wrangler)';
  if (ext === 'json') return 'config / data';
  return 'unclassified — name may not be coherent';
}

async function buildArchitectureRows(env) {
  const r = await fetch(`https://api.github.com/repos/${REPO}/git/trees/main?recursive=1`, {
    headers: {
      'User-Agent': 'miscsubjects-build',
      'Accept': 'application/vnd.github+json',
      ...(env.GITHUB_TOKEN ? { 'Authorization': 'Bearer ' + env.GITHUB_TOKEN } : {}),
    },
  });
  if (!r.ok) return { headers: ['path','dir','type','size','purpose','sha'], rows: [[`ERR ${r.status}`, '', '', '', '', '']] };
  const j = await r.json();
  const headers = ['path', 'dir', 'type', 'size', 'purpose', 'sha'];
  const rows = (j.tree || []).map(n => {
    const path = n.path || '';
    const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '(root)';
    return [path, dir, n.type || '', n.size || 0, n.type === 'tree' ? 'folder' : purposeOf(path), n.sha || ''];
  });
  return { headers, rows };
}

async function buildTablesRows(env) {
  const t = await env.DB.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
  const headers = ['table', 'rows', 'schema (columns)'];
  const rows = [];
  for (const x of (t.results || [])) {
    let n = 0; try { const c = await env.DB.prepare('SELECT COUNT(*) AS n FROM "' + x.name + '"').first(); n = c.n; } catch {}
    rows.push([x.name, n, String(x.sql || '').replace(/\s+/g, ' ').slice(0, 900)]);
  }
  return { headers, rows };
}

async function buildDirectoryRows(env) {
  const r = await env.DB.prepare(
    'SELECT key, type, category, enabled, planner_visible, planner_rank, target, auth, ' +
    'substr(content, 1, 240) AS content_head, length(content) AS content_len, updated_at ' +
    'FROM directory ORDER BY (seq IS NULL), seq ASC, (key = "ROUTER") DESC, key ASC'
  ).all();
  const headers = ['key','type','category','enabled','planner_visible','planner_rank','target','auth','content_head','content_len','updated_at'];
  const rows = (r.results || []).map(x => [
    x.key, x.type, x.category || '',
    x.enabled == null ? 1 : x.enabled,
    x.planner_visible == null ? 1 : x.planner_visible,
    x.planner_rank == null ? 100 : x.planner_rank,
    x.target || '', x.auth || '', (x.content_head || '').replace(/\n/g, ' '),
    x.content_len || 0, x.updated_at || ''
  ]);
  return { headers, rows };
}

async function buildCapabilityTestRows(env) {
  const r = await env.DB.prepare(
    'SELECT seq, feature, prompt, expect, last_status, last_verdict, substr(last_reply,1,400) AS reply, sent_at, last_run FROM capability_tests ORDER BY seq'
  ).all();
  const headers = ['seq','feature','prompt','expect','last_status','last_verdict','reply','sent_at','last_run'];
  const rows = (r.results || []).map(x => [
    x.seq, x.feature || '', x.prompt || '', x.expect || '', x.last_status || '',
    x.last_verdict || '', (x.reply || '').replace(/\n/g, ' '), x.sent_at || '', x.last_run || ''
  ]);
  return { headers, rows };
}

async function buildLedgerRows(env) {
  if (!env.LEDGER) return { headers: ['error'], rows: [['LEDGER binding missing']] };
  const r = await env.LEDGER.prepare(
    'SELECT id, ts, source, key, route, action, direction, status, trace_id, step, ' +
    'request_size, response_size, request_preview, response_preview, r2_request_key, r2_response_key ' +
    'FROM events ORDER BY ts DESC LIMIT 500'
  ).all();
  const headers = ['id','ts','source','key','route','action','direction','status','trace_id','step','request_size','response_size','request_preview','response_preview','r2_request_key','r2_response_key'];
  const rows = (r.results || []).map(x => [
    x.id, x.ts, x.source || '', x.key || '', x.route || '', x.action || '', x.direction || '',
    x.status == null ? '' : x.status, x.trace_id || '', x.step == null ? '' : x.step,
    x.request_size || 0, x.response_size || 0,
    (x.request_preview || '').slice(0, 500).replace(/\n/g, ' '),
    (x.response_preview || '').slice(0, 500).replace(/\n/g, ' '),
    x.r2_request_key || '', x.r2_response_key || ''
  ]);
  return { headers, rows };
}

async function buildPagesRows(env) {
  const r = await env.DB.prepare(
    'SELECT slug, title, version, length(body_html) AS body_bytes, updated_at FROM pages ORDER BY slug'
  ).all();
  const headers = ['slug','title','version','body_bytes','updated_at'];
  const rows = (r.results || []).map(x => [x.slug, x.title || '', x.version || 1, x.body_bytes || 0, x.updated_at || '']);
  return { headers, rows };
}

// Outreach review on Sheets: every draft with its lead fields, every email ever sent,
// and every version of the writing logic verbatim — so drafts and rules can be read side by side.
async function buildOutreachDraftsRows(env) {
  const r = await env.DB.prepare(
    "SELECT id, name, segment, city, email, website, score, status, COALESCE(notes,'') notes, COALESCE(context,'') context, draft " +
    'FROM leads WHERE draft IS NOT NULL ORDER BY score DESC, id DESC'
  ).all();
  const headers = ['lead_id','business','segment','city','email','website','fit_score','status','subject','opening_line','full_body','word_count','written_by','qualification_note','scraped_site_text'];
  const rows = (r.results || []).map(x => {
    let d = {};
    try { d = JSON.parse(x.draft || '{}'); } catch {}
    const body = String(d.body || '');
    const lines = body.split('\n').map(s => s.trim()).filter(Boolean);
    const icp = (String(x.notes || '').match(/icp:\d+[^·\n]*/) || [''])[0];
    return [
      x.id, x.name || '', x.segment || '', x.city || '', x.email || '', x.website || '',
      x.score == null ? '' : x.score, x.status || '', d.subject || '', lines[1] || '', body,
      body.replace(/https?:\/\/\S+/g, '').split(/\s+/).filter(Boolean).length,
      d.model || '', icp.trim(), String(x.context || '').slice(0, 1000),
    ];
  });
  return { headers, rows };
}

async function buildOutreachSentRows(env) {
  const r = await env.DB.prepare(
    'SELECT id, lead_id, to_email, subject, body, kind, sent_at, send_status, opens, clicks FROM email_sends ORDER BY sent_at DESC'
  ).all();
  const headers = ['sent_at','kind','to_email','subject','body','http_status','opens','clicks','lead_id','send_id'];
  const rows = (r.results || []).map(x => [
    x.sent_at || '', x.kind || '', x.to_email || '', x.subject || '', String(x.body || ''),
    x.send_status == null ? '' : x.send_status, x.opens || 0, x.clicks || 0,
    x.lead_id == null ? '' : x.lead_id, x.id,
  ]);
  return { headers, rows };
}

async function buildOutreachLogicRows(env) {
  let res = [];
  try {
    res = (await env.DB.prepare('SELECT ts, source, label, full_text FROM outreach_rule_versions ORDER BY ts ASC, id ASC').all()).results || [];
  } catch { res = []; }
  const headers = ['when','source','version_label','chars','full_rule_text_verbatim'];
  const rows = res.map(x => [x.ts || '', x.source || '', x.label || '', String(x.full_text || '').length, String(x.full_text || '')]);
  return { headers, rows };
}

async function syncTab(env, tab, builder) {
  const data = await builder(env);
  const result = await airunnerPost(env, 'sheets_replace_tab', {
    sheet_id: SHEET_ID, tab, headers: data.headers, rows: data.rows,
  });
  return { tab, rows: data.rows.length, airunner: result };
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const only = url.searchParams.get('tab');
  const tabs = only ? [only] : ['Architecture', 'Tables', 'Directory', 'Ledger', 'Pages', 'CapabilityTests', 'OUTREACH_DRAFTS', 'OUTREACH_SENT', 'OUTREACH_LOGIC'];
  const builders = {
    Architecture: buildArchitectureRows,
    Tables: buildTablesRows,
    Directory: buildDirectoryRows,
    Ledger: buildLedgerRows,
    Pages: buildPagesRows,
    CapabilityTests: buildCapabilityTestRows,
    OUTREACH_DRAFTS: buildOutreachDraftsRows,
    OUTREACH_SENT: buildOutreachSentRows,
    OUTREACH_LOGIC: buildOutreachLogicRows,
  };
  const out = [];
  for (const t of tabs) {
    const b = builders[t];
    if (!b) { out.push({ tab: t, error: 'unknown_tab' }); continue; }
    out.push(await syncTab(env, t, b));
  }
  return new Response(JSON.stringify({ sheet_id: SHEET_ID, tabs: out, synced_at: new Date().toISOString() }, null, 2), {
    headers: { 'content-type': 'application/json' },
  });
}

export async function onRequestGet(context) {
  const { env } = context;
  const arr = await airunnerPost(env, 'sheets_list_tabs', { sheet_id: SHEET_ID });
  return new Response(JSON.stringify({
    sheet_id: SHEET_ID,
    airunner_url: env.AIRUNNER_WEB_APP_URL || null,
    list_tabs_response: arr,
  }, null, 2), { headers: { 'content-type': 'application/json' } });
}
