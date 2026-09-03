// POST /api/tenants — the one route from the minimum proof (/a/buy-outcomes-not-subscriptions
// §minimum-proof item 1): create a tenant with a balance, so a priced capability has someone
// to charge. Owner-authed: provisioning a paying customer is an owner act until self-serve
// funding (Stripe payment link → webhook credit) is wired to this route.
// GET lists tenants with balances and spend so a receipt can name what it debited.
import { isBuildAuthed } from '../_lib/admin_session.js';
import { buildNowIso } from '../_lib/build_time.js';

function json(o, status = 200) {
  return new Response(JSON.stringify(o, null, 2), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
}

function normalizeTenantId(raw) {
  const slug = String(raw || '').toLowerCase().replace(/^t_/, '').replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return slug ? 't_' + slug : null;
}

export async function onRequestGet({ request, env }) {
  if (!(await isBuildAuthed(request, env))) return json({ error: 'not_found' }, 404);
  if (!env.LEDGER) return json({ error: 'no_ledger_binding' }, 500);
  const tenants = (await env.LEDGER.prepare(
    'SELECT tenant_id, name, status, allow_keys, allow_prefixes, risk_ceiling, balance_usd, created_at FROM tenants ORDER BY created_at',
  ).all()).results || [];
  const spend = (await env.LEDGER.prepare(
    'SELECT tenant_id, COUNT(*) AS charges, ROUND(SUM(price_usd),6) AS charged_usd, ROUND(SUM(cost_usd),6) AS cost_usd FROM charges GROUP BY tenant_id',
  ).all()).results || [];
  const byTenant = Object.fromEntries(spend.map((s) => [s.tenant_id, s]));
  return json({ tenants: tenants.map((t) => ({ ...t, spend: byTenant[t.tenant_id] || { charges: 0, charged_usd: 0, cost_usd: 0 } })) });
}

export async function onRequestPost({ request, env }) {
  if (!(await isBuildAuthed(request, env))) return json({ error: 'not_found' }, 404);
  if (!env.LEDGER) return json({ error: 'no_ledger_binding' }, 500);
  let body = {};
  try { body = await request.json(); } catch { return json({ error: 'body must be JSON' }, 400); }
  const tenantId = normalizeTenantId(body.tenant_id || body.name);
  if (!tenantId) return json({ error: 'tenant_id or name required' }, 400);
  const existing = await env.LEDGER.prepare('SELECT tenant_id FROM tenants WHERE tenant_id = ?').bind(tenantId).first();
  if (existing) return json({ error: 'tenant_exists', tenant_id: tenantId }, 409);
  const balance = Math.max(0, Math.round(Number(body.balance_usd || 0) * 1e6) / 1e6);
  const row = {
    tenant_id: tenantId,
    name: String(body.name || tenantId.slice(2)),
    status: 'active',
    allow_keys: String(body.allow_keys || ''),
    allow_prefixes: String(body.allow_prefixes || ''),
    risk_ceiling: body.risk_ceiling === 'high' ? 'high' : 'low',
    owner_actor: String(body.owner_actor || 'owner'),
    created_at: buildNowIso(),
    balance_usd: balance,
  };
  await env.LEDGER.prepare(
    'INSERT INTO tenants (tenant_id, name, status, allow_keys, allow_prefixes, risk_ceiling, owner_actor, created_at, balance_usd) VALUES (?,?,?,?,?,?,?,?,?)',
  ).bind(row.tenant_id, row.name, row.status, row.allow_keys, row.allow_prefixes, row.risk_ceiling, row.owner_actor, row.created_at, row.balance_usd).run();
  return json({
    ok: true,
    tenant: row,
    funding: balance > 0
      ? { funded_usd: balance, by: row.owner_actor, note: 'balance granted at creation' }
      : { funded_usd: 0, note: 'fund via STRIPE_PAYMENT_LINK_CREATE, then credit balance_usd' },
    next: 'mint a tenant-bound capability (CAP_MINT with tenant=' + tenantId + ') and invoke a priced directory row',
  });
}
