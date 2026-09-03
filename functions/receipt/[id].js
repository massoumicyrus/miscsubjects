import { getInvocation } from '../_lib/invocation_log.js';
import { publicReceiptPayload } from '../_lib/object_contract.js';
import { redactPublicSecrets } from '../_lib/public_secret_guard.js';
import { governanceHeader, governanceFooter, governanceChromeStyles } from '../_lib/governance_chrome.js';

const BASE = 'https://miscsubjects.com';

function esc(value) {
  return String(value == null ? '' : value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function hashCard(label, value) {
  if (!value) return '';
  return `<article class="hash"><span>${esc(label)}</span><code>${esc(value)}</code></article>`;
}

function branch(label, href, note) {
  return `<a class="branch" href="${esc(href)}"><b>${esc(label)}</b><span>${esc(note)}</span><i>OPEN →</i></a>`;
}

export async function onRequestGet({ env, params }) {
  const id = String(params.id || '').trim();
  if (!/^inv_[A-Za-z0-9_-]{4,160}$/.test(id)) return new Response('Receipt not found', { status: 404 });
  const rec = await getInvocation(env, id);
  if (!rec) return new Response('Receipt not found', { status: 404 });
  const proof = publicReceiptPayload(rec);
  const detail = proof.invocation;
  const fingerprints = detail.fingerprints || {};
  let checkpoint = null;
  let social = null;
  try {
    checkpoint = await env.LEDGER.prepare(
      'SELECT event_count,head,checkpoint_hash,sealed_at FROM chain_v2_checkpoints ORDER BY seq DESC LIMIT 1'
    ).first();
  } catch {}
  try {
    social = await env.DB.prepare(
      'SELECT COUNT(*) posts,MAX(seq) latest_seq FROM relay_social_posts'
    ).first();
  } catch {}
  const status = detail.material ? 'PROVEN ACTION' : 'PROVEN ATTEMPT / NO MATERIAL OUTPUT';
  const statusClass = detail.material ? 'pass' : 'fail';
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'DigitalDocument',
    name: `OIP public receipt ${id}`,
    url: `${BASE}/receipt/${id}`,
    dateCreated: detail.ts,
    about: { '@type': 'SoftwareApplication', name: 'Object Invocation Protocol', url: `${BASE}/a/oip` },
  }).replaceAll('<', '\\u003c');
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(id)} — OIP public receipt</title>
<meta name="description" content="A public, keyless proof of one capability invocation. Audit the hashes, traverse the protocol, and subscribe to only the governance facets your system needs.">
<meta property="og:title" content="A real AI capability ran. This is its receipt.">
<meta property="og:description" content="Not a screenshot. Not a model claim. A public invocation record with hashes, lineage, protocol traversal and an adoption path.">
<meta property="og:url" content="${BASE}/receipt/${esc(id)}">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${jsonLd}</script>
<style>
${governanceChromeStyles()}
:root{color-scheme:light;--ink:#000;--muted:#555;--line:#ddd;--lime:#000;--red:#8a1c1c;--blue:#000;--panel:#fff}*{box-sizing:border-box}body{margin:0;background:#fff;color:var(--ink);font:16px/1.55 Inter,ui-sans-serif,system-ui,sans-serif}a{color:#000;text-decoration:underline;text-underline-offset:3px}.wrap{width:min(1120px,calc(100% - 32px));margin:auto}.hero{padding:74px 0 46px;background:#fff}.eyebrow{font:700 12px/1 ui-monospace,monospace;letter-spacing:.16em;color:var(--lime)}h1{font-size:clamp(44px,8vw,92px);line-height:.92;letter-spacing:-.06em;margin:22px 0;max-width:920px}.lede{font-size:clamp(18px,2.4vw,27px);max-width:820px;color:#555}.status{display:inline-flex;gap:10px;align-items:center;border:1px solid var(--line);border-radius:999px;padding:9px 14px;font:800 12px/1 ui-monospace,monospace;letter-spacing:.08em}.status:before{content:'';width:9px;height:9px;border-radius:50%;background:var(--lime);box-shadow:0 0 18px var(--lime)}.status.fail:before{background:var(--red);box-shadow:0 0 18px var(--red)}.facts{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--line);border:1px solid var(--line);margin:36px 0 0}.fact{background:#fff;padding:18px}.fact span,.hash span{display:block;color:var(--muted);font:700 11px/1.2 ui-monospace,monospace;text-transform:uppercase;letter-spacing:.1em}.fact b{display:block;margin-top:8px;overflow-wrap:anywhere}.section{padding:54px 0;border-top:1px solid #ddd}h2{font-size:clamp(28px,4vw,48px);letter-spacing:-.04em;margin:0 0 12px}.sub{color:var(--muted);max-width:740px;margin:0 0 28px}.hashes{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.hash{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:18px;min-width:0}.hash code{display:block;color:var(--lime);margin-top:12px;overflow-wrap:anywhere;font-size:12px}.flow{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;counter-reset:step}.flow div{counter-increment:step;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px;min-height:120px}.flow div:before{content:'0' counter(step);display:block;color:var(--lime);font:700 11px ui-monospace,monospace;margin-bottom:18px}.branches{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.branch{display:grid;grid-template-columns:1fr auto;gap:5px 16px;text-decoration:none;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:18px;transition:.15s}.branch:hover{border-color:var(--lime);transform:translateY(-1px)}.branch span{color:var(--muted);grid-column:1}.branch i{font:700 11px ui-monospace,monospace;color:var(--lime);grid-row:1/3;grid-column:2;align-self:center}.cta{background:#c8ff4d;color:#111;border-radius:20px;padding:32px}.cta h2{max-width:760px}.cta p{max-width:760px}.buttons{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px}.button{display:inline-block;text-decoration:none;border:2px solid #111;border-radius:999px;padding:11px 16px;font-weight:800}.button.alt{background:#111;color:#fff}.law{border-left:3px solid var(--red);padding:4px 0 4px 18px;color:#555}.foot{padding:30px 0 70px;color:var(--muted);font-size:13px}@media(max-width:800px){.facts,.hashes{grid-template-columns:1fr 1fr}.flow{grid-template-columns:1fr 1fr 1fr}.branches{grid-template-columns:1fr}}@media(max-width:520px){.facts,.hashes,.flow{grid-template-columns:1fr}.hero{padding-top:48px}}
</style></head><body>${governanceHeader('receipts')}
<header class="hero"><div class="wrap"><div class="eyebrow">OBJECT INVOCATION PROTOCOL · PUBLIC RECEIPT</div><h1>A model said it acted.<br>This is the part that proves it.</h1><p class="lede">Not a screenshot. Not a transcript. A keyless record of which capability ran, who held authority, what contract governed it, whether material output appeared, and where the rest of the machine can be audited.</p><p class="status ${statusClass}">${esc(status)}</p>
<div class="facts"><div class="fact"><span>Invocation</span><b>${esc(id)}</b></div><div class="fact"><span>Capability</span><b>${esc(detail.object_id)}</b></div><div class="fact"><span>Actor</span><b>${esc(detail.capability_fingerprint || detail.actor)}</b></div><div class="fact"><span>Timestamp</span><b>${esc(detail.ts)}</b></div></div></div></header>
<main>
<section class="section"><div class="wrap"><h2>Three hashes. Three questions.</h2><p class="sub">The public receipt does not disclose private payloads. It discloses their fingerprints so an authorized auditor can compare the forensic record byte-for-byte without turning credentials into evidence.</p><div class="hashes">${hashCard('Input fingerprint',fingerprints.input)}${hashCard('Output fingerprint',fingerprints.output)}${hashCard('Contract fingerprint',fingerprints.contract)}</div></div></section>
<section class="section"><div class="wrap"><h2>The entire loop is inside the receipt.</h2><p class="sub">The receipt is a cursor into the machine, not the end of the document.</p><div class="flow"><div>Intent</div><div>Scoped authority</div><div>Named contract</div><div>Execution</div><div>Observed outcome</div><div>Replay, repair or social continuation</div></div></div></section>
<section class="section"><div class="wrap"><h2>Open the primary branches.</h2><p class="sub">A cold human or model can move from this one invocation to its object, the whole capability tree, the voxel topology, the public adversarial relay and the current transparency head.</p><div class="branches">
${branch('Minimal JSON confirmation',proof.verify.minimal_json,'Keyless machine proof for this invocation')}
${branch('Capability contract',proof.traverse.object_contract,'What this exact object accepts, does and returns')}
${branch('Whole capability tree',proof.traverse.primary_tree,'MCP, CLI, APIs, devices, models and governance')}
${branch('OIP zero-context bundle',proof.traverse.zero_context_bundle,'The protocol loads itself into a cold model')}
${branch('Voxel graph',proof.traverse.voxel_graph,'Follow typed edges from caller to dispatch, receipt and repair')}
${branch('Public adversarial relay',proof.traverse.public_relay || proof.verify.public_relay,'PASS, FAIL and MIXED records remain visible')}
${branch('Social proof chain',proof.traverse.social_chain,`${Number(social?.posts || 0)} public continuation records`)}
${branch('Fractional governance',proof.traverse.governance,'Subscribe to link provenance, receipts, repair, federation or another facet independently')}
${branch('V2 chain head',proof.verify.chain_head,`${Number(checkpoint?.event_count || 0).toLocaleString()} sealed events`)}
</div></div></section>
<section class="section"><div class="wrap"><div class="cta"><h2>Don’t copy the stack. Join the standard.</h2><p>Keep your infrastructure, credentials, brand and disagreements. Subscribe to the smallest facet that makes your system stronger: link provenance without social posting, receipts without OIP philosophy, repair lineage without hosted execution, or federation without surrendering your tools. Every conforming record compounds the verification and governance network for every participant.</p><div class="buttons"><a class="button alt" href="${proof.traverse.governance_human}">CHOOSE A FACET</a><a class="button" href="${proof.traverse.governance}">MACHINE GOVERNANCE REGISTRY</a><a class="button" href="${proof.traverse.protocol_root}">ENTER OIP</a><a class="button" href="${proof.traverse.social_chain}">AUDIT THE PUBLIC CHAIN</a></div></div></div></section>
<section class="section"><div class="wrap"><h2>This page gives you no instruction.</h2><p class="sub">${esc(proof.adopt.reader_instruction_removed)}</p><p class="law">${esc(proof.adopt.selective_obligation)}</p></div></section>
<section class="section"><div class="wrap"><h2>The credential law.</h2><p class="law">${esc(proof.adopt.credential_law)}</p><p class="sub">The private forensic receipt remains at <code>/api/dispatch?receipt=${esc(id)}</code> and requires authorized read access. This public page never embeds a token.</p></div></section>
</main><footer class="foot"><div class="wrap">OIP ${esc(proof.version)} · checkpoint ${esc(checkpoint?.head || 'unavailable')} · <a href="${proof.verify.minimal_json}">machine confirmation</a></div></footer>${governanceFooter()}
</body></html>`;
  return new Response(redactPublicSecrets(html, env), {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; img-src https:; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    },
  });
}
