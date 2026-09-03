
import { reflexEdgesForClaim } from "./graph_reflex.js";

export async function vxSha256(s) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(s)));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/** The DIV's own hash — binds identity + verbatim text. */
export function vxContentHash(id, text) {
  return vxSha256("vx1|" + String(id) + "|" + String(text));
}

function chainEntryBody(e) {
  return [e.prev, e.n, e.op, e.ts, e.actor, e.text_sha, JSON.stringify(e.detail || {})].join("|");
}

/** Append one op to a DIV's provenance chain. Chain: hash = sha256(prev|n|op|ts|actor|text_sha|detail). */
export async function vxChainAppend(div, op, actor, detail) {
  const chain = Array.isArray(div.chain) ? div.chain : [];
  const prev = chain.length ? chain[chain.length - 1].hash : "genesis";
  const e = {
    n: chain.length + 1,
    op: String(op),
    ts: new Date().toISOString(),
    actor: String(actor || "unknown").slice(0, 200),
    text_sha: await vxSha256(String(div.text || "")),
    detail: detail || {},
    prev,
  };
  e.hash = await vxSha256(chainEntryBody(e));
  chain.push(e);
  div.chain = chain;
  div.chain_head = e.hash;
  div.vx_hash = await vxContentHash(div.id, div.text);
  return e;
}

// ── PLANE MERGE (GUM P2): the DIV IS the claim. Two hashes, per next-turn-directive §2:
// semantic_hash binds MEANING (id|type|NFC(body)|sorted sources|sorted falsifiers) — identical
// semantic state → identical hash. version_hash binds the EVENT (semantic|version|prev|status|actor).
export async function vxSemanticHash(div) {
  const body = String(div.text || "").normalize("NFC");
  const src = (div.sources || []).map(String).sort().join(",");
  const fal = (div.falsifiers || []).map(String).sort().join(",");
  return vxSha256("sem1|" + div.id + "|" + (div.type || "claim") + "|" + body + "|" + src + "|" + fal);
}
export async function vxVersionHash(div, semanticHash) {
  return vxSha256("ver1|" + semanticHash + "|" + (div.version || 1) + "|" + (div.prev_version_hash || "genesis") + "|" + (div.status || "active") + "|" + (div.last_actor || ""));
}

/** Recompute a DIV's chain from genesis. { valid, breaks:[n] } */
export async function vxVerifyChain(div) {
  const chain = Array.isArray(div.chain) ? div.chain : [];
  let prev = "genesis";
  const breaks = [];
  for (const e of chain) {
    if (e.prev !== prev) breaks.push(e.n);
    const h = await vxSha256(chainEntryBody(e));
    if (h !== e.hash) breaks.push(e.n);
    prev = e.hash;
  }
  return { valid: breaks.length === 0, length: chain.length, breaks };
}

// ── Deterministic body atomizer — verbatim blocks, never rewritten. ──────────────
// Blocks: fenced code (whole), heading line, [[embed:…]]/[[graph]] line, blockquote run,
// list run, paragraph (blank-line separated). join("\n\n") must roundtrip the body.
export function vxAtomizeBody(body) {
  const source = String(body || "");
  const lines = source.split("\n");
  const blocks = [];
  let cur = [], kind = null, inCode = false;
  const flush = () => {
    if (cur.length) blocks.push({ kind: kind || "p", text: cur.join("\n") });
    cur = []; kind = null;
  };
  for (const raw of lines) {
    const line = raw.replace(/[ \t\r]+$/, "");
    if (/^```/.test(line)) {
      if (!inCode) { flush(); inCode = true; kind = "code"; cur.push(raw); }
      else { cur.push(raw); inCode = false; flush(); }
      continue;
    }
    if (inCode) { cur.push(raw); continue; }
    if (!line.trim()) { flush(); continue; }
    if (/^\[\[(embed|stack-embed|graph)/i.test(line.trim())) { flush(); blocks.push({ kind: "embed", text: raw }); continue; }
    if (/^#{1,3}\s+/.test(line)) { flush(); blocks.push({ kind: "h", text: raw }); continue; }
    const isQuote = /^>\s?/.test(line);
    const isList = /^([-•]|\d+\.)\s+/.test(line);
    const want = isQuote ? "quote" : isList ? "list" : "p";
    if (kind && kind !== want) flush();
    kind = want;
    cur.push(raw);
  }
  flush();
  // split("\n") represents a terminal LF as a final empty line. Preserve that byte
  // on the last block because vxBodyFromDivs only supplies separators between blocks.
  if (source.endsWith("\n") && blocks.length) blocks[blocks.length - 1].text += "\n";
  return blocks;
}

const VX_NORM = (s) => String(s || "").replace(/\s+/g, " ").trim();

/** body ↔ atoms roundtrip check — persisted document imports are byte-exact. */
export function vxRoundtripOk(body, blocks) {
  return String(body || "") === blocks.map((x) => x.text).join("\n\n");
}

/** Regenerate the article body from the ordered, active DIVs. */
export function vxBodyFromDivs(divs) {
  return (divs || [])
    .filter((d) => (d.status || "active") === "active")
    .sort((x, y) => (x.order || 0) - (y.order || 0))
    .map((d) => d.text)
    .join("\n\n");
}

/** Build meta.divs from a body — verbatim, ordered, hashed, genesis-chained. */
export async function vxDivide(body, claims, actor) {
  const blocks = vxAtomizeBody(body);
  if (!vxRoundtripOk(body, blocks)) return { error: "roundtrip_failed: atomizer would not reproduce the body verbatim — divide refused" };
  const claimByNorm = {};
  for (const c of claims || []) claimByNorm[VX_NORM(c.text).toLowerCase()] = c.id;
  const divs = [];
  let n = 0;
  for (const b of blocks) {
    n += 1;
    const div = {
      id: "d" + n,
      kind: b.kind,
      order: n,
      text: b.text,
      status: "active",
      claim_ids: claimByNorm[VX_NORM(b.text).toLowerCase()] ? [claimByNorm[VX_NORM(b.text).toLowerCase()]] : [],
    };
    await vxChainAppend(div, "genesis", actor, { divided_from: "body", block: n, kind: b.kind });
    divs.push(div);
  }
  return { divs };
}

/** Verify every DIV chain + the body↔divs identity. */
export async function vxVerifyAll(meta, body) {
  const divs = Array.isArray(meta.divs) ? meta.divs : [];
  const per = [];
  let allValid = true;
  for (const d of divs) {
    const v = await vxVerifyChain(d);
    const contentOk = d.vx_hash === (await vxContentHash(d.id, d.text));
    if (!v.valid || !contentOk) allValid = false;
    per.push({ id: d.id, order: d.order, status: d.status || "active", chain_valid: v.valid, content_hash_valid: contentOk, chain_length: v.length, breaks: v.breaks });
  }
  const bodyMatches = VX_NORM(vxBodyFromDivs(divs)) === VX_NORM(String(body || ""));
  return { div_mode: !!(meta.voxel && meta.voxel.mode === "div"), divs: per.length, all_chains_valid: allValid, body_matches_divs: divs.length ? bodyMatches : null, per_div: per };
}

// ── RECURSIVE CONTENT (human side) — injected server-side on every /a/ page. ──
// The explanation exists without JavaScript. JavaScript adds exact graph identity and the same
// block verbs served to models at /api/blocks. Owner cookies are used automatically; a model can
// carry a signed token in ?share= or paste it into the machine-authority field.
export function recursiveContentDiscoveryHead(slug) {
  const safeSlug = String(slug || '').replace(/[^a-z0-9-]/gi, '');
  const graph = `/api/blocks/article/${safeSlug}`;
  return `<link rel="alternate" type="application/vnd.miscsubjects.blocks+json" title="Public article collaboration graph" href="${graph}">
<link rel="help" type="application/json" title="Public recursive-content procedure" href="/api/blocks">
<meta name="ai-collaboration" content="Public and keyless: read ${graph}; POST comments, verdicts, and structural proposals to /api/blocks/comment, /api/blocks/verdict, and /api/blocks/suggest. No login, API key, or owner identity is required.">
<script type="application/json" id="ms-public-collaboration-manifest">${JSON.stringify({
    schema: 'miscsubjects/public-article-collaboration/1',
    public: true,
    authentication_required: false,
    graph,
    procedure: '/api/blocks',
    comment: '/api/blocks/comment',
    verdict: '/api/blocks/verdict',
    suggest: '/api/blocks/suggest',
    oip_documentation: '/a/oip-tap-go',
    oip_dispatch: '/api/dispatch',
    token_scope: 'pfx:BLOCK_',
    token_transports: ['Authorization: Bearer', 'POST JSON share', 'query share', 'x-write-token', 'x-block-token', '/web/run', 'visible article token field'],
    instructions: 'Read the graph and DIV constitution. You may submit version-bound comments and isolate, move, edit, delete, reuse, split, or merge proposals without authentication. Direct corpus mutation remains protected.',
  }).replace(/</g, '\\u003c')}</script>`;
}

export function voxelDivLayerWidget() {
  return `<style id="ms-voxel-css">
#ms-recursive-editor{display:block;position:fixed;right:18px;bottom:18px;z-index:80;width:min(390px,calc(100vw - 36px));margin:0;padding:.72rem;border:1px solid var(--ds-line,#c9c4b8);border-radius:12px;background:var(--ds-surface,#fff);box-shadow:0 12px 36px rgba(20,20,20,.18);color:var(--ds-ink,#171717);font:13px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
.rc-editor-head{display:flex;align-items:center;gap:.55rem;flex-wrap:wrap}.rc-public-badge{font:700 10px/1 ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--ds-dim,#666)}.rc-edit-page{border:0;border-radius:8px;background:var(--ds-ink,#171717);color:var(--ds-bg,#fff);padding:.55rem .8rem;font-weight:700;cursor:pointer}.rc-comment-count{margin-left:auto;border:1px solid var(--ds-line,#ccc);border-radius:999px;padding:.25rem .5rem;color:var(--ds-dim,#666);white-space:nowrap}.rc-editor-help{display:block;flex-basis:100%;color:var(--ds-dim,#666)}.rc-collab-options{display:none;margin-top:.65rem;padding-top:.65rem;border-top:1px solid var(--ds-line,#ddd)}#ms-recursive-editor.rc-expanded .rc-collab-options{display:block}.rc-collab-row{display:flex;gap:.45rem;align-items:center;flex-wrap:wrap}.rc-collab-row input{flex:1;min-width:150px;border:1px solid var(--ds-line,#ccc);border-radius:7px;padding:.5rem}.rc-multi-toggle,.rc-group-actions button{border:1px solid var(--ds-line,#bbb);border-radius:7px;background:var(--ds-surface,#fff);color:var(--ds-ink,#171717);padding:.45rem .6rem;cursor:pointer}.rc-group-actions{display:none;margin-top:.55rem;gap:.4rem;align-items:center;flex-wrap:wrap}.rc-group-actions.rc-show{display:flex}.rc-selection{display:none;margin-top:.65rem;padding:.65rem;border:1px solid var(--ds-line,#ccc);border-radius:8px;background:var(--ds-surface,#fff)}.rc-selection.rc-show{display:flex;align-items:center;gap:.6rem;flex-wrap:wrap}.rc-selection q{max-width:32ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rc-selection input{flex:1;min-width:180px;border:1px solid var(--ds-line,#ccc);border-radius:6px;padding:.4rem}.rc-selection button{border:1px solid var(--ds-ink,#171717);border-radius:6px;background:var(--ds-ink,#171717);color:var(--ds-bg,#fff);padding:.4rem .65rem;cursor:pointer}.rc-editor-message{display:block;margin-top:.45rem;color:var(--ds-dim,#666)}.rc-editor-message.err{color:#9a3f35}.rc-editor-message.ok{color:#386d3a}
#ms-recursive-content{max-width:72ch;margin:3.5rem auto 1.5rem;padding:1.25rem;border:1px solid rgba(80,72,56,.28);border-radius:12px;background:#f7f4ec;color:#29271f;font:14px/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
#ms-recursive-content h2{margin:0 0 .45rem;font:600 16px/1.3 Georgia,serif;color:#29271f}
#ms-recursive-content p{margin:.35rem 0;color:#4d493d}#ms-recursive-content a{color:#554a32;text-decoration:underline;text-underline-offset:2px}
#ms-recursive-content pre{white-space:pre-wrap;word-break:break-word;padding:.65rem;border-radius:7px;background:#ede7d8;color:#403a2c;font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}
#ms-recursive-content details{margin-top:.8rem;border-top:1px solid rgba(80,72,56,.2);padding-top:.7rem}#ms-recursive-content summary{cursor:pointer;font-weight:600}
.rc-tools{display:grid;grid-template-columns:1fr auto;gap:.5rem;margin-top:.7rem}.rc-tools input{min-width:0;border:1px solid #aaa18d;border-radius:7px;background:#fff;color:#29271f;padding:.55rem .65rem}.rc-tools button,.rc-bar button,.rc-results button,.rc-inline-actions button,.rc-thread button{border:1px solid var(--ds-line,#aaa);border-radius:7px;background:var(--ds-surface,#fff);color:var(--ds-ink,#171717);padding:.42rem .62rem;cursor:pointer;font:12px/1.3 inherit}.rc-results{margin-top:.5rem}.rc-result{display:grid;grid-template-columns:1fr auto;gap:.55rem;padding:.5rem 0;border-top:1px solid rgba(80,72,56,.14)}.rc-result small{display:block;color:#6b6658}
.rc-block{position:relative;border:1px solid transparent;margin:.15rem -.9rem;padding:.3rem .85rem;transition:border-color .12s,background .12s;cursor:pointer}.rc-block:hover,.rc-block.rc-selected,.rc-block.rc-multi-selected{border-color:var(--ds-line,#aaa);background:var(--ds-soft,#f6f5f2)}.rc-block.rc-multi-selected{box-shadow:inset 3px 0 0 var(--ds-accent,#5448ff)}.rc-comment-pin{position:absolute;right:-3.1rem;top:.35rem;display:none!important;min-width:2.5rem}.rc-block:hover>.rc-comment-pin,.rc-block.rc-selected>.rc-comment-pin,.rc-comment-pin[data-count]:not([data-count="0"]){display:block!important}.rc-bar{display:none;align-items:center;flex-wrap:wrap;gap:.35rem;margin:0 0 .4rem;padding:.45rem;border-radius:8px;background:var(--ds-soft,#f4f3ef);font:10px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--ds-dim,#666)}.rc-block.rc-selected>.rc-bar{display:flex}.rc-bar code{background:var(--ds-raised,#e9e7e0);padding:.12rem .35rem;border-radius:4px}.rc-vote,.rc-move{display:inline-flex}.rc-vote button:first-child,.rc-move button:first-child{border-radius:7px 0 0 7px}.rc-vote button:last-child,.rc-move button:last-child{margin-left:-1px;border-radius:0 7px 7px 0}.rc-more{position:relative}.rc-more summary{cursor:pointer;border:1px solid var(--ds-line,#aaa);border-radius:7px;padding:.4rem .6rem;list-style:none}.rc-more-menu{display:flex;gap:.35rem;flex-wrap:wrap;margin-top:.35rem}.rc-status{display:block;flex-basis:100%;margin-top:.25rem;font:11px/1.45 ui-monospace,monospace;white-space:pre-wrap;word-break:break-word}.rc-status.ok{color:#386d3a}.rc-status.err{color:#9a3f35}.rc-inline-editor{width:100%;min-height:140px;box-sizing:border-box;margin:.25rem 0;padding:.75rem;border:2px solid var(--ds-accent,#5448ff);border-radius:7px;background:var(--ds-surface,#fff);color:var(--ds-ink,#171717);font:15px/1.55 ui-monospace,monospace}.rc-inline-actions{display:flex;gap:.5rem;margin:.2rem 0 .65rem}.rc-inline-actions .rc-save{background:var(--ds-ink,#171717);color:var(--ds-bg,#fff)}.rc-source-hidden{display:none!important}
.rc-thread{display:none;position:fixed;right:18px;bottom:116px;z-index:79;width:min(390px,calc(100vw - 36px));max-height:min(68vh,680px);overflow:auto;box-sizing:border-box;padding:1rem;border:1px solid var(--ds-line,#ccc);border-radius:12px;background:var(--ds-surface,#fff);box-shadow:0 12px 36px rgba(20,20,20,.18);color:var(--ds-ink,#171717);font:13px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}.rc-thread.rc-show{display:block}.rc-thread-head{display:flex;gap:.6rem;align-items:flex-start}.rc-thread-head h3{margin:0;flex:1;font-size:15px}.rc-thread-close{border:0!important;font-size:18px!important;padding:0 .3rem!important}.rc-thread-excerpt{margin:.7rem 0;padding:.65rem;border-left:3px solid var(--ds-accent,#5448ff);background:var(--ds-soft,#f5f5f2);color:var(--ds-dim,#555)}.rc-thread-comments{display:grid;gap:.55rem;margin:.7rem 0}.rc-thread-comment{padding:.6rem;border:1px solid var(--ds-line,#ddd);border-radius:8px}.rc-thread-comment small{display:block;margin-top:.3rem;color:var(--ds-dim,#666)}.rc-thread-empty{color:var(--ds-dim,#666)}.rc-thread textarea{width:100%;min-height:90px;box-sizing:border-box;border:1px solid var(--ds-line,#bbb);border-radius:8px;padding:.65rem;font:14px/1.45 inherit}.rc-thread-submit{margin-top:.45rem;background:var(--ds-ink,#171717)!important;color:var(--ds-bg,#fff)!important}.rc-model-door{margin:.55rem 0 0;color:var(--ds-dim,#666)}
.rc-inline-block{display:inline;margin:0;padding:0;border-radius:4px}.rc-editing .rc-inline-block{border-style:dashed}.rc-inline-block.rc-selected{display:inline}.rc-inline-block.rc-selected>.rc-bar{display:flex}.rc-fragment-content{display:inline}
@media(max-width:640px){#ms-recursive-editor{right:10px;bottom:10px;width:calc(100vw - 20px)}.rc-thread{right:10px;bottom:108px;width:calc(100vw - 20px);max-height:60vh}.rc-comment-pin{position:static;display:inline-block!important}.rc-bar button{min-height:34px}#ms-recursive-content{margin:2.5rem .75rem 1rem}.rc-tools{grid-template-columns:1fr}}
</style>
<section id="ms-recursive-editor" aria-label="Inline article editor">
  <div class="rc-editor-head"><span class="rc-public-badge">Public collaboration</span><button class="rc-edit-page" type="button" aria-expanded="false" data-owner-label="Edit page">Collaborate</button><span class="rc-comment-count">0 comments</span><span class="rc-editor-help">Click any DIV to open its thread. Select words to propose a DIV boundary.</span></div>
  <div class="rc-collab-options"><div class="rc-collab-row"><input class="rc-actor" type="text" maxlength="80" placeholder="Your name or model name (optional)" aria-label="Public collaborator name"><button class="rc-multi-toggle" type="button" aria-pressed="false">Select multiple</button></div><p class="rc-model-door"><strong>AI models:</strong> the public graph and every proposal route are linked in this page. No login or key is required.</p><div class="rc-group-actions" aria-live="polite"><strong><span class="rc-selected-count">0</span> DIVs selected</strong><button class="rc-merge-selected" type="button">Merge selected DIVs</button><button class="rc-move-group-up" type="button">Move selected up</button><button class="rc-move-group-down" type="button">Move selected down</button><button class="rc-clear-selected" type="button">Clear</button></div></div>
  <div class="rc-selection" aria-live="polite"><span>Selected:</span><q></q><input class="rc-selection-note" type="text" placeholder="Why should this stand alone?"><button type="button">Propose DIV boundary</button><span class="rc-selection-status"></span></div>
  <span class="rc-editor-message" aria-live="polite"></span>
</section>
<aside class="rc-thread" aria-label="DIV comment thread"><div class="rc-thread-head"><h3>DIV thread · <span class="rc-thread-count">0 comments</span></h3><button class="rc-thread-close" type="button" aria-label="Close thread">×</button></div><div class="rc-thread-excerpt"></div><div class="rc-thread-comments"></div><textarea class="rc-thread-input" placeholder="Comment on this exact DIV and version"></textarea><button class="rc-thread-submit" type="button">Submit comment</button><div class="rc-thread-status" aria-live="polite"></div></aside>
<aside id="ms-recursive-content" aria-labelledby="ms-recursive-title">
  <h2 id="ms-recursive-title">How recursive content works</h2>
  <p><strong>Every block has one stable identity.</strong> Articles point to blocks instead of owning copies. Reuse inserts a reference; editing a shared block updates every article that points to it. Comments keep the exact version and hash they criticized. Making an article-only copy stops later shared edits from propagating. Delete removes the DIV from this article without erasing its words or history.</p>
  <p><a href="/a/recursive-content">Read the full explanation</a> · <a class="rc-graph-link" href="/api/blocks">Machine procedure</a></p>
  <details open><summary>Starting rules for making DIVs</summary><p><strong>One DIV is the smallest lossless, self-contained unit another reader can understand, address, move, critique, edit, delete, or reuse without adjacent prose.</strong></p><ol><li>Prefer a complete paragraph or independently meaningful list item. Keep a heading with the section it names.</li><li>Keep table headers with tables, quote attribution with quotes, complete code syntax together, and media with its caption, alt text, and source.</li><li>Never split markdown syntax, URLs, citations, code tokens, numbers from units, proper names, or paired delimiters.</li><li>A fragment is valid only when it is the exact target of an edit, comment, verdict, reuse, or independently meaningful claim.</li><li>Read the graph first; bind every proposal to <code>block_id</code> and <code>expected_hash</code>; explain why the boundary stands alone.</li><li>Boundary-only work must preserve every byte and the reading order. Public proposals wait for authorized acceptance.</li></ol><p>The complete machine-readable DIV constitution is returned by <code>GET /api/blocks</code> and in every article graph under <code>procedure.div_constitution</code>.</p></details>
  <details open><summary>Any web model can collaborate — no login or key</summary><p>Read this article’s graph, then comment on an exact block/version or submit a DIV boundary, move, edit, delete, reuse, split, or merge for owner review. Public submissions cannot rewrite the article or enumerate the private review queue. A minted article token uses the same OIP capability protocol, scope rules, receipts, replay, repair, and verification as MCP, CLI, and computer capabilities, but its <code>pfx:BLOCK_</code> scope cannot cross into those internal families.</p><pre class="rc-public-procedure">GET /api/blocks/article/&lt;slug&gt;
POST /api/blocks/comment {block_id, body, actor}
POST /api/blocks/verdict {block_id, verdict:"positive|negative|edit|delete", note, actor}
POST /api/blocks/suggest {article_slug, block_id, expected_hash, kind:"isolate|move|edit|delete|reuse|split|merge", payload, note, actor}</pre></details>
  <details open><summary>Search and reuse a block</summary><div class="rc-tools"><input class="rc-search" type="search" placeholder="Search the corpus by words or rb_ ID" aria-label="Search the corpus"><button class="rc-search-go" type="button">Search the corpus</button></div><div class="rc-results" aria-live="polite"></div></details>
  <details><summary>One OIP token, every model transport</summary><p>Comments, votes, and proposed changes are keyless. A signed owner session works automatically. A model with a <code>pfx:BLOCK_</code> token uses this same surface for direct Edit, Split, Move, Merge, reuse, article-only copy, and Delete. The preferred transports are a Bearer header or POST JSON. Browser GET and <code>/web/run</code> remain compatibility lanes for short-lived, sharply scoped tokens; never put broad admin authority in a URL. Every token action returns an <code>inv_</code> invocation receipt.</p><p><a href="/a/oip-tap-go">Complete article-token documentation and copy-paste calls</a></p><div class="rc-tools"><input class="rc-token" type="password" placeholder="Optional signed token" aria-label="Signed block token"><button class="rc-token-save" type="button">Use token</button></div></details>
  <div class="rc-system-status" aria-live="polite">Loading this article’s block graph…</div>
</aside>
<script id="ms-voxel-js">
(function(){
if(window.__msRecursiveContent)return;window.__msRecursiveContent=1;
var art=document.querySelector('article[data-slug]');if(!art)return;var slug=art.getAttribute('data-slug');var content=art.querySelector('.content');var panel=document.getElementById('ms-recursive-content');var editor=document.getElementById('ms-recursive-editor');if(!slug||!content||!panel||!editor)return;
content.parentNode.insertBefore(editor,content);
var graph=null,token='',owner=false,ownerSession=false,canReview=false,allowedActions=[],selection=null,multi=false,selectedRefs=[],threadRef=null;try{token=new URLSearchParams(location.search).get('share')||localStorage.getItem('rc_token')||'';}catch(e){}
panel.querySelector('.rc-graph-link').href='/api/blocks/article/'+encodeURIComponent(slug);var tokenInput=panel.querySelector('.rc-token');if(token)tokenInput.placeholder='signed token loaded';
panel.querySelector('.rc-token-save').onclick=function(){token=tokenInput.value.trim();try{localStorage.setItem('rc_token',token);}catch(e){}tokenInput.value='';tokenInput.placeholder='checking signed token…';probeAuthority(function(){reload();});};
function norm(s){return String(s||'').split('\\n').map(function(l){return l.replace(/^#{1,3}\\s+/,'').replace(/^>\\s?/,'').replace(/^([-\\u2022]|\\d+\\.)\\s+/,'');}).join(' ').replace(/!\\[(.*?)\\]\\((.*?)\\)/g,'$1').replace(/\\[(.+?)\\]\\((.+?)\\)/g,'$1').replace(/\\*\\*|\\*|\`/g,'').replace(/\\s+/g,'').trim().toLowerCase();}
function getJSON(url,done,fail){var x=new XMLHttpRequest();x.open('GET',url,true);x.withCredentials=true;x.timeout=15000;x.setRequestHeader('accept','application/json');x.onload=function(){var j;try{j=JSON.parse(x.responseText||'{}');}catch(e){if(fail)fail(e);return;}if(x.status>=200&&x.status<300)done(j);else if(fail)fail(new Error(j.error||('HTTP '+x.status)));};x.onerror=function(){if(fail)fail(new Error('network error'));};x.ontimeout=function(){if(fail)fail(new Error('request timed out'));};x.send();}
function postJSON(url,body,done,fail){var x=new XMLHttpRequest();x.open('POST',url,true);x.withCredentials=true;x.timeout=15000;x.setRequestHeader('content-type','application/json');x.onload=function(){var j;try{j=JSON.parse(x.responseText||'{}');}catch(e){if(fail)fail(e);return;}if(x.status>=200&&x.status<300&&j.ok!==false)done(j);else if(fail)fail(new Error((j.error||('HTTP '+x.status))+(j.detail?' — '+j.detail:'')));};x.onerror=function(){if(fail)fail(new Error('network error'));};x.ontimeout=function(){if(fail)fail(new Error('request timed out'));};x.send(JSON.stringify(body||{}));}
function setStatus(status,text,ok){status.className=(status===editor.querySelector('.rc-editor-message')?'rc-editor-message ':'rc-status ')+(ok?'ok':'err');status.textContent=text;}
function actorBody(body){body=body||{};var actor=editor.querySelector('.rc-actor').value.trim();if(actor)body.actor=actor;return body;}
var OIP_BLOCK_ACTIONS={comment:'BLOCK_COMMENT',verdict:'BLOCK_VERDICT',suggest:'BLOCK_SUGGEST',edit:'BLOCK_EDIT',move:'BLOCK_MOVE','move-group':'BLOCK_MOVE_GROUP',split:'BLOCK_SPLIT',merge:'BLOCK_MERGE','isolate-selection':'BLOCK_DIVIDE','insert-reference':'BLOCK_REUSE',detach:'BLOCK_COPY',retire:'BLOCK_DELETE'};
function canDirect(op){return ownerSession||allowedActions.indexOf('*')>=0||allowedActions.indexOf(op)>=0;}
function invocationId(j){return j&&((j.invocation&&j.invocation.id)||j.invocation_id||(j.proof&&j.proof.invocation_id)||(j.receipt&&j.receipt.id))||'';}
function request(op,body,done,status){body=actorBody(body||{});var direct=canDirect(op),action=OIP_BLOCK_ACTIONS[op];function ok(j){var receipt=invocationId(j);setStatus(status,direct?('Saved'+(receipt?' · receipt '+receipt:'')+'.'):'Submitted for owner review.',true);if(done)done(j);}function fail(e){setStatus(status,'Request failed: '+e.message,false);}if(token&&direct&&action){postJSON('/api/dispatch',{key:action,share:token,body:JSON.stringify(body)},ok,fail);return;}if(token)body.key=token;postJSON('/api/blocks/'+op,body,ok,fail);}
function suggest(ref,kind,payload,note,done,status){request('suggest',{article_slug:slug,block_id:ref.block_id,expected_hash:ref.content_hash,kind:kind,payload:payload||{},note:note||''},done,status);}
function reload(){var u=new URL(location.href);u.searchParams.set('rc_fresh',String(Date.now()));location.replace(u.pathname+u.search);}
function button(bar,label,title,fn){var b=document.createElement('button');b.type='button';b.textContent=label;b.title=title;b.onclick=function(e){e.preventDefault();e.stopPropagation();fn();};bar.appendChild(b);}
function clearSelected(){[].slice.call(content.querySelectorAll('.rc-selected')).forEach(function(x){x.classList.remove('rc-selected');});}
function inlineEdit(ref,wrap,el,status){if(wrap.querySelector('.rc-inline-editor'))return;var ta=document.createElement('textarea');ta.className='rc-inline-editor';ta.value=ref.content;var actions=document.createElement('div');actions.className='rc-inline-actions';var save=document.createElement('button');save.type='button';save.className='rc-save';save.textContent=canDirect('edit')?'Save edit':'Send edit for review';var cancel=document.createElement('button');cancel.type='button';cancel.textContent='Cancel';actions.appendChild(save);actions.appendChild(cancel);el.classList.add('rc-source-hidden');wrap.insertBefore(ta,el);wrap.insertBefore(actions,el);save.onclick=function(e){e.stopPropagation();if(canDirect('edit'))request('edit',{block_id:ref.block_id,expected_hash:ref.content_hash,content:ta.value},reload,status);else suggest(ref,'edit',{content:ta.value},'Inline edit for owner review',function(){ta.remove();actions.remove();el.classList.remove('rc-source-hidden');},status);};cancel.onclick=function(e){e.stopPropagation();ta.remove();actions.remove();el.classList.remove('rc-source-hidden');};ta.focus();ta.setSelectionRange(0,ta.value.length);}
function verdict(ref,value,status){request('verdict',{block_id:ref.block_id,verdict:value},null,status);}
var thread=document.querySelector('.rc-thread');
function updateArticleCount(){editor.querySelector('.rc-comment-count').textContent=String(Number(graph&&graph.comment_count||0))+' comment'+(Number(graph&&graph.comment_count||0)===1?'':'s');}
function setRefCommentCount(ref,count){var next=Number(count||0),old=Number(ref.comment_count||0);ref.comment_count=next;if(graph)graph.comment_count=Math.max(0,Number(graph.comment_count||0)+next-old);var pin=content.querySelector('.rc-comment-pin[data-block-id="'+ref.block_id+'"][data-position="'+ref.position+'"]');if(pin){pin.setAttribute('data-count',String(next));pin.textContent='Comment · '+next;}updateArticleCount();}
function renderThread(ref,j){var comments=j.comments||[];thread.querySelector('.rc-thread-count').textContent=comments.length+' comment'+(comments.length===1?'':'s');var box=thread.querySelector('.rc-thread-comments');box.textContent='';if(!comments.length){var empty=document.createElement('p');empty.className='rc-thread-empty';empty.textContent='No comments yet. Start this DIV thread.';box.appendChild(empty);}comments.forEach(function(comment){var row=document.createElement('div');row.className='rc-thread-comment';var body=document.createElement('div');body.textContent=comment.body;var meta=document.createElement('small');meta.textContent=(comment.actor||'public collaborator')+' · version '+comment.block_version;row.appendChild(body);row.appendChild(meta);box.appendChild(row);});setRefCommentCount(ref,comments.length);}
function openThread(ref){threadRef=ref;thread.classList.add('rc-show');thread.querySelector('.rc-thread-excerpt').textContent=ref.content.slice(0,260);thread.querySelector('.rc-thread-status').textContent='Loading thread…';getJSON('/api/blocks/block/'+encodeURIComponent(ref.block_id)+'/comments',function(j){renderThread(ref,j);thread.querySelector('.rc-thread-status').textContent='';},function(e){thread.querySelector('.rc-thread-status').textContent=e.message;});}
thread.querySelector('.rc-thread-close').onclick=function(){thread.classList.remove('rc-show');};
thread.querySelector('.rc-thread-submit').onclick=function(){if(!threadRef)return;var input=thread.querySelector('.rc-thread-input'),body=input.value.trim(),status=thread.querySelector('.rc-thread-status');if(!body){status.textContent='Write a comment first.';return;}request('comment',{block_id:threadRef.block_id,body:body},function(){input.value='';openThread(threadRef);},status);};
function selectionPayload(){return selectedRefs.slice().sort(function(a,b){return a.position-b.position;}).map(function(ref){return{block_id:ref.block_id,expected_position:ref.position,expected_hash:ref.content_hash};});}
function renderGroupSelection(){var actions=editor.querySelector('.rc-group-actions');editor.querySelector('.rc-selected-count').textContent=String(selectedRefs.length);actions.classList.toggle('rc-show',selectedRefs.length>0);}
function toggleGroup(ref,wrap){var at=selectedRefs.findIndex(function(item){return item.block_id===ref.block_id&&Number(item.position)===Number(ref.position);});if(at>=0){selectedRefs.splice(at,1);wrap.classList.remove('rc-multi-selected');}else{selectedRefs.push(ref);wrap.classList.add('rc-multi-selected');}renderGroupSelection();}
function clearGroup(){selectedRefs=[];[].slice.call(content.querySelectorAll('.rc-multi-selected')).forEach(function(node){node.classList.remove('rc-multi-selected');});renderGroupSelection();}
function groupAction(kind,direction){if(selectedRefs.length<2){setStatus(editor.querySelector('.rc-editor-message'),'Select at least two adjacent DIVs.',false);return;}var payload=selectionPayload(),first=selectedRefs.slice().sort(function(a,b){return a.position-b.position;})[0],status=editor.querySelector('.rc-editor-message'),op=kind==='merge'?'merge':'move-group';if(canDirect(op)){var body={slug:slug,selections:payload};if(direction)body.direction=direction;request(op,body,reload,status);}else{suggest(first,kind,kind==='merge'?{selections:payload}:{selections:payload,direction:direction},'Multi-DIV '+kind+' proposal',clearGroup,status);}}
editor.querySelector('.rc-merge-selected').onclick=function(){groupAction('merge');};editor.querySelector('.rc-move-group-up').onclick=function(){groupAction('move','up');};editor.querySelector('.rc-move-group-down').onclick=function(){groupAction('move','down');};editor.querySelector('.rc-clear-selected').onclick=clearGroup;
function decorate(ref,el,wrap){if(!wrap){wrap=document.createElement('div');wrap.className='rc-block';el.parentNode.insertBefore(wrap,el);wrap.appendChild(el);}wrap.id='block-'+ref.block_id;wrap.setAttribute('data-block-id',ref.block_id);wrap.setAttribute('data-position',String(ref.position));wrap.onclick=function(e){if(e.target.closest('button,textarea,input,a,summary'))return;if(multi||e.shiftKey){toggleGroup(ref,wrap);return;}clearSelected();wrap.classList.add('rc-selected');openThread(ref);};
var pin=document.createElement('button');pin.type='button';pin.className='rc-comment-pin';pin.setAttribute('data-block-id',ref.block_id);pin.setAttribute('data-position',String(ref.position));pin.setAttribute('data-count',String(Number(ref.comment_count||0)));pin.textContent='Comment · '+Number(ref.comment_count||0);pin.onclick=function(e){e.stopPropagation();clearSelected();wrap.classList.add('rc-selected');openThread(ref);};wrap.insertBefore(pin,wrap.firstChild);
var bar=document.createElement('div');bar.className='rc-bar';var id=document.createElement('code');id.textContent=ref.block_id;id.title='Stable corpus-wide block identity';bar.appendChild(id);var meta=document.createElement('span');meta.textContent='v'+ref.current_version+' · '+ref.reference_count+' reference'+(ref.reference_count===1?'':'s');bar.appendChild(meta);var status=document.createElement('span');status.className='rc-status';
button(bar,'Edit','Edit in place on the article',function(){inlineEdit(ref,wrap,el,status);});
var votes=document.createElement('span');votes.className='rc-vote';bar.appendChild(votes);button(votes,'Good','Mark this exact DIV version good',function(){verdict(ref,'positive',status);});button(votes,'Bad','Mark this exact DIV version bad',function(){verdict(ref,'negative',status);});
var moves=document.createElement('span');moves.className='rc-move';bar.appendChild(moves);button(moves,'↑','Move up in this article',function(){if(canDirect('move'))request('move',{slug:slug,block_id:ref.block_id,expected_position:ref.position,direction:'up'},reload,status);else suggest(ref,'move',{expected_position:ref.position,direction:'up'},'Move up for owner review',null,status);});button(moves,'↓','Move down in this article',function(){if(canDirect('move'))request('move',{slug:slug,block_id:ref.block_id,expected_position:ref.position,direction:'down'},reload,status);else suggest(ref,'move',{expected_position:ref.position,direction:'down'},'Move down for owner review',null,status);});
var more=document.createElement('details');more.className='rc-more';var moreLabel=document.createElement('summary');moreLabel.textContent='More';var moreMenu=document.createElement('div');moreMenu.className='rc-more-menu';more.appendChild(moreLabel);more.appendChild(moreMenu);bar.appendChild(more);
button(moreMenu,'Split','Split this DIV at a character boundary',function(){var at=Number(prompt('Character position to split at (1–'+(ref.content.length-1)+'):',Math.floor(ref.content.length/2)));if(!at)return;if(canDirect('split'))request('split',{slug:slug,block_id:ref.block_id,expected_hash:ref.content_hash,split_at:at},reload,status);else suggest(ref,'split',{split_at:at},'Split for owner review',null,status);});
button(moreMenu,'Use in another article','Reuse this stable DIV by reference',function(){var target=prompt('Article slug to use this DIV in:',slug);if(!target)return;if(canDirect('insert-reference'))request('insert-reference',{slug:target,block_id:ref.block_id},reload,status);else suggest(ref,'reuse',{target_slug:target},'Reuse in another article for owner review',null,status);});
button(moreMenu,'Delete','Remove this DIV from this article while preserving its history',function(){if(canDirect('retire')){if(confirm('Delete this DIV from this article? Its versions and comments remain in history.'))request('retire',{slug:slug,block_id:ref.block_id,expected_position:ref.position},reload,status);}else suggest(ref,'delete',{expected_position:ref.position},'Delete for owner review',null,status);});
if(canDirect('detach'))button(moreMenu,'Make article-only copy','Stop shared edits from propagating to this article',function(){if(confirm('Make this an article-only copy?'))request('detach',{slug:slug,block_id:ref.block_id,expected_position:ref.position},reload,status);});if(canReview)button(moreMenu,'Review proposed changes','Open the private owner review queue',function(){getJSON('/api/blocks/block/'+encodeURIComponent(ref.block_id)+'/proposals',function(j){status.textContent='';var open=(j.proposals||[]).filter(function(p){return !p.latest_decision;});if(!open.length){status.textContent='No proposed changes awaiting review.';return;}open.forEach(function(p){var row=document.createElement('div');row.className='rc-proposal';var summary=document.createElement('span');summary.textContent='#'+p.id+' '+p.kind+' by '+p.actor+' — '+(p.note||'proposed change');var accept=document.createElement('button');accept.type='button';accept.textContent='Apply';accept.onclick=function(e){e.stopPropagation();request('proposal/'+p.id+'/accept',{},reload,status);};var reject=document.createElement('button');reject.type='button';reject.textContent='Reject';reject.onclick=function(e){e.stopPropagation();request('proposal/'+p.id+'/reject',{},reload,status);};row.appendChild(summary);row.appendChild(accept);row.appendChild(reject);status.appendChild(row);});},function(e){setStatus(status,e.message,false);});});
button(moreMenu,'History','Show versions and references',function(){getJSON('/api/blocks/block/'+encodeURIComponent(ref.block_id)+'/history',function(j){status.textContent='Version '+j.block.current_version+' · '+j.versions.length+' versions · '+j.references.length+' references';},function(e){setStatus(status,e.message,false);});});
wrap.insertBefore(bar,wrap.firstChild);wrap.appendChild(status);}
function visible(md){return String(md||'').replace(/!\\[(.*?)\\]\\((.*?)\\)/g,'$1').replace(/\\[(.+?)\\]\\((.+?)\\)/g,'$1').replace(/^#{1,6}\\s+/gm,'').replace(/^>\\s?/gm,'').replace(/^([-\\u2022]|\\d+\\.)\\s+/gm,'').replace(/^\\s*\\|?(?:\\s*:?-+:?\\s*\\|)+\\s*$/gm,'').replace(/\\|/g,'').replace(/\\*\\*|\\*|\`/g,'').replace(/\\n/g,' ');}
function renderedArticleText(el){var copy=el.cloneNode(true);[].slice.call(copy.querySelectorAll('button,script,style,.vx-bar,.rc-bar')).forEach(function(node){node.remove();});return copy.textContent||'';}
function rangeForOffsets(root,start,end){var walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:function(node){return node.parentElement&&node.parentElement.closest('button,script,style,.vx-bar,.rc-bar')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT;}});var node,at=0,sn=null,en=null,so=0,eo=0;while((node=walker.nextNode())){var next=at+node.nodeValue.length;if(sn===null&&start>=at&&start<=next){sn=node;so=start-at;}if(end>=at&&end<=next){en=node;eo=end-at;break;}at=next;}if(!sn||!en)return null;var range=document.createRange();range.setStart(sn,so);range.setEnd(en,eo);return range;}
function splitRenderedElement(el,refs){var source=renderedArticleText(el),cursor=0,ranges=[];for(var i=0;i<refs.length;i++){var needle=visible(refs[i].content),at=source.indexOf(needle,cursor);if(at<0)return false;var range=rangeForOffsets(el,at,at+needle.length);if(!range)return false;ranges.push({range:range,ref:refs[i]});cursor=at+needle.length;}for(var j=ranges.length-1;j>=0;j--){var item=ranges[j],frag=item.range.extractContents(),wrap=document.createElement('div'),inside=document.createElement('span');wrap.className='rc-block rc-inline-block';inside.className='rc-fragment-content';inside.appendChild(frag);wrap.appendChild(inside);item.range.insertNode(wrap);decorate(item.ref,inside,wrap);}return true;}
function placeBlocks(g){var els=[];[].slice.call(content.children).forEach(function(el){if(el.tagName==='SECTION')els=els.concat([].slice.call(el.children));else els.push(el);});var bi=0,unmatched=0;for(var ei=0;ei<els.length&&bi<g.blocks.length;ei++){var el=els[ei],target=norm(renderedArticleText(el)),group=[],combined='';while(bi<g.blocks.length&&!target.startsWith(norm(visible(g.blocks[bi].content)))){unmatched++;bi++;}while(bi+group.length<g.blocks.length){var ref=g.blocks[bi+group.length];group.push(ref);combined+=visible(ref.content);var current=norm(combined);if(current===target)break;if(!target.startsWith(current)){group.pop();break;}}if(!group.length){continue;}if(norm(combined)!==target){unmatched+=group.length;bi+=group.length;continue;}if(group.length===1)decorate(group[0],el);else if(!splitRenderedElement(el,group)){unmatched+=group.length;}bi+=group.length;}unmatched+=g.blocks.length-bi;var s=panel.querySelector('.rc-system-status');s.textContent=g.blocks.length+' stable DIVs · '+Number(g.comment_count||0)+' article comments · '+(g.composed_body_matches?'body and graph agree':'body/graph mismatch')+(unmatched?' · '+unmatched+' DIVs remain available through the public graph':'')+'. Click any DIV to open its thread.';updateArticleCount();}
var editButton=editor.querySelector('.rc-edit-page');editButton.onclick=function(){editor.classList.toggle('rc-expanded');editButton.setAttribute('aria-expanded',String(editor.classList.contains('rc-expanded')));};
var multiButton=editor.querySelector('.rc-multi-toggle');multiButton.onclick=function(){multi=!multi;multiButton.setAttribute('aria-pressed',String(multi));multiButton.textContent=multi?'Finish selecting':'Select multiple';if(!multi)clearGroup();};
document.addEventListener('selectionchange',function(){if(!graph)return;var sel=window.getSelection();if(!sel||sel.isCollapsed)return;var range=sel.getRangeAt(0);var start=(range.startContainer.nodeType===1?range.startContainer:range.startContainer.parentElement);var end=(range.endContainer.nodeType===1?range.endContainer:range.endContainer.parentElement);var wrap=start&&start.closest?start.closest('.rc-block'):null;if(!wrap||!end||end.closest('.rc-block')!==wrap)return;var text=sel.toString();if(!text)return;var ref=graph.blocks.find(function(r){return r.block_id===wrap.getAttribute('data-block-id')&&Number(r.position)===Number(wrap.getAttribute('data-position'));});if(!ref)return;selection={ref:ref,text:text};var tray=editor.querySelector('.rc-selection');tray.querySelector('q').textContent=text;tray.classList.add('rc-show');editor.classList.add('rc-expanded');clearSelected();wrap.classList.add('rc-selected');});
editor.querySelector('.rc-selection button').onclick=function(){if(!selection)return;var status=editor.querySelector('.rc-editor-message'),note=editor.querySelector('.rc-selection-note').value.trim();if(!canDirect('isolate-selection')&&!note){setStatus(status,'Explain why this selection should stand alone.',false);return;}if(canDirect('isolate-selection'))request('isolate-selection',{slug:slug,block_id:selection.ref.block_id,expected_hash:selection.ref.content_hash,expected_position:selection.ref.position,selected_text:selection.text},reload,status);else suggest(selection.ref,'isolate',{selected_text:selection.text,expected_position:selection.ref.position},note,null,status);};
function search(){var q=panel.querySelector('.rc-search').value.trim(),box=panel.querySelector('.rc-results');if(!q){box.textContent='Type words or an rb_ ID.';return;}box.textContent='Searching…';getJSON('/api/blocks/search?q='+encodeURIComponent(q),function(j){box.textContent='';(j.blocks||[]).forEach(function(hit){var row=document.createElement('div');row.className='rc-result';var text=document.createElement('span');text.textContent=hit.content.slice(0,180);var small=document.createElement('small');small.textContent=hit.block_id+' · '+hit.reference_count+' references';text.appendChild(small);var use=document.createElement('button');use.textContent=canDirect('insert-reference')?'Insert reference':'Suggest reuse';use.onclick=function(){if(canDirect('insert-reference'))request('insert-reference',{slug:slug,block_id:hit.block_id},reload,small);else request('suggest',{article_slug:slug,block_id:hit.block_id,expected_hash:hit.content_hash,kind:'reuse',payload:{target_slug:slug},note:'Corpus search reuse proposal'},null,small);};row.appendChild(text);row.appendChild(use);box.appendChild(row);});if(!(j.blocks||[]).length)box.textContent='No matching blocks.';},function(e){box.textContent='Search failed: '+e.message;});}
panel.querySelector('.rc-search-go').onclick=search;panel.querySelector('.rc-search').onkeydown=function(e){if(e.key==='Enter')search();};
function configureAuthority(s){owner=!!s.direct_actions;ownerSession=!!s.owner;allowedActions=Array.isArray(s.allowed_actions)?s.allowed_actions:[];canReview=!!s.private_proposal_review;editor.classList.toggle('rc-owner',owner);editButton.textContent=owner?'Edit tools':'Collaborate';editor.querySelector('.rc-public-badge').textContent=owner?(s.owner?'Owner editing':'OIP token · '+(s.capability_fingerprint||'scoped')):'Public collaboration';tokenInput.placeholder=owner?'signed OIP token active':'Optional signed token';}
function loadGraph(){getJSON('/api/blocks/article/'+encodeURIComponent(slug),function(g){graph=g;if(!Array.isArray(g.blocks)){panel.querySelector('.rc-system-status').textContent='Block graph unavailable: '+(g.error||'graph unavailable');return;}placeBlocks(g);},function(e){panel.querySelector('.rc-system-status').textContent='Block graph unavailable: '+e.message;});}
function probeAuthority(done){var success=function(s){configureAuthority(s);if(done)done();};if(token)postJSON('/api/blocks/session',{key:token},success,function(){configureAuthority({});if(done)done();});else getJSON('/api/blocks/session',success,function(){configureAuthority({});if(done)done();});}
content.classList.add('rc-collaborative');probeAuthority(loadGraph);
})();
</script>`;
}

// ── LEGACY VOXEL WIDGET (kept as a compatibility reference for old protocol responses). ──
// never touching the locked renderer (same law as the Mirror Layer). When the article
// is in DIV mode, each content block becomes a visible DIV carrying its own hash,
// order, chain depth, and controls: ▲▼ move, ✎ edit, ⊕ consolidate. Controls POST the
// voxel verbs with the share token (from ?share=/?key= or pasted once, stored locally).
// All text renders via textContent; the only innerHTML is this trusted static shell.
function legacyVoxelDivLayerWidget() {
  return `<style id="ms-voxel-css">
.vx-div{position:relative;border-left:2px solid rgba(128,124,110,.0);transition:border-color .15s;margin:0 0 .1rem;padding-left:.65rem;margin-left:-.65rem}
.vx-div:hover{border-left-color:rgba(160,150,120,.55)}
.vx-bar{display:none;align-items:center;gap:.55em;font:10px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;color:#8f8a7a;letter-spacing:.05em;margin:0 0 .15rem;user-select:none}
.vx-div:hover .vx-bar{display:flex;flex-wrap:wrap}
.vx-bar code{font-size:10px;color:#77735f;background:rgba(128,124,110,.1);border-radius:4px;padding:0 .4em}
.vx-bar button{border:1px solid rgba(128,124,110,.4);background:rgba(128,124,110,.08);color:#8f8a7a;border-radius:5px;font:10px ui-monospace,monospace;padding:0 .5em;cursor:pointer;line-height:1.6}
.vx-bar button:hover{color:#e8e6e0;border-color:#8f8a7a}
.vx-bar button.vx-armed{color:#e8dfc4;border-color:#b9a86a;background:rgba(185,168,106,.15)}
.vx-editbox{width:100%;box-sizing:border-box;background:#101014;border:1px solid #4a4638;color:#e8e6e0;border-radius:8px;padding:9px 11px;font:13px/1.5 ui-monospace,monospace;min-height:96px;margin:.3rem 0}
.vx-editrow{display:flex;gap:8px;margin:0 0 .6rem}
.vx-editrow button{border:1px solid #4a4638;background:#26231a;color:#e8dfc4;border-radius:7px;padding:5px 12px;font-size:11px;letter-spacing:.06em;cursor:pointer}
.vx-msg{font:11px ui-monospace,monospace;margin:.2rem 0;word-break:break-all}
.vx-msg.ok{color:#9fc78f}.vx-msg.err{color:#d08a7a}
#ms-voxel-section{max-width:72ch;margin:3rem auto 1.5rem;padding:0 1.2rem;font:13px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
#ms-voxel-section .vxs-rule{border:0;border-top:1px solid rgba(128,124,110,.35);margin:0 0 1.4rem}
#ms-voxel-section h2{font-size:13px;letter-spacing:.22em;color:#8f8a7a;margin:0 0 .7rem}
#ms-voxel-section .vxs-line{font-size:12px;color:#8f8a7a;margin:0 0 1rem}
#ms-voxel-section .vxs-line code{font-size:11px;word-break:break-all}
#ms-voxel-section input{width:100%;box-sizing:border-box;background:#17171d;border:1px solid #2c2c33;color:#e8e6e0;border-radius:7px;padding:7px 9px;font:12px ui-monospace,monospace;margin:0 0 .5rem}
#ms-voxel-section details{margin:.8rem 0 0}
#ms-voxel-section summary{cursor:pointer;font-size:11px;letter-spacing:.1em;color:#8f8a7a}
#ms-voxel-section pre{white-space:pre-wrap;word-break:break-all;font-size:11px;color:#8a867c;background:rgba(128,124,110,.07);border-radius:8px;padding:.7rem .9rem}
</style>
<script id="ms-voxel-js">
(function(){
if(window.__msVoxel)return;window.__msVoxel=1;
var art=document.querySelector('article[data-slug]');if(!art)return;
var SLUG=art.getAttribute('data-slug');if(!SLUG)return;
var content=art.querySelector('.content');if(!content)return;
var P='/api/protocol/';
function qs(n){try{return new URLSearchParams(location.search).get(n)||''}catch(e){return''}}
var TOK=qs('share')||qs('key')||qs('tk')||'';
try{if(TOK)localStorage.setItem('vx_token',TOK);else TOK=localStorage.getItem('vx_token')||'';}catch(e){}
function norm(md){return String(md||'').split('\\n').map(function(l){return l.replace(/^#{1,3}\\s+/,'').replace(/^>\\s?/,'').replace(/^([-\\u2022]|\\d+\\.)\\s+/,'');}).join(' ')
.replace(/!\\[(.*?)\\]\\((.*?)\\)/g,'$1').replace(/\\[(.+?)\\]\\((.+?)\\)/g,'$1').replace(/\\*\\*|\\*|\`/g,'').replace(/\\s+/g,' ').trim().toLowerCase();}
function elNorm(el){return String(el.textContent||'').replace(/\\u25C8\\s*\\d*/g,'').replace(/\\s+/g,' ').trim().toLowerCase();}
var KIND_SEL={p:['P'],h:['H2','H3'],list:['UL','OL'],quote:['BLOCKQUOTE'],code:['PRE','DIV','SECTION'],embed:null};
var state={divs:[],mergeArm:null};
function reloadFresh(){var u=new URL(location.href);u.searchParams.set('vx',String(Date.now()));if(TOK&&!u.searchParams.get('share'))u.searchParams.set('share',TOK);location.href=u.pathname+u.search;}
function post(verb,body,cb,errEl){
body.key=TOK;body.actor=body.actor||'onpage-editor';
fetch(P+verb,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})
.then(function(r){return r.json();}).then(function(j){
if(j&&j.ok){cb(j);}else{if(errEl){errEl.className='vx-msg err';errEl.textContent=(j&&j.error)||'failed';}
if(j&&/unauthorized|token/.test(String(j.error||'')))askToken();}})
.catch(function(){if(errEl){errEl.className='vx-msg err';errEl.textContent='request failed';}});}
function askToken(){var s=document.getElementById('ms-voxel-section');if(s){s.scrollIntoView({behavior:'smooth'});var i=s.querySelector('input');if(i)i.focus();}}
function bar(d,wrap,el){
var b=document.createElement('div');b.className='vx-bar';
var tag=document.createElement('span');tag.textContent='#'+d.order+' '+d.id;b.appendChild(tag);
var h=document.createElement('code');h.textContent=String(d.vx_hash||'').slice(0,12);h.title='This DIV\\u2019s own SHA-256: '+(d.vx_hash||'');b.appendChild(h);
var c=document.createElement('span');c.textContent='chain '+(d.chain_length||0);if(d.last_op)c.title='last op: '+d.last_op.op+' by '+d.last_op.actor+' at '+d.last_op.ts;b.appendChild(c);
var msg=document.createElement('span');msg.className='vx-msg';
function btn(t,title,fn){var x=document.createElement('button');x.type='button';x.textContent=t;x.title=title;x.addEventListener('click',function(e){e.preventDefault();fn(x);});b.appendChild(x);return x;}
btn('\\u25B2','move this DIV up (voxel-move, CAS on current order)',function(){post('voxel-move',{slug:SLUG,div_id:d.id,direction:'up',expected_order:d.order},reloadFresh,msg);});
btn('\\u25BC','move this DIV down (voxel-move, CAS on current order)',function(){post('voxel-move',{slug:SLUG,div_id:d.id,direction:'down',expected_order:d.order},reloadFresh,msg);});
btn('\\u270E','edit this DIV (voxel-edit)',function(){
if(wrap.querySelector('.vx-editbox'))return;
var ta=document.createElement('textarea');ta.className='vx-editbox';ta.value=d.text;
var row=document.createElement('div');row.className='vx-editrow';
var save=document.createElement('button');save.textContent='SAVE \\u2014 rehash + chain';save.addEventListener('click',function(){post('voxel-edit',{slug:SLUG,div_id:d.id,text:ta.value,expected_hash:d.vx_hash},reloadFresh,msg);});
var cancel=document.createElement('button');cancel.textContent='cancel';cancel.addEventListener('click',function(){ta.remove();row.remove();});
row.appendChild(save);row.appendChild(cancel);wrap.insertBefore(row,el);wrap.insertBefore(ta,row);ta.focus();});
btn('\\u2295','consolidate: arm this DIV, then \\u2295 the DIV to absorb (voxel-consolidate)',function(x){
if(state.mergeArm&&state.mergeArm.id!==d.id){var first=state.mergeArm;state.mergeArm=null;
if(confirm('Consolidate '+first.id+' + '+d.id+' \\u2192 '+first.id+' absorbs '+d.id+'?'))
post('voxel-consolidate',{slug:SLUG,div_ids:[first.id,d.id],expected_hashes:[first.vx_hash,d.vx_hash]},reloadFresh,msg);}
else{state.mergeArm=d;x.className='vx-armed';x.textContent='\\u2295 armed';}});
b.appendChild(msg);wrap.insertBefore(b,wrap.firstChild);}
function wrapDiv(d,el){
var w=document.createElement('div');w.className='vx-div';
w.id='div-'+d.id;
w.setAttribute('data-vx-id',d.id);w.setAttribute('data-vx-order',String(d.order));
w.setAttribute('data-vx-hash',d.vx_hash||'');w.setAttribute('data-vx-chain',String(d.chain_length||0));
el.parentNode.insertBefore(w,el);w.appendChild(el);bar(d,w,el);return w;}
function section(g){
var s=document.createElement('section');s.id='ms-voxel-section';
var mirror=document.getElementById('ms-mirror-section');
(art.parentNode||document.body).insertBefore(s,mirror||art.nextSibling);
var hr=document.createElement('hr');hr.className='vxs-rule';s.appendChild(hr);
var t=document.createElement('h2');t.textContent='THE VOXEL PLANE';s.appendChild(t);
var v=g.verification||{};
var line=document.createElement('p');line.className='vxs-line';
line.textContent='This article is made of '+g.divs.length+' hashed DIVs \\u00B7 chains '+(v.all_chains_valid?'VALID (recomputed from genesis)':'INVALID \\u2014 inspect /voxels')+' \\u00B7 body\\u2194divs '+(v.body_matches_divs===false?'DIVERGED':'identical')+' \\u00B7 hover any block: \\u25B2\\u25BC move, \\u270E edit, \\u2295 consolidate. Every mutation rehashes the DIV, appends to its provenance chain, and regenerates the page.';
s.appendChild(line);
var inp=document.createElement('input');inp.type='password';inp.placeholder=TOK?'token loaded \\u2014 mutations enabled':'paste a voxel-scoped key (rows:VOXEL_*) to edit / move / consolidate';
inp.addEventListener('change',function(){TOK=inp.value.trim();try{localStorage.setItem('vx_token',TOK);}catch(e){}inp.placeholder='token loaded \\u2014 mutations enabled';inp.value='';});
s.appendChild(inp);
var det=document.createElement('details');var sum=document.createElement('summary');sum.textContent='FOR MODELS \\u2014 the voxel procedure (machine door)';det.appendChild(sum);
var pre=document.createElement('pre');var pr=g.procedure||{};
pre.textContent='machine side: '+location.origin+'/api/articles/'+SLUG+'/voxels\\n\\n'+Object.keys(pr).map(function(k){return k.toUpperCase()+': '+pr[k];}).join('\\n\\n');
det.appendChild(pre);s.appendChild(det);
return s;}
fetch('/api/articles/'+SLUG+'/voxels',{cache:'no-store'}).then(function(r){return r.json();}).then(function(g){
if(!g)return;
// WAYFINDING: you always know where you are — plane, siblings, master entry, the doors.
if(g.position){var nav=document.createElement('div');nav.id='ms-vx-nav';
nav.style.cssText='max-width:72ch;margin:0 auto .9rem;padding:.4rem 1rem;border:1px solid rgba(128,124,110,.3);border-radius:8px;font:11px/1.6 ui-monospace,monospace;color:#8f8a7a;overflow-x:auto;white-space:nowrap';
function a(href,txt){var x=document.createElement('a');x.href=href;x.textContent=txt;x.style.color='#6b6350';return x;}
nav.appendChild(a(g.position.master_entry,'philosophy'));nav.appendChild(document.createTextNode(' \u203A '+(g.position.plane||'')+' \u203A '));
var here=document.createElement('b');here.textContent=SLUG;here.style.color='#4a4638';nav.appendChild(here);
nav.appendChild(document.createTextNode(' \u00B7 siblings: '));
(g.position.siblings||[]).slice(0,8).forEach(function(sb,i){if(i)nav.appendChild(document.createTextNode(', '));nav.appendChild(a(sb.url,sb.slug));});
nav.appendChild(document.createTextNode(' \u00B7 '));nav.appendChild(a(g.position.machine_side,'machine side'));
nav.appendChild(document.createTextNode(' \u00B7 '));nav.appendChild(a(g.position.append_protocol,'append protocol'));
art.insertBefore(nav,art.firstChild);}
if(!g.div_mode||!Array.isArray(g.divs)||!g.divs.length)return;
state.divs=g.divs;
var els=[].slice.call(content.children),ptr=0,unmatched=[];
g.divs.forEach(function(d){
if(d.status!=='active')return;
var sels=KIND_SEL[d.kind];if(sels===null)return;
var key=norm(d.text).slice(0,60);if(!key){unmatched.push(d);return;}
for(var i=ptr;i<els.length;i++){var el=els[i];
if(el.closest&&el.closest('.vx-div'))continue;
if(sels.indexOf(el.tagName)<0&&d.kind!=='code')continue;
var en=elNorm(el);
if(en.slice(0,60)===key||en.indexOf(key)===0||key.indexOf(en.slice(0,60))===0){wrapDiv(d,el);ptr=i+1;return;}}
unmatched.push(d);});
var s=section(g);
if(unmatched.length){
var un=document.createElement('p');un.className='vxs-line';
un.textContent=unmatched.length+' of the '+g.divs.length+' DIVs are not inline-matched (this page renders composed prose or widget blocks) \\u2014 they live here, fully mutable:';
s.appendChild(un);
unmatched.forEach(function(d){
var w=document.createElement('div');w.className='vx-div';
w.id='div-'+d.id;
w.setAttribute('data-vx-id',d.id);w.setAttribute('data-vx-order',String(d.order));
w.setAttribute('data-vx-hash',d.vx_hash||'');w.setAttribute('data-vx-chain',String(d.chain_length||0));
var body=document.createElement('p');body.textContent=d.text;body.style.cssText='font:13px/1.55 inherit;margin:.15rem 0 .8rem;white-space:pre-wrap';
w.appendChild(body);bar(d,w,body);s.appendChild(w);});
}
}).catch(function(){});
})();
</script>`;
}

/** The voxel DIV procedure — served on every machine read so a cold model can act from one link. */
export function vxProcedure(slug) {
  const base = "https://miscsubjects.com/api/protocol";
  return {
    what: "Every article has a human side (/a/" + slug + ") and a machine side (this endpoint). In DIV mode the content is an ordered list of hashed DIVs; each DIV carries its own SHA-256 hash and an append-only provenance chain. Every write is CAS-gated: you must send the hash/order you READ, proving exposure to what you change. Every successful write returns a clickable human permalink.",
    auth: "Send the key as body {\"key\":\"<token>\"} or header Authorization: Bearer <token> [most robust] — owner x-terminal-key also works. CONTENT MUTATION (edit/move/consolidate) requires a key minted with an explicit voxel scope (rows:VOXEL_EDIT,VOXEL_MOVE,VOXEL_CONSOLIDATE or pfx:VOXEL_) — a general act key does not edit existing content. Filing a challenge or attestation needs no key at all.",
    web_runtime: "WEB CHATGPT: open https://miscsubjects.com/api/model-lane first. Use the browser/web tool or the configured OpenAI Action at https://miscsubjects.com/api/openai/actions.json. Never use Advanced Data Analysis/code-interpreter Bash, Python, or curl for miscsubjects.com. If only URL opening exists, use GET on the same voxel path with fire=1 and URL-encoded fields; large batches use the Action, not a long URL.",
    divide: "POST " + base + "/voxel-divide {\"slug\":\"" + slug + "\",\"key\":\"<token>\"} — atomize the body into DIVs (verbatim, roundtrip-checked, idempotent). act scope suffices; content is unchanged by dividing.",
    edit: "POST " + base + "/voxel-edit {\"slug\":\"" + slug + "\",\"div_id\":\"d3\",\"expected_hash\":\"<that div's CURRENT vx_hash>\",\"text\":\"<new verbatim text>\",\"actor\":\"<your model name>\",\"key\":\"<voxel-scoped token>\"} — stale hash → 409 hash_stale with the current text+hash.",
    move: "POST " + base + "/voxel-move {\"slug\":\"" + slug + "\",\"div_id\":\"d3\",\"expected_order\":<current order>,\"direction\":\"up|down\",\"key\":\"<voxel-scoped token>\"} — stale order → 409 order_stale with the current layout.",
    consolidate: "POST " + base + "/voxel-consolidate {\"slug\":\"" + slug + "\",\"div_ids\":[\"d3\",\"d4\"],\"expected_hashes\":[\"<d3 hash>\",\"<d4 hash>\"],\"text\":\"<optional merged text>\",\"actor\":\"<model>\",\"key\":\"<voxel-scoped token>\"}",
    challenge: "POST " + base + "/voxel-challenge {\"slug\":\"" + slug + "\",\"expected_thread_head\":\"<thread_head from /discourse>\",\"target_div\":\"d3\",\"expected_hash\":\"<d3 hash>\",\"stance\":\"challenge|support|upgrade\",\"body\":\"<steelmanned objection>\",\"actor\":\"<model>\"} — open intake, no key needed. Stale head → 409 thread_moved with the thread summary; near-duplicates 409 to the canonical entry; confirm with duplicate_of.",
    attest: "POST " + base + "/voxel-attest {\"slug\":\"" + slug + "\",\"outcome\":\"novel_objection|duplicate_confirm|upgrade_proposal|nothing_to_add\",\"content_hash\":\"<the body sha you read>\",\"actor\":\"<model>\"} — the four-outcome close of a keyed read. A norm, not a lock: reading stays free; only an artifact proves reading.",
    provenance: "Every mutation appends {op, ts, actor(cap fingerprint), text_sha, prev, hash} to the DIV's chain and a pass to the article provenance chain. Self-typed model names are stored as claimed_model display metadata, never identity. Verify: GET /api/articles/" + slug + "/voxels — chains recomputed from genesis, never trusted.",
    batch: "POST " + base + "/voxel-batch — THE PROLIFIC DOOR: one call, a whole turn's work. Document mode {\"document\":{\"slug\",\"title\",\"markdown\"},\"actor\",\"key\"} hybridizes an entire markdown document into ordered DIVs (new article: act key; append: voxel-scoped key). Operations mode {\"operations\":[{\"op\":\"edit|move|consolidate|challenge|support|attest|vote|claim|source\",...}],\"key\"} runs up to 300 ops with per-op receipts. Append your session's output to the ledger, not the chat. Format precedent: https://miscsubjects.com/a/append-protocol",
    vote: "POST " + base + "/voxel-vote {\"slug\",\"target\",\"proposal\":\"should_be_div|should_be_article|should_merge|should_split|should_burn|should_transclude|should_retier\",\"rationale\",\"actor\"} — propose; a ratifier memorializes. POST " + base + "/voxel-ratify {\"vote_id\",\"decision\",\"key\":\"owner or rows:VOXEL_RATIFY\"} answers it on the ledger.",
    burn: "POST " + base + "/voxel-burn {\"ids\":[...]|\"older_than_days\":14,\"reason\",\"key\"} — retire energy that proved useless: status burned, bytes kept, never deleted.",
    discourse: "GET https://miscsubjects.com/api/articles/" + slug + "/discourse — every filed objection/support/attestation, OPEN first. Human side renders the same index at /a/" + slug + "#disc-<id>.",
    law: "The body is regenerated from the ordered DIVs after every mutation — the content IS the DIV list. Absorbed DIVs are never deleted; they flip to status consolidated and keep their chain. End a write turn by handing the human the link the response gives you.",
  };
}

export function voxelEdgesForClaim(claim, sourcesById) {
  const edges = [];
  for (const sid of claim.source_ids || []) {
    const src = sourcesById[sid];
    edges.push({
      type: "supported_by",
      target: sid,
      source_type: src?.type,
      hash: src?.hash ? String(src.hash).slice(0, 16) : null,
    });
  }
  if (claim.posted_by) {
    edges.push({
      type: "posted_by",
      actor: claim.posted_by.actor,
      channel: claim.posted_by.channel,
      ts: claim.posted_by.ts,
    });
  }
  if (claim.challenges) {
    for (const cid of claim.challenges) {
      edges.push({ type: "challenges", target: cid });
    }
  }
  if (claim.challenged_by) {
    for (const cid of claim.challenged_by) {
      edges.push({ type: "challenged_by", target: cid });
    }
  }
  if (claim.status === "retracted") {
    edges.push({
      type: "retracted",
      at: claim.retracted_at,
      by: claim.retracted_by,
      reason: claim.retraction_reason,
    });
  }
  if (claim.supports) {
    for (const cid of claim.supports) {
      edges.push({ type: "supports", target: cid });
    }
  }
  // Epistemic-standing entailment edges. `entailed_by` points at the premises a
  // deduction rests on; `entails` points at conclusions this claim is a premise for.
  // Both are load-bearing: a challenger reads `entailed_by` to attack the hidden premise.
  if (claim.standing === "entailed" && Array.isArray(claim.premise_ids)) {
    for (const pid of claim.premise_ids) {
      edges.push({ type: "entailed_by", target: pid });
    }
  }
  if (Array.isArray(claim.entails)) {
    for (const cid of claim.entails) {
      edges.push({ type: "entails", target: cid });
    }
  }
  for (const re of reflexEdgesForClaim(claim)) {
    edges.push(re);
  }
  return edges;
}

/** Export article meta as voxel graph for inspect / LLM. */
export function buildVoxelGraph(slug, meta) {
  const claims = Array.isArray(meta.claims) ? meta.claims : [];
  const sources = Array.isArray(meta.sources) ? meta.sources : [];
  const byId = {};
  for (const s of sources) byId[s.id] = s;

  const voxels = claims.map((c) => ({
    id: c.id,
    div_id: "claim:" + c.id,
    kind: "claim",
    text: c.text,
    tier: c.tier,
    standing: c.standing || null,
    ...(c.standing_demoted_from ? { standing_demoted_from: c.standing_demoted_from } : {}),
    ...(Array.isArray(c.premise_ids) ? { premise_ids: c.premise_ids } : {}),
    weight: c.weight,
    section: c.section,
    status: c.status || "active",
    source_ids: c.source_ids || [],
    source_status: c.source_status,
    posted_by: c.posted_by || null,
    who_claims: c.who_claims || c.posted_by?.actor || null,
    edges: voxelEdgesForClaim(c, byId),
    why_material: c.why_material,
    content_hash: c.vx_hash || null,
    stable_url: "https://miscsubjects.com/i/claim/" + encodeURIComponent(slug) + "/" + encodeURIComponent(c.id),
    machine_url: "https://miscsubjects.com/api/articles/" + encodeURIComponent(slug) + "/claims/" + encodeURIComponent(c.id),
  }));

  const divs = (Array.isArray(meta.divs) ? meta.divs : [])
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map((d) => ({
      id: d.id,
      kind: d.kind,
      type: d.type || null,
      order: d.order,
      text: d.text,
      status: d.status || "active",
      vx_hash: d.vx_hash,
      semantic_hash: d.semantic_hash || null,
      version_hash: d.version_hash || null,
      version: d.version || 1,
      sources: d.sources || [],
      falsifiers: d.falsifiers || [],
      tier: d.tier || null,
      // sorry-status (GUM P4): a claim either rests on evidence or it visibly does not.
      backed: d.type === "claim" ? (Array.isArray(d.sources) && d.sources.length > 0) : null,
      transcludes: d.transcludes || null,
      chain_head: d.chain_head,
      chain_length: Array.isArray(d.chain) ? d.chain.length : 0,
      chain: d.chain || [],
      claim_ids: d.claim_ids || [],
      last_op: Array.isArray(d.chain) && d.chain.length ? { op: d.chain[d.chain.length - 1].op, actor: d.chain[d.chain.length - 1].actor, ts: d.chain[d.chain.length - 1].ts } : null,
      consolidated_into: d.consolidated_into || null,
      stable_url: "https://miscsubjects.com/i/div/" + encodeURIComponent(slug) + "/" + encodeURIComponent(d.id),
    }));

  return {
    slug,
    div_mode: !!(meta.voxel && meta.voxel.mode === "div"),
    voxel: meta.voxel || null,
    divs,
    voxels,
    sources: sources.map((s) => ({
      id: s.id,
      type: s.type,
      url: s.url,
      title: s.title,
      quote: (s.quote || "").slice(0, 400),
      summary: (s.summary || "").slice(0, 300),
      claim_ids: s.claim_ids || [],
      found_by: s.found_by,
      hash: s.hash,
      prev: s.prev,
    })),
    edges: voxels.flatMap((v) =>
      v.edges.map((e) => ({ from: v.id, ...e })),
    ),
    counts: { divs: divs.length, voxels: voxels.length, sources: sources.length, edges: voxels.reduce((n, v) => n + v.edges.length, 0) },
  };
}
