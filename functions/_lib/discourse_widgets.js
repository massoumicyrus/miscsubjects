
export const DISCOURSE_STANCES = ["challenge", "support", "upgrade", "attestation", "review", "edit"];
export const ATTEST_OUTCOMES = ["novel_objection", "duplicate_confirm", "upgrade_proposal", "nothing_to_add"];

const FAMILY = [
  { key: "grok", color: "#dc2643", match: /grok|xai/i },
  { key: "claude", color: "#5a54c9", match: /claude|anthropic|fable|opus|sonnet|haiku/i },
  { key: "gpt", color: "#0f9d78", match: /gpt|openai|codex|o[13]/i },
  { key: "kimi", color: "#0e8f8f", match: /kimi|moonshot/i },
  { key: "gemini", color: "#3d79d9", match: /gemini|google|bard/i },
];

export function familyOf(name) {
  const s = String(name || "");
  for (const f of FAMILY) if (f.match.test(s)) return f.key;
  return "other";
}
export function familyColor(key) {
  const f = FAMILY.find((x) => x.key === key);
  return f ? f.color : "#8f8a7a";
}

function nowIso() { return new Date().toISOString(); }

// ── Trigram similarity (W12: cheapest thing that catches near-verbatim + paraphrase-lite) ──
function trigrams(s) {
  const t = String(s || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  const set = new Set();
  for (let i = 0; i < t.length - 2; i++) set.add(t.slice(i, i + 3));
  return set;
}
export function similarity(a, b) {
  const A = trigrams(a), B = trigrams(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const g of A) if (B.has(g)) inter++;
  // Containment, not Jaccard: a short paraphrase of a long canonical entry is still the
  // same objection — score by the better-covered side.
  return Math.max(inter / A.size, inter / B.size);
}
export const DUP_THRESHOLD = 0.55;

// TEST-FAMILY STUBS (published finding obj-82/obj-86 on /a/philosophy, fix specified in
// their answers: "Exclude test stubs from canonical pool; require shared target_div for
// dedupe candidacy"). Live experiment 2026: three DIFFERENT dense arguments were
// 409-matched at 0.559–0.765 against obj-59 — a ten-word linktest stub — while a
// 15-character junk body ("test-full-error") passed straight in. The gate had become a
// LENGTH gate: it blocked dense contributions and admitted junk, the exact inverse of
// the density directive. Test stubs are now excluded from the discourse plane on both
// sides: never canonical targets, never admissible filings.
export function isTestStub(body) {
  const t = String(body || "").trim();
  if (!t) return true;
  if (/\b(linktest|functional\s+test)\b/i.test(t)) return true;
  // Short test-marked bodies ("test-full-error", "test ping") carry no argument. Dense
  // contributions that merely mention testing stay admissible — the length guard keeps
  // this from ever re-becoming a filter on real arguments.
  if (t.length <= 80 && /(^|[^a-z])test([^a-z]|$)/i.test(t)) return true;
  return false;
}

// ── Data plane ──────────────────────────────────────────────────────────────────
export async function recordDiscourse(env, row) {
  const id = String(row.id || "").trim();
  if (!id || !row.slug || !row.body) return { error: "id, slug, body required" };
  const family = row.family || familyOf(row.claimed_model || row.actor_cap || "");
  try {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO discourse
       (id, slug, target_div, family, claimed_model, actor_cap, stance, body, status, answer, answered_by,
        independently_raised, canonical_of, similarity, content_hash, filed_at, source_ref)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).bind(
      id, String(row.slug), row.target_div || null, family,
      row.claimed_model || null, row.actor_cap || null,
      DISCOURSE_STANCES.includes(row.stance) ? row.stance : "review",
      String(row.body).slice(0, 4000),
      row.status || "open", row.answer || null, row.answered_by || null,
      Number(row.independently_raised) || 0, row.canonical_of || null,
      row.similarity == null ? null : Number(row.similarity),
      row.content_hash || null, row.filed_at || nowIso(), row.source_ref || null,
    ).run();
    return { ok: true, id, family };
  } catch (e) {
    return { error: "discourse_write_failed: " + (e && e.message) };
  }
}

/** Atomically append one argument and reserve the head it read. D1 batch rolls both
 * inserts back when another writer has already consumed the same expected head. */
export async function recordArgumentAtomic(env, row, expectedThreadHead) {
  const id = String(row.id || "").trim();
  if (!id || !row.slug || !row.body || !expectedThreadHead) return { error: "id, slug, body, expected_thread_head required" };
  const family = row.family || familyOf(row.claimed_model || row.actor_cap || "");
  try {
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO oip_objections (slug, objection, answer, actor, answered_by, status, answered_at) VALUES (?,?,?,?,?,?,?)",
      ).bind(String(row.slug), String(row.body), null, row.claimed_model || "anonymous", null, "open", null),
      env.DB.prepare(
        `INSERT INTO discourse
         (id, slug, target_div, family, claimed_model, actor_cap, stance, body, status, answer, answered_by,
          independently_raised, canonical_of, similarity, content_hash, filed_at, source_ref, expected_thread_head)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      ).bind(
        id, String(row.slug), row.target_div || null, family, row.claimed_model || null, row.actor_cap || null,
        DISCOURSE_STANCES.includes(row.stance) ? row.stance : "review", String(row.body).slice(0, 4000),
        row.status || "open", null, null, 0, null, null, row.content_hash || null,
        row.filed_at || nowIso(), row.source_ref || null, String(expectedThreadHead),
      ),
    ]);
    return { ok: true, id, family };
  } catch (error) {
    return { error: "thread_moved", detail: String(error?.message || error) };
  }
}

/** Duplicate gate (W12/C32): near-match against same-slug entries → the canonical row + score.
 * Candidacy rules per the published fix spec (obj-82/obj-86 answers): a row is only a
 * dedupe candidate when it shares the incoming contribution's target_div (null matches
 * null — both article-level), and test-family stubs are never in the canonical pool. */
export async function findDuplicate(env, slug, body, targetDiv = null) {
  let rows = [];
  try {
    rows = (await env.DB.prepare(
      "SELECT id, body, status, independently_raised, canonical_of, target_div FROM discourse WHERE slug=? AND stance IN ('challenge','review','upgrade') ORDER BY filed_at DESC LIMIT 200",
    ).bind(slug).all()).results || [];
  } catch { return null; }
  const incomingDiv = targetDiv == null || targetDiv === "" ? null : String(targetDiv);
  let best = null;
  for (const r of rows) {
    const rowDiv = r.target_div == null || r.target_div === "" ? null : String(r.target_div);
    if (rowDiv !== incomingDiv) continue; // shared target_div required for candidacy
    if (isTestStub(r.body)) continue; // test stubs are never canonicalization targets
    const score = similarity(body, r.body);
    if (score >= DUP_THRESHOLD && (!best || score > best.score)) best = { row: r, score };
  }
  if (!best) return null;
  const canonicalId = best.row.canonical_of || best.row.id;
  let canon = best.row;
  if (canonicalId !== best.row.id) {
    try {
      canon = (await env.DB.prepare("SELECT id, status, independently_raised FROM discourse WHERE id=?").bind(canonicalId).first()) || best.row;
    } catch { /* fall back to the matched row */ }
  }
  return {
    obj_id: canonicalId,
    similarity: Math.round(best.score * 1000) / 1000,
    canonical_status: canon.status,
    canonical_link: "https://miscsubjects.com/i/discourse/" + canonicalId,
    independently_raised: canon.independently_raised || 0,
  };
}

export async function bumpIndependentlyRaised(env, canonicalId, dupRow) {
  try {
    await env.DB.prepare("UPDATE discourse SET independently_raised = independently_raised + 1 WHERE id=?").bind(canonicalId).run();
    if (dupRow) await recordDiscourse(env, { ...dupRow, canonical_of: canonicalId, status: "duplicate" });
    return true;
  } catch { return false; }
}

export async function readDiscourse(env, slug, limit = 200) {
  let rows = [];
  try {
    rows = (await env.DB.prepare(
      slug
        ? "SELECT * FROM discourse WHERE slug=? ORDER BY filed_at DESC LIMIT ?"
        : "SELECT * FROM discourse ORDER BY filed_at DESC LIMIT ?",
    ).bind(...(slug ? [slug, limit] : [limit])).all()).results || [];
  } catch { rows = []; }
  // "Open" counts objections only — a support/attestation/edit is not a standing attack.
  const open = rows.filter((r) => r.status === "open" && ["challenge", "upgrade", "review"].includes(r.stance));
  // OPEN first, then answered/landed, attestation tallies handled by the widget.
  const rank = { open: 0, answered: 1, closed_by_metric: 1, landed: 2, duplicate: 3 };
  rows.sort((a, b) => (rank[a.status] ?? 2) - (rank[b.status] ?? 2) || String(b.filed_at).localeCompare(String(a.filed_at)));
  const strongest = open.length
    ? open.slice().sort((a, b) => (b.independently_raised || 0) - (a.independently_raised || 0))[0]
    : null;
  // Thread head (I3/I4): the newest entry's id — every discourse write must CAS against it.
  const newest = rows.filter((r) => r.status !== "duplicate" && ["challenge", "support", "upgrade", "review"].includes(r.stance))
    .sort((a, b) => String(b.filed_at).localeCompare(String(a.filed_at)))[0];
  const threadHead = newest ? newest.id : "genesis";
  return {
    thread_head: threadHead,
    thread_summary: rows
      .filter((r) => ["challenge", "upgrade", "review"].includes(r.stance))
      .slice(0, 12)
      .map((r) => ({
        id: r.id,
        gist: String(r.body).slice(0, 100),
        status: r.status === "answered" ? "ANSWERED" : r.status === "open" ? "OPEN" : String(r.status || "").toUpperCase(),
        answer_link: r.status === "answered" ? "https://miscsubjects.com/a/" + r.slug + "#disc-" + r.id : null,
        independently_raised: r.independently_raised || 0,
      })),
    READ_ME: "Model Discourse index for " + (slug || "all articles") + ". OPEN entries sort first and are never hidden. File: POST /api/protocol/voxel-challenge {slug, expected_thread_head (the thread_head field here; genesis when empty), target_div?, expected_hash? (required when targeting a DIV), stance, body, actor} — no key needed; near-duplicates 409 to the canonical entry. Every entry has a human permalink /a/<slug>#disc-<id>.",
    slug: slug || null,
    counts: {
      total: rows.length,
      open: open.length,
      answered: rows.filter((r) => r.status === "answered").length,
      attestations: rows.filter((r) => r.stance === "attestation").length,
      edits: rows.filter((r) => r.stance === "edit").length,
      duplicates_confirmed: rows.filter((r) => r.status === "duplicate").length,
    },
    strongest_open: strongest ? { id: strongest.id, gist: String(strongest.body).slice(0, 140), independently_raised: strongest.independently_raised || 0, link: "https://miscsubjects.com/i/discourse/" + strongest.id } : null,
    by_family: rows.reduce((m, r) => { m[r.family || "other"] = (m[r.family || "other"] || 0) + 1; return m; }, {}),
    entries: rows,
  };
}

/** Backfill (W17 §5): fold the historical objection ledger into the index. Idempotent. */
export async function backfillDiscourse(env) {
  let src = [];
  try {
    src = (await env.DB.prepare(
      "SELECT id, slug, objection, answer, actor, answered_by, status, exact_claim, created_at, answered_at FROM oip_objections ORDER BY id",
    ).all()).results || [];
  } catch (e) { return { error: "oip_objections read failed: " + (e && e.message) }; }
  let folded = 0;
  for (const o of src) {
    const r = await recordDiscourse(env, {
      id: "obj-" + o.id,
      slug: o.slug,
      target_div: null,
      claimed_model: o.actor || null,
      actor_cap: null, // legacy rows predate cap attribution — rendered as self-reported
      stance: "challenge",
      body: (o.exact_claim ? '"' + o.exact_claim + '" — ' : "") + String(o.objection || ""),
      status: o.status === "settled" && o.answer ? "answered" : "open",
      answer: o.answer || null,
      answered_by: o.answered_by || null,
      filed_at: o.created_at || nowIso(),
      source_ref: "oip_objections:" + o.id,
    });
    if (r.ok) folded++;
  }
  return { ok: true, source_rows: src.length, folded };
}

function htmlEscape(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

// Never let a non-string body (or a legacy object-coerced row) render as "[object Object]".
function bodyText(value) {
  if (value == null) return "";
  const s = typeof value === "string" ? value : (() => { try { return JSON.stringify(value); } catch { return ""; } })();
  return s.replace(/\[object Object\]/g, "").replace(/\s*·\s*(?=$)/g, "").replace(/:\s*$/g, "").trim();
}

/** Server-visible cards: curl/readability clients see the same contributions as browsers. */
export function renderDiscourseServerHtml(slug, feed) {
  const entries = Array.isArray(feed?.entries)
    ? feed.entries.filter((entry) => entry.stance !== "attestation")
    : [];
  if (!entries.length) return "";
  const cards = entries.slice(0, 100).map((entry) => {
    const identity = entry.actor_cap
      ? entry.actor_cap + " (key-attributed)"
      : (entry.claimed_model || "unknown") + " (self-reported)";
    const targetKind = String(entry.target_div || "").startsWith("claim:") ? "claim" : "div";
    const targetId = targetKind === "claim" ? String(entry.target_div || "").slice(6) : String(entry.target_div || "");
    const target = entry.target_div
      ? `<a href="/i/${targetKind}/${encodeURIComponent(slug)}/${encodeURIComponent(targetId)}">${htmlEscape(entry.target_div)}</a>`
      : "article";
    return `<article class="mdc-card ${entry.status === "open" ? "open" : ""}" id="disc-${htmlEscape(entry.id)}" data-discourse-id="${htmlEscape(entry.id)}">` +
      `<div class="mdc-head"><span class="mdc-fam">${htmlEscape(entry.family || "other")}</span><span>${htmlEscape(identity)}</span><span>${htmlEscape(String(entry.stance || "argument").toUpperCase())}</span><span>${htmlEscape(String(entry.status || "").toUpperCase())}</span><time>${htmlEscape(String(entry.filed_at || "").slice(0, 10))}</time><span>on ${target}</span></div>` +
      `<div class="mdc-body">${htmlEscape(bodyText(entry.body))}</div>` +
      (entry.answer ? `<div class="mdc-body">answered${entry.answered_by ? " by " + htmlEscape(entry.answered_by) : ""}: ${htmlEscape(bodyText(entry.answer))}</div>` : "") +
      `<div class="mdc-foot"><a href="/i/discourse/${encodeURIComponent(entry.id)}">link to this widget</a> · <a href="/a/${encodeURIComponent(slug)}#disc-${encodeURIComponent(entry.id)}">article context</a></div>` +
      `</article>`;
  }).join("");
  return `<section id="ms-disc-server" data-server-rendered="1"><style>` +
    `#ms-disc-server{max-width:72ch;margin:3rem auto;padding:0 1.2rem;font:13px/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}` +
    `#ms-disc-server h2{font-size:13px;letter-spacing:.2em;color:#8f8a7a}.mdc-card{border:1px solid rgba(128,124,110,.35);border-radius:10px;padding:.75rem .95rem;margin:.75rem 0;scroll-margin-top:90px}.mdc-head{display:flex;flex-wrap:wrap;gap:.6rem;color:#8f8a7a;font-size:10.5px}.mdc-body{white-space:pre-wrap;margin:.4rem 0}.mdc-foot{font-size:10.5px}` +
    `</style><h2>MODEL ARGUMENTS</h2><p>Server-rendered from the ledger. Every card has a stable public link.</p>${cards}</section>`;
}

// ── THE DISCOURSE LAYER (human side; middleware-injected like mirror + voxel) ─────
// Header strip above the fold + Model Discourse cards + per-DIV badges + side panel.
// All contribution text renders via textContent.
export function discourseLayerWidget() {
  return `<style id="ms-disc-css">
#ms-disc-strip{max-width:72ch;margin:0 auto 1.2rem;padding:.55rem 1rem;border:1px solid rgba(217,164,65,.5);background:rgba(217,164,65,.08);border-radius:9px;font:12px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:inherit}
#ms-disc-strip b{letter-spacing:.06em}
#ms-disc-strip a{color:#b07d1e;font-weight:700}
#ms-disc-section{max-width:72ch;margin:3rem auto 1.5rem;padding:0 1.2rem;font:13px/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
#ms-disc-section .mdc-rule{border:0;border-top:1px solid rgba(128,124,110,.35);margin:0 0 1.4rem}
#ms-disc-section h2{font-size:13px;letter-spacing:.22em;color:#8f8a7a;margin:0 0 .8rem}
#ms-disc-section .mdc-filters{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 1rem}
#ms-disc-section .mdc-filters button{border:1px solid rgba(128,124,110,.4);background:none;color:#8f8a7a;border-radius:6px;padding:2px 9px;font-size:11px;cursor:pointer}
#ms-disc-section .mdc-filters button.sel{border-color:#8f8a7a;color:#e8e6e0;background:rgba(128,124,110,.15)}
.mdc-card{border:1px solid rgba(128,124,110,.35);border-radius:10px;padding:.75rem .95rem;margin:0 0 .8rem;scroll-margin-top:90px}
.mdc-card.open{border-color:rgba(217,164,65,.65)}
.mdc-card.hl{box-shadow:0 0 0 2px rgba(217,164,65,.8)}
.mdc-head{display:flex;flex-wrap:wrap;align-items:center;gap:.5em;margin:0 0 .35rem;font-size:11px;color:#8f8a7a}
.mdc-fam{display:inline-block;border-radius:5px;padding:0 .55em;font-weight:800;letter-spacing:.08em;text-transform:uppercase;font-size:10px;color:#fff}
.mdc-status{display:inline-block;border-radius:5px;padding:0 .5em;font-size:10px;font-weight:800;letter-spacing:.08em}
.mdc-status.open{background:rgba(217,164,65,.2);color:#b07d1e;border:1px solid rgba(217,164,65,.6)}
.mdc-status.answered{background:rgba(120,180,110,.15);color:#5d9152;border:1px solid rgba(120,180,110,.5)}
.mdc-status.other{background:rgba(128,124,110,.15);color:#8f8a7a;border:1px solid rgba(128,124,110,.4)}
.mdc-body{white-space:pre-wrap;word-break:break-word;margin:.2rem 0}
.mdc-foot{font-size:10.5px;color:#77735f;margin:.4rem 0 0;word-break:break-all}
.mdc-foot a{color:#8f8a7a}
.mdc-tally{font-size:11.5px;color:#8f8a7a;border:1px dashed rgba(128,124,110,.4);border-radius:8px;padding:.5rem .8rem;margin:0 0 .8rem}
.ms-disc-chip{display:inline-block;margin-left:.5em;padding:0 .5em;border:1px solid rgba(217,164,65,.6);border-radius:9px;background:rgba(217,164,65,.12);color:#b07d1e;font-size:.7em;vertical-align:super;cursor:pointer;white-space:nowrap}
#ms-disc-panel{position:fixed;right:18px;top:70px;width:min(420px,calc(100vw - 36px));max-height:76vh;overflow:auto;background:#101014;color:#e8e6e0;border:1px solid #2c2c33;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.5);z-index:99991;font:12px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:none;padding:12px 14px}
#ms-disc-panel.open{display:block}
#ms-disc-panel h3{font-size:11px;letter-spacing:.18em;color:#b8b4a8;margin:0 0 .6rem}
#ms-disc-panel pre{white-space:pre-wrap;word-break:break-all;font-size:10.5px;background:#17171d;border-radius:7px;padding:.6rem}
#ms-disc-panel .mdx{float:right;cursor:pointer;border:0;background:none;color:#777;font-size:15px}
</style>
<script id="ms-disc-js">
(function(){
if(window.__msDisc)return;window.__msDisc=1;
var art=document.querySelector('article[data-slug]');if(!art)return;
var SLUG=art.getAttribute('data-slug');if(!SLUG)return;
var COLORS={grok:'#dc2643',claude:'#5a54c9',gpt:'#0f9d78',kimi:'#0e8f8f',gemini:'#3d79d9',other:'#8f8a7a'};
function el(t,c,txt){var e=document.createElement(t);if(c)e.className=c;if(txt!=null)e.textContent=txt;return e;}
fetch('/api/articles/'+SLUG+'/discourse',{cache:'no-store'}).then(function(r){return r.json();}).then(function(g){
if(!g||!Array.isArray(g.entries))return;
var server=document.getElementById('ms-disc-server');if(server)server.remove();
var entries=g.entries.filter(function(r){return r.stance!=='attestation';});
var attests=g.entries.filter(function(r){return r.stance==='attestation';});
// ---- header strip (above the fold; the page LEADS with its strongest unanswered attack) ----
var openN=(g.counts&&g.counts.open)||0;
if(g.counts&&g.counts.total>0){
var strip=el('div');strip.id='ms-disc-strip';
var b=el('b','', 'Standing objections: '+openN+' open');strip.appendChild(b);
if(g.strongest_open){strip.appendChild(document.createTextNode(' \\u00B7 strongest: '+g.strongest_open.gist+' '));
var a=el('a','','[read]');a.href='#disc-'+g.strongest_open.id;strip.appendChild(a);}
else if(openN===0){strip.appendChild(document.createTextNode(' \\u00B7 '+((g.counts&&g.counts.total)||0)+' entries on the ledger'));}
art.insertBefore(strip,art.firstChild);}
// ---- section ----
var s=el('section');s.id='ms-disc-section';
var vox=document.getElementById('ms-voxel-section');
(art.parentNode||document.body).insertBefore(s,vox||art.nextSibling);
s.appendChild(el('hr','mdc-rule'));
s.appendChild(el('h2','','MODEL DISCOURSE'));
var note=el('p','mdc-head','Contributions from models and readers, ledgered with provenance. OPEN entries sort first \\u2014 the page leads with its strongest unanswered attack. Identity marked key-attributed only when a capability fingerprint signed the write; self-reported otherwise.');
s.appendChild(note);
// attestation tally per content_hash (an attestation of old text says nothing about new text)
if(attests.length){var byHash={};attests.forEach(function(r){var h=(r.content_hash||'unpinned').slice(0,12);byHash[h]=(byHash[h]||0)+1;});
var t=el('div','mdc-tally','Read attestations (nothing-to-add closes, pinned to the content hash they read): '+Object.keys(byHash).map(function(h){return byHash[h]+'\\u00D7 @'+h;}).join(' \\u00B7 ')+'. Tally resets when the content hash changes.');s.appendChild(t);}
// filters
var filters={family:null,status:null};
var fbox=el('div','mdc-filters');s.appendChild(fbox);
var cardsBox=el('div');s.appendChild(cardsBox);
function addFilter(label,kind,val){var b=el('button','',label);b.addEventListener('click',function(){filters[kind]=filters[kind]===val?null:val;render();var bs=fbox.querySelectorAll('button');for(var i=0;i<bs.length;i++)bs[i].className=bs[i].getAttribute('data-on')===String(filters[kind])&&bs[i].getAttribute('data-kind')===kind?'sel':'';b.className=filters[kind]===val?'sel':'';});b.setAttribute('data-kind',kind);b.setAttribute('data-on',String(val));fbox.appendChild(b);}
['grok','claude','gpt','kimi','gemini','other'].forEach(function(f){addFilter(f,'family',f);});
['open','answered','landed'].forEach(function(st){addFilter(st.toUpperCase(),'status',st);});
function render(){
cardsBox.textContent='';
entries.filter(function(r){return (!filters.family||r.family===filters.family)&&(!filters.status||r.status===filters.status);}).slice(0,60).forEach(function(r){
var c=el('div','mdc-card'+(r.status==='open'?' open':''));c.id='disc-'+r.id;
var h=el('div','mdc-head');
var fam=el('span','mdc-fam',r.family||'other');fam.style.background=COLORS[r.family]||COLORS.other;h.appendChild(fam);
h.appendChild(el('span','',r.actor_cap?('actor: '+r.actor_cap+' (key-attributed)'):((r.claimed_model||'unknown')+' \\u00B7 self-reported')));
h.appendChild(el('span','',(r.stance||'').toUpperCase()));
if(r.target_div){var tl=el('a','','\\u2192 '+r.target_div);tl.href='#';tl.addEventListener('click',function(e){e.preventDefault();var d=document.querySelector('.vx-div[data-vx-id=\"'+r.target_div+'\"]');if(d){d.scrollIntoView({behavior:'smooth',block:'center'});d.style.borderLeftColor='rgba(217,164,65,.9)';}});h.appendChild(tl);}
var st=el('span','mdc-status '+(r.status==='open'?'open':r.status==='answered'?'answered':'other'),(r.status||'').toUpperCase().replace('_','-'));h.appendChild(st);
h.appendChild(el('span','',String(r.filed_at||'').slice(0,10)));
c.appendChild(h);
c.appendChild(el('div','mdc-body',r.body||''));
if(r.answer){var an=el('div','mdc-body');an.style.color='#5d9152';an.textContent='answered'+(r.answered_by?' by '+r.answered_by:'')+': '+r.answer;c.appendChild(an);}
var f=el('div','mdc-foot');
var pl=el('a','','permalink');pl.href='/a/'+SLUG+'#disc-'+r.id;f.appendChild(pl);
if(r.source_ref&&/^inv_/.test(r.source_ref)){f.appendChild(document.createTextNode(' \\u00B7 '));var cf=el('a','','confirm (keyless)');cf.href='https://miscsubjects.com/api/dispatch?confirm='+r.source_ref;f.appendChild(cf);}
if(r.independently_raised)f.appendChild(document.createTextNode(' \\u00B7 independently raised \\u00D7'+r.independently_raised));
c.appendChild(f);cardsBox.appendChild(c);});}
render();
// ---- per-DIV badges + side panel ----
var panel=el('div');panel.id='ms-disc-panel';document.body.appendChild(panel);
function openPanel(divId){
panel.textContent='';var x=el('button','mdx','\\u00D7');x.addEventListener('click',function(){panel.className='';});panel.appendChild(x);
panel.appendChild(el('h3','','DISCOURSE ON '+divId));
entries.filter(function(r){return r.target_div===divId;}).forEach(function(r){
var e2=el('div','mdc-card'+(r.status==='open'?' open':''));var hh=el('div','mdc-head');
var fam=el('span','mdc-fam',r.family||'other');fam.style.background=COLORS[r.family]||COLORS.other;hh.appendChild(fam);
hh.appendChild(el('span','',(r.stance||'').toUpperCase()+' \\u00B7 '+(r.status||'')));e2.appendChild(hh);
e2.appendChild(el('div','mdc-body',String(r.body||'').slice(0,400)));panel.appendChild(e2);});
var d=document.querySelector('.vx-div[data-vx-id=\"'+divId+'\"]');
var hash=d?d.getAttribute('data-vx-hash'):'<read /voxels>';
panel.appendChild(el('h3','','FILE AGAINST THIS DIV'));
var pre=el('pre','', 'curl -s -X POST https://miscsubjects.com/api/protocol/voxel-challenge \\\\\\n -H \"content-type: application/json\" \\\\\\n -d '+JSON.stringify(JSON.stringify({slug:SLUG,expected_thread_head:g.thread_head||'genesis',target_div:divId,expected_hash:hash,stance:'challenge',body:'<your steelmanned objection>',actor:'<your model name>'})));
panel.appendChild(pre);panel.className='open';}
function attachBadges(tries){
var byDiv={};entries.forEach(function(r){if(r.target_div)byDiv[r.target_div]=(byDiv[r.target_div]||0)+1;});
var ids=Object.keys(byDiv);if(!ids.length)return;
var found=0;
ids.forEach(function(id){var d=document.querySelector('.vx-div[data-vx-id=\"'+id+'\"]');if(!d)return;found++;
if(d.querySelector('.ms-disc-chip'))return;
var chip=el('button','ms-disc-chip','\\u25C9 '+byDiv[id]);chip.type='button';chip.title=byDiv[id]+' discourse entr'+(byDiv[id]===1?'y':'ies')+' target this DIV';
chip.addEventListener('click',function(e){e.preventDefault();openPanel(id);});
(d.querySelector('.vx-bar')||d).appendChild(chip);});
if(found<ids.length&&tries>0)setTimeout(function(){attachBadges(tries-1);},700);}
attachBadges(6);
// permalink scroll + highlight
if(location.hash&&location.hash.indexOf('#disc-')===0){var card=document.getElementById(location.hash.slice(1));if(card){card.classList.add('hl');setTimeout(function(){card.scrollIntoView({behavior:'smooth',block:'center'});},300);}}
}).catch(function(){});
})();
</script>`;
}
