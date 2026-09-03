// CLAIMS LEDGER API — every atomized claim across articles, each linked to its
// article and to its cited sources (the chain-of-truth, as JSON).
//   GET /api/claims            -> all claims, each with article_link + source links
//   GET /api/claims?slug=<s>   -> claims for one article
//   GET /api/claims?tier=human|preclinical|anecdotal|mechanistic|speculative
//   GET /api/claims?unsourced=1
const BASE = 'https://miscsubjects.com';
function json(o, s = 200) { return new Response(JSON.stringify(o, null, 2), { status: s, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } }); }
function parseMeta(m) { try { return JSON.parse(m || '{}') || {}; } catch { return {}; } }

export async function onRequestGet(context) {
  const { env, request } = context;
  if (!env.DB) return json({ error: 'DB binding missing', count: 0, claims: [] }, 500);
  const p = new URL(request.url).searchParams;
  const slug = p.get('slug'), tier = p.get('tier'), unsourced = p.get('unsourced');
  let sql = 'SELECT slug, title, meta FROM articles', binds = [];
  if (slug) { sql += ' WHERE slug = ?'; binds.push(slug); }
  sql += ' ORDER BY updated_at DESC';
  let rows;
  try { rows = await env.DB.prepare(sql).bind(...binds).all(); }
  catch (e) { return json({ error: String(e && e.message || e), count: 0, claims: [] }, 500); }
  const out = [];
  for (const r of (rows.results || [])) {
    const m = parseMeta(r.meta);
    const byId = {}; (Array.isArray(m.sources) ? m.sources : []).forEach(s => { byId[s.id] = s; });
    for (const c of (Array.isArray(m.claims) ? m.claims : [])) {
      const srcs = (c.source_ids || []).map(id => byId[id]).filter(Boolean).map(s => ({
        id: s.id, type: s.type, title: s.title, url: s.url, link: s.url || null,
        quote: s.quote, link_status: s.link_status, quote_status: s.quote_status
      }));
      const row = {
        article: r.slug, article_title: r.title, article_link: `${BASE}/a/${r.slug}`,
        claim_id: c.id, text: c.text, section: c.section || null, tier: c.tier || null,
        why_material: c.why_material || null,
        source_status: srcs.length ? 'sourced' : (c.source_status || 'unsourced'),
        sources: srcs,
        link: `${BASE}/a/${r.slug}#claim-${c.id || ''}`
      };
      if (tier && row.tier !== tier) continue;
      if (unsourced && srcs.length) continue;
      out.push(row);
    }
  }
  return json({ count: out.length, claims: out });
}
