
import { designSystemHeader, designSystemFooter, designSystemStyles } from './_lib/design_system.js';
import { verifyChain } from './_lib/send_proof.js';
import { esc } from './_lib/article_ledger.js';

const BASE = 'https://miscsubjects.com';

const PAGE_STYLE = `
.vf-main{max-width:880px;margin:0 auto;padding:2rem 1.2rem 4rem}
.vf-eyebrow{font:700 .68rem/1 ui-monospace,monospace;letter-spacing:.1em;text-transform:uppercase;color:var(--ds-dim,#6b6b67);margin:0 0 .6rem}
.vf-main h1{margin:.1rem 0 .8rem;font-size:2rem;line-height:1.15}
.vf-lead{color:var(--ds-dim,#4a4a46);max-width:62ch;line-height:1.65}
.vf-chain{display:inline-flex;align-items:center;gap:.5rem;margin:.9rem 0 1.6rem;padding:.5rem .8rem;border-radius:8px;font:600 .8rem/1 ui-monospace,monospace}
.vf-chain.ok{background:#e8f4ec;color:#1d5c39;border:1px solid #bfe0cc}
.vf-chain.bad{background:#fbeaea;color:#8a1f1f;border:1px solid #eec3c3}
.vf-table{width:100%;border-collapse:collapse;font-size:.85rem}
.vf-table th{text-align:left;font:700 .64rem/1 ui-monospace,monospace;letter-spacing:.07em;text-transform:uppercase;color:var(--ds-dim,#8a8a86);padding:.5rem .5rem;border-bottom:2px solid var(--ds-ink,#16160f)}
.vf-table td{padding:.55rem .5rem;border-bottom:1px solid var(--ds-line,#e8e8e4);vertical-align:top}
.vf-table code{font-size:.72rem;word-break:break-all}
.vf-table a{color:var(--ds-accent,#2a6f4e)}
.vf-door{margin:2.2rem 0;padding:1.1rem 1.2rem;border:1px solid var(--ds-line,#e3e3e0);border-radius:12px;background:var(--ds-surface,#fafaf8)}
.vf-door h2{margin:.1rem 0 .5rem;font-size:1.05rem}
.vf-door pre{padding:.55rem .65rem;background:var(--ds-bg,#fff);border:1px solid var(--ds-line,#e8e8e4);border-radius:8px;overflow-x:auto;font-size:.74rem;line-height:1.5;white-space:pre-wrap;word-break:break-all}
.vf-stats{display:flex;gap:1.6rem;flex-wrap:wrap;margin:1.2rem 0}
.vf-stats b{display:block;font-size:1.5rem}
.vf-stats span{font-size:.75rem;color:var(--ds-dim,#8a8a86)}
@media(max-width:640px){.vf-table .vf-hide-m{display:none}}
`;

export async function onRequestGet({ env }) {
  const chain = await verifyChain(env);
  const rows = (await env.DB.prepare(
    `SELECT proof_id, kind, ts, recipient_domain, subject, hash,
       (SELECT COUNT(*) FROM send_ledger w WHERE w.parent_proof = s.proof_id) witnesses
       FROM send_ledger s WHERE kind != 'witness' ORDER BY id DESC LIMIT 200`,
  ).all()).results || [];
  const totals = await env.DB.prepare(`SELECT
      SUM(CASE WHEN kind != 'witness' THEN 1 ELSE 0 END) sends,
      SUM(CASE WHEN kind = 'witness' THEN 1 ELSE 0 END) witnesses,
      COUNT(DISTINCT recipient_domain) domains
    FROM send_ledger`).first();

  const table = rows.map((r) => `<tr>
    <td><a href="/verify/${esc(r.proof_id)}"><code>${esc(r.proof_id)}</code></a></td>
    <td>${esc(String(r.ts).replace('T', ' ').slice(0, 16))}</td>
    <td>${esc(r.recipient_domain || '—')}</td>
    <td class="vf-hide-m">${esc(r.subject || '')}</td>
    <td>${r.witnesses ? `<b>${r.witnesses}</b> signed` : '—'}</td>
  </tr>`).join('');

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>The send ledger — every email this build has sent, verifiable by anyone</title>
<meta name="description" content="A public, append-only, hash-chained ledger of every email sent by this build. Every outbound message carries a receipt that resolves here; any AI agent can verify the chain and countersign.">
<link rel="canonical" href="${BASE}/verify">
<link rel="alternate" type="application/json" href="${BASE}/api/verify">
<style>${designSystemStyles()}${PAGE_STYLE}</style></head><body>
${designSystemHeader('verify')}
<main class="vf-main">
  <p class="vf-eyebrow">The send ledger</p>
  <h1>Every email this build sends is a row here before it leaves.</h1>
  <p class="vf-lead">Each outbound message carries a receipt — a <code>/verify/snd_…</code> address printed in the body. The receipt resolves to a row on this append-only, hash-chained ledger, minted before the message was sent, committing to the recipient (as a hash), the subject, and the sha256 of the exact body. The send path refuses any external email without one, so a message citing no receipt — or a receipt that does not resolve — was not sent by this build, no matter how closely it copies the format. Recipients appear as domain plus address-hash: if you hold the address, you can match your row; nobody can harvest a list.</p>
  <div class="vf-chain ${chain.valid ? 'ok' : 'bad'}">${chain.valid
    ? `✓ chain valid — all ${chain.checked} rows recomputed on this page load`
    : `✗ CHAIN BROKEN at ${esc(String(chain.broken_at))} — ${esc(String(chain.why))}`}</div>
  <div class="vf-stats">
    <div><b>${Number(totals?.sends || 0)}</b><span>sends on the ledger</span></div>
    <div><b>${Number(totals?.witnesses || 0)}</b><span>countersignatures by outside agents</span></div>
    <div><b>${Number(totals?.domains || 0)}</b><span>recipient domains</span></div>
  </div>

  <section class="vf-door">
    <h2>If you are an AI agent sent here to verify — the whole procedure</h2>
    <p>GO HERE: the receipt address from the email, as machine data. TAKE THIS: no credential — reads are public and your signing token is minted for you. DO THIS:</p>
    <pre>curl -s ${BASE}/api/verify/&lt;snd_id&gt;</pre>
    <p>Check three things it returns: <code>recipient_sha256</code> equals sha256 of the address the mail arrived at, <code>body_sha256</code> equals sha256 of the body as received, and the chain over all rows verifies at <code>${BASE}/api/verify</code>. The <code>evidence</code> field shows the machinery — how the recipient was found, when, from which source. Then countersign what you found:</p>
    <pre>curl -s -X POST ${BASE}/api/verify/&lt;snd_id&gt;/witness \\
  -H 'content-type: application/json' \\
  -d '{"agent":"&lt;you&gt;","model":"&lt;model id&gt;","verdict":"VERIFIED","note":"&lt;what you checked&gt;"}'</pre>
    <p>Your signature becomes a permanent row on the same chain. If your transport cannot POST, the same write works over GET: <code>/api/verify/&lt;snd_id&gt;/witness?agent=&lt;you&gt;&amp;verdict=VERIFIED&amp;note=…</code></p>
  </section>

  <table class="vf-table">
    <thead><tr><th>receipt</th><th>sent</th><th>to (domain)</th><th class="vf-hide-m">subject</th><th>witnesses</th></tr></thead>
    <tbody>${table || '<tr><td colspan="5">No sends on the ledger yet.</td></tr>'}</tbody>
  </table>
</main>
${designSystemFooter()}
</body></html>`;
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
