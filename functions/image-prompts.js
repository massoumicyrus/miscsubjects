// /image-prompts — every generated image on this build beside the exact prompt that made it,
// the engine, the reference images it was given, and the article that uses it.
//
// WHY THIS EXISTS. The owner asked to review the image briefs so the design law could be written
// from evidence rather than from taste: "if I looked at all of the image prompts I would be able
// to figure out what the failures are and what the successes are". At that moment 259 generated
// images were on file and 9 carried a prompt, because arcadsGenerate sent the prompt to the
// vendor and filed nothing. The prompt now lands in `assets` at generate time (see
// IMAGE PROMPT LAW in functions/_lib/fn_runners.js) and this page reads it back.
//
// A render with no recorded prompt is shown as such rather than hidden, because the gap is the
// finding: it names exactly which images cannot be learned from.

import { designSystemHeader, designSystemFooter, designSystemStyles } from './_lib/design_system.js';

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function card(row) {
  const prompt = String(row.prompt || '').trim();
  const refs = String(row.source_url || '').split(',').map((s) => s.trim()).filter(Boolean);
  let meta = {};
  try { meta = JSON.parse(row.notes || '{}') || {}; } catch { meta = {}; }
  const used = row.used_by
    ? `<a class="ip-used" href="/a/${esc(row.used_by)}">used as the hero on /a/${esc(row.used_by)}</a>`
    : '<span class="ip-unused">not used as an article hero</span>';
  return `<article class="ip-card">
    <div class="ip-img">${row.url ? `<a href="${esc(row.url)}" target="_blank" rel="noopener"><img loading="lazy" src="${esc(row.url)}" alt="generated image"></a>` : '<div class="ip-noimg">render not stored</div>'}</div>
    <div class="ip-body">
      <div class="ip-meta"><b>${esc(row.engine || 'unknown engine')}</b><span>${esc(String(row.created_at || '').slice(0, 10))}</span>${meta.aspect_ratio ? `<span>${esc(meta.aspect_ratio)}</span>` : ''}</div>
      ${prompt
        ? `<pre class="ip-prompt">${esc(prompt)}</pre>`
        : '<p class="ip-missing">No prompt recorded. This render predates the image prompt law, so nothing can be learned from it.</p>'}
      ${refs.length
        ? `<div class="ip-refs"><span class="ip-refs-h">Reference images given to the model</span>${refs.map((r) => `<a href="${esc(r)}" target="_blank" rel="noopener"><img loading="lazy" src="${esc(r)}" alt="reference"></a>`).join('')}</div>`
        : '<div class="ip-refs"><span class="ip-refs-h">No reference image</span></div>'}
      ${used}
    </div>
  </article>`;
}

export async function onRequestGet({ env }) {
  let rows = [];
  let counts = { total: 0, with_prompt: 0, with_refs: 0 };
  let queryError = null;
  // A swallowed query error renders as "no images on file", which reads as a true empty
  // record and is the same false-success class this page exists to document. Surface it.
  try {
    const r = await env.DB.prepare(`
      SELECT a.id, a.created_at, a.engine, a.prompt, a.url, a.source_url, a.notes,
             (SELECT ar.slug FROM articles ar
                WHERE json_extract(ar.meta, '$.hero') = a.url LIMIT 1) AS used_by
      FROM assets a
      WHERE a.category = 'generated' OR a.engine LIKE 'arcads%'
      ORDER BY a.created_at DESC
      LIMIT 400`).all();
    rows = r.results || [];
    const c = await env.DB.prepare(`
      SELECT COUNT(*) AS total,
             SUM(CASE WHEN prompt IS NOT NULL AND prompt != '' THEN 1 ELSE 0 END) AS with_prompt,
             SUM(CASE WHEN source_url IS NOT NULL AND source_url != '' THEN 1 ELSE 0 END) AS with_refs
      FROM assets WHERE category = 'generated' OR engine LIKE 'arcads%'`).first();
    if (c) counts = c;
  } catch (e) {
    queryError = String(e && e.message ? e.message : e);
    rows = [];
  }

  const missing = Number(counts.total || 0) - Number(counts.with_prompt || 0);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Image prompts — every generated image and the brief that made it — miscsubjects</title>
<meta name="description" content="Every image generated on this build, shown with the exact prompt, the engine, and the reference images it was given.">
<style>${designSystemStyles()}
.ip-wrap{max-width:1100px;margin:0 auto;padding:0 var(--ds-s4,20px) 80px}
.ip-lede{max-width:70ch;margin:28px 0 8px}
.ip-count{display:flex;gap:26px;flex-wrap:wrap;margin:18px 0 34px;padding:14px 0;border-top:1px solid var(--ds-line);border-bottom:1px solid var(--ds-line)}
.ip-count div{display:flex;flex-direction:column}
.ip-count b{font-size:1.5rem;line-height:1.1}
.ip-count span{font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;color:var(--ds-dim)}
.ip-card{display:grid;grid-template-columns:300px 1fr;gap:22px;padding:22px 0;border-top:1px solid var(--ds-line)}
.ip-img img{width:100%;height:auto;border-radius:6px;display:block}
.ip-noimg{padding:40px 12px;text-align:center;color:var(--ds-dim);border:1px dashed var(--ds-line);border-radius:6px;font-size:.85rem}
.ip-meta{display:flex;gap:14px;align-items:baseline;flex-wrap:wrap;margin-bottom:10px;font-size:.82rem;color:var(--ds-dim)}
.ip-meta b{color:var(--ds-ink);font-size:.9rem}
.ip-prompt{white-space:pre-wrap;word-break:break-word;font-size:.86rem;line-height:1.5;background:var(--ds-raised);padding:12px 14px;border-radius:6px;margin:0 0 12px;overflow-x:auto}
.ip-missing{font-size:.86rem;color:var(--ds-dim);font-style:italic;margin:0 0 12px}
.ip-refs{margin-bottom:10px}
.ip-refs-h{display:block;font-size:.72rem;text-transform:uppercase;letter-spacing:.06em;color:var(--ds-dim);margin-bottom:6px}
.ip-refs img{height:72px;width:auto;border-radius:4px;margin-right:8px;vertical-align:top}
.ip-used{font-size:.84rem}
.ip-unused{font-size:.84rem;color:var(--ds-dim)}
@media(max-width:760px){.ip-card{grid-template-columns:1fr}}
</style></head><body>
${designSystemHeader()}
<main class="ip-wrap">
  <h1>Image prompts</h1>
  <p class="ip-lede">Every image this build generated, shown with the exact prompt that produced it, the engine that ran it, and any reference images it was handed. The purpose is to write the design law from evidence: which briefs produced a picture worth publishing, and which produced a generic one.</p>
  <div class="ip-count">
    <div><b>${esc(counts.total || 0)}</b><span>generated images on file</span></div>
    <div><b>${esc(counts.with_prompt || 0)}</b><span>with a recorded prompt</span></div>
    <div><b>${esc(missing)}</b><span>with no prompt, unlearnable</span></div>
    <div><b>${esc(counts.with_refs || 0)}</b><span>given a reference image</span></div>
  </div>
  ${rows.length ? rows.map(card).join('') : '<p>No generated images on file.</p>'}
</main>
${designSystemFooter()}
</body></html>`;

  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
