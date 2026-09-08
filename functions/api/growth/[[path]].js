// GROWTH API — /api/growth/*. Read side of the canonical growth graph plus the four bounded writes
// of slice 1: seed providers, import (Meta, read-only), register traffic versions, resolve clicks,
// and rule→proposal creation (proposals only; nothing here mutates a provider). Owner-gated by
// x-terminal-key or the admin session. Every fault returns a named error, never a bare 500.

import { isBuildAuthed } from '../../_lib/admin_session.js';
import { buildNowIso } from '../../_lib/build_time.js';
import { seedProviders, knownConnections, PROVIDERS, CAPABILITY_COLUMNS } from '../../_lib/growth/registry.js';
import { tenantOf, newId, registerTrafficVersions, resolveClicks, readGraph, journeyFor, derived, propose } from '../../_lib/growth/store.js';
import { discoverAccounts, importAccount } from '../../_lib/growth/adapters/meta.js';
import { parsePlainRule } from '../../_lib/traffic/plain_rules.js';

const J = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const json = (o, status = 200) => new Response(JSON.stringify(o, null, 2), { status, headers: J });
const body = async (r) => { try { return await r.json(); } catch { return {}; } };

export async function onRequest(context) {
  try { return await route(context); }
  catch (e) { return json({ ok: false, error: 'GROWTH_ERROR', message: String(e && e.message || e).slice(0, 500) }, 500); }
}

async function route({ request, env }) {
  const url = new URL(request.url);
  const parts = url.pathname.replace(/^\/api\/growth\/?/, '').split('/').filter(Boolean);
  const seg = (i) => parts[i] || '';
  const method = request.method.toUpperCase();
  if (!(await isBuildAuthed(request, env))) return json({ ok: false, error: 'owner_auth_required' }, 401);
  const t = url.searchParams.get('t') || env.TRAFFIC_TENANT || 't_root';
  const origin = url.origin;

  // ---- providers
  if (seg(0) === 'providers' && method === 'GET') {
    const rows = (await env.DB.prepare('SELECT * FROM providers WHERE tenant_id=? ORDER BY category, name').bind(t).all()).results || [];
    const conns = (await env.DB.prepare('SELECT * FROM provider_connections WHERE tenant_id=?').bind(t).all()).results || [];
    return json({ ok: true, count: rows.length, capability_columns: CAPABILITY_COLUMNS, providers: rows, connections: conns, manifest_count: PROVIDERS.length });
  }
  if (seg(0) === 'providers' && seg(1) === 'seed' && method === 'POST') {
    const now = buildNowIso();
    const r = await seedProviders(env, t, now);
    let conns = 0;
    for (const c of knownConnections(env)) {
      await env.DB.prepare(`INSERT INTO provider_connections (id, tenant_id, provider_id, external_account_id, label, state, scopes_json, secret_ref, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(tenant_id, provider_id, COALESCE(external_account_id,'')) DO UPDATE SET state=excluded.state, scopes_json=excluded.scopes_json, secret_ref=excluded.secret_ref, label=excluded.label, updated_at=excluded.updated_at`)
        .bind(newId('pcx'), t, c.provider_id, c.external_account_id, c.label, c.state, JSON.stringify(c.scopes), c.secret_ref, now, now).run();
      conns++;
    }
    return json({ ok: true, ...r, connections: conns });
  }
  if (seg(0) === 'syncs' && method === 'GET') return json({ ok: true, syncs: (await env.DB.prepare('SELECT * FROM sync_runs WHERE tenant_id=? ORDER BY started_at DESC LIMIT 50').bind(t).all()).results || [] });

  // ---- brands (self + competitors)
  if (seg(0) === 'brands' && method === 'GET') return json({ ok: true, brands: (await env.DB.prepare('SELECT * FROM brands WHERE tenant_id=? ORDER BY is_self DESC, name').bind(t).all()).results || [] });
  if (seg(0) === 'brands' && method === 'POST') {
    const b = await body(request);
    if (!b.name) return json({ ok: false, error: 'name_required' }, 400);
    const existing = await env.DB.prepare('SELECT id FROM brands WHERE tenant_id=? AND name=?').bind(t, b.name).first();
    const id = existing?.id || newId('brd'); const now = buildNowIso();
    if (existing) await env.DB.prepare('UPDATE brands SET is_self=?, domains_json=?, vertical=?, geographies_json=?, social_json=?, ad_accounts_json=?, competitor_of_json=?, evidence_class=?, updated_at=? WHERE tenant_id=? AND id=?').bind(b.is_self ? 1 : 0, JSON.stringify(b.domains || []), b.vertical || null, JSON.stringify(b.geographies || []), JSON.stringify(b.social || []), JSON.stringify(b.ad_accounts || []), JSON.stringify(b.competitor_of || []), b.is_self ? 'first_party_observed' : (b.evidence_class || 'directly_observed_public'), now, t, id).run();
    else await env.DB.prepare('INSERT INTO brands (id, tenant_id, market_id, name, is_self, domains_json, vertical, geographies_json, social_json, ad_accounts_json, competitor_of_json, first_seen, evidence_class, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id, t, b.market_id || null, b.name, b.is_self ? 1 : 0, JSON.stringify(b.domains || []), b.vertical || null, JSON.stringify(b.geographies || []), JSON.stringify(b.social || []), JSON.stringify(b.ad_accounts || []), JSON.stringify(b.competitor_of || []), now, b.is_self ? 'first_party_observed' : (b.evidence_class || 'directly_observed_public'), now, now).run();
    return json({ ok: true, id, created: !existing });
  }

  // ---- media graph (Meta read-only adapter)
  if (seg(0) === 'media' && seg(1) === 'accounts' && method === 'GET') {
    const stored = (await env.DB.prepare('SELECT id, provider_id, external_id, name, synced_at FROM media_accounts WHERE tenant_id=?').bind(t).all()).results || [];
    const live = url.searchParams.get('live') === '1' ? await discoverAccounts(env, { tenant: t, origin }) : null;
    return json({ ok: true, imported: stored, live });
  }
  if (seg(0) === 'media' && seg(1) === 'import' && method === 'POST') {
    const b = await body(request);
    if (!b.account_id) return json({ ok: false, error: 'account_id_required' }, 400);
    if ((b.provider_id || 'meta_ads') !== 'meta_ads') return json({ ok: false, error: 'ADAPTER_NOT_BUILT', provider_id: b.provider_id, built: ['meta_ads'] }, 501);
    const r = await importAccount(env, { tenant: t, origin, account_id: b.account_id, days: Number(b.days) || 30, since: b.since || null, until: b.until || null, actor: b.actor || 'owner', brand_id: b.brand_id || null });
    return json(r, r.ok ? 200 : 207);
  }
  if (seg(0) === 'media' && seg(1) === 'graph' && method === 'GET') return json({ ok: true, ...(await readGraph(env, t, { since_days: Number(url.searchParams.get('days')) || 30 })) });
  if (seg(0) === 'metrics' && seg(1) && seg(2) && method === 'GET') {
    const days = Number(url.searchParams.get('days')) || 30;
    return json({ ok: true, ...(await derived(env, t, { subject_type: seg(1), subject_id: seg(2), since: buildNowIso(Date.now() - days * 86400 * 1000).slice(0, 10), until: buildNowIso().slice(0, 10) + 'T23:59:59' })) });
  }
  if (seg(0) === 'observations' && method === 'GET') {
    const rows = (await env.DB.prepare('SELECT * FROM metric_observations WHERE tenant_id=? ORDER BY observed_at DESC LIMIT ?').bind(t, Math.min(500, Number(url.searchParams.get('limit')) || 100)).all()).results || [];
    return json({ ok: true, count: rows.length, observations: rows });
  }

  // ---- experiences / versions / bridge / journey
  if (seg(0) === 'versions' && seg(1) === 'register' && method === 'POST') return json({ ok: true, ...(await registerTrafficVersions(env, t)) });
  if (seg(0) === 'versions' && method === 'GET') {
    const rows = (await env.DB.prepare('SELECT v.*, e.key experience_key, e.kind FROM experience_versions v JOIN experiences e ON e.id=v.experience_id WHERE v.tenant_id=? ORDER BY e.key, v.version').bind(t).all()).results || [];
    const pol = (await env.DB.prepare('SELECT * FROM allocation_policy_versions WHERE tenant_id=? AND effective_to IS NULL').bind(t).all()).results || [];
    return json({ ok: true, versions: rows, allocation_policies: pol });
  }
  if (seg(0) === 'clicks' && seg(1) === 'resolve' && method === 'POST') { const b = await body(request); return json({ ok: true, ...(await resolveClicks(env, t, { limit: Number(b.limit) || 500 })) }); }
  if (seg(0) === 'journey' && seg(1) && method === 'GET') return json({ ok: true, ...(await journeyFor(env, t, seg(1))) });
  if (seg(0) === 'touchpoints' && method === 'GET') return json({ ok: true, touchpoints: (await env.DB.prepare('SELECT * FROM touchpoints WHERE tenant_id=? ORDER BY ts DESC LIMIT 200').bind(t).all()).results || [] });

  // ---- control (proposals only)
  if (seg(0) === 'proposals' && method === 'GET') return json({ ok: true, proposals: (await env.DB.prepare('SELECT * FROM action_proposals WHERE tenant_id=? ORDER BY ts DESC LIMIT 100').bind(t).all()).results || [], receipts: (await env.DB.prepare('SELECT * FROM action_receipts WHERE tenant_id=? ORDER BY ts DESC LIMIT 50').bind(t).all()).results || [] });
  if (seg(0) === 'proposals' && method === 'POST') { const b = await body(request); if (!b.action || !b.target_type || !b.target_id || !b.reason || !b.required_authority) return json({ ok: false, error: 'action,target_type,target_id,reason,required_authority required' }, 400); return json({ ok: true, ...(await propose(env, t, { ...b, actor: b.actor || 'owner' })) }); }
  // plain-English growth rule → evaluated against a subject's derived metrics → proposal (never executes)
  if (seg(0) === 'rules' && seg(1) === 'evaluate' && method === 'POST') {
    const b = await body(request);
    const parsed = parsePlainRule(b.text || '');
    if (parsed.error) return json({ ok: false, error: 'parse_failed', message: parsed.error }, 400);
    const days = Number(b.days) || 30;
    const d = await derived(env, t, { subject_type: b.subject_type || 'deployment', subject_id: b.subject_id, since: buildNowIso(Date.now() - days * 86400 * 1000).slice(0, 10), until: buildNowIso().slice(0, 10) + 'T23:59:59' });
    // map growth fields onto the condition evaluator's context
    const ctx = { spend: d.primitives.spend ?? null, purchases: d.primitives.purchases ?? d.primitives.conversions ?? 0, clicks: d.primitives.clicks ?? null, impressions: d.primitives.impressions ?? null, ctr: d.derived.ctr_pct ?? null, cpc: d.derived.cpc ?? null, cpa: d.derived.cpa ?? null, roas: d.derived.roas ?? null, frequency: d.primitives.frequency ?? null };
    const { evaluate } = await import('../../_lib/traffic/conditions.js');
    // translate 'network.*'-style paths produced by the traffic alias table into growth ctx keys
    const norm = (n) => JSON.parse(JSON.stringify(n).replace(/"path":"[a-z_.]*?([a-z_]+)"/g, (m, k) => `"path":"${k}"`));
    const res = evaluate(norm(parsed.condition), ctx);
    let proposal = null;
    if (res.result) {
      const act = parsed.actions[0] || {};
      const action = act.type === 'deny' ? 'pause' : act.type === 'destination' ? 'route_change' : act.type === 'outcome' ? 'allocation_change' : 'review';
      proposal = await propose(env, t, { actor: 'rule:' + (b.rule_name || 'adhoc'), action, target_type: b.subject_type || 'deployment', target_id: b.subject_id, provider_id: b.provider_id || 'meta_ads', before: { metrics: ctx }, after: { action }, reason: 'rule matched: ' + b.text, required_authority: action === 'pause' ? 'status_write' : action === 'route_change' ? 'campaign_write' : 'budget_write', expected_result: 'stop waste' });
    }
    return json({ ok: true, matched: !!res.result, metrics: ctx, trace: res.trace, proposal, provider_calls: 0 });
  }

  return json({ ok: false, error: 'unknown_route', routes: ['GET providers', 'POST providers/seed', 'GET syncs', 'GET|POST brands', 'GET media/accounts?live=1', 'POST media/import {account_id,days|since+until,brand_id}', 'GET media/graph?days=', 'GET metrics/<subject_type>/<id>?days=', 'GET observations', 'POST versions/register', 'GET versions', 'POST clicks/resolve', 'GET journey/<profile_id>', 'GET touchpoints', 'GET|POST proposals', 'POST rules/evaluate {text,subject_type,subject_id}'] }, 404);
}
