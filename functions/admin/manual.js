import { shellHtml } from './_layout.js';

const BODY = `<div class="manual-page">
<style>
.manual-page{font-size:12.5px;line-height:1.6;max-width:1100px}
.manual-page h1{font-size:18px;color:var(--blue);margin:0 0 4px}
.manual-page h2{font-size:13px;color:var(--blue);margin:34px 0 10px;padding-bottom:6px;border-bottom:1px solid var(--line);text-transform:uppercase;letter-spacing:.06em}
.manual-page h3{font-size:12.5px;color:var(--ink);margin:22px 0 6px}
.manual-page h4{font-size:12px;color:var(--green);margin:14px 0 4px}
.manual-page .subtitle{font-size:12px;color:var(--muted);margin-bottom:24px}
.manual-page p{margin:8px 0}
.manual-page ul,.manual-page ol{margin:6px 0 10px 22px}
.manual-page li{margin:3px 0}
.manual-page code{background:#eef0f3;color:var(--ink);padding:1px 5px;border-radius:3px;font-size:13px;word-break:break-word;font-family:var(--mono)}
.manual-page pre{background:#f6f7f9;border:1px solid var(--line);border-radius:6px;padding:10px 12px;font-size:12.5px;color:var(--ink);white-space:pre-wrap;word-break:break-word;line-height:1.55;margin:8px 0;font-family:var(--mono)}
.manual-page table{width:100%;border-collapse:collapse;margin:8px 0;font-size:13px}
.manual-page th{background:var(--panel);border-bottom:2px solid var(--line-strong);border-top:1px solid var(--line);padding:8px 10px;text-align:left;color:var(--ink);vertical-align:top;white-space:nowrap;position:static;font-weight:600}
.manual-page td{border-bottom:1px solid var(--line);padding:8px 10px;color:var(--ink);vertical-align:top}
.manual-page td strong,.manual-page td.ink{color:var(--ink);font-weight:600}
.manual-page .warn{color:#7a5a00}
.manual-page .ok{color:#178c45}
.manual-page hr{border:none;border-top:1px solid var(--line);margin:18px 0}
.manual-page .toc{border:1px solid var(--line);border-radius:6px;padding:12px 16px;margin:0 0 20px;background:rgba(255,255,255,.02)}
.manual-page .toc a{display:block;color:var(--blue);text-decoration:none;font-size:11.5px;padding:2px 0}
.manual-page .toc a:hover{text-decoration:underline}
.manual-page .toc .level-2{padding-left:14px;color:var(--muted)}
.manual-page .kv{display:grid;grid-template-columns:160px 1fr;gap:6px 14px;font-size:11.5px;margin:8px 0}
.manual-page .kv .k{color:var(--muted)}
.manual-page .kv .v{color:var(--ink);word-break:break-word}
.manual-page a{color:var(--blue)}
</style>


<h1>Manual</h1>
<div style="background:#fff8e6;border:1px solid #e6c97a;padding:10px 14px;border-radius:6px;color:#7a5a00;margin:8px 0 18px;font-size:13px;line-height:1.55">
<b>Note (2026-06-12):</b> Sections below may reference rows that no longer exist or features that have been superseded. Authoritative inventory: <a href="/admin/directory">/admin/directory</a> (live tools), <a href="/admin/rest">/admin/rest</a> (live REST endpoints), <a href="/api">/api</a> (live capability map). Specific known-stale references in this file: <code>BLOOIO_SEND</code>, <code>BLOOIO_LOG_IN</code>, <code>BLOOIO_LOG_OUT</code>, <code>BLOOIO_INBOUND</code>, <code>META_CAPI_POST</code>, <code>/architecture</code>. Disregard those.
</div>

<div class="toc">
  <a href="#overview">1. What this project is</a>
  <a href="#ontology">2. Storage ontology — what lives where</a>
  <a href="#urls">3. URL map — every reachable URL</a>
  <a href="#flows">4. End-to-end flows</a>
  <a href="#api-settings">5. Settings API — /api/settings</a>
  <a href="#api-pages">6. Pages API — /api/pages</a>
  <a href="#grok-ui">7. Grok page — /grok</a>
  <a href="#grok-audit">8. Grok audit — /grok/audit</a>
  <a href="#blooio">9. Blooio webhook — /blooio</a>
  <a href="#capi">10. Meta CAPI — /capi</a>
  <a href="#pages-editor">11. Pages editor — /admin/pages</a>
  <a href="#admin-tables">12. Admin table views — /admin/&lt;table&gt;</a>
  <a href="#dynamic-slugs">13. Public dynamic slugs — /&lt;slug&gt;</a>
  <a href="#wrangler">14. Project config & bindings (wrangler.toml)</a>
  <a href="#secrets">15. Secrets</a>
  <a href="#operations">16. Operations — deploy, migrate, KV, D1, secrets</a>
  <a href="#cannot">17. What you cannot do without redeploying</a>
  <a href="#audit-checks">18. Audit checks — verify the build yourself</a>
  <a href="#directory">19. Directory pattern — the kernel</a>
  <a href="#collapse">20. What collapses into rows (backward list)</a>
  <a href="#forward">21. Forward rule — any new capability (forward list)</a>
  <a href="#status">22. Implementation status — what is live now</a>
  <a href="#gas-map">23. Google Apps Script → Cloudflare primitive map</a>
  <a href="#urls-all">24. Every URL on this site (exhaustive)</a>
  <a href="#cf-rest">25. Cloudflare REST endpoint catalog (with row mappings)</a>
  <a href="#how-to-call">26. How to call any row — recipes and flow DSL</a>
  <a href="#inventory">27. Total inventory — every row, every trigger, every view, every use case</a>
</div>

<h2 id="overview">1. What this project is</h2>
<p>This is a Cloudflare Pages project named <code>miscsubjects-pages</code>. It is bound to the domain <a href="https://miscsubjects.com">https://miscsubjects.com</a>. Its source is at <code>/Users/owner/miscsubjects-pages</code>.</p>
<p>It does five things:</p>
<ol>
  <li>Serves the marketing site at <a href="https://miscsubjects.com">https://miscsubjects.com</a>. The homepage is a static file. Other pages are stored in a database and edited from the browser.</li>
  <li>Receives iMessage webhooks from Blooio at <a href="https://miscsubjects.com/blooio">https://miscsubjects.com/blooio</a>, sends each user message to Grok, sends Grok's reply back via Blooio. One reply per message.</li>
  <li>Mirrors Meta Pixel events server-side at <a href="https://miscsubjects.com/capi">https://miscsubjects.com/capi</a>.</li>
  <li>Provides a REST API at <code>/api/settings</code> and <code>/api/pages</code> for changing configuration and content from any HTTP client.</li>
  <li>Provides an audit gate at <a href="https://miscsubjects.com/grok/audit">https://miscsubjects.com/grok/audit</a> — POST a current value and a proposed value, get back Grok's approve/reject/review verdict.</li>
</ol>

<h2 id="ontology">2. Storage ontology — what lives where</h2>

<h3>2.1 Cloudflare D1 database — binding <code>DB</code></h3>
<div class="kv">
  <div class="k">database name</div><div class="v">miscsubjects-content</div>
  <div class="k">database id</div><div class="v">298eb858-37fb-4c73-8be4-135e8feb73fe</div>
  <div class="k">binding name in code</div><div class="v"><code>env.DB</code></div>
</div>
<p>Tables and what each row means:</p>

<h4>settings</h4>
<table>
<thead><tr><th>column</th><th>type</th><th>meaning</th></tr></thead>
<tbody>
<tr><td><code>key</code></td><td>TEXT PK</td><td>name of the setting</td></tr>
<tr><td><code>value</code></td><td>TEXT</td><td>raw string or a JSON-encoded object</td></tr>
<tr><td><code>description</code></td><td>TEXT (nullable)</td><td>free-text note</td></tr>
<tr><td><code>updated_at</code></td><td>TEXT (nullable)</td><td>ISO 8601 timestamp of last write</td></tr>
</tbody>
</table>
<p>Known keys in active use:</p>
<table>
<thead><tr><th>key</th><th>what it controls</th><th>typical value</th></tr></thead>
<tbody>
<tr><td><code>system_prompt</code></td><td>Grok system message used by /grok and /blooio</td><td>"You are an invariant-first…"</td></tr>
<tr><td><code>grok_model</code></td><td>model id sent to xAI</td><td><code>grok-build-0.1</code></td></tr>
<tr><td><code>grok_temperature</code></td><td>temperature sent to xAI (omitted if blank)</td><td><code>0.95</code></td></tr>
<tr><td><code>grok_web_search</code></td><td>whether to send <code>tools:[{type:"web_search_preview"}]</code></td><td><code>1</code> or <code>0</code></td></tr>
<tr><td><code>grok_audit_prompt</code></td><td>system prompt used by /grok/audit (optional; default embedded in code)</td><td>"You are an audit gate…"</td></tr>
<tr><td><code>grok_audit_model</code></td><td>model used by /grok/audit if different from <code>grok_model</code> (optional)</td><td>any xAI model id</td></tr>
</tbody>
</table>

<h4>blooio_logs</h4>
<table>
<thead><tr><th>column</th><th>type</th><th>meaning</th></tr></thead>
<tbody>
<tr><td><code>id</code></td><td>INTEGER PK</td><td>auto-increment</td></tr>
<tr><td><code>timestamp</code></td><td>TEXT</td><td>ISO 8601</td></tr>
<tr><td><code>direction</code></td><td>TEXT</td><td><code>IN</code> = inbound webhook from Blooio. <code>OUT</code> = reply sent to Blooio.</td></tr>
<tr><td><code>payload</code></td><td>TEXT</td><td>For <code>IN</code>: the raw JSON body Blooio POSTed. For <code>OUT</code>: full HTTP request we sent (url, method, headers with Authorization redacted, body).</td></tr>
<tr><td><code>response</code></td><td>TEXT (nullable)</td><td>For <code>OUT</code>: the raw response body from Blooio. For <code>IN</code>: null.</td></tr>
</tbody>
</table>

<h4>blooio_dedup</h4>
<table>
<thead><tr><th>column</th><th>type</th><th>meaning</th></tr></thead>
<tbody>
<tr><td><code>message_id</code></td><td>TEXT PK</td><td>Blooio's message id. Once present, every later webhook for the same id is ignored.</td></tr>
<tr><td><code>created_at</code></td><td>TEXT</td><td>ISO 8601</td></tr>
</tbody>
</table>
<p>This table exists because Blooio fires the same webhook more than once. Inserting <code>OR IGNORE</code>; if <code>changes = 0</code> the webhook is dropped.</p>

<h4>grok_ledger</h4>
<table>
<thead><tr><th>column</th><th>type</th><th>meaning</th></tr></thead>
<tbody>
<tr><td><code>id</code></td><td>INTEGER PK</td><td>auto-increment</td></tr>
<tr><td><code>timestamp</code></td><td>TEXT</td><td>ISO 8601</td></tr>
<tr><td><code>source</code></td><td>TEXT</td><td><code>blooio</code> = call originated from an inbound iMessage. <code>audit</code> = call originated from /grok/audit.</td></tr>
<tr><td><code>request</code></td><td>TEXT</td><td>Full HTTP request to xAI as a JSON object: <code>{url, method, headers (Authorization redacted), body}</code>.</td></tr>
<tr><td><code>response</code></td><td>TEXT (nullable)</td><td>Raw response body from xAI.</td></tr>
</tbody>
</table>

<h4>pages</h4>
<table>
<thead><tr><th>column</th><th>type</th><th>meaning</th></tr></thead>
<tbody>
<tr><td><code>slug</code></td><td>TEXT PK</td><td>URL path. <code>m</code> means <a href="https://miscsubjects.com/m">https://miscsubjects.com/m</a>.</td></tr>
<tr><td><code>title</code></td><td>TEXT (nullable)</td><td>page title</td></tr>
<tr><td><code>body_html</code></td><td>TEXT</td><td>full HTML document served verbatim</td></tr>
<tr><td><code>version</code></td><td>INTEGER</td><td>starts at 1, increments by 1 on every PUT/PATCH</td></tr>
<tr><td><code>updated_at</code></td><td>TEXT</td><td>ISO 8601</td></tr>
</tbody>
</table>

<h4>pages_versions</h4>
<table>
<thead><tr><th>column</th><th>type</th><th>meaning</th></tr></thead>
<tbody>
<tr><td><code>id</code></td><td>INTEGER PK</td><td>auto-increment</td></tr>
<tr><td><code>slug</code></td><td>TEXT</td><td>page slug</td></tr>
<tr><td><code>version</code></td><td>INTEGER</td><td>matching version number</td></tr>
<tr><td><code>title</code></td><td>TEXT (nullable)</td><td>snapshot</td></tr>
<tr><td><code>body_html</code></td><td>TEXT</td><td>snapshot of the HTML at that version</td></tr>
<tr><td><code>created_at</code></td><td>TEXT</td><td>ISO 8601</td></tr>
<tr><td><code>actor</code></td><td>TEXT (nullable)</td><td>who wrote it: <code>seed</code>, <code>admin</code>, <code>api</code>, or any string supplied in the request</td></tr>
</tbody>
</table>
<p>Append-only. Deleting a slug from <code>pages</code> does not delete its rows here.</p>

<h3>2.2 Cloudflare KV namespace — binding <code>KV</code></h3>
<div class="kv">
  <div class="k">namespace title</div><div class="v">loop_content_kv</div>
  <div class="k">namespace id</div><div class="v">58b303e666a8431685624e0cfd2fd63f</div>
  <div class="k">binding name in code</div><div class="v"><code>env.KV</code></div>
</div>
<p>KV stores the same four hot-read keys that also live in D1 <code>settings</code>:</p>
<ul>
  <li><code>system_prompt</code></li>
  <li><code>grok_model</code></li>
  <li><code>grok_temperature</code></li>
  <li><code>grok_web_search</code></li>
</ul>
<p>Read order in code: try KV first; if KV returns null, fall back to D1 <code>settings</code>. Write order: write to D1 first, then KV. Both stores stay in sync as long as writes come through the Worker.</p>
<p>The reason both exist: KV is faster to read globally; D1 is the audit-trail source of truth and is queryable. Changing a value from <a href="https://miscsubjects.com/grok">https://miscsubjects.com/grok</a> updates both atomically inside the request.</p>

<h3>2.3 Static files on disk — <code>public/</code></h3>
<ul>
  <li><code>/Users/owner/miscsubjects-pages/public/index.html</code> — the homepage with the cloaker script. Served at <a href="https://miscsubjects.com/">https://miscsubjects.com/</a>. To change, edit the file and run <code>npx wrangler pages deploy public --project-name miscsubjects-pages --commit-dirty=true</code>.</li>
  <li><code>/Users/owner/miscsubjects-pages/public/_routes.json</code> — tells Cloudflare which paths to exclude from this project (because another Worker handles them).</li>
</ul>

<h2 id="urls">3. URL map — every reachable URL</h2>
<table>
<thead><tr><th>URL</th><th>Method(s)</th><th>What it does</th></tr></thead>
<tbody>
<tr><td><a href="https://miscsubjects.com/">https://miscsubjects.com/</a></td><td>GET</td><td>Static homepage. Loads the cloaker.</td></tr>
<tr><td><a href="https://miscsubjects.com/m">https://miscsubjects.com/m</a></td><td>GET</td><td>Inside page after cloaker passes. Body from D1 <code>pages</code> row <code>m</code>.</td></tr>
<tr><td><a href="https://miscsubjects.com/privacy">https://miscsubjects.com/privacy</a></td><td>GET</td><td>Privacy page. Body from D1 <code>pages</code> row <code>privacy</code>.</td></tr>
<tr><td><a href="https://miscsubjects.com/success">https://miscsubjects.com/success</a></td><td>GET</td><td>Thank-you page. Body from D1 <code>pages</code> row <code>success</code>.</td></tr>
<tr><td><a href="https://miscsubjects.com/&lt;any-slug&gt;">https://miscsubjects.com/&lt;any-slug&gt;</a></td><td>GET</td><td>If a row exists in <code>pages</code> for that slug, returns its HTML. Otherwise 404. Reserved slugs blocked: <code>api admin grok blooio architecture capi control spec edit article condition import-export import export</code>.</td></tr>
<tr><td><a href="https://miscsubjects.com/api">https://miscsubjects.com/api</a></td><td>GET</td><td>HTML docs page listing every API endpoint with example requests and responses, plus the live <code>settings</code> table at the bottom.</td></tr>
<tr><td><a href="https://miscsubjects.com/api/settings">https://miscsubjects.com/api/settings</a></td><td>GET, POST, OPTIONS</td><td>List all settings / create a new key. See §5.</td></tr>
<tr><td><a href="https://miscsubjects.com/api/settings/&lt;key&gt;">https://miscsubjects.com/api/settings/&lt;key&gt;</a></td><td>GET, PUT, PATCH, DELETE, OPTIONS</td><td>Read/upsert/patch/delete one setting. See §5.</td></tr>
<tr><td><a href="https://miscsubjects.com/api/pages">https://miscsubjects.com/api/pages</a></td><td>GET, POST, OPTIONS</td><td>List all pages / create a new page. See §6.</td></tr>
<tr><td><a href="https://miscsubjects.com/api/pages/&lt;slug&gt;">https://miscsubjects.com/api/pages/&lt;slug&gt;</a></td><td>GET, PUT, PATCH, DELETE, OPTIONS</td><td>Read/upsert/patch/delete one page. Append <code>?versions=1</code> to GET for full history. See §6.</td></tr>
<tr><td><a href="https://miscsubjects.com/grok">https://miscsubjects.com/grok</a></td><td>GET, POST</td><td>Browser UI for editing Grok system prompt, model, temperature, web-search toggle; plus the Grok ledger table. See §7.</td></tr>
<tr><td><a href="https://miscsubjects.com/grok/audit">https://miscsubjects.com/grok/audit</a></td><td>POST, OPTIONS</td><td>Send current + proposed value, get Grok's approve/reject/review verdict. See §8.</td></tr>
<tr><td><a href="https://miscsubjects.com/blooio">https://miscsubjects.com/blooio</a></td><td>GET, POST</td><td>POST: webhook receiver from Blooio. GET: log viewer + prompt editor. See §9.</td></tr>
<tr><td><a href="https://miscsubjects.com/capi">https://miscsubjects.com/capi</a></td><td>GET, POST</td><td>POST: server-side Meta Pixel event mirror. GET: returns config JSON. See §10.</td></tr>
<tr><td><a href="https://miscsubjects.com/admin">https://miscsubjects.com/admin</a></td><td>GET</td><td>Admin dashboard. Cards for each table + editor.</td></tr>
<tr><td><a href="https://miscsubjects.com/admin/manual">https://miscsubjects.com/admin/manual</a></td><td>GET</td><td>This page.</td></tr>
<tr><td><a href="https://miscsubjects.com/admin/settings">https://miscsubjects.com/admin/settings</a></td><td>GET</td><td>Read-only view of every row in <code>settings</code>.</td></tr>
<tr><td><a href="https://miscsubjects.com/admin/blooio-logs">https://miscsubjects.com/admin/blooio-logs</a></td><td>GET</td><td>Last 500 rows of <code>blooio_logs</code>.</td></tr>
<tr><td><a href="https://miscsubjects.com/admin/blooio-dedup">https://miscsubjects.com/admin/blooio-dedup</a></td><td>GET</td><td>Last 500 rows of <code>blooio_dedup</code>.</td></tr>
<tr><td><a href="https://miscsubjects.com/admin/grok-ledger">https://miscsubjects.com/admin/grok-ledger</a></td><td>GET</td><td>Last 500 rows of <code>grok_ledger</code>.</td></tr>
<tr><td><a href="https://miscsubjects.com/admin/pages">https://miscsubjects.com/admin/pages</a></td><td>GET</td><td>Inline editor for the <code>pages</code> table.</td></tr>
<tr><td><a href="https://miscsubjects.com/admin/pages-versions">https://miscsubjects.com/admin/pages-versions</a></td><td>GET</td><td>Last 500 rows of <code>pages_versions</code> (audit log of every page save).</td></tr>
<tr><td><a href="https://miscsubjects.com/architecture">https://miscsubjects.com/architecture</a></td><td>GET</td><td>Static text describing what the build is and what it cannot do.</td></tr>
</tbody>
</table>

<h2 id="flows">4. End-to-end flows</h2>

<h3>4.1 Visitor lands on the homepage and gets routed</h3>
<ol>
  <li>Browser GETs <a href="https://miscsubjects.com/">https://miscsubjects.com/</a>.</li>
  <li>Static <code>index.html</code> loads. Body is hidden. JS POSTs visitor signals to <code>https://miscsubjects-cloaker-router.owner-account.workers.dev/miscsubjects</code> (a separate Worker, NOT this project).</li>
  <li>If the cloaker Worker returns JS, the homepage runs <code>eval(a)</code> on it (the body of which redirects to <code>/m</code>). The browser fetches <a href="https://miscsubjects.com/m">https://miscsubjects.com/m</a>.</li>
  <li>This project's <code>functions/[slug].js</code> matches <code>m</code>, selects <code>body_html</code> from D1 <code>pages</code>, returns the HTML.</li>
  <li>The cloaker also fires a Meta Pixel Lead event and POSTs the same event to <a href="https://miscsubjects.com/capi">/capi</a> for server-side mirroring.</li>
</ol>

<h3>4.2 Visitor texts the Blooio number and Grok replies</h3>
<ol>
  <li>Visitor sends iMessage to <code>[BUILD_PHONE]</code>.</li>
  <li>Blooio POSTs a webhook to <a href="https://miscsubjects.com/blooio">https://miscsubjects.com/blooio</a>.</li>
  <li>The Worker logs the raw payload to <code>blooio_logs</code> with <code>direction = 'IN'</code>.</li>
  <li>The Worker checks: is the event an inbound message? Is the sender's number different from <code>[BUILD_PHONE]</code> (loop guard)? Is there a message body? If any check fails, returns 200 and stops.</li>
  <li>The Worker INSERTs the <code>message_id</code> into <code>blooio_dedup</code>. If <code>changes = 0</code>, it has already replied — returns 200 and stops.</li>
  <li>The Worker reads <code>system_prompt</code>, <code>grok_model</code>, <code>grok_temperature</code>, <code>grok_web_search</code> — KV first, D1 fallback.</li>
  <li>The Worker POSTs to <code>https://api.x.ai/v1/chat/completions</code> with the system prompt, the visitor's message as the user message, and (if set) <code>temperature</code> and <code>tools:[{type:"web_search_preview"}]</code>. The request — with <code>Authorization</code> redacted — and the response body are written to <code>grok_ledger</code> with <code>source = 'blooio'</code>.</li>
  <li>The Worker POSTs Grok's reply text to <code>https://backend.blooio.com/v2/api/chats/&lt;sender&gt;/messages</code>. The full request and response are written to <code>blooio_logs</code> with <code>direction = 'OUT'</code>.</li>
</ol>

<h3>4.3 You change Grok's system prompt</h3>
<ol>
  <li>You open <a href="https://miscsubjects.com/grok">https://miscsubjects.com/grok</a>.</li>
  <li>The page calls <code>GET /grok?data=1</code>. The Worker reads each of the four hot keys from KV first, then D1 fallback; reads the last 500 ledger rows from D1.</li>
  <li>You edit the textarea. You optionally change model / temperature / web-search.</li>
  <li>You click Save. The browser POSTs <code>{action:'save', prompt, model, temperature, web_search}</code> to <code>/grok</code>.</li>
  <li>The Worker writes each changed key to D1 <code>settings</code> AND to KV. Both stores are now updated.</li>
  <li>The next inbound iMessage uses the new values.</li>
</ol>

<h3>4.4 You change a public page's HTML</h3>
<ol>
  <li>You open <a href="https://miscsubjects.com/admin/pages">https://miscsubjects.com/admin/pages</a>.</li>
  <li>You pick the slug, edit the title and body, click Save.</li>
  <li>The browser PUTs JSON to <code>/api/pages/&lt;slug&gt;</code>.</li>
  <li>The Worker increments <code>version</code> by 1, UPSERTs <code>pages</code>, INSERTs a snapshot row into <code>pages_versions</code>.</li>
  <li>Any visitor hitting <code>https://miscsubjects.com/&lt;slug&gt;</code> from now on sees the new HTML.</li>
  <li>To revert: click "revert" next to an older version in the editor — it loads that version into the textarea — click Save to commit it as a new version.</li>
</ol>

<h3>4.5 You audit a proposed page change with Grok before applying it</h3>
<ol>
  <li>You compute or paste the current HTML and the proposed HTML.</li>
  <li>You POST to <a href="https://miscsubjects.com/grok/audit">/grok/audit</a> with <code>{target, context, current, proposed}</code>.</li>
  <li>The Worker reads <code>grok_audit_prompt</code> (or uses the built-in default) and <code>grok_audit_model</code> (or falls back to <code>grok_model</code>).</li>
  <li>The Worker POSTs to xAI with <code>response_format:{type:"json_object"}</code>. The full request and raw response are logged to <code>grok_ledger</code> with <code>source = 'audit'</code>.</li>
  <li>You receive <code>{verdict:{verdict, reasons, diff_summary}, raw_response}</code>. If you trust the verdict, PUT the proposed HTML to <code>/api/pages/&lt;slug&gt;</code>.</li>
</ol>

<h3>4.6 A browser Pixel event fires and gets mirrored to Meta server-side</h3>
<ol>
  <li>Visitor triggers a Lead event in the page JS. <code>fbq('track','Lead', {}, {eventID: eid})</code> sends to Meta browser-side.</li>
  <li>The page also POSTs <code>{event_name:'Lead', event_id:eid, event_source_url, fbp, fbc}</code> to <a href="https://miscsubjects.com/capi">/capi</a> via <code>navigator.sendBeacon</code>.</li>
  <li>The Worker builds a Conversions API payload with the same <code>event_id</code> (so Meta dedups), adds <code>client_ip_address</code> and <code>client_user_agent</code> from request headers, SHA-256 hashes any <code>em</code>/<code>ph</code>/<code>external_id</code>, POSTs to <code>https://graph.facebook.com/v22.0/27209526152071970/events?access_token=…</code>.</li>
  <li>The Worker returns <code>{ok, status, meta_response, sent_payload}</code>. Nothing is logged to D1.</li>
</ol>

<h2 id="api-settings">5. Settings API — /api/settings</h2>
<p>REST over the D1 <code>settings</code> table. Same shape as a key/value store. <code>value</code> may be a plain string or a JSON-encoded object. PATCH on a JSON-object value merges keys.</p>

<h3>5.1 GET /api/settings — list all</h3>
<pre>curl https://miscsubjects.com/api/settings</pre>
<p>Response: <code>{ data: [ {key, value, description, updated_at}, ... ], count }</code>. Sorted by key ascending.</p>

<h3>5.2 GET /api/settings/&lt;key&gt; — read one</h3>
<pre>curl https://miscsubjects.com/api/settings/system_prompt</pre>
<p>Response: <code>{key, value, description, updated_at}</code> or <code>404 {error:"not found"}</code>.</p>

<h3>5.3 POST /api/settings — create new</h3>
<pre>curl -X POST https://miscsubjects.com/api/settings \\
  -H 'Content-Type: application/json' \\
  -d '{"key":"my_key","value":"my_value","description":"optional"}'</pre>
<p>Required: <code>key</code>, <code>value</code>. 201 on create. 409 if key already exists — use PUT to overwrite.</p>

<h3>5.4 PUT /api/settings/&lt;key&gt; — upsert</h3>
<pre>curl -X PUT https://miscsubjects.com/api/settings/grok_model \\
  -H 'Content-Type: application/json' \\
  -d '{"value":"grok-build-0.1","description":"optional"}'</pre>
<p>Creates if missing, fully overwrites if present. Idempotent.</p>

<h3>5.5 PATCH /api/settings/&lt;key&gt; — partial update</h3>
<pre>curl -X PATCH https://miscsubjects.com/api/settings/config \\
  -H 'Content-Type: application/json' \\
  -d '{"value":{"temperature":0.9}}'</pre>
<p>If the existing <code>value</code> parses as JSON and the request <code>value</code> is an object, the two are shallow-merged. Otherwise the request <code>value</code> replaces the existing one. Returns 404 if key not found.</p>

<h3>5.6 DELETE /api/settings/&lt;key&gt;</h3>
<pre>curl -X DELETE https://miscsubjects.com/api/settings/my_key</pre>
<p>Permanent. 404 if not found. Returns <code>{deleted:"my_key"}</code>.</p>

<p class="warn">Note: writes to <code>/api/settings</code> do NOT propagate to KV. The KV-mirrored keys (<code>system_prompt</code>, <code>grok_model</code>, <code>grok_temperature</code>, <code>grok_web_search</code>) only stay in sync when saved via <a href="https://miscsubjects.com/grok">/grok</a> or <a href="https://miscsubjects.com/blooio">/blooio</a> action <code>save_prompt</code>. If you PUT one of those keys directly via /api/settings, /grok and /blooio will keep reading the OLD value from KV until you save again from /grok or call <code>wrangler kv key put</code> manually.</p>

<h2 id="api-pages">6. Pages API — /api/pages</h2>
<p>REST over the D1 <code>pages</code> table. Every write also inserts a snapshot row into <code>pages_versions</code> and bumps the version counter by 1.</p>

<h3>6.1 GET /api/pages — list all</h3>
<pre>curl https://miscsubjects.com/api/pages</pre>
<p>Response: <code>{ data: [{slug, title, body_html, version, updated_at}, ...], count }</code>.</p>

<h3>6.2 GET /api/pages/&lt;slug&gt; — read one</h3>
<pre>curl https://miscsubjects.com/api/pages/privacy</pre>

<h3>6.3 GET /api/pages/&lt;slug&gt;?versions=1 — full version history</h3>
<pre>curl 'https://miscsubjects.com/api/pages/privacy?versions=1'</pre>
<p>Response: <code>{ data: [{id, slug, version, title, body_html, created_at, actor}, ...], count }</code>, ordered version DESC.</p>

<h3>6.4 POST /api/pages — create</h3>
<pre>curl -X POST https://miscsubjects.com/api/pages \\
  -H 'Content-Type: application/json' \\
  -d '{"slug":"thanks-v2","title":"Thanks","body_html":"&lt;!doctype html&gt;..."}'</pre>
<p>Required: <code>slug</code>, <code>body_html</code>. Optional: <code>title</code>. 201 on create. 409 if slug exists. Inserts version 1 into <code>pages_versions</code> with <code>actor = 'api'</code>.</p>

<h3>6.5 PUT /api/pages/&lt;slug&gt; — upsert</h3>
<pre>curl -X PUT https://miscsubjects.com/api/pages/privacy \\
  -H 'Content-Type: application/json' \\
  -d '{"title":"Privacy","body_html":"&lt;!doctype html&gt;...","actor":"the owner"}'</pre>
<p>Required: <code>body_html</code>. Optional: <code>title</code>, <code>actor</code>. Bumps <code>version</code> by 1. Inserts snapshot into <code>pages_versions</code>. If <code>title</code> is omitted, keeps the existing title.</p>

<h3>6.6 PATCH /api/pages/&lt;slug&gt; — partial</h3>
<pre>curl -X PATCH https://miscsubjects.com/api/pages/privacy \\
  -H 'Content-Type: application/json' \\
  -d '{"body_html":"&lt;!doctype html&gt;..."}'</pre>
<p>Only fields you send are updated; the rest are kept. Still bumps <code>version</code> and inserts a snapshot. 404 if slug not found.</p>

<h3>6.7 DELETE /api/pages/&lt;slug&gt;</h3>
<pre>curl -X DELETE https://miscsubjects.com/api/pages/thanks-v2</pre>
<p>Deletes from <code>pages</code>. <code>pages_versions</code> rows for that slug are NOT deleted — they remain as audit history.</p>

<h2 id="grok-ui">7. Grok page — /grok</h2>
<p>Browser UI at <a href="https://miscsubjects.com/grok">https://miscsubjects.com/grok</a>. Controls:</p>
<ul>
  <li><strong>Model</strong> dropdown. Writes <code>grok_model</code>. Choices: <code>grok-4.3</code>, <code>grok-build-0.1</code>, <code>grok-4.20-0309-reasoning</code>, <code>grok-4.20-0309-non-reasoning</code>.</li>
  <li><strong>Temperature</strong> number input. Writes <code>grok_temperature</code>. Step 0.05, range 0–2. If non-numeric or blank, omitted from the Grok request.</li>
  <li><strong>Web search</strong> checkbox. Writes <code>grok_web_search</code> as <code>1</code> or <code>0</code>. If <code>1</code>, the Grok request body includes <code>"tools":[{"type":"web_search_preview"}]</code>.</li>
  <li><strong>Plain text</strong> tab — the system prompt as plain text. Writes <code>system_prompt</code>.</li>
  <li><strong>JSON payload</strong> tab — the full HTTP request that would be sent to xAI, pretty-printed. Edits here override the plain-text tab on save (the Worker extracts <code>body.messages[role=system].content</code>, <code>body.model</code>, <code>body.temperature</code>, and <code>body.tools</code> from the JSON).</li>
  <li><strong>Grok Ledger</strong> table at the bottom — last 500 rows of <code>grok_ledger</code> with computed per-row cost based on <code>PRICING_ALL</code> in the source file. Cost is informational; the source of truth is xAI's invoice.</li>
</ul>
<p>Save action: POSTs <code>{action:'save', prompt, model, temperature, web_search}</code>. Writes each present field to both D1 <code>settings</code> and KV.</p>
<p>To read the same data from a terminal:</p>
<pre>curl https://miscsubjects.com/grok?data=1</pre>
<p>Response: <code>{prompt, model, temperature, web_search, ledger:[...last 500 rows...]}</code>.</p>

<h2 id="grok-audit">8. Grok audit — /grok/audit</h2>
<p>POST only. Sends a current/proposed pair to Grok with a strict-JSON system prompt; logs the full call to <code>grok_ledger</code>; returns Grok's verdict object.</p>

<h3>8.1 Request body</h3>
<table>
<thead><tr><th>field</th><th>required</th><th>meaning</th></tr></thead>
<tbody>
<tr><td><code>current</code></td><td>one of current or proposed</td><td>the existing value (string or any JSON value)</td></tr>
<tr><td><code>proposed</code></td><td>one of current or proposed</td><td>the new value</td></tr>
<tr><td><code>target</code></td><td>no</td><td>identifier for what is being changed, e.g. <code>"pages/privacy"</code></td></tr>
<tr><td><code>context</code></td><td>no</td><td>free-text reason for the change</td></tr>
</tbody>
</table>

<h3>8.2 What the Worker does</h3>
<ol>
  <li>Reads <code>grok_audit_prompt</code> from KV/D1; if missing, uses the embedded default: <em>"You are an audit gate for runtime content changes…"</em>.</li>
  <li>Reads <code>grok_audit_model</code>; if missing, uses <code>grok_model</code>; if missing, uses <code>grok-4.3</code>.</li>
  <li>POSTs to xAI <code>chat/completions</code> with <code>response_format:{type:"json_object"}</code>.</li>
  <li>Parses the assistant content as JSON into the <code>verdict</code> field. If parsing fails, <code>verdict</code> is <code>null</code> but <code>raw_response</code> is still returned.</li>
  <li>INSERTs a row into <code>grok_ledger</code> with <code>source = 'audit'</code>.</li>
</ol>

<h3>8.3 Example</h3>
<pre>curl -X POST https://miscsubjects.com/grok/audit \\
  -H 'Content-Type: application/json' \\
  -d '{
    "target": "pages/privacy",
    "context": "adding California rights",
    "current": "&lt;h2&gt;Privacy&lt;/h2&gt;&lt;p&gt;...&lt;/p&gt;",
    "proposed": "&lt;h2&gt;Privacy&lt;/h2&gt;&lt;p&gt;...&lt;/p&gt;&lt;h2&gt;Your California rights&lt;/h2&gt;..."
  }'</pre>
<p>Response shape:</p>
<pre>{
  "verdict": {
    "verdict": "approve" | "reject" | "review",
    "reasons": [string, ...],
    "diff_summary": string
  },
  "raw_response": "&lt;full xAI response body as string&gt;"
}</pre>
<p>Error responses:</p>
<ul>
  <li><code>500 {"error":"GROK_API_KEY secret not set"}</code> — fix by setting the secret (see §15).</li>
  <li><code>400 {"error":"invalid json"}</code> — fix the request body.</li>
  <li><code>400 {"error":"current or proposed required"}</code> — at least one must be present.</li>
</ul>

<h3>8.4 To change the audit system prompt</h3>
<pre>curl -X PUT https://miscsubjects.com/api/settings/grok_audit_prompt \\
  -H 'Content-Type: application/json' \\
  -d '{"value":"Your new audit instructions here."}'</pre>
<p>The new prompt takes effect on the next /grok/audit call.</p>

<h2 id="blooio">9. Blooio webhook — /blooio</h2>

<h3>9.1 POST /blooio</h3>
<p>Blooio fires this URL whenever an iMessage event occurs at <code>[BUILD_PHONE]</code>. The full handler logic, in order:</p>
<ol>
  <li>Read raw body.</li>
  <li>If JSON body has <code>action == 'save_prompt'</code>, write <code>parsed.prompt</code> to <code>system_prompt</code> in D1 and KV. Return <code>{ok:true}</code>. (This is the "save" hook used by /blooio's own prompt textarea.)</li>
  <li>Otherwise: INSERT into <code>blooio_logs</code> with <code>direction='IN'</code> and the raw body.</li>
  <li>If body is not JSON, return 200.</li>
  <li>Extract <code>event</code>, <code>sender</code>/<code>external_id</code>/<code>from</code>, <code>message_id</code>/<code>id</code>, <code>text</code>/<code>body</code>/<code>message</code>.</li>
  <li>If <code>event</code> does not contain "received", "inbound", or "incoming", return 200.</li>
  <li>If sender phone digits match <code>[BUILD_PHONE]</code> (loop guard), return 200.</li>
  <li>If no message body, return 200.</li>
  <li>If <code>message_id</code> is present, INSERT into <code>blooio_dedup</code>. If 0 changes (already seen), return 200.</li>
  <li>Read <code>system_prompt</code>, <code>grok_model</code>, <code>grok_temperature</code>, <code>grok_web_search</code> from KV with D1 fallback.</li>
  <li>Build Grok request body. Include <code>temperature</code> if numeric. Include <code>tools:[{type:"web_search_preview"}]</code> if <code>grok_web_search</code> is <code>1</code>/<code>true</code>.</li>
  <li>POST to <code>https://api.x.ai/v1/chat/completions</code> with <code>Authorization: Bearer $GROK_API_KEY</code>. Capture the response text. INSERT into <code>grok_ledger</code> with <code>source='blooio'</code>, the redacted request, and the raw response.</li>
  <li>If no reply text, return 200.</li>
  <li>POST reply to <code>https://backend.blooio.com/v2/api/chats/&lt;url-encoded-sender&gt;/messages</code> with <code>Authorization: Bearer $BLOOIO_API_KEY</code>. INSERT redacted request and raw response into <code>blooio_logs</code> with <code>direction='OUT'</code>.</li>
  <li>Return 200.</li>
</ol>

<h3>9.2 GET /blooio</h3>
<ul>
  <li>Plain GET: HTML page with system prompt textarea + webhook log table.</li>
  <li><code>GET /blooio?data=1</code>: <code>{results:[ last 500 blooio_logs rows ]}</code>.</li>
  <li><code>GET /blooio?prompt=1</code>: <code>{prompt:"&lt;current system_prompt&gt;"}</code>.</li>
</ul>

<h2 id="capi">10. Meta CAPI — /capi</h2>

<h3>10.1 POST /capi</h3>
<p>Mirrors a browser-side Pixel event to Meta's Conversions API server-side.</p>
<p>Accepted body fields:</p>
<table>
<thead><tr><th>field</th><th>type</th><th>used as</th></tr></thead>
<tbody>
<tr><td><code>event_name</code></td><td>string</td><td>defaults to <code>"Lead"</code></td></tr>
<tr><td><code>event_id</code></td><td>string</td><td>used to dedup with the browser event. If missing, server generates one.</td></tr>
<tr><td><code>event_source_url</code></td><td>string</td><td>defaults to <code>Referer</code> header or homepage</td></tr>
<tr><td><code>fbp</code></td><td>string</td><td>Facebook browser-id cookie</td></tr>
<tr><td><code>fbc</code></td><td>string</td><td>Facebook click-id cookie</td></tr>
<tr><td><code>em</code></td><td>string</td><td>email — SHA-256 hashed server-side</td></tr>
<tr><td><code>ph</code></td><td>string</td><td>phone — digits only, SHA-256 hashed server-side</td></tr>
<tr><td><code>external_id</code></td><td>string</td><td>any user id — SHA-256 hashed</td></tr>
<tr><td><code>test_event_code</code></td><td>string</td><td>echoes into Meta's test events tab</td></tr>
</tbody>
</table>
<p>Hardcoded in the code: pixel id <code>27209526152071970</code>, graph version <code>v22.0</code>. Server adds <code>client_ip_address</code> (from <code>cf-connecting-ip</code>) and <code>client_user_agent</code> (from <code>user-agent</code>).</p>
<p>Response: <code>{ok, status, meta_response, sent_payload}</code>. Status 200 if Meta returned 2xx, 502 otherwise. Errors: <code>500 {error:"META_CAPI_TOKEN secret not set"}</code> or <code>400 {error:"invalid json body"}</code>.</p>

<h3>10.2 GET /capi</h3>
<p>Returns a JSON banner: <code>{ok:true, endpoint, method, pixel_id, graph_version, hint}</code>. No state.</p>

<h2 id="pages-editor">11. Pages editor — /admin/pages</h2>
<p>Single-page editor for the <code>pages</code> table.</p>
<ul>
  <li><strong>Slug</strong> dropdown — pick a slug to edit. On change, calls <code>GET /api/pages/&lt;slug&gt;</code> and fills Title + Body. Also calls <code>GET /api/pages/&lt;slug&gt;?versions=1</code> and renders the Versions table.</li>
  <li><strong>New slug</strong> input + <strong>Create</strong> button — POSTs to <code>/api/pages</code> with a placeholder body. The new slug becomes editable.</li>
  <li><strong>Title</strong> input — plain text.</li>
  <li><strong>Body HTML</strong> textarea — the entire HTML document.</li>
  <li><strong>Save</strong> — PUTs to <code>/api/pages/&lt;slug&gt;</code> with <code>{title, body_html, actor:"admin"}</code>. Returns the new <code>version</code>.</li>
  <li><strong>Delete</strong> — confirms, then DELETEs. The slug is removed from <code>pages</code>. <code>pages_versions</code> rows remain.</li>
  <li><strong>Versions table</strong> — lists every version. Click "revert" — that version's title and body load into the editor; click Save to commit as a new version.</li>
</ul>
<p>The URL accepts <code>?slug=&lt;slug&gt;</code> to deep-link. Example: <a href="https://miscsubjects.com/admin/pages?slug=privacy">https://miscsubjects.com/admin/pages?slug=privacy</a>.</p>

<h2 id="admin-tables">12. Admin table views — /admin/&lt;table&gt;</h2>
<p>Generic read-only table viewer. URL pattern <code>/admin/&lt;slug&gt;</code>. Allowed slugs (anything else → 404):</p>
<ul>
  <li><code>settings</code> → <code>SELECT key, value, description, updated_at FROM settings ORDER BY key ASC</code></li>
  <li><code>blooio-logs</code> → last 500 of <code>blooio_logs</code></li>
  <li><code>blooio-dedup</code> → last 500 of <code>blooio_dedup</code></li>
  <li><code>grok-ledger</code> → last 500 of <code>grok_ledger</code></li>
  <li><code>pages-versions</code> → last 500 of <code>pages_versions</code></li>
</ul>
<p>This is a viewer, not an editor. To write: use the REST API or, for <code>pages</code>, the editor at <a href="https://miscsubjects.com/admin/pages">/admin/pages</a>.</p>

<h2 id="dynamic-slugs">13. Public dynamic slugs — /&lt;slug&gt;</h2>
<p>File: <code>functions/[slug].js</code>. Logic:</p>
<ol>
  <li>Lowercase the slug.</li>
  <li>If the slug is one of <code>api admin grok blooio architecture capi control spec edit article condition import-export import export</code>, return 404. (Defense against accidental shadowing.)</li>
  <li><code>SELECT body_html FROM pages WHERE slug = ?</code>.</li>
  <li>If null, return 404. Else return the HTML with <code>Content-Type: text/html; charset=utf-8</code> and <code>Cache-Control: no-store</code>.</li>
</ol>
<p>Note: static files in <code>public/</code> are served before the Worker function runs. The homepage <code>index.html</code> stays static; <code>m.html</code>, <code>privacy.html</code>, <code>success.html</code> have been deleted, which is why <code>functions/[slug].js</code> now answers those paths.</p>

<h2 id="wrangler">14. Project config & bindings (wrangler.toml)</h2>
<pre>name = "miscsubjects-pages"
pages_build_output_dir = "public"
compatibility_date = "2024-09-01"

[[d1_databases]]
binding = "DB"
database_name = "miscsubjects-content"
database_id = "298eb858-37fb-4c73-8be4-135e8feb73fe"

[[kv_namespaces]]
binding = "KV"
id = "58b303e666a8431685624e0cfd2fd63f"</pre>
<p>To add a new binding (e.g. R2 bucket), edit this file and run <code>npx wrangler pages deploy public --project-name miscsubjects-pages --commit-dirty=true</code>. Bindings cannot be added at runtime.</p>

<h2 id="secrets">15. Secrets</h2>
<p>Stored encrypted in the Cloudflare Pages project, NOT in this repo. Available in code as <code>env.&lt;NAME&gt;</code>.</p>
<table>
<thead><tr><th>secret</th><th>used by</th><th>set with</th></tr></thead>
<tbody>
<tr><td><code>GROK_API_KEY</code></td><td>/blooio, /grok/audit (sent as <code>Authorization: Bearer $GROK_API_KEY</code> to xAI)</td><td><code>npx wrangler pages secret put GROK_API_KEY --project-name miscsubjects-pages</code></td></tr>
<tr><td><code>BLOOIO_API_KEY</code></td><td>/blooio (outbound reply to Blooio backend)</td><td><code>npx wrangler pages secret put BLOOIO_API_KEY --project-name miscsubjects-pages</code></td></tr>
<tr><td><code>META_CAPI_TOKEN</code></td><td>/capi (sent as <code>access_token</code> query param to Meta Graph)</td><td><code>npx wrangler pages secret put META_CAPI_TOKEN --project-name miscsubjects-pages</code></td></tr>
</tbody>
</table>

<h2 id="operations">16. Operations — deploy, migrate, KV, D1, secrets</h2>

<h3>16.1 Deploy</h3>
<pre>cd /Users/owner/miscsubjects-pages
npx wrangler pages deploy public --project-name miscsubjects-pages --commit-dirty=true</pre>
<p>This uploads <code>public/</code> as static assets and the entire <code>functions/</code> tree as the Pages Functions bundle. The output line ending in <code>pages.dev</code> is the preview hash; the production hostname is <a href="https://miscsubjects.com">https://miscsubjects.com</a>.</p>

<h3>16.2 Apply a database migration</h3>
<p>Write a new SQL file under <code>migrations/</code>. Numbering is sequential. Then:</p>
<pre>npx wrangler d1 migrations apply miscsubjects-content --remote</pre>
<p>List of current migrations:</p>
<ul>
  <li><code>0001_blooio_logs.sql</code> — creates <code>blooio_logs</code>.</li>
  <li><code>0002_settings_dedup.sql</code> — creates <code>settings</code> and <code>blooio_dedup</code>; seeds <code>system_prompt</code>.</li>
  <li><code>0003_settings_v2.sql</code> — adds <code>description</code> and <code>updated_at</code> columns to <code>settings</code>.</li>
  <li><code>0004_grok_ledger.sql</code> — creates <code>grok_ledger</code>.</li>
  <li><code>0005_pages.sql</code> — creates <code>pages</code> and <code>pages_versions</code>.</li>
  <li><code>0006_pages_seed.sql</code> — inserts <code>m</code>, <code>privacy</code>, <code>success</code> at version 1.</li>
</ul>

<h3>16.3 Inspect or change D1 from the terminal</h3>
<pre>npx wrangler d1 execute miscsubjects-content --remote --command "SELECT * FROM settings ORDER BY key;"
npx wrangler d1 execute miscsubjects-content --remote --command "SELECT id, timestamp, source FROM grok_ledger ORDER BY id DESC LIMIT 20;"
npx wrangler d1 execute miscsubjects-content --remote --command "DELETE FROM blooio_logs WHERE id &lt; 100;"</pre>

<h3>16.4 Inspect or change KV from the terminal</h3>
<pre>npx wrangler kv key list --namespace-id 58b303e666a8431685624e0cfd2fd63f --remote
npx wrangler kv key get --namespace-id 58b303e666a8431685624e0cfd2fd63f --remote system_prompt
npx wrangler kv key put --namespace-id 58b303e666a8431685624e0cfd2fd63f --remote grok_model "grok-build-0.1"
npx wrangler kv key put --namespace-id 58b303e666a8431685624e0cfd2fd63f --remote system_prompt --path /tmp/prompt.txt
npx wrangler kv key delete --namespace-id 58b303e666a8431685624e0cfd2fd63f --remote grok_temperature</pre>

<h3>16.5 Manage secrets</h3>
<pre>npx wrangler pages secret put GROK_API_KEY --project-name miscsubjects-pages
npx wrangler pages secret list --project-name miscsubjects-pages
npx wrangler pages secret delete GROK_API_KEY --project-name miscsubjects-pages</pre>

<h2 id="cannot">17. What you cannot do without redeploying</h2>
<ul>
  <li>Change <code>wrangler.toml</code> (bindings, project name, compatibility date). Requires <code>wrangler pages deploy</code>.</li>
  <li>Change any file under <code>functions/</code> (the Worker code itself). Requires deploy.</li>
  <li>Change <code>public/index.html</code>, <code>public/_routes.json</code>, or any other file under <code>public/</code>. Requires deploy.</li>
  <li>Change a secret value as seen by the Worker. Requires <code>wrangler pages secret put</code>.</li>
  <li>Add a new endpoint. Requires a new file under <code>functions/</code> and a deploy.</li>
</ul>
<p>Runtime-editable without deploy:</p>
<ul>
  <li>Any row in <code>pages</code> — via /admin/pages or /api/pages.</li>
  <li>Any row in <code>settings</code> — via /api/settings, or for the four KV-mirrored keys via /grok.</li>
  <li>Any KV key in <code>loop_content_kv</code> — via /grok or <code>wrangler kv</code>.</li>
  <li>Audit prompt and audit model — via /api/settings/grok_audit_prompt and /api/settings/grok_audit_model.</li>
</ul>

<h2 id="audit-checks">18. Audit checks — verify the build yourself</h2>
<p>Run these from your terminal. Each one tells you whether a piece of the system is alive and what state it is in. No abstraction — copy and paste.</p>

<h4>18.1 Are the three runtime-edited pages served from D1?</h4>
<pre>curl -s -o /dev/null -w "%{http_code} %{size_download}b\\n" https://miscsubjects.com/m
curl -s -o /dev/null -w "%{http_code} %{size_download}b\\n" https://miscsubjects.com/privacy
curl -s -o /dev/null -w "%{http_code} %{size_download}b\\n" https://miscsubjects.com/success</pre>
<p>Expected: each prints <code>200 &lt;some-bytes&gt;</code>.</p>

<h4>18.2 Does the pages REST API return the expected slugs?</h4>
<pre>curl -s https://miscsubjects.com/api/pages | python3 -m json.tool | head -30</pre>
<p>Expected: a JSON object with <code>count</code> and <code>data</code> containing slugs <code>m</code>, <code>privacy</code>, <code>success</code>.</p>

<h4>18.3 Does the version history work?</h4>
<pre>curl -s 'https://miscsubjects.com/api/pages/privacy?versions=1' | python3 -m json.tool</pre>
<p>Expected: at least one row, version 1 with <code>actor = "seed"</code>.</p>

<h4>18.4 Does KV have the four hot keys?</h4>
<pre>npx wrangler kv key list --namespace-id 58b303e666a8431685624e0cfd2fd63f --remote</pre>
<p>Expected: includes <code>system_prompt</code> and <code>grok_model</code> (others appear after the first save).</p>

<h4>18.5 Does the Grok page read both D1 and KV correctly?</h4>
<pre>curl -s 'https://miscsubjects.com/grok?data=1' | python3 -c "import json,sys;d=json.load(sys.stdin);print('model=',d['model']);print('temperature=',d['temperature']);print('web_search=',d['web_search']);print('prompt_first_80=',d['prompt'][:80])"</pre>

<h4>18.6 Does /grok/audit work end-to-end?</h4>
<pre>curl -s -X POST https://miscsubjects.com/grok/audit \\
  -H 'Content-Type: application/json' \\
  -d '{"target":"audit-check","context":"smoke test","current":"v1","proposed":"v1+sentence"}' | python3 -m json.tool</pre>
<p>Expected: a <code>verdict</code> object with <code>verdict</code> ∈ {approve, reject, review}, <code>reasons</code> array, <code>diff_summary</code> string. Costs xAI tokens.</p>

<h4>18.7 Is the audit logged?</h4>
<pre>npx wrangler d1 execute miscsubjects-content --remote --command "SELECT id, timestamp, source FROM grok_ledger WHERE source='audit' ORDER BY id DESC LIMIT 3;"</pre>

<h4>18.8 Is Blooio dedup actually firing?</h4>
<pre>npx wrangler d1 execute miscsubjects-content --remote --command "SELECT count(*) AS in_count FROM blooio_logs WHERE direction='IN';"
npx wrangler d1 execute miscsubjects-content --remote --command "SELECT count(*) AS dedup_count FROM blooio_dedup;"
npx wrangler d1 execute miscsubjects-content --remote --command "SELECT count(*) AS out_count FROM blooio_logs WHERE direction='OUT';"</pre>
<p>If <code>in_count</code> is much larger than <code>out_count</code>, dedup is doing its job. Each unique inbound message produces one OUT row, but Blooio fires each one several times — those extras land as additional IN rows that are then dropped.</p>

<h4>18.9 Is /capi configured?</h4>
<pre>curl -s https://miscsubjects.com/capi | python3 -m json.tool</pre>
<p>Expected: <code>{ok:true, endpoint, pixel_id:"27209526152071970", graph_version:"v22.0", hint}</code>. The token itself is only checked on POST.</p>

<h2 id="directory">19. Directory pattern — the kernel</h2>
<p>The dispatch pattern: schema, four row types, AUTH prefixes, substitution, caps, logging, self-modification. §22 shows current implementation status. §20 lists existing code that collapses into rows. §21 is the rule for adding anything new.</p>

<h3>19.1 The schema. One table.</h3>
<pre>CREATE TABLE directory (
  key        TEXT PRIMARY KEY,
  type       TEXT NOT NULL CHECK (type IN ('fn','http','agent','flow')),
  target     TEXT,
  auth       TEXT,
  content    TEXT,
  updated_at TEXT
);</pre>
<p>Plus a <code>log</code> table that writes one row per dispatch. Capabilities are rows. The kernel is fixed. The directory grows.</p>

<h3>19.2 The four types of row.</h3>
<table>
<thead><tr><th>type</th><th>target</th><th>auth</th><th>content</th><th>what it does</th></tr></thead>
<tbody>
<tr>
  <td><code>fn</code></td>
  <td>function name in the kernel's <code>FN_MAP</code></td>
  <td>empty</td>
  <td>JSON-array template, e.g. <code>["$1","$2"]</code></td>
  <td>Substitute <code>$1..$N</code>, <code>JSON.parse</code>, apply to the function. Output is stringified. Leaf — no network, no LLM, no recursion.</td>
</tr>
<tr>
  <td><code>http</code></td>
  <td><code>METHOD URL</code> with <code>$N</code> placeholders, e.g. <code>POST https://api.example.com/v1/things/$1</code></td>
  <td>see 19.3</td>
  <td>request body template. If it starts with <code>{</code> or <code>[</code>, <code>$N</code> substitutions are JSON-escaped. URL <code>$N</code> placeholders are URL-encoded.</td>
  <td>Substitute, apply auth, <code>fetch()</code>. Output is <code>HTTP &lt;code&gt;:&lt;body&gt;</code> or <code>ERR:http:...</code>. Leaf.</td>
</tr>
<tr>
  <td><code>agent</code></td>
  <td>model id, e.g. <code>grok-build-0.1</code>, <code>claude-opus-4-7</code>, <code>@cf/meta/llama-3.1-8b-instruct</code></td>
  <td>API key env var name (prefixed per 19.3)</td>
  <td>system prompt — the agent row's content.</td>
  <td>Route by model-id prefix to the provider endpoint. POST. Parse the response text for more <code>[KEY]body[/KEY]</code> tags and dispatch each. <code>[SELF]reason[/SELF]</code> in the response iterates with results folded into the next prompt. <code>[DONE]reason[/DONE]</code> stops. <strong>Only type that produces new tags.</strong></td>
</tr>
<tr>
  <td><code>flow</code></td>
  <td>empty</td>
  <td>empty</td>
  <td>DSL string. <code>&gt;</code> = sequence. <code>+</code> = parallel. <code>?:cond &gt; a | b</code> = conditional. <code>=&gt; name</code> = bind output. <code>!:</code> separates forward from rollback steps. Each step is <code>KEY: args</code>.</td>
  <td>Parse the DSL. Execute steps by recursively dispatching against the same directory. Output is the last step's output, or <code>ERR:flow:&lt;msg&gt;</code> if any step failed (in which case rollback steps run). Composition only — cannot do anything a chain of existing rows can't.</td>
</tr>
</tbody>
</table>

<h3>19.3 AUTH prefixes (no implicit sniffing).</h3>
<table>
<thead><tr><th>prefix</th><th>meaning</th></tr></thead>
<tbody>
<tr><td><code>bearer:ENV_NAME</code></td><td>Sets request header <code>Authorization: Bearer &lt;value of secret named ENV_NAME&gt;</code>.</td></tr>
<tr><td><code>headers:{"H1":"v1","H2":"v2"}</code></td><td>Sets each header literally. Inside values, <code>$ENV_NAME</code> is replaced with the secret named ENV_NAME.</td></tr>
<tr><td><code>query:param=ENV_NAME</code></td><td>Appends <code>?param=&lt;value of secret named ENV_NAME&gt;</code> (URL-encoded) to the URL.</td></tr>
<tr><td><code>oauth:</code></td><td>Platform OAuth. Rare on Cloudflare.</td></tr>
<tr><td>(empty)</td><td>No authentication header or query param added.</td></tr>
</tbody>
</table>

<h3>19.4 Substitution.</h3>
<ul>
  <li><code>$1..$N</code> — the body of the tag, split on <code>|</code>, indexed from 1.</li>
  <li><code>$PREV</code> — the previous tag's output in the same response.</li>
  <li><code>$name</code> — a flow binding produced by <code>=&gt; name</code> on an earlier step.</li>
  <li><code>$ENV_NAME</code> — a secret or environment variable, only inside <code>auth</code> values.</li>
</ul>
<p>The kernel has one substitute function with a mode parameter: <code>url</code> (URL-encode), <code>json-string</code> (JSON-escape inside a JSON string literal), <code>header-value</code> (raw), <code>raw</code> (raw). The dispatcher picks the mode for each context.</p>

<h3>19.5 Caps.</h3>
<ul>
  <li><code>DEPTH_CAP = 3</code> — maximum recursion depth when one agent dispatches another agent that dispatches another.</li>
  <li><code>ITER_CAP = 8</code> — maximum number of <code>[SELF]</code> iterations per agent call.</li>
  <li><code>COST_CAP = $1.00</code> — maximum sum of LLM token cost across all calls in one trace.</li>
</ul>

<h3>19.6 Logging.</h3>
<p>Every dispatch writes one row to <code>log</code> with columns: <code>ts</code>, <code>trace</code> (id), <code>step</code> (integer), <code>parent</code> (integer, the parent step's number), <code>input</code>, <code>output</code>. A single inbound message produces a tree of rows under one trace id.</p>

<h3>19.7 Self-modification.</h3>
<p>An agent emits one of these tags to mutate the directory itself:</p>
<ul>
  <li><code>[ADD_ROW]KEY|TYPE|TARGET|AUTH|CONTENT[/ADD_ROW]</code> — insert a new row.</li>
  <li><code>[EDIT_ROW]KEY|TYPE|TARGET|AUTH|CONTENT[/EDIT_ROW]</code> — overwrite an existing row.</li>
  <li><code>[DEL_ROW]KEY[/DEL_ROW]</code> — delete a row.</li>
</ul>
<p>The kernel handles these by writing to the <code>directory</code> table. No new file. No deploy. The next request loads the updated directory.</p>

<h2 id="collapse">20. What collapses into rows (backward list)</h2>
<p>Per-feature JavaScript in <code>functions/</code> becomes directory rows. Each file shrinks to a 5-to-15-line stub that calls <code>dispatch(KEY, args)</code>. Status of each: §22.</p>

<h3>20.1 <code>functions/blooio.js</code></h3>
<p>Today: ~221 lines. Receives Blooio webhook, dedups, reads four settings keys, calls xAI, logs to <code>grok_ledger</code>, POSTs reply to Blooio, logs to <code>blooio_logs</code>.</p>
<p>Collapses into these rows:</p>
<table>
<thead><tr><th>KEY</th><th>TYPE</th><th>TARGET</th><th>AUTH</th><th>CONTENT (summary)</th></tr></thead>
<tbody>
<tr><td><code>ROUTER</code></td><td>agent</td><td>model id (currently <code>grok-build-0.1</code>, today read from <code>settings.grok_model</code>)</td><td><code>bearer:GROK_API_KEY</code></td><td>system prompt, verbatim (currently <code>settings.system_prompt</code>)</td></tr>
<tr><td><code>BLOOIO_SEND</code></td><td>http</td><td><code>POST https://backend.blooio.com/v2/api/chats/$1/messages</code></td><td><code>bearer:BLOOIO_API_KEY</code></td><td><code>{"text":"$2"}</code></td></tr>
<tr><td><code>BLOOIO_DEDUP</code></td><td>fn</td><td><code>dedupInsert</code></td><td>empty</td><td><code>["$1"]</code> — returns <code>OK</code> if new, <code>ERR:dup</code> if seen</td></tr>
<tr><td><code>BLOOIO_LOG_IN</code></td><td>flow</td><td>empty</td><td>empty</td><td><code>D1_EXEC: INSERT INTO blooio_logs(direction,payload) VALUES('IN','$1')</code></td></tr>
<tr><td><code>BLOOIO_LOG_OUT</code></td><td>flow</td><td>empty</td><td>empty</td><td><code>D1_EXEC: INSERT INTO blooio_logs(direction,payload,response) VALUES('OUT','$1','$2')</code></td></tr>
<tr><td><code>BLOOIO_INBOUND</code></td><td>flow</td><td>empty</td><td>empty</td><td><code>BLOOIO_LOG_IN:$RAW &gt; BLOOIO_DEDUP:$ID &gt; ?:$PREV.startsWith('ERR:') &gt; NOOP | ROUTER:$BODY =&gt; reply &gt; BLOOIO_SEND:$SENDER|$reply =&gt; sendres &gt; BLOOIO_LOG_OUT:$SENDER|$sendres</code></td></tr>
</tbody>
</table>
<p>After collapse, <code>functions/blooio.js</code> is: parse webhook, call <code>dispatch('BLOOIO_INBOUND', {RAW, ID, SENDER, BODY})</code>, return 200. About 15 lines.</p>

<h3>20.2 <code>functions/grok/audit.js</code></h3>
<p>Today: ~95 lines. Reads audit prompt and audit model from settings, POSTs to xAI with <code>response_format:{type:"json_object"}</code>, parses content, logs to <code>grok_ledger</code> with <code>source='audit'</code>.</p>
<p>Collapses into:</p>
<table>
<thead><tr><th>KEY</th><th>TYPE</th><th>TARGET</th><th>AUTH</th><th>CONTENT</th></tr></thead>
<tbody>
<tr><td><code>GROK_AUDIT</code></td><td>agent</td><td>model id, e.g. <code>grok-build-0.1</code></td><td><code>bearer:GROK_API_KEY</code></td><td>the audit system prompt verbatim — this row's CONTENT <em>is</em> the prompt</td></tr>
</tbody>
</table>
<p>Consequence: <code>settings.grok_audit_prompt</code> and <code>settings.grok_audit_model</code> become redundant. The prompt is in <code>GROK_AUDIT.content</code>. The model is in <code>GROK_AUDIT.target</code>. Those two settings keys get deleted.</p>
<p>After collapse, <code>functions/grok/audit.js</code> is: parse body, call <code>dispatch('GROK_AUDIT', {target,context,current,proposed})</code>, return what the agent returned. About 15 lines.</p>

<h3>20.3 <code>functions/capi.js</code></h3>
<p>Today: ~109 lines. Parses body, defaults event_name to "Lead", SHA-256 hashes em/ph/external_id, builds user_data with client_ip + user_agent from request headers, POSTs to Meta Graph.</p>
<p>Collapses into:</p>
<table>
<thead><tr><th>KEY</th><th>TYPE</th><th>TARGET</th><th>AUTH</th><th>CONTENT</th></tr></thead>
<tbody>
<tr><td><code>SHA256_LOWER</code></td><td>fn</td><td><code>sha256Lower</code></td><td>empty</td><td><code>["$1"]</code></td></tr>
<tr><td><code>META_CAPI_POST</code></td><td>http</td><td><code>POST https://graph.facebook.com/v22.0/27209526152071970/events</code></td><td><code>query:access_token=META_CAPI_TOKEN</code></td><td>full JSON body template with $N placeholders for event_name, event_id, source, fbp, fbc, hashed em, hashed ph, hashed eid</td></tr>
<tr><td><code>META_CAPI_EVENT</code></td><td>flow</td><td>empty</td><td>empty</td><td><code>SHA256_LOWER:$em =&gt; em_hash &gt; SHA256_LOWER:$ph =&gt; ph_hash &gt; SHA256_LOWER:$eid =&gt; eid_hash &gt; META_CAPI_POST:$event_name|$event_id|$source|$fbp|$fbc|$em_hash|$ph_hash|$eid_hash</code></td></tr>
</tbody>
</table>
<p>After collapse, <code>functions/capi.js</code> is: parse body, add <code>client_ip</code> and <code>user_agent</code> from request headers, call <code>dispatch('META_CAPI_EVENT', ...)</code>, return Meta's response. About 20 lines.</p>

<h3>20.4 <code>functions/grok/index.js</code> (the /grok editor page)</h3>
<p>The page itself is HTML, not a capability — it stays as the editor UI. What collapses is what it edits:</p>
<ul>
  <li><code>settings.system_prompt</code> → <code>ROUTER.content</code>. The agent row's CONTENT IS the system prompt.</li>
  <li><code>settings.grok_model</code> → <code>ROUTER.target</code>.</li>
  <li><code>settings.grok_temperature</code> → either flow-passed argument or baked into ROUTER.content. Variant row <code>ROUTER_HOT</code> if multiple temperatures needed.</li>
  <li><code>settings.grok_web_search</code> → variant row <code>ROUTER_WEBSEARCH</code> with <code>tools:[{type:"web_search_preview"}]</code> in the agent's effective request shape.</li>
</ul>
<p>The /grok page dispatches <code>EDIT_ROW</code> with key <code>ROUTER</code> instead of writing three settings keys.</p>

<h3>20.5 <code>functions/[slug].js</code></h3>
<p>Today: lowercase slug, reject reserved list, <code>SELECT body_html FROM pages WHERE slug=?</code>, return HTML or 404.</p>
<p>Stays as a route-shim. Cloudflare URL routing has to enter the kernel somewhere. The body becomes:</p>
<pre>return dispatch('SERVE_PAGE', { slug: params.slug });</pre>
<p>With one new row:</p>
<table>
<thead><tr><th>KEY</th><th>TYPE</th><th>CONTENT</th></tr></thead>
<tbody>
<tr><td><code>SERVE_PAGE</code></td><td>flow</td><td><code>D1_QUERY:SELECT body_html FROM pages WHERE slug='$slug'</code></td></tr>
</tbody>
</table>

<h3>20.6 <code>functions/api/pages/*.js</code> and <code>functions/api/settings/*.js</code></h3>
<p>Today: four files, each ~50-90 lines, per-method CRUD over D1 tables (<code>pages</code> with version bumping; <code>settings</code> with JSON-merge PATCH).</p>
<p>Collapse into a single catchall <code>functions/api/[[catchall]].js</code> that maps <code>METHOD /api/&lt;table&gt;[/&lt;id&gt;]</code> to a row KEY and dispatches:</p>
<pre>PUT   /api/pages/privacy   → dispatch('PAGES_PUT',    {slug:'privacy', body})
GET   /api/pages           → dispatch('PAGES_LIST')
GET   /api/pages/privacy?versions=1 → dispatch('PAGES_VERSIONS', {slug:'privacy'})
PATCH /api/settings/grok_model → dispatch('SETTINGS_PATCH', {key:'grok_model', body})</pre>
<p>Plus the underlying rows:</p>
<table>
<thead><tr><th>KEY</th><th>TYPE</th><th>CONTENT (summary)</th></tr></thead>
<tbody>
<tr><td><code>D1_QUERY</code></td><td>http</td><td><code>POST https://api.cloudflare.com/client/v4/accounts/$ACCT/d1/database/$DB_ID/query</code> with body <code>{"sql":"$1","params":$2}</code></td></tr>
<tr><td><code>D1_EXEC</code></td><td>http</td><td>same endpoint, writes</td></tr>
<tr><td><code>PAGES_LIST</code></td><td>flow</td><td><code>D1_QUERY: SELECT slug,title,version,updated_at FROM pages ORDER BY slug</code></td></tr>
<tr><td><code>PAGES_GET</code></td><td>flow</td><td><code>D1_QUERY: SELECT * FROM pages WHERE slug='$1'</code></td></tr>
<tr><td><code>PAGES_PUT</code></td><td>flow</td><td>3 D1_EXEC composed: read version, INSERT OR REPLACE into pages, INSERT into pages_versions</td></tr>
<tr><td><code>PAGES_PATCH</code></td><td>flow</td><td>similar to PAGES_PUT, merging fields</td></tr>
<tr><td><code>PAGES_DELETE</code></td><td>flow</td><td><code>D1_EXEC: DELETE FROM pages WHERE slug='$1'</code></td></tr>
<tr><td><code>PAGES_VERSIONS</code></td><td>flow</td><td><code>D1_QUERY: SELECT * FROM pages_versions WHERE slug='$1' ORDER BY version DESC</code></td></tr>
<tr><td><code>SETTINGS_LIST</code> / <code>SETTINGS_GET</code> / <code>SETTINGS_PUT</code> / <code>SETTINGS_PATCH</code> / <code>SETTINGS_DELETE</code></td><td>flow</td><td>each composes one or two D1_QUERY/D1_EXEC calls against the <code>settings</code> table</td></tr>
</tbody>
</table>
<p>After collapse, four per-method files become one ~30-line catchall plus the rows above.</p>

<h3>20.7 <code>functions/admin/[table].js</code></h3>
<p>Today: 92 lines. Hardcoded <code>TABLES</code> object mapping slug → SQL string. Renders a generic HTML table.</p>
<p>Each table becomes a flow row:</p>
<table>
<thead><tr><th>KEY</th><th>CONTENT</th></tr></thead>
<tbody>
<tr><td><code>ADMIN_TABLE_SETTINGS</code></td><td><code>D1_QUERY: SELECT key,value,description,updated_at FROM settings ORDER BY key</code></td></tr>
<tr><td><code>ADMIN_TABLE_BLOOIO_LOGS</code></td><td><code>D1_QUERY: SELECT id,timestamp,direction,payload,response FROM blooio_logs ORDER BY id DESC LIMIT 500</code></td></tr>
<tr><td><code>ADMIN_TABLE_BLOOIO_DEDUP</code></td><td><code>D1_QUERY: SELECT message_id,created_at FROM blooio_dedup ORDER BY rowid DESC LIMIT 500</code></td></tr>
<tr><td><code>ADMIN_TABLE_GROK_LEDGER</code></td><td><code>D1_QUERY: SELECT id,timestamp,source,request,response FROM grok_ledger ORDER BY id DESC LIMIT 500</code></td></tr>
<tr><td><code>ADMIN_TABLE_PAGES_VERSIONS</code></td><td><code>D1_QUERY: SELECT id,slug,version,actor,created_at,length(body_html) AS size_bytes FROM pages_versions ORDER BY id DESC LIMIT 500</code></td></tr>
<tr><td><code>ADMIN_TABLE_DIRECTORY</code></td><td><code>D1_QUERY: SELECT key,type,target,auth,updated_at FROM directory ORDER BY key</code></td></tr>
<tr><td><code>ADMIN_TABLE_LOG</code></td><td><code>D1_QUERY: SELECT ts,trace,step,parent,length(input) AS in_bytes,length(output) AS out_bytes FROM log ORDER BY rowid DESC LIMIT 500</code></td></tr>
</tbody>
</table>
<p>The file shrinks to: dispatch by slug, render rows as a generic HTML table. About 30 lines. The hardcoded <code>TABLES</code> object is gone.</p>

<h3>20.8 Cloudflare account control as rows</h3>
<p>Cloudflare's REST API at <code>api.cloudflare.com/client/v4</code> covers Workers, KV, R2, Pages, D1. Each is one row that any agent can emit. This is what makes the kernel editable from inside itself.</p>
<table>
<thead><tr><th>KEY</th><th>TYPE</th><th>TARGET</th><th>AUTH</th></tr></thead>
<tbody>
<tr><td><code>EDIT_WORKER</code></td><td>http</td><td><code>PUT https://api.cloudflare.com/client/v4/accounts/$ACCT/workers/scripts/$1</code></td><td><code>bearer:CF_API_TOKEN</code></td></tr>
<tr><td><code>PUT_KV</code></td><td>http</td><td><code>PUT https://api.cloudflare.com/client/v4/accounts/$ACCT/storage/kv/namespaces/$NS/values/$1</code></td><td><code>bearer:CF_API_TOKEN</code></td></tr>
<tr><td><code>GET_KV</code></td><td>http</td><td><code>GET https://api.cloudflare.com/client/v4/accounts/$ACCT/storage/kv/namespaces/$NS/values/$1</code></td><td><code>bearer:CF_API_TOKEN</code></td></tr>
<tr><td><code>DEL_KV</code></td><td>http</td><td><code>DELETE https://api.cloudflare.com/client/v4/accounts/$ACCT/storage/kv/namespaces/$NS/values/$1</code></td><td><code>bearer:CF_API_TOKEN</code></td></tr>
<tr><td><code>PUT_R2</code></td><td>http</td><td><code>PUT https://api.cloudflare.com/client/v4/accounts/$ACCT/r2/buckets/$BUCKET/objects/$1</code></td><td><code>bearer:CF_API_TOKEN</code></td></tr>
<tr><td><code>GET_R2</code></td><td>http</td><td><code>GET https://api.cloudflare.com/client/v4/accounts/$ACCT/r2/buckets/$BUCKET/objects/$1</code></td><td><code>bearer:CF_API_TOKEN</code></td></tr>
<tr><td><code>DEPLOY_PAGE</code></td><td>http</td><td><code>POST https://api.cloudflare.com/client/v4/accounts/$ACCT/pages/projects/$1/deployments</code></td><td><code>bearer:CF_API_TOKEN</code></td></tr>
</tbody>
</table>
<p>Effect: an agent emitting <code>[EDIT_WORKER]miscsubjects-pages|&lt;new TS source&gt;[/EDIT_WORKER]</code> replaces this Worker. Emitting <code>[PUT_R2]articles/post-001.md|&lt;markdown body&gt;[/PUT_R2]</code> writes a content file. Emitting <code>[DEPLOY_PAGE]miscsubjects-pages|{...}[/DEPLOY_PAGE]</code> ships a new build. Every part of the Cloudflare account is reachable from inside one tag.</p>

<h3>20.9 Totals</h3>
<p>~700 lines of per-feature JavaScript across seven function files collapse into:</p>
<ul>
  <li>One new kernel file <code>functions/dispatch.js</code> (~400-500 lines, written once, then frozen).</li>
  <li>Two new D1 tables: <code>directory</code> and <code>log</code>.</li>
  <li>Roughly 30 directory rows covering every current capability + Cloudflare account control.</li>
  <li>Six existing function files reduced to ~15-line dispatch stubs each.</li>
</ul>

<h2 id="forward">21. Forward rule — adding new capability</h2>
<p>Decision tree, in order:</p>
<ol>
  <li>Composition of existing rows? → one <code>flow</code> row.</li>
  <li>New external HTTP call? → one <code>http</code> row (or 2-3 for the same credential context with different methods).</li>
  <li>New LLM with its own system prompt? → one <code>agent</code> row.</li>
  <li>Pure local computation that no composition expresses? → one <code>fn</code> row plus one entry in <code>FN_MAP</code>. Only this step touches code.</li>
</ol>
<p>If none fits, refuse. State the blocking constraint in one sentence.</p>

<h3>21.1 Forbidden moves</h3>
<ul>
  <li>A new file under <code>functions/</code> other than the kernel itself and Cloudflare route-shims (<code>[slug].js</code>, <code>api/[[catchall]].js</code>).</li>
  <li>A new D1 table other than <code>directory</code> and <code>log</code>. The existing tables (<code>settings</code>, <code>pages</code>, etc.) stay because data has to live somewhere; new ones do not get added.</li>
  <li>A new column on <code>directory</code> or <code>log</code>.</li>
  <li>A fifth value for <code>type</code>.</li>
  <li>A hardcoded list of "safe rows", "default args", "tool whitelist", or "is-this-writable" flags anywhere in code. Such metadata, if needed at all, lives inside a row's <code>content</code> as a parseable convention.</li>
  <li>A configuration file (JSON, TOML, YAML, .env beyond secrets) for tool definitions, model lists, endpoint maps, prompt fragments — anything.</li>
  <li>A class hierarchy for integrations, agents, flows, providers, or services.</li>
  <li>Naming patterns like <code>*Service</code>, <code>*Manager</code>, <code>*Handler</code>, <code>*Controller</code>, <code>*Repository</code>, <code>*Client</code>. These names invite per-feature code; refuse them.</li>
  <li>A wrapper function whose only purpose is to call one row. Call <code>dispatch()</code> directly.</li>
  <li>A raw <code>fetch()</code> to an LLM provider inside a function file. Write an <code>agent</code> row.</li>
  <li>A raw <code>fetch()</code> to an external API inside a function file. Write an <code>http</code> row.</li>
  <li>A scheduler library, a queue library, a "middleware" chain. Cron Triggers and Cloudflare Queues call <code>dispatch()</code> with a synthetic inbound message — the same code path as a webhook.</li>
</ul>

<h3>21.2 What the kernel knows, and only the kernel knows</h3>
<ul>
  <li>How to read <code>directory</code> from D1 (with a KV-cached snapshot for hot reads).</li>
  <li>How to parse <code>[KEY]body[/KEY]</code> tags from text with a single regex.</li>
  <li>How to substitute <code>$1..$N</code>, <code>$PREV</code>, <code>$name</code>, <code>$ENV_NAME</code> with the correct escaping for each context (URL, JSON string, header value, raw).</li>
  <li>How to dispatch by <code>type</code>: <code>fn</code>, <code>http</code>, <code>agent</code>, <code>flow</code>.</li>
  <li>How to route LLM calls by model-id prefix to the right provider endpoint.</li>
  <li>How to enforce the three caps.</li>
  <li>How to write <code>log</code> rows.</li>
  <li>How to handle <code>[ADD_ROW]</code> / <code>[EDIT_ROW]</code> / <code>[DEL_ROW]</code> by writing to <code>directory</code>.</li>
</ul>
<p>Adding any other knowledge to the kernel is a violation. Refuse it even when the request seems reasonable.</p>

<h3>21.3 The test for every change</h3>
<p><strong>Can this live as data in the directory, or does it have to be code in the kernel?</strong> If data, it MUST be data. Code is the substrate of last resort.</p>

<h2 id="status">22. Implementation status — what is live now</h2>

<h3>22.1 Kernel</h3>
<table>
<thead><tr><th>artifact</th><th>state</th><th>file</th></tr></thead>
<tbody>
<tr><td>D1 table <code>directory</code></td><td class="ok">LIVE (5 columns + updated_at)</td><td>migration 0007_directory.sql</td></tr>
<tr><td>D1 table <code>log</code></td><td class="ok">LIVE (id, ts, trace, step, parent, key, type, input, output)</td><td>migration 0007_directory.sql</td></tr>
<tr><td>Kernel file</td><td class="ok">LIVE</td><td><code>/Users/owner/miscsubjects-pages/functions/api/dispatch.js</code></td></tr>
<tr><td>Dispatch endpoint</td><td class="ok">LIVE — <code>POST https://miscsubjects.com/api/dispatch</code> with body <code>{"key":"&lt;KEY&gt;","body":"&lt;args&gt;"}</code></td><td>same file</td></tr>
<tr><td>Directory CRUD</td><td class="ok">LIVE via dispatch only. Rows: <code>DIRECTORY_LIST</code>, <code>DIRECTORY_GET</code>, <code>ADD_ROW</code>, <code>EDIT_ROW</code>, <code>DEL_ROW</code>. No bespoke REST endpoint — call <code>POST /api/dispatch</code>.</td><td>—</td></tr>
<tr><td>Directory snapshot cache</td><td class="ok">LIVE in KV key <code>directory:snapshot</code>, 30-second TTL, auto-invalidated on directory writes</td><td>in kernel</td></tr>
<tr><td>Log writer</td><td class="ok">LIVE — every dispatch writes one row to <code>log</code></td><td>in kernel</td></tr>
<tr><td>Caps</td><td class="ok">LIVE — <code>DEPTH_CAP=3</code>, <code>ITER_CAP=8</code>, <code>COST_CAP_USD=1.00</code></td><td>in kernel</td></tr>
</tbody>
</table>

<h3>22.2 Dispatch types — which work</h3>
<table>
<thead><tr><th>type</th><th>state</th><th>notes</th></tr></thead>
<tbody>
<tr><td><code>fn</code></td><td class="ok">LIVE</td><td>All entries in <code>FN_MAP</code> callable. Add new ones by editing <code>functions/api/dispatch.js</code>.</td></tr>
<tr><td><code>http</code></td><td class="ok">LIVE</td><td>All four AUTH prefixes implemented: <code>bearer:</code>, <code>headers:</code>, <code>query:</code>, <code>oauth:</code> (no-op on Cloudflare), empty.</td></tr>
<tr><td><code>agent</code></td><td class="ok">LIVE</td><td>Providers: <code>grok</code>* (xAI), <code>claude</code>* (Anthropic), <code>gemini</code>* (Google AI), <code>@cf/</code>* (Workers AI binding), else OpenAI. Tag parsing + <code>[DONE]</code> stop + <code>[SELF]</code> iteration + tools-without-marker fallback.</td></tr>
<tr><td><code>flow</code></td><td>PARTIAL</td><td>Sequence (<code>&gt;</code>), bindings (<code>=&gt; name</code>), conditional (<code>?:cond &gt; a | b</code>), and auto-short-circuit on <code>ERR:</code> all work. Parallel (<code>+</code>) and rollback (<code>!:</code>) NOT yet.</td></tr>
</tbody>
</table>

<h2 id="gas-map">23. Google Apps Script → Cloudflare primitive map</h2>
<p>Each Apps Script primitive used by the original Sheets-backed kernel and its Cloudflare equivalent (binding or REST endpoint), with the row that wraps it.</p>

<h3>23.1 Storage and tabular data</h3>
<table>
<thead><tr><th>Apps Script</th><th>Cloudflare equivalent</th><th>Row(s)</th></tr></thead>
<tbody>
<tr><td><code>SpreadsheetApp.getActiveSpreadsheet().getSheetByName('DIRECTORY').getRange('A:E').getValues()</code></td><td>D1 query against <code>directory</code> table.</td><td><code>DIRECTORY_LIST</code> or raw <code>D1_QUERY: SELECT * FROM directory</code></td></tr>
<tr><td><code>sheet.appendRow([k,t,target,auth,content])</code></td><td>D1 INSERT.</td><td><code>ADD_ROW</code> dispatch, or raw <code>D1_EXEC: INSERT INTO directory ...</code></td></tr>
<tr><td><code>sheet.getRange(row, col).setValue(v)</code></td><td>D1 UPDATE on specific row.</td><td><code>D1_EXEC: UPDATE directory SET content=? WHERE key=?</code></td></tr>
<tr><td><code>sheet.getRange(row, 1).clearContent()</code></td><td>D1 DELETE.</td><td><code>D1_EXEC: DELETE FROM directory WHERE key=?</code></td></tr>
<tr><td>Sheet revision history (Drive)</td><td>No automatic equivalent. Pattern from <code>pages_versions</code>: parallel <code>directory_versions</code> table written on every PUT. Not yet implemented.</td><td>—</td></tr>
</tbody>
</table>

<h3>23.2 Script Properties (secrets and config)</h3>
<table>
<thead><tr><th>Apps Script</th><th>Cloudflare equivalent</th><th>Where</th></tr></thead>
<tbody>
<tr><td><code>PropertiesService.getScriptProperties().getProperty('GROK_API_KEY')</code></td><td>Pages secret. <code>env.GROK_API_KEY</code> inside a Worker.</td><td>Set with <code>npx wrangler pages secret put GROK_API_KEY --project-name miscsubjects-pages</code></td></tr>
<tr><td>Hot-read configuration that changes more than secrets</td><td>D1 <code>settings</code> table + KV mirror for the four hot keys (see §2.2).</td><td><code>SETTINGS_GET</code>, <code>KV_GET</code></td></tr>
</tbody>
</table>

<h3>23.3 Drive files</h3>
<table>
<thead><tr><th>Apps Script</th><th>Cloudflare equivalent</th><th>Row(s)</th></tr></thead>
<tbody>
<tr><td><code>DriveApp.createFile(name, content, mime)</code></td><td>R2 object. <code>env.R2.put(key, body, {httpMetadata:{contentType}})</code>.</td><td><code>R2_PUT</code> (not yet seeded; needs R2 binding)</td></tr>
<tr><td><code>DriveApp.getFileById(id).getBlob()</code></td><td><code>env.R2.get(key)</code>.</td><td><code>R2_GET</code></td></tr>
<tr><td><code>DriveApp.getFolderById(id).createFolder(name)</code></td><td>R2 has no folders. Use key prefixes: <code>articles/2026-06/post.md</code>. Listing by prefix replaces "folder contents".</td><td>—</td></tr>
<tr><td><code>Drive viewer URL <code>https://drive.google.com/file/d/&lt;id&gt;/view</code></td><td>R2 public URL via Worker route, or signed URL via S3-compatible endpoint.</td><td>Custom — typically one <code>R2_SIGN_URL</code> fn row.</td></tr>
</tbody>
</table>

<h3>23.4 Outbound HTTP</h3>
<table>
<thead><tr><th>Apps Script</th><th>Cloudflare equivalent</th><th>Row pattern</th></tr></thead>
<tbody>
<tr><td><code>UrlFetchApp.fetch(url, {method, headers, payload})</code></td><td><code>fetch(url, {method, headers, body})</code> inside a Worker.</td><td>One <code>http</code> row per endpoint. Existing: <code>BLOOIO_SEND</code>, <code>META_CAPI_POST</code>.</td></tr>
<tr><td>OAuth token via <code>ScriptApp.getOAuthToken()</code></td><td>Not the same paradigm. Cloudflare uses static secrets per provider. For Google APIs from Cloudflare you'd do OAuth2 client-credentials manually or use a service account JWT.</td><td>Use <code>bearer:</code> with a stored token, or a small <code>fn</code> that exchanges a refresh token.</td></tr>
</tbody>
</table>

<h3>23.5 Triggers and scheduling</h3>
<table>
<thead><tr><th>Apps Script</th><th>Cloudflare equivalent</th><th>Setup</th></tr></thead>
<tbody>
<tr><td><code>ScriptApp.newTrigger('myFn').timeBased().everyHours(1).create()</code></td><td>Cron Trigger declared in <code>wrangler.toml</code>. <code>[triggers] crons = ["0 * * * *"]</code>. Implement <code>scheduled(event, env, ctx)</code> in the Worker that calls <code>dispatch(env, 'HOURLY_TASK', '')</code>.</td><td>One line in wrangler.toml + one row in directory.</td></tr>
<tr><td><code>doPost(e)</code> handling form / webhook POSTs</td><td>Pages Function <code>functions/&lt;path&gt;.js</code> exporting <code>onRequestPost</code>. Examples here: <code>functions/blooio.js</code>, <code>functions/capi.js</code>.</td><td>Each becomes a thin shim that calls <code>dispatch</code>.</td></tr>
<tr><td>Manual menu item / sidebar</td><td>An admin page under <code>functions/admin/</code>. The dispatch endpoint is <code>POST /api/dispatch</code> — any browser form posting JSON can be a sidebar.</td><td>—</td></tr>
</tbody>
</table>

<h3>23.6 Logging</h3>
<table>
<thead><tr><th>Apps Script</th><th>Cloudflare equivalent</th><th>Row(s)</th></tr></thead>
<tbody>
<tr><td><code>Logger.log(s)</code> / <code>console.log(s)</code></td><td><code>console.log</code> inside a Worker is captured by <code>wrangler pages deployment tail --project-name miscsubjects-pages</code>.</td><td>—</td></tr>
<tr><td>Custom LOG sheet rows</td><td>D1 <code>log</code> table. Every dispatch writes one row automatically.</td><td><code>LOG_TAIL</code> reads recent.</td></tr>
</tbody>
</table>

<h3>23.7 Models running at edge</h3>
<table>
<thead><tr><th>Apps Script</th><th>Cloudflare equivalent</th></tr></thead>
<tbody>
<tr><td><code>UrlFetchApp.fetch('https://api.x.ai/v1/chat/completions', ...)</code> with API key in Script Properties.</td><td>Same call from inside a Worker via the <code>agent</code> row mechanism. The kernel routes by model-id prefix.</td></tr>
<tr><td>No native LLM in Apps Script</td><td>Workers AI binding <code>env.AI.run('@cf/meta/llama-3.1-8b-instruct', {messages})</code>. Map to an <code>agent</code> row with <code>target='@cf/meta/llama-3.1-8b-instruct'</code>. Auth column empty.</td></tr>
</tbody>
</table>

<h2 id="urls-all">24. Every URL on this site</h2>
<p>Legend: D = dynamic Pages Function. S = static file. KW = kernel-aware (uses <code>directory</code>/<code>log</code> tables).</p>

<table>
<thead><tr><th>path</th><th>method(s)</th><th>kind</th><th>what</th></tr></thead>
<tbody>
<tr><td><code>/</code></td><td>GET</td><td>S</td><td>Homepage. <code>public/index.html</code>. Cloaker JS.</td></tr>
<tr><td><code>/m</code></td><td>GET</td><td>D</td><td>Inside page. <code>functions/[slug].js</code> reads from D1 <code>pages</code>.</td></tr>
<tr><td><code>/privacy</code></td><td>GET</td><td>D</td><td>Privacy page. Same.</td></tr>
<tr><td><code>/success</code></td><td>GET</td><td>D</td><td>Thank-you page. Same.</td></tr>
<tr><td><code>/&lt;any-slug&gt;</code></td><td>GET</td><td>D</td><td>If row exists in <code>pages</code>, returns HTML. Else 404. Reserved (returns 404 no matter what): <code>api admin grok blooio architecture capi control spec edit article condition import-export import export</code>.</td></tr>
<tr><td><code>/api</code></td><td>GET</td><td>D</td><td>HTML docs page listing every API endpoint.</td></tr>
<tr><td><code>/api/dispatch</code></td><td>GET, POST, OPTIONS</td><td>D, KW</td><td>GET returns kernel info + directory listing. POST <code>{key, body}</code> runs one tag dispatch. <strong>This is the universal entry point.</strong></td></tr>
<tr><td><code>/api/pages</code></td><td>GET, POST, OPTIONS</td><td>D</td><td>List / create.</td></tr>
<tr><td><code>/api/pages/&lt;slug&gt;</code></td><td>GET, PUT, PATCH, DELETE, OPTIONS</td><td>D</td><td>Read/upsert/patch/delete. Append <code>?versions=1</code> for history.</td></tr>
<tr><td><code>/api/settings</code></td><td>GET, POST, OPTIONS</td><td>D</td><td>List / create.</td></tr>
<tr><td><code>/api/settings/&lt;key&gt;</code></td><td>GET, PUT, PATCH, DELETE, OPTIONS</td><td>D</td><td>Read/upsert/patch/delete. PATCH merges JSON values.</td></tr>
<tr><td><code>/grok</code></td><td>GET, POST</td><td>D</td><td>UI for editing system_prompt + model + temperature + web_search. <code>?data=1</code> returns JSON.</td></tr>
<tr><td><code>/grok/audit</code></td><td>POST, OPTIONS</td><td>D</td><td>Bespoke audit endpoint. Same job as the seeded <code>GROK_AUDIT</code> row, but not yet routed through dispatch.</td></tr>
<tr><td><code>/blooio</code></td><td>GET, POST</td><td>D</td><td>Bespoke webhook receiver + log viewer.</td></tr>
<tr><td><code>/capi</code></td><td>GET, POST</td><td>D</td><td>Meta CAPI server-side mirror.</td></tr>
<tr><td><code>/architecture</code></td><td>GET</td><td>D</td><td>Original spec page.</td></tr>
<tr><td><code>/admin</code></td><td>GET</td><td>D</td><td>Admin dashboard with cards for each table.</td></tr>
<tr><td><code>/admin/manual</code></td><td>GET</td><td>D</td><td>This page.</td></tr>
<tr><td><code>/admin/pages</code></td><td>GET</td><td>D</td><td>Inline editor for the <code>pages</code> table.</td></tr>
<tr><td><code>/admin/settings</code></td><td>GET</td><td>D, KW</td><td>Read-only view of <code>settings</code>.</td></tr>
<tr><td><code>/admin/blooio-logs</code></td><td>GET</td><td>D</td><td>Last 500 of <code>blooio_logs</code>.</td></tr>
<tr><td><code>/admin/blooio-dedup</code></td><td>GET</td><td>D</td><td>Last 500 of <code>blooio_dedup</code>.</td></tr>
<tr><td><code>/admin/grok-ledger</code></td><td>GET</td><td>D</td><td>Last 500 of <code>grok_ledger</code>.</td></tr>
<tr><td><code>/admin/pages-versions</code></td><td>GET</td><td>D</td><td>Last 500 of <code>pages_versions</code>.</td></tr>
<tr><td><code>/admin/directory</code></td><td>GET</td><td>D, KW</td><td>All <code>directory</code> rows.</td></tr>
<tr><td><code>/admin/log</code></td><td>GET</td><td>D, KW</td><td>Last 500 of <code>log</code>.</td></tr>
</tbody>
</table>

<p>Paths that are explicitly EXCLUDED from this Pages project (handled by another Worker, per <code>public/_routes.json</code>): <code>/control</code>, <code>/spec</code>, <code>/edit/*</code>, <code>/article/*</code>, <code>/condition/*</code>, <code>/import-export</code>, <code>/import</code>, <code>/export</code>.</p>

<h2 id="cf-rest">25. Cloudflare REST endpoints — row mappings</h2>
<p>Each operation becomes one <code>http</code> row in <code>directory</code>. Base URL: <code>https://api.cloudflare.com/client/v4</code>.</p>
<p>Prerequisite for every row below:</p>
<pre>npx wrangler pages secret put CF_API_TOKEN --project-name miscsubjects-pages
npx wrangler pages secret put CF_ACCOUNT_ID --project-name miscsubjects-pages</pre>
<p>Token scopes per Cloudflare dashboard: Workers Scripts (Edit), Workers KV (Edit), D1 (Edit), Pages (Edit), Workers R2 (Edit).</p>

<h3>25.1 D1 — direct REST (alternative to the binding)</h3>
<table>
<thead><tr><th>operation</th><th>URL</th><th>row name</th></tr></thead>
<tbody>
<tr><td>Run a SQL query</td><td><code>POST /accounts/$CF_ACCOUNT_ID/d1/database/$1/query</code></td><td><code>D1_REST_QUERY</code></td></tr>
<tr><td>List databases</td><td><code>GET /accounts/$CF_ACCOUNT_ID/d1/database</code></td><td><code>D1_REST_LIST</code></td></tr>
<tr><td>Create database</td><td><code>POST /accounts/$CF_ACCOUNT_ID/d1/database</code></td><td><code>D1_REST_CREATE</code></td></tr>
</tbody>
</table>
<p>Note: this project already has D1 bound as <code>env.DB</code>. The <code>D1_QUERY</code> / <code>D1_EXEC</code> fn rows use the binding (faster, no token needed). Only use REST rows for cross-account or unbound databases.</p>

<h3>25.2 KV</h3>
<table>
<thead><tr><th>operation</th><th>URL</th><th>row name</th></tr></thead>
<tbody>
<tr><td>Read value</td><td><code>GET /accounts/$CF_ACCOUNT_ID/storage/kv/namespaces/$1/values/$2</code></td><td><code>KV_REST_GET</code></td></tr>
<tr><td>Write value</td><td><code>PUT /accounts/$CF_ACCOUNT_ID/storage/kv/namespaces/$1/values/$2</code></td><td><code>KV_REST_PUT</code></td></tr>
<tr><td>Delete value</td><td><code>DELETE /accounts/$CF_ACCOUNT_ID/storage/kv/namespaces/$1/values/$2</code></td><td><code>KV_REST_DEL</code></td></tr>
<tr><td>List keys</td><td><code>GET /accounts/$CF_ACCOUNT_ID/storage/kv/namespaces/$1/keys</code></td><td><code>KV_REST_LIST_KEYS</code></td></tr>
<tr><td>List namespaces</td><td><code>GET /accounts/$CF_ACCOUNT_ID/storage/kv/namespaces</code></td><td><code>KV_REST_LIST_NS</code></td></tr>
</tbody>
</table>
<p>This project's KV namespace id: <code>58b303e666a8431685624e0cfd2fd63f</code>. As with D1, the <code>env.KV</code> binding rows (<code>KV_GET</code>/<code>KV_PUT</code>/<code>KV_DEL</code>) are faster than REST.</p>

<h3>25.3 R2</h3>
<table>
<thead><tr><th>operation</th><th>URL</th><th>row name</th></tr></thead>
<tbody>
<tr><td>Put object</td><td><code>PUT /accounts/$CF_ACCOUNT_ID/r2/buckets/$1/objects/$2</code></td><td><code>R2_REST_PUT</code></td></tr>
<tr><td>Get object</td><td><code>GET /accounts/$CF_ACCOUNT_ID/r2/buckets/$1/objects/$2</code></td><td><code>R2_REST_GET</code></td></tr>
<tr><td>Delete object</td><td><code>DELETE /accounts/$CF_ACCOUNT_ID/r2/buckets/$1/objects/$2</code></td><td><code>R2_REST_DEL</code></td></tr>
<tr><td>List buckets</td><td><code>GET /accounts/$CF_ACCOUNT_ID/r2/buckets</code></td><td><code>R2_REST_LIST_BUCKETS</code></td></tr>
<tr><td>List objects in bucket</td><td><code>GET /accounts/$CF_ACCOUNT_ID/r2/buckets/$1/objects</code></td><td><code>R2_REST_LIST_OBJECTS</code></td></tr>
</tbody>
</table>
<p>R2 is not currently bound to this Worker. Either bind it (see §22.5) for the fast path, or use REST.</p>

<h3>25.4 Worker scripts</h3>
<table>
<thead><tr><th>operation</th><th>URL</th><th>row name</th></tr></thead>
<tbody>
<tr><td>Upload / replace a Worker script</td><td><code>PUT /accounts/$CF_ACCOUNT_ID/workers/scripts/$1</code></td><td><code>EDIT_WORKER</code></td></tr>
<tr><td>Get Worker script source</td><td><code>GET /accounts/$CF_ACCOUNT_ID/workers/scripts/$1</code></td><td><code>GET_WORKER</code></td></tr>
<tr><td>Delete Worker script</td><td><code>DELETE /accounts/$CF_ACCOUNT_ID/workers/scripts/$1</code></td><td><code>DEL_WORKER</code></td></tr>
<tr><td>List Worker scripts</td><td><code>GET /accounts/$CF_ACCOUNT_ID/workers/scripts</code></td><td><code>LIST_WORKERS</code></td></tr>
<tr><td>Get Worker tail (real-time log)</td><td><code>POST /accounts/$CF_ACCOUNT_ID/workers/scripts/$1/tails</code></td><td><code>TAIL_WORKER</code></td></tr>
</tbody>
</table>
<p>This is the row that makes the kernel editable from inside itself. Emit <code>[EDIT_WORKER]miscsubjects-pages|&lt;new TS source&gt;[/EDIT_WORKER]</code> from any agent to replace this Worker.</p>

<h3>25.5 Pages projects</h3>
<table>
<thead><tr><th>operation</th><th>URL</th><th>row name</th></tr></thead>
<tbody>
<tr><td>List Pages projects</td><td><code>GET /accounts/$CF_ACCOUNT_ID/pages/projects</code></td><td><code>PAGES_PROJECTS_LIST</code></td></tr>
<tr><td>Get project</td><td><code>GET /accounts/$CF_ACCOUNT_ID/pages/projects/$1</code></td><td><code>PAGES_PROJECT_GET</code></td></tr>
<tr><td>List deployments</td><td><code>GET /accounts/$CF_ACCOUNT_ID/pages/projects/$1/deployments</code></td><td><code>PAGES_DEPLOYMENTS_LIST</code></td></tr>
<tr><td>Create deployment (re-deploys current commit)</td><td><code>POST /accounts/$CF_ACCOUNT_ID/pages/projects/$1/deployments</code></td><td><code>DEPLOY_PAGE</code></td></tr>
<tr><td>Roll back to a deployment</td><td><code>POST /accounts/$CF_ACCOUNT_ID/pages/projects/$1/deployments/$2/rollback</code></td><td><code>PAGES_ROLLBACK</code></td></tr>
<tr><td>Update env vars / config</td><td><code>PATCH /accounts/$CF_ACCOUNT_ID/pages/projects/$1</code></td><td><code>PAGES_PROJECT_PATCH</code></td></tr>
</tbody>
</table>

<h3>25.6 Workers Cron Triggers</h3>
<table>
<thead><tr><th>operation</th><th>URL</th><th>row name</th></tr></thead>
<tbody>
<tr><td>List cron triggers on a script</td><td><code>GET /accounts/$CF_ACCOUNT_ID/workers/scripts/$1/schedules</code></td><td><code>CRON_LIST</code></td></tr>
<tr><td>Update cron triggers</td><td><code>PUT /accounts/$CF_ACCOUNT_ID/workers/scripts/$1/schedules</code></td><td><code>CRON_SET</code></td></tr>
</tbody>
</table>

<h3>25.7 DNS / custom hostnames</h3>
<table>
<thead><tr><th>operation</th><th>URL</th><th>row name</th></tr></thead>
<tbody>
<tr><td>List zones</td><td><code>GET /zones</code></td><td><code>DNS_ZONES_LIST</code></td></tr>
<tr><td>List DNS records on a zone</td><td><code>GET /zones/$1/dns_records</code></td><td><code>DNS_LIST</code></td></tr>
<tr><td>Create DNS record</td><td><code>POST /zones/$1/dns_records</code></td><td><code>DNS_CREATE</code></td></tr>
<tr><td>Add custom domain to a Pages project</td><td><code>POST /accounts/$CF_ACCOUNT_ID/pages/projects/$1/domains</code></td><td><code>PAGES_ADD_DOMAIN</code></td></tr>
</tbody>
</table>

<h3>25.8 Workers AI (model inference)</h3>
<table>
<thead><tr><th>operation</th><th>URL</th><th>row name</th></tr></thead>
<tbody>
<tr><td>Run a model</td><td><code>POST /accounts/$CF_ACCOUNT_ID/ai/run/$1</code> (where <code>$1</code> = model id like <code>@cf/meta/llama-3.1-8b-instruct</code>)</td><td>Use an <code>agent</code> row with <code>target='@cf/...'</code>. The kernel uses the <code>env.AI</code> binding, not REST.</td></tr>
</tbody>
</table>

<h3>25.9 Seeding the rows</h3>
<p>Once <code>CF_API_TOKEN</code> and <code>CF_ACCOUNT_ID</code> are set, dispatch <code>ADD_ROW</code> for each:</p>
<pre>curl -X POST https://miscsubjects.com/api/dispatch \\
  -H 'Content-Type: application/json' \\
  -d '{"key":"ADD_ROW","body":"EDIT_WORKER|http|PUT https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/workers/scripts/$1|bearer:CF_API_TOKEN|$2"}'</pre>
<p>One dispatch per row. No migration, no deploy.</p>

<h2 id="how-to-call">26. How to call any row — recipes and flow DSL</h2>

<h3>26.1 The single entry point</h3>
<pre>POST https://miscsubjects.com/api/dispatch
Content-Type: application/json

{"key":"&lt;KEY&gt;","body":"&lt;arg string, $1|$2|... split on |&gt;"}</pre>
<p>Returns:</p>
<pre>{"trace":"t_xxx","result":"&lt;output&gt;","cost":&lt;USD cost of LLM calls in this trace&gt;}</pre>
<p>The <code>result</code> field is whatever the row returned. For <code>fn</code> rows, the stringified function return value. For <code>http</code> rows, <code>"HTTP &lt;code&gt;:&lt;body&gt;"</code>. For <code>agent</code> rows, the LLM's response text (after tag dispatching). For <code>flow</code> rows, the last step's output.</p>

<h3>26.2 fn — local function call</h3>
<pre>curl -X POST https://miscsubjects.com/api/dispatch \\
  -H 'Content-Type: application/json' \\
  -d '{"key":"SHA256_LOWER","body":"the owner@<operator-domain>"}'</pre>
<pre>{"trace":"t_xxx","result":"eb1f08c6...","cost":0}</pre>

<pre>curl -X POST https://miscsubjects.com/api/dispatch \\
  -H 'Content-Type: application/json' \\
  -d '{"key":"D1_QUERY","body":"SELECT count(*) AS n FROM pages"}'</pre>
<pre>{"trace":"t_xxx","result":"[{\\"n\\":3}]","cost":0}</pre>

<h3>26.3 http — outbound REST</h3>
<p>Calling <code>BLOOIO_SEND</code> (which actually sends an iMessage):</p>
<pre>curl -X POST https://miscsubjects.com/api/dispatch \\
  -H 'Content-Type: application/json' \\
  -d '{"key":"BLOOIO_SEND","body":"[OWNER_PHONE]|hi"}'</pre>
<p><code>$1</code> = <code>[OWNER_PHONE]</code>, <code>$2</code> = <code>hi</code>. URL becomes <code>POST https://backend.blooio.com/v2/api/chats/%2B[OWNER_PHONE]/messages</code>. Body becomes <code>{"text":"hi"}</code>. Auth: <code>Authorization: Bearer &lt;env.BLOOIO_API_KEY&gt;</code>.</p>

<h3>26.4 agent — LLM call</h3>
<pre>curl -X POST https://miscsubjects.com/api/dispatch \\
  -H 'Content-Type: application/json' \\
  -d '{"key":"XAI_CHAT","body":"What is 2+2? Reply with exactly: 4 then [DONE]done[/DONE]"}'</pre>
<p>The kernel POSTs to <code>https://api.x.ai/v1/chat/completions</code> with model <code>grok-build-0.1</code>, system prompt from the row's CONTENT, user message from <code>body</code>. Parses the response for tags. <code>[DONE]</code> stops iteration; otherwise the kernel runs up to <code>ITER_CAP</code> iterations folding tool results back.</p>

<h3>26.5 flow — composition</h3>
<p>Call <code>PAGES_GET</code> with one argument:</p>
<pre>curl -X POST https://miscsubjects.com/api/dispatch \\
  -H 'Content-Type: application/json' \\
  -d '{"key":"PAGES_GET","body":"privacy"}'</pre>
<p>The row's CONTENT is <code>D1_QUERY: SELECT slug, title, body_html, version, updated_at FROM pages WHERE slug='$1'</code>. The flow engine substitutes <code>$1 = privacy</code> → dispatches <code>D1_QUERY</code> with body <code>SELECT ... WHERE slug='privacy'</code>. <code>D1_QUERY</code> returns the JSON-serialized result. That becomes the flow's output.</p>

<h3>26.6 flow DSL — currently supported</h3>
<table>
<thead><tr><th>operator</th><th>meaning</th><th>state</th></tr></thead>
<tbody>
<tr><td><code>&gt;</code></td><td>Sequence. <code>A:x &gt; B:y</code> runs A, then B. <code>$PREV</code> in B is A's output.</td><td class="ok">LIVE</td></tr>
<tr><td><code>=&gt; name</code></td><td>Bind. <code>A:x =&gt; foo &gt; B:$foo</code> stores A's output as <code>$foo</code> and uses it in B.</td><td class="ok">LIVE</td></tr>
<tr><td><code>+</code></td><td>Parallel. <code>A:x + B:y</code> dispatches both concurrently, joins outputs with <code> | </code>.</td><td>NOT YET</td></tr>
<tr><td><code>?:cond &gt; a | b</code></td><td>Conditional. If <code>$PREV</code> starts with <code>ERR:</code>, run <code>b</code>; else <code>a</code>.</td><td>NOT YET</td></tr>
<tr><td><code>!:</code></td><td>Rollback steps (after a <code>!:</code> separator). Run only if a forward step errors.</td><td>NOT YET</td></tr>
</tbody>
</table>

<h3>26.7 Self-modification from inside an agent</h3>
<p>Add a row from an agent response:</p>
<pre>[ADD_ROW]MY_NEW_KEY|http|GET https://example.com/$1|bearer:EXAMPLE_TOKEN|[/ADD_ROW]
[DONE]added MY_NEW_KEY[/DONE]</pre>
<p>The kernel writes to <code>directory</code>, invalidates the KV snapshot, and the next request can dispatch <code>MY_NEW_KEY</code>.</p>
<p>Edit:</p>
<pre>[EDIT_ROW]ROUTER|agent|grok-build-0.1|bearer:GROK_API_KEY|&lt;new system prompt&gt;[/EDIT_ROW]</pre>
<p>Delete:</p>
<pre>[DEL_ROW]MY_NEW_KEY[/DEL_ROW]</pre>

<h3>26.8 Direct REST equivalents</h3>
<p>If you want to bypass <code>/api/dispatch</code> and write directly to D1 from a terminal:</p>
<pre>npx wrangler d1 execute miscsubjects-content --remote --command \\
  "SELECT key, type, target FROM directory ORDER BY key;"</pre>

<p>Or to insert a row via dispatch (no bespoke endpoint exists):</p>
<pre>curl -X POST https://miscsubjects.com/api/dispatch \\
  -H 'Content-Type: application/json' \\
  -d '{"key":"ADD_ROW","body":"MY_KEY|fn|upper||[\\"$1\\"]"}'</pre>
<p>Same shape for <code>EDIT_ROW</code> and <code>DEL_ROW</code>. These ARE rows themselves (fn rows pointing at <code>addRow</code>/<code>editRow</code>/<code>delRow</code> in <code>FN_MAP</code>) — the kernel does not special-case them.</p>

<h3>26.9 Test that everything still works</h3>
<pre>echo "=== fn ===";       curl -s -X POST https://miscsubjects.com/api/dispatch -H 'Content-Type: application/json' -d '{"key":"NOW"}'
echo "=== flow ===";     curl -s -X POST https://miscsubjects.com/api/dispatch -H 'Content-Type: application/json' -d '{"key":"DIRECTORY_LIST"}'
echo "=== bad key ===";  curl -s -X POST https://miscsubjects.com/api/dispatch -H 'Content-Type: application/json' -d '{"key":"NOPE"}'</pre>
<p>Expected: NOW returns an ISO timestamp; DIRECTORY_LIST returns a JSON array of row metadata; bad key returns <code>"result":"ERR:dispatch:unknown_key:NOPE"</code>.</p>

<h2 id="inventory">27. Total inventory</h2>

<h3>27.1 Every row currently in <code>directory</code> (29 total: 13 fn / 2 http / 3 agent / 11 flow)</h3>
<table>
<thead><tr><th>KEY</th><th>type</th><th>does</th><th>call shape</th><th>status</th></tr></thead>
<tbody>
<tr><td><code>NOW</code></td><td>fn</td><td>ISO timestamp.</td><td><code>{"key":"NOW"}</code></td><td class="ok">tested</td></tr>
<tr><td><code>UPPER</code></td><td>fn</td><td>Uppercase a string.</td><td><code>{"key":"UPPER","body":"hello"}</code> → <code>HELLO</code></td><td class="ok">tested</td></tr>
<tr><td><code>LOWER</code></td><td>fn</td><td>Lowercase a string.</td><td><code>{"key":"LOWER","body":"HELLO"}</code></td><td class="ok">tested</td></tr>
<tr><td><code>SHA256_LOWER</code></td><td>fn</td><td>SHA-256 hex of lower+trim(input).</td><td><code>{"key":"SHA256_LOWER","body":"the owner@<operator-domain>"}</code></td><td class="ok">tested</td></tr>
<tr><td><code>D1_QUERY</code></td><td>fn</td><td>SELECT on D1 binding. Returns JSON-array string.</td><td><code>{"key":"D1_QUERY","body":"SELECT count(*) AS n FROM pages"}</code></td><td class="ok">tested</td></tr>
<tr><td><code>D1_EXEC</code></td><td>fn</td><td>INSERT/UPDATE/DELETE on D1. Returns <code>{changes,last_row_id}</code>.</td><td><code>{"key":"D1_EXEC","body":"UPDATE settings SET ..."}</code></td><td class="ok">tested</td></tr>
<tr><td><code>KV_GET</code></td><td>fn</td><td>Read KV key. Empty string if absent.</td><td><code>{"key":"KV_GET","body":"system_prompt"}</code></td><td class="ok">tested</td></tr>
<tr><td><code>KV_PUT</code></td><td>fn</td><td>Write KV key.</td><td><code>{"key":"KV_PUT","body":"key|value"}</code></td><td class="ok">tested</td></tr>
<tr><td><code>KV_DEL</code></td><td>fn</td><td>Delete KV key.</td><td><code>{"key":"KV_DEL","body":"key"}</code></td><td class="ok">tested</td></tr>
<tr><td><code>DEDUP_INSERT</code></td><td>fn</td><td>INSERT OR IGNORE into <code>blooio_dedup</code>. Returns <code>OK</code> or <code>ERR:dup</code>.</td><td><code>{"key":"DEDUP_INSERT","body":"msg-id"}</code></td><td class="ok">tested</td></tr>
<tr><td><code>ADD_ROW</code></td><td>fn</td><td>Insert a new directory row. KV snapshot invalidated.</td><td><code>{"key":"ADD_ROW","body":"K|type|target|auth|content"}</code></td><td class="ok">tested</td></tr>
<tr><td><code>EDIT_ROW</code></td><td>fn</td><td>Upsert a directory row.</td><td><code>{"key":"EDIT_ROW","body":"K|type|target|auth|content"}</code></td><td class="ok">tested</td></tr>
<tr><td><code>DEL_ROW</code></td><td>fn</td><td>Delete a directory row.</td><td><code>{"key":"DEL_ROW","body":"K"}</code></td><td class="ok">tested</td></tr>
<tr><td><code>BLOOIO_SEND</code></td><td>http</td><td>POST a Blooio reply. <code>$1</code> = chat_id, <code>$2</code> = text.</td><td><code>{"key":"BLOOIO_SEND","body":"[OWNER_PHONE]|hi"}</code></td><td class="warn">untested live (would send a real iMessage)</td></tr>
<tr><td><code>META_CAPI_POST</code></td><td>http</td><td>POST to Meta Conversions API.</td><td>positional: event_name<code>|</code>event_time<code>|</code>event_id<code>|</code>source_url<code>|</code>client_ip<code>|</code>user_agent</td><td class="warn">untested live (would fire a real Pixel event)</td></tr>
<tr><td><code>XAI_CHAT</code></td><td>agent</td><td>xAI chat, model <code>grok-build-0.1</code>.</td><td><code>{"key":"XAI_CHAT","body":"&lt;user message&gt;"}</code></td><td class="ok">tested</td></tr>
<tr><td><code>GROK_AUDIT</code></td><td>agent</td><td>xAI strict-JSON verdict gate.</td><td><code>{"key":"GROK_AUDIT","body":"&lt;serialized current vs proposed&gt;"}</code></td><td class="ok">tested via /grok/audit</td></tr>
<tr><td><code>ROUTER</code></td><td>agent</td><td>xAI router.</td><td><code>{"key":"ROUTER","body":"&lt;user message&gt;"}</code></td><td class="ok">tested; [SELF] iteration verified (trace t_ebi9lark)</td></tr>
<tr><td><code>DIRECTORY_LIST</code></td><td>flow</td><td>List all directory rows.</td><td><code>{"key":"DIRECTORY_LIST"}</code></td><td class="ok">tested</td></tr>
<tr><td><code>DIRECTORY_GET</code></td><td>flow</td><td>One row by KEY.</td><td><code>{"key":"DIRECTORY_GET","body":"PAGES_GET"}</code></td><td class="ok">tested</td></tr>
<tr><td><code>PAGES_LIST</code></td><td>flow</td><td>All pages.</td><td><code>{"key":"PAGES_LIST"}</code></td><td class="ok">tested</td></tr>
<tr><td><code>PAGES_GET</code></td><td>flow</td><td>One page by slug.</td><td><code>{"key":"PAGES_GET","body":"privacy"}</code></td><td class="ok">tested</td></tr>
<tr><td><code>PAGES_VERSIONS</code></td><td>flow</td><td>Version history for a slug.</td><td><code>{"key":"PAGES_VERSIONS","body":"privacy"}</code></td><td class="ok">tested</td></tr>
<tr><td><code>SETTINGS_LIST</code></td><td>flow</td><td>All settings.</td><td><code>{"key":"SETTINGS_LIST"}</code></td><td class="ok">tested</td></tr>
<tr><td><code>SETTINGS_GET</code></td><td>flow</td><td>One setting by key.</td><td><code>{"key":"SETTINGS_GET","body":"system_prompt"}</code></td><td class="ok">tested</td></tr>
<tr><td><code>GROK_LEDGER_TAIL</code></td><td>flow</td><td>Last 20 LLM ledger rows.</td><td><code>{"key":"GROK_LEDGER_TAIL"}</code></td><td class="ok">tested</td></tr>
<tr><td><code>BLOOIO_LOGS_TAIL</code></td><td>flow</td><td>Last 20 iMessage log rows.</td><td><code>{"key":"BLOOIO_LOGS_TAIL"}</code></td><td class="ok">tested</td></tr>
<tr><td><code>LOG_TAIL</code></td><td>flow</td><td>Last 50 dispatch log rows.</td><td><code>{"key":"LOG_TAIL"}</code></td><td class="ok">tested</td></tr>
<tr><td><code>SERVE_PAGE</code></td><td>flow</td><td>D1_QUERY for one page's body_html. Powers <code>/&lt;slug&gt;</code>.</td><td><code>{"key":"SERVE_PAGE","body":"privacy"}</code></td><td class="ok">live in production path</td></tr>
</tbody>
</table>

<h3>27.2 Triggers — how things reach the kernel</h3>
<table>
<thead><tr><th>trigger</th><th>state</th><th>path into kernel</th></tr></thead>
<tbody>
<tr><td><code>POST /api/dispatch</code></td><td class="ok">LIVE</td><td>Universal entry. Body <code>{key, body}</code>.</td></tr>
<tr><td>Public page <code>GET /&lt;slug&gt;</code></td><td class="ok">LIVE</td><td><code>functions/[slug].js</code> calls <code>dispatch(env, 'SERVE_PAGE', slug)</code>.</td></tr>
<tr><td>Blooio webhook <code>POST /blooio</code></td><td>BESPOKE</td><td>To cut over: seed <code>BLOOIO_INBOUND</code> flow, replace handler body with one <code>dispatch</code> call.</td></tr>
<tr><td><code>POST /grok/audit</code></td><td>BESPOKE</td><td>To cut over: replace body with <code>dispatch(env, 'GROK_AUDIT', ...)</code>. <code>GROK_AUDIT</code> row already exists.</td></tr>
<tr><td><code>POST /capi</code></td><td>BESPOKE</td><td>To cut over: seed <code>META_CAPI_EVENT</code> flow, replace body with one dispatch.</td></tr>
<tr><td>Cron Triggers</td><td>NOT configured</td><td><code>[triggers] crons = ["0 7 * * *"]</code> in <code>wrangler.toml</code> + scheduled handler calling dispatch.</td></tr>
<tr><td>Queues</td><td>NOT configured</td><td>Bind queue; consumer calls dispatch per message.</td></tr>
<tr><td>Email Routing → Email Workers</td><td>NOT configured</td><td>Email Worker handler calls <code>dispatch(env, 'EMAIL_INBOUND', body)</code>.</td></tr>
<tr><td>CLI tunnel</td><td>NOT configured</td><td>Cloudflared tunnel to local exec endpoint; seed <code>CLI_EXEC</code> http row.</td></tr>
</tbody>
</table>

<h3>27.3 View map — where to see each kind of data</h3>
<table>
<thead><tr><th>what</th><th>browser URL</th><th>via dispatch</th></tr></thead>
<tbody>
<tr><td>The directory</td><td><a href="https://miscsubjects.com/admin/directory">/admin/directory</a></td><td><code>DIRECTORY_LIST</code> / <code>DIRECTORY_GET</code></td></tr>
<tr><td>Dispatch audit log</td><td><a href="https://miscsubjects.com/admin/log">/admin/log</a></td><td><code>LOG_TAIL</code></td></tr>
<tr><td>Settings</td><td><a href="https://miscsubjects.com/admin/settings">/admin/settings</a></td><td><code>SETTINGS_LIST</code> / <code>SETTINGS_GET</code></td></tr>
<tr><td>iMessage logs</td><td><a href="https://miscsubjects.com/admin/blooio-logs">/admin/blooio-logs</a></td><td><code>BLOOIO_LOGS_TAIL</code></td></tr>
<tr><td>iMessage dedup</td><td><a href="https://miscsubjects.com/admin/blooio-dedup">/admin/blooio-dedup</a></td><td><code>D1_QUERY: SELECT * FROM blooio_dedup ORDER BY rowid DESC LIMIT 100</code></td></tr>
<tr><td>LLM ledger</td><td><a href="https://miscsubjects.com/admin/grok-ledger">/admin/grok-ledger</a></td><td><code>GROK_LEDGER_TAIL</code></td></tr>
<tr><td>Pages list</td><td><a href="https://miscsubjects.com/admin/pages">/admin/pages</a></td><td><code>PAGES_LIST</code></td></tr>
<tr><td>One page</td><td><code>/&lt;slug&gt;</code> rendered, or <code>/admin/pages?slug=&lt;slug&gt;</code> to edit</td><td><code>PAGES_GET</code></td></tr>
<tr><td>Page version history</td><td><a href="https://miscsubjects.com/admin/pages-versions">/admin/pages-versions</a></td><td><code>PAGES_VERSIONS</code></td></tr>
<tr><td>Grok prompt + model + temp + web-search</td><td><a href="https://miscsubjects.com/grok">/grok</a></td><td><code>SETTINGS_GET</code></td></tr>
<tr><td>This manual</td><td><a href="https://miscsubjects.com/admin/manual">/admin/manual</a></td><td>—</td></tr>
</tbody>
</table>

<h3>27.4 What to add next — rows + the prerequisite to make each live</h3>
<table>
<thead><tr><th>row</th><th>type</th><th>prerequisite</th><th>enables</th></tr></thead>
<tbody>
<tr><td><code>CLAUDE_CHAT</code></td><td>agent</td><td><code>npx wrangler pages secret put ANTHROPIC_API_KEY --project-name miscsubjects-pages</code></td><td>Anthropic Claude callable; target <code>claude-haiku-4-5-20251001</code> or <code>claude-opus-4-7</code>.</td></tr>
<tr><td><code>GEMINI_CHAT</code></td><td>agent</td><td><code>npx wrangler pages secret put GEMINI_API_KEY --project-name miscsubjects-pages</code></td><td>Gemini callable; target <code>gemini-2.5-pro</code> or <code>gemini-2.5-flash</code>.</td></tr>
<tr><td><code>CF_LLAMA</code> (or any <code>@cf/...</code>)</td><td>agent</td><td>None — AI binding live, verified.</td><td>Workers AI at edge, no API key.</td></tr>
<tr><td><code>EDIT_WORKER</code>, <code>DEPLOY_PAGE</code>, REST KV/R2/D1 rows, <code>CRON_SET</code>, <code>DNS_*</code> (§25)</td><td>http</td><td><code>CF_API_TOKEN</code> + <code>CF_ACCOUNT_ID</code> secrets.</td><td>Cloudflare account control as rows. Agents can replace the Worker, deploy, write KV/R2, etc.</td></tr>
<tr><td><code>R2_PUT</code> / <code>R2_GET</code> / <code>R2_DEL</code></td><td>fn</td><td><code>[[r2_buckets]] binding = "R2" bucket_name = "..."</code> in <code>wrangler.toml</code> + <code>r2*</code> entries in <code>FN_MAP</code>.</td><td>Object store for files / images / backups.</td></tr>
<tr><td><code>CLI_EXEC</code></td><td>http</td><td>Cloudflared tunnel + <code>CLI_TOKEN</code> secret.</td><td>Any agent runs shell on the tunneled host.</td></tr>
<tr><td><code>BLOOIO_LOG_IN</code>, <code>BLOOIO_LOG_OUT</code>, <code>BLOOIO_INBOUND</code></td><td>flow</td><td>None.</td><td>Once these exist, <code>functions/blooio.js</code> collapses to a 15-line dispatch shim.</td></tr>
<tr><td><code>META_CAPI_EVENT</code></td><td>flow</td><td>None.</td><td><code>functions/capi.js</code> collapses similarly.</td></tr>
<tr><td><code>DAILY_MORNING</code></td><td>flow</td><td>Cron Trigger + scheduled handler.</td><td>Daily-7am task. Calendar + KPIs + iMessage in one row.</td></tr>
<tr><td><code>EMAIL_INBOUND</code></td><td>flow</td><td>Email Routing + Email Worker handler.</td><td>Email becomes a channel.</td></tr>
</tbody>
</table>

<h3>27.5 Use case map — what reaches what, end to end</h3>
<table>
<thead><tr><th>use case</th><th>trigger</th><th>row(s)</th><th>state</th></tr></thead>
<tbody>
<tr><td>Visitor loads <code>/privacy</code></td><td>GET</td><td><code>SERVE_PAGE</code> → <code>D1_QUERY</code></td><td class="ok">LIVE</td></tr>
<tr><td>List the directory from curl</td><td>POST /api/dispatch</td><td><code>DIRECTORY_LIST</code></td><td class="ok">LIVE</td></tr>
<tr><td>Add a capability from curl</td><td>POST /api/dispatch</td><td><code>ADD_ROW</code></td><td class="ok">LIVE</td></tr>
<tr><td>Agent dispatches a tool and folds result</td><td>POST /api/dispatch on an agent KEY with response containing tags + <code>[SELF]</code></td><td>any agent</td><td class="ok">LIVE (trace t_ebi9lark)</td></tr>
<tr><td>Agent self-modifies the directory</td><td>any agent emitting <code>[ADD_ROW]</code>/<code>[EDIT_ROW]</code>/<code>[DEL_ROW]</code></td><td>the same fn rows</td><td class="ok">LIVE</td></tr>
<tr><td>Workers AI cheap triage</td><td>POST /api/dispatch with <code>@cf/...</code> agent row</td><td>any <code>@cf/</code> agent</td><td class="ok">LIVE (<code>@cf/meta/llama-3.1-8b-instruct</code> verified)</td></tr>
<tr><td>Edit a page's body</td><td>browser at /admin/pages</td><td>bespoke <code>/api/pages</code> PUT</td><td>BESPOKE</td></tr>
<tr><td>Inbound iMessage → Grok reply</td><td>POST /blooio</td><td>bespoke handler</td><td>BESPOKE</td></tr>
<tr><td>Content-change audit</td><td>POST /grok/audit</td><td>bespoke; <code>GROK_AUDIT</code> row callable in parallel</td><td>BESPOKE</td></tr>
<tr><td>Browser Pixel mirror</td><td>POST /capi</td><td>bespoke</td><td>BESPOKE</td></tr>
<tr><td>Claude / Gemini call</td><td>POST /api/dispatch with new agent row</td><td>—</td><td>BLOCKED on missing API key</td></tr>
<tr><td>Cloudflare account ops</td><td>POST /api/dispatch with control rows</td><td>—</td><td>BLOCKED on missing <code>CF_API_TOKEN</code></td></tr>
<tr><td>Run shell</td><td>POST /api/dispatch with <code>CLI_EXEC</code></td><td>—</td><td>BLOCKED on no tunnel</td></tr>
<tr><td>Scheduled task</td><td>Cron Trigger</td><td>—</td><td>NOT configured</td></tr>
<tr><td>Email channel</td><td>Email Worker</td><td>—</td><td>NOT configured</td></tr>
<tr><td>Async job</td><td>Queue</td><td>—</td><td>NOT configured</td></tr>
</tbody>
</table>

<h3>27.6 Consolidation</h3>
<ul>
  <li>None of the 29 rows is redundant. Merging KV_GET/PUT/DEL would require a switch-on-op fn — saves 2 rows, adds equivalent code.</li>
  <li>List/tail flow rows are kept as named handles. Each is equivalent to a literal <code>D1_QUERY</code>.</li>
  <li>The remaining line-count drop comes from cutting over <code>blooio.js</code> / <code>grok/audit.js</code> / <code>capi.js</code> to dispatch shims.</li>
</ul>

<h3>27.7 Counts</h3>
<table>
<thead><tr><th>thing</th><th>count</th></tr></thead>
<tbody>
<tr><td>directory rows total</td><td>29</td></tr>
<tr><td>fn / http / agent / flow</td><td>13 / 2 / 3 / 11</td></tr>
<tr><td>rows tested this session</td><td>29 (2 marked untested-live due to side effects)</td></tr>
<tr><td>function files still bespoke</td><td>3</td></tr>
<tr><td>function files routed through dispatch</td><td>1 (<code>[slug].js</code>)</td></tr>
<tr><td>kernel size</td><td>424 lines, one file</td></tr>
</tbody>
</table>

</div>`;

export async function onRequestGet() {
  return new Response(shellHtml({ activeHref: '/admin/manual', title: 'Manual', body: BODY }), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}
