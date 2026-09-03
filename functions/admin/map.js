// /admin/map — the build/edit-routing map. For each request class it shows the exact
// files + code sections to edit, which Cloudflare service they touch, the deploy step,
// and the minimal context to hand an editing model. Static data (this IS the map of the
// repo); update the PB/FILES arrays when the routing changes. Sibling of
// /admin/directory/graph (which maps agent→tool tags); this maps request→file→service.
import { shellHtml } from './_layout.js';

const SVC = {
  spine:  { l: 'D1 · spine',     c: '#2563eb' },
  ledger: { l: 'D1 · ledger',    c: '#7c3aed' },
  kv:     { l: 'KV',             c: '#0891b2' },
  r2:     { l: 'R2',             c: '#059669' },
  ai:     { l: 'Workers AI',     c: '#d97706' },
  do:     { l: 'Durable Object', c: '#db2777' },
  q:      { l: 'Queue',          c: '#65a30d' },
  ext:    { l: 'external API',   c: '#6b7280' },
};

const BOOT = [
  { f: '~/.claude/CLAUDE.md', n: 'your law (tone, action, exhibits)' },
  { f: 'Claude Code system prompt', n: 'harness + tools (Anthropic, not a repo file)' },
  { f: 'STATE.md', n: 'build cursor + memory' },
  { f: 'wrangler.toml', n: 'the 7 service bindings' },
];

const PB = [
  { k: 'Add / edit a TOOL', svc: ['spine'],
    edit: [['migrations/00NN.sql', 'INSERT/UPDATE a directory row (key,type,target,content)'], ['functions/api/dispatch.js', 'FN_MAP fn OR target_map op — only if new behavior'], ['functions/admin/directory/[key].js', 'live edit UI (no deploy)']],
    read: ['dispatch.js: TAG_RE, dispatchTag(), runAgent() loop'],
    deploy: 'wrangler d1 execute (row) · pages deploy (only if dispatch.js changed)',
    bundle: ['api/dispatch.js (FN_MAP + dispatchTag)', 'one example directory row'] },
  { k: 'Change ROUTER / agent prompt', svc: ['spine'],
    edit: [['prompts/<KEY>.md', 'backup + new prompt'], ['directory row content', 'PATCH /api/directory/<KEY>']],
    read: ['blooio.js: readRouterPrompt(), agent loop', 'dispatch.js: runAgent()'],
    deploy: 'PATCH the row + INVALIDATE_DIR_SNAPSHOT — no pages deploy',
    bundle: ['the live ROUTER row content', 'blooio.js agent loop (the tag rules)'] },
  { k: 'Add / view a MODEL', svc: ['ai', 'ext'],
    edit: [['functions/_lib/cf_catalog.js', 'the catalogue array'], ['functions/_lib/providers.js', 'company registry']],
    read: ['admin/directory/models.js: the view', 'api/providers route'],
    deploy: 'pages deploy',
    bundle: ['_lib/providers.js', '_lib/cf_catalog.js (shape only)'] },
  { k: 'Speak / send AUDIO', svc: ['spine', 'r2', 'ext'],
    edit: [['functions/api/dispatch.js', 'META_TAGS + FN_MAP.audioSpeak'], ['functions/blooio.js', 'deliverAudioTags() in finish + direct']],
    read: ['dispatch.js: META_TAGS set', 'blooio.js: deliverReply / finishPhase'],
    deploy: 'pages deploy',
    bundle: ['blooio.js delivery section', 'dispatch.js META_TAGS + audioSpeak'] },
  { k: 'Edit a PAGE', svc: ['spine'],
    edit: [['functions/admin/pages/[slug].js', 'editor'], ['functions/api/pages/[slug].js', 'REST CRUD'], ['public/index.html', 'homepage is static — file edit']],
    read: ['content/[slug].js: server render', 'pages table rows'],
    deploy: 'PATCH the row (D1) · pages deploy (homepage file)',
    bundle: ['api/pages/[slug].js', 'the pages table row'] },
  { k: 'Edit CONTENT / article', svc: ['spine'],
    edit: [['functions/api/articles/[[path]].js', 'article CRUD + compose/judge'], ['functions/api/content/[[path]].js', 'content_items CRUD']],
    read: ['admin/content/[slug].js', 'a/[slug].js public render'],
    deploy: 'PATCH the row (D1) — no deploy unless route changed',
    bundle: ['api/articles/[[path]].js', 'one article row'] },
  { k: 'See payloads / LEDGER', svc: ['ledger', 'r2'],
    edit: [['functions/_lib/event_log.js', 'what gets logged'], ['functions/admin/ledger/index.js', 'the view']],
    read: ['dispatch.js: logStep()', 'events table'],
    deploy: 'pages deploy',
    bundle: ['_lib/event_log.js', 'admin/ledger/index.js'] },
  { k: 'Inbound iMessage turn', svc: ['spine', 'kv', 'ext'],
    edit: [['functions/blooio.js', 'processTurn → phases A/B/C'], ['functions/_lib/webhook_intake.js', 'dedup + re-post to /api/turn']],
    read: ['blooio.js: routeInbound, agentPhase, finishPhase', 'dispatch.js: runAgent()'],
    deploy: 'pages deploy',
    bundle: ['blooio.js (full)', 'dispatch.js runAgent()'] },
  { k: 'Slug resolve / invoke', svc: ['spine', 'do'],
    edit: [['functions/s/[slug].js', 'GET resolve + POST act'], ['workers/directory-do/src/index.js', 'DirectoryDO registry']],
    read: ['_lib/invoke_spec.js: the signature deriver'],
    deploy: 'pages deploy · wrangler deploy (DO worker)',
    bundle: ['s/[slug].js', '_lib/invoke_spec.js'] },
  { k: 'KV / R2 / Queue op', svc: ['kv', 'r2', 'q'],
    edit: [['functions/api/kv.js', 'KV'], ['functions/api/r2/[[path]].js + api/file', 'R2'], ['functions/queue.js', 'TASKS consumer']],
    read: ['dispatch.js FN_MAP: kvGet/r2Put/enqueueTask'],
    deploy: 'pages deploy',
    bundle: ['the one route file', 'its FN_MAP fn in dispatch.js'] },
  { k: 'Add a new external API / provider', svc: ['spine', 'ext'],
    edit: [['migrations/00NN.sql', "INSERT an http directory row: target = 'METHOD url' OR target_map:{...} ops, auth = bearer:/basic:/headers:"], ['functions/_lib/providers.js', 'if it is an LLM provider company']],
    read: ['dispatch.js: dispatchTag() http branch, applyAuth(), subVars()'],
    deploy: 'wrangler d1 execute (row). No code change needed for plain http rows.',
    bundle: ['dispatch.js http+auth section', 'one existing target_map row (e.g. BLOOIO)'] },
  { k: 'Generate an image / video', svc: ['r2', 'ext'],
    edit: [['functions/api/dispatch.js', 'FN_MAP.grokImageToR2 / openaiImage / aiTextToImage; storeB64Png()'], ['directory rows', 'GROK_IMAGE, OPENAI_IMAGE, GROK_VIDEO_START, ARCADS_GENERATE']],
    read: ['dispatch.js: the image fns + R2 put → stable miscsubjects.com/img link'],
    deploy: 'pages deploy (fn) · wrangler d1 (row)',
    bundle: ['dispatch.js image fns', 'one image directory row'] },
  { k: 'Send an invoice (Stripe)', svc: ['spine', 'ext'],
    edit: [['functions/api/dispatch.js', 'FN_MAP.sendPeptideInvoice / stripeSendInvoice; STRIPE_WRITE gated'], ['directory rows', 'SEND_PEPTIDE_INVOICE, STRIPE_READ, STRIPE_WRITE']],
    read: ['dispatch.js: stripePost(), stripeForm(); approval gate'],
    deploy: 'pages deploy',
    bundle: ['dispatch.js stripe section', 'SEND_PEPTIDE_INVOICE row'] },
  { k: 'Phone-gated approval', svc: ['spine', 'ext'],
    edit: [['functions/api/dispatch.js', 'FN_MAP.approvalCreate / approvalResolve'], ['functions/api/phone/in.js', 'approve/deny intake']],
    read: ['dispatch.js: approvals table writes + Blooio notify'],
    deploy: 'pages deploy',
    bundle: ['dispatch.js approval fns', 'api/phone/in.js'] },
  { k: 'Sync to Google Sheets / Drive', svc: ['spine', 'ext'],
    edit: [['functions/admin/sync-sheets.js', 'the sync routes'], ['directory rows', 'APPS_SCRIPT_RUN, GOOGLE_SHEETS_*, SHEETS_SYNC_ALL']],
    read: ['sync-sheets.js: payload shape to the GAS web app'],
    deploy: 'pages deploy',
    bundle: ['admin/sync-sheets.js', 'the GOOGLE_SHEETS_* row'] },
  { k: 'Ship a deploy', svc: ['spine', 'do'],
    edit: [['(no file)', 'this is the deploy procedure, not an edit']],
    read: ['STATE.md: STACK section', 'wrangler.toml: bindings'],
    deploy: 'cd workers/directory-do && wrangler deploy · wrangler d1 execute loop-content-spine --remote --file=migrations/NN.sql · wrangler pages deploy public (from repo root)',
    bundle: ['STATE.md STACK + CURSOR', 'wrangler.toml'] },
];

// Measured 2026-06-14 from `git ls-files` + byte sizes. tokens ≈ bytes/4.
// kind: 'logic' = needed to understand the running build · 'ref' = reference/history.
const SIZES = {
  total: { files: 1006, bytes: 6263977 },
  tiers: [
    { k: 'Whole repo', files: 1006, bytes: 6263977, note: 'everything tracked in git' },
    { k: 'Understand the build', files: 91, bytes: 795483, note: 'functions/ + prompts/ + wrangler.toml + STATE.md — the code, prompts, config, memory' },
    { k: 'Reference / history (skip)', files: 915, bytes: 5468494, note: 'vendor API doc dumps, migration history, archives, seed content — not the logic' },
  ],
  groups: [
    ['docs', 4533508, 791, 'ref'],
    ['migrations', 535930, 84, 'ref'],
    ['functions/admin', 257081, 21, 'logic'],
    ['functions/api', 247739, 35, 'logic'],
    ['content-source', 205841, 7, 'ref'],
    ['functions/_lib', 122801, 7, 'logic'],
    ['functions (root)', 83741, 11, 'logic'],
    ['prompts', 62907, 11, 'logic'],
    ['scripts', 56884, 3, 'ref'],
    ['bridge', 53519, 11, 'ref'],
    ['(repo root)', 25644, 6, 'logic'],
    ['public', 19560, 2, 'ref'],
    ['workers', 19375, 5, 'logic'],
    ['functions/content', 14177, 2, 'logic'],
    ['apps-script', 8347, 3, 'ref'],
    ['functions/a + grok + s + img', 11243, 4, 'logic'],
    ['agents + .github', 5680, 3, 'ref'],
  ],
  topFiles: [
    ['docs/STATE_ARCHIVE_2026H1.md', 271256, 'ref'],
    ['functions/api/dispatch.js', 119878, 'logic'],
    ['functions/admin/manual.js', 113665, 'logic'],
    ['docs/LOOPS_EXPLAINED.md', 104859, 'ref'],
    ['docs/api/arcads/openapi-spec.json', 103887, 'ref'],
    ['functions/_lib/cf_catalog.js', 88082, 'logic'],
    ['docs/SYSTEM_PROMPTS_FIELD_GUIDE.md', 69218, 'ref'],
    ['docs/CAPABILITY_MAP.md', 59644, 'ref'],
    ['migrations/0058_consolidation.sql', 55953, 'ref'],
    ['functions/blooio.js', 23058, 'logic'],
  ],
};

const FILES = [
  ['api/dispatch.js', ['spine', 'ledger', 'kv', 'r2', 'ai', 'q', 'ext']],
  ['blooio.js', ['spine', 'ledger', 'kv', 'ext']],
  ['_lib/webhook_intake.js', ['spine', 'kv', 'ext']],
  ['_lib/event_log.js', ['ledger', 'r2']],
  ['_lib/providers.js + cf_catalog.js', ['ai']],
  ['admin/directory/[key].js', ['spine', 'kv']],
  ['api/directory/[key].js', ['spine', 'do']],
  ['s/[slug].js + workers/directory-do', ['spine', 'do']],
  ['api/content + api/articles', ['spine']],
  ['api/pages + content/[slug].js', ['spine']],
  ['admin/ledger/*', ['ledger']],
  ['api/kv.js', ['kv']],
  ['api/r2 + api/file', ['r2']],
  ['queue.js', ['q', 'spine']],
];

// Which service "group" each binding belongs to (for the node graph clustering).
const GROUP = { ai: 'compute', q: 'compute', do: 'compute', spine: 'data', ledger: 'data', kv: 'data', r2: 'data', ext: 'external' };
const GROUP_LABEL = { compute: 'Compute (the Worker runs these)', data: 'Data stores (distinct from the Worker)', external: 'External' };

// Live bindings + real specs (measured 2026-06-14).
const SPECS = [
  ['DB', 'D1', 'loop-content-spine', '10.51 MB · 34 tables', 'directory 338 · content_items 375 · assets 103 · pages 16 · directory_tests 64 · tasks 9 · settings 5 · watch_rules 5 · articles 1'],
  ['LEDGER', 'D1', 'loop-shared-events', '24.53 MB · 1 table', 'events 13,367 — every payload in/out'],
  ['KV', 'KV', 'loop_content_kv', '58b303e6…', 'directory snapshot · sticky audio/terminal modes · convo cache'],
  ['R2', 'R2', 'miscsubjects-ledger', '—', 'generated images · audio mp3 · raw sources'],
  ['AI', 'Workers AI', '—', '—', 'env.AI.run for @cf models'],
  ['TASKS', 'Queue', 'loop-tasks', '2 producers · 1 consumer', 'background jobs'],
  ['DIRECTORY_DO', 'Durable Object', 'DirectoryDO @ loop-safe-directory-do', 'SQLite-backed', 'slug registry + single-writer mutation log'],
];
// Runtime governing rules, low→high precedence.
const RULES = [
  ['1 · watch_rules deny', 'regex match → allowed:false', 'blocks the dispatch outright'],
  ['2 · COST_CAP_USD', '1.00', 'chain stops when spend ≥ $1'],
  ['3 · DEPTH_CAP', '3', 'agent→agent recursion ceiling'],
  ['4 · ITER_CAP', '8', 'tool-loop turns per agent'],
  ['gate · [REPLY]', 'present?', 'no [REPLY] = total silence'],
  ['gate · META_TAGS', 'DONE/SELF/REASONING/TOOL_CHOICE/DECISION/BATCH/REPLY/AUDIO', 'inert — never dispatched as tools'],
  ['gate · STRIPE_WRITE', 'explicit-go phrase this turn', 'else refused'],
  ['gate · approvals', 'risky action → phone-gated', 'waits for "approve N"'],
  ['law · GROK reasoning_effort', 'none', 'native reasoning forbidden'],
  ['cache · KV dir snapshot', '30–60s TTL', 'stale-tolerant directory reads'],
];
const HAVE = ['Pages', 'Pages Functions', 'Workers', 'D1 (×2)', 'KV', 'R2', 'Workers AI', 'AI Gateway (gw:)', 'Queues', 'Durable Objects'];
const DONT = ['Workers for Platforms (dynamic Workers)', 'Browser Rendering binding (REST only)', 'Vectorize', 'Hyperdrive', 'Workflows (sibling worker only)', 'Pipelines', 'Stream', 'Images', 'Email Routing / Sending', 'Cron Triggers', 'WebSockets / DO hibernation', 'Service Bindings', 'Access / Zero Trust / mTLS', 'Secrets Store', 'Containers', 'Analytics Engine', 'Logpush / Tail Workers', 'Turnstile', 'Zaraz', 'WAF / Rate Limiting'];
// Every wired CLI_* row vs whether the binary is on the owner's Mac (which-sweep 2026-06-14).
// run_via: the build calls these on the remote exec host agent.cannibal.capital, NOT this Mac.
const CLIS = [
  ['aider', 1], ['aws', 0], ['brew', 1], ['bun', 1], ['clasp', 1], ['claude', 1], ['codex', 1], ['curl', 1], ['deno', 0], ['docker', 1], ['fd', 1], ['ffmpeg', 1], ['gcloud', 1], ['gemini', 1], ['gh', 1], ['git', 1], ['goose', 1], ['dot (graphviz)', 0], ['http (httpie)', 0], ['interpreter', 1], ['jq', 1], ['kubectl', 0], ['magick', 0], ['node', 1], ['npm', 1], ['openai', 0], ['openhands', 0], ['pandoc', 1], ['plandex', 0], ['pnpm', 1], ['psql', 0], ['python3', 1], ['rg', 1], ['sqlite3', 0], ['terraform', 0], ['typst', 0], ['wrangler', 1], ['yt-dlp', 0],
];
const CLI_UNKNOWN = ['grok-sa', 'grok-xai'];
// Wired API providers (directory http rows), grouped by host. Key-present ("in play") is
// UNKNOWN here — Pages secrets are not readable locally.
const APIS = [
  ['Cloudflare API', 'api.cloudflare.com', 'AIG_*, CF, BROWSER_* (rendering)'],
  ['xAI / Grok', 'api.x.ai', 'GROK_IMAGE, GROK_TTS, GROK_VIDEO_*, models'],
  ['OpenAI', 'api.openai.com', 'OPENAI_IMAGE, tts, whisper'],
  ['Google Gemini', 'generativelanguage.googleapis.com', 'GEMINI_GENERATE'],
  ['Google Workspace (GAS)', '$AIRUNNER_WEB_APP_URL', 'GOOGLE_SHEETS/DRIVE/CALENDAR/TASKS, APPS_SCRIPT_RUN'],
  ['Blooio', 'backend.blooio.com', 'BLOOIO (iMessage/SMS), CHANNEL_APIS'],
  ['Stripe', 'api.stripe.com', 'STRIPE_READ, STRIPE_WRITE (gated)'],
  ['GitHub', 'api.github.com', 'GITHUB target_map'],
  ['ArcAds', 'external-api.arcads.ai', 'ARCADS_ROUTES'],
  ['Klaviyo / Meta / BigCommerce / TripleWhale', 'various', 'KLAVIYO, META, BC, TW'],
  ['2chat', 'api.p.2chat.io', 'TWOCHAT_SEND'],
  ['Remote exec host', 'agent.cannibal.capital', 'every CLI_* + BROWSER_USE/PLAYWRIGHT + DESKTOP_*'],
  ['Sibling Worker', 'loop-safe-sibling.workers.dev', 'SIBLING_* (uses CF Workflows)'],
];

function renderCC(s) {
  if (!s || !s.turns) return '<div class="lbl">Claude Code</div><p class="sub">No back-populated sessions yet.</p>';
  const e = x => String(x == null ? '' : x).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const max = a => (a && a.length ? Math.max(...a.map(x => x.v)) : 1);
  const bars = a => (a || []).map(x => '<div class="ccbar"><span class="cn">' + e(x.k) + '</span><span class="cb" style="width:' + Math.round(x.v / max(a) * 100) + '%"></span><span class="cv">' + x.v + '</span></div>').join('');
  const list = a => (a || []).map(x => '<div class="ccf"><span class="cv">' + x.v + '</span> ' + e(x.k) + '</div>').join('');
  const hasChip = h => h === true ? '<span class="hh yes">has</span>' : h === false ? '<span class="hh no">GAP</span>' : '<span class="hh part">' + e(h) + '</span>';
  const inv = (s.inventory || []).map(i => '<tr><td>' + e(i.group) + '</td><td class="mono">' + e((i.claude || []).join(', ')) + '</td><td class="mono">' + e((i.build || []).join(', ')) + '</td><td>' + hasChip(i.has) + '</td></tr>').join('');
  return `
<style>
.cc2{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin:8px 0 16px}
.ccbar{display:flex;align-items:center;gap:8px;font-size:12px;margin:2px 0}
.ccbar .cn{width:120px;font-family:var(--font-mono);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--ds-soft)}
.ccbar .cb{height:10px;background:var(--ds-accent);border-radius:2px;min-width:2px}
.ccbar .cv{color:var(--muted);font-size:11px}
.ccf{font-size:12px;margin:2px 0;color:var(--ds-soft)}.ccf .cv{display:inline-block;width:34px;color:var(--ds-accent);font-weight:600}
.invt{width:100%;border-collapse:collapse;font-size:12.5px;margin-top:6px}
.invt th,.invt td{border-bottom:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}
.hh{display:inline-block;padding:1px 7px;border-radius:99px;font-size:10.5px;font-weight:700}
.hh.yes{background:rgba(122,154,123,.14);color:var(--ds-sage)}.hh.no{background:rgba(184,107,90,.14);color:#d89c8c}.hh.part{background:var(--warn-bg);color:var(--warn-ink)}
</style>
<h2>Claude Code — what it does &amp; what it has (back-populated)</h2>
<p class="sub">Rebuilt from every logged session: <b>${s.sessions}</b> sessions, <b>${s.turns}</b> turns. Full per-turn log + adversarial audits: <a href="/admin/cc">/admin/cc</a>. Generated ${e(s.generated_at || '')}.</p>
<div class="cc2">
  <div><div class="lbl">Tool use (count)</div>${bars(s.tool_tally)}</div>
  <div><div class="lbl">Shell commands (count)</div>${bars(s.command_bins)}</div>
  <div><div class="lbl">Most-edited files</div>${list(s.top_edited)}</div>
  <div><div class="lbl">Most-viewed files</div>${list(s.top_viewed)}</div>
</div>
<div class="lbl">Tool inventory — what Claude has vs what this build has</div>
<table class="invt"><tr><th>capability</th><th>Claude tools</th><th>this build's equivalent</th><th>build</th></tr>${inv}</table>
`;
}

export async function onRequestGet(context) {
  const { env } = context;
  let stats = {};
  try { const r = await env.DB.prepare("SELECT json FROM cc_stats WHERE key='summary'").first(); stats = r && r.json ? JSON.parse(r.json) : {}; } catch (e) {}
  const ccSection = renderCC(stats);
  const body = `
<style>
.map{max-width:1100px}
.map .lead{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 16px}
.map .lbl{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);margin-bottom:5px}
.map .pill{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--line-strong);border-radius:99px;padding:3px 10px;font-size:11.5px;background:#fff;color:#0a0a0a}
.map .dot{width:8px;height:8px;border-radius:99px;display:inline-block}
.map .boot{display:inline-block;border:1px solid var(--line);border-radius:6px;padding:4px 9px;font-size:12px;margin:0 6px 6px 0}
.map .boot code{background:#eef0f3}
.map .grid{display:grid;grid-template-columns:220px 1fr;gap:16px}
.map .asks{display:flex;flex-direction:column;gap:6px}
.map .askbtn{text-align:left;font-size:13px;padding:9px 11px;border:1px solid var(--line);border-radius:6px;background:#fff;cursor:pointer;color:var(--ink)}
.map .askbtn.on{border-color:var(--accent);background:var(--accent-soft);color:var(--accent);font-weight:500}
.map .detail{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:16px 18px;min-height:320px}
.map .detail h2{font-size:16px;margin:0 0 6px}
.map .grp{margin-bottom:12px}
.map .mono{font-family:var(--mono);font-size:12.5px}
.map .sub{font-size:12.5px;color:var(--muted)}
.map .bundle{border-top:1px solid var(--line);margin-top:8px;padding-top:8px}
.map .bundle ul{margin:0;padding-left:18px}
.map .matrix-row{display:flex;justify-content:space-between;align-items:center;gap:8px;border-bottom:1px solid var(--line);padding:6px 0}
.map .matrix-row .tags{display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end}
</style>
<div class="map">
<h1>Build map — request → files → service</h1>
<p class="subtitle">Pick a request type. It shows the exact files + sections to edit, the Cloudflare service touched, the deploy step, and the minimal context to hand an editing model. Sibling of <a href="/admin/directory/graph">the tag graph</a>.</p>

${ccSection}

<div class="lbl">Bootstrap loaded before any edit</div>
<div id="boot"></div>

<div class="lbl" style="margin-top:14px">How big is the build — and what a model needs to understand it</div>
<div id="tiers" style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:6px 0 14px"></div>
<div class="lbl">File structure by size (blue = build logic · grey = reference/history)</div>
<div id="sizebars" style="margin:6px 0 8px"></div>
<details style="margin-bottom:14px"><summary style="cursor:pointer;font-size:13px;color:var(--muted)">Largest files</summary><div id="topfiles" style="margin-top:8px"></div></details>

<div class="lbl" style="margin-top:14px">7 Cloudflare services in this build</div>
<div class="lead" id="legend"></div>

<div class="grid">
  <div class="asks" id="asks"></div>
  <div class="detail" id="detail"></div>
</div>

<div class="lbl" style="margin-top:18px">File ↔ service graph — hover a node to isolate its edges</div>
<svg id="fsgraph" preserveAspectRatio="xMidYMin meet" xmlns="http://www.w3.org/2000/svg" style="width:100%;border:1px solid var(--line);border-radius:8px;background:#fff;margin-top:4px"></svg>

<div class="lbl" style="margin-top:18px">Every core file, grouped by service</div>
<div id="matrix" style="margin-top:4px"></div>

<div class="lbl" style="margin-top:22px">Live binding specs</div>
<table style="font-size:12.5px"><thead><tr><th>binding</th><th>type</th><th>name</th><th>size / detail</th><th>holds</th></tr></thead><tbody id="specs"></tbody></table>

<div class="lbl" style="margin-top:22px">World rules — boolean, low → high precedence</div>
<table style="font-size:12.5px"><thead><tr><th>rule</th><th>value</th><th>effect</th></tr></thead><tbody id="rules"></tbody></table>

<div class="lbl" style="margin-top:22px">Cloudflare features — have vs don't have</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
  <div><div class="sub" style="margin-bottom:5px;color:#178c45">have</div><div id="have"></div></div>
  <div><div class="sub" style="margin-bottom:5px;color:#c0392b">don't have</div><div id="dont"></div></div>
</div>

<div class="lbl" style="margin-top:22px">CLIs wired in the build vs present on this Mac</div>
<div id="clisummary" class="sub" style="margin-bottom:6px"></div>
<div id="clis" style="display:flex;flex-wrap:wrap;gap:5px"></div>
<div class="sub" style="margin-top:8px">green = wired + on this Mac · amber = wired but not on this Mac (may exist on the remote exec host — unknown). All CLIs run via agent.cannibal.capital, not this Mac.</div>

<div class="lbl" style="margin-top:22px">APIs wired in the build (key-present / "in play" = unknown, secrets not readable here)</div>
<div id="apis"></div>
</div>
<script>
var SVC=${JSON.stringify(SVC)}, BOOT=${JSON.stringify(BOOT)}, PB=${JSON.stringify(PB)}, FILES=${JSON.stringify(FILES)}, SIZES=${JSON.stringify(SIZES)};
var GROUP=${JSON.stringify(GROUP)}, GROUP_LABEL=${JSON.stringify(GROUP_LABEL)}, SPECS=${JSON.stringify(SPECS)}, RULES=${JSON.stringify(RULES)}, HAVE=${JSON.stringify(HAVE)}, DONT=${JSON.stringify(DONT)}, CLIS=${JSON.stringify(CLIS)}, CLI_UNKNOWN=${JSON.stringify(CLI_UNKNOWN)}, APIS=${JSON.stringify(APIS)};
function e(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function kb(b){return b<1024?b+' B':(b<1048576?(b/1024).toFixed(0)+' KB':(b/1048576).toFixed(2)+' MB');}
function tok(b){var t=Math.round(b/4);return t<1000?t:(t/1000).toFixed(t<100000?1:0)+'k';}
(function(){
 document.getElementById('tiers').innerHTML=SIZES.tiers.map(function(t,i){
  var c=i===1?'var(--accent)':'var(--ink)';
  return '<div style="background:var(--panel);border:1px solid '+(i===1?'var(--accent)':'var(--line)')+';border-radius:8px;padding:10px 12px">'
   +'<div class="sub" style="margin-bottom:3px">'+e(t.k)+'</div>'
   +'<div style="font-size:22px;font-weight:700;color:'+c+'">~'+tok(t.bytes)+' tok</div>'
   +'<div class="sub">'+t.files+' files · '+kb(t.bytes)+'</div>'
   +'<div class="sub" style="margin-top:4px;font-size:11px">'+e(t.note)+'</div></div>';
 }).join('');
 var max=Math.max.apply(null,SIZES.groups.map(function(g){return g[1];}));
 document.getElementById('sizebars').innerHTML=SIZES.groups.map(function(g){
  var w=Math.max(1,g[1]/max*100), col=g[3]==='logic'?'var(--accent)':'#b6b6b6';
  return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">'
   +'<span class="mono" style="width:230px;font-size:11.5px;text-align:right;color:var(--ink-soft)">'+e(g[0])+'</span>'
   +'<div style="flex:1;background:#eef0f3;border-radius:3px;height:16px;position:relative">'
   +'<div style="width:'+w+'%;background:'+col+';height:16px;border-radius:3px"></div></div>'
   +'<span class="sub mono" style="width:120px">'+kb(g[1])+' · ~'+tok(g[1])+'</span></div>';
 }).join('');
 document.getElementById('topfiles').innerHTML=SIZES.topFiles.map(function(f){
  return '<div class="matrix-row"><span class="mono" style="font-size:12px">'+e(f[0])+'</span>'
   +'<span class="sub mono">'+kb(f[1])+' · ~'+tok(f[1])+' '+(f[2]==='logic'?'<span style="color:var(--accent)">logic</span>':'ref')+'</span></div>';
 }).join('');
})();
function chip(s){var v=SVC[s];return '<span class="pill"><span class="dot" style="background:'+v.c+'"></span>'+e(v.l)+'</span>';}
document.getElementById('legend').innerHTML=Object.keys(SVC).map(chip).join('');
document.getElementById('boot').innerHTML=BOOT.map(function(b){return '<span class="boot"><code>'+e(b.f)+'</code> <span class="sub">'+e(b.n)+'</span></span>';}).join('');
function grp(label,inner){return '<div class="grp"><div class="lbl">'+label+'</div>'+inner+'</div>';}
function pick(i){
  document.querySelectorAll('.askbtn').forEach(function(b,j){b.classList.toggle('on',j===i);});
  var p=PB[i];
  var edits=p.edit.map(function(x){return '<div style="margin-bottom:6px"><span class="mono">'+e(x[0])+'</span><br><span class="sub">'+e(x[1])+'</span></div>';}).join('');
  var reads=p.read.map(function(r){return '<div class="sub mono" style="margin-bottom:3px">'+e(r)+'</div>';}).join('');
  var bundle=p.bundle.map(function(b){return '<li class="mono" style="margin-bottom:3px">'+e(b)+'</li>';}).join('');
  document.getElementById('detail').innerHTML='<h2>'+e(p.k)+'</h2>'
    +'<div style="margin-bottom:12px">'+p.svc.map(chip).join(' ')+'</div>'
    +grp('edit here',edits)+grp('read for context',reads)
    +grp('deploy','<div class="sub">'+e(p.deploy)+'</div>')
    +'<div class="bundle"><div class="lbl">minimal context to hand a model</div><ul>'+bundle+'</ul></div>';
}
document.getElementById('asks').innerHTML=PB.map(function(p,i){return '<button class="askbtn" onclick="pick('+i+')">'+e(p.k)+'</button>';}).join('');
document.getElementById('matrix').innerHTML=FILES.map(function(f){return '<div class="matrix-row"><span class="mono">'+e(f[0])+'</span><span class="tags">'+f[1].map(chip).join('')+'</span></div>';}).join('');

function drawGraph(){
  var ORDER={compute:0,data:1,external:2};
  var svcKeys=Object.keys(SVC).sort(function(a,b){ return (ORDER[GROUP[a]]-ORDER[GROUP[b]]); });
  var W=1000, padT=40, rowF=30, rowS=Math.max(rowF*FILES.length,40)/svcKeys.length;
  var H=padT*2+Math.max(FILES.length*rowF, svcKeys.length*rowS);
  var fx=18, fw=300, sx=W-230, sw=212;
  var fY={}, sY={};
  FILES.forEach(function(f,i){ fY[f[0]]=padT+i*rowF+rowF/2; });
  svcKeys.forEach(function(s,i){ sY[s]=padT+i*((H-2*padT)/svcKeys.length)+((H-2*padT)/svcKeys.length)/2; });
  var edges='', nodes='', bands='';
  // group bands behind the service column — shows Worker(compute) vs D1/R2/KV(data) as distinct clusters
  var byG={}; svcKeys.forEach(function(s){ (byG[GROUP[s]]=byG[GROUP[s]]||[]).push(s); });
  Object.keys(byG).forEach(function(gk){
    var ys=byG[gk].map(function(s){return sY[s];});
    var top=Math.min.apply(null,ys)-15, bot=Math.max.apply(null,ys)+15;
    bands+='<rect x="'+(sx-12)+'" y="'+top+'" width="'+(sw+24)+'" height="'+(bot-top)+'" rx="8" fill="#f0f3f8" stroke="#cfd8e6"/>';
    bands+='<text x="'+(sx+sw/2)+'" y="'+(top-5)+'" font-size="10.5" font-weight="700" text-anchor="middle" fill="#3a3a3a">'+e(GROUP_LABEL[gk])+'</text>';
  });
  FILES.forEach(function(f){
    f[1].forEach(function(s){
      edges+='<line class="edge" data-f="'+e(f[0])+'" data-s="'+s+'" x1="'+(fx+fw)+'" y1="'+fY[f[0]]+'" x2="'+sx+'" y2="'+sY[s]+'" stroke="'+SVC[s].c+'" stroke-width="1.1" opacity="0.45"/>';
    });
  });
  FILES.forEach(function(f){
    var y=fY[f[0]];
    nodes+='<g class="fn" data-f="'+e(f[0])+'" style="cursor:pointer"><rect x="'+fx+'" y="'+(y-12)+'" width="'+fw+'" height="24" rx="5" fill="#f6f7f9" stroke="#b6b6b6"/>'
      +'<text x="'+(fx+8)+'" y="'+(y+4)+'" font-size="11.5" font-family="monospace" fill="#0a0a0a">'+e(f[0].length>44?f[0].slice(0,43)+'…':f[0])+'</text></g>';
  });
  svcKeys.forEach(function(s){
    var y=sY[s];
    nodes+='<g class="sn" data-s="'+s+'" style="cursor:pointer"><rect x="'+sx+'" y="'+(y-12)+'" width="'+sw+'" height="24" rx="5" fill="'+SVC[s].c+'"/>'
      +'<text x="'+(sx+sw/2)+'" y="'+(y+4)+'" font-size="11.5" font-weight="700" text-anchor="middle" fill="#fff">'+e(SVC[s].l)+'</text></g>';
  });
  var g=document.getElementById('fsgraph');
  g.setAttribute('viewBox','0 0 '+W+' '+H);
  g.innerHTML=bands+edges+nodes;
  function setHL(fn){ g.querySelectorAll('.edge').forEach(function(ed){ ed.setAttribute('opacity', fn(ed)?'0.95':'0.07'); ed.setAttribute('stroke-width', fn(ed)?'2':'1.1'); }); }
  function clear(){ g.querySelectorAll('.edge').forEach(function(ed){ ed.setAttribute('opacity','0.45'); ed.setAttribute('stroke-width','1.1'); }); }
  g.querySelectorAll('.fn').forEach(function(n){ n.onmouseenter=function(){ setHL(function(ed){return ed.getAttribute('data-f')===n.getAttribute('data-f');}); }; n.onmouseleave=clear; });
  g.querySelectorAll('.sn').forEach(function(n){ n.onmouseenter=function(){ setHL(function(ed){return ed.getAttribute('data-s')===n.getAttribute('data-s');}); }; n.onmouseleave=clear; });
}
drawGraph();
pick(0);

document.getElementById('specs').innerHTML=SPECS.map(function(s){return '<tr><td class="mono"><b>'+e(s[0])+'</b></td><td>'+e(s[1])+'</td><td class="mono">'+e(s[2])+'</td><td class="sub">'+e(s[3])+'</td><td class="sub">'+e(s[4])+'</td></tr>';}).join('');
document.getElementById('rules').innerHTML=RULES.map(function(r){return '<tr><td class="mono">'+e(r[0])+'</td><td class="mono"><b>'+e(r[1])+'</b></td><td class="sub">'+e(r[2])+'</td></tr>';}).join('');
function flagchip(t,c){return '<span class="pill" style="border-color:'+c+'">'+e(t)+'</span>';}
document.getElementById('have').innerHTML='<div style="display:flex;flex-wrap:wrap;gap:5px">'+HAVE.map(function(x){return flagchip(x,'#9bd3b0');}).join('')+'</div>';
document.getElementById('dont').innerHTML='<div style="display:flex;flex-wrap:wrap;gap:5px">'+DONT.map(function(x){return flagchip(x,'#e6b3aa');}).join('')+'</div>';
var on=CLIS.filter(function(c){return c[1];}).length;
document.getElementById('clisummary').textContent=CLIS.length+' CLIs wired · '+on+' on this Mac · '+(CLIS.length-on)+' not on this Mac · '+CLI_UNKNOWN.length+' custom (grok) unverified';
document.getElementById('clis').innerHTML=CLIS.map(function(c){var col=c[1]?'#dff5e6':'#fff3da',br=c[1]?'#9bd3b0':'#e6c97a';return '<span class="pill" style="background:'+col+';border-color:'+br+'">'+e(c[0])+'</span>';}).join('')+CLI_UNKNOWN.map(function(c){return '<span class="pill" style="background:#eef0f3;border-color:#cfcfcf">'+e(c)+' ?</span>';}).join('');
document.getElementById('apis').innerHTML=APIS.map(function(a){return '<div class="matrix-row"><span><b style="font-size:12.5px">'+e(a[0])+'</b> <span class="sub mono">'+e(a[1])+'</span></span><span class="sub" style="max-width:520px;text-align:right">'+e(a[2])+'</span></div>';}).join('');
</script>
`;
  return new Response(shellHtml({ activeHref: '/admin/map', title: 'Build map', body }), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}
