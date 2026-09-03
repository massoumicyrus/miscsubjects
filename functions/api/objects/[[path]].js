import { isBuildAuthed } from '../../_lib/admin_session.js';
import { logInvocation } from '../../_lib/invocation_log.js';
import { renderObjectCard, renderAssetCard, objectWidgetStyles, leadObjectJson } from '../../_lib/object_widgets.js';

function json(o, status = 200) {
  return new Response(JSON.stringify(o, null, 2), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
}

function cardPage(title, inner) {
  const ink = '#1a1a1a', line = '#e3ded4', accent = '#8b1e1e';
  return new Response(
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + title + ' — miscsubjects</title><style>body{font:15px/1.6 ui-sans-serif,system-ui;max-width:760px;margin:40px auto;padding:0 18px;color:' + ink + '}a{color:inherit}' +
    objectWidgetStyles(ink, line, accent) + '</style></head><body>' + inner +
    '<p class="ow-cap"><a href="/a/federated-object-proof">← the article this object demonstrates</a></p></body></html>',
    { headers: { 'content-type': 'text/html; charset=utf-8' } },
  );
}

async function exportTenant(env, request, tenantId) {
  const owner = await isBuildAuthed(request, env);
  const token = new URL(request.url).searchParams.get('share') || '';
  let authorized = owner;
  if (!authorized && token) {
    try {
      const { capFingerprint, getCapabilityByFingerprint } = await import('../../_lib/admin_session.js');
      const cap = await getCapabilityByFingerprint(env, await capFingerprint(token));
      authorized = !!(cap && cap.tenant_id === tenantId && !cap.revoked);
    } catch { authorized = false; }
  }
  if (!authorized) {
    return json({
      refused: true, reason: 'export_requires_owning_tenant', tenant_id: tenantId,
      note: 'An export returns a tenant\'s own objects. Present that tenant\'s capability token as ?share=, or authenticate as the build owner.',
    }, 403);
  }
  const objects = (await env.DB.prepare(
    "SELECT id, created_at, name, segment, city, website, email, phone, address, source, status, score, tenant_id, context, COALESCE(notes,'') notes FROM leads WHERE tenant_id = ? ORDER BY id",
  ).bind(tenantId).all()).results || [];
  let charges = [];
  try {
    charges = (await env.LEDGER.prepare(
      'SELECT id, ts, capability, units, meter_unit, cost_usd, price_usd, object_refs, invocation_id, trace_id, outcome FROM charges WHERE tenant_id = ? ORDER BY ts',
    ).bind(tenantId).all()).results || [];
  } catch {}
  let tenant = null;
  try { tenant = await env.LEDGER.prepare('SELECT tenant_id, name, status, balance_usd, created_at FROM tenants WHERE tenant_id = ?').bind(tenantId).first(); } catch {}
  return json({
    export_of: tenantId,
    exported_at: new Date().toISOString(),
    tenant,
    counts: { objects: objects.length, charges: charges.length },
    license: 'These objects are the exporting tenant\'s property. This file is complete, unencumbered, and carries the provenance for every row: nothing here requires this system to remain online, solvent, or willing.',
    objects,
    charges,
  });
}

export async function onRequestGet({ request, env, params }) {
  const parts = Array.isArray(params.path) ? params.path : String(params.path || '').split('/');
  const [type, id] = parts;
  const url = new URL(request.url);
  const wantCard = url.searchParams.get('format') === 'card';
  const owner = await isBuildAuthed(request, env);

  if (type === 'export') {
    const tenantId = url.searchParams.get('tenant') || '';
    if (!tenantId) return json({ error: 'tenant required', usage: '/api/objects/export?tenant=t_<slug>&share=<tenant token>' }, 400);
    return exportTenant(env, request, tenantId);
  }

  // GET /api/objects/receipts?tenant=t_x — PUBLIC. A charge row carries no personal data:
  // capability, units, meter unit, recorded cost, price, and the ids of the invocation and
  // objects it paid for. Publishing them is the externally-inspectable-governance claim being
  // true rather than asserted — a stranger reading /a/federated-object-proof can re-check every
  // number in it here without a credential.
  if (type === 'receipts') {
    const tenantId = url.searchParams.get('tenant') || '';
    if (!tenantId) return json({ error: 'tenant required', usage: '/api/objects/receipts?tenant=t_<slug>' }, 400);
    if (!env.LEDGER) return json({ error: 'no_ledger_binding' }, 500);
    const rows = (await env.LEDGER.prepare(
      'SELECT id, ts, capability, units, meter_unit, cost_usd, price_usd, object_refs, invocation_id, trace_id, outcome FROM charges WHERE tenant_id = ? ORDER BY ts',
    ).bind(tenantId).all()).results || [];
    const t = await env.LEDGER.prepare('SELECT tenant_id, name, status, balance_usd, created_at FROM tenants WHERE tenant_id = ?').bind(tenantId).first();
    const charged = rows.reduce((a, r) => a + Number(r.price_usd || 0), 0);
    const cost = rows.reduce((a, r) => a + Number(r.cost_usd || 0), 0);
    return json({
      tenant_id: tenantId,
      tenant: t ? { name: t.name, status: t.status, balance_usd: t.balance_usd, created_at: t.created_at } : null,
      totals: { charges: rows.length, charged_usd: Math.round(charged * 1e6) / 1e6, recorded_cost_usd: Math.round(cost * 1e6) / 1e6 },
      note: 'Public by design: a charge row carries no personal data. The objects these charges bought are readable only by their owning tenant (/api/objects/lead/{id} returns a refusal receipt to anyone else).',
      charges: rows,
    });
  }

  if (type === 'lead' && id) {
    const out = await leadObjectJson(env, id, { ownerView: owner });
    if (out.status === 403) {
      // A refusal is a ledger event with the same shape as any other (spec c14).
      try {
        await logInvocation(env, {
          trace_id: 'refusal',
          object_id: 'OBJECT_CARD_READ',
          row: { key: 'OBJECT_CARD_READ', type: 'http' },
          actor: 'public:anonymous',
          input: 'lead/' + id,
          result: JSON.stringify(out.body),
          cost_usd: 0,
          tenant_id: out.body.owner_tenant || null,
        });
      } catch {}
      return json(out.body, 403);
    }
    if (!wantCard) return json(out.body, out.status);
    const html = await renderObjectCard(env, id, { publicView: !owner });
    return cardPage('lead:' + id, html);
  }

  if (type === 'asset' && id) {
    if (!wantCard) {
      const a = await env.DB.prepare('SELECT id, created_at, category, label, url, engine, prompt, sender FROM assets WHERE id = ?').bind(String(id)).first();
      return a ? json({ object_type: 'asset', id: a.id, record: a }) : json({ error: 'not_found', object: 'asset:' + id }, 404);
    }
    return cardPage('asset:' + id, await renderAssetCard(env, id));
  }

  return json({ error: 'unknown_object_type', usage: '/api/objects/lead/{id} or /api/objects/asset/{id}, ?format=card for HTML' }, 404);
}
