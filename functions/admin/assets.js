import { shellHtml } from './_layout.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (url.searchParams.get('data') === '1') {
    const cat = url.searchParams.get('category');
    const q = cat
      ? env.DB.prepare('SELECT * FROM assets WHERE category = ? ORDER BY created_at DESC LIMIT 500').bind(cat)
      : env.DB.prepare('SELECT * FROM assets ORDER BY created_at DESC LIMIT 500');
    const r = await q.all();
    return new Response(JSON.stringify({ results: r.results || [] }), { headers: { 'content-type': 'application/json' } });
  }

  const BODY = `
<style>
.assets-page{max-width:1300px}
.assets-page .filters{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:var(--space-3,18px)}
.assets-page .chip{padding:6px 13px;border:1px solid var(--line);border-radius:999px;cursor:pointer;font:600 11px var(--mono);letter-spacing:.04em;background:var(--panel);color:var(--ink-soft);transition:border-color .12s,color .12s}
.assets-page .chip:hover{border-color:var(--line-strong);color:var(--ink)}
.assets-page .chip.active{background:var(--ds-accent-soft,rgba(201,169,97,.12));border-color:var(--accent);color:var(--accent)}
.assets-page .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:14px}
.assets-page .card{border:1px solid var(--line);border-radius:var(--radius,10px);overflow:hidden;background:var(--panel);transition:border-color .12s,transform .12s}
.assets-page .card:hover{border-color:var(--line-strong);transform:translateY(-1px)}
.assets-page .card img{width:100%;height:170px;object-fit:cover;display:block;background:var(--raised,#1d2129)}
.assets-page .meta{padding:8px 10px;font-size:11.5px;line-height:1.5;color:var(--ink-soft)}
.assets-page .cat{font:600 10px/1.4 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--accent)}
.assets-page a{color:var(--accent);text-decoration:none}
.assets-page a:hover{text-decoration:underline}
</style>
<div class="assets-page">
<h1>Assets</h1>
<p class="subtitle">Every image on hand, filed by category. Text the build a photo with "competitor ad", "best ad", or "product vial" to file it. Competitor ads also return generated alternatives.</p>
<div class="filters" id="filters"></div>
<div class="grid" id="grid"></div>
</div>
<script>
const CATS = ['all','leo_creative','leo_comp','leo_rip','leo_try','competitor_ad','best_ad','product_vial','generated','reference'];
let active = (new URLSearchParams(location.search).get('category')) || 'all';
if (!CATS.includes(active)) active = 'all';
function chips(){
  const f=document.getElementById('filters');
  f.innerHTML = CATS.map(c=>'<div class="chip'+(c===active?' active':'')+'" data-c="'+c+'">'+c.replace('_',' ')+'</div>').join('');
  f.querySelectorAll('.chip').forEach(el=>el.onclick=()=>{active=el.dataset.c;chips();load();});
}
function e(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function load(){
  const u = '/admin/assets?data=1' + (active!=='all' ? '&category='+active : '');
  fetch(u).then(r=>r.json()).then(d=>{
    const g=document.getElementById('grid');
    if(!d.results.length){g.innerHTML='<p style="color:var(--muted)">none yet</p>';return;}
    g.innerHTML = d.results.map(a=>
      '<div class="card"><a href="'+e(a.url)+'" target="_blank"><img loading="lazy" src="'+e(a.url)+'"></a>'+
      '<div class="meta"><div class="cat">'+e(a.category.replace("_"," "))+(a.engine?' · '+e(a.engine):'')+'</div>'+
      '<div>'+e(a.label||'')+'</div>'+
      '<div><a href="'+e(a.url)+'" target="_blank" download>open full-res &#8599;</a></div>'+
      '<div style="color:var(--muted)">'+e((a.created_at||'').slice(0,16).replace("T"," "))+(a.protocol?' · '+e(a.protocol):'')+'</div></div></div>'
    ).join('');
  });
}
chips();load();
</script>`;
  return new Response(shellHtml({ activeHref: '/admin/assets', title: 'Assets', body: BODY }), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}
