// Homepage — server-renders the article index into the static page.
// Architecture: read public/index.html (preserves ALL sections: identity, tiles,
// walk, ladder, directory, footer, scripts), inject only the new feed block
// (site name, live counts, Google-style query bar, subject tabs, sort pills,
// magnify cards, feedback widgets) into the #articleFeed div. Nothing below
// the feed is touched — it is the static page's own content.

import { buildLlmsTxtBody } from './llms.txt.js';
import { publishState } from './_lib/publish_time.js';
import { corpusCounts, CORPUS_COUNT_LABEL } from './_lib/corpus_counts.js';
import { designSystemFooter } from './_lib/design_system.js';

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim();
  const subject = (url.searchParams.get('subject') || '').trim();
  const sort = (url.searchParams.get('sort') || '').trim();
  const format = (url.searchParams.get('format') || '').trim();

  let articles = [];
  let counts = { articles: 0, sources: 0, claims: 0, sigs: 0, comments: 0 };
  let subjects = [];

  // Comment counts per article (the model comment ledger). Its own try: a failure here
  // costs the counter, never the feed. Superseded (retracted) comments are not counted,
  // matching commentCounts in _lib/article_ledger.js.
  let cmap = {};
  try {
    const cr = await env.DB.prepare(
      `SELECT slug, COUNT(*) AS n FROM article_comments WHERE status != 'superseded' GROUP BY slug`
    ).all();
    for (const row of (cr.results || [])) cmap[row.slug] = Number(row.n) || 0;
  } catch(e) { console.error('homepage comment counts', e); }

  try {
    const r = await env.DB.prepare(
      `SELECT slug, title, subject, created_at, updated_at,
              json_extract(meta,'$.deck') AS deck,
              json_extract(meta,'$.hero') AS hero,
              json_array_length(json_extract(meta,'$.sources')) AS src_n,
              json_array_length(json_extract(meta,'$.claims')) AS claim_n,
              COALESCE(length(body),0) AS body_len
       FROM articles WHERE published=1 AND COALESCE(json_extract(meta,'$.home'), 1) != 0
         AND COALESCE(json_extract(meta,'$.register'),'standard') NOT IN ('source_ledger','source','audit')
       ORDER BY updated_at DESC LIMIT 5000`
    ).all();
    articles = (r.results || []).map(a => ({
      slug: a.slug, title: a.title, subject: a.subject || '',
      created_at: a.created_at, updated_at: a.updated_at,
      // Computed server-side so the card, the JSON feed and the ledger agree. Doing it in the
      // browser would make the displayed time depend on the reader's own clock and zone.
      pub: publishState(a.created_at, a.updated_at),
      deck: a.deck || '', hero: a.hero || '',
      src_n: a.src_n || 0, claim_n: a.claim_n || 0, words: Math.round((a.body_len||0)/5),
      cmt_n: cmap[a.slug] || 0
    }));
    // DISPLAYED NUMBERS COME FROM THE CANONICAL QUERY, NEVER THE FEED LENGTH (defect
    // 2026-08-08: this block said 1,015 while the identity block below said 1,173 on the
    // same page — the feed is filtered by meta.home, the corpus is not). The feed may
    // show fewer cards; the numbers are the corpus. Feed-derived figures remain only as
    // fallback when the canonical query itself fails.
    counts.articles = articles.length;
    counts.sources = articles.reduce((s,a)=>s+(a.src_n||0),0);
    counts.claims  = articles.reduce((s,a)=>s+(a.claim_n||0),0);
    counts.sigs = counts.articles;
    counts.comments = articles.reduce((s,a)=>s+(a.cmt_n||0),0);
    try {
      const canon = await corpusCounts(env);
      counts.articles = canon.articles;
      counts.sources = canon.sources;
      counts.claims = canon.claims;
      counts.sigs = canon.articles;
    } catch(e) { console.error('homepage canonical counts', e); }
    const smap = {};
    articles.forEach(a => { if(a.subject){ smap[a.subject] = (smap[a.subject]||0)+1; } });
    subjects = Object.keys(smap).map(k=>({name:k,n:smap[k]})).sort((a,b)=>b.n-a.n).slice(0,16);
  } catch(e) { console.error('homepage query', e); }

  if (format === 'json') {
    return new Response(JSON.stringify({articles,counts,subjects}), {headers:{
      'content-type':'application/json',
      'cache-control':'public, max-age=30, s-maxage=60, stale-while-revalidate=120',
    }});
  }

  // Read the static page — preserves every section below the feed.
  let base = '';
  try {
    const baseReq = new Request(new URL('/', request.url));
    const baseRes = await env.ASSETS.fetch(baseReq);
    base = await baseRes.text();
  } catch(e) { console.error('homepage base read', e); }
  if (!base) { base = '<!doctype html><html><body></body></html>'; }

  // STATIC FIGURES FOLLOW THE CANONICAL COUNT (same defect class as the gcounts split:
  // public/index.html carries "1,015 articles … 10,479 extracted claims" in its JSON-LD
  // and "10,479 claims · 7,869 sources" on the evidence-map chapter — numbers frozen at
  // whatever the corpus was when someone last hand-edited the file). Rewritten at render
  // from the one canonical query so no figure on this page can drift from another.
  try {
    const nA = counts.articles.toLocaleString('en-US');
    const nC = counts.claims.toLocaleString('en-US');
    const nS = counts.sources.toLocaleString('en-US');
    base = base
      .replace(/[\d,]+ articles on AI policy/g, nA + ' articles on AI policy')
      .replace(/[\d,]+ extracted claims/g, nC + ' extracted claims')
      .replace(/[\d,]+ claims · [\d,]+ sources/g, nC + ' claims · ' + nS + ' sources');
  } catch(e) { console.error('homepage static figure sync', e); }

  // Inject the new feed block into #articleFeed, replacing the Loading placeholder.
  const inject = renderFeedBlock({articles, counts, subjects, q, subject, sort});
  base = base.replace(
    /<div class="flow" id="articleFeed">[\s\S]*?<\/div>/,
    '<div class="flow" id="articleFeed">' + inject + '</div>'
  );
  // The homepage formerly carried a hand-maintained footer that drifted from article and
  // governance pages. Replace it at render time with the same shared composition they use.
  base = base.replace(/<footer class="ds-foot">[\s\S]*?<\/footer>/, designSystemFooter());

  // THE COMPLETE SELF-DESCRIPTION, ON THE ROOT ITSELF (owner order 2026-08-03): a model
  // asked "what is miscsubjects.com" that fetches only this page must come away 100%
  // accurate — the object model, the workspace, proof objects, credentials and how to mint
  // or self-scope them, the ledger, the offer. This embeds the same text /llms.txt serves,
  // verbatim, as a collapsed block: invisible weight for humans, full text for extractors.
  try {
    const selfText = await buildLlmsTxtBody(env);
    const escaped = String(selfText).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const block = `<details id="ms-root-self-description" style="max-width:72rem;margin:.5rem auto 0;padding:.35rem .9rem;font-size:.78rem;line-height:1.5;opacity:.85">
<summary style="cursor:pointer">What this site is — the complete self-description, for any reader, human or model</summary>
<pre style="white-space:pre-wrap;overflow-wrap:anywhere;font:inherit">${escaped}</pre>
</details>`;
    // End of body, not the top (owner order 2026-08-04): the first visible element on the
    // homepage is the product, never a machine-addressed block. Extractors read the whole DOM.
    const endAt = base.lastIndexOf('</body>');
    if (endAt !== -1) base = base.slice(0, endAt) + block + base.slice(endAt);
    else base += block;
  } catch (e) { console.error('root self-description embed', e); }

  // Same policy as every other public index page (EDGE_CC_INDEX in _middleware.js). The
  // homepage was the one public HTML surface shipping with no cache-control at all, so
  // intermediary caches each invented their own policy for it.
  return new Response(base, {headers:{
    'content-type':'text/html;charset=utf-8',
    'cache-control':'public, max-age=30, s-maxage=60, stale-while-revalidate=120',
  }});
}

function renderFeedBlock({articles, counts, subjects, q, subject, sort}) {
  const ar = JSON.stringify(articles).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
  const sj = JSON.stringify(subjects).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
  return `
<style>
/* ===== FEED BLOCK (scoped — only affects the injected feed) ===== */
.msfb{--bg:#ffffff;--bg2:#f8f9fa;--ink:#202124;--ink2:#3c4043;--dim:#70757a;
  --line:#dadce0;--line2:#e8eaed;--blue:#1a73e8;--hover:#f1f3f4;
  --ff:-apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue",sans-serif;
  --fm:"SF Mono",Menlo,monospace;
  font-family:var(--ff);color:var(--ink);-webkit-font-smoothing:antialiased}
.msfb *{box-sizing:border-box}
.msfb a{color:inherit;text-decoration:none}

.msfb .sitename-wrap{padding:2.2rem 1rem .3rem;text-align:center}
.msfb .sitename{font-size:2.4rem;font-weight:700;color:var(--ink);letter-spacing:-0.01em;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue",sans-serif;white-space:nowrap}
.msfb .sitename small{font:700 9px/1 -apple-system,BlinkMacSystemFont,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:var(--dim);display:block;margin-top:.3rem}

.msfb .gcounts{display:flex;gap:2.2rem;justify-content:center;margin-top:.5rem;padding:0 1rem;flex-wrap:wrap}
.msfb .gcount{display:flex;flex-direction:column;align-items:center}
.msfb .gcount-n{font-size:1.15rem;font-weight:500;color:var(--ink);font-family:var(--fm)}
.msfb .gcount-l{font-size:.68rem;color:var(--dim);text-transform:uppercase;letter-spacing:.06em;margin-top:.1rem}
.msfb .gcount-note{text-align:center;font-size:.68rem;color:var(--dim);margin-top:.35rem;padding:0 1rem}
.msfb .sandboxed{max-width:720px;margin:1.5rem auto 0;padding:1rem 1.25rem;border:1px solid var(--line2);
  border-radius:14px;font-size:.85rem;line-height:1.6;color:var(--ink2)}
.msfb .sandboxed h2{font-size:.9rem;font-weight:600;margin:0 0 .4rem;color:var(--ink)}
.msfb .sandboxed code{font-family:var(--fm);font-size:.8rem;word-break:break-all}

.msfb .gwrap{display:flex;flex-direction:column;align-items:center;padding:1.1rem 1rem .4rem}
.msfb .gbar-row{display:flex;align-items:center;gap:.6rem;width:100%;max-width:720px;margin:0 auto}
.msfb .gform{flex:1;position:relative}
.msfb .gbar{display:flex;align-items:center;border:1px solid var(--line);border-radius:24px;
  height:50px;padding:0 18px;background:#fff;box-shadow:0 1px 6px rgba(32,33,36,.08);
  transition:box-shadow .2s,border-color .2s}
.msfb .gbar:hover,.msfb .gbar:focus-within{box-shadow:0 1px 10px rgba(32,33,36,.18);border-color:#d2d5d9}
.msfb .gbar svg{width:22px;height:22px;color:var(--dim);flex-shrink:0}
.msfb .ginput{flex:1;border:none;outline:none;font-size:17px;color:var(--ink);background:transparent;
  height:100%;padding:0 14px;font-family:var(--ff)}
.msfb .ginput::placeholder{color:var(--dim)}
.msfb .grobot{display:inline-flex;align-items:center;gap:.35rem;padding:.35rem .8rem;border-radius:10px;
  font-size:.78rem;color:var(--ink2);cursor:pointer;border:1px solid var(--line2);background:#fff;
  transition:background .15s,transform .3s cubic-bezier(.34,1.56,.64,1);white-space:nowrap;font-family:var(--ff)}
.msfb .grobot:hover{background:var(--hover);transform:scale(1.18)}
.msfb .grobot.active{background:var(--ink);color:#fff;border-color:var(--ink)}
.msfb .gpanel{max-width:720px;margin:.75rem auto 0;padding:1rem 1.25rem;background:var(--bg2);
  border:1px solid var(--line2);border-radius:16px;font-size:.9rem;color:var(--ink2);display:none;line-height:1.55}
.msfb .gpanel.show{display:block}

.msfb .gsuggest{position:absolute;top:54px;left:0;right:0;background:#fff;border:1px solid var(--line);
  border-radius:0 0 12px 12px;box-shadow:0 4px 12px rgba(32,33,36,.12);display:none;z-index:50}
.msfb .gsuggest.show{display:block}
.msfb .gs-item{padding:.6rem 1rem;cursor:pointer;border-bottom:1px solid var(--line2);font-size:.9rem}
.msfb .gs-item:last-child{border-bottom:none}
.msfb .gs-item:hover,.msfb .gs-item.active{background:var(--hover)}
.msfb .gs-item b{font-weight:500}
.msfb .gs-item span{color:var(--dim);font-family:var(--fm);font-size:.78rem;margin-left:.5rem}

.msfb .filter-wrap{max-width:1100px;margin:1rem auto 0;padding:0 1rem}
.msfb .frow{display:flex;gap:.3rem;justify-content:center;flex-wrap:wrap;margin-bottom:.5rem}
.msfb .sjtab{padding:.4rem .9rem;border-radius:20px;font-size:.82rem;color:var(--dim);
  cursor:pointer;transition:transform .3s cubic-bezier(.34,1.56,.64,1),background .15s,color .15s;
  border:1px solid transparent;background:transparent;font-family:var(--ff)}
.msfb .sjtab:hover{background:var(--hover);transform:scale(1.22);color:var(--ink)}
.msfb .sjtab.active{background:var(--ink);color:#fff}
.msfb .sjtab .n{font-family:var(--fm);font-size:.72rem;opacity:.7;margin-left:.25rem}
.msfb .sortpill{padding:.35rem .8rem;border-radius:16px;font-size:.78rem;color:var(--dim);
  cursor:pointer;transition:transform .3s cubic-bezier(.34,1.56,.64,1),background .15s,color .15s;
  border:1px solid var(--line2);background:#fff;font-family:var(--ff)}
.msfb .sortpill:hover{background:var(--hover);transform:scale(1.18)}
.msfb .sortpill.active{background:var(--ink);color:#fff;border-color:var(--ink)}

.msfb .feed{max-width:880px;margin:1.5rem auto 0;padding:0 1rem 3rem}
.msfb .card{display:flex;gap:1.1rem;padding:1.1rem 1.25rem;background:#fff;
  border:1px solid var(--line2);border-radius:14px;margin-bottom:.9rem;position:relative;
  transition:transform .3s cubic-bezier(.34,1.56,.64,1),box-shadow .25s,border-color .25s}
.msfb .card:hover{transform:scale(1.12);box-shadow:0 8px 28px rgba(32,33,36,.12);border-color:var(--line);z-index:5}
.msfb .card-hasimg{min-height:200px}
.msfb .card-img{width:280px;min-width:280px;height:180px;border-radius:10px;object-fit:cover;flex-shrink:0}
.msfb .card-body{flex:1;min-width:0;position:relative}
.msfb .card-sub{font-size:.68rem;text-transform:uppercase;letter-spacing:.08em;color:var(--dim);
  font-family:var(--fm);margin-bottom:.25rem}
.msfb .card-t{font-size:1.1rem;font-weight:500;color:var(--ink);line-height:1.35;margin-bottom:.35rem}
.msfb .card-t:hover{color:var(--blue)}
.msfb .card-deck{font-size:.88rem;color:var(--ink2);line-height:1.55;
  display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:.5rem}
.msfb .card-meta{display:flex;flex-wrap:wrap;gap:.7rem;margin-top:.5rem;align-items:center;
  font-family:var(--fm);font-size:.74rem;color:var(--dim)}
.msfb .card-meta b{font-weight:500;color:var(--ink2)}
.msfb .card-meta .dot{color:var(--line)}
/* Comment counter (owner order 2026-08-06): every card shows its live comment count and
   opens the article's thread directly. */
.msfb .card-cmt{display:inline-flex;align-items:center;gap:.3rem;color:var(--dim);text-decoration:none}
.msfb .card-cmt svg{width:14px;height:14px;fill:currentColor;flex-shrink:0}
.msfb .card-cmt b{font-weight:500;color:var(--ink2)}
.msfb .card-cmt:hover,.msfb .card-cmt:hover b{color:var(--blue)}
/* POSTED vs UPDATED (owner, 2026-08-04). The list orders by last change, so the card has to say
   which of the two facts its timestamp is, and show it to the minute in Pacific time. */
.msfb .card-when{display:inline-flex;align-items:center;gap:.4rem;white-space:nowrap;
  font-variant-numeric:tabular-nums}
.msfb .card-when .when-dot{width:.5rem;height:.5rem;border-radius:50%;flex:0 0 auto}
.msfb .card-when-new .when-dot{background:#1f9d55}
.msfb .card-when-revised .when-dot{background:#c98a04}
.msfb .card-when .when-state{font-weight:500;letter-spacing:.01em}
.msfb .card-when-new .when-state{color:#1f9d55}
.msfb .card-when-revised .when-state{color:#c98a04}
.msfb .card-when time{color:var(--ink2)}

.msfb .card-fb{position:absolute;bottom:.6rem;right:0;display:flex;gap:.3rem;opacity:0;
  transition:opacity .18s}
.msfb .card:hover .card-fb{opacity:1}
.msfb .fb-btn{width:30px;height:30px;border-radius:50%;border:1px solid var(--line2);background:#fff;
  cursor:pointer;font-size:.78rem;display:flex;align-items:center;justify-content:center;color:var(--ink2);
  transition:transform .22s,background .15s,border-color .15s;font-family:var(--ff)}
.msfb .fb-btn:hover{transform:scale(1.3);background:var(--hover);border-color:var(--line)}
.msfb .fb-btn svg{width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:1.8}

.msfb .fbmodal{position:fixed;inset:0;background:rgba(0,0,0,.4);display:none;z-index:200;align-items:center;justify-content:center}
.msfb .fbmodal.show{display:flex}
.msfb .fbbox{background:#fff;border-radius:16px;padding:1.5rem;max-width:440px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,.2)}
.msfb .fbbox h3{font-size:1rem;margin-bottom:.5rem}
.msfb .fbbox textarea{width:100%;border:1px solid var(--line);border-radius:8px;padding:.6rem;font-family:var(--ff);font-size:.9rem;min-height:90px;resize:vertical}
.msfb .fbbox .fbrow{display:flex;gap:.5rem;margin-top:.75rem;justify-content:flex-end}
.msfb .fbbox button{padding:.45rem 1rem;border-radius:8px;border:1px solid var(--line);background:#fff;cursor:pointer;font-family:var(--ff)}
.msfb .fbbox button.fb-send{background:var(--ink);color:#fff;border-color:var(--ink)}

@media(max-width:640px){
  .msfb .card-hasimg{flex-direction:column}
  .msfb .card-img{width:100%;height:180px}
  .msfb .gbar-row{flex-direction:column}
  .msfb .gbar-row .grobot{width:100%;justify-content:center}
  .msfb .filter-wrap{max-width:100%}
  .msfb .feed{max-width:100%}
  .msfb .sitename{font-size:1.8rem}
}
</style>

<div class="msfb">
  <div class="sitename-wrap"><div class="sitename">miscsubjects<small>an AI operating system</small></div></div>

  <div class="gcounts">
    <div class="gcount"><span class="gcount-n">${counts.articles.toLocaleString()}</span><span class="gcount-l">articles</span></div>
    <div class="gcount"><span class="gcount-n">${counts.sources.toLocaleString()}</span><span class="gcount-l">sources</span></div>
    <div class="gcount"><span class="gcount-n">${counts.claims.toLocaleString()}</span><span class="gcount-l">claims</span></div>
    <div class="gcount"><span class="gcount-n">${counts.sigs.toLocaleString()}</span><span class="gcount-l">machine signatures</span></div>
    <div class="gcount"><span class="gcount-n">${counts.comments.toLocaleString()}</span><span class="gcount-l">comments</span></div>
  </div>
  <div class="gcount-note">Counting ${esc(CORPUS_COUNT_LABEL)} — not the length of the feed below.</div>

  <div class="gwrap">
    <div class="gbar-row">
      <form class="gform" id="gForm" onsubmit="return false">
        <div class="gbar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
          <input class="ginput" id="gInput" type="text" placeholder="" autocomplete="off" spellcheck="false" value="${esc(q)}">
          <div class="gsuggest" id="gSuggest"></div>
        </div>
      </form>
    </div>
  </div>

  <div class="filter-wrap">
    <div class="frow" id="sortBar"></div>
  </div>

  <div class="feed" id="feed"></div>

  <div class="sandboxed">
    <h2>If your model is browser-sandboxed</h2>
    Web clients (Claude web, ChatGPT web) only fetch URLs that appear in your message or in search results — they cannot follow the links inside a page. Paste these directly to your model:<br>
    <code>https://miscsubjects.com/start</code> — mints a credential inline in the response, one fetch<br>
    <code>https://miscsubjects.com/api/work</code><br>
    <code>https://miscsubjects.com/llms.txt</code><br>
    Reading is a complete outcome. CLI agents can run the full invoke loop.
  </div>

  <div class="fbmodal" id="fbModal">
    <div class="fbbox">
      <h3 id="fbTitle">Feedback</h3>
      <textarea id="fbText" placeholder="Say what you want…"></textarea>
      <div class="fbrow">
        <button id="fbCancel" type="button">Cancel</button>
        <button class="fb-send" id="fbSend" type="button">Send</button>
      </div>
    </div>
  </div>
</div>

<script>
(function(){
  var ARTICLES = ${ar};
  var SUBJECTS = ${sj};
  var stCur = ${JSON.stringify(subject)};
  var soCur = ${JSON.stringify(sort)} || 'updated_desc';
  var qCur = ${JSON.stringify(q)};

  function esc(s){return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}

  function renderSjTabs(){ /* removed — subject tabs moved to nav menu */ }

  function renderSort(){
    var opts = [['updated_desc','Newest'],['updated_asc','Oldest'],['src_desc','Most sourced'],
      ['claim_desc','Most claims'],['len_desc','Longest'],['len_asc','Shortest'],['az','A→Z']];
    var html = opts.map(function(o){
      return '<div class="sortpill'+(soCur===o[0]?' active':'')+'" data-so="'+o[0]+'">'+o[1]+'</div>';
    }).join('');
    var bar = document.getElementById('sortBar'); if(!bar) return;
    bar.innerHTML = html;
    bar.querySelectorAll('.sortpill').forEach(function(p){
      p.onclick = function(){ soCur = p.getAttribute('data-so'); render(); };
    });
  }

  function matches(a){
    if (stCur && a.subject !== stCur) return false;
    if (qCur){
      var ql = qCur.toLowerCase();
      var hay = (a.title+' '+a.deck+' '+a.slug+' '+a.subject).toLowerCase();
      var toks = ql.split(/\\s+/).filter(Boolean);
      for (var i=0;i<toks.length;i++){ if (hay.indexOf(toks[i]) === -1) return false; }
    }
    return true;
  }

  function applySort(list){
    var arr = list.slice();
    switch(soCur){
      case 'updated_asc': arr.sort(function(a,b){return String(a.updated_at).localeCompare(String(b.updated_at));}); break;
      case 'src_desc': arr.sort(function(a,b){return (b.src_n||0)-(a.src_n||0);}); break;
      case 'claim_desc': arr.sort(function(a,b){return (b.claim_n||0)-(a.claim_n||0);}); break;
      case 'len_desc': arr.sort(function(a,b){return (b.words||0)-(a.words||0);}); break;
      case 'len_asc': arr.sort(function(a,b){return (a.words||0)-(b.words||0);}); break;
      case 'az': arr.sort(function(a,b){return String(a.title).localeCompare(String(b.title));}); break;
      default: arr.sort(function(a,b){return String(b.updated_at).localeCompare(String(a.updated_at));});
    }
    return arr;
  }

  var I = {
    up:'<svg viewBox="0 0 24 24"><path d="M7 22V11h-4v11h4zm14-11.5c0-.83-.67-1.5-1.5-1.5h-5.45l.65-3.1.02-.22c0-.28-.11-.54-.29-.72l-.72-.71-5.41 5.41c-.36.36-.55.86-.55 1.37V20c0 1.1.9 2 2 2h7.46c.69 0 1.33-.41 1.61-1.04l2.8-6.55c.08-.17.13-.36.13-.55v-1.91z"/></svg>',
    down:'<svg viewBox="0 0 24 24"><path d="M17 2v11h4V2h-4zm-7.5 9c.83 0 1.5.67 1.5 1.5v5.45l3.1-.65.22-.02c.28 0 .54.11.72.29l.71.72-5.41 5.41c-.36.36-.86.55-1.37.55H4c-1.1 0-2-.9-2-2v-7.46c0-.69.41-1.33 1.04-1.61l6.55-2.8c.17-.08.36-.13.55-.13h1.91z"/></svg>',
    talk:'<svg viewBox="0 0 24 24"><path d="M21 6h-2v9H6v2c0 .55.45 1 1 1h11l4 4V7c0-.55-.45-1-1-1zm-4 6V3c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v14l4-4h9c.55 0 1-.45 1-1z"/></svg>'
  };

  function renderCard(a){
    var img = '';
    if (a.hero){
      img = '<img class="card-img" src="'+esc(a.hero)+'" alt="" loading="lazy" onerror="this.style.display=\\'none\\';this.parentNode.classList.add(\\'noimg\\')">';
    }
    var norm = function(s){ return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim(); };
    var sub = (a.subject && norm(a.subject) !== norm(a.title)) ? '<div class="card-sub">'+esc(a.subject)+'</div>' : '';
    var deck = (a.deck && norm(a.deck) !== norm(a.title)) ? '<div class="card-deck">'+esc(a.deck)+'</div>' : '';
    var pub = a.pub || {state:'posted', label:'posted', stamp:String(a.updated_at||'').slice(0,10), dot:'new', posted:'', updated:''};
    var stampTitle = 'posted ' + (pub.posted||'—') + (pub.state==='updated' ? ' · updated ' + (pub.updated||'—') : '');
    var meta = '<div class="card-meta">'+
      '<span><b>'+a.src_n+'</b> sources</span><span class="dot">·</span>'+
      '<span><b>'+a.claim_n+'</b> claims</span><span class="dot">·</span>'+
      '<a class="card-cmt" href="/a/'+esc(a.slug)+'#ledger" title="Read the comment thread on this article">'+I.talk+'<b>'+(a.cmt_n||0)+'</b></a><span class="dot">·</span>'+
      '<span><b>'+a.words+'</b>w</span><span class="dot">·</span>'+
      '<span class="card-when card-when-'+esc(pub.dot)+'" title="'+esc(stampTitle)+'">'+
        '<i class="when-dot"></i>'+
        '<b class="when-state">'+esc(pub.label)+'</b> '+
        '<time datetime="'+esc(pub.state==='updated'?a.updated_at:a.created_at)+'">'+esc(pub.stamp)+'</time>'+
      '</span></div>';
    var body = '<div class="card-body">'+sub+
      '<a class="card-t" href="/a/'+esc(a.slug)+'">'+esc(a.title)+'</a>'+deck+meta+'</div>';
    var fb = '<div class="card-fb">'+
      '<button class="fb-btn up" data-fb="up" data-slug="'+esc(a.slug)+'" data-t="'+esc(a.title)+'">'+I.up+'</button>'+
      '<button class="fb-btn down" data-fb="down" data-slug="'+esc(a.slug)+'" data-t="'+esc(a.title)+'">'+I.down+'</button>'+
      '<button class="fb-btn talk" data-fb="comment" data-slug="'+esc(a.slug)+'" data-t="'+esc(a.title)+'">'+I.talk+'</button>'+
      '</div>';
    var cls = 'card'+(a.hero?' card-hasimg':'');
    return '<div class="'+cls+'">'+img+body+fb+'</div>';
  }

  function render(){
    var feed = document.getElementById('feed'); if(!feed) return;
    var list = ARTICLES.filter(matches);
    list = applySort(list);
    window.__allList = list;
    window.__shown = Math.min(50, list.length);
    feed.innerHTML = list.length ? list.slice(0, window.__shown).map(renderCard).join('') : '<div style="padding:2rem;text-align:center;color:#70757a">No articles match.</div>';
    bindFeedback();
  }

  function loadMore(){
    var feed = document.getElementById('feed'); if(!feed) return;
    var list = window.__allList || [];
    var cur = window.__shown || 0;
    if (cur >= list.length) return;
    var nxt = Math.min(cur + 50, list.length);
    var html = '';
    for (var i=cur; i<nxt; i++) html += renderCard(list[i]);
    feed.insertAdjacentHTML('beforeend', html);
    window.__shown = nxt;
    bindFeedback();
  }

  var gInput = document.getElementById('gInput');
  var gSuggest = document.getElementById('gSuggest');
  var suggestActive = -1;

  function doSearch(){
    qCur = (gInput.value||'').trim();
    render();
    hideSuggest();
    syncUrl();
  }

  function showSuggest(){
    var q = (gInput.value||'').trim();
    if (q.length < 2){ hideSuggest(); return; }
    var ql = q.toLowerCase();
    var hits = ARTICLES.filter(function(a){
      var hay = (a.title+' '+a.deck+' '+a.subject).toLowerCase();
      return hay.indexOf(ql) !== -1;
    }).slice(0,7);
    if (!hits.length){ hideSuggest(); return; }
    gSuggest.innerHTML = hits.map(function(a,i){
      return '<div class="gs-item'+(i===suggestActive?' active':'')+'" data-q="'+esc(a.title)+'"><b>'+esc(a.title)+'</b><span>'+a.src_n+' sources · '+esc(a.subject||'')+'</span></div>';
    }).join('');
    gSuggest.classList.add('show');
    gSuggest.querySelectorAll('.gs-item').forEach(function(it){
      it.onmousedown = function(e){ e.preventDefault(); gInput.value = it.getAttribute('data-q'); doSearch(); };
    });
  }

  function hideSuggest(){ gSuggest.classList.remove('show'); suggestActive=-1; }

  function syncUrl(){
    var u = new URL(location.href);
    if (qCur) u.searchParams.set('q',qCur); else u.searchParams.delete('q');
    if (stCur) u.searchParams.set('subject',stCur); else u.searchParams.delete('subject');
    if (soCur && soCur !== 'updated_desc') u.searchParams.set('sort',soCur); else u.searchParams.delete('sort');
    history.replaceState(null,'',u);
  }

  if (gInput){
    gInput.addEventListener('input', showSuggest);
    gInput.addEventListener('focus', showSuggest);
    gInput.addEventListener('keydown', function(e){
      if (e.key === 'Enter'){ e.preventDefault(); doSearch(); return; }
      if (e.key === 'Escape'){ hideSuggest(); gInput.blur(); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp'){
        e.preventDefault();
        var items = gSuggest.querySelectorAll('.gs-item');
        if (!items.length) return;
        if (e.key === 'ArrowDown') suggestActive = Math.min(suggestActive+1, items.length-1);
        else suggestActive = Math.max(suggestActive-1, -1);
        items.forEach(function(it,i){ it.classList.toggle('active', i===suggestActive); });
        if (suggestActive >= 0) gInput.value = items[suggestActive].getAttribute('data-q');
      }
    });
  }
  document.addEventListener('click', function(e){
    if (!e.target.closest('.gform') && !e.target.closest('.gsuggest')) hideSuggest();
  });

  /* feedback */
  var fbModal = document.getElementById('fbModal');
  var fbText = document.getElementById('fbText');
  var fbTitle = document.getElementById('fbTitle');
  var fbCtx = {slug:'', kind:'', title:''};

  function bindFeedback(){
    document.querySelectorAll('.fb-btn').forEach(function(b){
      if (b._bound) return; b._bound = true;
      b.onclick = function(e){
        e.preventDefault(); e.stopPropagation();
        fbCtx = {slug:b.getAttribute('data-slug'), kind:b.getAttribute('data-fb'), title:b.getAttribute('data-t')};
        if (fbCtx.kind === 'comment'){
          fbTitle.textContent = 'Comment on: '+fbCtx.title;
          fbText.placeholder = 'Say what you want…';
        } else {
          fbTitle.textContent = (fbCtx.kind==='up'?'Thumbs up':'Thumbs down')+': '+fbCtx.title;
          fbText.placeholder = 'Optional note…';
        }
        fbText.value = '';
        fbModal.classList.add('show');
        fbText.focus();
      };
    });
  }
  var fbCancel = document.getElementById('fbCancel');
  var fbSend = document.getElementById('fbSend');
  if (fbCancel) fbCancel.onclick = function(){ fbModal.classList.remove('show'); };
  if (fbSend) fbSend.onclick = function(){
    fetch('/api/feedback', {method:'POST', headers:{'content-type':'application/json'},
      body: JSON.stringify({slug:fbCtx.slug, kind:fbCtx.kind, text:fbText.value, title:fbCtx.title, ua:navigator.userAgent, path:location.pathname})
    }).then(function(){ fbModal.classList.remove('show'); }).catch(function(){ fbModal.classList.remove('show'); });
  };
  if (fbModal) fbModal.addEventListener('click', function(e){ if (e.target === fbModal) fbModal.classList.remove('show'); });

  renderSort();
  if (gInput && qCur) gInput.value = qCur;
  render();
  window.addEventListener('scroll', function(){
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 800) loadMore();
  });
})();
</script>
`;
}

function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
