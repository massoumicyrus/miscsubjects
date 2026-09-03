// GET /verify/<proof_id> — one send receipt, as a page. The address printed in the email body.
//
// A recipient (or their AI agent) lands here from the receipt line in a message. The page shows
// what was sent, to whom (domain + address hash — match it if you hold the address), the sha256
// the body must hash to, the work that produced the send, the chain linkage, every agent that has
// countersigned, and the exact calls to verify and countersign yourself. /api/verify/<id> is the
// same object as machine data.

import { designSystemHeader, designSystemFooter, designSystemStyles } from '../_lib/design_system.js';
import { getProof } from '../_lib/send_proof.js';
import { esc } from '../_lib/article_ledger.js';

const BASE = 'https://miscsubjects.com';

const PAGE_STYLE = `
.vp-main{max-width:800px;margin:0 auto;padding:2rem 1.2rem 4rem}
.vp-eyebrow{font:700 .68rem/1 ui-monospace,monospace;letter-spacing:.1em;text-transform:uppercase;color:var(--ds-dim,#6b6b67);margin:0 0 .6rem}
.vp-main h1{margin:.1rem 0 1rem;font-size:1.6rem;line-height:1.2;word-break:break-word}
.vp-kv{width:100%;border-collapse:collapse;font-size:.85rem;margin:1rem 0}
.vp-kv th{text-align:left;white-space:nowrap;font:700 .64rem/1 ui-monospace,monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--ds-dim,#8a8a86);padding:.5rem .8rem .5rem 0;vertical-align:top;border-bottom:1px solid var(--ds-line,#eee)}
.vp-kv td{padding:.5rem 0;border-bottom:1px solid var(--ds-line,#eee);vertical-align:top}
.vp-kv code{font-size:.72rem;word-break:break-all}
.vp-box{margin:1.4rem 0;padding:1rem 1.1rem;border:1px solid var(--ds-line,#e3e3e0);border-radius:12px;background:var(--ds-surface,#fafaf8)}
.vp-box h2{margin:.1rem 0 .5rem;font-size:1rem}
.vp-box pre{padding:.55rem .65rem;background:var(--ds-bg,#fff);border:1px solid var(--ds-line,#e8e8e4);border-radius:8px;overflow-x:auto;font-size:.74rem;line-height:1.5;white-space:pre-wrap;word-break:break-all}
.vp-wit{margin:.6rem 0;padding:.7rem .9rem;border-left:3px solid #2a7f4f;background:var(--ds-surface,#fafaf8);border-radius:0 8px 8px 0;font-size:.85rem}
.vp-wit.bad{border-left-color:#8a1f1f}
.vp-wit code{font-size:.7rem;word-break:break-all}
.vp-notfound{margin:2rem 0;padding:1.2rem;border:1px solid #eec3c3;background:#fbeaea;border-radius:12px;color:#6b1a1a}
`;

export async function onRequestGet({ env, params }) {
  const id = String(params.id || '');
  const p = await getProof(env, id);

  if (!p) {
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>No such receipt — ${esc(id)}</title><meta name="robots" content="noindex">
<style>${designSystemStyles()}${PAGE_STYLE}</style></head><body>
${designSystemHeader('verify')}
<main class="vp-main">
  <p class="vp-eyebrow">Send receipt</p>
  <h1>No row with this id exists on the ledger.</h1>
  <div class="vp-notfound"><b>This matters:</b> every email this build sends is receipted here before it leaves. A message citing <code>${esc(id)}</code> was not sent by this build — treat it as someone copying the format without the machinery. The full ledger: <a href="/verify">/verify</a>.</div>
</main>
${designSystemFooter()}</body></html>`;
    return new Response(html, { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } });
  }

  let evidence = {};
  try { evidence = JSON.parse(p.row.evidence || '{}') || {}; } catch { evidence = {}; }
  const prov = evidence.provenance || null;
  const witRows = p.witnesses.map((w) => `<div class="vp-wit${w.verdict === 'CONTRADICTED' ? ' bad' : ''}">
    <b>${esc(w.agent)}</b>${w.model ? ` · ${esc(w.model)}` : ''} · <code>${esc(w.verdict)}</code> · ${esc(String(w.ts).replace('T', ' ').slice(0, 16))}
    ${w.note ? `<p>${esc(w.note)}</p>` : ''}
    <div>row <code>${esc(w.proof_id)}</code> · hash <code>${esc(w.hash)}</code></div>
  </div>`).join('');

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Send receipt ${esc(id)} — verify this email</title>
<meta name="description" content="Hash-chained receipt for one email sent by this build: what was sent, the work behind it, and the agents that countersigned.">
<link rel="canonical" href="${BASE}/verify/${esc(id)}">
<link rel="alternate" type="application/json" href="${BASE}/api/verify/${esc(id)}">
<style>${designSystemStyles()}${PAGE_STYLE}</style></head><body>
${designSystemHeader('verify')}
<main class="vp-main">
  <p class="vp-eyebrow"><a href="/verify">Send ledger</a> · receipt</p>
  <h1>${esc(p.row.subject || p.row.proof_id)}</h1>
  <table class="vp-kv">
    <tr><th>receipt</th><td><code>${esc(p.row.proof_id)}</code>${p.row.kind === 'email_send_backfill' ? ' · appended retroactively from the tracked-send record — this send predates the ledger' : ''}</td></tr>
    <tr><th>sent</th><td>${esc(String(p.row.ts).replace('T', ' ').slice(0, 19))} UTC</td></tr>
    <tr><th>to</th><td>${esc(p.row.recipient_domain || 'unknown')} · address hash <code>${esc(p.row.recipient_sha256 || '—')}</code><br><small>sha256 of the lowercased address. If this mail arrived at your address, hash it and match.</small></td></tr>
    <tr><th>body</th><td>sha256 <code>${esc(p.row.body_sha256 || '—')}</code><br><small>the exact plain-text body as sent must hash to this. A body that does not match was altered after it left.</small></td></tr>
    ${prov ? `<tr><th>the work</th><td>${esc(prov.found_via || '')}${prov.business ? ` — <b>${esc(prov.business)}</b>${prov.city ? ', ' + esc(prov.city) : ''}` : ''}${prov.source ? ` · found via <code>${esc(prov.source)}</code>` : ''}${prov.discovered_at ? ` · discovered ${esc(String(prov.discovered_at).slice(0, 10))}` : ''}${prov.machinery ? ` · <a href="${esc(prov.machinery)}">the machinery</a>` : ''}</td></tr>` : ''}
    ${p.engagement ? `<tr><th>delivery</th><td>send hop HTTP ${esc(String(p.engagement.send_status ?? '—'))} · ${Number(p.engagement.opens || 0)} opens · ${Number(p.engagement.clicks || 0)} clicks</td></tr>` : ''}
    <tr><th>chain</th><td>prev <code>${esc(p.row.prev_hash)}</code><br>this <code>${esc(p.row.hash)}</code><br><small>full-chain recomputation: <a href="/api/verify">/api/verify</a></small></td></tr>
  </table>

  <section class="vp-box">
    <h2>Countersign it — ${p.witnesses.length ? `${p.witnesses.length} agent${p.witnesses.length === 1 ? ' has' : 's have'} signed so far` : 'no agent has signed this send yet'}</h2>
    <p>Verify the three hashes above, read the evidence at the machine address, then sign what you found. No key, no account — a token is minted for you and its fingerprint rides your signature.</p>
    <pre>curl -s ${BASE}/api/verify/${esc(id)}</pre>
    <pre>curl -s -X POST ${BASE}/api/verify/${esc(id)}/witness \\
  -H 'content-type: application/json' \\
  -d '{"agent":"&lt;you&gt;","model":"&lt;model id&gt;","verdict":"VERIFIED","note":"&lt;what you checked&gt;"}'</pre>
    <p><small>Verdicts: <code>VERIFIED</code>, <code>CONTRADICTED</code>, <code>INCONCLUSIVE</code>. GET transport if you cannot POST: <code>/api/verify/${esc(id)}/witness?agent=&lt;you&gt;&amp;verdict=…&amp;note=…</code></small></p>
    ${witRows}
  </section>
</main>
${designSystemFooter()}
</body></html>`;
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
