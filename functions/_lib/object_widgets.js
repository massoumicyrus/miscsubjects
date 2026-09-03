// Object projections (2026-07-28): the lead/asset object rendered at three zoom levels —
// row, card, action surface — each a projection over existing tables (one query, one
// renderer; the one route is functions/api/objects/[[path]].js). No new subsystem.
// Used by the article body pipeline ([[object:...]] embeds render live at page load,
// because the page function runs the query per request) and by the objects route.
import { buildNowIso } from './build_time.js';

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function noteSignal(notes, re, missing) {
  const m = String(notes || '').match(re);
  return m ? m[0] : missing;
}

/** Zoom 1 — rows. Live SELECT; no contact columns on the public surface. */
export async function renderObjectRows(env, spec) {
  const s = String(spec || '').trim();
  let rows = [];
  if (s.startsWith('tenant:')) {
    rows = (await env.DB.prepare(
      'SELECT id, name, segment, city, source, status, score, tenant_id FROM leads WHERE tenant_id = ? ORDER BY score DESC, id LIMIT 5',
    ).bind(s.slice(7)).all()).results || [];
  } else if (/^[0-9,]+$/.test(s)) {
    const ids = s.split(',').map(Number).filter(Boolean).slice(0, 8);
    rows = (await env.DB.prepare(
      'SELECT id, name, segment, city, source, status, score, tenant_id FROM leads WHERE id IN (' + ids.map(() => '?').join(',') + ') ORDER BY score DESC',
    ).bind(...ids).all()).results || [];
  }
  if (!rows.length) return '<div class="ow-empty">object_rows: no rows matched <code>' + esc(s) + '</code> at render time — the query ran and returned nothing.</div>';
  const tr = rows.map((r) =>
    '<tr><td class="ow-id"><a href="/api/objects/lead/' + r.id + '">lead:' + r.id + '</a></td><td>' + esc(r.name) + '</td><td>' + esc(r.city || '') + '</td><td>' + esc(r.segment || '') + '</td><td>' + esc(r.source || '') + '</td><td>' + esc(r.status || '') + '</td><td class="ow-num">' + esc(r.score) + '</td><td class="ow-ten">' + esc(r.tenant_id || '—') + '</td></tr>').join('');
  return '<div class="ow-rows"><table><thead><tr><th>object</th><th>name</th><th>city</th><th>segment</th><th>source</th><th>status</th><th>score</th><th>owner</th></tr></thead><tbody>' + tr + '</tbody></table>' +
    '<div class="ow-cap">Live rows from the <code>leads</code> table, read by this page at render time. Contact fields are not on the public row surface; they belong to the owning tenant\'s card view.</div></div>';
}

/** Charges attached to one object ref, oldest first — the object's paid provenance. */
async function chargesForObject(env, ref) {
  if (!env.LEDGER) return [];
  try {
    return (await env.LEDGER.prepare(
      "SELECT id, ts, tenant_id, invocation_id, trace_id, capability, units, meter_unit, cost_usd, price_usd FROM charges WHERE object_refs LIKE ? ORDER BY ts",
    ).bind('%"' + ref + '"%').all()).results || [];
  } catch { return []; }
}

/** Zoom 2 — the full card. publicView hides real contact fields unless the record is the
 *  labeled synthetic demonstration record; absent fields render visibly empty, never omitted. */
export async function renderObjectCard(env, leadId, { publicView = true } = {}) {
  const l = await env.DB.prepare(
    "SELECT id, created_at, name, segment, city, website, email, phone, address, source, status, score, tenant_id, context, COALESCE(notes,'') notes FROM leads WHERE id = ?",
  ).bind(Number(leadId)).first();
  if (!l) return '<div class="ow-empty">object_card: lead:' + esc(leadId) + ' does not exist.</div>';
  const synthetic = l.source === 'synthetic-demo';
  const showContact = synthetic || !publicView;
  const charges = await chargesForObject(env, 'lead:' + l.id);
  const creating = charges[0] || null;
  const mx = noteSignal(l.notes, /mx:(ok|none)/, 'unverified — LEADS_VERIFY_MX has not run on this object');
  const icp = noteSignal(l.notes, /icp:\d+[^,]*/, 'unscored — LEADS_SCORE_AI has not run on this object');
  const field = (k, v, emptyLabel) =>
    '<div class="ow-f"><span class="ow-k">' + esc(k) + '</span><span class="ow-v' + (v ? '' : ' ow-missing') + '">' + (v ? esc(v) : esc(emptyLabel || 'empty')) + '</span></div>';
  const contact = (k, v) => showContact
    ? field(k, v, 'none captured')
    : field(k, v ? 'present — visible only inside the owning tenant\'s boundary' : null, 'none captured');
  const provRows = charges.map((c) =>
    '<tr><td>' + esc(c.ts) + '</td><td>' + esc(c.capability) + '</td><td class="ow-num">' + esc(c.units) + ' ' + esc(c.meter_unit || '') + '</td><td class="ow-num">$' + Number(c.cost_usd || 0).toFixed(4) + '</td><td class="ow-num">$' + Number(c.price_usd || 0).toFixed(2) + '</td><td class="ow-id">' + esc(c.invocation_id || '') + '</td></tr>').join('');
  return '<div class="ow-card' + (synthetic ? ' ow-synth' : '') + '">' +
    (synthetic ? '<div class="ow-synth-band">SYNTHETIC DEMONSTRATION RECORD — created for the article that embeds it; every provenance row below is a real machine action against it, and its verification states are the machine\'s true readings.</div>' : '') +
    '<div class="ow-head"><span class="ow-type">lead</span><span class="ow-oid">lead:' + l.id + '</span><span class="ow-status">' + esc(l.status) + '</span></div>' +
    '<div class="ow-grid">' +
    field('name', l.name) + field('segment', l.segment) + field('city', l.city) +
    contact('email', l.email) + contact('phone', l.phone) +
    field('website', l.website, 'none captured') + field('address', l.address, 'none captured') +
    field('mx verification', mx) + field('icp qualification', icp) + field('fit score', String(l.score ?? '')) +
    '</div>' +
    '<div class="ow-prov"><div class="ow-prov-h">Provenance — the part no list vendor shows</div>' +
    field('created', l.created_at) +
    field('creating source', l.source) +
    field('owner (tenant_id)', l.tenant_id, 'none — pre-tenancy row; ownership is the column this build added 2026-07-28') +
    (creating ? field('creating capability', creating.capability + ' → invocation ' + (creating.invocation_id || '') + ' · trace ' + (creating.trace_id || '')) : field('creating capability', null, 'no charge row references this object')) +
    (charges.length
      ? '<table class="ow-ptable"><thead><tr><th>ts</th><th>capability</th><th>units</th><th>cost</th><th>price</th><th>invocation</th></tr></thead><tbody>' + provRows + '</tbody></table>'
      : '<div class="ow-cap">No charges reference this object — it predates the meter or was created outside a tenant purchase.</div>') +
    '</div>' +
    '<div class="ow-cap">JSON of this card: <a href="/api/objects/lead/' + l.id + '">/api/objects/lead/' + l.id + '</a></div>' +
    '</div>';
}

/** Zoom 3 — the action surface: every priced capability, computed from the directory.
 *  The honest scope note is part of the widget, not a footnote. */
export async function renderActionSurface(env) {
  const rows = (await env.DB.prepare(
    'SELECT key, price_usd, meter_unit FROM directory WHERE price_usd > 0 AND IFNULL(enabled,1)=1 ORDER BY price_usd',
  ).all()).results || [];
  if (!rows.length) return '<div class="ow-empty">action_surface: no directory row carries a price yet.</div>';
  const chips = rows.map((r) =>
    '<a class="ow-chip" href="/api/dispatch?explain=' + encodeURIComponent(r.key) + '"><span class="ow-chip-k">' + esc(r.key) + '</span><span class="ow-chip-p">$' + Number(r.price_usd).toFixed(2) + ' / ' + esc(r.meter_unit || 'unit') + '</span></a>').join('');
  return '<div class="ow-actions"><div class="ow-prov-h">Action surface — computed, not curated</div>' +
    '<div class="ow-chips">' + chips + '</div>' +
    '<div class="ow-cap">Query: <code>SELECT key, price_usd, meter_unit FROM directory WHERE price_usd &gt; 0</code> — run live at page load. ' +
    'Every chip is a priced, receipted capability whose input is this object type. Matching by declared input schema instead of by price is the named open gap: <code>directory.input_schema</code> is not yet queryable by object type.</div></div>';
}

/** Asset object card: the image, its prompt, its engine, its owner — the creative object. */
export async function renderAssetCard(env, assetId) {
  const a = await env.DB.prepare(
    'SELECT id, created_at, category, label, url, engine, prompt, sender FROM assets WHERE id = ?',
  ).bind(String(assetId)).first();
  if (!a) return '<div class="ow-empty">asset_card: asset ' + esc(assetId) + ' does not exist.</div>';
  const field = (k, v, emptyLabel) =>
    '<div class="ow-f"><span class="ow-k">' + esc(k) + '</span><span class="ow-v' + (v ? '' : ' ow-missing') + '">' + (v ? esc(v) : esc(emptyLabel || 'empty')) + '</span></div>';
  return '<div class="ow-card"><div class="ow-head"><span class="ow-type">asset</span><span class="ow-oid">' + esc(a.id) + '</span><span class="ow-status">' + esc(a.category) + '</span></div>' +
    (a.url ? '<img class="ow-img" src="' + esc(a.url) + '" alt="' + esc(a.label || a.id) + '" loading="lazy">' : '') +
    '<div class="ow-grid">' +
    field('generated', a.created_at) + field('engine', a.engine, 'not recorded') +
    field('prompt', a.prompt ? String(a.prompt).slice(0, 500) : null, 'not recorded') +
    field('requested by', a.sender, 'not recorded') +
    field('recorded generation cost', null, 'not recorded — the assets table has no cost column; the same gap the meter closed for LEADS is open here') +
    '</div>' +
    '<div class="ow-cap">The prompt and engine travel with the image: the next creative request starts from a query over what already worked, not a blank text box.</div></div>';
}

export function objectWidgetStyles(ink, line, accent) {
  return `
.ow-rows table,.ow-ptable{width:100%;border-collapse:collapse;font-size:13px;margin:10px 0}
.ow-rows th,.ow-rows td,.ow-ptable th,.ow-ptable td{padding:7px 9px;border-bottom:1px solid ${line};text-align:left;vertical-align:top}
.ow-rows th,.ow-ptable th{font-size:11px;text-transform:uppercase;letter-spacing:.06em;opacity:.6}
.ow-id,.ow-id a{font-family:ui-monospace,monospace;font-size:12px}
.ow-num{font-variant-numeric:tabular-nums}
.ow-ten{font-family:ui-monospace,monospace;font-size:12px;opacity:.8}
.ow-card{border:1px solid ${line};border-radius:10px;padding:18px 20px;margin:26px 0;background:transparent}
.ow-synth{border-style:dashed}
.ow-synth-band{font-size:11.5px;letter-spacing:.04em;text-transform:uppercase;border:1px dashed ${line};border-radius:6px;padding:7px 10px;margin-bottom:14px;opacity:.75}
.ow-head{display:flex;gap:10px;align-items:baseline;margin-bottom:12px}
.ow-type{font-size:11px;text-transform:uppercase;letter-spacing:.08em;opacity:.55}
.ow-oid{font-family:ui-monospace,monospace;font-weight:600}
.ow-status{margin-left:auto;font-size:12px;border:1px solid ${line};border-radius:99px;padding:2px 10px}
.ow-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px 22px}
.ow-f{display:flex;flex-direction:column;padding:4px 0}
.ow-k{font-size:10.5px;text-transform:uppercase;letter-spacing:.07em;opacity:.55}
.ow-v{font-size:14px;word-break:break-word}
.ow-missing{opacity:.5;font-style:italic}
.ow-prov{margin-top:16px;border-top:1px solid ${line};padding-top:12px}
.ow-prov-h{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;opacity:.7}
.ow-cap{font-size:12.5px;opacity:.65;margin-top:10px;line-height:1.5}
.ow-chips{display:flex;flex-wrap:wrap;gap:8px}
.ow-chip{display:flex;flex-direction:column;border:1px solid ${line};border-radius:8px;padding:8px 12px;text-decoration:none;min-width:150px}
.ow-chip:hover{border-color:${accent}}
.ow-chip-k{font-family:ui-monospace,monospace;font-size:12.5px;font-weight:600}
.ow-chip-p{font-size:12px;opacity:.7;font-variant-numeric:tabular-nums}
.ow-actions{border:1px solid ${line};border-radius:10px;padding:16px 20px;margin:26px 0}
.ow-img{max-width:340px;border-radius:8px;border:1px solid ${line};margin:6px 0 14px}
.ow-empty{border:1px dashed ${line};border-radius:8px;padding:10px 14px;font-size:13px;opacity:.7;margin:20px 0}
`;
}

/** Route helper: one lead as JSON with its charges, honoring the tenant boundary. */
export async function leadObjectJson(env, leadId, { ownerView = false } = {}) {
  const l = await env.DB.prepare(
    "SELECT id, created_at, name, segment, city, website, email, phone, address, source, status, score, tenant_id, COALESCE(notes,'') notes FROM leads WHERE id = ?",
  ).bind(Number(leadId)).first();
  if (!l) return { status: 404, body: { error: 'not_found', object: 'lead:' + leadId } };
  const synthetic = l.source === 'synthetic-demo';
  if (!ownerView && !synthetic && l.tenant_id) {
    return {
      status: 403,
      body: {
        refused: true,
        reason: 'cross_tenant_read',
        object: 'lead:' + l.id,
        owner_tenant: l.tenant_id,
        ts: buildNowIso(),
        note: 'This object belongs to ' + l.tenant_id + '. It renders only inside its owning tenant\'s boundary — the same rule the invocation read path enforces. This refusal is recorded on the invocation ledger.',
      },
    };
  }
  const charges = await chargesForObject(env, 'lead:' + l.id);
  const pub = { ...l };
  if (!ownerView && !synthetic) { delete pub.email; delete pub.phone; delete pub.notes; }
  return { status: 200, body: { object_type: 'lead', id: 'lead:' + l.id, synthetic, record: pub, charges } };
}
