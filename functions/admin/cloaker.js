import { shellHtml } from './_layout.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

const BODY = `
<style>
.cloaker-admin{display:grid;gap:16px;max-width:980px}
.cloaker-admin .row{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.cloaker-admin label{font-size:13px;color:var(--ink-soft);font-weight:500;min-width:120px}
.cloaker-admin input[type=text]{min-width:320px;flex:1}
.cloaker-admin textarea{width:100%;min-height:120px;font-family:var(--mono);font-size:13px}
.cloaker-admin .toggle{width:44px;height:24px;border-radius:12px;background:var(--line-strong);position:relative;cursor:pointer;transition:background .2s}
.cloaker-admin .toggle.on{background:var(--ds-sage)}
.cloaker-admin .toggle::after{content:'';position:absolute;top:2px;left:2px;width:20px;height:20px;border-radius:50%;background:#f0ede5;transition:left .2s}
.cloaker-admin .toggle.on::after{left:22px}
.cloaker-section{display:grid;gap:12px;border-bottom:1px solid var(--line);padding-bottom:16px}
.cloaker-section h2{font-size:17px;margin:0}
.remote-list{display:grid;gap:12px}
.remote-card{border:1px solid var(--line);border-radius:8px;padding:14px;display:grid;gap:10px;background:var(--panel)}
.remote-card h3{font-size:16px;margin:0}
.remote-meta{display:flex;gap:10px;flex-wrap:wrap;font-size:12px;color:var(--ink-soft)}
.remote-card input[type=text]{width:100%;min-width:0}
.token-list{display:grid;gap:10px}
.token-row{display:grid;grid-template-columns:minmax(150px,.7fr) minmax(260px,1.8fr) minmax(140px,.8fr) auto auto;gap:8px;align-items:center}
.token-row input[type=text]{min-width:0;width:100%;font-family:var(--mono);font-size:12px}
.token-row button{white-space:nowrap}
.token-all{min-height:92px}
.status{font-size:13px}
.status.ok{color:#178c45}
.status.err{color:#c14a4a}
@media(max-width:760px){.token-row{grid-template-columns:1fr}.token-row button{width:100%}}
</style>

<h1>Cloaker</h1>
<p class="subtitle">One control surface for the root redirect and the WordPress homepage redirects.</p>

<div class="cloaker-admin">
  <section class="cloaker-section">
    <h2>Root redirect</h2>
    <div class="row">
      <label>Enabled</label>
      <div id="toggle" class="toggle" onclick="toggle()"></div>
      <span id="toggle-status" class="status">loading...</span>
    </div>

    <div>
      <label>Money page URL</label>
      <div class="row"><input id="money-page" type="text" placeholder="https://leoresearch.com/l/meta" style="flex:1"></div>
    </div>

    <div>
      <label>Safe page HTML (optional)</label>
      <textarea id="safe-page" placeholder="Leave empty for default safe page"></textarea>
    </div>
  </section>

  <section class="cloaker-section">
    <h2>WordPress sites</h2>
    <div class="row">
      <button onclick="setAllRemoteTargets()">Set all to root target</button>
      <span class="status">Installed WordPress sites read this config from <code>/api/cloaker?remote_site=domain.com</code>.</span>
    </div>
    <div id="remote-sites" class="remote-list"></div>
  </section>

  <section class="cloaker-section">
    <h2>Plain-text token quick copy</h2>
    <div id="quick-tokens" class="token-list"></div>
    <div>
      <label>All tokens</label>
      <textarea id="all-tokens" class="token-all" readonly></textarea>
    </div>
    <div class="row">
      <button onclick="addToken()">Add token</button>
      <button onclick="copyAllTokens()">Copy all</button>
      <span id="token-status" class="status"></span>
    </div>
  </section>

  <div class="row">
    <button onclick="save()">Save all</button>
    <span id="save-status" class="status"></span>
  </div>
</div>

<script>
let state = { enabled: false, moneyPage: 'https://www.leoresearch.com/shop', safePageHtml: '', remoteSites: [], quickTokens: [] };

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
  });
}

function apiPath(path) {
  const params = new URLSearchParams(location.search);
  const out = new URL(path, location.origin);
  ['share', 'terminal_key', 'tk'].forEach(function(k) {
    const v = params.get(k);
    if (v) out.searchParams.set(k, v);
  });
  return out.pathname + out.search;
}

async function load() {
  const r = await fetch(apiPath('/api/cloaker'));
  const d = await r.json();
  state = d;
  if (!Array.isArray(state.remoteSites)) state.remoteSites = [];
  if (!Array.isArray(state.quickTokens)) state.quickTokens = [];
  document.getElementById('money-page').value = d.moneyPage || '';
  document.getElementById('safe-page').value = d.safePageHtml || '';
  updateToggle(d.enabled);
  renderRemoteSites();
  renderQuickTokens();
}

function updateToggle(on) {
  const el = document.getElementById('toggle');
  const st = document.getElementById('toggle-status');
  if (on) { el.classList.add('on'); st.textContent = 'ON'; st.className = 'status ok'; }
  else { el.classList.remove('on'); st.textContent = 'OFF'; st.className = 'status'; }
}

async function toggle() {
  state.enabled = !state.enabled;
  updateToggle(state.enabled);
  const st = document.getElementById('toggle-status');
  try {
    const r = await fetch(apiPath('/api/cloaker'), {
      method: 'PUT',
      credentials: 'same-origin',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ enabled: state.enabled }),
    });
    if (!r.ok) throw new Error('save failed');
  } catch {
    state.enabled = !state.enabled;
    updateToggle(state.enabled);
    st.textContent = 'Toggle save failed';
    st.className = 'status err';
  }
}

function remotePatch(i, field, value) {
  if (!state.remoteSites[i]) return;
  state.remoteSites[i][field] = value;
}

function setAllRemoteTargets() {
  const target = document.getElementById('money-page').value || state.moneyPage || 'https://www.leoresearch.com/shop';
  state.remoteSites = state.remoteSites.map(function(site) {
    return Object.assign({}, site, { targetUrl: target });
  });
  renderRemoteSites();
}

function renderRemoteSites() {
  const wrap = document.getElementById('remote-sites');
  wrap.innerHTML = '';
  if (!state.remoteSites.length) {
    wrap.innerHTML = '<p class="status">No remote WordPress sites configured.</p>';
    return;
  }
  state.remoteSites.forEach(function(site, i) {
    const card = document.createElement('div');
    card.className = 'remote-card';
    card.innerHTML =
      '<div class="row" style="justify-content:space-between">' +
        '<h3>' + esc(site.label || site.host) + '</h3>' +
        '<label style="min-width:auto"><input type="checkbox" ' + (site.enabled ? 'checked' : '') + ' onchange="remotePatch(' + i + ', \\'enabled\\', this.checked)"> Enabled</label>' +
      '</div>' +
      '<div class="remote-meta">' +
        '<span>host: ' + esc(site.host) + '</span>' +
        (site.connect ? '<span>connect: ' + esc(site.connect) + '</span>' : '') +
        (site.fbmAdmin ? '<span>admin: ' + esc(site.fbmAdmin) + '</span>' : '') +
        (site.fbmProfile ? '<span>profile: ' + esc(site.fbmProfile) + '</span>' : '') +
        '<span>mode: redirect</span>' +
      '</div>' +
      '<label>Target URL</label>' +
      '<input type="text" value="' + esc(site.targetUrl || '') + '" oninput="remotePatch(' + i + ', \\'targetUrl\\', this.value)">' +
      '<label>Meta Pixel ID</label>' +
      '<input type="text" value="' + esc(site.metaPixelId || '') + '" oninput="remotePatch(' + i + ', \\'metaPixelId\\', this.value)">' +
      '<div class="remote-meta"><span>control URL: /api/cloaker?remote_site=' + encodeURIComponent(site.host || '') + '</span></div>';
    wrap.appendChild(card);
  });
}

function tokenPatch(i, field, value) {
  if (!state.quickTokens[i]) return;
  state.quickTokens[i][field] = value;
  renderAllTokens();
}

function addToken() {
  state.quickTokens.push({ name: '', value: '', note: '' });
  renderQuickTokens();
}

function removeToken(i) {
  state.quickTokens.splice(i, 1);
  renderQuickTokens();
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

async function copyToken(i) {
  const row = state.quickTokens[i] || {};
  const ok = await copyText(String(row.value || ''));
  const st = document.getElementById('token-status');
  st.textContent = ok ? 'Copied ' + (row.name || 'token') + '.' : 'Copy failed.';
  st.className = ok ? 'status ok' : 'status err';
  setTimeout(() => { st.textContent = ''; st.className = 'status'; }, 2000);
}

async function copyAllTokens() {
  const ok = await copyText(document.getElementById('all-tokens').value || '');
  const st = document.getElementById('token-status');
  st.textContent = ok ? 'Copied all tokens.' : 'Copy failed.';
  st.className = ok ? 'status ok' : 'status err';
  setTimeout(() => { st.textContent = ''; st.className = 'status'; }, 2000);
}

function renderAllTokens() {
  document.getElementById('all-tokens').value = state.quickTokens
    .filter(function(row) { return row.name || row.value || row.note; })
    .map(function(row) {
      const note = row.note ? ' # ' + row.note : '';
      return (row.name || 'TOKEN') + '=' + (row.value || '') + note;
    }).join('\\n');
}

function renderQuickTokens() {
  const wrap = document.getElementById('quick-tokens');
  wrap.innerHTML = '';
  if (!state.quickTokens.length) {
    wrap.innerHTML = '<p class="status">No quick-copy tokens saved.</p>';
    renderAllTokens();
    return;
  }
  state.quickTokens.forEach(function(row, i) {
    const item = document.createElement('div');
    item.className = 'token-row';
    item.innerHTML =
      '<input type="text" placeholder="TOKEN_NAME" value="' + esc(row.name || '') + '" oninput="tokenPatch(' + i + ', \\'name\\', this.value)">' +
      '<input type="text" placeholder="plain text token" value="' + esc(row.value || '') + '" oninput="tokenPatch(' + i + ', \\'value\\', this.value)">' +
      '<input type="text" placeholder="note" value="' + esc(row.note || '') + '" oninput="tokenPatch(' + i + ', \\'note\\', this.value)">' +
      '<button onclick="copyToken(' + i + ')">Copy</button>' +
      '<button onclick="removeToken(' + i + ')">Remove</button>';
    wrap.appendChild(item);
  });
  renderAllTokens();
}

async function save() {
  const body = {
    enabled: state.enabled,
    moneyPage: document.getElementById('money-page').value,
    safePageHtml: document.getElementById('safe-page').value,
    remoteSites: state.remoteSites,
    quickTokens: state.quickTokens,
  };
  const r = await fetch(apiPath('/api/cloaker'), {
    method: 'PUT',
    credentials: 'same-origin',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(body),
  });
  const el = document.getElementById('save-status');
  if (!r.ok) { el.textContent = 'Save failed (' + r.status + ')'; el.className = 'status err'; return; }
  el.textContent = 'Saved.'; el.className = 'status ok';
  await load();
  setTimeout(() => { el.textContent = ''; el.className = 'status'; }, 3000);
}

load();
</script>
`;

export async function onRequestGet() {
  return new Response(shellHtml({ activeHref: '/admin/cloaker', title: 'Cloaker', body: BODY }), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}

async function getSetting(env, key) {
  const row = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first();
  return row?.value ?? null;
}
async function setSetting(env, key, value) {
  await env.DB.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').bind(key, value).run();
}

export async function onRequestPost(context) {
  const { request, env } = context;
  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid json' }, 400); }
  if (body.enabled !== undefined) await setSetting(env, 'CLOAKER_ENABLED', body.enabled ? 'true' : 'false');
  if (body.moneyPage !== undefined) await setSetting(env, 'CLOAKER_MONEY_PAGE', String(body.moneyPage));
  if (body.safePageHtml !== undefined) await setSetting(env, 'CLOAKER_SAFE_PAGE_HTML', String(body.safePageHtml));
  return json({ ok: true });
}
