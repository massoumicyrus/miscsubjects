import { shellHtml } from './_layout.js';

// The Loop — a gated business-model constellation for leoresearch.com.
// Admin-only (adminGate). A voxel constellation of every asset + how they
// reinforce toward confluence, plus the articulated logic beneath it.

const NODES = [
  { id: 'core', label: 'THE LEO LOOP', sub: 'one owned engine', x: 500, y: 340, r: 62, hero: true },
  { id: 'content', label: 'miscsubjects.com', sub: 'health content authority · maps every condition → interest · SEO · social', x: 500, y: 120 },
  { id: 'store', label: 'leoresearch.com', sub: 'peptide store · DTC + wholesale + white-label', x: 780, y: 200 },
  { id: 'creative', label: 'Creative pipeline', sub: 'ArcAds gpt-image/nano-banana → R2 → sheet/DOPUS · minimal-copy risk model', x: 900, y: 400 },
  { id: 'meta', label: 'Meta ads', sub: 'read-only Marketing API · creatives run here · spend only, not revenue', x: 800, y: 590 },
  { id: 'leads', label: 'Lead loop', sub: 'Google Places → enrich → draft (grok) → send @miscsubjects · B2B wholesale', x: 500, y: 640 },
  { id: 'warehouse', label: 'Dallas warehouse', sub: '~2-day US shipping — the wedge vs overseas', x: 200, y: 590 },
  { id: 'apis', label: 'Rails / APIs', sub: 'X · Meta(read) · Places · Grok · Cloudflare Email · R2 · D1 · Sheets/GAS', x: 100, y: 400 },
  { id: 'findings', label: 'Learned findings', sub: 'Places 50% email yield · deliverability > volume · minimal copy = low risk', x: 220, y: 200 },
  { id: 'oip', label: 'OIP build', sub: 'every action a receipted object · one ledger', x: 500, y: 460, small: true },
];

const EDGES = [
  ['content', 'core'], ['store', 'core'], ['creative', 'core'], ['meta', 'core'],
  ['leads', 'core'], ['warehouse', 'core'], ['apis', 'core'], ['findings', 'core'], ['oip', 'core'],
  ['content', 'creative'], ['content', 'leads'], ['creative', 'meta'], ['creative', 'store'],
  ['leads', 'store'], ['warehouse', 'leads'], ['findings', 'leads'], ['findings', 'creative'], ['apis', 'oip'],
];

function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

function constellationSvg(){
  const byId = Object.fromEntries(NODES.map(n=>[n.id,n]));
  const edges = EDGES.map(([a,b])=>{const p=byId[a],q=byId[b];
    return `<line x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}" stroke="#FF6A00" stroke-opacity="0.28" stroke-width="1.5"/>`;}).join('');
  const nodes = NODES.map(n=>{
    const r = n.r || (n.small?34:46);
    const fill = '#fff';
    const stroke = n.hero ? '#000' : '#777';
    const title = '#000';
    return `<g>
      <circle cx="${n.x}" cy="${n.y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
      <text x="${n.x}" y="${n.y - (n.hero?4:2)}" text-anchor="middle" fill="${title}" font-size="${n.hero?15:12.5}" font-weight="700" font-family="-apple-system,Helvetica,Arial">${esc(n.label)}</text>
      <text x="${n.x}" y="${n.y + (n.hero?16:15)}" text-anchor="middle" fill="#555" font-size="9.5" font-family="-apple-system,Helvetica,Arial">${esc((n.sub||'').slice(0,46))}</text>
    </g>`;
  }).join('');
  return `<svg viewBox="0 0 1000 760" width="100%" style="max-width:1000px;background:#fff;border:1px solid #ccc;border-radius:14px">
    ${edges}${nodes}
  </svg>`;
}

export async function onRequestGet() {
  const BODY = `
<style>
.loop-page{max-width:1040px;color:var(--fg,#111)}
.loop-page h1{margin:0 0 4px}
.loop-page .sub{color:var(--muted,#777);margin:0 0 18px}
.loop-page section{margin:22px 0}
.loop-page h2{font-size:16px;margin:0 0 6px;color:var(--accent,#FF6A00)}
.loop-page p,.loop-page li{font-size:14px;line-height:1.5}
.loop-page code{background:#f2f2f4;padding:1px 5px;border-radius:5px;font-size:12.5px}
</style>
<div class="loop-page">
<h1>The Loop</h1>
<p class="sub">The whole leoresearch.com business as one owned engine — every asset, how they reinforce each other, and where they converge. Admin-gated.</p>

${constellationSvg()}

<section>
<h2>The two businesses (kept separate)</h2>
<p><b>leoresearch.com</b> — the peptide store; everything below is for it. <b>Loop Bio Labs</b> — a separate business, prolific in Newport Beach and Dallas; never named in outreach. The businesses stay distinct in messaging.</p>
</section>

<section>
<h2>The assets, end to end</h2>
<ul>
<li><b>miscsubjects.com</b> — health content authority. Maps every health condition → areas of interest; drives SEO; becomes social images, memes, and video; and feeds who to approach. Content is the top of the funnel.</li>
<li><b>leoresearch.com</b> — the store. DTC retail plus wholesale and white-label (50-unit minimum, 50% off sticker). On-hand catalog: BPC-157, MOTS-C, KPV, Tesamorelin, GHK-Cu, PT-141, SS-31, Semax (GLPs held back).</li>
<li><b>Creative pipeline</b> — ArcAds (gpt-image / nano-banana, billed on ArcAds credits) → stored to R2 → surfaced on the sheet + the DOPUS folder. Two methods: per-peptide template edits and competitor-ad remakes. Risk model: minimal copy = minimal Meta risk; vary only the visual levers.</li>
<li><b>Meta ads</b> — read-only Marketing API. Creatives run here. Meta is spend only, never a revenue source (data-integrity rule).</li>
<li><b>Lead loop</b> — Google Places discovery → website enrich → grok drafts a charming, personalized email → sent from @miscsubjects.com after approval. Target: B2B wholesale — med-spas, longevity/TRT/IV and wellness clinics.</li>
<li><b>Dallas warehouse + ~2-day shipping</b> — the wedge. Most peptides ship slowly from overseas; domestic, fast, in-stock supply is the value the outreach leads with.</li>
<li><b>Rails</b> — X API, Meta Marketing (read), Google Places, Grok, Cloudflare Email Sending, R2, D1, Sheets/GAS — all wired through the OIP build, where every action is a receipted object in one ledger.</li>
</ul>
</section>

<section>
<h2>The flywheel</h2>
<p>Content builds authority and demand → creatives amplify it into feeds → the store converts DTC buyers while the lead loop converts clinics to wholesale/white-label → the Dallas warehouse makes the promise (fast, domestic) real → findings from every channel tune the next cycle. Each turn lowers cost and raises fit.</p>
</section>

<section>
<h2>Learned findings (tuning the loop)</h2>
<ul>
<li>Google Places ≈ 50% email yield vs OpenStreetMap ≈ 20% — Places is the discovery source.</li>
<li>The constraint is <b>deliverability, not cost</b> (~$2 per 1,000 fully-personalized emails). Low-volume, high-fit, personalized beats mass blast — same spend, opposite outcome.</li>
<li>Copy: minimal words = minimal Meta risk; charming, Carnegie-perspective, self-explaining on zero context; woo a one-line reply.</li>
<li>Creatives: ArcAds gpt-image (not OpenAI, which is billing-limited); reference-edit the template, never regenerate from scratch.</li>
</ul>
</section>

<section>
<h2>Confluence</h2>
<p>The point of one owner running content, store, creatives, ads, and outreach on one receipted build: every channel feeds the others, every finding is retained, and the whole system compounds toward a single reinforcing loop rather than scattered efforts.</p>
</section>
</div>`;
  return new Response(shellHtml({ activeHref: '/admin/loop', title: 'The Loop', body: BODY }), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}
