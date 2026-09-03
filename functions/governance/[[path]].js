import { governanceHeader, governanceFooter, governanceChromeStyles } from '../_lib/governance_chrome.js';

const pages = {
  assurance: {
    title: 'The Assurance Boundary',
    kicker: 'OIP · Security & Readiness',
    lede: 'What the protocol enforces, what a receipt actually proves, and where accountability still lives with people and institutions.',
    body: `<section><h2>The authorization boundary is the product boundary.</h2><p>OIP does not confuse an invocation identifier with authority. Execution credentials are private capabilities. Governance records and receipts are evidence. A conforming execution path evaluates scope, ancestry, tenant, audience, risk, expiry, revocation, use budget, and payload ceiling before a runner fires.</p><div class="flow"><b>1 · request</b><b>2 · authenticate</b><b>3 · least privilege</b><b>4 · execute or refuse</b><b>5 · observe</b><b>6 · receipt</b></div></section>
<section><h2>What a receipt can and cannot prove.</h2><div class="grid"><article><h3>It can prove</h3><ul><li>the named contract and recorded authority</li><li>the attempted operation and observed outcome class</li><li>payload-safe fingerprints, time, and repair lineage</li><li>that a record changed if its chain no longer verifies</li></ul></article><article><h3>It cannot prove by itself</h3><ul><li>that a model decision was correct, lawful, or safe</li><li>that a claimed identity or legal basis is true</li><li>that a recipient completed downstream erasure</li><li>that an external institution accepts the record</li></ul></article></div></section>
<section><h2>Current evidence, without adoption theater.</h2><p>The build has live capability enforcement and public invocation receipts; clause-cited model decisions; append-only reviews; repair lineage; bounded, expiring, and revocable state cards; a standards registry; and recipient-addressable privacy-egress records. The current synthetic privacy proof is <strong>PARTIAL: 6 of 8 clauses tested</strong>. Imported Kimi analysis is disclosed corroboration, not a context-independent runtime recomputation. No regulator, insurer, standards body, or independent customer is represented as having adopted or certified OIP.</p></section>
<section><h2>Readiness gate</h2><p>Before an organization depends on OIP, it should independently threat-model the deployment, verify credential isolation, run penetration testing, define retention and incident response, establish an accountable operator and support terms, and validate interoperability with its existing identity, policy, and observability systems.</p><div class="actions"><a href="/api/governance/decisions/dec_fe298d0517225241295f">Governance decision</a><a href="/api/privacy/conformance/dis_d80b129eaa4f018a41c5">Privacy conformance</a><a href="/a/oip-model-governance-and-privacy">Technical literature</a></div></section>`
  },
  integrate: {
    title: 'Integrate Without Replacing Your Controls',
    kicker: 'OIP · Implementation Path',
    lede: 'Keep IAM, policy engines, approvals, and observability. Put OIP at the action boundary so authority is checked before execution and evidence is emitted afterward.',
    body: `<section><h2>OIP is a control-plane companion, not a substitute for IAM.</h2><p>Use your cloud, payment, health, CRM, or internal service as the system of record for permissions. Give the agent a narrow capability—not an administrator credential—and require the action gateway to enforce it. OIP supplies the portable contract, attenuation rules, outcome semantics, and receipt lineage around that decision.</p><div class="stack"><article><span>Existing identity</span><b>OIDC · OAuth · workload identity</b></article><article><span>Existing policy</span><b>IAM · ABAC/RBAC · approvals</b></article><article><span>OIP boundary</span><b>capability scope · expiry · revocation · payload ceiling</b></article><article><span>Existing telemetry</span><b>OpenTelemetry-compatible trace correlation</b></article><article><span>OIP evidence</span><b>public confirmation · private forensic receipt · repair lineage</b></article></div></section>
<section><h2>A consequential-action pattern</h2><pre>agent proposes refund(60)
→ gateway authenticates workload
→ policy checks: refund ≤ 100, account = current tenant, approval = valid
→ service executes or refuses
→ telemetry records runtime behavior
→ OIP receipt binds contract, authority, observed result, and trace reference
→ later repair links to the original attempt</pre></section>
<section><h2>Start with an isolated proof of concept.</h2><ol><li>Choose one reversible, low-risk action.</li><li>Remove broad credentials from the agent runtime.</li><li>Define a narrow contract and explicit refusal cases.</li><li>Correlate existing traces with OIP invocation and event identifiers.</li><li>Test expiry, revocation, replay, cross-tenant denial, and repair.</li><li>Have an independent security reviewer verify the boundary.</li></ol><div class="actions"><a href="/api/dispatch?map=1&amp;format=markdown">Capability tree</a><a href="/api/dispatch?schema=invocation">Invocation schema</a><a href="/governance/assurance">Assurance limits</a></div></section>`
  }
};

function esc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

export async function onRequestGet({ params }) {
  const key = Array.isArray(params.path) ? params.path.join('/') : String(params.path || '');
  const page = pages[key];
  if (!page) return new Response('Not found', { status: 404 });
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(page.title)} — OIP AI Governance Protocol</title><meta name="description" content="${esc(page.lede)}"><style>
${governanceChromeStyles()}
*{box-sizing:border-box}body{margin:0;background:var(--ds-bg);color:var(--ds-ink);font-family:var(--font)}a{color:inherit}
.hero{padding:var(--space-6) 0 var(--space-5);background:radial-gradient(circle at 82% 8%,rgba(201,169,97,.14) 0,transparent 46%)}
.wrap,main{width:min(var(--measure-wide),calc(100% - 40px));margin:auto}
.kicker{font:600 11px/1 var(--font-mono);letter-spacing:.17em;color:var(--ds-accent);text-transform:uppercase}
h1{font:500 var(--fs-h1)/var(--lh-head) var(--font-display);letter-spacing:.005em;margin:var(--space-3) 0;color:var(--ds-ink)}
.lede{font-size:var(--fs-lead);max-width:var(--measure-copy);color:var(--ds-soft);line-height:var(--lh-body)}
section{padding:var(--space-5) 0;border-top:1px solid var(--ds-line)}
h2{font:500 var(--fs-h2)/var(--lh-head) var(--font-display);letter-spacing:.005em;margin:0 0 var(--space-3);color:var(--ds-ink)}
h3{font:600 var(--fs-h3)/1.3 var(--font);color:var(--ds-ink)}
p{max-width:var(--measure-copy);color:var(--ds-soft);line-height:var(--lh-body)}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);margin-top:var(--space-4)}
.grid article,.stack article{border:1px solid var(--ds-line);background:var(--ds-surface);border-radius:14px;padding:var(--space-3)}
.grid li,ol li{margin-bottom:8px;color:var(--ds-soft);line-height:1.55}
.flow{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-top:var(--space-4)}
.flow b{border:1px solid var(--ds-line);border-radius:10px;padding:15px;font-size:13px;color:var(--ds-accent);font-weight:600;text-align:center}
.stack{display:grid;gap:10px;margin-top:var(--space-4)}
.stack article{display:grid;grid-template-columns:180px 1fr;gap:var(--space-3);align-items:baseline}
.stack span{color:var(--ds-accent);font:600 11px var(--font-mono);text-transform:uppercase;letter-spacing:.08em}
pre{white-space:pre-wrap;background:var(--ds-surface);border:1px solid var(--ds-line);padding:var(--space-3);border-radius:14px;color:var(--ds-soft);overflow:auto;font-size:14px;line-height:1.6}
.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:var(--space-3)}
.actions a{border:1px solid var(--ds-line);border-radius:999px;padding:11px 16px;text-decoration:none;font-weight:600;font-size:14px;color:var(--ds-ink)}
.actions a:hover{border-color:var(--ds-accent);color:var(--ds-accent);text-decoration:none}
strong{color:var(--ds-accent);font-weight:600}
@media(max-width:760px){.grid,.flow{grid-template-columns:1fr}.stack article{grid-template-columns:1fr;gap:6px}}
</style></head><body>${governanceHeader(key)}<header class="hero"><div class="wrap"><div class="kicker">${esc(page.kicker)}</div><h1>${esc(page.title)}</h1><p class="lede">${esc(page.lede)}</p></div></header><main>${page.body}</main>${governanceFooter()}</body></html>`;
  return new Response(html, { headers: { 'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" } });
}
