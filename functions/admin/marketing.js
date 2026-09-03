import { shellHtml } from './_layout.js';
import { logEvent } from '../_lib/event_log.js';
import {
  marketingAccountsFull, getMarketingState,
} from '../_lib/marketing_hub.js';
import { loadAll as loadOutreachLoop, textDump as outreachLoopText } from '../_lib/outreach_loop.js';
import { loadVolume } from '../_lib/outreach_volume.js';
import { lblMetaCreatives, lblCloakerEvents } from '../_lib/lbl_viewer.js';
import {
  renderAccountsLive, renderAccountsLbl, renderCreatives, renderCloaker, renderLedgerStrip, esc,
} from '../_lib/marketing_render.js';

async function recentMarketingLedger(env, limit = 12) {
  if (!env.LEDGER) return [];
  try {
    const r = await env.LEDGER.prepare(
      `SELECT id, ts, key, action, status, trace_id FROM events
       WHERE source = 'marketing' ORDER BY ts DESC LIMIT ?`
    ).bind(limit).all();
    return r.results || [];
  } catch {
    return [];
  }
}

const STYLES = `
<style>
.mkt{display:grid;gap:var(--space-3,18px);max-width:1200px}
.mkt nav.sub{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:8px}
.mkt nav.sub button{padding:7px 13px;border:1px solid var(--line);background:var(--panel);color:var(--ink-soft);border-radius:999px;cursor:pointer;font-size:12px;font-weight:600}
.mkt nav.sub button:hover{border-color:var(--line-strong);color:var(--ink)}
.mkt nav.sub button.on{background:var(--ds-accent-soft,rgba(201,169,97,.12));border-color:var(--accent);color:var(--accent)}
.mkt .card{border:1px solid var(--line);border-radius:var(--radius,12px);padding:var(--space-2,16px);background:var(--panel)}
.mkt table{width:100%;border-collapse:collapse;font-size:12px;font-variant-numeric:tabular-nums;background:transparent}
.mkt th,.mkt td{padding:7px 9px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
.mkt th{color:var(--accent);font-weight:600;font:600 9.5px/1.4 var(--mono);text-transform:uppercase;letter-spacing:.12em;background:transparent;position:static}
.mkt td{color:var(--ink-soft)}
.mkt .muted{color:var(--muted);font-size:12px}
.mkt .ok{color:var(--ds-sage,#7a9a7b)}.mkt .err{color:#b86b5a}
.mkt pre{font-family:var(--mono);font-size:11px;white-space:pre-wrap;max-height:320px;overflow:auto;background:var(--bg);color:var(--ink-soft);border:1px solid var(--line);padding:12px;border-radius:8px}
.mkt .row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.mkt input,textarea{background:var(--panel);color:var(--ink);border:1px solid var(--line-strong);padding:7px 9px;border-radius:6px;font-size:13px}
.mkt textarea{width:100%;min-height:100px;font-family:var(--mono)}
.mkt .banner{border:1px solid var(--warn-border);background:var(--warn-bg);color:var(--warn-ink);padding:10px 14px;border-radius:8px;font-size:12px}
.mkt .tile-num{font-family:var(--font-display);font-size:30px;font-weight:600;color:var(--ink);line-height:1.05}
.mkt .scope-chip{display:inline-block;padding:3px 9px;margin:2px;border-radius:999px;font:600 10.5px/1.5 var(--mono);letter-spacing:.03em}
.mkt .scope-chip.yes{background:rgba(122,154,123,.14);color:var(--ds-sage,#7a9a7b);border:1px solid rgba(122,154,123,.4)}
.mkt .scope-chip.no{background:rgba(184,107,90,.12);color:#d89a8a;border:1px solid rgba(184,107,90,.4)}
.mkt .op-chip{display:inline-block;padding:3px 10px;margin:3px;border-radius:999px;font:500 11px/1.5 var(--mono);background:var(--ds-accent-soft,rgba(201,169,97,.12));border:1px solid rgba(201,169,97,.35);color:var(--accent)}
</style>`;

const CLIENT_SCRIPT = `
<script>
const $ = (id) => document.getElementById(id);
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function table(rows, cols) {
  if (!rows || !rows.length) return '<p class="muted">(empty)</p>';
  let h = '<table><thead><tr>' + cols.map(c => '<th>' + esc(c.label) + '</th>').join('') + '</tr></thead><tbody>';
  for (const r of rows) {
    h += '<tr>' + cols.map(c => {
      const raw = c.fmt ? c.fmt(r) : r[c.key];
      const cell = c.html ? String(raw == null ? '' : raw) : esc(raw);
      return '<td>' + cell + '</td>';
    }).join('') + '</tr>';
  }
  return h + '</tbody></table>';
}
function showErr(el, r, d) {
  el.innerHTML = '<p class="err">HTTP ' + r.status + ': ' + esc(JSON.stringify(d)) + '</p>';
}
document.querySelectorAll('.mkt nav.sub button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mkt nav.sub button').forEach(b => b.classList.remove('on'));
    btn.classList.add('on');
    ['portfolio','volume','outreach','utm','accounts','mcp','creatives','cloaker','state','ledger'].forEach(p => {
      $('pane-' + p).style.display = p === btn.dataset.pane ? '' : 'none';
    });
  });
});
async function loadAccounts() {
  const r = await fetch('/api/marketing/accounts', { credentials: 'same-origin' });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { showErr($('accounts-live'), r, d); $('accounts-lbl').innerHTML = ''; return; }
  const live = d.live || {};
  $('accounts-live').innerHTML = live.ok
    ? '<p class="ok">' + live.count + ' accounts (business ' + esc(live.business_id) + ')</p>' + table(live.accounts, [
        {key:'id',label:'ID'},{key:'name',label:'Name'},{key:'account_status',label:'Status'},{key:'currency',label:'Cur'},
        {key:'id',label:'',html:true,fmt: row => '<a href="#" data-act="'+esc(row.id)+'">drill</a>'}
      ])
    : '<p class="err">' + esc(JSON.stringify(live.errors || live)) + '</p>';
  $('accounts-live').querySelectorAll('[data-act]').forEach(a => {
    a.addEventListener('click', async (e) => {
      e.preventDefault();
      const id = a.dataset.act;
      $('account-detail').innerHTML = 'loading ' + esc(id) + '…';
      const dr = await fetch('/api/marketing/account/' + encodeURIComponent(id), { credentials: 'same-origin' });
      const dd = await dr.json().catch(() => ({}));
      $('account-detail').innerHTML = dr.ok ? '<pre>' + esc(JSON.stringify(dd, null, 2)) + '</pre>' : showErr($('account-detail'), dr, dd);
    });
  });
  const lbl = d.lbl_d1 || {};
  $('accounts-lbl').innerHTML = lbl.error
    ? '<p class="err">' + esc(lbl.error) + (lbl.hint ? ' — ' + esc(lbl.hint) : '') + '</p>'
    : table(lbl.rows || [], [
        {key:'account_id',label:'Account'},{key:'account_name',label:'Name'},{key:'campaigns',label:'Campaigns'},
        {key:'ads',label:'Ads'},{key:'spend_cents',label:'Spend ¢',fmt: r => (Number(r.spend_cents||0)/100).toFixed(2)},{key:'purchases',label:'Purchases'}
      ]);
}
async function loadCreatives() {
  const r = await fetch('/api/marketing/creatives', { credentials: 'same-origin' });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) return showErr($('creatives-body'), r, d);
  $('creatives-body').innerHTML = d.lbl?.error ? '<p class="err">' + esc(d.lbl.error) + '</p>' : table((d.lbl?.rows||[]).slice(0,100), [
    {key:'headline',label:'Headline'},{key:'ad_count',label:'Ads'},{key:'spend_cents',label:'Spend ¢',fmt: r => (Number(r.spend_cents||0)/100).toFixed(2)},
    {key:'link_clicks',label:'Clicks'},{key:'website_url',label:'URL'}
  ]);
}
async function loadCloaker() {
  const r = await fetch('/api/marketing/cloaker?limit=100', { credentials: 'same-origin' });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) return showErr($('cloaker-body'), r, d);
  const rows = d.rows || d.results || (Array.isArray(d) ? d : []);
  $('cloaker-body').innerHTML = d.error ? '<p class="err">' + esc(d.error) + '</p>' : table(rows, [
    {key:'received_at',label:'Time'},{key:'slug',label:'Slug'},{key:'classification',label:'Class'},
    {key:'country',label:'Country'},{key:'device',label:'Device'},{key:'referer',label:'Referer'}
  ]);
}
async function loadState() {
  const r = await fetch('/api/marketing/state', { credentials: 'same-origin' });
  const d = await r.json().catch(() => ({}));
  if (r.ok) $('state-json').value = JSON.stringify(d, null, 2);
  const fr = await fetch('/api/settings/customer_funnel', { credentials: 'same-origin' });
  if (fr.ok) { const fd = await fr.json(); $('funnel-json').value = fd.value || ''; }
}
async function refreshAll() {
  $('status').textContent = 'loading…';
  try {
    await Promise.all([loadAccounts(), loadCreatives(), loadCloaker(), loadState()]);
    $('status').textContent = 'refreshed ' + new Date().toLocaleTimeString();
    $('fetch-banner').style.display = 'none';
  } catch (e) {
    $('status').textContent = 'refresh failed — SSR data still visible';
    $('fetch-banner').style.display = '';
    $('fetch-banner').textContent = 'Client refresh failed: ' + String(e);
  }
}
$('btn-refresh').addEventListener('click', refreshAll);
$('btn-sync').addEventListener('click', async () => {
  $('status').textContent = 'syncing…';
  const r = await fetch('/api/marketing/sync', { method: 'POST', credentials: 'same-origin' });
  const d = await r.json().catch(() => ({}));
  $('status').textContent = r.ok ? 'backfill started — see Ledger tab' : ('sync failed: ' + JSON.stringify(d));
  await loadAccounts();
  location.hash = 'ledger';
});
$('btn-save-state').addEventListener('click', async () => {
  try {
    const patch = JSON.parse($('state-json').value);
    const r = await fetch('/api/marketing/state', { method: 'PUT', headers: {'content-type':'application/json'}, credentials: 'same-origin', body: JSON.stringify(patch) });
    const d = await r.json();
    $('state-status').textContent = r.ok ? 'saved' : ('err ' + JSON.stringify(d));
  } catch (e) { $('state-status').textContent = 'invalid JSON'; }
});
$('btn-save-funnel').addEventListener('click', async () => {
  await fetch('/api/settings/customer_funnel', { method: 'PUT', headers: {'content-type':'application/json'}, credentials: 'same-origin', body: JSON.stringify({ value: $('funnel-json').value }) });
  $('state-status').textContent = 'funnel saved';
});
if ($('mcp-run')) {
  $('mcp-run').addEventListener('click', async () => {
    const op = $('mcp-op').value;
    let args = {};
    try { args = JSON.parse($('mcp-args').value || '{}'); } catch (e) { $('mcp-status').textContent = 'invalid args JSON'; return; }
    $('mcp-status').textContent = 'running ' + op + '…';
    const r = await fetch('/api/marketing/meta/' + op, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(args) });
    const d = await r.json().catch(() => ({}));
    $('mcp-status').textContent = 'HTTP ' + r.status + (d && d.ok === false ? ' · error' : ' · ok');
    $('mcp-result').textContent = JSON.stringify(d, null, 2);
  });
}
async function metaOp(op, args) {
  const r = await fetch('/api/marketing/meta/' + op, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(args || {}) });
  return r.json().catch(() => ({}));
}
document.querySelectorAll('[data-drill]').forEach(a => a.addEventListener('click', async (e) => {
  e.preventDefault();
  const id = a.dataset.drill;
  const box = $('pf-drill');
  box.innerHTML = '<p class="muted">loading ' + esc(id) + '…</p>';
  const [camp, ads, ins] = await Promise.all([
    metaOp('campaigns', { account_id: id }),
    metaOp('ads', { account_id: id }),
    metaOp('insights', { account_id: id, level: 'campaign', date_preset: 'last_30d', fields: 'campaign_name,spend,impressions,clicks,ctr,cpc,purchase_roas' }),
  ]);
  const cs = (camp.data && camp.data.data) || [];
  const as = (ads.data && ads.data.data) || [];
  const is = (ins.data && ins.data.data) || [];
  let h = '<div class="card"><h3 style="font-size:14px;margin:0 0 8px">' + esc(id) + ' — ' + cs.length + ' campaigns · ' + as.length + ' ads · last-30d insights</h3>';
  if (is.length) h += '<h4 style="font-size:12px;margin:8px 0 4px;color:var(--muted)">Insights (last 30d, by campaign)</h4>' + table(is, [
    { key: 'campaign_name', label: 'Campaign' }, { key: 'spend', label: 'Spend', fmt: r => '$' + Number(r.spend || 0).toLocaleString() },
    { key: 'impressions', label: 'Impr' }, { key: 'clicks', label: 'Clicks' }, { key: 'ctr', label: 'CTR%', fmt: r => Number(r.ctr || 0).toFixed(2) },
    { key: 'cpc', label: 'CPC', fmt: r => '$' + Number(r.cpc || 0).toFixed(2) },
    { key: 'purchase_roas', label: 'ROAS', fmt: r => (r.purchase_roas && r.purchase_roas[0] ? Number(r.purchase_roas[0].value).toFixed(2) : '—') },
  ]);
  h += '<h4 style="font-size:12px;margin:12px 0 4px;color:var(--muted)">Campaigns</h4>' + table(cs, [
    { key: 'name', label: 'Name' }, { key: 'status', label: 'Status' }, { key: 'objective', label: 'Objective' },
    { key: 'daily_budget', label: 'Daily $', fmt: r => r.daily_budget ? '$' + (Number(r.daily_budget) / 100).toFixed(2) : '—' },
  ]);
  h += '<h4 style="font-size:12px;margin:12px 0 4px;color:var(--muted)">Ads (' + as.length + ', first 50)</h4>' + table(as.slice(0, 50), [
    { key: 'name', label: 'Ad' }, { key: 'effective_status', label: 'Status' },
    { key: 'creative', label: 'Creative', fmt: r => r.creative && r.creative.thumbnail_url ? r.creative.name || r.creative.id : (r.creative && r.creative.id || '—') },
  ]);
  h += '</div>';
  box.innerHTML = h;
  box.scrollIntoView({ behavior: 'smooth', block: 'start' });
}));
// UTM builder
let utmLastField = 'utm-campaign';
['utm-campaign','utm-content','utm-term','utm-source','utm-medium','utm-base'].forEach(id => { const el = $(id); if (el) el.addEventListener('focus', () => utmLastField = id); });
document.querySelectorAll('.utm-dyn').forEach(b => b.addEventListener('click', () => {
  const el = $(utmLastField) || $('utm-campaign'); if (!el) return;
  const s = el.selectionStart != null ? el.selectionStart : el.value.length;
  el.value = el.value.slice(0, s) + b.dataset.tok + el.value.slice(s); el.focus();
}));
function buildUtm() {
  const base = ($('utm-base').value || '').trim();
  const parts = [['utm_source','utm-source'],['utm_medium','utm-medium'],['utm_campaign','utm-campaign'],['utm_content','utm-content'],['utm_term','utm-term']]
    .map(([k, id]) => { const v = ($(id).value || '').trim(); return v ? k + '=' + encodeURIComponent(v).replace(/%7B%7B/g, '{{').replace(/%7D%7D/g, '}}') : null; }).filter(Boolean);
  const qs = parts.join('&');
  $('utm-params').textContent = qs;
  const full = base ? base + (base.includes('?') ? '&' : '?') + qs : qs;
  $('utm-out').value = full;
  return full;
}
if ($('utm-build')) $('utm-build').addEventListener('click', () => { buildUtm(); $('utm-status').textContent = 'built'; });
if ($('utm-copy')) $('utm-copy').addEventListener('click', async () => { const v = $('utm-out').value || buildUtm(); try { await navigator.clipboard.writeText(v); $('utm-status').textContent = 'copied'; } catch { $('utm-status').textContent = 'select + copy manually'; } });
</script>`;

const META_MCP_GROUPS = {
  'Comprehensive reporting': ['insights', 'insights-async-create', 'insights-async-status', 'insights-async-result'],
  'Accounts & objects': ['accounts', 'account-get', 'object-get', 'activities'],
  'Ad creation & management': ['campaigns', 'adsets', 'ads', 'creatives', 'images', 'videos', 'campaign-create', 'campaign-update', 'adset-create', 'adset-update', 'ad-create', 'ad-update', 'creative-create', 'status-set', 'budget-set', 'object-delete'],
  'Targeting & estimates': ['targeting-search', 'targeting-browse', 'delivery-estimate'],
  'Catalog creation & management': ['catalogs', 'catalog-get', 'catalog-products', 'catalog-product-sets', 'catalog-feeds', 'catalog-diagnostics', 'catalog-create'],
  'Signals & datasets': ['pixels', 'dataset-stats'],
  'Custom audiences': ['audiences', 'audience-create', 'lookalike-create'],
  'A/B tests & lift studies': ['studies', 'study-get'],
  'Hosted Meta Ads MCP proxy': ['mcp-tools', 'mcp-call'],
};
const META_MCP_WRITE = new Set(['campaign-create', 'campaign-update', 'adset-create', 'adset-update', 'ad-create', 'ad-update', 'creative-create', 'status-set', 'budget-set', 'object-delete', 'catalog-create', 'audience-create', 'lookalike-create', 'mcp-call']);
const META_MCP_SCOPES = ['ads_read', 'ads_management', 'catalog_management', 'business_management', 'ads_mcp_management', 'pages_show_list', 'instagram_basic'];

function renderMcpPane(perms) {
  const granted = new Set((perms || []).filter((p) => p.status === 'granted').map((p) => p.permission));
  const havePerms = Array.isArray(perms);
  const chips = META_MCP_SCOPES.map((s) => '<span style="display:inline-block;padding:2px 8px;margin:2px;border-radius:10px;font-size:12px;background:' + (granted.has(s) ? '#127a3d' : '#8a2020') + ';color:#fff">' + (granted.has(s) ? '✓' : '✗') + ' ' + s + '</span>').join('');
  const missing = META_MCP_SCOPES.filter((s) => !granted.has(s));
  const scopeCard = '<div class="card" style="margin-bottom:12px"><b>Meta token scopes</b> ' + (havePerms ? '' : '<span class="muted">(/me/permissions unreadable — token may be a limited system user)</span>')
    + '<div style="margin:6px 0">' + chips + '</div>'
    + (missing.length
      ? '<p class="err">Missing ' + missing.length + ' scope(s): ' + esc(missing.join(', ')) + '. Reads beyond account enumeration, all writes, catalogs, and the hosted MCP need these. Fix: Graph API Explorer → generate a User (or System User) token granting these scopes on business 1602361853681297, then set <code>META_ACCESS_TOKEN</code> on the loop-safe-miscsubjects Pages project (or the loop-meta-bridge Secrets Store token).</p>'
      : '<p class="ok">All required scopes granted.</p>') + '</div>';
  let cat = '';
  const allOps = [];
  for (const [g, ops] of Object.entries(META_MCP_GROUPS)) {
    cat += '<div style="margin:12px 0 4px;font-weight:600;font-size:13px">' + esc(g) + '</div><div>';
    for (const op of ops) { allOps.push(op); cat += '<span style="display:inline-block;padding:3px 9px;margin:3px;border-radius:8px;font-size:12px;background:var(--accent-soft);border:1px solid var(--accent)">' + esc(op) + (META_MCP_WRITE.has(op) ? ' ✎' : '') + '</span>'; }
    cat += '</div>';
  }
  const optsHtml = allOps.map((o) => '<option value="' + o + '">' + o + (META_MCP_WRITE.has(o) ? ' (write)' : '') + '</option>').join('');
  return scopeCard
    + '<p class="muted">' + allOps.length + ' tools · every Meta Marketing API + Ads MCP capability. ✎ = write (needs act auth; create ops default PAUSED — nothing spends until you activate it). Directory rows <code>META_ADS_*</code> (planner rank 1). Endpoint <code>POST /api/marketing/meta/&lt;op&gt;</code>.</p>'
    + '<div class="card">' + cat + '</div>'
    + '<div class="card" style="margin-top:12px"><b>Run a tool</b>'
    + '<div class="row" style="margin-top:8px"><select id="mcp-op">' + optsHtml + '</select>'
    + '<button id="mcp-run">Run</button><span id="mcp-status" class="muted"></span></div>'
    + '<textarea id="mcp-args" style="margin-top:8px;min-height:70px">{"account_id":"act_991011219624858"}</textarea>'
    + '<pre id="mcp-result" style="margin-top:8px;max-height:420px;overflow:auto"></pre></div>';
}

function renderVolumePane(vol) {
  if (!vol || vol.error) {
    return '<p class="err">Volume load error: ' + esc(String(vol && vol.error || 'unknown')) + '</p>';
  }
  const tile = (label, val) => '<div class="card" style="flex:1;min-width:130px"><div class="muted" style="font-size:12px">' + label + '</div><div class="tile-num">' + esc(String(val)) + '</div></div>';
  let h = '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px">'
    + tile('Drafts in this volume', vol.total_drafts)
    + tile('Businesses', vol.businesses)
    + tile('Saved on leads', vol.from_live_lead_rows)
    + tile('Earlier versions (emailed to you)', vol.from_review_emails)
    + tile('You have marked', vol.marked)
    + '</div>';
  h += '<p class="muted">Every draft that still exists, grouped by business, newest version first. Two sources: the draft currently saved on the lead, and every draft that was ever emailed to you for review — that second source is the only place earlier versions of a business\'s copy survive. Regenerating a lead\'s draft overwrites the saved one, so a version that was never emailed for review is not recoverable; nothing here is reconstructed from memory. Mark each one KEEP, CHANGE, or DELETE — marks save instantly and stay.</p>';
  h += '<div class="row" style="margin:10px 0"><span class="muted">Show:</span>'
    + ['all', 'unmarked', 'keep', 'change', 'delete'].map((f) => '<button type="button" class="vol-filter' + (f === 'all' ? ' on' : '') + '" data-filter="' + f + '">' + f + '</button>').join('')
    + '<span id="vol-status" class="muted"></span></div>';
  for (const g of vol.groups || []) {
    const meta = [g.city, g.segment, g.email, g.status, (g.score != null ? 'fit ' + g.score : '')].filter(Boolean).join(' · ');
    h += '<details class="vol-group" open><summary style="cursor:pointer;padding:8px 0;font-weight:600">'
      + esc(g.name) + ' <span class="muted" style="font-weight:400">— ' + g.versions + ' version' + (g.versions === 1 ? '' : 's') + (meta ? ' · ' + esc(meta) : '') + '</span></summary>';
    for (const it of g.items) {
      h += '<div class="vol-item" data-key="' + esc(it.key) + '" data-verdict="' + esc(it.verdict || '') + '" style="border:1px solid var(--line);border-radius:10px;padding:12px;margin:8px 0">'
        + '<div class="row" style="justify-content:space-between">'
        + '<span class="op-chip">v' + it.version + ' of ' + it.of + '</span>'
        + '<span class="muted">' + esc(it.ts || 'no timestamp on record') + ' · ' + esc(it.source) + (it.model ? ' · ' + esc(it.model) : '') + ' · ' + it.chars + ' chars</span>'
        + '</div>'
        + '<div style="margin:8px 0 4px"><b>Subject:</b> ' + esc(it.subject || '(none)') + '</div>'
        + '<pre style="max-height:none">' + esc(it.body || '(empty)') + '</pre>'
        + '<div class="row" style="margin-top:8px">'
        + ['keep', 'change', 'delete'].map((v) => '<button type="button" class="vol-mark' + (it.verdict === v ? ' on' : '') + '" data-v="' + v + '">' + v.toUpperCase() + '</button>').join('')
        + '<button type="button" class="vol-mark" data-v="">clear</button>'
        + '<input class="vol-note" placeholder="what to change / why" value="' + esc(it.note || '') + '" style="flex:1;min-width:220px">'
        + '<span class="vol-item-status muted"></span>'
        + '</div></div>';
    }
    h += '</details>';
  }
  return h;
}

const VOLUME_SCRIPT = `
<script>
(function(){
  var pane = document.getElementById('pane-volume');
  if (!pane) return;
  function apply(filter){
    pane.querySelectorAll('.vol-item').forEach(function(el){
      var v = el.dataset.verdict || '';
      var show = filter === 'all' || (filter === 'unmarked' ? !v : v === filter);
      el.style.display = show ? '' : 'none';
    });
    pane.querySelectorAll('.vol-group').forEach(function(g){
      var any = Array.prototype.some.call(g.querySelectorAll('.vol-item'), function(el){ return el.style.display !== 'none'; });
      g.style.display = any ? '' : 'none';
    });
  }
  pane.querySelectorAll('.vol-filter').forEach(function(b){
    b.addEventListener('click', function(){
      pane.querySelectorAll('.vol-filter').forEach(function(x){ x.classList.remove('on'); });
      b.classList.add('on');
      apply(b.dataset.filter);
    });
  });
  async function save(item, verdict){
    var st = item.querySelector('.vol-item-status');
    var note = item.querySelector('.vol-note').value;
    st.textContent = 'saving…';
    var r = await fetch('/api/marketing/volume/verdict', {
      method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ item_key: item.dataset.key, verdict: verdict, note: note })
    });
    var d = await r.json().catch(function(){ return {}; });
    if (r.ok && d.ok) {
      item.dataset.verdict = verdict;
      item.querySelectorAll('.vol-mark').forEach(function(x){ x.classList.toggle('on', x.dataset.v === verdict && verdict !== ''); });
      st.textContent = verdict ? ('marked ' + verdict.toUpperCase()) : 'cleared';
    } else {
      st.textContent = 'save failed: ' + JSON.stringify(d);
    }
  }
  pane.addEventListener('click', function(e){
    var b = e.target.closest('.vol-mark');
    if (!b) return;
    save(b.closest('.vol-item'), b.dataset.v);
  });
  pane.addEventListener('change', function(e){
    if (!e.target.classList.contains('vol-note')) return;
    var item = e.target.closest('.vol-item');
    save(item, item.dataset.verdict || '');
  });
})();
</script>`;

function renderPortfolioPane(pf) {
  if (!pf || pf.ok === false || !pf.data) {
    return '<p class="err">Portfolio load error: ' + esc(JSON.stringify((pf && (pf.data?.error || pf.error)) || 'unknown')) + '</p><p class="muted">If this is a token/permission error, check the Meta token scopes on the Ads MCP tab.</p>';
  }
  const d = pf.data;
  const usd = (c) => '$' + Number(c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const statusName = (s) => ({ 1: 'ACTIVE', 2: 'DISABLED', 3: 'UNSETTLED', 7: 'PENDING_RISK', 9: 'IN_GRACE', 100: 'CLOSED' }[s] || String(s));
  const tiles = '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px">'
    + ['Total historical spend|' + usd(d.total_spent_cents), 'Ad accounts|' + d.account_count, 'Businesses|' + d.business_count, 'Pages|' + d.page_count]
      .map((t) => { const [l, v] = t.split('|'); return '<div class="card" style="flex:1;min-width:150px"><div class="muted" style="font-size:12px">' + l + '</div><div style="font-size:22px;font-weight:700">' + esc(v) + '</div></div>'; }).join('')
    + '</div>';
  const byBiz = Object.entries(d.spend_by_business || {}).sort((a, b) => b[1] - a[1])
    .map(([n, c]) => '<tr><td>' + esc(n) + '</td><td style="text-align:right">' + usd(c) + '</td></tr>').join('');
  const accRows = (d.accounts || []).map((a) => '<tr>'
    + '<td><a href="#" data-drill="' + esc(a.id) + '">' + esc(a.name || a.id) + '</a></td>'
    + '<td>' + esc((a.business && a.business.name) || '—') + '</td>'
    + '<td>' + statusName(a.account_status) + '</td>'
    + '<td>' + esc(a.currency || '') + '</td>'
    + '<td style="text-align:right;font-variant-numeric:tabular-nums">' + usd(a.amount_spent) + '</td>'
    + '<td style="font-family:monospace;font-size:11px">' + esc(a.id) + '</td></tr>').join('');
  return tiles
    + '<div class="row" style="gap:20px;align-items:flex-start;flex-wrap:wrap">'
    + '<div style="flex:2;min-width:340px"><h3 style="font-size:13px;margin:0 0 6px">Ad accounts (' + d.account_count + ') — click a name to drill into campaigns &amp; ads</h3>'
    + '<table><thead><tr><th>Account</th><th>Business</th><th>Status</th><th>Cur</th><th style="text-align:right">Spend</th><th>ID</th></tr></thead><tbody>' + accRows + '</tbody></table></div>'
    + '<div style="flex:1;min-width:220px"><h3 style="font-size:13px;margin:0 0 6px">Spend by business</h3><table><tbody>' + byBiz + '</tbody></table></div>'
    + '</div>'
    + '<div id="pf-drill" style="margin-top:16px"></div>';
}

function renderUtmPane() {
  const dyn = ['{{campaign.name}}', '{{campaign.id}}', '{{adset.name}}', '{{adset.id}}', '{{ad.name}}', '{{ad.id}}', '{{placement}}', '{{site_source_name}}'];
  const chips = dyn.map((t) => '<button type="button" class="utm-dyn" data-tok="' + t + '" style="font-size:11px;padding:2px 7px;margin:2px">' + t + '</button>').join('');
  const field = (id, label, val, ph) => '<label style="display:block;margin:6px 0"><span class="muted" style="font-size:12px">' + label + '</span><input id="' + id + '" value="' + esc(val || '') + '" placeholder="' + esc(ph || '') + '" style="width:100%;padding:6px;margin-top:2px"></label>';
  return '<p class="muted">Build a tagged destination URL for Meta ads. Meta dynamic params fill in per impression. Paste the result into the ad\'s Website URL / URL parameters.</p>'
    + '<div class="card">'
    + field('utm-base', 'Destination URL', 'https://miscsubjects.com/', 'https://your-landing-page')
    + '<div class="row">'
    + '<div style="flex:1;min-width:150px">' + field('utm-source', 'utm_source', 'facebook') + '</div>'
    + '<div style="flex:1;min-width:150px">' + field('utm-medium', 'utm_medium', 'paid_social') + '</div>'
    + '</div>'
    + field('utm-campaign', 'utm_campaign', '{{campaign.name}}')
    + field('utm-content', 'utm_content', '{{ad.name}}')
    + field('utm-term', 'utm_term', '{{adset.name}}')
    + '<div style="margin:6px 0"><span class="muted" style="font-size:12px">Insert Meta dynamic param:</span><br>' + chips + '</div>'
    + '<div class="muted" style="font-size:11px">Last-focused field receives the token; defaults to utm_campaign.</div>'
    + '<div class="row" style="margin-top:8px"><button id="utm-build">Build URL</button><button id="utm-copy">Copy</button><span id="utm-status" class="muted"></span></div>'
    + '<textarea id="utm-out" style="margin-top:8px;min-height:60px" readonly></textarea>'
    + '<div class="muted" style="font-size:11px;margin-top:6px">URL parameters field (for Meta ad-level tracking, without the base): <span id="utm-params" style="font-family:monospace"></span></div>'
    + '</div>';
}

export async function onRequestGet({ env }) {
  let accounts = { live: { ok: false, errors: ['ssr_load_pending'] }, lbl_d1: { error: 'ssr_load_pending' } };
  let creatives = { lbl: { error: 'ssr_load_pending' } };
  let cloaker = { error: 'ssr_load_pending', rows: [] };
  let state = {};
  let funnel = '';
  let ledgerRows = [];
  const ssrErrors = [];

  try {
    accounts = await marketingAccountsFull(env);
  } catch (e) { ssrErrors.push('accounts:' + String(e?.message || e)); }
  try {
    const cr = await lblMetaCreatives(env);
    creatives = { lbl: cr.ok ? cr.data : { error: cr.error } };
  } catch (e) { ssrErrors.push('creatives:' + String(e?.message || e)); }
  try {
    const cl = await lblCloakerEvents(env, 100);
    cloaker = cl.ok ? cl.data : { error: cl.error, rows: [] };
  } catch (e) { ssrErrors.push('cloaker:' + String(e?.message || e)); }
  try { state = await getMarketingState(env); } catch (e) { ssrErrors.push('state:' + String(e?.message || e)); }
  try {
    const fr = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind('customer_funnel').first();
    funnel = fr?.value || '';
  } catch (e) { ssrErrors.push('funnel:' + String(e?.message || e)); }
  try { ledgerRows = await recentMarketingLedger(env); } catch (e) { ssrErrors.push('ledger:' + String(e?.message || e)); }
  let outreachDump = '';
  try { outreachDump = outreachLoopText(await loadOutreachLoop(env)); } catch (e) { ssrErrors.push('outreach:' + String(e?.message || e)); }
  let volume = null;
  try { volume = await loadVolume(env); } catch (e) { volume = { error: String(e?.message || e) }; ssrErrors.push('volume:' + String(e?.message || e)); }
  let metaPerms = null;
  try {
    const { metaFetch } = await import('../_lib/meta_graph.js');
    const pr = await metaFetch(env, '/me/permissions');
    metaPerms = pr?.data?.data || null;
  } catch (e) { ssrErrors.push('meta_perms:' + String(e?.message || e)); }
  let portfolioData = null;
  try {
    const { portfolio } = await import('../_lib/meta_ads.js');
    portfolioData = await portfolio(env);
  } catch (e) { ssrErrors.push('portfolio:' + String(e?.message || e)); }

  const liveCount = accounts.live?.ok ? accounts.live.count : 0;
  const traceId = 'mkt_' + Math.random().toString(36).slice(2, 10);
  await logEvent(env, {
    source: 'marketing',
    key: 'MARKETING_PAGE',
    action: 'view',
    direction: 'in',
    status: ssrErrors.length ? 207 : 200,
    route: '/admin/marketing',
    trace_id: traceId,
    actor: 'admin/marketing',
    response: {
      ssr_live_accounts: liveCount,
      ssr_lbl_error: accounts.lbl_d1?.error || null,
      ssr_errors: ssrErrors,
    },
  });

  const banner = ssrErrors.length
    ? '<div class="banner">SSR partial errors: ' + esc(ssrErrors.join('; ')) + '</div>'
    : '<div id="fetch-banner" class="banner" style="display:none"></div>';

  const body = STYLES
    + '<h1>Marketing</h1>'
    + '<p class="subtitle">Meta ad accounts · live API · lbl.fyi cache · JCI cloaker · ledger-grounded.</p>'
    + banner
    + '<div class="mkt"><nav class="sub">'
    + '<button class="on" data-pane="portfolio" style="font-weight:700;color:var(--accent)">★ Portfolio</button>'
    + '<button data-pane="mcp" style="font-weight:700;color:var(--accent)">★ Ads MCP</button>'
    + '<button data-pane="volume" style="font-weight:700;color:var(--accent)">★ Draft Volume</button>'
    + '<button data-pane="outreach">Lead Scraping &amp; Outreach</button>'
    + '<button data-pane="utm">UTM Builder</button>'
    + '<button data-pane="accounts">Ad Accounts</button>'
    + '<button data-pane="creatives">Creatives</button>'
    + '<button data-pane="cloaker">JCI / Cloaker</button>'
    + '<button data-pane="state">Model State</button>'
    + '<button data-pane="ledger">Ledger</button>'
    + '</nav>'
    + '<div class="row"><button id="btn-refresh">Refresh</button>'
    + '<button id="btn-sync">Run Meta insights backfill (lbl)</button>'
    + '<span id="status" class="muted">SSR ' + esc(new Date().toLocaleTimeString()) + ' · ' + liveCount + ' live accounts</span></div>'
    + '<section id="pane-portfolio" class="card"><h2 style="font-size:15px;margin:0 0 10px">Portfolio — every business, account &amp; dollar</h2>'
    + renderPortfolioPane(portfolioData) + '</section>'
    + '<section id="pane-volume" class="card" style="display:none"><h2 style="font-size:15px;margin:0 0 10px">Draft volume — every draft that still exists, keep or cut each one</h2>'
    + renderVolumePane(volume) + '</section>'
    + '<section id="pane-outreach" class="card" style="display:none"><h2 style="font-size:15px;margin:0 0 10px">Lead scraping &amp; email outreach — the whole loop</h2>'
    + '<p class="muted">Everything below is generated live: how leads are scraped (OpenStreetMap, Google Places, the federal NPI registry, live web search), how their sites are crawled for emails, MX verification, buyer scoring, the drafting rules and price list, every gate before a send, every saved draft, and everything sent with opens/clicks. Self-explaining — a model needs zero other context.</p>'
    + '<div class="row" style="margin:0 0 8px"><button id="btn-copy-outreach">Copy the whole thing</button><span id="outreach-copy-status" class="muted"></span></div>'
    + '<pre id="outreach-dump" style="max-height:560px">' + esc(outreachDump || '(load failed — see banner)') + '</pre></section>'
    + '<section id="pane-utm" class="card" style="display:none"><h2 style="font-size:15px;margin:0 0 10px">UTM Builder</h2>'
    + renderUtmPane() + '</section>'
    + '<section id="pane-accounts" class="card" style="display:none"><h2 style="font-size:15px;margin:0 0 10px">Ad accounts — live Meta API</h2>'
    + '<div id="accounts-live">' + renderAccountsLive(accounts.live) + '</div>'
    + '<h3 style="font-size:13px;margin:16px 0 8px;color:var(--muted)">lbl.fyi D1 cache</h3>'
    + '<div id="accounts-lbl">' + renderAccountsLbl(accounts.lbl_d1) + '</div>'
    + '<div id="account-detail" style="margin-top:14px"></div></section>'
    + '<section id="pane-mcp" class="card" style="display:none"><h2 style="font-size:15px;margin:0 0 10px">Meta Ads MCP — full Marketing API tool catalog</h2>'
    + renderMcpPane(metaPerms) + '</section>'
    + '<section id="pane-creatives" class="card" style="display:none"><h2 style="font-size:15px;margin:0 0 10px">Creatives</h2>'
    + '<div id="creatives-body">' + renderCreatives(creatives.lbl) + '</div></section>'
    + '<section id="pane-cloaker" class="card" style="display:none"><h2 style="font-size:15px;margin:0 0 10px">JCI / Cloaker visits (lbl.fyi)</h2>'
    + '<div id="cloaker-body">' + renderCloaker(cloaker) + '</div></section>'
    + '<section id="pane-state" class="card" style="display:none"><h2 style="font-size:15px;margin:0 0 10px">MARKETING_STATE</h2>'
    + '<p class="muted">ROUTER: [KNOWLEDGE]MARKETING_STATE[/KNOWLEDGE] · every read/write lands in ledger.</p>'
    + '<textarea id="state-json">' + esc(JSON.stringify(state, null, 2)) + '</textarea>'
    + '<div class="row" style="margin-top:8px"><button id="btn-save-state">Save state</button><span id="state-status" class="muted"></span></div>'
    + '<h3 style="font-size:13px;margin:16px 0 8px">Customer funnel doc</h3>'
    + '<textarea id="funnel-json">' + esc(funnel) + '</textarea>'
    + '<button id="btn-save-funnel" style="margin-top:8px">Save funnel doc</button></section>'
    + '<section id="pane-ledger" class="card" style="display:none"><h2 style="font-size:15px;margin:0 0 10px">Marketing ledger</h2>'
    + '<p class="muted">Ground truth — <a href="/admin/ledger?source=marketing">full ledger filter</a></p>'
    + renderLedgerStrip(ledgerRows)
    + '</section></div>'
    + CLIENT_SCRIPT
    + VOLUME_SCRIPT
    + '<script>(function(){var b=document.getElementById("btn-copy-outreach");if(!b)return;b.addEventListener("click",function(){var s=document.getElementById("outreach-copy-status");var t=document.getElementById("outreach-dump").textContent;navigator.clipboard.writeText(t).then(function(){s.textContent="copied "+t.length+" chars — paste into any model"},function(e){s.textContent="copy failed: "+e.message})});})();</script>';

  return new Response(shellHtml({ activeHref: '/admin/marketing', title: 'Marketing', body }), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-ssr-accounts': String(liveCount) },
  });
}