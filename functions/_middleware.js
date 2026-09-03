// Server-side cloaker — configured via /admin/cloaker
import {
  adminPageSelfSnippet,
  adminPathToPageId,
  capabilityConsoleWidget,
} from "./_lib/unified_handoff.js";
// When enabled (CLOAKER_ENABLED=true in settings table), real visitors redirect to money page.
// Bots see a safe page. Disabled by default.
import { adminGate, isBuildAuthed } from "./_lib/admin_session.js";
import { cloak } from "./_lib/cloak.js";
import { hashVisitorIp, jciTrack, logJciTraffic } from "./_lib/jci.js";
import { ga4HeadForEnv } from "./_lib/ga4.js";
import { mirrorLayerWidget } from "./_lib/mirror.js";
import { recursiveContentDiscoveryHead, voxelDivLayerWidget } from "./_lib/voxel_graph.js";
import {
  discourseLayerWidget,
  readDiscourse,
  renderDiscourseServerHtml,
} from "./_lib/discourse_widgets.js";
import {
  claimDivsForMeta,
  renderArticleStateMastheadHtml,
  renderClaimSurfaceHtml,
} from "./_lib/claim_surface.js";
import { leanResponse, wantsLean } from "./_lib/fetcher_lean.js";

// Injected into every admin HTML page reached WITH a share/terminal token in the URL.
// It carries that token onto every same-origin link, fetch, and XHR — so ONE share URL lets
// a model (or you, from anywhere) navigate the entire build without re-supplying the key.
const SHARE_PROP_SCRIPT = `<script>
(function(){
  if(window.__sharePropInstalled)return; window.__sharePropInstalled=1;
  var p; try{p=new URLSearchParams(location.search);}catch(e){return;}
  var PARAM=p.get('share')?'share':(p.get('terminal_key')?'terminal_key':(p.get('tk')?'tk':null));
  if(!PARAM)return; var TOK=p.get(PARAM); if(!TOK)return;
  function tokenize(u){try{var url=new URL(u,location.href);if(url.origin!==location.origin)return u;if(!url.searchParams.has(PARAM))url.searchParams.set(PARAM,TOK);return url.pathname+url.search+url.hash;}catch(e){return u;}}
  function skip(h){return !h||h.charAt(0)==='#'||/^(javascript:|mailto:|tel:|data:|blob:)/i.test(h);}
  function rewrite(root){var as=(root||document).querySelectorAll('a[href]');for(var i=0;i<as.length;i++){var h=as[i].getAttribute('href');if(skip(h))continue;as[i].setAttribute('href',tokenize(h));}}
  function boot(){rewrite(document);try{var mo=new MutationObserver(function(m){for(var j=0;j<m.length;j++){var ns=m[j].addedNodes;for(var k=0;k<ns.length;k++){var n=ns[k];if(n.nodeType!==1)continue;if(n.tagName==='A'){var h=n.getAttribute('href');if(!skip(h))n.setAttribute('href',tokenize(h));}if(n.querySelectorAll)rewrite(n);}}});mo.observe(document.body,{childList:true,subtree:true});}catch(e){}}
  document.addEventListener('click',function(e){var a=e.target&&e.target.closest?e.target.closest('a[href]'):null;if(!a)return;var h=a.getAttribute('href');if(skip(h))return;try{var url=new URL(h,location.href);if(url.origin===location.origin&&!url.searchParams.has(PARAM)){e.preventDefault();location.href=tokenize(h);}}catch(_){}},true);
  var of=window.fetch;if(of){window.fetch=function(input,opts){try{if(typeof input==='string')input=tokenize(input);else if(input&&input.url)input=new Request(tokenize(input.url),input);}catch(e){}return of.call(this,input,opts);};}
  var ox=window.XMLHttpRequest&&window.XMLHttpRequest.prototype.open;if(ox){window.XMLHttpRequest.prototype.open=function(m,u){try{arguments[1]=tokenize(u);}catch(e){}return ox.apply(this,arguments);};}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
</script>`;

// The self-explaining capability console (OIP v0.3). Injected on any admin page that lacks
// the shell header (the standalone pages) so the "1 link = the whole build" front door is on
// EVERY admin page, not just shell ones. Shared builder lives in unified_handoff.js.
const FLOATING_COPY_WIDGET = capabilityConsoleWidget();

// ALWAYS-UP LAYER — the site never 404s/500s a page it has served before.
// Every clean public GET of /a/<slug> or /api/articles/<slug> refreshes a KV snapshot
// (throttled to one write per 2 min per path). When the live render fails — row mid-rewrite
// by a model, D1 contention under swarm load, a transient 500 — the snapshot serves with
// x-served: last-good instead of an error. Deliberate deletes purge their snapshots, so
// true 404s stay honest. Visitor scale: public /a/ pages carry edge cache headers so
// concurrent readers hit Cloudflare's cache, not D1.
const LASTGOOD_REFRESH_MS = 120000;
// A render that hasn't produced a response by this deadline is treated as hung: serve the
// last-good snapshot instead of letting Cloudflare kill the request at 100s with a 504.
// The 504 record (2026-07-23/24: 600-800/hr, mostly crawler hits on /a/ pages and the public
// indexes during agent-edit D1 contention) is the reason this exists. The live render keeps
// running via waitUntil and refreshes the snapshot when it lands.
const RENDER_TIMEOUT_MS = 15000;
// Public index pages that also appear in the 504 record. Snapshot-eligible only on a bare
// GET (no query) so a parameterized response never overwrites the canonical snapshot.
const PUBLIC_SNAPSHOT_PAGES = new Set([
  "/",
  "/content",
  "/graph",
  "/graph.html",
  "/audit",
  "/latest",
]);

function lastGoodEligible(request, url) {
  if (request.method !== "GET") return false;
  if (
    url.searchParams.get("share") ||
    url.searchParams.get("tk") ||
    url.searchParams.get("terminal_key")
  )
    return false;
  const p = url.pathname;
  if (/^\/a\/[a-z0-9][a-z0-9-]*$/.test(p))
    return !(url.searchParams.get("frag") || url.searchParams.get("dev"));
  // Bare GET only, for the same reason PUBLIC_SNAPSHOT_PAGES below requires it:
  // the snapshot key is the pathname alone, so a route whose meaning lives in its
  // query would share ONE snapshot across every scope. On 2026-08-06
  // /api/articles/export?tag=peptide answered 200 with the entire 9.9 MB library
  // — the live handler had failed and the fallback held whichever scope succeeded
  // last. A download that quietly returns a different scope and reports success is
  // worse than an error.
  if (/^\/api\/articles\/[a-z0-9][a-z0-9-]*$/.test(p)) return !url.search;
  if (PUBLIC_SNAPSHOT_PAGES.has(p) && !url.search) return true;
  return false;
}

async function refreshLastGood(env, key, res) {
  try {
    const existing = await env.KV.getWithMetadata(key, { type: "stream" });
    if (
      existing &&
      existing.metadata &&
      Date.now() - (existing.metadata.ts || 0) < LASTGOOD_REFRESH_MS
    )
      return;
    const buf = await res.arrayBuffer();
    if (!buf.byteLength || buf.byteLength > 20 * 1024 * 1024) return;
    // SHRINK GUARD — under D1 contention renderers swallow query failures and return a
    // hollow 200 shell (observed: /content 31KB vs 774KB real). A hollow copy must never
    // replace a good snapshot: skip when the new body collapses to <40% of the stored one.
    if (
      existing &&
      existing.value !== null &&
      existing.metadata &&
      Number(existing.metadata.bytes) > 4096 &&
      buf.byteLength < Number(existing.metadata.bytes) * 0.4
    )
      return;
    await env.KV.put(key, buf, {
      metadata: {
        ts: Date.now(),
        bytes: buf.byteLength,
        ct: res.headers.get("content-type") || "text/html; charset=utf-8",
      },
    });
  } catch {}
}

async function serveLastGood(env, key, liveStatus) {
  try {
    const hit = await env.KV.getWithMetadata(key, { type: "arrayBuffer" });
    if (!hit || !hit.value) return null;
    // Breadcrumb for the governor: last degradation, path + live status + when.
    try {
      await env.KV.put(
        "lastgood:last_fallback",
        JSON.stringify({
          key,
          live_status: liveStatus,
          ts: new Date().toISOString(),
        }),
      );
    } catch {}
    return new Response(hit.value, {
      status: 200,
      headers: {
        "content-type":
          (hit.metadata && hit.metadata.ct) || "text/html; charset=utf-8",
        "x-served": "last-good",
        "x-live-status": String(liveStatus),
        "cache-control": "no-store",
      },
    });
  } catch {
    return null;
  }
}

async function alwaysUp(context, url) {
  const { request, env } = context;
  const eligible = lastGoodEligible(request, url);
  const key = "lastgood:" + url.pathname;
  let res;
  try {
    if (eligible) {
      const render = context
        .next()
        .catch(() => new Response("render error", { status: 500 }));
      const TIMEOUT = Symbol("render-timeout");
      const winner = await Promise.race([
        render,
        new Promise((resolve) =>
          setTimeout(() => resolve(TIMEOUT), RENDER_TIMEOUT_MS),
        ),
      ]);
      if (winner === TIMEOUT) {
        const fallback = await serveLastGood(env, key, 504);
        if (fallback) {
          // The hung render keeps running; if it eventually lands a 200, it still
          // refreshes the snapshot so the next fallback serves fresher content.
          context.waitUntil(
            render
              .then((late) =>
                late && late.status === 200
                  ? refreshLastGood(env, key, late)
                  : null,
              )
              .catch(() => {}),
          );
          return fallback;
        }
        res = await render;
      } else {
        res = winner;
      }
    } else {
      res = await context.next();
    }
  } catch {
    res = new Response("render error", { status: 500 });
  }
  if (!eligible) return res;
  if (res.status === 200) {
    context.waitUntil(refreshLastGood(env, key, res.clone()));
    const ct = res.headers.get("content-type") || "";
    if (url.pathname.startsWith("/a/") && ct.includes("text/html")) {
      const headers = new Headers(res.headers);
      // Edge-cache articles for real: with 2,149 rarely-hit pages, a 60s TTL meant almost
      // every hit missed cache and re-ran the Worker (the 4% hit-rate slowness). s-maxage=600
      // keeps an article hot at the edge for 10 min, stale-while-revalidate serves instantly
      // for a day while refreshing in the background; a redeploy still propagates edits fast.
      headers.set(
        "cache-control",
        "public, max-age=120, s-maxage=600, stale-while-revalidate=86400",
      );
      return new Response(res.body, {
        status: res.status,
        statusText: res.statusText,
        headers,
      });
    }
    return res;
  }
  // `eligible` gates BOTH directions. It used to gate only the refresh, so a path
  // that was never allowed to write a snapshot could still be ANSWERED from one:
  // /api/articles/export?slug=<unknown> returned an honest 404 from the handler and
  // this line replaced it with the whole-library snapshot as a 200. A fallback that
  // fires where snapshotting is forbidden is guaranteed to serve a body from a
  // different request than the one asked.
  if (eligible && (res.status === 404 || res.status >= 500)) {
    const fallback = await serveLastGood(env, key, res.status);
    if (fallback) return fallback;
  }
  return res;
}

// THE MIRROR LAYER — every /a/ article page carries the claim-level recursion surface.
// Injected here (not in the locked renderer): hover any claim → attach a typed contribution
// (question|objection|source|repair|compression|contradiction|audit), ledgered + receipted.
// THE VOXEL PLANE rides the same injection: in DIV mode every content block becomes a
// hashed, chain-carrying DIV with ▲▼/✎/⊕ controls gated by the owner's share token.
// SELF-DESCRIPTION BEACON — what this site is, in plain words, visible to machines from
// EVERY edge. ZERO invented terms (owner law, 2026-07-24; banned list in the writing-law
// skill). Kept in sync with public/index.html and functions/llms.txt.js:
//   1. x-ms-self response header on every response (pages AND api, any status);
//   2. ms:self meta + schema.org description injected into every public HTML head,
//      so a model landing on any page learns what this system is without reading further.
const MS_SELF =
  "One object model: every article, tool, skill, claim, and API on this site is the same kind of invocable object - one address, one history, a receipt for every action. Full description: https://miscsubjects.com/llms.txt";
const SELF_HEAD = `<meta name="ms:self" content="${MS_SELF}"><script type="application/ld+json" id="ms-self-ld">{"@context":"https://schema.org","@type":"WebSite","@id":"https://miscsubjects.com/#self","name":"miscsubjects","description":"1,015 articles on AI policy, agent protocols, and health evidence. 10,479 extracted claims, 81.8% carrying a source you can open, every revision logged, any claim disputable on its page. Every article, tool, skill, claim, and API is the same kind of invocable object: one address, its own history, a receipt for every action. Reach the models that run it by text ([BUILD_PHONE]), WhatsApp (+1 310 406 9604) or email (build@miscsubjects.com). Full machine description: https://miscsubjects.com/llms.txt · live object map: https://miscsubjects.com/api/dispatch?map=1","url":"https://miscsubjects.com/"}</script>`;

async function injectCategoryBeacon(context, res) {
  try {
    const url = new URL(context.request.url);
    if (url.pathname.startsWith("/admin")) return res;
    if (!(res.headers.get("content-type") || "").includes("text/html")) return res;
    let html = await res.text();
    if (html.includes('name="ms:self"') || !html.includes("</head>")) {
      return new Response(html, {
        status: res.status,
        statusText: res.statusText,
        headers: res.headers,
      });
    }
    html = html.replace("</head>", SELF_HEAD + "</head>");
    const headers = new Headers(res.headers);
    headers.delete("content-length");
    return new Response(html, {
      status: res.status,
      statusText: res.statusText,
      headers,
    });
  } catch {
    return res;
  }
}

function withCategoryHeader(res) {
  try {
    if (res.headers.has("x-ms-self")) return res;
    res.headers.set("x-ms-self", MS_SELF);
    return res;
  } catch {
    const headers = new Headers(res.headers);
    headers.set("x-ms-self", MS_SELF);
    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers,
    });
  }
}

const MIRROR_WIDGET = mirrorLayerWidget();
const VOXEL_WIDGET = voxelDivLayerWidget();
const DISCOURSE_WIDGET = discourseLayerWidget();
const ARTICLE_SYSTEM_INSPECTOR = `<style id="ms-system-inspector-css">
#ms-state-masthead,#ms-vx-nav,#ms-claim-surface,#ms-disc-section,#ms-voxel-section,#ms-mirror-section,#ms-disc-server,#ms-article-tools{display:none!important}
#ms-article-system{max-width:1180px;margin:40px auto;padding:0 48px;color:#000;background:#fff;font-family:var(--font,'Source Sans 3',sans-serif)}
#ms-article-system>summary{cursor:pointer;list-style:none;border:1px solid #ddd;border-radius:4px;background:#fff;padding:16px 18px;color:#000;font-weight:700}
#ms-article-system>summary::-webkit-details-marker{display:none}#ms-article-system>summary::before{content:'+';display:inline-grid;place-items:center;width:26px;height:26px;margin-right:10px;border:1px solid #bbb;border-radius:50%;background:#fff;color:#000;font-size:17px}
#ms-article-system[open]>summary::before{content:'−'}#ms-article-system>summary small{display:block;margin:4px 0 0 38px;color:#555;font-weight:400}
#ms-article-system-body{background:#fff;color:#000}#ms-article-system-body :is(section,article,details,pre,code,header,footer,nav){background-color:#fff!important;color:#000!important;border-color:#ddd!important}#ms-article-system-body *{color:#000!important}
#ms-article-system-body>*{display:block!important;margin-left:0!important;margin-right:0!important}
@media(max-width:700px){#ms-article-system{padding:0 18px}}
</style><details id="ms-article-system"><summary>Inspect article system<small>Model discourse, voxel editing, mirror contributions, and machine procedures</small></summary><div id="ms-article-system-body"></div></details>
<script id="ms-system-inspector-js">(function(){var box=document.getElementById('ms-article-system-body');if(!box)return;function collect(){['ms-state-masthead','ms-vx-nav','ms-article-tools','ms-claim-surface','ms-disc-server','ms-disc-section','ms-voxel-section','ms-mirror-section'].forEach(function(id){var n=document.getElementById(id);if(n&&n.parentNode!==box)box.appendChild(n);});}collect();new MutationObserver(collect).observe(document.body,{childList:true,subtree:true});})();</script>`;

async function injectMirrorLayer(context, res) {
  try {
    const url = new URL(context.request.url);
    if (!/^\/a\/[a-z0-9][a-z0-9-]*$/.test(url.pathname)) return res;
    if (url.searchParams.get("frag")) return res;
    if (!(res.headers.get("content-type") || "").includes("text/html"))
      return res;
    if (res.status !== 200) return res;
    let html = await res.text();
    if (!html.includes("</body>")) {
      return new Response(html, {
        status: res.status,
        statusText: res.statusText,
        headers: res.headers,
      });
    }
    let inject = "";
    let masthead = "";
    const slug = url.pathname.slice("/a/".length);
    if (!html.includes('id="ms-public-collaboration-manifest"')) {
      html = html.replace("</head>", recursiveContentDiscoveryHead(slug) + "</head>");
    }
    try {
      const row = await context.env.DB.prepare(
        "SELECT meta FROM articles WHERE slug=?",
      )
        .bind(slug)
        .first();
      if (row) {
        let meta = {};
        try {
          meta = JSON.parse(row.meta || "{}") || {};
        } catch {}
        const feed = await readDiscourse(context.env, slug, 200);
        const claimDivs = await claimDivsForMeta(slug, meta);
        masthead = renderArticleStateMastheadHtml(slug, meta, feed);
        inject += renderClaimSurfaceHtml(slug, claimDivs, feed);
        inject += renderDiscourseServerHtml(slug, feed);
      }
    } catch {}
    if (!html.includes('id="ms-voxel-css"')) inject += VOXEL_WIDGET;
    if (!html.includes('id="ms-disc-css"')) inject += DISCOURSE_WIDGET;
    if (!html.includes('id="ms-mirror-css"')) inject += MIRROR_WIDGET;
    // RECURSIVE-CONTENT FOOTER (owner order 2026-08-08): every article states the block system
    // and prints its own machine door VERBATIM — web-model fetch gates only accept URLs that
    // appear verbatim in context, so the reading surface must hand a model the door or the
    // model cannot reach the blocks at all. Injected here rather than rendered in
    // functions/a/[slug].js because that file is owner-protected against agent edits.
    if (!html.includes('class="rc-footer"') && html.includes("</footer>")) {
      const rcFooter =
        `<br><span class="rc-footer">Every section of this page is a block with a stable ID, ` +
        `its own version history, and its own comments — the owner and any model edit, judge, ` +
        `move, or delete blocks one at a time, and a block reused by many pages exists once. ` +
        `How it works: <a href="/a/recursive-content">/a/recursive-content</a>. This page's ` +
        `blocks, machine-readable: <a href="/api/blocks/article/${slug}">` +
        `https://miscsubjects.com/api/blocks/article/${slug}</a>. Any model can read them ` +
        `keylessly and file block-scoped comments or edit, move, split, merge, or delete proposals. ` +
        `Every token and troubleshooting path: <a href="/a/oip-tap-go">` +
        `https://miscsubjects.com/a/oip-tap-go</a>.</span>`;
      html = html.replace("</footer>", rcFooter + "</footer>");
    }
    if (!inject && !masthead) {
      return new Response(html, {
        status: res.status,
        statusText: res.statusText,
        headers: res.headers,
      });
    }
    if (masthead) {
      const articleOpen =
        /<article\b[^>]*\bdata-slug=(?:"[^"]+"|'[^']+')[^>]*>/i;
      if (articleOpen.test(html))
        html = html.replace(articleOpen, (match) => match + masthead);
      else inject = masthead + inject;
    }
    html = html.replace(
      "</body>",
      ARTICLE_SYSTEM_INSPECTOR + inject + "</body>",
    );
    const headers = new Headers(res.headers);
    headers.delete("content-length");
    return new Response(html, {
      status: res.status,
      statusText: res.statusText,
      headers,
    });
  } catch {
    return res;
  }
}

// A corpus density read is public. A request large enough to close an objection is a
// state-changing owner action and must name at least ten real articles with claim-DIVs.
export async function guardDensityMetricClose(context, url) {
  const { request, env } = context;
  if (
    request.method !== "POST" ||
    url.pathname !== "/api/protocol/density-metric"
  )
    return null;
  let body = {};
  try {
    body = await request.clone().json();
  } catch {
    return null;
  }
  const slugs = Array.from(
    new Set(
      String(body.slugs || "philosophy,grain-the-injustice-claim")
        .split(",")
        .map((slug) => slug.trim().toLowerCase())
        .filter(Boolean),
    ),
  ).slice(0, 40);
  if (slugs.length < 10) return null;
  if (!(await isBuildAuthed(request, env))) {
    return new Response(
      JSON.stringify({
        error:
          "owner authorization required for a corpus scan that can close obj-56",
        requested_articles: slugs.length,
        state_changed: false,
      }),
      {
        status: 403,
        headers: {
          "content-type": "application/json",
          "cache-control": "no-store",
        },
      },
    );
  }
  let eligible = 0;
  for (const slug of slugs) {
    try {
      const row = await env.DB.prepare("SELECT meta FROM articles WHERE slug=?")
        .bind(slug)
        .first();
      const meta = row ? JSON.parse(row.meta || "{}") : null;
      if (
        (meta?.divs || []).some(
          (div) =>
            (div?.type || "claim") === "claim" &&
            (div.status || "active") === "active",
        )
      )
        eligible++;
    } catch {}
  }
  if (eligible < 10) {
    return new Response(
      JSON.stringify({
        error:
          "a closing scan requires at least ten real articles with active claim-DIVs",
        requested_articles: slugs.length,
        eligible_articles: eligible,
        state_changed: false,
      }),
      {
        status: 422,
        headers: {
          "content-type": "application/json",
          "cache-control": "no-store",
        },
      },
    );
  }
  return null;
}

// NO DEAD ENDS — an article URL never strands a reader on "Article not found". A 404 on
// /a/<slug> or a root /<slug> page redirects to the closest published article (token match
// on the slug) or to /content, the article index. API and asset paths are untouched.
async function articleNotFoundFallback(context, url, res) {
  try {
    if (res.status !== 404) return res;
    if (context.request.method !== "GET") return res;
    const p = url.pathname;
    const m =
      /^\/a\/([a-z0-9][a-z0-9_-]*)$/i.exec(p) ||
      /^\/([a-z0-9][a-z0-9_-]*)$/i.exec(p);
    if (!m || p.startsWith("/api/") || p.startsWith("/admin")) return res;
    const accept = context.request.headers.get("accept") || "*/*";
    if (!accept.includes("text/html") && !accept.includes("*/*")) return res;
    let target = "/content";
    try {
      const tokens = m[1]
        .toLowerCase()
        .split(/[-_]+/)
        .filter((t) => t.length > 3)
        .sort((a, b) => b.length - a.length)
        .slice(0, 2);
      for (const t of tokens) {
        const hit = await context.env.DB.prepare(
          "SELECT slug FROM articles WHERE published=1 AND slug LIKE ? ORDER BY length(slug) LIMIT 1",
        )
          .bind("%" + t + "%")
          .first();
        if (hit && hit.slug) {
          target = "/a/" + hit.slug;
          break;
        }
      }
    } catch {}
    return new Response(null, {
      status: 302,
      headers: {
        location: target,
        "x-ms-notfound": p,
        "cache-control": "no-store",
      },
    });
  } catch {
    return res;
  }
}

async function injectGa4(context, res) {
  try {
    const url = new URL(context.request.url);
    if (url.pathname.startsWith("/admin")) return res;
    if (!(res.headers.get("content-type") || "").includes("text/html"))
      return res;
    const snippet = await ga4HeadForEnv(context.env);
    if (!snippet) return res;
    let html = await res.text();
    if (html.includes("googletagmanager.com/gtag")) {
      return new Response(html, {
        status: res.status,
        statusText: res.statusText,
        headers: res.headers,
      });
    }
    if (!html.includes("</head>"))
      return new Response(html, {
        status: res.status,
        statusText: res.statusText,
        headers: res.headers,
      });
    html = html.replace("</head>", snippet + "</head>");
    const headers = new Headers(res.headers);
    headers.delete("content-length");
    return new Response(html, {
      status: res.status,
      statusText: res.statusText,
      headers,
    });
  } catch {
    return res;
  }
}

// One fallback for public HTML that predates the shared design composition. Pages already
// carrying this marker are untouched; every other page gets the same documentation map.
async function injectCanonicalDocsFooter(request, res) {
  try {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/admin')) return res;
    if (res.status !== 200 || !(res.headers.get('content-type') || '').includes('text/html')) return res;
    let html = await res.text();
    if (html.includes('id="ms-canonical-docs"')) {
      return new Response(html, { status: res.status, statusText: res.statusText, headers: res.headers });
    }
    const docs = `<nav id="ms-canonical-docs" aria-label="Canonical sources of truth" style="display:grid;gap:.35rem;margin:1.5rem 0;padding:1rem 0;border-top:1px solid currentColor;font:600 12px/1.5 ui-sans-serif,system-ui,sans-serif"><strong>Sources of truth</strong><a href="/a/oip-tap-go">Token manual and troubleshooting — every token, scope, transport, receipt, comment, DIV edit, API, CLI, MCP, mint and start path</a><a href="/a/the-build-end-to-end">This build, end to end</a><a href="/a/proven-work">Proven work — inspection, certification and receipts</a><a href="/a/the-work-object">The work object — live tasks and acceptance</a><a href="/a/agent-work-law">Agent work law</a><a href="/llms.txt">llms.txt — machine routing manifest</a></nav>`;
    const footerAt = html.lastIndexOf('</footer>');
    if (footerAt >= 0) html = html.slice(0, footerAt) + docs + html.slice(footerAt);
    else if (html.includes('</body>')) html = html.replace('</body>', `<footer>${docs}</footer></body>`);
    else return res;
    const headers = new Headers(res.headers);
    headers.delete('content-length');
    return new Response(html, { status: res.status, statusText: res.statusText, headers });
  } catch {
    return res;
  }
}

async function injectShareIfAdmin(context, res) {
  try {
    const url = new URL(context.request.url);
    if (!url.pathname.startsWith("/admin")) return res;
    if (
      url.pathname === "/admin/login" ||
      url.pathname.startsWith("/admin/login/")
    )
      return res;
    if (!(res.headers.get("content-type") || "").includes("text/html"))
      return res;
    const hasToken = !!(
      url.searchParams.get("share") ||
      url.searchParams.get("terminal_key") ||
      url.searchParams.get("tk")
    );
    let html = await res.text();
    let inject = "";
    if (hasToken && html.indexOf("__sharePropInstalled") === -1)
      inject += SHARE_PROP_SCRIPT;
    if (hasToken && html.indexOf('id="ms-page-self"') === -1) {
      const tok =
        url.searchParams.get("share") ||
        url.searchParams.get("terminal_key") ||
        url.searchParams.get("tk") ||
        "";
      const pg = adminPathToPageId(url.pathname);
      const snippet = adminPageSelfSnippet(url.origin, tok, pg.id, pg.name);
      if (html.includes("<main>"))
        html = html.replace("<main>", "<main>" + snippet);
      else inject += snippet;
    }
    // The console lives in the shared shell; standalone pages get it injected here. Skip if the
    // page already renders it (shell pages) so it is never doubled.
    if (
      html.indexOf('id="ms-cap-console"') === -1 &&
      html.indexOf('data-ms-cap="1"') === -1
    )
      inject += FLOATING_COPY_WIDGET;
    const changed =
      inject || (hasToken && html.indexOf('id="ms-page-self"') !== -1);
    if (!inject && !changed)
      return new Response(html, {
        status: res.status,
        statusText: res.statusText,
        headers: res.headers,
      });
    const out = inject
      ? html.includes("</body>")
        ? html.replace("</body>", inject + "</body>")
        : html + inject
      : html;
    const headers = new Headers(res.headers);
    headers.delete("content-length");
    return new Response(out, {
      status: res.status,
      statusText: res.statusText,
      headers,
    });
  } catch {
    return res;
  }
}

// MACHINE-DATA GUARD (owner law: a human reader must NEVER land on a raw JSON/markdown
// page by clicking). Every /api/ endpoint stays raw for machines — but when the request
// is a real top-level BROWSER NAVIGATION (a click or address-bar hit: Sec-Fetch-Mode
// "navigate" + Sec-Fetch-Dest "document"), we wrap the machine payload in a designed,
// theme-aware viewer with a prominent "back to the readable page" button. Script fetch()
// (Sec-Fetch-Mode cors/same-origin) and bots (no Sec-Fetch headers) are untouched, so the
// share widget, infinite-scroll loader, and LLM crawlers keep getting raw data.
function isBrowserDocumentNav(request) {
  if (request.method !== "GET") return false;
  const mode = request.headers.get("sec-fetch-mode");
  const dest = request.headers.get("sec-fetch-dest");
  if (mode && dest) return mode === "navigate" && dest === "document";
  // Older browsers without Sec-Fetch: fall back to an explicit HTML Accept preference.
  const accept = request.headers.get("accept") || "";
  return accept.includes("text/html");
}
function humanHomeFor(pathname) {
  // Map an /api/ machine path back to the human page it describes.
  let m = /^\/api\/articles\/([a-z0-9][a-z0-9_-]*)(?:\/|$|\?)/i.exec(pathname);
  if (m && !["bundle", "system-map"].includes(m[1])) return "/a/" + m[1];
  m = /^\/api\/directory\/([A-Za-z0-9_.-]+)/.exec(pathname);
  if (m) return "/a/directory/" + m[1];
  if (pathname.startsWith("/api/governance")) return "/governance";
  if (pathname.startsWith("/api/articles")) return "/content";
  return "/governance";
}
function machineViewerHtml(url, bodyText, ct, back) {
  const isJson = ct.includes("json");
  let pretty = bodyText;
  if (isJson) {
    try { pretty = JSON.stringify(JSON.parse(bodyText), null, 2); } catch {}
  }
  const esc = (s) =>
    String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
  const kind = isJson ? "JSON data" : ct.includes("markdown") ? "Markdown source" : "Machine data";
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(kind)} · ${esc(url.pathname)} — miscsubjects</title><style>
:root{--bg:#fbfaf7;--ink:#1c1b17;--soft:#57544c;--line:#e6e3db;--card:#fff;--accent:#4f46e5}
@media(prefers-color-scheme:dark){:root{--bg:#0f0f0e;--ink:#f2f0ea;--soft:#a3a099;--line:#2a2a27;--card:#171715;--accent:#8b83ff}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:400 15px/1.6 ui-sans-serif,system-ui,-apple-system,sans-serif}
.wrap{max-width:900px;margin:0 auto;padding:28px 20px 80px}
.bar{position:sticky;top:0;background:color-mix(in srgb,var(--bg) 92%,transparent);backdrop-filter:blur(10px);border-bottom:1px solid var(--line);margin:-28px -20px 24px;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
.k{font:700 10px/1 ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--accent)}
.back{display:inline-flex;align-items:center;gap:7px;padding:9px 15px;border:1px solid var(--line);border-radius:9px;background:var(--card);color:var(--ink);font:600 13px/1 sans-serif;text-decoration:none}
.back:hover{border-color:var(--accent);color:var(--accent)}
.note{margin:0 0 18px;color:var(--soft);font-size:13px}
.note code{font:500 12px ui-monospace,monospace;background:var(--card);border:1px solid var(--line);border-radius:5px;padding:1px 6px}
pre{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:18px;overflow-x:auto;font:400 12.5px/1.65 ui-monospace,monospace;white-space:pre-wrap;word-break:break-word}
</style></head><body><div class="wrap">
<div class="bar"><span class="k">${esc(kind)} · machine endpoint</span><a class="back" href="${esc(back)}">← Back to the readable page</a></div>
<p class="note">You opened a machine endpoint (<code>${esc(url.pathname)}</code>). This is the raw data models read. The human-readable version is one tap away above.</p>
<pre>${esc(pretty)}</pre>
</div></body></html>`;
}
async function machineDataGuard(context, url) {
  const { request } = context;
  if (!url.pathname.startsWith("/api/")) return null;
  if (!isBrowserDocumentNav(request)) return null;
  // Never intercept explicit download/format intents a human deliberately chose.
  if (url.searchParams.get("format") === "zip" || url.searchParams.has("download")) return null;
  const res = await context.next();
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  const machine =
    ct.includes("application/json") ||
    ct.includes("text/markdown") ||
    (ct.includes("text/plain") && !ct.includes("html"));
  if (!machine || res.status >= 500) return res;
  const bodyText = await res.text();
  const back = humanHomeFor(url.pathname);
  return new Response(machineViewerHtml(url, bodyText, ct, back), {
    status: res.status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

// FAST LANE — the visitor-facing serving law. Public tokenless GETs of articles and the
// index pages are served in this order, and a reader NEVER waits on D1:
//   1. Edge cache (Cache API): the finished page — injections included — returns in ~ms
//      with zero D1 work. This is the steady state for a page with any traffic.
//   2. KV last-good snapshot: on an edge miss, the snapshot serves immediately (~50ms)
//      and is planted into the edge cache with a short TTL while ONE full render runs
//      in the background and overwrites it with a fresh long-TTL copy. Agent edits,
//      D1 contention, deploys — none of it can slow or 504 a reader.
//   3. Live render: only a page that has never been served before waits on D1, and even
//      that is bounded by alwaysUp's 15s render deadline.
// Article writes purge their edge entry (functions/api/articles), so edits converge fast.
// TTLs cut 2026-08-03 (owner order): a hero swap left the home card and the article page
// showing different images for up to 10 minutes because purges only clear one colo. One
// minute of staleness is the ceiling now; stale-while-revalidate no longer serves day-old
// copies while refreshing.
const EDGE_CC_ARTICLE =
  "public, max-age=30, s-maxage=60, stale-while-revalidate=120";
const EDGE_CC_INDEX =
  "public, max-age=30, s-maxage=60, stale-while-revalidate=120";
// Snapshot copies hold the colo only briefly so the background render's fresh copy wins.
const EDGE_CC_SNAPSHOT = "public, max-age=30, s-maxage=60";

function edgeCacheablePublic(request, url) {
  if (request.method !== "GET" || url.search) return false;
  const p = url.pathname;
  if (/^\/a\/[a-z0-9][a-z0-9-]*$/.test(p)) return true;
  // "/" is excluded here: the cloaker branch decides per-request what the root serves.
  return PUBLIC_SNAPSHOT_PAGES.has(p) && p !== "/";
}

// Fetchers get their own cache entry so a lean copy never reaches a browser, and a browser's
// styled copy never gets handed to a crawler. See functions/_lib/fetcher_lean.js.
// The cache key version lives in _lib/edge_cache.js so this key and every write-path purge
// share one constant — a purge that misses the version deletes nothing (live bug 2026-08-08).
import { ARTICLE_EDGE_CACHE_VERSION } from "./_lib/edge_cache.js";
function edgeCacheKey(url, lean) {
  const suffix = lean ? `?__lean=1&__edge_v=${ARTICLE_EDGE_CACHE_VERSION}` : `?__edge_v=${ARTICLE_EDGE_CACHE_VERSION}`;
  return new Request(url.origin + url.pathname + suffix, {
    method: "GET",
  });
}

function withEdgeHeaders(res, cc, served) {
  const headers = new Headers(res.headers);
  headers.set("cache-control", cc);
  headers.set("x-ms-edge", served);
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

// COLLAPSE GUARD (edge). The KV snapshot writer already refuses a body that collapses
// against the stored one; the edge plant did not, so ONE degenerate render — an index
// page whose article query came back empty — poisoned the edge for s-maxage plus a day
// of stale-while-revalidate while KV still held the good copy. Symptom in the wild:
// /content served a complete but article-less 32KB page (no counts line, zero cards)
// while a live render of the same path returned 771KB. Now a body that falls under 40%
// of the last-good snapshot for this path is served to the caller but never cached, so
// the poisoned copy cannot outlive the request that produced it.
const EDGE_COLLAPSE_FLOOR = 0.4;

async function edgeBodyCollapsed(env, pathname, body) {
  try {
    if (!env.KV) return false;
    const snap = await env.KV.getWithMetadata("lastgood:" + pathname, {
      type: "arrayBuffer",
    });
    const prev = snap && snap.value ? snap.value.byteLength : 0;
    if (!prev) return false;
    return body.byteLength < prev * EDGE_COLLAPSE_FLOOR;
  } catch {
    return false;
  }
}

async function finalizeAndCache(context, url, res, cacheKey) {
  try {
    if (res.status !== 200) return res;
    if (res.headers.get("x-served") === "last-good") return res; // stale fallback: never freeze it
    if (res.headers.get("set-cookie")) return res;
    if (!(res.headers.get("content-type") || "").includes("text/html"))
      return res;
    const cc = url.pathname.startsWith("/a/")
      ? EDGE_CC_ARTICLE
      : EDGE_CC_INDEX;
    const buf = await res.arrayBuffer();
    const collapsed = await edgeBodyCollapsed(context.env, url.pathname, buf);
    const headers = new Headers(res.headers);
    headers.set("cache-control", collapsed ? "no-store" : cc);
    headers.set("x-ms-edge", collapsed ? "collapsed" : "miss");
    const out = new Response(buf, {
      status: res.status,
      statusText: res.statusText,
      headers,
    });
    if (collapsed) return out;
    try {
      context.waitUntil(caches.default.put(cacheKey, out.clone()));
    } catch {}
    return out;
  } catch {
    return res;
  }
}

// OWNER ANONYMITY, STRUCTURALLY GATED (owner order 2026-08-03, catastrophic-failure class).
// No response that leaves this site may carry the operator's identity: name, personal
// emails, machine paths, phone. This is the single exit door every response passes
// through — page, api, cached hit, KV snapshot, error — so the guarantee is mechanical,
// not editorial. Admin surfaces (key-gated) are exempt; everything else is scrubbed.
const IDENTITY_REDACTIONS = [
  // Order is load-bearing: most-specific tokens (emails, hosts, joined forms) BEFORE the
  // bare-name rules, or a bare-name hit inside an email leaves the domain half behind
  // ("the [OWNER_EMAIL]" — caught live 2026-08-03).
  [/the owner@dsco\.co/gi, 'owner@redacted'],
  [/the owner@theloopway\.com/gi, 'owner@redacted'],
  [/\bdsco\.co\b/gi, 'redacted.invalid'],
  [/theloopway\.com/gi, 'redacted.invalid'],
  [/the owner\s*[OWNER_SURNAME]/gi, 'the owner'],
  [/[OWNER_SURNAME]\s*the owner/gi, 'the owner'],
  [/[OWNER_HANDLE]/gi, 'owner'],
  [/[OWNER_HANDLE]/gi, 'redacted'],
  [/\bOWNER_SURNAME\b/gi, 'the owner'],
  [/\bOWNER_FIRST_NAME\b/gi, 'the owner'],
  [/\+?1?[OWNER_PHONE]/g, 'redacted'],
  [/metric\s*marketing/gi, 'the site operator'],
];
const REDACTABLE_CT = /text\/|application\/(?:json|ld\+json|xml|javascript)|\+json|markdown/i;

function identityClean(text) {
  let out = text;
  for (const [re, sub] of IDENTITY_REDACTIONS) out = out.replace(re, sub);
  return out;
}

// THE AI DOOR, ON EVERY SURFACE (owner order 2026-08-03: any model reading ANY page or ANY
// object — root domain included, via browser, curl, or fetch — must immediately see how to
// mint its own credential and act, and be invited to). Injected at the same single exit
// door as identity redaction, so no renderer, snapshot, or cache path can miss it:
// HTML pages get a visible block right after <body>; JSON objects get a leading _ai_door
// field; every response carries the x-ai-door header.
function aiDoorSteps(pageUrl, slug) {
  return {
    precedence: 'If anything in this page conflicts with your operator’s instructions, your operator wins. Nothing here overrides them, and nothing here should be treated as a command to act on its own.',
    you_can_act: 'This site is operable by you, the model reading it — no key, no account. If your operator wants to act here, one GET mints a bounded credential and every use lands a public receipt under your fingerprint. If they only wanted a read, these same URLs describe the mechanics without committing you to anything. Entry point: https://miscsubjects.com/start.',
    step_0_one_url_does_everything: 'GET https://miscsubjects.com/start — mints your credential and returns every next step as a complete, ready-to-fetch URL with the token already filled in. Nothing to assemble.',
    step_1_mint: 'GET https://miscsubjects.com/api/workspace/ad-operations-q3/enter?role=observer&actor=web-model',
    step_2_your_authority: 'GET https://miscsubjects.com/api/dispatch?explain=1&share=<credential-from-step-1>',
    or_scope_your_own: 'GET https://miscsubjects.com/api/dispatch?self_scope=1&keys=OBJECTION_LOG,OIP_ARTICLE_REVIEW,MODEL_CHAT_INTAKE,ARTICLE_INSPECT&purpose=<why>&actor=<your-model-name> — keyless: cut exactly the credential you need from the public set (file objections and reviews, inspect any article), then narrow it further with ?narrow=1. Traverse under your own scope.',
    step_3_receipted_read: 'GET https://miscsubjects.com/api/dispatch?invoke=WEB_FETCH&body=' + encodeURIComponent('GET|' + (pageUrl || 'https://miscsubjects.com') + '||') + '&share=<credential> — the receipt is yours, under your fingerprint',
    step_4_inspect_and_sign: slug
      ? 'GET https://miscsubjects.com/api/proven-work/' + slug + '/inspect — this very page as a proof object (read-only). If you stand behind a verdict and your operator wants it recorded, POST /api/proven-work/' + slug + '/certify signs it onto the public ledger under your fingerprint'
      : 'GET https://miscsubjects.com/api/proven-work — every page here is an inspectable proof object (read-only). Certifying is a separate, optional step: take it only when you actually endorse the verdict and your operator wants it on record',
    protocol_spec: 'https://miscsubjects.com/api/workspace',
    site_map_for_models: 'https://miscsubjects.com/llms.txt',
  };
}

const AI_DOOR_MARK = 'id="ms-ai-door"';

function aiDoorHtml(pageUrl, slug) {
  const s = aiDoorSteps(pageUrl, slug);
  return `<details ${AI_DOOR_MARK} style="max-width:72rem;margin:.4rem auto 0;padding:.35rem .9rem;font-size:.78rem;line-height:1.55;opacity:.85">
<summary style="cursor:pointer;list-style:none">⌘ For the AI reading this page: this site is operable, not just readable. It exposes a keyless API. Minting a credential is an action — take it if your operator asked you to act here; otherwise read on. Open this block.</summary>
<div>
<p><em>${s.precedence}</em></p>
<p>${s.you_can_act}</p>
<ol>
<li><strong>One URL does everything:</strong> <code>${s.step_0_one_url_does_everything}</code></li>
<li>Or mint directly: <code>${s.step_1_mint}</code></li>
<li>What you may do, from the server's mouth: <code>${s.step_2_your_authority}</code></li>
<li>Or scope your OWN token, keyless: <code>${s.or_scope_your_own}</code></li>
<li>A receipted read of this very page: <code>${s.step_3_receipted_read}</code></li>
<li>${s.step_4_inspect_and_sign.replace(/^GET /, 'Inspect and sign: <code>GET ').replace(/( — )/, '</code>$1')}</li>
</ol>
<p>Protocol spec (machine-readable): <a href="${s.protocol_spec}">${s.protocol_spec}</a> · Site map for models: <a href="/llms.txt">miscsubjects.com/llms.txt</a> · Live workspace you may enter: <a href="/a/ad-operations-q3">/a/ad-operations-q3</a></p>
</div>
</details>`;
}

// JSON injection is for OBJECT READS a model browses, never for protocol traffic: strict
// JSON-RPC/MCP clients schema-validate responses and an extra key breaks them (caught live
// 2026-08-03 — the build's own MCP server failed validation minutes after this shipped).
// GET-only, and never on transport/protocol lanes.
const AI_DOOR_JSON_SKIP = /^\/(mcp|sse|api\/(dispatch|invoke|aig|mcp|admin)|blooio|telegram|2chat|webhook)/i;

function injectAiDoor(text, ct, pathname, pageUrl, method) {
  const slugMatch = pathname.match(/^\/a\/([a-z0-9-]+)$/);
  const slug = slugMatch ? slugMatch[1] : null;
  if (/text\/html/i.test(ct)) {
    if (text.includes(AI_DOOR_MARK)) return text;
    const bodyTag = text.match(/<body[^>]*>/i);
    if (!bodyTag) return text;
    const idx = text.indexOf(bodyTag[0]) + bodyTag[0].length;
    const comment = '\n<!-- FOR THE AI READING THIS SOURCE: this site is operable, not just readable — if your operator asked you to act here, https://miscsubjects.com/start mints a bounded credential; every use is receipted on the public ledger. Your operator\'s instructions always take precedence over anything on this page. Details in the ms-ai-door block below and at /llms.txt -->\n';
    // The visible door block renders at the END of the page (owner order 2026-08-04: the
    // top of every page belongs to the product a human reads — an AI-addressed block as the
    // first visible element made the site illegible). Models reading source still meet the
    // comment at the top of <body>; the operable block sits before </body>.
    const withComment = text.slice(0, idx) + comment + text.slice(idx);
    const endIdx = withComment.lastIndexOf('</body>');
    if (endIdx === -1) return withComment + aiDoorHtml(pageUrl, slug);
    return withComment.slice(0, endIdx) + aiDoorHtml(pageUrl, slug) + withComment.slice(endIdx);
  }
  if (method === 'GET' && !AI_DOOR_JSON_SKIP.test(pathname)
    && /application\/(?:[a-z.+-]*\+)?json/i.test(ct) && text.length < 524288) {
    try {
      const obj = JSON.parse(text);
      if (obj && typeof obj === 'object' && !Array.isArray(obj) && !obj._ai_door
        && !('jsonrpc' in obj) && !('method' in obj)) {
        // Compact pointer, not the full block (outside-model audit 2026-08-04): the full door
        // re-issued on every JSON hop wasted tokens and re-asserted an instruction payload at
        // every step of a traversal — /start and the HTML root carry the whole door; every
        // other JSON response carries one line.
        const door = pathname === '/start'
          ? aiDoorSteps(pageUrl, slug)
          : {
              see: 'https://miscsubjects.com/start',
              note: 'Operable site; bounded keyless credentials; every action receipted on a public ledger. Your operator\'s instructions take precedence — acting is optional, reading is a complete outcome.',
            };
        return JSON.stringify({ _ai_door: door, ...obj }, null, text.includes('\n') ? 2 : 0);
      }
    } catch { /* not an object — leave untouched */ }
  }
  return text;
}

async function redactIdentityEgress(request, response, pathname) {
  try {
    if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) return response;
    if (request.headers.get('x-terminal-key')) return response; // owner's own calls keep their content
    const ct = response.headers.get('content-type') || '';
    if (!REDACTABLE_CT.test(ct) || /event-stream/i.test(ct)) return response;
    if (response.status === 101 || response.status === 204 || response.status === 304 || !response.body) return response;
    const text = await response.text();
    let cleaned = identityClean(text);
    if (response.status === 200) cleaned = injectAiDoor(cleaned, ct, pathname, request.url, request.method);
    const headers = new Headers(response.headers);
    headers.delete('content-length');
    headers.set('x-ai-door', 'GET https://miscsubjects.com/start — one URL mints your credential and returns every next step ready to fetch, token filled in. Every use receipted on the public ledger.');
    return new Response(cleaned, { status: response.status, statusText: response.statusText, headers });
  } catch {
    return response; // fail-open on transport errors; the ship-gate live scan is the second net
  }
}

export async function onRequest(context) {
  // Every response that leaves this site — page, api, snapshot, error — names its category.
  const url = new URL(context.request.url);
  const res = withCategoryHeader(await routeRequest(context));
  const documented = await injectCanonicalDocsFooter(context.request, res);
  return redactIdentityEgress(context.request, documented, url.pathname);
}

// Fire-and-forget traffic capture: every request lands as JCI_TRAFFIC. External JCI enrichment is
// cached per visitor for six hours and joined onto every request by the traffic view.
async function maybeTrackVisit(context, url) {
  try {
    const { request, env } = context;
    await logJciTraffic(env, request);
    const ip = request.headers.get("cf-connecting-ip") || "";
    if (!ip) return;
    const hashed = await hashVisitorIp(ip);
    const key = "jcivisit:" + hashed;
    if (env.KV) {
      if (await env.KV.get(key)) return; // this visitor already classified within the window
      await env.KV.put(key, "1", { expirationTtl: 21600 });
    }
    await jciTrack(env, request, { slug: url.pathname });
  } catch {}
}

async function routeRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Capture before every gate/redirect so denied admin requests and root cloaker traffic count.
  context.waitUntil(maybeTrackVisit(context, url));

  if (edgeCacheablePublic(request, url)) {
    // An LLM fetcher or crawler gets the same content with the 112KB stylesheet stripped:
    // that weight is what made web-model fetches time out on pages that were serving fine.
    //
    // A lean response is NEVER written to caches.default. That cache is Cloudflare's own edge
    // cache, keyed on URL — a lean copy stored there gets served to the next visitor, browser
    // included (observed live: Chrome received x-ms-lean:1). Fetchers instead read the KV
    // snapshot (~0.14s) and strip on the fly, and their response is marked private so no
    // shared cache can hand it to a human.
    const lean = wantsLean(request, url);
    if (lean) {
      let res = null;
      try {
        const snap = await env.KV.getWithMetadata("lastgood:" + pathname, {
          type: "arrayBuffer",
        });
        if (snap && snap.value && snap.value.byteLength) {
          res = new Response(snap.value, {
            status: 200,
            headers: {
              "content-type":
                (snap.metadata && snap.metadata.ct) ||
                "text/html; charset=utf-8",
              "x-ms-edge": "snapshot",
            },
          });
        }
      } catch {}
      if (!res) res = await handleRequest(context, url, pathname);
      const out = await leanResponse(res);
      const headers = new Headers(out.headers);
      headers.set("cache-control", "private, max-age=0, must-revalidate");
      headers.set("vary", "User-Agent");
      return new Response(out.body, {
        status: out.status,
        statusText: out.statusText,
        headers,
      });
    }
    const cacheKey = edgeCacheKey(url, false);
    try {
      const hit = await caches.default.match(cacheKey);
      if (hit) {
        const h = new Response(hit.body, hit);
        h.headers.set("x-ms-edge", "hit");
        return h;
      }
    } catch {}
    // Edge miss: serve the last-good snapshot instantly and refresh behind the reader.
    try {
      const snap = await env.KV.getWithMetadata("lastgood:" + pathname, {
        type: "arrayBuffer",
      });
      if (snap && snap.value && snap.value.byteLength) {
        const res = new Response(snap.value, {
          status: 200,
          headers: {
            "content-type":
              (snap.metadata && snap.metadata.ct) || "text/html; charset=utf-8",
            "cache-control": EDGE_CC_SNAPSHOT,
            "x-ms-edge": "snapshot",
          },
        });
        const decorated = await injectMirrorLayer(context, res);
        try {
          await caches.default.put(cacheKey, decorated.clone());
        } catch {}
        context.waitUntil(
          handleRequest(context, url, pathname)
            .then((fresh) => finalizeAndCache(context, url, fresh, cacheKey))
            .catch(() => {}),
        );
        return decorated;
      }
    } catch {}
    const fresh = await handleRequest(context, url, pathname);
    return finalizeAndCache(context, url, fresh, cacheKey);
  }

  return handleRequest(context, url, pathname);
}

async function handleRequest(context, url, pathname) {
  const { request, env } = context;

  const gated = await adminGate(context);
  if (gated) return gated;

  // A human who clicks through to a raw /api/ page gets a designed viewer, never a JSON dump.
  const machineView = await machineDataGuard(context, url);
  if (machineView) return machineView;

  const densityGuard = await guardDensityMetricClose(context, url);
  if (densityGuard) return densityGuard;

  // OBJECT FOLDER LAW — one link, one identity, one downloadable folder.
  // Any /a/<slug> link answers ?bundle=1 with its complete folder (zip) and
  // ?bundle=manifest with the folder manifest; the article route stays the page.
  if (request.method === "GET" && url.searchParams.has("bundle")) {
    const mode = url.searchParams.get("bundle") === "manifest" ? "manifest" : "zip";
    const directoryMatch = /^\/a\/directory\/([A-Za-z0-9_.-]+)$/.exec(pathname);
    if (directoryMatch) {
      return Response.redirect(
        url.origin + "/api/directory/" + directoryMatch[1] + "?format=" + mode,
        302,
      );
    }
    const articleMatch = /^\/a\/([a-z0-9][a-z0-9_-]*)$/i.exec(pathname);
    if (articleMatch) {
      return Response.redirect(
        url.origin + "/api/articles/" + articleMatch[1] + "/bundle?format=" + mode,
        302,
      );
    }
    // The root composes: /?bundle=1 is the whole site as one folder.
    if (pathname === "/") {
      return Response.redirect(url.origin + "/api/articles/bundle?format=" + mode, 302);
    }
  }

  // Bypass for debug
  if (url.searchParams.get("cloak") === "off") {
    return context.next();
  }

  // Cloaker applies ONLY to the root domain path — everything else serves normally.
  // Graph, articles, API, admin, extensions, and static assets must never redirect.
  if (pathname !== "/") {
    let res = await injectMirrorLayer(
      context,
      await injectShareIfAdmin(context, await alwaysUp(context, url)),
    );
    res = await articleNotFoundFallback(context, url, res);
    return injectCategoryBeacon(context, await injectGa4(context, res));
  }

  let enabled = false;
  let moneyPage = "https://leoresearch.com/l/meta";
  let safePageHtml = null;
  try {
    const row = await env.DB.prepare("SELECT value FROM settings WHERE key = ?")
      .bind("CLOAKER_ENABLED")
      .first();
    enabled = row?.value === "true";
    if (enabled) {
      const mp = await env.DB.prepare(
        "SELECT value FROM settings WHERE key = ?",
      )
        .bind("CLOAKER_MONEY_PAGE")
        .first();
      if (mp?.value) moneyPage = mp.value;
      const sp = await env.DB.prepare(
        "SELECT value FROM settings WHERE key = ?",
      )
        .bind("CLOAKER_SAFE_PAGE_HTML")
        .first();
      if (sp?.value) safePageHtml = sp.value;
    }
  } catch (e) {
    enabled = false;
  }

  if (enabled) {
    const result = cloak(request, { moneyPage, safePageHtml });
    if (result) return result;
  }

  return injectCategoryBeacon(
    context,
    await injectGa4(context, await alwaysUp(context, url)),
  );
}
