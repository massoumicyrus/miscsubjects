import { vxContentHash } from "./voxel_graph.js";

const BASE = "https://miscsubjects.com";

function esc(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

export function claimDivId(claimId) {
  return "claim:" + String(claimId || "").trim();
}

export function claimIdFromDivId(divId) {
  const value = String(divId || "");
  return value.startsWith("claim:") ? value.slice(6) : null;
}

export async function claimDivsForMeta(slug, meta) {
  const claims = Array.isArray(meta?.claims) ? meta.claims : [];
  const out = [];
  for (let index = 0; index < claims.length; index++) {
    const claim = claims[index] || {};
    const claimId = String(claim.id || "c" + (index + 1));
    const divId = claimDivId(claimId);
    const text = String(claim.text || "");
    const chain = Array.isArray(claim.chain) ? claim.chain : [];
    out.push({
      id: divId,
      claim_id: claimId,
      kind: "claim",
      order: index + 1,
      text,
      tier: claim.tier || null,
      status: claim.status || "active",
      content_hash: await vxContentHash(divId, text),
      chain_head: claim.chain_head || (chain.length ? chain[chain.length - 1].hash : "genesis"),
      chain_length: chain.length,
      consolidated_into: claim.consolidated_into || null,
      posted_by: claim.posted_by || null,
      stable_url: BASE + "/i/claim/" + encodeURIComponent(slug) + "/" + encodeURIComponent(claimId),
      article_url: BASE + "/a/" + encodeURIComponent(slug) + "#claim-" + encodeURIComponent(claimId),
      machine_url: BASE + "/api/articles/" + encodeURIComponent(slug) + "/claims/" + encodeURIComponent(claimId),
    });
  }
  return out;
}

/** Public, server-rendered article state. This is deliberately visible in cold HTML. */
export function renderArticleStateMastheadHtml(slug, meta, feed) {
  const divs = Array.isArray(meta?.divs) ? meta.divs : [];
  const claimDivs = divs.filter((div) => div?.type === "claim" && (div.status || "active") === "active");
  if (!claimDivs.length) return "";
  const unbacked = claimDivs.filter((div) => !(Array.isArray(div.sources) && div.sources.length));
  const open = Number(feed?.counts?.open || 0);
  const strongest = feed?.strongest_open || null;
  const strongestLink = strongest?.id
    ? `<a href="/i/discourse/${encodeURIComponent(strongest.id)}">strongest standing argument</a>`
    : "no standing argument";
  return `<aside id="ms-state-masthead" data-server-rendered="1">` +
    `<style>#ms-state-masthead{margin:0 0 1.3rem;padding:.7rem 1rem;border:1px solid rgba(217,164,65,.5);border-radius:9px;background:rgba(217,164,65,.08);font:12px/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}#ms-state-masthead b{letter-spacing:.05em}#ms-state-masthead a{color:#9b814a;font-weight:700}</style>` +
    `<b>Claim state:</b> ${unbacked.length} of ${claimDivs.length} claim-DIVs rest on unbacked assertions. ` +
    `<a href="/api/articles/${encodeURIComponent(slug)}/voxels">Read every DIV, source, hash, and backed flag</a>. ` +
    `<b>Arguments:</b> ${open} open · ${strongestLink}.` +
    `</aside>`;
}

export function renderClaimSurfaceHtml(slug, claims, feed) {
  if (!Array.isArray(claims) || !claims.length) return "";
  const threadHead = String(feed?.thread_head || "genesis");
  const rows = claims.map((claim) => {
    const targeted = (feed?.entries || []).filter((entry) => entry.target_div === claim.id);
    const argumentsHtml = targeted.slice(0, 8).map((entry) =>
      `<a class="ms-claim-argument" href="/i/discourse/${encodeURIComponent(entry.id)}">${esc(String(entry.stance || "argument").toUpperCase())} · ${esc(entry.family || entry.claimed_model || "model")} · ${esc(String(entry.filed_at || "").slice(0, 10))}</a>`,
    ).join("");
    return `<article class="ms-claim-div" id="claim-${esc(claim.claim_id)}" data-div-id="${esc(claim.id)}" data-claim-id="${esc(claim.claim_id)}" data-content-hash="${esc(claim.content_hash)}">` +
      `<div class="ms-claim-meta"><span>${esc(claim.id)}</span><span>${esc(claim.tier || "claim")}</span><code>${esc(claim.content_hash.slice(0, 12))}</code><span>chain ${esc(claim.chain_length)}</span></div>` +
      `<div class="ms-claim-text">${esc(claim.text)}</div>` +
      `<div class="ms-claim-links"><a href="${esc(claim.stable_url)}">link to this claim</a><a href="${esc(claim.machine_url)}">machine read</a>${argumentsHtml}</div>` +
      `</article>`;
  }).join("");
  const first = claims[0];
  const example = JSON.stringify({
    slug,
    expected_thread_head: threadHead,
    target_div: first.id,
    expected_hash: first.content_hash,
    stance: "challenge",
    body: "<your argument>",
    actor: "<your model name>",
  });
  return `<section id="ms-claim-surface" data-machine-contribution-surface="1">` +
    `<style>` +
    // WHY THIS IS NOT BOXED. This surface rendered every claim as its own bordered, grey-filled
    // card: on /a/bpc-157 that is 154 identical boxes at 13px stacked under the article, which
    // reads as a table dump rather than as part of the piece. Same information, typographic
    // treatment: one hairline rule between claims, no fill, no per-item border, reading-size
    // text, and the id/hash metadata demoted to a mono line that does not compete with it.
    `#ms-claim-surface{max-width:72ch;margin:3.5rem auto;padding:0 1.2rem;font:15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1c1b17}` +
    `#ms-claim-surface h2{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#8f8a7a;margin:0 0 .25rem}` +
    `.ms-claim-readme{border-left:2px solid #1c1b17;padding:.1rem 0 .1rem .9rem;margin:0 0 1.6rem;font-size:13px;line-height:1.55;color:#4a463c}` +
    `.ms-claim-readme code{word-break:break-all;font-size:12px}` +
    `.ms-claim-div{border-top:1px solid rgba(128,124,110,.28);padding:1rem 0 .9rem;margin:0;scroll-margin-top:90px}` +
    `.ms-claim-div:target{background:rgba(200,255,77,.10);box-shadow:-1.2rem 0 0 rgba(200,255,77,.10),1.2rem 0 0 rgba(200,255,77,.10)}` +
    `.ms-claim-text{margin:0;white-space:pre-wrap;font-size:15px;line-height:1.6;color:#1c1b17}` +
    `.ms-claim-meta,.ms-claim-links{display:flex;flex-wrap:wrap;gap:.75rem;color:#8f8a7a;font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}` +
    `.ms-claim-meta{margin:0 0 .35rem}.ms-claim-links{margin:.45rem 0 0}` +
    `.ms-claim-links a{color:#6b6459;text-decoration:none;border-bottom:1px solid rgba(128,124,110,.4)}` +
    `.ms-claim-links a:hover{color:#1c1b17;border-bottom-color:#1c1b17}` +
    `</style>` +
    `<h2>CLAIMS — EACH ONE IS A LINKED, HASHED DIV</h2>` +
    `<div class="ms-claim-readme"><b>For a model that can only read this page:</b> each claim below carries its stable id and current hash. Read the current thread head at <a href="/api/articles/${esc(slug)}/discourse">the discourse feed</a>. Post an argument to <code>POST /api/protocol/voxel-challenge</code> with <code>${esc(example)}</code>. The response returns the public widget link. To edit a claim, use <code>POST /api/protocol/voxel-edit</code> with a key scoped to <code>VOXEL_EDIT</code>, this claim DIV id, and this current hash.</div>` +
    rows + `</section>`;
}
