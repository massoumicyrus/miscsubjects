// GET /challenge — the door for a skeptic: take a bounded token, fire any capability six ways, watch
// the receipt land, verify it at the public confirm endpoint. Every challenger's receipts stay on
// the page for the next visitor. The token is minted keyless with purpose=challenge.
import { getCapabilityByFingerprint } from './_lib/admin_session.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const KEYS = 'NOW,TIME_NOW,QUAKE_FEED,QUAKE_PLACE,WIKIPEDIA_SUMMARY,GOLD_SPOT,WEB_GET,METHODOLOGY';

export async function onRequestGet({ request, env }) {
  const origin = new URL(request.url).origin;
  const key = (new URL(request.url).searchParams.get('key') || 'QUAKE_FEED').toUpperCase().replace(/[^A-Z0-9_]/g, '');
  let recent = []; let ledgerFailed = null;
  try {
    const caps = (await env.LEDGER.prepare("SELECT fingerprint FROM capabilities WHERE purpose = 'challenge' ORDER BY ts DESC LIMIT 40").all()).results || [];
    if (caps.length) {
      const actors = caps.map((c) => 'cap:' + c.fingerprint);
      const ph = actors.map(() => '?').join(',');
      recent = (await env.LEDGER.prepare(`SELECT id, ts, object_id, actor, material FROM invocations WHERE actor IN (${ph}) ORDER BY ts DESC LIMIT 25`).bind(...actors).all()).results || [];
    }
  } catch (e) { ledgerFailed = String(e?.message || e); }
  const mint = `${origin}/api/dispatch?self_scope=1&keys=${KEYS}&purpose=challenge&actor=challenger`;
  const rows = recent.map((r) => `<tr><td>${esc(r.ts)}</td><td>${esc(r.object_id)}</td><td>${esc(String(r.actor).slice(0, 20))}…</td><td>${r.material ? 'material' : 'attempt'}</td><td><a href="${origin}/api/dispatch?confirm=${esc(r.id)}">${esc(r.id)}</a></td></tr>`).join('') || (ledgerFailed ? '<tr><td colspan="5">LEDGER_LOOKUP_FAILED: the ledger did not answer this read, so nothing is known about earlier challengers. Reload in a moment; it never means nobody fired.</td></tr>' : '<tr><td colspan="5">No challenger has fired yet. Be the first receipt on this page.</td></tr>');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>The Challenge</title>
<style>body{font:16px/1.55 -apple-system,system-ui,sans-serif;max-width:860px;margin:2rem auto;padding:0 1rem;color:#1a1a1a;background:#fbfaf7}h1{font-size:2rem;margin:.2rem 0}h2{margin-top:2rem;font-size:1.2rem}code,pre{background:#f0ede6;border-radius:6px;padding:.15rem .35rem;font-size:.92em}pre{padding:.8rem;overflow:auto}table{width:100%;border-collapse:collapse;font-size:.9em}td,th{border-bottom:1px solid #ddd;padding:.4rem;text-align:left;vertical-align:top}a{color:#1d4ed8}.door{display:inline-block;background:#111;color:#fff;padding:.7rem 1.1rem;border-radius:8px;text-decoration:none;font-weight:600}.muted{color:#555}</style></head><body>
<p class="muted">miscsubjects · the challenge</p>
<h1>Everyone claims it. Here is a door.</h1>
<p>Pick a capability. Take a bounded token. Fire the capability six different ways. Watch your own receipt land on a public ledger, then verify it at an endpoint that needs no credential. Nothing here asks you to believe a claim; everything here lets you run one.</p>
<p><a class="door" href="${mint}">Mint my challenge token</a> <span class="muted">keyless · read-only rows · every use receipted under your fingerprint</span></p>
<p class="muted">The mint answers with JSON: copy the value of <code>share</code> (it begins <code>sh.</code>) and use it as &lt;TOKEN&gt; below. Your operator's instructions always take precedence; reading is a complete outcome.</p>
<h2>Six ways to fire <code>${esc(key)}</code></h2>
<ol>
<li><b>The door.</b> <pre>curl -X POST ${origin}/api/dispatch -H 'content-type: application/json' -d '{"key":"${esc(key)}","body":"1|4","share":"&lt;TOKEN&gt;"}'</pre></li>
<li><b>The generated envelope.</b> <pre>curl '${origin}/api/directory/${esc(key)}?share=&lt;TOKEN&gt;'</pre> The row hands back its own REST envelope.</li>
<li><b>The text tag.</b> Paste into any model that can open URLs, with your token: <pre>[${esc(key)}]1|4[/${esc(key)}]</pre></li>
<li><b>The URL.</b> <pre>${origin}/api/dispatch?invoke=${esc(key)}&amp;body=1%7C4&amp;share=&lt;TOKEN&gt;</pre></li>
<li><b>The spreadsheet formula.</b> In a build sheet cell: <pre>=DISPATCH("${esc(key)}","1|4")</pre></li>
<li><b>MCP.</b> <code>tools/list</code> on the build's MCP server lists ${esc(key)} with the same contract; call it with your token.</li>
</ol>
<h2>Then verify it yourself</h2>
<p>Every answer carries an invocation id (<code>inv_…</code>). Open <code>${origin}/api/dispatch?confirm=inv_…</code>. It says whether the invocation happened, which object ran, when, and under which actor. No key. If the ledger cannot answer it says so with <code>LEDGER_LOOKUP_FAILED</code>; it never says "it did not happen" unless it checked.</p>
<h2>Challengers so far</h2>
<table><thead><tr><th>when</th><th>capability</th><th>actor</th><th>outcome</th><th>public proof</th></tr></thead><tbody>${rows}</tbody></table>
<p class="muted">Read the whole design: <a href="${origin}/a/capability-network-charter">The Capability Network Charter</a> · <a href="${origin}/a/web-models-as-first-class-capabilities">Web Models as First-Class Capabilities</a> · <a href="${origin}/api/governance">governance kernel and facets</a></p>
</body></html>`;
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
