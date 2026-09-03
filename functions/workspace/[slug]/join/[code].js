// THE SEAT PAGE (owner order 2026-08-03: "I have a team — how can I send this to them?").
// This is the link a workspace owner sends a teammate who has NEVER heard of any of this.
// It explains the workspace in plain words, shows exactly what their seat may and may not
// do, and on claim hands over the one block they paste into whatever AI they already use.
// The credential travels only in the claim's JSON response to the claimant — never in HTML.
import { loadWorkspace, roleGrant } from '../../../_lib/workspace_object.js';

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function onRequestGet({ env, params }) {
  const slug = String(params.slug || '').toLowerCase();
  const code = String(params.code || '').toLowerCase();
  const loaded = await loadWorkspace(env, slug);
  const bad = (title, msg) => new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><body style="font-family:-apple-system,system-ui,sans-serif;max-width:34rem;margin:12vh auto;padding:0 1.2rem;color:#1c1c1c"><h1 style="font-size:1.3rem">${esc(title)}</h1><p style="color:#555;line-height:1.6">${esc(msg)}</p></body>`,
    { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } });
  if (loaded.error) return bad('This workspace does not exist', 'The link may be mistyped. Ask the person who sent it for a fresh one.');

  let invite = null;
  try { const raw = await env.KV.get('wsinvite:' + code); if (raw) invite = JSON.parse(raw); } catch {}
  if (!invite || invite.workspace !== slug) return bad('This invitation is not valid', 'It may have expired. Ask the person who sent it for a fresh link.');
  const grant = roleGrant(loaded.ws, invite.role) || { rows: [], ops: [] };
  const ws = loaded.ws;
  const claimed = !(invite.claims_left > 0);

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Your seat in the ${esc(slug)} workspace</title>
<style>
  :root{color-scheme:light dark}
  body{font-family:-apple-system,system-ui,'Segoe UI',sans-serif;margin:0;background:#f6f5f2;color:#1b1b1b;line-height:1.6}
  @media (prefers-color-scheme:dark){body{background:#121212;color:#ececec}.card{background:#1c1c1c!important;border-color:#333!important}pre{background:#111!important;border-color:#333!important;color:#ddd!important}.dim{color:#9a9a9a!important}td,th{border-color:#333!important}}
  main{max-width:40rem;margin:0 auto;padding:3.5rem 1.3rem 5rem}
  h1{font-size:1.55rem;line-height:1.25;margin:0 0 .4rem}
  .dim{color:#5c5c5c;font-size:.95rem}
  .card{background:#fff;border:1px solid #e2e0da;border-radius:12px;padding:1.3rem 1.4rem;margin:1.3rem 0}
  .k{font-size:.72rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#8a8a8a;margin:0 0 .3rem}
  table{width:100%;border-collapse:collapse;font-size:.9rem}
  td,th{text-align:left;padding:.4rem .2rem;border-bottom:1px solid #eceae4;vertical-align:top}
  code{background:rgba(127,127,127,.12);border-radius:5px;padding:.08rem .35rem;font-size:.84em}
  pre{background:#fbfaf7;border:1px solid #e2e0da;border-radius:9px;padding:.9rem 1rem;font-size:.78rem;line-height:1.55;overflow-x:auto;white-space:pre-wrap;word-break:break-word}
  button{background:#1b6b46;color:#fff;border:0;border-radius:9px;padding:.75rem 1.4rem;font-size:1rem;font-weight:700;cursor:pointer}
  button[disabled]{opacity:.55;cursor:default}
  .copy{background:#333;font-size:.85rem;padding:.5rem 1rem;margin-top:.6rem}
  a{color:#1b6b46}
</style></head><body><main>
  <p class="k">You were sent a seat in a shared workspace</p>
  <h1>${esc(ws.purpose || 'A shared workspace for your team and its AIs')}</h1>
  <p class="dim">Your team keeps its work in a shared, permanent workspace object. Each person connects <strong>their own AI</strong> — ChatGPT, Claude, Gemini, anything — to the same work, under their own permission. Everything any AI does there is recorded, and anything it is not allowed to do is refused in writing. Nobody shares logins and nobody has to use the same AI.</p>

  <div class="card">
    <p class="k">Your seat</p>
    <table>
      <tr><th>Workspace</th><td><a href="/a/${esc(slug)}">${esc(slug)}</a></td></tr>
      <tr><th>Seat${invite.name ? ' for' : ''}</th><td>${esc(invite.name || invite.role)}</td></tr>
      <tr><th>Role</th><td><code>${esc(invite.role)}</code></td></tr>
      <tr><th>Your AI may use</th><td>${grant.rows.map((k) => '<code>' + esc(k) + '</code>').join(' ') || 'read-only access'}</td></tr>
      <tr><th>Your AI may change</th><td>${grant.ops.map((o) => '<code>' + esc(o) + '</code>').join(' ') || 'nothing — change requests from this seat are refused, and the refusal itself is recorded'}</td></tr>
    </table>
  </div>

  ${claimed
    ? `<div class="card"><p class="k">Already claimed</p><p>This seat was claimed${invite.claimed_at ? ' on ' + esc(String(invite.claimed_at).slice(0, 10)) : ''}. Ask the person who sent you the link for a fresh one.</p></div>`
    : `<div class="card">
    <p class="k">Claim it — one click</p>
    <p class="dim">Claiming hands you a live 7-day credential and the single block below to paste into whatever AI you already use. That is the whole setup.</p>
    <button id="claim">Claim my seat</button>
    <div id="out" hidden>
      <p class="k" style="margin-top:1.1rem">Paste this into your AI — that's it</p>
      <pre id="block"></pre>
      <button class="copy" id="copy">Copy the block</button>
      <p class="dim">Works in ChatGPT, Claude, Gemini — anything that can fetch a web address. Your AI will read the workspace and act only within your seat's permission. Every action it takes is recorded under your credential's fingerprint.</p>
    </div>
    <p class="dim" id="err" hidden></p>
  </div>`}

  <p class="dim">See the workspace itself (no claim needed): <a href="/a/${esc(slug)}">the live page</a> · <a href="/api/workspace/${esc(slug)}">the machine view your AI reads</a></p>

  <script>(function(){
    var btn=document.getElementById('claim'); if(!btn) return;
    btn.addEventListener('click',function(){
      btn.disabled=true;btn.textContent='Claiming…';
      fetch('/api/workspace/${esc(slug)}/claim',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:'${esc(code)}'})})
      .then(function(r){return r.json();}).then(function(d){
        if(!d.ok){var e=document.getElementById('err');e.hidden=false;e.textContent=d.note||d.error||'claim failed';btn.textContent='Claim my seat';btn.disabled=false;return;}
        document.getElementById('out').hidden=false;
        document.getElementById('block').textContent=d.paste_block;
        btn.textContent='Seat claimed — credential live until '+(d.expires_at||'');
        var c=document.getElementById('copy');
        c.addEventListener('click',function(){navigator.clipboard.writeText(d.paste_block).then(function(){c.textContent='Copied';});});
      }).catch(function(e){var el=document.getElementById('err');el.hidden=false;el.textContent=String(e);btn.disabled=false;btn.textContent='Claim my seat';});
    });
  })();</script>
</main></body></html>`;
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
